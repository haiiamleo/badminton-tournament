export function formatDoublesTeam(
  players: { name: string }[]
) {
  return players.map((player) => player.name).join(" + ");
}

export function getDoublesFinalResult<TPlayer>(
  rounds: { id: string; round_type: string }[],
  matches: {
    id: string;
    round_id: string;
    winner_team: number | null;
    team1_score: number | null;
    team2_score: number | null;
  }[],
  matchPlayers: {
    match_id: string;
    player_id: string;
    team_number: number;
  }[],
  playerMap: Map<string, TPlayer>
) {
  const finalRound = rounds.find(
    (round) => round.round_type === "final"
  );

  if (!finalRound) {
    return null;
  }

  const finalMatch = matches.find(
    (match) =>
      match.round_id === finalRound.id &&
      (match.winner_team === 1 || match.winner_team === 2)
  );

  if (!finalMatch || !finalMatch.winner_team) {
    return null;
  }

  const entries = matchPlayers.filter(
    (entry) => entry.match_id === finalMatch.id
  );

  const team1 = entries
    .filter((entry) => entry.team_number === 1)
    .map((entry) => playerMap.get(entry.player_id))
    .filter(Boolean) as TPlayer[];

  const team2 = entries
    .filter((entry) => entry.team_number === 2)
    .map((entry) => playerMap.get(entry.player_id))
    .filter(Boolean) as TPlayer[];

  return {
    champions:
      finalMatch.winner_team === 1 ? team1 : team2,
    runnersUp:
      finalMatch.winner_team === 1 ? team2 : team1,
    winnerScore:
      finalMatch.winner_team === 1
        ? finalMatch.team1_score
        : finalMatch.team2_score,
    loserScore:
      finalMatch.winner_team === 1
        ? finalMatch.team2_score
        : finalMatch.team1_score,
  };
}
