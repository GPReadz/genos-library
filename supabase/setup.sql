-- Geno's Library: database setup.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- It is safe to run more than once.

-- Everything a person adds in the app: statuses, ratings, reviews, photos, edits,
-- and books, titles or albums that aren't in their sheet.
create table if not exists public.items (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  kind       text not null check (kind in ('book', 'watch', 'album')),
  item_id    text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);

-- Each person's shelves (genre, trope, hand-picked and so on).
create table if not exists public.shelves (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Each person's settings, such as their published sheet links.
create table if not exists public.settings (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Covers the app found automatically, so it only looks each one up once.
create table if not exists public.covers (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  kind       text not null,
  item_id    text not null,
  url        text,
  checked_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);

-- Only the signed-in person can read or change their own rows.
alter table public.items    enable row level security;
alter table public.shelves  enable row level security;
alter table public.settings enable row level security;
alter table public.covers   enable row level security;

drop policy if exists "own items"    on public.items;
drop policy if exists "own shelves"  on public.shelves;
drop policy if exists "own settings" on public.settings;
drop policy if exists "own covers"   on public.covers;

create policy "own items"    on public.items    for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own shelves"  on public.shelves  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings" on public.settings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own covers"   on public.covers   for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.items, public.shelves, public.settings, public.covers to authenticated;

-- Photos people upload (covers, posters, album art). Anyone with a photo's link can view it;
-- only its owner can add, replace or delete it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "upload own photos" on storage.objects;
drop policy if exists "change own photos" on storage.objects;
drop policy if exists "delete own photos" on storage.objects;

create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "change own photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- iPhone widget (same as widget.sql)
create table if not exists public.widget_snapshots (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  secret     text not null unique,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.widget_snapshots enable row level security;
drop policy if exists "own widget" on public.widget_snapshots;
create policy "own widget" on public.widget_snapshots for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.widget_snapshots to authenticated;

-- The widget calls this with its code and gets back only that summary.
create or replace function public.get_widget(p_secret text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select data from public.widget_snapshots
  where secret = p_secret and length(p_secret) >= 32
$$;

revoke all on function public.get_widget(text) from public;
grant execute on function public.get_widget(text) to anon, authenticated;
