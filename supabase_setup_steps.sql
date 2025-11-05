-- Step-by-Step Supabase Setup for meal.it Authentication
-- Run these commands one by one in the Supabase SQL Editor

-- STEP 1: Create the updated nutrition_history table with user authentication
-- (Run this first, then proceed to next steps)

DROP TABLE IF EXISTS nutrition_history CASCADE;

CREATE TABLE nutrition_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    timestamp timestamptz NOT NULL DEFAULT now(),
    food_items text[],
    nutrition jsonb,
    image_url text
);

-- Enable RLS on nutrition_history
ALTER TABLE nutrition_history ENABLE ROW LEVEL SECURITY;

-- STEP 2: Create RLS policies for nutrition_history
-- (Run these after Step 1 is successful)

CREATE POLICY "Users can view own nutrition history" ON nutrition_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrition history" ON nutrition_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nutrition history" ON nutrition_history
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own nutrition history" ON nutrition_history
    FOR DELETE USING (auth.uid() = user_id);

-- STEP 3: Create the community_posts table
-- (Run this after Step 2 is complete)

DROP TABLE IF EXISTS community_posts CASCADE;

CREATE TABLE community_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    author_name text DEFAULT 'Anonymous',
    title text NOT NULL,
    content text NOT NULL,
    tags text[],
    upvotes int DEFAULT 0
);

-- Enable RLS on community_posts
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create RLS policies for community_posts
-- (Run these after Step 3 is successful)

CREATE POLICY "Everyone can view community posts" ON community_posts
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create posts" ON community_posts
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update own posts" ON community_posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" ON community_posts
    FOR DELETE USING (auth.uid() = user_id);

-- STEP 5: Create the community_replies table
-- (Run this after Step 4 is complete)

DROP TABLE IF EXISTS community_replies CASCADE;

CREATE TABLE community_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    author_name text DEFAULT 'Anonymous',
    content text NOT NULL
);

-- Enable RLS on community_replies
ALTER TABLE community_replies ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create RLS policies for community_replies
-- (Run these after Step 5 is successful)

CREATE POLICY "Everyone can view replies" ON community_replies
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create replies" ON community_replies
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update own replies" ON community_replies
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own replies" ON community_replies
    FOR DELETE USING (auth.uid() = user_id);

-- STEP 7: Create the diet_recommendations table
-- (Run this after Step 6 is complete)

DROP TABLE IF EXISTS diet_recommendations CASCADE;

CREATE TABLE diet_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    nutrition_history_id uuid REFERENCES nutrition_history(id) ON DELETE CASCADE,
    recommendations jsonb
);

-- Enable RLS on diet_recommendations
ALTER TABLE diet_recommendations ENABLE ROW LEVEL SECURITY;

-- STEP 8: Create RLS policies for diet_recommendations
-- (Run these after Step 7 is successful)

CREATE POLICY "Users can view own recommendations" ON diet_recommendations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendations" ON diet_recommendations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- STEP 9: Create user_profiles table
-- (Run this after Step 8 is complete)

CREATE TABLE IF NOT EXISTS user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    display_name text DEFAULT 'Anonymous User',
    avatar_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- STEP 10: Create RLS policies for user_profiles
-- (Run these after Step 9 is successful)

CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- STEP 11: Create indexes for performance
-- (Run this after Step 10 is complete)

CREATE INDEX IF NOT EXISTS idx_nutrition_history_user_timestamp ON nutrition_history(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_replies_post_id ON community_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_diet_recommendations_user ON diet_recommendations(user_id, created_at DESC);

-- STEP 12: Create utility functions
-- (Run this after Step 11 is complete)

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, display_name)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'Anonymous User')
    );
    RETURN NEW;
END;
$$ language plpgsql security definer;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- STEP 13: Create triggers
-- (Run this after Step 12 is complete)

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Trigger to update updated_at on user_profiles
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- SETUP COMPLETE! 
-- Your meal.it database is now ready for multi-user authentication.