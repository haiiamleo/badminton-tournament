-- Split Pairs format
-- Run this in the Supabase SQL editor before creating a Split Pairs tournament.

alter table tournaments
add column if not exists format text not null default 'individual';

create table if not exists fixed_pairs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  pool_name text not null check (pool_name in ('top', 'bottom')),
  seed integer not null check (seed between 1 and 5),
  name text not null,
  created_at timestamptz not null default now(),
  unique (tournament_id, pool_name, seed)
);

create table if not exists fixed_pair_players (
  pair_id uuid not null references fixed_pairs(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  slot integer not null check (slot in (1, 2)),
  primary key (pair_id, player_id),
  unique (pair_id, slot)
);

create table if not exists fixed_pair_standings (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  pair_id uuid not null references fixed_pairs(id) on delete cascade,
  matches_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  standing_points integer not null default 0,
  points_for integer not null default 0,
  points_against integer not null default 0,
  primary key (tournament_id, pair_id)
);

alter table matches
add column if not exists fixed_pair1_id uuid references fixed_pairs(id);

alter table matches
add column if not exists fixed_pair2_id uuid references fixed_pairs(id);

alter table fixed_pairs enable row level security;
alter table fixed_pair_players enable row level security;
alter table fixed_pair_standings enable row level security;

drop policy if exists fixed_pairs_public_all on fixed_pairs;
create policy fixed_pairs_public_all
on fixed_pairs for all to anon, authenticated
using (true) with check (true);

drop policy if exists fixed_pair_players_public_all on fixed_pair_players;
create policy fixed_pair_players_public_all
on fixed_pair_players for all to anon, authenticated
using (true) with check (true);

drop policy if exists fixed_pair_standings_public_all on fixed_pair_standings;
create policy fixed_pair_standings_public_all
on fixed_pair_standings for all to anon, authenticated
using (true) with check (true);

grant select, insert, update, delete
on fixed_pairs, fixed_pair_players, fixed_pair_standings
to anon, authenticated;
