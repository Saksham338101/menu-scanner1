-- Supabase SQL setup for Calorie Calculator & Community Forum
-- 1. Nutrition History Table
CREATE TABLE IF NOT EXISTS nutrition_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp timestamptz NOT NULL DEFAULT now(),
    food_items text[],
    nutrition jsonb,
    image_url text
);

-- 2. Community Forum Posts Table
CREATE TABLE IF NOT EXISTS community_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    author text, -- anonymous or nickname
    title text NOT NULL,
    content text NOT NULL,
    tags text[],
    upvotes int DEFAULT 0
);

-- 3. Community Forum Replies Table
CREATE TABLE IF NOT EXISTS community_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid REFERENCES community_posts(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    author text, -- anonymous or nickname
    content text NOT NULL
);

-- 4. Optional: Diet Recommendations Table (for future OpenAI/GPT logs)
CREATE TABLE IF NOT EXISTS diet_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    nutrition_history_id uuid REFERENCES nutrition_history(id) ON DELETE SET NULL,
    recommendations jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nutrition_history_timestamp ON nutrition_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_replies_post_id ON community_replies(post_id);
