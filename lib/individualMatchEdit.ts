import {
  emptyGameInputs,
  gameInputsFromMatch,
  parseStoredGameScores,
  resolveBestOfThree,
  usesBestOfThree,
  type GameScoreInput,
} from "@/lib/bestOfThree";
import { validateCompletedScore } from "@/lib/scoreValidation";
import { supabase } from "@/lib/supabase";

export type ScoreDraft = {
  team1: string;
  team2: string;
  games: GameScoreInput[];
};

export type CompletedMatchView = {
  id: string;
  roundId: string;
  roundNumber: number;
  roundType: string;
  matchNumber: number;
  courtNumber: number | null;
  team1Score: number | null;
  team2Score: number | null;
  winnerTeam: number | null;
  gameScores: unknown;
  status: string;
  team1Players: { id: string; name: string }[];
  team2Players: { id: string; name: string }[];
  matchesInRound: number;
  laterRoundExists: boolean;
};

type SidePoints = {
  pointsFor: number;
  pointsAgainst: number;
  tournamentPoints: number;
  win: number;
  loss: number;
};

function sidePoints(input: {
  roundType: string;
  team1Score: number;
  team2Score: number;
  team1Rally: number;
  team2Rally: number;
  winnerTeam: 1 | 2;
}): { team1: SidePoints; team2: SidePoints } {
  const winnerPoints =
    (input.winnerTeam === 1 ? input.team1Rally : input.team2Rally) / 2;
  const loserPoints =
    (input.winnerTeam === 1 ? input.team2Rally : input.team1Rally) / 2;

  const side = (isWinner: boolean): SidePoints => ({
    pointsFor: isWinner ? winnerPoints : loserPoints,
    pointsAgainst: isWinner ? loserPoints : winnerPoints,
    tournamentPoints: isWinner ? winnerPoints : loserPoints,
    win: isWinner ? 1 : 0,
    loss: isWinner ? 0 : 1,
  });

  return {
    team1: side(input.winnerTeam === 1),
    team2: side(input.winnerTeam === 2),
  };
}

export function describeStoredResult(match: CompletedMatchView) {
  if (
    match.winnerTeam !== 1 &&
    match.winnerTeam !== 2
  ) {
    throw new Error("This finished match has no winner.");
  }

  if (!usesBestOfThree(match.roundType, "individual")) {
    if (match.team1Score === null || match.team2Score === null) {
      throw new Error("This finished match has no saved score.");
    }

    return {
      team1Score: match.team1Score,
      team2Score: match.team2Score,
      winnerTeam: match.winnerTeam,
      gameScores: null as { team1: number; team2: number }[] | null,
      points: sidePoints({
        roundType: match.roundType,
        team1Score: match.team1Score,
        team2Score: match.team2Score,
        team1Rally: match.team1Score,
        team2Rally: match.team2Score,
        winnerTeam: match.winnerTeam,
      }),
    };
  }

  const games = parseStoredGameScores(match.gameScores);

  if (!games?.length) {
    throw new Error(
      "This knockout match has no saved game scores, so its points cannot be recalculated."
    );
  }

  const team1Rally = games.reduce((sum, game) => sum + game.team1, 0);
  const team2Rally = games.reduce((sum, game) => sum + game.team2, 0);

  return {
    team1Score: match.team1Score ?? 0,
    team2Score: match.team2Score ?? 0,
    winnerTeam: match.winnerTeam,
    gameScores: games,
    points: sidePoints({
      roundType: match.roundType,
      team1Score: match.team1Score ?? 0,
      team2Score: match.team2Score ?? 0,
      team1Rally,
      team2Rally,
      winnerTeam: match.winnerTeam,
    }),
  };
}

export function describeDraftResult(
  roundType: string,
  draft: ScoreDraft
) {
  if (usesBestOfThree(roundType, "individual")) {
    const result = resolveBestOfThree(draft.games || emptyGameInputs());

    if ("error" in result) {
      throw new Error(result.error);
    }

    return {
      team1Score: result.team1Games,
      team2Score: result.team2Games,
      winnerTeam: result.winnerTeam,
      gameScores: result.games,
      points: sidePoints({
        roundType,
        team1Score: result.team1Games,
        team2Score: result.team2Games,
        team1Rally: result.team1Rally,
        team2Rally: result.team2Rally,
        winnerTeam: result.winnerTeam,
      }),
    };
  }

  if (draft.team1 === "" || draft.team2 === "") {
    throw new Error("Enter both scores.");
  }

  const team1Score = Number(draft.team1);
  const team2Score = Number(draft.team2);
  const scoreError = validateCompletedScore(
    team1Score,
    team2Score,
    roundType
  );

  if (scoreError) {
    throw new Error(scoreError);
  }

  const winnerTeam: 1 | 2 = team1Score > team2Score ? 1 : 2;

  return {
    team1Score,
    team2Score,
    winnerTeam,
    gameScores: null as { team1: number; team2: number }[] | null,
    points: sidePoints({
      roundType,
      team1Score,
      team2Score,
      team1Rally: team1Score,
      team2Rally: team2Score,
      winnerTeam,
    }),
  };
}

export function draftFromMatch(match: CompletedMatchView): ScoreDraft {
  return {
    team1:
      match.team1Score === null ? "" : String(match.team1Score),
    team2:
      match.team2Score === null ? "" : String(match.team2Score),
    games: gameInputsFromMatch(match.gameScores),
  };
}

export async function loadCompletedMatches(
  tournamentId: string
): Promise<CompletedMatchView[]> {
  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select("id, round_number, round_type")
    .eq("tournament_id", tournamentId)
    .order("round_number");

  if (roundsError) {
    throw roundsError;
  }

  const roundRows = rounds || [];
  const roundIds = roundRows.map((round) => round.id);

  if (roundIds.length === 0) {
    return [];
  }

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select(
      "id, round_id, match_number, court_number, team1_score, team2_score, winner_team, status, game_scores"
    )
    .in("round_id", roundIds)
    .order("match_number");

  if (matchesError) {
    throw matchesError;
  }

  const matchRows = matches || [];
  const completed = matchRows.filter(
    (match) => match.status === "completed"
  );

  if (completed.length === 0) {
    return [];
  }

  const { data: links, error: linksError } = await supabase
    .from("match_players")
    .select("match_id, player_id, team_number")
    .in(
      "match_id",
      completed.map((match) => match.id)
    );

  if (linksError) {
    throw linksError;
  }

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name")
    .eq("tournament_id", tournamentId);

  if (playersError) {
    throw playersError;
  }

  const playerNames = new Map(
    (players || []).map((player) => [player.id, player.name])
  );
  const roundById = new Map(roundRows.map((round) => [round.id, round]));
  const countByRound = new Map<string, number>();

  matchRows.forEach((match) => {
    countByRound.set(
      match.round_id,
      (countByRound.get(match.round_id) || 0) + 1
    );
  });

  const highestRound = Math.max(
    ...roundRows.map((round) => Number(round.round_number))
  );

  return completed.map((match) => {
    const round = roundById.get(match.round_id);
    const members = (links || []).filter(
      (link) => link.match_id === match.id
    );
    const named = (teamNumber: number) =>
      members
        .filter((link) => link.team_number === teamNumber)
        .map((link) => ({
          id: link.player_id,
          name: playerNames.get(link.player_id) || "Player",
        }));

    return {
      id: match.id,
      roundId: match.round_id,
      roundNumber: Number(round?.round_number || 0),
      roundType: round?.round_type || "preliminary",
      matchNumber: match.match_number,
      courtNumber: match.court_number,
      team1Score: match.team1_score,
      team2Score: match.team2_score,
      winnerTeam: match.winner_team,
      gameScores: match.game_scores,
      status: match.status,
      team1Players: named(1),
      team2Players: named(2),
      matchesInRound: countByRound.get(match.round_id) || 1,
      laterRoundExists:
        Number(round?.round_number || 0) < highestRound,
    };
  }).sort(
    (left, right) =>
      left.roundNumber - right.roundNumber ||
      left.matchNumber - right.matchNumber
  );
}

export async function editIndividualMatch(
  tournamentId: string,
  match: CompletedMatchView,
  draft: ScoreDraft,
  password: string
) {
  if (match.status !== "completed") {
    throw new Error("Only a finished match can be edited.");
  }

  const response = await fetch("/api/score-edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      password,
      tournamentId,
      matchId: match.id,
      draft,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    winnerChanged?: boolean;
  };

  if (!response.ok) {
    throw new Error(body.error || "Unable to update this score.");
  }

  return { winnerChanged: Boolean(body.winnerChanged) };
}
