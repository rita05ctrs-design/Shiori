-- ============================================================================
-- SHIORI — Migration v3 (Non destructive) : Suivi des Tomes / Volumes Manga
-- Exécutez ce script dans le SQL Editor de Supabase pour synchroniser les
-- tomes lus (`progress_volumes`) et totaux (`total_volumes`) sur vos mangas.
-- ============================================================================

alter table public.library_entries
  add column if not exists total_volumes integer check (total_volumes is null or total_volumes >= 0);

alter table public.library_entries
  add column if not exists progress_volumes integer not null default 0 check (progress_volumes >= 0);
