create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null check (room_code ~ '^[A-Z2-9]{6}$'),
  status text not null default 'playing' check (status in ('playing', 'finished', 'abandoned')),
  rules jsonb not null default '{}'::jsonb,
  player_count smallint not null check (player_count between 2 and 6),
  winner_name text,
  action_count integer not null default 0 check (action_count >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  seat smallint not null check (seat between 0 and 5),
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 24),
  is_bot boolean not null default false,
  final_rank smallint check (final_rank between 1 and 6),
  cards_remaining smallint not null default 0 check (cards_remaining >= 0),
  primary key (match_id, seat)
);

create table if not exists public.active_rooms (
  room_code text primary key check (room_code ~ '^[A-Z2-9]{6}$'),
  status text not null check (status in ('lobby', 'playing', 'finished')),
  player_count smallint not null check (player_count between 0 and 6),
  rules jsonb not null default '{}'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  match_id uuid references public.matches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);

create index if not exists matches_finished_at_idx on public.matches (finished_at desc);
create index if not exists matches_room_code_idx on public.matches (room_code, started_at desc);
create index if not exists match_players_user_id_idx on public.match_players (user_id);
create index if not exists active_rooms_expires_at_idx on public.active_rooms (expires_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists matches_set_updated_at on public.matches;
create trigger matches_set_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

drop trigger if exists active_rooms_set_updated_at on public.active_rooms;
create trigger active_rooms_set_updated_at
before update on public.active_rooms
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Player'), 24)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.active_rooms enable row level security;

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
on public.profiles for select
using (true);

drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile"
on public.profiles for update
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

revoke all on public.matches from anon, authenticated;
revoke all on public.match_players from anon, authenticated;
revoke all on public.active_rooms from anon, authenticated;

create or replace view public.leaderboard
with (security_invoker = true)
as
select
  mp.user_id,
  max(mp.display_name) as display_name,
  count(*)::integer as matches_played,
  count(*) filter (where mp.final_rank = 1)::integer as wins,
  round(
    100.0 * count(*) filter (where mp.final_rank = 1) / nullif(count(*), 0),
    1
  ) as win_rate
from public.match_players mp
where mp.user_id is not null
group by mp.user_id;

revoke all on public.leaderboard from anon, authenticated;

comment on table public.active_rooms is
  'Server-authored operational snapshots. Live turn authority remains in the Socket.IO process.';
comment on table public.matches is
  'Durable match history written only by the trusted game server.';
