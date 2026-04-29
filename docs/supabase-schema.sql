create table if not exists public.music_queue (
  queue_id text primary key,
  added_at timestamptz not null default now(),
  spotify_id text not null,
  uri text not null,
  name text not null,
  artists text default '',
  album text default '',
  image text default '',
  duration_ms integer default 0,
  external_url text default '',
  position bigint not null default (extract(epoch from now()) * 1000)::bigint,
  status text not null default 'pending'
);

alter table public.music_queue
add column if not exists status text not null default 'pending';

alter table public.music_queue enable row level security;

drop policy if exists "public can read music queue" on public.music_queue;
create policy "public can read music queue"
on public.music_queue
for select
to anon
using (true);

drop policy if exists "public can add music requests" on public.music_queue;
create policy "public can add music requests"
on public.music_queue
for insert
to anon
with check (
  uri like 'spotify:track:%'
  and length(name) between 1 and 300
  and status = 'pending'
);

create index if not exists music_queue_position_idx
on public.music_queue (position asc, added_at asc);

create index if not exists music_queue_status_position_idx
on public.music_queue (status asc, position asc, added_at asc);
