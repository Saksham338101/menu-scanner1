-- Updated Supabase Schema with User Authentication for meal.it
-- This schema supports multi-user deployment with proper session management

-- Updated Nutrition History Table with user authentication
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

-- Policy: Users can only see their own nutrition history
CREATE POLICY "Users can view own nutrition history" ON nutrition_history
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can only insert their own nutrition history
CREATE POLICY "Users can insert own nutrition history" ON nutrition_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own nutrition history
CREATE POLICY "Users can update own nutrition history" ON nutrition_history
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can only delete their own nutrition history
CREATE POLICY "Users can delete own nutrition history" ON nutrition_history
    FOR DELETE USING (auth.uid() = user_id);

-- Updated Community Posts Table with user authentication
DROP TABLE IF EXISTS community_posts CASCADE;
CREATE TABLE community_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    author_name text, -- display name (can be anonymous)
    title text NOT NULL,
    content text NOT NULL,
    tags text[],
    upvotes int DEFAULT 0
);

-- Enable RLS on community_posts
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view community posts (public forum)
CREATE POLICY "Everyone can view community posts" ON community_posts
    FOR SELECT USING (true);

-- Policy: Authenticated users can create posts
CREATE POLICY "Authenticated users can create posts" ON community_posts
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Policy: Users can update their own posts
CREATE POLICY "Users can update own posts" ON community_posts
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own posts
CREATE POLICY "Users can delete own posts" ON community_posts
    FOR DELETE USING (auth.uid() = user_id);

-- Updated Community Replies Table with user authentication
DROP TABLE IF EXISTS community_replies CASCADE;
CREATE TABLE community_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    author_name text, -- display name (can be anonymous)
    content text NOT NULL
);

-- Enable RLS on community_replies
ALTER TABLE community_replies ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view replies (public forum)
CREATE POLICY "Everyone can view replies" ON community_replies
    FOR SELECT USING (true);

-- Policy: Authenticated users can create replies
CREATE POLICY "Authenticated users can create replies" ON community_replies
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Policy: Users can update their own replies
CREATE POLICY "Users can update own replies" ON community_replies
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own replies
CREATE POLICY "Users can delete own replies" ON community_replies
    FOR DELETE USING (auth.uid() = user_id);

-- Updated Diet Recommendations Table with user authentication
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

-- Policy: Users can only see their own recommendations
CREATE POLICY "Users can view own recommendations" ON diet_recommendations
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can only create their own recommendations
CREATE POLICY "Users can insert own recommendations" ON diet_recommendations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Profiles Table for additional user information
CREATE TABLE user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    display_name text,
    avatar_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nutrition_history_user_timestamp ON nutrition_history(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_replies_post_id ON community_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_diet_recommendations_user ON diet_recommendations(user_id, created_at DESC);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, display_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Anonymous User'));
    RETURN NEW;
END;
$$ language plpgsql security definer;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on user_profiles
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();