-- FormaMentis 0.5 — Stanze reali e contenuti assegnabili a più Stanze.
-- Può essere eseguito anche dopo la configurazione 0.4.

create extension if not exists pgcrypto;

create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  media_type text not null check (media_type in ('music','audiobook','podcast','meditation')),
  room text,
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  note text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.media_rooms (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.media_items(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (media_id, room_id)
);

create index if not exists media_items_user_created_idx on public.media_items (user_id, created_at desc);
create index if not exists rooms_user_position_idx on public.rooms (user_id, position);
create index if not exists media_rooms_room_idx on public.media_rooms (room_id);

alter table public.media_items enable row level security;
alter table public.rooms enable row level security;
alter table public.media_rooms enable row level security;

drop policy if exists "Users can read own media" on public.media_items;
drop policy if exists "Users can insert own media" on public.media_items;
drop policy if exists "Users can update own media" on public.media_items;
drop policy if exists "Users can delete own media" on public.media_items;
create policy "Users can read own media" on public.media_items for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own media" on public.media_items for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own media" on public.media_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own media" on public.media_items for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read own rooms" on public.rooms;
drop policy if exists "Users can insert own rooms" on public.rooms;
drop policy if exists "Users can update own rooms" on public.rooms;
drop policy if exists "Users can delete own rooms" on public.rooms;
create policy "Users can read own rooms" on public.rooms for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own rooms" on public.rooms for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own rooms" on public.rooms for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own rooms" on public.rooms for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read own room links" on public.media_rooms;
drop policy if exists "Users can insert own room links" on public.media_rooms;
drop policy if exists "Users can delete own room links" on public.media_rooms;
create policy "Users can read own room links" on public.media_rooms for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own room links" on public.media_rooms for insert to authenticated with check (
  auth.uid() = user_id
  and exists (select 1 from public.media_items m where m.id = media_id and m.user_id = auth.uid())
  and exists (select 1 from public.rooms r where r.id = room_id and r.user_id = auth.uid())
);
create policy "Users can delete own room links" on public.media_rooms for delete to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('audio-files', 'audio-files', false, 104857600)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "Users can upload own audio" on storage.objects;
drop policy if exists "Users can read own audio" on storage.objects;
drop policy if exists "Users can delete own audio" on storage.objects;
create policy "Users can upload own audio" on storage.objects for insert to authenticated with check (bucket_id = 'audio-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can read own audio" on storage.objects for select to authenticated using (bucket_id = 'audio-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete own audio" on storage.objects for delete to authenticated using (bucket_id = 'audio-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- Migra le vecchie assegnazioni salvate nella colonna media_items.room.
insert into public.rooms (user_id, name, note, position)
select distinct m.user_id, m.room, 'Stanza importata dalla versione precedente.', 100
from public.media_items m
where m.room is not null and btrim(m.room) <> ''
on conflict (user_id, name) do nothing;

insert into public.media_rooms (user_id, media_id, room_id)
select m.user_id, m.id, r.id
from public.media_items m
join public.rooms r on r.user_id = m.user_id and r.name = m.room
where m.room is not null and btrim(m.room) <> ''
on conflict do nothing;
