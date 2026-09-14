export const MATCHES_PER_FIXTURE = 5;

export type TeamSize = 3 | 4;

export function playerCountsForTeamSize(teamSize: TeamSize) {
  return teamSize === 3 ? [12, 18, 24] : [16, 24, 32];
}

export function teamLayout(playerCount: number, teamSize: number) {
  const teamCount = playerCount / teamSize;
  const groupSize = teamCount / 2;

  return {
    teamCount,
    groupCount: 2,
    groupSize,
    valid:
      Number.isInteger(teamCount) &&
      Number.isInteger(groupSize) &&
      teamCount >= 4 &&
      teamCount % 2 === 0,
  };
}

export function splitIntoTeams<T>(items: T[], teamSize: number) {
  const layout = teamLayout(items.length, teamSize);
  const teams: {
    name: string;
    group_name: "A" | "B";
    seed: number;
    members: T[];
  }[] = [];

  for (let index = 0; index < layout.teamCount; index += 1) {
    const groupName = index < layout.groupSize ? "A" : "B";
    const letter = String.fromCharCode(65 + index);

    teams.push({
      name: `Team ${letter}`,
      group_name: groupName,
      seed: index + 1,
      members: items.slice(
        index * teamSize,
        index * teamSize + teamSize
      ),
    });
  }

  return teams;
}

export function roundRobinPairs<T>(items: T[]) {
  const pairs: [T, T][] = [];

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      pairs.push([items[i], items[j]]);
    }
  }

  return pairs;
}

export function defaultPairings(playerIds: string[]): [string, string][] {
  if (playerIds.length >= 4) {
    const [a, b, c, d] = playerIds;

    return [
      [a, b],
      [c, d],
      [a, c],
      [b, d],
      [a, d],
    ];
  }

  const [a, b, c] = playerIds;

  return [
    [a, b],
    [b, c],
    [a, c],
    [a, b],
    [b, c],
  ];
}

export type TeamStandingRow = {
  team_id: string;
  match_wins: number;
  match_losses: number;
  fixture_wins: number;
  fixture_losses: number;
};

export function rankTeams<T extends TeamStandingRow>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (b.match_wins !== a.match_wins) {
      return b.match_wins - a.match_wins;
    }

    if (b.fixture_wins !== a.fixture_wins) {
      return b.fixture_wins - a.fixture_wins;
    }

    const aDiff = a.match_wins - a.match_losses;
    const bDiff = b.match_wins - b.match_losses;

    return bDiff - aDiff;
  });
}

export function getCourtNumber(
  matchIndex: number,
  matchCount: number,
  courtCount: number
) {
  const matchesPerCourt = Math.ceil(matchCount / courtCount);

  return Math.min(
    courtCount,
    Math.floor(matchIndex / matchesPerCourt) + 1
  );
}
