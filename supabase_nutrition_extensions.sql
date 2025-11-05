-- Additional nutrition analytics objects
-- Create a daily aggregation view (RLS friendly because it selects from a table with RLS enabled)
CREATE OR REPLACE VIEW daily_nutrition_view AS
SELECT
  user_id,
  (date_trunc('day', timestamp AT TIME ZONE 'UTC'))::date AS day,
  SUM( (nutrition->>'calories')::numeric ) AS calories,
  SUM( (nutrition->>'protein')::numeric ) AS protein,
  SUM( (nutrition->>'carbs')::numeric )   AS carbs,
  SUM( (nutrition->>'fat')::numeric )     AS fat,
  SUM( (nutrition->>'fiber')::numeric )   AS fiber,
  SUM( (nutrition->>'sugar')::numeric )   AS sugar,
  SUM( (nutrition->>'sodium')::numeric )  AS sodium,
  COUNT(*) AS entries
FROM nutrition_history
GROUP BY user_id, day;

-- Optional index to accelerate date range queries
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_view_user_day ON nutrition_history(user_id, timestamp DESC);

-- RLS already enforced by underlying table. If you want to expose via a security definer function:
CREATE OR REPLACE FUNCTION get_daily_nutrition_range(p_start date, p_end date)
RETURNS SETOF daily_nutrition_view
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM daily_nutrition_view
  WHERE day BETWEEN p_start AND p_end
  AND user_id = auth.uid();
$$;

-- Ensure owner is postgres so SECURITY DEFINER is safe
ALTER FUNCTION get_daily_nutrition_range(date, date) OWNER TO postgres;
