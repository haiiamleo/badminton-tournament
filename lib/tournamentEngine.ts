export type EnginePlayer = {
  id: string;
  name: string;
};

export type EngineStanding = {
  player_id: string;
  tournament_points: number | string | null;
  wins: number | string | null;
  losses: number | string | null;
  points_for: number | string | null;
  points_against: number | string | null;
};

export type HistoricalMatchPlayer = {
  match_id: string;
  player_id: string;
  team_number: number;
};

export type Pairing = {
  team1: string[];
  team2: string[];
};

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function buildHistory(
  matchPlayers: HistoricalMatchPlayer[]
): {
  partners: Map<string, number>;
  opponents: Map<string, number>;
} {
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();

  const matches = new Map<string, HistoricalMatchPlayer[]>();

  for (const player of matchPlayers) {
    if (!matches.has(player.match_id)) {
      matches.set(player.match_id, []);
    }

    matches.get(player.match_id)!.push(player);
  }

  for (const players of matches.values()) {
    const team1 = players
      .filter((p) => p.team_number === 1)
      .map((p) => p.player_id);

    const team2 = players
      .filter((p) => p.team_number === 2)
      .map((p) => p.player_id);

    // Partner history
    for (let i = 0; i < team1.length; i++) {
      for (let j = i + 1; j < team1.length; j++) {
        const key = pairKey(team1[i], team1[j]);
        partners.set(key, (partners.get(key) || 0) + 1);
      }
    }

    for (let i = 0; i < team2.length; i++) {
      for (let j = i + 1; j < team2.length; j++) {
        const key = pairKey(team2[i], team2[j]);
        partners.set(key, (partners.get(key) || 0) + 1);
      }
    }

    // Opponent history
    for (const p1 of team1) {
      for (const p2 of team2) {
        const key = pairKey(p1, p2);
        opponents.set(key, (opponents.get(key) || 0) + 1);
      }
    }
  }

  return {
    partners,
    opponents,
  };
}

export function generateIntelligentPairings(
  players: EnginePlayer[],
  standings: EngineStanding[],
  historicalMatchPlayers: HistoricalMatchPlayer[],
  iterations = 5000
): Pairing[] {
  if (players.length % 4 !== 0) {
    throw new Error(
      `Player count must be divisible by 4. Received ${players.length}.`
    );
  }

  const playerMap = new Map<string, EnginePlayer>();

  players.forEach((player) => {
    playerMap.set(player.id, player);
  });

  const standingMap = new Map<string, EngineStanding>();

  standings.forEach((standing) => {
    standingMap.set(standing.player_id, standing);
  });

  const history = buildHistory(historicalMatchPlayers);

  const strength = (playerId: string): number => {
    const standing = standingMap.get(playerId);

    if (!standing) {
      return 0;
    }

    return Number(standing.tournament_points || 0);
  };

  const pointDifference = (playerId: string): number => {
    const standing = standingMap.get(playerId);

    if (!standing) {
      return 0;
    }

    return (
      Number(standing.points_for || 0) -
      Number(standing.points_against || 0)
    );
  };

  let bestPairings: Pairing[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  const matchCount = players.length / 4;

  for (let iteration = 0; iteration < iterations; iteration++) {
    const shuffled = shuffle(players);

    const candidate: Pairing[] = [];

    let totalScore = 0;

    for (let i = 0; i < matchCount; i++) {
      const group = shuffled.slice(i * 4, i * 4 + 4);

      const team1 = group.slice(0, 2).map((p) => p.id);
      const team2 = group.slice(2, 4).map((p) => p.id);

      // Strong penalty for repeated partners
      const partner1 = history.partners.get(pairKey(team1[0], team1[1])) || 0;
      const partner2 = history.partners.get(pairKey(team2[0], team2[1])) || 0;

      totalScore += partner1 * 100000;
      totalScore += partner2 * 100000;

      // Penalty for repeated opponents
      for (const p1 of team1) {
        for (const p2 of team2) {
          const repeated =
            history.opponents.get(pairKey(p1, p2)) || 0;

          totalScore += repeated * 5000;
        }
      }

      // Balance team strength
      const team1Strength =
        strength(team1[0]) + strength(team1[1]);

      const team2Strength =
        strength(team2[0]) + strength(team2[1]);

      const strengthDifference = Math.abs(
        team1Strength - team2Strength
      );

      totalScore += strengthDifference * 20;

      // Also consider point differential
      const team1Difference =
        pointDifference(team1[0]) +
        pointDifference(team1[1]);

      const team2Difference =
        pointDifference(team2[0]) +
        pointDifference(team2[1]);

      totalScore +=
        Math.abs(team1Difference - team2Difference) * 2;

      // Small randomness prevents always producing the same pairing
      totalScore += Math.random();
    }

    if (totalScore < bestScore) {
      bestScore = totalScore;
      bestPairings = candidate;

      // Rebuild candidate because we need the actual pairings
      bestPairings.length = 0;

      for (let i = 0; i < matchCount; i++) {
        const group = shuffled.slice(i * 4, i * 4 + 4);

        bestPairings.push({
          team1: group.slice(0, 2).map((p) => p.id),
          team2: group.slice(2, 4).map((p) => p.id),
        });
      }
    }
  }

  if (!bestPairings) {
    throw new Error("Unable to generate intelligent pairings.");
  }

  return bestPairings;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashText(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return bytesToHex(new Uint8Array(digest));
}

/*
 * Shuffle by hashing each player with a fresh CSPRNG salt, then
 * sorting on the digest. SHA-256 mixes names and IDs evenly, so
 * list order never leaks into the draw.
 */
async function shuffleByPlayerHash<T extends { id: string; name: string }>(
  items: T[]
) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const saltHex = bytesToHex(salt);

  const ranked = await Promise.all(
    items.map(async (item) => ({
      item,
      hash: await hashText(`${saltHex}:${item.id}:${item.name}`),
    }))
  );

  ranked.sort((a, b) => {
    if (a.hash !== b.hash) {
      return a.hash < b.hash ? -1 : 1;
    }

    return a.item.id.localeCompare(b.item.id);
  });

  return ranked.map((entry) => entry.item);
}

export async function generateRandomPairings(
  players: EnginePlayer[]
): Promise<Pairing[]> {
  if (players.length % 4 !== 0) {
    throw new Error(
      `Player count must be divisible by 4. Received ${players.length}.`
    );
  }

  const shuffled = await shuffleByPlayerHash(players);
  const pairings: Pairing[] = [];

  for (let i = 0; i < shuffled.length; i += 4) {
    pairings.push({
      team1: [shuffled[i].id, shuffled[i + 1].id],
      team2: [shuffled[i + 2].id, shuffled[i + 3].id],
    });
  }

  return pairings;
}