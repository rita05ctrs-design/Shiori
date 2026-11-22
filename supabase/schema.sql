-- ============================================================================
-- SHIORI (栞) — Supabase PostgreSQL Schema (Idempotent)
-- Architecture complète pour comptes utilisateurs, bibliothèque synchronisée,
-- statistiques AniList importées, activité et notifications temps réel.
-- ============================================================================

-- Extension UUID
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- TYPES ENUM (création idempotente)
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.media_type as enum ('ANIME', 'MANGA');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.library_status as enum (
    'WATCHING',
    'COMPLETED',
    'ON_HOLD',
    'DROPPED',
    'PLAN_TO_WATCH'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_kind as enum (
    'AIRING',
    'MILESTONE',
    'RECOMMENDATION',
    'SYSTEM'
  );
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 1. PROFILES (liés à auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  banner_url text,
  bio text default '',
  preferred_language text default 'fr',
  notification_prefs jsonb not null default '{
    "airingAlerts": true,
    "weeklyDigest": true,
    "milestones": true,
    "recommendations": false
  }'::jsonb,
  anilist_access_token text,
  anilist_user_id integer,
  anilist_username text,
  anilist_avatar_url text,
  anilist_site_url text,
  anilist_token_expires_at timestamptz,
  anilist_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration idempotente si la table profiles existe déjà
alter table public.profiles add column if not exists anilist_access_token text;
alter table public.profiles add column if not exists anilist_user_id integer;
alter table public.profiles add column if not exists anilist_username text;
alter table public.profiles add column if not exists anilist_avatar_url text;
alter table public.profiles add column if not exists anilist_site_url text;
alter table public.profiles add column if not exists anilist_token_expires_at timestamptz;
alter table public.profiles add column if not exists anilist_connected_at timestamptz;

-- Sécurité : ne jamais exposer anilist_access_token au rôle anon
revoke select (anilist_access_token) on public.profiles from anon;

alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 2. LIBRARY ENTRIES (Anime & Manga tracking + import AniList)
-- ----------------------------------------------------------------------------
create table if not exists public.library_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_id integer not null,
  media_type public.media_type not null default 'ANIME',
  title text not null,
  cover_image text not null,
  banner_image text,
  total_units integer,
  duration integer,
  genres text[] default '{}',
  studio text,
  format text,
  average_score integer,
  status public.library_status not null default 'PLAN_TO_WATCH',
  progress integer not null default 0 check (progress >= 0),
  score numeric(3,1) check (score is null or (score >= 0 and score <= 10)),
  is_favorite boolean not null default false,
  rewatch_count integer not null default 0,
  notes text default '',
  started_at date,
  completed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, media_id)
);

create index if not exists idx_library_user_status on public.library_entries(user_id, status);
create index if not exists idx_library_user_updated on public.library_entries(user_id, updated_at desc);

alter table public.library_entries enable row level security;

drop policy if exists "Users can view their own library entries" on public.library_entries;
create policy "Users can view their own library entries"
  on public.library_entries for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own library entries" on public.library_entries;
create policy "Users can insert their own library entries"
  on public.library_entries for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own library entries" on public.library_entries;
create policy "Users can update their own library entries"
  on public.library_entries for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own library entries" on public.library_entries;
create policy "Users can delete their own library entries"
  on public.library_entries for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. USER ANILIST STATS (User.statistics anime & manga importées par pseudo)
-- ----------------------------------------------------------------------------
create table if not exists public.user_anilist_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  anilist_username text not null,
  anilist_user_id integer,
  anilist_avatar_url text,
  anilist_banner_url text,
  anilist_site_url text,
  anime_count integer not null default 0,
  anime_episodes_watched integer not null default 0,
  anime_minutes_watched integer not null default 0,
  anime_mean_score numeric(5,2) not null default 0,
  manga_count integer not null default 0,
  manga_chapters_read integer not null default 0,
  manga_volumes_read integer not null default 0,
  manga_mean_score numeric(5,2) not null default 0,
  anime_stats jsonb not null default '{}'::jsonb,
  manga_stats jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_anilist_stats enable row level security;

drop policy if exists "Users can view their own anilist stats" on public.user_anilist_stats;
create policy "Users can view their own anilist stats"
  on public.user_anilist_stats for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own anilist stats" on public.user_anilist_stats;
create policy "Users can insert their own anilist stats"
  on public.user_anilist_stats for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own anilist stats" on public.user_anilist_stats;
create policy "Users can update their own anilist stats"
  on public.user_anilist_stats for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own anilist stats" on public.user_anilist_stats;
create policy "Users can delete their own anilist stats"
  on public.user_anilist_stats for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. NOTIFICATIONS
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.notification_kind not null default 'SYSTEM',
  title text not null,
  body text not null,
  media_id integer,
  cover_image text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own notifications" on public.notifications;
create policy "Users can insert their own notifications"
  on public.notifications for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
  on public.notifications for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. ACTIVITY LOG (historique de progression pour la page Stats)
-- ----------------------------------------------------------------------------
create table if not exists public.activity_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_id integer not null,
  media_title text not null,
  media_type public.media_type not null,
  cover_image text,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_user_created
  on public.activity_events(user_id, created_at desc);

alter table public.activity_events enable row level security;

drop policy if exists "Users can view their own activity" on public.activity_events;
create policy "Users can view their own activity"
  on public.activity_events for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own activity" on public.activity_events;
create policy "Users can insert their own activity"
  on public.activity_events for insert with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6. TRIGGERS (auto-creation du profil + updated_at)
-- ----------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_library_updated_at on public.library_entries;
create trigger set_library_updated_at
  before update on public.library_entries
  for each row execute function public.handle_updated_at();

drop trigger if exists set_anilist_stats_updated_at on public.user_anilist_stats;
create trigger set_anilist_stats_updated_at
  before update on public.user_anilist_stats
  for each row execute function public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
