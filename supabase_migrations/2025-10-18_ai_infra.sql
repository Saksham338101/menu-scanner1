-- Migration: AI infrastructure and nutrition schema alignment
-- Date: 2025-10-18

-- 1) Align nutrition_history schema with API (health_status, health_advice)
alter table if exists public.nutrition_history
  add column if not exists health_status text,
  add column if not exists health_advice text;

-- 2) AI requests log (optional, useful for debugging/rate/observability)
create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  request_type text check (request_type in ('detect_food','menu_assessment','recommendation','other')),
  model text,
  input_hash text,
  input jsonb,
  response jsonb,
  status text default 'success',
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_requests_user_created on public.ai_requests(user_id, created_at desc);
create index if not exists idx_ai_requests_type_created on public.ai_requests(request_type, created_at desc);

alter table public.ai_requests enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'ai_requests' and policyname = 'air_select_own'
  ) then
    execute 'create policy "air_select_own" on public.ai_requests for select using (auth.uid() = user_id)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'ai_requests' and policyname = 'air_insert_own'
  ) then
    execute 'create policy "air_insert_own" on public.ai_requests for insert with check (user_id is null or auth.uid() = user_id)';
  end if;
end $$;

grant select, insert on public.ai_requests to authenticated;

-- 3) Food analysis cache (deduplicate repeated image analyses by hash)
create table if not exists public.food_analysis_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  image_hash text not null,
  analysis jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, image_hash)
);

create index if not exists idx_food_analysis_cache_user_hash on public.food_analysis_cache(user_id, image_hash);

alter table public.food_analysis_cache enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'food_analysis_cache' and policyname = 'fac_select_own'
  ) then
    execute 'create policy "fac_select_own" on public.food_analysis_cache for select using (auth.uid() = user_id)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'food_analysis_cache' and policyname = 'fac_upsert_own'
  ) then
    execute 'create policy "fac_upsert_own" on public.food_analysis_cache for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;

grant select, insert, update, delete on public.food_analysis_cache to authenticated;

-- 4) Menu item AI assessments (owner-manage, public read)
create table if not exists public.menu_item_ai_assessments (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  assessment jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_miaa_menu on public.menu_item_ai_assessments(menu_item_id);

alter table public.menu_item_ai_assessments enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'menu_item_ai_assessments' and policyname = 'miaa_select_public'
  ) then
    execute 'create policy "miaa_select_public" on public.menu_item_ai_assessments for select using (true)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'menu_item_ai_assessments' and policyname = 'miaa_owner_manage'
  ) then
    execute '
      create policy "miaa_owner_manage" on public.menu_item_ai_assessments for all
      using (
        exists (
          select 1 from public.menu_items mi
          join public.restaurants r on r.id = mi.restaurant_id
          where mi.id = menu_item_id and r.owner_user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.menu_items mi
          join public.restaurants r on r.id = mi.restaurant_id
          where mi.id = menu_item_id and r.owner_user_id = auth.uid()
        )
      )
    ';
  end if;
end $$;

grant select, insert, update, delete on public.menu_item_ai_assessments to authenticated;

-- Done