export const SPLIT_PAIR_PLAYER_COUNT = 20;
export const SPLIT_PAIR_PRELIM_ROUNDS = 5;
export const PAIR_WIN_POINTS = 2;

export type SplitPool = "top" | "bottom";

export type RankedPlayer = {
  player_id: string;
  tournament_points: number | string | null;
  wins: number | string | null;
  points_for: number | string | null;
  points_against: number | string | null;
};

export type FixedPairSeed = {
  pool_name: SplitPool;
  seed: number;
  player_ids: [string, string];
};

export type FixedPairStandingRow = {
  pair_id: string;
  standing_points: number;
  wins: number;
  points_for: number;
  points_against: number;
};

export function rankPrelimPlayers<T extends RankedPlayer>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const points =
      Number(b.tournament_points || 0) -
      Number(a.tournament_points || 0);

    if (points !== 0) return points;

    const wins = Number(b.wins || 0) - Number(a.wins || 0);

    if (wins !== 0) return wins;

    const aDifference =
      Number(a.points_for || 0) - Number(a.points_against || 0);
    const bDifference =
      Number(b.points_for || 0) - Number(b.points_against || 0);

    if (bDifference !== aDifference) {
      return bDifference - aDifference;
    }

    return Number(b.points_for || 0) - Number(a.points_for || 0);
  });
}

export function createFixedPairSeeds(
  rankedPlayerIds: string[]
): FixedPairSeed[] {
  if (rankedPlayerIds.length !== SPLIT_PAIR_PLAYER_COUNT) {
    throw new Error(
      `Split Pairs requires exactly ${SPLIT_PAIR_PLAYER_COUNT} ranked players.`
    );
  }

  const pools: { name: SplitPool; playerIds: string[] }[] = [
    { name: "top", playerIds: rankedPlayerIds.slice(0, 10) },
    { name: "bottom", playerIds: rankedPlayerIds.slice(10, 20) },
  ];

  return pools.flatMap(({ name, playerIds }) =>
    Array.from({ length: 5 }, (_, index) => ({
      pool_name: name,
      seed: index + 1,
      player_ids: [
        playerIds[index],
        playerIds[playerIds.length - 1 - index],
      ] as [string, string],
    }))
  );
}

export function roundRobinPairings<T>(items: T[]): [T, T][] {
  const matches: [T, T][] = [];

  for (let first = 0; first < items.length; first += 1) {
    for (let second = first + 1; second < items.length; second += 1) {
      matches.push([items[first], items[second]]);
    }
  }

  return matches;
}

export function rankFixedPairs<T extends FixedPairStandingRow>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (b.standing_points !== a.standing_points) {
      return b.standing_points - a.standing_points;
    }

    const aDifference = a.points_for - a.points_against;
    const bDifference = b.points_for - b.points_against;

    if (bDifference !== aDifference) {
      return bDifference - aDifference;
    }

    if (b.points_for !== a.points_for) {
      return b.points_for - a.points_for;
    }

    return b.wins - a.wins;
  });
}

export function semifinalPairings<T>(rankedPairs: T[]) {
  if (rankedPairs.length < 4) {
    throw new Error("Four ranked pairs are required for semifinals.");
  }

  return [
    [rankedPairs[0], rankedPairs[3]],
    [rankedPairs[1], rankedPairs[2]],
  ] as [T, T][];
}

export function poolLabel(pool: SplitPool | string) {
  return pool === "top" ? "Championship" : "Plate";
}
