-- Open tournament tables to the closed group without login.
-- Run this in the Supabase SQL editor. The app uses the anon key,
-- so policies must allow the `anon` role.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public
to anon, authenticated;

grant usage, select on all sequences in schema public
to anon, authenticated;

alter default privileges in schema public
grant select, insert, update, delete on tables to anon, authenticated;

do $$
declare
  tbl text;
  policy_name text;
begin
  foreach tbl in array array[
    'tournaments',
    'players',
    'rounds',
    'matches',
    'match_players',
    'player_standings',
    'scoring_rules',
    'teams',
    'team_players',
    'team_standings',
    'fixtures'
  ]
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = tbl
    ) then
      execute format(
        'alter table public.%I enable row level security',
        tbl
      );

      policy_name := tbl || '_public_all';

      execute format(
        'drop policy if exists %I on public.%I',
        policy_name,
        tbl
      );

      execute format(
        'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
        policy_name,
        tbl
      );
    end if;
  end loop;
end $$;
