// /api/nutrition/debug - Diagnostics for nutrition history issues (development use only)
// WARNING: Remove or protect this endpoint in production.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getBearer(req){
  const h = req.headers.authorization; if(!h||!h.startsWith('Bearer ')) return null; return h.split(' ')[1];
}

export default async function handler(req,res){
  if(process.env.NODE_ENV === 'production'){
    return res.status(403).json({ error: 'Disabled in production' });
  }
  const token = getBearer(req);
  if(!token) return res.status(401).json({ error: 'Missing bearer token'});

  const client = createClient(supabaseUrl, supabaseAnonKey, { global:{ headers:{ Authorization:`Bearer ${token}` } }, auth:{ persistSession:false, detectSessionInUrl:false }});
  const { data: { user }, error: userErr } = await client.auth.getUser(token);
  if(userErr || !user) return res.status(401).json({ error: 'Invalid token', detail: userErr?.message });

  // Check policies visibility by attempting select without filter
  const { data: allData, error: selectErr } = await client
    .from('nutrition_history')
    .select('*')
    .order('timestamp', { ascending:false })
    .limit(5);

  const { data: filteredData, error: filteredErr } = await client
    .from('nutrition_history')
    .select('*')
    .eq('user_id', user.id)
    .order('timestamp', { ascending:false })
    .limit(5);

  const { data: countData, error: countErr } = await client
    .from('nutrition_history')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  return res.status(200).json({
    user: { id: user.id },
    policy_test: {
      unfiltered_sample: allData || [],
      unfiltered_error: selectErr?.message,
      filtered_sample: filteredData || [],
      filtered_error: filteredErr?.message,
      user_row_count: countData === null ? null : countData.length,
      count_error: countErr?.message
    }
  });
}
