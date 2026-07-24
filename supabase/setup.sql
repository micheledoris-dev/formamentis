create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  author text,
  media_type text not null check (media_type in ('music','audiobook','podcast','meditation')),
  room text,
  storage_path text,
  public_url text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

alter table public.media_items enable row level security;

create policy "Users can read own media"
on public.media_items for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own media"
on public.media_items for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own media"
on public.media_items for update
to authenticated
using (auth.uid() = user_id);

create policy "Users can delete own media"
on public.media_items for delete
to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('audio-files', 'audio-files', false)
on conflict (id) do nothing;

create policy "Users can upload own audio"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'audio-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read own audio"
on storage.objects for select
to authenticated
using (
  bucket_id = 'audio-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own audio"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'audio-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
