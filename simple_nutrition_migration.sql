-- Simple nutrition history table (drop and recreate to reset)
DROP TABLE IF EXISTS public.nutrition_history CASCADE;

CREATE TABLE public.nutrition_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  food_items text[] NOT NULL DEFAULT '{}',
  nutrition jsonb NOT NULL DEFAULT '{}',
  image_url text,
  health_status text DEFAULT 'unknown',
  health_advice text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nutrition_history ENABLE ROW LEVEL SECURITY;

-- Simple policy: users can only see and insert their own data
CREATE POLICY "Users can manage their own nutrition data" ON public.nutrition_history
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_nutrition_history_user_timestamp 
ON public.nutrition_history(user_id, timestamp DESC);

-- Grant permissions
GRANT ALL ON public.nutrition_history TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;