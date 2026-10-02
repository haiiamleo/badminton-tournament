-- Number draws for individual tournament phases.
-- Run this once in the Supabase SQL editor before using number assignments.

create table if not exists player_draw_numbers (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  phase text not null check (phase in ('preliminary', 'knockout')),
  draw_number integer not null check (draw_number > 0),
  created_at timestamptz not null default now(),
  primary key (tournament_id, phase, player_id),
  unique (tournament_id, phase, draw_number)
);

grant select, insert, update, delete on player_draw_numbers
to anon, authenticated;

alter table player_draw_numbers enable row level security;

drop policy if exists player_draw_numbers_public_all
on player_draw_numbers;

create policy player_draw_numbers_public_all
on player_draw_numbers
for all
to anon, authenticated
using (true)
with check (true);
