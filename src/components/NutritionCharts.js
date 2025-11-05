import { useEffect, useState, useMemo, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, Tooltip, Legend, PointElement, LineElement, Filler } from 'chart.js';
import { authenticatedPost } from '../utils/authenticatedApi';
ChartJS.register(CategoryScale, LinearScale, Tooltip, Legend, PointElement, LineElement, Filler);

const MIN_DAYS = 5;

function processLocalHistory(historyData, days = 7) {
  if (!historyData || historyData.length === 0) return null;

  const today = new Date();
  const dateRange = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    dateRange.push(date.toISOString().split('T')[0]);
  }

  const dayMap = new Map();
  dateRange.forEach((dayKey) => {
    dayMap.set(dayKey, {
      day: dayKey,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      mealCount: 0,
    });
  });

  historyData.forEach((entry) => {
    const entryDate = new Date(entry.timestamp);
    const dayKey = entryDate.toISOString().split('T')[0];

    if (dayMap.has(dayKey)) {
      const dayData = dayMap.get(dayKey);
      const nutrition = entry.nutrition || {};

      dayData.calories += Math.round(nutrition.calories || 0);
      dayData.protein += Math.round(nutrition.protein || 0);
      dayData.carbs += Math.round(nutrition.carbs || 0);
      dayData.fat += Math.round(nutrition.fat || 0);
      dayData.mealCount += 1;
    }
  });

  const dailyData = Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day));
  const daysWithData = dailyData.filter((day) => day.mealCount > 0).length;
  if (daysWithData < MIN_DAYS) return null;

  const daysWithMeals = dailyData.filter((day) => day.mealCount > 0);
  const totals = daysWithMeals.reduce(
    (acc, day) => ({
      calories: acc.calories + day.calories,
      protein: acc.protein + day.protein,
      carbs: acc.carbs + day.carbs,
      fat: acc.fat + day.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const count = daysWithMeals.length;
  const averages = {
    calories: count > 0 ? Math.round(totals.calories / count) : 0,
    protein: count > 0 ? Math.round(totals.protein / count) : 0,
    carbs: count > 0 ? Math.round(totals.carbs / count) : 0,
    fat: count > 0 ? Math.round(totals.fat / count) : 0,
  };

  return {
    daily: dailyData,
    averages,
    period: `${days}d`,
    daysWithData,
    totalDays: days,
  };
}

export default function NutritionCharts({ nutritionHistory, onRecommendations }) {
  const [range, setRange] = useState('7d');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recLoading, setRecLoading] = useState(false);
  const [error, setError] = useState(null);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const load = useCallback((targetRange) => {
    setLoading(true);
    setError(null);

    try {
      let days = 7;
      if (targetRange === '5d') days = 5;
      else if (targetRange === '7d') days = 7;
      else if (targetRange === '30d') days = 30;
      else if (targetRange === 'custom') {
        if (!customStart || !customEnd) {
          setSummary(null);
          return;
        }
        const start = new Date(customStart);
        const end = new Date(customEnd);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          throw new Error('Select valid dates for custom range.');
        }
        const diffMs = Math.max(end.getTime() - start.getTime(), 0);
        days = Math.max(1, Math.min(365, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1));
      }

      console.log(`Processing ${days} days of history data...`);
      const processedData = processLocalHistory(nutritionHistory, days);
      console.log('Processed data:', processedData);
      setSummary(processedData);
    } catch (e) {
      console.error('Chart processing error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [customEnd, customStart, nutritionHistory]);

  useEffect(() => {
    load(range);
  }, [load, range]);

  const requestRecommendations = async () => {
    if(!summary) return;
    try {
      setRecLoading(true);
      const data = await authenticatedPost('/api/nutrition/recommendations', { summary });
      onRecommendations?.(data.recommendations);
    } catch(e){ setError(e.message); } finally { setRecLoading(false); }
  };

  // Prepare labels (empty if no data yet) so hooks run consistently across renders
  const labels = useMemo(() => {
    if (!summary?.daily) return [];
    return summary.daily.map((day) => {
      const date = new Date(day.day);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
  }, [summary]);

  const caloriesData = useMemo(()=>({
    labels,
    datasets: labels.length ? [{
      label:'Calories',
      data: summary.daily.map(d=>d.calories),
      borderColor:'#f59e0b',
      backgroundColor:'rgba(245,158,11,0.18)',
      tension:0.35,
      pointRadius:4,
      pointBackgroundColor:'#fbbf24',
      fill:true
    }] : []
  }),[summary, labels]);

  const macrosData = useMemo(()=>({
    labels,
    datasets: labels.length ? [
      {
        label:'Protein (g)',
        data: summary.daily.map(d=>d.protein),
        borderColor:'#2563eb',
        backgroundColor:'rgba(37,99,235,0.15)',
        tension:0.35,
        pointRadius:3,
        fill:true,
        yAxisID:'y'
      },
      {
        label:'Carbs (g)',
        data: summary.daily.map(d=>d.carbs),
        borderColor:'#16a34a',
        backgroundColor:'rgba(34,197,94,0.15)',
        tension:0.35,
        pointRadius:3,
        fill:true,
        yAxisID:'y'
      },
      {
        label:'Fat (g)',
        data: summary.daily.map(d=>d.fat),
        borderColor:'#dc2626',
        backgroundColor:'rgba(220,38,38,0.15)',
        tension:0.35,
        pointRadius:3,
        fill:true,
        yAxisID:'y'
      }
    ] : []
  }),[summary, labels]);

  // Compute dynamic y-axis max with headroom (10%) for each chart
  const maxCalories = labels.length ? Math.max(...summary.daily.map(d=>d.calories)) : 0;
  const caloriePadding = maxCalories ? Math.ceil(maxCalories * 0.1) : 50;
  const maxMacro = labels.length ? Math.max(...summary.daily.flatMap(d=>[d.protein,d.carbs,d.fat])) : 0;
  const macroPadding = maxMacro ? Math.ceil(maxMacro * 0.15) : 10;

  const sharedOptions = {
    responsive:true,
    maintainAspectRatio:false,
    interaction:{ mode:'index', intersect:false },
    plugins:{
      legend:{ position:'bottom', labels:{ usePointStyle:true, boxHeight:8 }},
      tooltip:{
        backgroundColor:'#1f2937',
        titleFont:{ size:12 },
        bodyFont:{ size:12 },
        callbacks:{
          label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}`
        }
      }
    },
    scales:{
      x:{ grid:{ display:false }},
      y:{ beginAtZero:true, grid:{ color:'rgba(0,0,0,0.05)' }, ticks:{ precision:0 } }
    }
  };

  const macroOptions = {
    ...sharedOptions,
    scales:{
      x: sharedOptions.scales.x,
      y: { ...sharedOptions.scales.y, suggestedMax: maxMacro + macroPadding, title:{ display:true, text:'Grams' } }
    }
  };

  const caloriesOptions = {
    ...sharedOptions,
    plugins:{
      ...sharedOptions.plugins,
      tooltip:{
        ...sharedOptions.plugins.tooltip,
        callbacks:{ label: ctx => `${ctx.parsed.y} kcal` }
      }
    },
    scales:{
      x: sharedOptions.scales.x,
      y: { ...sharedOptions.scales.y, suggestedMax: maxCalories + caloriePadding, title:{ display:true, text:'Calories' } }
    }
  };

  return (
    <div className='space-y-6'>
      {error && <div className='p-4 text-red-600'>Error: {error}</div>}
      <div className='flex flex-wrap items-center gap-3'>
        <select value={range} onChange={e=>setRange(e.target.value)} className='border rounded px-3 py-2'>
          <option value='5d'>Last 5 Days</option>
            <option value='7d'>Last 7 Days</option>
            <option value='30d'>Last 30 Days</option>
            <option value='custom'>Custom Range</option>
        </select>
        {range === 'custom' && (
          <div className='flex flex-wrap items-center gap-2'>
            <input type='date' value={customStart} onChange={e=>setCustomStart(e.target.value)} className='border rounded px-2 py-1'/>
            <span className='text-gray-500'>to</span>
            <input type='date' value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className='border rounded px-2 py-1'/>
            <button onClick={()=>load('custom')} disabled={!customStart||!customEnd} className='bg-blue-600 disabled:opacity-40 text-white px-3 py-1 rounded'>Apply</button>
          </div>
        )}
  <button onClick={() => load(range)} className='bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded'>Refresh</button>
        <button disabled={recLoading} onClick={requestRecommendations} className='bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded disabled:opacity-50'>
          {recLoading ? 'Generating...' : 'Get AI Diet Advice'}
        </button>
      </div>
      {loading && !labels.length && (
        <div className='p-6 text-sm text-gray-500'>Loading charts...</div>
      )}
      {!loading && !error && !labels.length && (
        <div className='p-6 text-sm text-gray-500'>No data yet. Add a meal to see your trends.</div>
      )}
      {summary && summary.daysWithData >= MIN_DAYS && (
        <>
          <div className='grid gap-6 lg:grid-cols-5'>
            <div className='bg-white shadow rounded p-4 lg:col-span-2 min-h-[300px] flex flex-col'>
              <h3 className='font-semibold mb-2'>Calories Trend</h3>
              <div className='flex-1'><Line data={caloriesData} options={caloriesOptions} /></div>
            </div>
            <div className='bg-white shadow rounded p-4 lg:col-span-3 min-h-[300px] flex flex-col'>
              <h3 className='font-semibold mb-2'>Macro Trends</h3>
              <div className='flex-1'><Line data={macrosData} options={macroOptions} /></div>
            </div>
          </div>
          <div className='bg-white shadow rounded p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm'>
            {[['Calories', summary.averages.calories, 'kcal'], ['Protein', summary.averages.protein, 'g'], ['Carbs', summary.averages.carbs,'g'], ['Fat', summary.averages.fat,'g']].map(([k,v,u])=> (
              <div key={k} className='flex flex-col'>
                <span className='text-gray-500'>{k} Avg</span>
                <span className='text-lg font-semibold'>{v}{u}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {summary && summary.daysWithData > 0 && summary.daysWithData < MIN_DAYS && !loading && !error && (
        <div className='p-6 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded'>
          Need at least {MIN_DAYS} different calendar days of meal data to display trends. Currently you have logged meals on {summary.daysWithData} day{summary.daysWithData !== 1 ? 's' : ''}. Keep logging meals on different days!
        </div>
      )}
      {!summary && nutritionHistory && nutritionHistory.length > 0 && !loading && !error && (
        <div className='p-6 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded'>
          You have {nutritionHistory.length} meal{nutritionHistory.length !== 1 ? 's' : ''} logged, but need meals logged across at least {MIN_DAYS} different calendar days to show trends.
        </div>
      )}
    </div>
  );
}
