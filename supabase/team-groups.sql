-- Team Groups format
-- Run this in the Supabase SQL editor before creating a team tournament.

alter table tournaments
add column if not exists format text not null default 'individual';

alter table tournaments
add column if not exists team_size integer;

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  group_name text not null,
  seed integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists team_players (
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  slot integer not null default 1,
  primary key (team_id, player_id)
);

create table if not exists team_standings (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  matches_played integer not null default 0,
  match_wins integer not null default 0,
  match_losses integer not null default 0,
  fixture_wins integer not null default 0,
  fixture_losses integer not null default 0,
  primary key (tournament_id, team_id)
);

create table if not exists fixtures (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round_id uuid not null references rounds(id) on delete cascade,
  group_name text,
  team1_id uuid not null references teams(id),
  team2_id uuid not null references teams(id),
  stage text not null,
  status text not null default 'scheduled',
  team1_match_wins integer not null default 0,
  team2_match_wins integer not null default 0,
  winner_team_id uuid references teams(id),
  created_at timestamptz not null default now()
);

alter table matches
add column if not exists fixture_id uuid references fixtures(id) on delete cascade;

alter table matches
add column if not exists fixture_slot integer;

alter table teams enable row level security;
alter table team_players enable row level security;
alter table team_standings enable row level security;
alter table fixtures enable row level security;

drop policy if exists teams_authenticated_all on teams;
create policy teams_authenticated_all
on teams for all to authenticated
using (true) with check (true);

drop policy if exists team_players_authenticated_all on team_players;
create policy team_players_authenticated_all
on team_players for all to authenticated
using (true) with check (true);

drop policy if exists team_standings_authenticated_all on team_standings;
create policy team_standings_authenticated_all
on team_standings for all to authenticated
using (true) with check (true);

drop policy if exists fixtures_authenticated_all on fixtures;
create policy fixtures_authenticated_all
on fixtures for all to authenticated
using (true) with check (true);
