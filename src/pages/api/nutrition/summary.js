// /api/nutrition/summary - aggregate nutrition over periods
import { supabase } from '../../../utils/supabaseClient';
import { parseISO, subDays, startOfDay, endOfDay, differenceInCalendarDays } from 'date-fns';

async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function resolveRange(range, start, end) {
  const today = new Date();
  switch(range) {
    case '5d': return { start: startOfDay(subDays(today, 4)), end: endOfDay(today) };
    case '7d': return { start: startOfDay(subDays(today, 6)), end: endOfDay(today) };
    case '30d': return { start: startOfDay(subDays(today, 29)), end: endOfDay(today) };
    case 'custom': {
      if (!start || !end) throw new Error('Custom range requires start and end');
      let s = startOfDay(parseISO(start));
      let e = endOfDay(parseISO(end));
      if (isNaN(s) || isNaN(e)) throw new Error('Invalid date format. Use YYYY-MM-DD');
      if (s > e) { const tmp = s; s = startOfDay(e); e = endOfDay(tmp); }
      const span = differenceInCalendarDays(e, s) + 1;
      if (span > 180) throw new Error('Custom range too large (max 180 days)');
      return { start: s, end: e };
    }
    default:
      return { start: startOfDay(subDays(today, 6)), end: endOfDay(today) }; // default 7d
  }
}

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
  const { range = '7d', start, end } = req.query;
  const { start: from, end: to } = resolveRange(range, start, end);

    // Use view if exists, else aggregate directly
    const { data, error } = await supabase
      .from('nutrition_history')
      .select('timestamp, nutrition')
      .eq('user_id', user.id)
      .gte('timestamp', from.toISOString())
      .lte('timestamp', to.toISOString());

    if (error) throw error;

    // Bucket by day
    const dayMap = new Map();
    for (const row of data) {
      const day = row.timestamp.slice(0, 10); // YYYY-MM-DD
      const n = row.nutrition || {};
      if (!dayMap.has(day)) dayMap.set(day, { calories:0, protein:0, carbs:0, fat:0, fiber:0, sugar:0, sodium:0, entries:0 });
      const agg = dayMap.get(day);
      const num = v => (typeof v === 'number' && isFinite(v)) ? v : Number(v) || 0;
      agg.calories += num(n.calories);
      agg.protein  += num(n.protein);
      agg.carbs    += num(n.carbs);
      agg.fat      += num(n.fat);
      agg.fiber    += num(n.fiber);
      agg.sugar    += num(n.sugar);
      agg.sodium   += num(n.sodium);
      agg.entries++;
    }

    const daily = Array.from(dayMap.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([day,vals])=>({ day, ...vals }));

    // Totals / averages
    const totals = daily.reduce((acc, d) => {
      for (const k of ['calories','protein','carbs','fat','fiber','sugar','sodium']) acc[k]+=d[k];
      acc.days++;
      return acc;
    }, { calories:0, protein:0, carbs:0, fat:0, fiber:0, sugar:0, sodium:0, days:0 });
    const averages = { ...totals };
    if (totals.days>0) {
      for (const k of ['calories','protein','carbs','fat','fiber','sugar','sodium']) averages[k] = +(totals[k]/totals.days).toFixed(2);
    }

    res.status(200).json({ range, start: from.toISOString(), end: to.toISOString(), daily, totals, averages });
  } catch (e) {
    console.error('Summary error', e);
    res.status(500).json({ error: e.message });
  }
}
