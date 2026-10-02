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

export const MAX_PARTNER_REPEATS = 2;

export type PartnerCountRow = {
  match_id: string;
  player_id: string;
  team_number: number;
};

function randomIndex(limit: number) {
  if (limit <= 1) {
    return 0;
  }

  const max = 0x100000000;
  const cutoff = max - (max % limit);
  const buffer = new Uint32Array(1);
  let value = cutoff;

  while (value >= cutoff) {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  }

  return value % limit;
}

function shufflePlayers<T>(items: T[]) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }

  return result;
}

export function partnerCountsFromMatchPlayers(rows: PartnerCountRow[]) {
  const counts = new Map<string, number>();
  const matches = new Map<string, PartnerCountRow[]>();

  rows.forEach((row) => {
    const players = matches.get(row.match_id) || [];
    players.push(row);
    matches.set(row.match_id, players);
  });

  matches.forEach((players) => {
    [1, 2].forEach((teamNumber) => {
      const team = players
        .filter((player) => player.team_number === teamNumber)
        .map((player) => player.player_id);

      if (team.length === 2) {
        const key = pairKey(team[0], team[1]);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
  });

  return counts;
}

const PARTNER_SPLITS = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
] as const;

function buildConstrainedRound(
  players: EnginePlayer[],
  partnerCounts: Map<string, number>,
  maxPartnerRepeats: number
) {
  const ordered = shufflePlayers(players);
  const pairings: Pairing[] = [];

  for (let index = 0; index < ordered.length; index += 4) {
    const group = ordered.slice(index, index + 4).map((player) => player.id);
    const validSplits = PARTNER_SPLITS.filter((split) => {
      const first = partnerCounts.get(pairKey(group[split[0]], group[split[1]])) || 0;
      const second = partnerCounts.get(pairKey(group[split[2]], group[split[3]])) || 0;

      return first < maxPartnerRepeats && second < maxPartnerRepeats;
    });

    if (validSplits.length === 0) {
      return null;
    }

    const lowest = Math.min(
      ...validSplits.map((split) => {
        const first = partnerCounts.get(pairKey(group[split[0]], group[split[1]])) || 0;
        const second = partnerCounts.get(pairKey(group[split[2]], group[split[3]])) || 0;

        return first + second;
      })
    );
    const preferred = validSplits.filter((split) => {
      const first = partnerCounts.get(pairKey(group[split[0]], group[split[1]])) || 0;
      const second = partnerCounts.get(pairKey(group[split[2]], group[split[3]])) || 0;

      return first + second === lowest;
    });
    const split = preferred[randomIndex(preferred.length)];
    const team1 = shufflePlayers([group[split[0]], group[split[1]]]);
    const team2 = shufflePlayers([group[split[2]], group[split[3]]]);
    const teams = shufflePlayers([team1, team2]);

    pairings.push({
      team1: teams[0],
      team2: teams[1],
    });
  }

  return shufflePlayers(pairings);
}

function rememberPairings(
  partnerCounts: Map<string, number>,
  pairings: Pairing[]
) {
  pairings.forEach((pairing) => {
    [pairing.team1, pairing.team2].forEach((team) => {
      if (team.length === 2) {
        const key = pairKey(team[0], team[1]);
        partnerCounts.set(key, (partnerCounts.get(key) || 0) + 1);
      }
    });
  });
}

/*
 * Build every preliminary round before play starts.
 * A fresh CSPRNG shuffle is used for every attempt. Any two players
 * may partner at most `maxPartnerRepeats` times across the schedule.
 */
export function generatePrelimSchedule(
  players: EnginePlayer[],
  roundCount: number,
  options?: {
    maxPartnerRepeats?: number;
    partnerCounts?: Map<string, number>;
  }
) {
  if (players.length % 4 !== 0) {
    throw new Error(
      `Player count must be divisible by 4. Received ${players.length}.`
    );
  }

  if (roundCount < 1) {
    throw new Error("At least one preliminary round is required.");
  }

  const maxPartnerRepeats = options?.maxPartnerRepeats ?? MAX_PARTNER_REPEATS;
  const partnerCapacity = maxPartnerRepeats * (players.length - 1);

  if (roundCount > partnerCapacity) {
    throw new Error(
      `${players.length} players cannot play ${roundCount} rounds without a partnership repeating more than ${maxPartnerRepeats} times.`
    );
  }

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const partnerCounts = new Map(options?.partnerCounts || []);
    const rounds: Pairing[][] = [];
    let built = true;

    for (let round = 0; round < roundCount; round += 1) {
      let pairings: Pairing[] | null = null;

      for (let tryRound = 0; tryRound < 60; tryRound += 1) {
        pairings = buildConstrainedRound(
          players,
          partnerCounts,
          maxPartnerRepeats
        );

        if (pairings) {
          break;
        }
      }

      if (!pairings) {
        built = false;
        break;
      }

      rememberPairings(partnerCounts, pairings);
      rounds.push(pairings);
    }

    if (built) {
      const overCap = [...partnerCounts.values()].some(
        (count) => count > maxPartnerRepeats
      );

      if (!overCap) {
        return rounds;
      }
    }
  }

  throw new Error(
    "Could not build a draw where every partnership is used at most twice. Generate the rounds again."
  );
}

type CourtSlot = {
  court: number;
  position: number;
  isLast: boolean;
};

function courtSlots(matchCount: number, courtCount: number): CourtSlot[] {
  const matchesPerCourt = Math.ceil(matchCount / courtCount);

  return Array.from({ length: matchCount }, (_, index) => {
    const court = Math.min(
      courtCount,
      Math.floor(index / matchesPerCourt) + 1
    );
    const firstIndex = (court - 1) * matchesPerCourt;
    const finalIndex = Math.min(
      firstIndex + matchesPerCourt,
      matchCount
    ) - 1;

    return {
      court,
      position: index - firstIndex,
      isLast: index === finalIndex,
    };
  });
}

function pairingPlayers(pairing: Pairing) {
  return [...pairing.team1, ...pairing.team2];
}

/*
 * Reorder each round so the existing court assignment keeps as many
 * players as possible on the court they just used. A large bonus is
 * given when at least two players from one match stay together, and
 * when the last match on a court flows into that court's first match
 * in the next round.
 */
export function scheduleRoundsForCourtContinuity(
  rounds: Pairing[][],
  courtCount: number
) {
  if (rounds.length < 2 || courtCount < 1) {
    return rounds.map((round) => [...round]);
  }

  const scheduled: Pairing[][] = [[...rounds[0]]];

  for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
    const previous = scheduled[roundIndex - 1];
    const current = rounds[roundIndex];
    const previousSlots = courtSlots(previous.length, courtCount);
    const currentSlots = courtSlots(current.length, courtCount);
    const previousPlayer = new Map<
      string,
      { court: number; match: number; wasLast: boolean }
    >();

    previous.forEach((pairing, match) => {
      pairingPlayers(pairing).forEach((playerId) => {
        previousPlayer.set(playerId, {
          court: previousSlots[match].court,
          match,
          wasLast: previousSlots[match].isLast,
        });
      });
    });

    const placementScore = (pairing: Pairing, slot: CourtSlot) => {
      const players = pairingPlayers(pairing)
        .map((playerId) => previousPlayer.get(playerId))
        .filter(
          (
            value
          ): value is {
            court: number;
            match: number;
            wasLast: boolean;
          } => Boolean(value)
        );
      const onSameCourt = players.filter(
        (player) => player.court === slot.court
      );
      const previousMatches = new Map<number, number>();

      onSameCourt.forEach((player) => {
        previousMatches.set(
          player.match,
          (previousMatches.get(player.match) || 0) + 1
        );
      });

      const stayTogether = Math.max(
        0,
        ...previousMatches.values()
      );
      const continuousPlayers =
        slot.position === 0
          ? onSameCourt.filter((player) => player.wasLast).length
          : 0;

      return (
        onSameCourt.length * 10 +
        (stayTogether >= 2 ? stayTogether * 30 : 0) +
        continuousPlayers * 50
      );
    };

    let best: Pairing[] | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const candidate: Array<Pairing | undefined> = Array(
        current.length
      );
      const availableSlots = currentSlots.map((_, index) => index);
      let total = 0;

      for (const pairing of shufflePlayers(current)) {
        const scores = availableSlots.map((slotIndex) => ({
          slotIndex,
          score: placementScore(pairing, currentSlots[slotIndex]),
        }));
        const highest = Math.max(...scores.map((item) => item.score));
        const preferred = scores.filter(
          (item) => item.score === highest
        );
        const chosen = preferred[randomIndex(preferred.length)];

        candidate[chosen.slotIndex] = pairing;
        total += chosen.score;
        availableSlots.splice(
          availableSlots.indexOf(chosen.slotIndex),
          1
        );
      }

      if (total > bestScore) {
        bestScore = total;
        best = candidate.filter(
          (pairing): pairing is Pairing => Boolean(pairing)
        );
      }
    }

    scheduled.push(best || [...current]);
  }

  return scheduled;
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