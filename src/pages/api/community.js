// src/pages/api/community.js - User-authenticated community API for meal.it
import { supabase } from '../../utils/supabaseClient';

// Helper function to get user from request
async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Get community posts (public, no auth required for viewing)
      const { data, error } = await supabase
        .from('community_posts')
        .select(`
          *,
          community_replies (
            id,
            content,
            author_name,
            created_at
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Error fetching community posts:', error);
        return res.status(500).json({ error: error.message });
      }
      
      res.status(200).json(data || []);
    } catch (error) {
      console.error('Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    // Get authenticated user for creating posts
    const user = await getUserFromRequest(req);
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required to create posts' });
    }

    try {
      const { title, content, tags, author_name, reply_to } = req.body;
      
      if (reply_to) {
        // Creating a reply
        if (!content) {
          return res.status(400).json({ error: 'Content is required for replies' });
        }
        
        const { data, error } = await supabase
          .from('community_replies')
          .insert([{
            post_id: reply_to,
            user_id: user.id,
            content,
            author_name: author_name || 'Anonymous'
          }])
          .select();
        
        if (error) {
          console.error('Error creating reply:', error);
          return res.status(500).json({ error: error.message });
        }
        
        res.status(201).json(data[0]);
      } else {
        // Creating a new post
        if (!title || !content) {
          return res.status(400).json({ error: 'Title and content are required' });
        }
        
        const { data, error } = await supabase
          .from('community_posts')
          .insert([{
            user_id: user.id,
            title,
            content,
            tags: tags || [],
            author_name: author_name || 'Anonymous'
          }])
          .select();
        
        if (error) {
          console.error('Error creating post:', error);
          return res.status(500).json({ error: error.message });
        }
        
        res.status(201).json(data[0]);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    // Get authenticated user for upvoting posts
    const user = await getUserFromRequest(req);
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required to upvote posts' });
    }

    try {
      const { post_id } = req.body;
      
      if (!post_id) {
        return res.status(400).json({ error: 'Post ID is required' });
      }
      
      // Increment upvote count
      const { data, error } = await supabase
        .from('community_posts')
        .update({ upvotes: supabase.sql`upvotes + 1` })
        .eq('id', post_id)
        .select();
      
      if (error) {
        console.error('Error upvoting post:', error);
        return res.status(500).json({ error: error.message });
      }
      
      res.status(200).json(data[0]);
    } catch (error) {
      console.error('Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}