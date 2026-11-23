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
  accent_color text default '#E5484D',
  is_activity_public boolean not null default true,
  favorite_staff jsonb not null default '[]'::jsonb,
  favorite_media jsonb not null default '[]'::jsonb,
  stats_summary jsonb not null default '{}'::jsonb,
  unlocked_badges jsonb not null default '[]'::jsonb,
  pinned_badges text[] not null default '{}',
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
alter table public.profiles add column if not exists accent_color text default '#E5484D';
alter table public.profiles add column if not exists is_activity_public boolean not null default true;
alter table public.profiles add column if not exists favorite_staff jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists favorite_media jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists stats_summary jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists preferred_language text default 'fr';
alter table public.profiles add column if not exists unlocked_badges jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists pinned_badges text[] not null default '{}';
alter table public.profiles add column if not exists ui_preferences jsonb not null default '{}'::jsonb;

-- Sécurité : ne jamais exposer anilist_access_token au rôle anon
revoke select (anilist_access_token) on public.profiles from anon;

alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);

-- Vue publique sécurisée des profils (sans jamais exposer anilist_access_token ni email)
-- security_invoker = false garantit que les visiteurs et membres connectés peuvent découvrir
-- les profils publics (sans jamais lire anilist_access_token ni email).
drop view if exists public.public_profiles;
create view public.public_profiles
  with (security_invoker = false)
as
select
  id,
  username,
  display_name,
  avatar_url,
  banner_url,
  bio,
  coalesce(accent_color, '#E5484D') as accent_color,
  coalesce(is_activity_public, true) as is_activity_public,
  coalesce(favorite_staff, '[]'::jsonb) as favorite_staff,
  case
    when coalesce(is_activity_public, true) or auth.uid() = id
      then coalesce(favorite_media, '[]'::jsonb)
    else '[]'::jsonb
  end as favorite_media,
  case
    when coalesce(is_activity_public, true) or auth.uid() = id
      then coalesce(stats_summary, '{}'::jsonb)
    else (coalesce(stats_summary, '{}'::jsonb) - 'libraryPreview' - 'sharedCollections')
  end as stats_summary,
  created_at as joined_at,
  coalesce(unlocked_badges, '[]'::jsonb) as unlocked_badges,
  coalesce(pinned_badges, '{}'::text[]) as pinned_badges
from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- Bucket Supabase Storage pour les avatars personnalisés
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
  on public.profiles for delete
  using (auth.uid() = id);

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
  season text,
  season_year integer,
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
  on public.library_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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
-- 5. ACTIVITY LOG (historique personnel + fil communautaire temps réel)
-- ----------------------------------------------------------------------------
create table if not exists public.activity_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_id integer not null default 0,
  media_title text not null,
  media_type public.media_type not null default 'ANIME',
  cover_image text,
  action text not null,
  event_kind text not null default 'UPDATE',
  is_public boolean not null default true,
  actor_username text,
  actor_display_name text,
  actor_avatar_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.activity_events add column if not exists event_kind text not null default 'UPDATE';
alter table public.activity_events add column if not exists is_public boolean not null default true;
alter table public.activity_events add column if not exists actor_username text;
alter table public.activity_events add column if not exists actor_display_name text;
alter table public.activity_events add column if not exists actor_avatar_url text;
alter table public.activity_events add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_activity_user_created
  on public.activity_events(user_id, created_at desc);
create index if not exists idx_activity_public_created
  on public.activity_events(is_public, created_at desc);

alter table public.activity_events enable row level security;

drop policy if exists "Users can view their own activity" on public.activity_events;
drop policy if exists "Public or own activity is viewable" on public.activity_events;
create policy "Public or own activity is viewable"
  on public.activity_events for select using (is_public = true or auth.uid() = user_id);

drop policy if exists "Users can insert their own activity" on public.activity_events;
create policy "Users can insert their own activity"
  on public.activity_events for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own activity" on public.activity_events;
create policy "Users can delete their own activity"
  on public.activity_events for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5B. SOCIAL INTERACTIONS : LIKES & COMMENTAIRES SUR L'ACTIVITÉ
-- ----------------------------------------------------------------------------
create table if not exists public.activity_likes (
  id uuid primary key default uuid_generate_v4(),
  activity_id uuid not null references public.activity_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(activity_id, user_id)
);

create index if not exists idx_activity_likes_activity on public.activity_likes(activity_id);

alter table public.activity_likes enable row level security;

drop policy if exists "Anyone can view activity likes" on public.activity_likes;
create policy "Anyone can view activity likes"
  on public.activity_likes for select using (
    exists (
      select 1 from public.activity_events ae
      where ae.id = activity_id
        and (ae.is_public = true or ae.user_id = auth.uid())
    )
  );

drop policy if exists "Authenticated users can like activity" on public.activity_likes;
create policy "Authenticated users can like activity"
  on public.activity_likes for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.activity_events ae
      where ae.id = activity_id
        and (ae.is_public = true or ae.user_id = auth.uid())
    )
  );

drop policy if exists "Users can remove their own likes" on public.activity_likes;
create policy "Users can remove their own likes"
  on public.activity_likes for delete using (auth.uid() = user_id);

create table if not exists public.activity_comments (
  id uuid primary key default uuid_generate_v4(),
  activity_id uuid not null references public.activity_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  author_username text not null,
  author_display_name text not null,
  author_avatar_url text,
  body text not null check (char_length(trim(body)) between 1 and 600),
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_comments_activity
  on public.activity_comments(activity_id, created_at asc);

alter table public.activity_comments enable row level security;

drop policy if exists "Anyone can view activity comments" on public.activity_comments;
create policy "Anyone can view activity comments"
  on public.activity_comments for select using (
    exists (
      select 1 from public.activity_events ae
      where ae.id = activity_id
        and (ae.is_public = true or ae.user_id = auth.uid())
    )
  );

drop policy if exists "Authenticated users can comment on activity" on public.activity_comments;
create policy "Authenticated users can comment on activity"
  on public.activity_comments for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.activity_events ae
      where ae.id = activity_id
        and (ae.is_public = true or ae.user_id = auth.uid())
    )
  );

drop policy if exists "Users can delete their own comments" on public.activity_comments;
create policy "Users can delete their own comments"
  on public.activity_comments for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5C. MESSAGERIE PRIVÉE (DIRECT MESSAGES) ENTRE UTILISATEURS
-- ----------------------------------------------------------------------------
create table if not exists public.direct_messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  sender_username text not null,
  sender_display_name text not null,
  sender_avatar_url text,
  recipient_username text not null,
  recipient_display_name text not null,
  recipient_avatar_url text,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_dm_participants_created
  on public.direct_messages(sender_id, recipient_id, created_at desc);
create index if not exists idx_dm_recipient_unread
  on public.direct_messages(recipient_id, is_read, created_at desc);

alter table public.direct_messages enable row level security;

drop policy if exists "Participants can read their own direct messages" on public.direct_messages;
create policy "Participants can read their own direct messages"
  on public.direct_messages for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Users can send direct messages" on public.direct_messages;
create policy "Users can send direct messages"
  on public.direct_messages for insert with check (auth.uid() = sender_id);

drop policy if exists "Recipients can mark messages read" on public.direct_messages;
create policy "Recipients can mark messages read"
  on public.direct_messages for update using (auth.uid() = recipient_id);

-- Activer Supabase Realtime sur le fil d'activité, likes, commentaires et DM
do $$ begin
  alter publication supabase_realtime add table public.activity_events;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.activity_likes;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.activity_comments;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 5D. GAMIFICATION : BADGES & RÉCOMPENSES (user_badges)
-- ----------------------------------------------------------------------------
create table if not exists public.user_badges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null,
  unlocked_at timestamptz not null default now(),
  is_pinned boolean not null default false,
  unique(user_id, badge_id)
);

create index if not exists idx_user_badges_user on public.user_badges(user_id, unlocked_at desc);

alter table public.user_badges enable row level security;

drop policy if exists "Anyone can view unlocked badges on public profiles" on public.user_badges;
create policy "Anyone can view unlocked badges on public profiles"
  on public.user_badges for select using (true);

drop policy if exists "Users can insert their own badges" on public.user_badges;
create policy "Users can insert their own badges"
  on public.user_badges for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own badges" on public.user_badges;
create policy "Users can update their own badges"
  on public.user_badges for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own badges" on public.user_badges;
create policy "Users can delete their own badges"
  on public.user_badges for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5E. SYSTÈME D'AMIS (friendships — demandes & amis acceptés)
-- ----------------------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists idx_friendships_requester on public.friendships(requester_id, status);
create index if not exists idx_friendships_addressee on public.friendships(addressee_id, status);

alter table public.friendships enable row level security;

drop policy if exists "Users can view their own friendships" on public.friendships;
create policy "Users can view their own friendships"
  on public.friendships for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users can send friend requests" on public.friendships;
create policy "Users can send friend requests"
  on public.friendships for insert with check (auth.uid() = requester_id);

drop policy if exists "Addressees can accept friend requests" on public.friendships;
create policy "Addressees can accept friend requests"
  on public.friendships for update using (auth.uid() = addressee_id);

drop policy if exists "Participants can remove friendships" on public.friendships;
create policy "Participants can remove friendships"
  on public.friendships for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

do $$ begin
  alter publication supabase_realtime add table public.friendships;
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 5F. TRADUCTIONS DE SYNOPSIS EN CACHE (media_translations)
-- Cache partagé pour la traduction automatique à la volée des animés & mangas.
-- ----------------------------------------------------------------------------
create table if not exists public.media_translations (
  media_id integer not null,
  lang text not null check (lang in ('fr', 'es', 'it')),
  translated_description text not null check (char_length(translated_description) between 1 and 20000),
  updated_at timestamptz not null default now(),
  primary key (media_id, lang)
);

create index if not exists idx_media_translations_lang on public.media_translations(lang, updated_at desc);

alter table public.media_translations enable row level security;

drop policy if exists "Anyone can read cached media translations" on public.media_translations;
create policy "Anyone can read cached media translations"
  on public.media_translations for select using (true);

drop policy if exists "Anyone can cache media translations" on public.media_translations;
create policy "Anyone can cache media translations"
  on public.media_translations for insert
  with check (lang in ('fr', 'es', 'it') and char_length(translated_description) between 1 and 20000);

drop policy if exists "Anyone can refresh cached media translations" on public.media_translations;
drop policy if exists "Authenticated users can refresh cached media translations" on public.media_translations;
create policy "Authenticated users can refresh cached media translations"
  on public.media_translations for update to authenticated
  using (lang in ('fr', 'es', 'it'))
  with check (lang in ('fr', 'es', 'it') and char_length(translated_description) between 1 and 20000);

grant usage on schema public to anon, authenticated;
grant select on public.public_profiles, public.activity_events, public.activity_likes, public.activity_comments, public.user_badges to anon, authenticated;
grant select, insert on public.media_translations to anon, authenticated;
grant update on public.media_translations to authenticated;
grant select, insert, update, delete on public.profiles, public.library_entries, public.user_anilist_stats, public.notifications, public.activity_events, public.activity_likes, public.activity_comments, public.direct_messages, public.user_badges, public.friendships to authenticated;
revoke all on public.direct_messages, public.friendships from anon;

-- ----------------------------------------------------------------------------
-- 6. TRIGGERS (auto-creation du profil + updated_at)
-- ----------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

drop trigger if exists set_friendships_updated_at on public.friendships;
create trigger set_friendships_updated_at
  before update on public.friendships
  for each row execute function public.handle_updated_at();

drop trigger if exists set_media_translations_updated_at on public.media_translations;
create trigger set_media_translations_updated_at
  before update on public.media_translations
  for each row execute function public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_display text;
  v_base_user text;
begin
  v_display := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Membre Shiori'
  );

  v_base_user := lower(
    regexp_replace(
      coalesce(
        nullif(trim(new.raw_user_meta_data->>'username'), ''),
        v_display
      ),
      '[^a-zA-Z0-9_]+',
      '_',
      'g'
    )
  );
  v_base_user := trim(both '_' from v_base_user);
  if v_base_user = '' then
    v_base_user := 'user_' || left(new.id::text, 6);
  end if;

  begin
    insert into public.profiles (id, username, display_name, avatar_url)
    values (
      new.id,
      v_base_user,
      v_display,
      new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, username, display_name, avatar_url)
    values (
      new.id,
      left(v_base_user, 22) || '_' || left(new.id::text, 5),
      v_display,
      new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (id) do nothing;
  end;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rattrapage idempotent : crée une ligne public.profiles pour tous les comptes
-- auth.users déjà inscrits qui n'avaient pas encore de profil public.
do $$
declare
  u record;
  v_display text;
  v_base_user text;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    left join public.profiles p on p.id = au.id
    where p.id is null
  loop
    v_display := coalesce(
      nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Membre Shiori'
    );
    v_base_user := lower(
      regexp_replace(
        coalesce(
          nullif(trim(u.raw_user_meta_data->>'username'), ''),
          v_display
        ),
        '[^a-zA-Z0-9_]+',
        '_',
        'g'
      )
    );
    v_base_user := trim(both '_' from v_base_user);
    if v_base_user = '' then
      v_base_user := 'user_' || left(u.id::text, 6);
    end if;

    begin
      insert into public.profiles (id, username, display_name, avatar_url)
      values (
        u.id,
        v_base_user,
        v_display,
        u.raw_user_meta_data->>'avatar_url'
      )
      on conflict (id) do nothing;
    exception when unique_violation then
      insert into public.profiles (id, username, display_name, avatar_url)
      values (
        u.id,
        left(v_base_user, 22) || '_' || left(u.id::text, 5),
        v_display,
        u.raw_user_meta_data->>'avatar_url'
      )
      on conflict (id) do nothing;
    end;
  end loop;
end $$;
