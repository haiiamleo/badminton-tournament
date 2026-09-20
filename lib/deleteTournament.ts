import { supabase } from "@/lib/supabase";

function isMissingRelation(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message || "")
  );
}

async function deleteRows(
  table: string,
  column: string,
  values: string[]
) {
  if (values.length === 0) {
    return;
  }

  const { error } = await supabase.from(table).delete().in(column, values);

  if (error && !isMissingRelation(error)) {
    throw error;
  }
}

export async function deleteTournament(tournamentId: string) {
  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select("id")
    .eq("tournament_id", tournamentId);

  if (roundsError) {
    throw roundsError;
  }

  const roundIds = (rounds || []).map((round) => round.id);
  let matchIds: string[] = [];

  if (roundIds.length > 0) {
    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("id")
      .in("round_id", roundIds);

    if (matchesError) {
      throw matchesError;
    }

    matchIds = (matches || []).map((match) => match.id);
  }

  if (matchIds.length > 0) {
    await deleteRows("match_players", "match_id", matchIds);
    await deleteRows("matches", "id", matchIds);
  }

  const { error: fixturesError } = await supabase
    .from("fixtures")
    .delete()
    .eq("tournament_id", tournamentId);

  if (fixturesError && !isMissingRelation(fixturesError)) {
    throw fixturesError;
  }

  if (roundIds.length > 0) {
    const { error: roundDeleteError } = await supabase
      .from("rounds")
      .delete()
      .in("id", roundIds);

    if (roundDeleteError) {
      throw roundDeleteError;
    }
  }

  const { data: fixedPairs, error: fixedPairsError } = await supabase
    .from("fixed_pairs")
    .select("id")
    .eq("tournament_id", tournamentId);

  if (fixedPairsError && !isMissingRelation(fixedPairsError)) {
    throw fixedPairsError;
  }

  const fixedPairIds = (fixedPairs || []).map((pair) => pair.id);

  await deleteRows("fixed_pair_players", "pair_id", fixedPairIds);

  const { error: fixedPairStandingsError } = await supabase
    .from("fixed_pair_standings")
    .delete()
    .eq("tournament_id", tournamentId);

  if (
    fixedPairStandingsError &&
    !isMissingRelation(fixedPairStandingsError)
  ) {
    throw fixedPairStandingsError;
  }

  const { error: fixedPairDeleteError } = await supabase
    .from("fixed_pairs")
    .delete()
    .eq("tournament_id", tournamentId);

  if (fixedPairDeleteError && !isMissingRelation(fixedPairDeleteError)) {
    throw fixedPairDeleteError;
  }

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .eq("tournament_id", tournamentId);

  if (teamsError && !isMissingRelation(teamsError)) {
    throw teamsError;
  }

  const teamIds = (teams || []).map((team) => team.id);

  await deleteRows("team_players", "team_id", teamIds);

  const { error: teamStandingsError } = await supabase
    .from("team_standings")
    .delete()
    .eq("tournament_id", tournamentId);

  if (teamStandingsError && !isMissingRelation(teamStandingsError)) {
    throw teamStandingsError;
  }

  const { error: teamsDeleteError } = await supabase
    .from("teams")
    .delete()
    .eq("tournament_id", tournamentId);

  if (teamsDeleteError && !isMissingRelation(teamsDeleteError)) {
    throw teamsDeleteError;
  }

  const { error: standingsError } = await supabase
    .from("player_standings")
    .delete()
    .eq("tournament_id", tournamentId);

  if (standingsError) {
    throw standingsError;
  }

  const { error: scoringError } = await supabase
    .from("scoring_rules")
    .delete()
    .eq("tournament_id", tournamentId);

  if (scoringError) {
    throw scoringError;
  }

  const { error: playersError } = await supabase
    .from("players")
    .delete()
    .eq("tournament_id", tournamentId);

  if (playersError) {
    throw playersError;
  }

  const { error: tournamentError } = await supabase
    .from("tournaments")
    .delete()
    .eq("id", tournamentId);

  if (tournamentError) {
    throw tournamentError;
  }

  if (
    typeof window !== "undefined" &&
    localStorage.getItem("activeTournamentId") === tournamentId
  ) {
    localStorage.removeItem("activeTournamentId");
  }
}
