import { validateCompletedScore } from "@/lib/scoreValidation";

export type GameScore = {
  team1: number;
  team2: number;
};

export type GameScoreInput = {
  team1: string;
  team2: string;
};

export type BestOfThreeResult = {
  games: GameScore[];
  team1Games: number;
  team2Games: number;
  winnerTeam: 1 | 2;
  team1Rally: number;
  team2Rally: number;
};

export function usesBestOfThree(
  roundType: string | null | undefined,
  format?: string | null
) {
  if (format === "split_pairs" || format === "team_groups") {
    return false;
  }

  return (
    roundType === "quarterfinal" ||
    roundType === "semifinal" ||
    roundType === "final"
  );
}

export function emptyGameInputs(): GameScoreInput[] {
  return [
    { team1: "", team2: "" },
    { team1: "", team2: "" },
    { team1: "", team2: "" },
  ];
}

export function parseStoredGameScores(value: unknown): GameScore[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const games: GameScore[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const team1 = Number((item as { team1?: unknown }).team1);
    const team2 = Number((item as { team2?: unknown }).team2);

    if (!Number.isInteger(team1) || !Number.isInteger(team2)) {
      return null;
    }

    games.push({ team1, team2 });
  }

  return games;
}

export function gameInputsFromMatch(gameScores: unknown): GameScoreInput[] {
  const inputs = emptyGameInputs();
  const stored = parseStoredGameScores(gameScores) || [];

  stored.slice(0, 3).forEach((game, index) => {
    inputs[index] = {
      team1: String(game.team1),
      team2: String(game.team2),
    };
  });

  return inputs;
}

export function tallyCompletedGames(games: GameScoreInput[]) {
  let team1Games = 0;
  let team2Games = 0;
  let completed = 0;

  for (const game of games) {
    if (game.team1 === "" || game.team2 === "") {
      break;
    }

    const team1 = Number(game.team1);
    const team2 = Number(game.team2);

    if (!Number.isInteger(team1) || !Number.isInteger(team2)) {
      break;
    }

    if (team1 === team2) {
      break;
    }

    completed += 1;

    if (team1 > team2) {
      team1Games += 1;
    } else {
      team2Games += 1;
    }

    if (team1Games === 2 || team2Games === 2) {
      break;
    }
  }

  return { team1Games, team2Games, completed };
}

export function resolveBestOfThree(
  games: GameScoreInput[]
): { error: string } | BestOfThreeResult {
  const parsed: GameScore[] = [];
  let sawEmpty = false;

  for (let index = 0; index < games.length; index += 1) {
    const game = games[index] || { team1: "", team2: "" };
    const empty = game.team1 === "" && game.team2 === "";

    if (empty) {
      sawEmpty = true;
      continue;
    }

    if (sawEmpty) {
      return { error: "Enter game scores in order." };
    }

    if (game.team1 === "" || game.team2 === "") {
      return { error: `Enter both scores for game ${index + 1}.` };
    }

    const team1 = Number(game.team1);
    const team2 = Number(game.team2);
    const gameError = validateCompletedScore(team1, team2, "quarterfinal");

    if (gameError) {
      return { error: `Game ${index + 1}: ${gameError}` };
    }

    parsed.push({ team1, team2 });
  }

  if (parsed.length < 2) {
    return { error: "Best of 3 needs at least two finished games." };
  }

  let team1Games = 0;
  let team2Games = 0;

  for (let index = 0; index < parsed.length; index += 1) {
    if (parsed[index].team1 > parsed[index].team2) {
      team1Games += 1;
    } else {
      team2Games += 1;
    }

    if (team1Games === 2 || team2Games === 2) {
      return {
        games: parsed.slice(0, index + 1),
        team1Games,
        team2Games,
        winnerTeam: team1Games > team2Games ? 1 : 2,
        team1Rally: parsed
          .slice(0, index + 1)
          .reduce((sum, game) => sum + game.team1, 0),
        team2Rally: parsed
          .slice(0, index + 1)
          .reduce((sum, game) => sum + game.team2, 0),
      };
    }
  }

  return { error: "Play a third game. First pair to two games wins." };
}

export function formatMatchScoreLine(match: {
  team1_score: number | null;
  team2_score: number | null;
  game_scores?: unknown;
}) {
  const headline = `${match.team1_score ?? "-"} - ${match.team2_score ?? "-"}`;
  const games = parseStoredGameScores(match.game_scores);

  if (!games?.length) {
    return headline;
  }

  const detail = games
    .map((game) => `${game.team1}-${game.team2}`)
    .join(", ");

  return `${headline} (${detail})`;
}

export const INDIVIDUAL_MIN_PLAYERS = 16;
export const INDIVIDUAL_MAX_PLAYERS = 64;

export function isValidIndividualPlayerCount(count: number) {
  return (
    Number.isInteger(count) &&
    count >= INDIVIDUAL_MIN_PLAYERS &&
    count <= INDIVIDUAL_MAX_PLAYERS &&
    count % 4 === 0
  );
}
