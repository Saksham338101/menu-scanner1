// src/pages/api/nutrition.js - User-authenticated nutrition API for meal.it
import { createClient } from '@supabase/supabase-js';
import { supabase as browserSupabase } from '../../utils/supabaseClient'; // for token retrieval fallback if needed

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Helper function to get user from request
function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

async function getUserAndClient(req) {
  const token = getBearerToken(req);
  if (!token) return { user: null, client: null };

  // Create a per-request client with end-user access token for RLS (auth.uid()) context.
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, detectSessionInUrl: false }
  });

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return { user: null, client: null };
  return { user, client };
}

export default async function handler(req, res) {
  // Get authenticated user
  const { user, client } = await getUserAndClient(req);
  if (!user || !client) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.method === 'GET') {
    try {
      // Get user's nutrition history (RLS filters automatically)
      const { data, error } = await client
        .from('nutrition_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('Error fetching nutrition history:', error);
        return res.status(500).json({ error: error.message });
      }
      
      res.status(200).json(data || []);
    } catch (error) {
      console.error('Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      // Add new nutrition entry for authenticated user
      const { food_items, nutrition, image_url, timestamp, health_status, health_advice } = req.body;
      
      if (!food_items || !nutrition) {
        return res.status(400).json({ error: 'Missing required fields: food_items, nutrition' });
      }

      // Simple direct insert - let RLS handle security
      const entry = { 
        user_id: user.id,
        food_items: Array.isArray(food_items) ? food_items : [food_items],
        nutrition: nutrition,
        image_url: image_url || null,
        timestamp: timestamp || new Date().toISOString(),
        health_status: health_status || 'unknown',
        health_advice: health_advice || ''
      };

      console.log('Inserting nutrition entry for user:', user.id);

      const { data, error } = await client
        .from('nutrition_history')
        .insert([entry])
        .select()
        .single();

      if (error) {
        console.error('Insert failed:', error);
        return res.status(500).json({ error: 'Failed to save nutrition data', details: error.message });
      }

      console.log('Insert success:', { id: data.id, user: user.id });
      return res.status(201).json(data);
    } catch (error) {
      console.error('Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
