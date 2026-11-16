-- Geno's Library: iPhone widget setup.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- It is safe to run more than once.

-- A small summary of each person's library (what they're reading and watching, plus a few
-- TBR picks) that the home-screen widget can read with a private widget code.
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
