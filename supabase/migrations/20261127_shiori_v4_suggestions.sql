-- ============================================================================
-- SHIORI (栞) — Migration v4 (Non destructive & Idempotente)
-- Table dédiée `public.user_suggestions` avec RLS + Supabase Realtime :
--   - Tous les utilisateurs (connectés ou invités) peuvent envoyer une suggestion.
--   - Seul le Créateur (`is_shiori_creator()`) peut lire, mettre à jour ou supprimer.
--   - Activée dans `supabase_realtime` pour une réception instantanée.
-- ============================================================================

create table if not exists public.user_suggestions (
  id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  username text,
  display_name text not null default 'Invité',
  avatar_url text,
  accent_color text,
  category text not null default 'feature'
    check (category in ('feature', 'improvement', 'bug', 'other')),
  title text not null default '',
  message text not null check (char_length(trim(message)) between 8 and 1200),
  device text not null default 'desktop' check (device in ('mobile', 'desktop')),
  page_path text,
  status text not null default 'new'
    check (status in ('new', 'planned', 'done', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_suggestions_created
  on public.user_suggestions(created_at desc);
create index if not exists idx_user_suggestions_status
  on public.user_suggestions(status, created_at desc);

alter table public.user_suggestions enable row level security;

drop policy if exists "Anyone can submit a suggestion" on public.user_suggestions;
create policy "Anyone can submit a suggestion"
  on public.user_suggestions for insert to anon, authenticated
  with check (char_length(trim(message)) between 8 and 1200);

drop policy if exists "Only creator can read suggestions" on public.user_suggestions;
create policy "Only creator can read suggestions"
  on public.user_suggestions for select to authenticated
  using (public.is_shiori_creator());

drop policy if exists "Only creator can update suggestions" on public.user_suggestions;
create policy "Only creator can update suggestions"
  on public.user_suggestions for update to authenticated
  using (public.is_shiori_creator())
  with check (public.is_shiori_creator());

drop policy if exists "Only creator can delete suggestions" on public.user_suggestions;
create policy "Only creator can delete suggestions"
  on public.user_suggestions for delete to authenticated
  using (public.is_shiori_creator());

grant insert on public.user_suggestions to anon, authenticated;
grant select, update, delete on public.user_suggestions to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.user_suggestions;
exception when duplicate_object then null;
end $$;
