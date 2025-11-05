-- Migration: nutrition_history & nutrition_recommendations schema, RLS policies, helper function
-- Date: 2025-10-14
-- Idempotent: guarded with IF NOT EXISTS checks

-- Enable required extensions
create extension if not exists "pgcrypto"; -- for gen_random_uuid

-- Core table for user nutrition entries
create table if not exists public.nutrition_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  timestamp timestamptz not null default now(),
  food_items text[] not null default '{}',
  nutrition jsonb not null,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_nutrition_history_user_ts on public.nutrition_history(user_id, timestamp desc);
create index if not exists idx_nutrition_history_gin_food on public.nutrition_history using gin(food_items);

alter table public.nutrition_history enable row level security;

-- Drop existing policies if you want to redefine (comment out in production if not desired)
-- drop policy if exists "nh_select" on public.nutrition_history;
-- drop policy if exists "nh_insert" on public.nutrition_history;
-- drop policy if exists "nh_update" on public.nutrition_history;
-- drop policy if exists "nh_delete" on public.nutrition_history;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nutrition_history' AND policyname = 'nh_select'
  ) THEN
    EXECUTE 'create policy "nh_select" on public.nutrition_history for select using (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nutrition_history' AND policyname = 'nh_insert'
  ) THEN
    EXECUTE 'create policy "nh_insert" on public.nutrition_history for insert with check (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nutrition_history' AND policyname = 'nh_update'
  ) THEN
    EXECUTE 'create policy "nh_update" on public.nutrition_history for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nutrition_history' AND policyname = 'nh_delete'
  ) THEN
    EXECUTE 'create policy "nh_delete" on public.nutrition_history for delete using (auth.uid() = user_id)';
  END IF;
END $$;

-- Recommendations persistent cache table
create table if not exists public.nutrition_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_nutrition_recs_user_created on public.nutrition_recommendations(user_id, created_at desc);

alter table public.nutrition_recommendations enable row level security;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nutrition_recommendations' AND policyname = 'nr_select'
  ) THEN
    EXECUTE 'create policy "nr_select" on public.nutrition_recommendations for select using (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'nutrition_recommendations' AND policyname = 'nr_insert'
  ) THEN
    EXECUTE 'create policy "nr_insert" on public.nutrition_recommendations for insert with check (auth.uid() = user_id)';
  END IF;
END $$;

-- Optional pruning (manual / scheduled) can delete older rows; reuse same policies

-- RPC function (security definer) to insert a nutrition history row when client policies are insufficient
create or replace function public.insert_nutrition_entry(_food_items text[], _nutrition jsonb, _image_url text, _timestamp timestamptz default now())
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_id uuid;
begin
  -- Use auth.uid() to bind to caller, prevents impersonation
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.nutrition_history(user_id, food_items, nutrition, image_url, timestamp)
    values (v_user, coalesce(_food_items,'{}'), coalesce(_nutrition,'{}'::jsonb), _image_url, coalesce(_timestamp, now()))
    returning id into v_id;
  return v_id;
end;$$;

revoke all on function public.insert_nutrition_entry(text[], jsonb, text, timestamptz) from public;
grant execute on function public.insert_nutrition_entry(text[], jsonb, text, timestamptz) to authenticated;

-- View for daily aggregation (optional reference)
-- If a function returns daily_nutrition_view's composite type, we must drop it first.
drop function if exists public.get_daily_nutrition_range(date, date);
drop view if exists public.daily_nutrition_view;
create view public.daily_nutrition_view as
select user_id,
       date_trunc('day', timestamp) as day,
       sum( (nutrition->>'calories')::numeric ) as total_calories,
       sum( (nutrition->>'protein')::numeric )  as total_protein,
       sum( (nutrition->>'carbs')::numeric )    as total_carbs,
       sum( (nutrition->>'fat')::numeric )      as total_fat
from public.nutrition_history
group by user_id, date_trunc('day', timestamp);

comment on view public.daily_nutrition_view is 'Per-user daily macro aggregates for fast summary queries.';

-- Recreate helper range function (now returning a stable explicit TABLE signature instead of depending on the view type)
create or replace function public.get_daily_nutrition_range(_start date, _end date)
returns table (
  user_id uuid,
  day date,
  total_calories numeric,
  total_protein numeric,
  total_carbs numeric,
  total_fat numeric
) language sql stable security definer set search_path = public as $$
  select d.user_id, d.day::date, d.total_calories, d.total_protein, d.total_carbs, d.total_fat
  from public.daily_nutrition_view d
  where d.day >= date_trunc('day', _start)
    and d.day < date_trunc('day', _end) + interval '1 day'
  order by d.day;
$$;

revoke all on function public.get_daily_nutrition_range(date, date) from public;
grant execute on function public.get_daily_nutrition_range(date, date) to authenticated;

-- Done