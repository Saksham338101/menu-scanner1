-- Migration: Health profiles, Restaurants, Menu, Reviews, RLS
-- Date: 2025-10-18

create extension if not exists "pgcrypto";

-- User health profile (1:1 with auth.users)
create table if not exists public.user_health_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  height_cm numeric,
  weight_kg numeric,
  diet text,
  diet_type text, -- e.g., vegetarian, vegan, keto, etc.
  allergies text[] default '{}',
  conditions text[] default '{}', -- chronic conditions
  family_history text[] default '{}',
  fitness_targets jsonb default '{}'::jsonb, -- {calorie_target, macros, goals}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.user_health_profiles add column if not exists created_at timestamptz not null default now();
alter table if exists public.user_health_profiles add column if not exists updated_at timestamptz not null default now();

alter table if exists public.user_health_profiles add column if not exists diet text;
update public.user_health_profiles set diet = coalesce(diet, diet_type) where diet is null and diet_type is not null;

-- Trigger function to set updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_user_health_profiles_updated on public.user_health_profiles;
create trigger trg_user_health_profiles_updated
before update on public.user_health_profiles
for each row execute function public.set_updated_at();

alter table public.user_health_profiles enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'user_health_profiles' and policyname = 'uhp_select'
  ) then
    execute 'create policy "uhp_select" on public.user_health_profiles for select using (auth.uid() = user_id)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'user_health_profiles' and policyname = 'uhp_upsert'
  ) then
    execute 'create policy "uhp_upsert" on public.user_health_profiles for insert with check (auth.uid() = user_id)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'user_health_profiles' and policyname = 'uhp_update'
  ) then
    execute 'create policy "uhp_update" on public.user_health_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  cuisine text,
  cuisine_types text[] default '{}',
  address text,
  location text,
  phone text,
  image_url text,
  website text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.restaurants alter column owner_user_id drop not null;
alter table if exists public.restaurants add column if not exists metadata jsonb default '{}'::jsonb;
alter table if exists public.restaurants add column if not exists created_at timestamptz not null default now();
alter table if exists public.restaurants add column if not exists updated_at timestamptz not null default now();

alter table public.restaurants enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'restaurants' and policyname = 'rest_select_public'
  ) then
    execute 'create policy "rest_select_public" on public.restaurants for select using (true)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'restaurants' and policyname = 'rest_owner_manage'
  ) then
    execute 'create policy "rest_owner_manage" on public.restaurants for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id)';
  end if;
end $$;

drop trigger if exists trg_restaurants_updated on public.restaurants;
create trigger trg_restaurants_updated
before update on public.restaurants
for each row execute function public.set_updated_at();

create index if not exists idx_restaurants_slug on public.restaurants(slug);

-- Standalone partner accounts for menu scanning and QR workflows
create table if not exists public.restaurant_partners (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  restaurant_name text,
  restaurant_slug text,
  cuisine text,
  location text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.restaurant_partners add column if not exists restaurant_slug text;
alter table if exists public.restaurant_partners add column if not exists cuisine text;
alter table if exists public.restaurant_partners add column if not exists location text;
alter table if exists public.restaurant_partners add column if not exists metadata jsonb default '{}'::jsonb;
alter table if exists public.restaurant_partners add column if not exists created_at timestamptz not null default now();
alter table if exists public.restaurant_partners add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_restaurant_partners_slug on public.restaurant_partners(restaurant_slug) where restaurant_slug is not null;

alter table public.restaurant_partners enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'restaurant_partners' and policyname = 'partner_service_manage'
  ) then
    execute '
      create policy "partner_service_manage" on public.restaurant_partners
      for all
      using (current_setting(''request.jwt.claim.role'', true) = ''service_role'')
      with check (current_setting(''request.jwt.claim.role'', true) = ''service_role'')
    ';
  end if;
end $$;

drop trigger if exists trg_restaurant_partners_updated on public.restaurant_partners;
create trigger trg_restaurant_partners_updated
before update on public.restaurant_partners
for each row execute function public.set_updated_at();

-- Helper: check if current user owns the restaurant (created after restaurants)
create or replace function public.is_restaurant_owner(_restaurant_id uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from public.restaurants r
    where r.id = _restaurant_id and r.owner_user_id = auth.uid()
  );
$$;

revoke all on function public.is_restaurant_owner(uuid) from public;
grant execute on function public.is_restaurant_owner(uuid) to authenticated;

-- Menu items for restaurants
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  price numeric,
  tags text[] default '{}',
  nutrition jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.menu_items drop constraint if exists menu_items_restaurant_id_fkey;
alter table if exists public.menu_items add column if not exists created_at timestamptz not null default now();
alter table if exists public.menu_items add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_menu_items_restaurant on public.menu_items(restaurant_id);

drop trigger if exists trg_menu_items_updated on public.menu_items;
create trigger trg_menu_items_updated
before update on public.menu_items
for each row execute function public.set_updated_at();

alter table public.menu_items enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'menu_items' and policyname = 'menu_select_public'
  ) then
    execute 'create policy "menu_select_public" on public.menu_items for select using (true)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'menu_items' and policyname = 'menu_owner_manage'
  ) then
    execute 'create policy "menu_owner_manage" on public.menu_items for all using (public.is_restaurant_owner(restaurant_id)) with check (public.is_restaurant_owner(restaurant_id))';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'menu_items' and policyname = 'menu_public_insert'
  ) then
    execute 'create policy "menu_public_insert" on public.menu_items for insert with check (true)';
  end if;
end $$;

-- Reviews (optional, can be user-sourced or imported)
create table if not exists public.restaurant_reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source text default 'user',
  rating numeric,
  sentiment text,
  content text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_reviews_restaurant on public.restaurant_reviews(restaurant_id);

alter table public.restaurant_reviews enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'restaurant_reviews' and policyname = 'reviews_select_public'
  ) then
    execute 'create policy "reviews_select_public" on public.restaurant_reviews for select using (true)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'restaurant_reviews' and policyname = 'reviews_auth_insert'
  ) then
    execute 'create policy "reviews_auth_insert" on public.restaurant_reviews for insert with check (created_by = auth.uid())';
  end if;
end $$;

-- Grants
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.user_health_profiles to authenticated;
grant select, insert, update, delete on public.restaurants to authenticated;
grant select, insert, update, delete on public.menu_items to authenticated;
grant select, insert on public.restaurant_reviews to authenticated;
grant select, insert, update, delete on public.restaurant_partners to service_role;

-- Done