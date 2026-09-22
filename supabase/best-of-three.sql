-- Individual doubles knockout: store each game in a best-of-3 match.
-- Run this in the Supabase SQL editor before scoring quarterfinals.

alter table matches
add column if not exists game_scores jsonb;
