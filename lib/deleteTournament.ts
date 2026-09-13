import { supabase } from "@/lib/supabase";

export async function deleteTournament(tournamentId: string) {
  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select("id")
    .eq("tournament_id", tournamentId);

  if (roundsError) {
    throw roundsError;
  }

  const roundIds = (rounds || []).map((round) => round.id);

  if (roundIds.length > 0) {
    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("id")
      .in("round_id", roundIds);

    if (matchesError) {
      throw matchesError;
    }

    const matchIds = (matches || []).map((match) => match.id);

    if (matchIds.length > 0) {
      const { error: matchPlayersError } = await supabase
        .from("match_players")
        .delete()
        .in("match_id", matchIds);

      if (matchPlayersError) {
        throw matchPlayersError;
      }

      const { error: matchDeleteError } = await supabase
        .from("matches")
        .delete()
        .in("id", matchIds);

      if (matchDeleteError) {
        throw matchDeleteError;
      }
    }

    const { error: roundDeleteError } = await supabase
      .from("rounds")
      .delete()
      .in("id", roundIds);

    if (roundDeleteError) {
      throw roundDeleteError;
    }
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
