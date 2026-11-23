-- ============================================================================
-- SHIORI (栞) — Versioned Migration 20261123 (Non-Destructive & Idempotent)
-- Ajoute :
--   1. Préférences UI synchronisées (`profiles.ui_preferences`)
--   2. Métadonnées saison/année sur `library_entries` (`season`, `season_year`)
--   3. Collections personnalisées (`public.user_collections`) avec RLS
--   4. Confidentialité & modération (`public.user_blocks`, `public.content_reports`) avec RLS
--   5. Durcissement RLS sur `profiles` (DELETE), `public_profiles` (masquage privé),
--      `activity_likes`, `activity_comments`, `direct_messages`, `friendships`,
--      `media_translations`, `is_pair_blocked()` et `search_path` des fonctions
-- ============================================================================

create extension if not exists "uuid-ossp";

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

-- 1. Préférences UI & synchronisation multi-appareils sur `profiles`
alter table public.profiles
  add column if not exists ui_preferences jsonb not null default '{}'::jsonb;

-- 2. Saison & année sur `library_entries` pour les filtres combinés cloud
alter table public.library_entries
  add column if not exists season text;
alter table public.library_entries
  add column if not exists season_year integer;

-- 3. Collections personnalisées (`public.user_collections`)
create table if not exists public.user_collections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300),
  color text not null default '#E5484D',
  media_ids integer[] not null default '{}',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_collections_user
  on public.user_collections(user_id, updated_at desc);

alter table public.user_collections enable row level security;

drop policy if exists "Users can view own or public collections" on public.user_collections;
create policy "Users can view own or public collections"
  on public.user_collections for select
  using (is_public = true or auth.uid() = user_id);

drop policy if exists "Users can insert their own collections" on public.user_collections;
create policy "Users can insert their own collections"
  on public.user_collections for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own collections" on public.user_collections;
create policy "Users can update their own collections"
  on public.user_collections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own collections" on public.user_collections;
create policy "Users can delete their own collections"
  on public.user_collections for delete
  using (auth.uid() = user_id);

drop trigger if exists set_user_collections_updated_at on public.user_collections;
create trigger set_user_collections_updated_at
  before update on public.user_collections
  for each row execute function public.handle_updated_at();

-- 4. Blocage d'utilisateurs (`public.user_blocks`)
create table if not exists public.user_blocks (
  id uuid primary key default uuid_generate_v4(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists idx_user_blocks_blocker on public.user_blocks(blocker_id);
create index if not exists idx_user_blocks_blocked on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Users can view their own blocks" on public.user_blocks;
create policy "Users can view their own blocks"
  on public.user_blocks for select
  using (auth.uid() = blocker_id);

drop policy if exists "Users can block other users" on public.user_blocks;
create policy "Users can block other users"
  on public.user_blocks for insert
  with check (auth.uid() = blocker_id and blocker_id <> blocked_id);

drop policy if exists "Users can unblock users" on public.user_blocks;
create policy "Users can unblock users"
  on public.user_blocks for delete
  using (auth.uid() = blocker_id);

-- 5. Signalements de contenu / profil (`public.content_reports`)
create table if not exists public.content_reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'activity', 'comment', 'message')),
  target_id text not null check (char_length(trim(target_id)) between 1 and 120),
  target_user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'spoiler', 'other')),
  details text not null default '' check (char_length(details) <= 600),
  status text not null default 'OPEN' check (status in ('OPEN', 'REVIEWED', 'DISMISSED')),
  created_at timestamptz not null default now()
);

create index if not exists idx_content_reports_reporter
  on public.content_reports(reporter_id, created_at desc);

alter table public.content_reports enable row level security;

drop policy if exists "Users can view their own reports" on public.content_reports;
create policy "Users can view their own reports"
  on public.content_reports for select
  using (auth.uid() = reporter_id);

drop policy if exists "Users can submit reports" on public.content_reports;
create policy "Users can submit reports"
  on public.content_reports for insert
  with check (auth.uid() = reporter_id);

-- 6. Durcissement RLS sur `activity_likes` & `activity_comments`
-- Empêche de lire/interagir sur des activités privées d'autres utilisateurs
drop policy if exists "Anyone can view activity likes" on public.activity_likes;
create policy "Anyone can view activity likes"
  on public.activity_likes for select
  using (
    exists (
      select 1 from public.activity_events ae
      where ae.id = activity_id
        and (ae.is_public = true or ae.user_id = auth.uid())
    )
  );

drop policy if exists "Authenticated users can like activity" on public.activity_likes;
create policy "Authenticated users can like activity"
  on public.activity_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.activity_events ae
      where ae.id = activity_id
        and (ae.is_public = true or ae.user_id = auth.uid())
    )
  );

drop policy if exists "Anyone can view activity comments" on public.activity_comments;
create policy "Anyone can view activity comments"
  on public.activity_comments for select
  using (
    exists (
      select 1 from public.activity_events ae
      where ae.id = activity_id
        and (ae.is_public = true or ae.user_id = auth.uid())
    )
  );

drop policy if exists "Authenticated users can comment on activity" on public.activity_comments;
create policy "Authenticated users can comment on activity"
  on public.activity_comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.activity_events ae
      where ae.id = activity_id
        and (ae.is_public = true or ae.user_id = auth.uid())
    )
  );

-- 7. Fonction helper SECURITY DEFINER pour vérifier un blocage bidirectionnel
--    sans jamais exposer la table `user_blocks` aux autres utilisateurs en SELECT.
--    SÉCURITÉ : restreint l'interrogation aux seuls participants (auth.uid() = user_a ou user_b)
--    afin qu'un tiers C ne puisse jamais sonder via RPC si A a bloqué B.
create or replace function public.is_pair_blocked(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (auth.uid() = user_a or auth.uid() = user_b)
    and exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = user_a and b.blocked_id = user_b)
         or (b.blocker_id = user_b and b.blocked_id = user_a)
    );
$$;

revoke execute on function public.is_pair_blocked(uuid, uuid) from public, anon;
grant execute on function public.is_pair_blocked(uuid, uuid) to authenticated;

-- 7b. Vue `public_profiles` durcie : masque automatiquement `favorite_media`,
--     `libraryPreview` et `sharedCollections` quand `is_activity_public = false`
--     pour tout visiteur autre que le propriétaire du profil.
create or replace view public.public_profiles
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

-- 8. Durcissement RLS & intégrité sur `direct_messages`, `friendships`, `profiles`, `library_entries` & `media_translations`
drop policy if exists "Users can send direct messages" on public.direct_messages;
create policy "Users can send direct messages"
  on public.direct_messages for insert
  with check (
    auth.uid() = sender_id
    and sender_id <> recipient_id
    and not public.is_pair_blocked(sender_id, recipient_id)
  );

drop policy if exists "Users can send friend requests" on public.friendships;
create policy "Users can send friend requests"
  on public.friendships for insert
  with check (
    auth.uid() = requester_id
    and requester_id <> addressee_id
    and not public.is_pair_blocked(requester_id, addressee_id)
  );

drop policy if exists "Addressees can accept friend requests" on public.friendships;
create policy "Addressees can accept friend requests"
  on public.friendships for update
  using (auth.uid() = addressee_id)
  with check (
    auth.uid() = addressee_id
    and not public.is_pair_blocked(requester_id, addressee_id)
  );

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
  on public.profiles for delete
  using (auth.uid() = id);

drop policy if exists "Users can update their own library entries" on public.library_entries;
create policy "Users can update their own library entries"
  on public.library_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Empêche un visiteur anonyme d'écraser une traduction déjà mise en cache (INSERT autorisé pour peupler le cache, UPDATE réservé aux comptes connectés)
drop policy if exists "Anyone can refresh cached media translations" on public.media_translations;
create policy "Authenticated users can refresh cached media translations"
  on public.media_translations for update to authenticated
  using (lang in ('fr', 'es', 'it'))
  with check (lang in ('fr', 'es', 'it') and char_length(translated_description) between 1 and 20000);

drop policy if exists "Recipients can mark messages read" on public.direct_messages;
create policy "Recipients can mark messages read"
  on public.direct_messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create or replace function public.guard_direct_message_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sender_id <> old.sender_id
     or new.recipient_id <> old.recipient_id
     or new.body <> old.body
     or new.created_at <> old.created_at then
    raise exception 'Direct message content and participants are immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_direct_message_update() from public, anon;

-- Durcir le search_path de la fonction trigger SECURITY DEFINER `handle_new_user` si elle existe
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'
  ) then
    execute 'alter function public.handle_new_user() set search_path = public';
  end if;
end $$;

drop trigger if exists guard_direct_message_update_trg on public.direct_messages;
create trigger guard_direct_message_update_trg
  before update on public.direct_messages
  for each row execute function public.guard_direct_message_update();

-- 9. Privilèges PostgreSQL explicites (moindre privilège) pour éviter tout 42501 avant RLS
grant usage on schema public to anon, authenticated;

-- Lecture publique sécurisée pour les visiteurs non connectés (filtrée par RLS)
grant select on public.public_profiles to anon, authenticated;
grant select on public.activity_events to anon, authenticated;
grant select on public.activity_likes to anon, authenticated;
grant select on public.activity_comments to anon, authenticated;
grant select on public.user_badges to anon, authenticated;
grant select on public.user_collections to anon, authenticated;
grant select, insert on public.media_translations to anon, authenticated;
grant update on public.media_translations to authenticated;

-- Accès complet encadré par RLS pour les utilisateurs authentifiés
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.library_entries to authenticated;
grant select, insert, update, delete on public.user_anilist_stats to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant insert, update, delete on public.activity_events to authenticated;
grant insert, delete on public.activity_likes to authenticated;
grant insert, delete on public.activity_comments to authenticated;
grant select, insert, update on public.direct_messages to authenticated;
grant insert, update, delete on public.user_badges to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant insert, update, delete on public.user_collections to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant select, insert on public.content_reports to authenticated;

-- Garantir qu'aucun secret/token n'est jamais lisible par anon
revoke all on public.direct_messages from anon;
revoke all on public.friendships from anon;
revoke all on public.user_blocks from anon;
revoke all on public.content_reports from anon;
revoke select (anilist_access_token) on public.profiles from anon;
