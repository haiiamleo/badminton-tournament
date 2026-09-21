"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppNav from "@/app/components/AppNav";
import { supabase } from "@/lib/supabase";
import {
  PAIR_WIN_POINTS,
  poolLabel,
  rankFixedPairs,
  roundRobinPairings,
  semifinalPairings,
  type SplitPool,
} from "@/lib/splitPairsTournament";
import {
  sanitizeScoreInput,
  scoreRuleHint,
  validateCompletedScore,
} from "@/lib/scoreValidation";
import { describeError } from "@/lib/errorMessage";

type Tournament = {
  id: string;
  name: string;
  courts: number;
  format?: string;
  status: string;
};

type Player = {
  id: string;
  name: string;
};

type FixedPair = {
  id: string;
  tournament_id: string;
  pool_name: SplitPool;
  seed: number;
  name: string;
};

type PairStanding = {
  pair_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  standing_points: number;
  points_for: number;
  points_against: number;
};

type Round = {
  id: string;
  round_number: number;
  round_type: "pair_round_robin" | "split_semifinal" | "split_final";
  status: string;
};

type Match = {
  id: string;
  round_id: string;
  fixed_pair1_id: string | null;
  fixed_pair2_id: string | null;
  court_number: number | null;
  match_number: number;
  team1_score: number | null;
  team2_score: number | null;
  winner_team: number | null;
  status: string;
};

type ScoreInput = {
  team1: string;
  team2: string;
};

function stageLabel(roundType: Round["round_type"]) {
  if (roundType === "pair_round_robin") return "Fixed-Pair Round Robin";
  if (roundType === "split_semifinal") return "Semifinals";
  return "Finals";
}

function courtNumber(index: number, matchCount: number, courts: number) {
  const matchesPerCourt = Math.ceil(matchCount / courts);

  return Math.min(courts, Math.floor(index / matchesPerCourt) + 1);
}

export default function SplitPairsCenterPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [pairs, setPairs] = useState<FixedPair[]>([]);
  const [pairPlayers, setPairPlayers] = useState<Record<string, Player[]>>({});
  const [standings, setStandings] = useState<PairStanding[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreInput>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const pairMap = useMemo(
    () => new Map(pairs.map((pair) => [pair.id, pair])),
    [pairs]
  );

  const load = useCallback(async () => {
    try {
      setError("");

      const tournamentId = localStorage.getItem("activeTournamentId");

      if (!tournamentId) {
        setTournament(null);
        return;
      }

      const { data: tournamentData, error: tournamentError } =
        await supabase
          .from("tournaments")
          .select("id,name,courts,format,status")
          .eq("id", tournamentId)
          .single();

      if (tournamentError) throw tournamentError;

      setTournament(tournamentData as Tournament);

      if (tournamentData.format !== "split_pairs") {
        return;
      }

      const [
        playersResponse,
        pairsResponse,
        standingsResponse,
        roundsResponse,
      ] = await Promise.all([
        supabase
          .from("players")
          .select("id,name")
          .eq("tournament_id", tournamentId),
        supabase
          .from("fixed_pairs")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("pool_name")
          .order("seed"),
        supabase
          .from("fixed_pair_standings")
          .select("*")
          .eq("tournament_id", tournamentId),
        supabase
          .from("rounds")
          .select("id,round_number,round_type,status")
          .eq("tournament_id", tournamentId)
          .in("round_type", [
            "pair_round_robin",
            "split_semifinal",
            "split_final",
          ])
          .order("round_number"),
      ]);

      if (playersResponse.error) throw playersResponse.error;
      if (pairsResponse.error) throw pairsResponse.error;
      if (standingsResponse.error) throw standingsResponse.error;
      if (roundsResponse.error) throw roundsResponse.error;

      const loadedPlayers = (playersResponse.data || []) as Player[];
      const loadedPairs = (pairsResponse.data || []) as FixedPair[];
      const loadedRounds = (roundsResponse.data || []) as Round[];
      const playersById = new Map(
        loadedPlayers.map((player) => [player.id, player])
      );
      const members: Record<string, Player[]> = {};

      if (loadedPairs.length > 0) {
        const { data: memberRows, error: memberError } = await supabase
          .from("fixed_pair_players")
          .select("pair_id,player_id,slot")
          .in(
            "pair_id",
            loadedPairs.map((pair) => pair.id)
          )
          .order("slot");

        if (memberError) throw memberError;

        for (const pair of loadedPairs) {
          members[pair.id] = (memberRows || [])
            .filter((row) => row.pair_id === pair.id)
            .map((row) => playersById.get(row.player_id))
            .filter(Boolean) as Player[];
        }
      }

      let loadedMatches: Match[] = [];

      if (loadedRounds.length > 0) {
        const { data: matchData, error: matchError } = await supabase
          .from("matches")
          .select("*")
          .in(
            "round_id",
            loadedRounds.map((round) => round.id)
          )
          .order("match_number");

        if (matchError) throw matchError;
        loadedMatches = (matchData || []) as Match[];
      }

      const nextScores: Record<string, ScoreInput> = {};

      for (const match of loadedMatches) {
        nextScores[match.id] = {
          team1:
            match.team1_score === null ? "" : String(match.team1_score),
          team2:
            match.team2_score === null ? "" : String(match.team2_score),
        };
      }

      setPairs(loadedPairs);
      setPairPlayers(members);
      setStandings((standingsResponse.data || []) as PairStanding[]);
      setRounds(loadedRounds);
      setMatches(loadedMatches);
      setScores(nextScores);
    } catch (loadError: unknown) {
      console.error(loadError);
      setError(
        describeError(
          loadError,
          "Unable to load the Split Pairs tournament."
        )
      );
    } finally {
      setLoading(false);
      setWorking(false);
    }
  }, []);

  useEffect(() => {
    // Synchronize the page with the active tournament on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const standingsByPool = useMemo(() => {
    const result: Record<
      SplitPool,
      (PairStanding & { pair: FixedPair })[]
    > = { top: [], bottom: [] };

    for (const standing of standings) {
      const pair = pairMap.get(standing.pair_id);

      if (pair) {
        result[pair.pool_name].push({ ...standing, pair });
      }
    }

    result.top = rankFixedPairs(result.top);
    result.bottom = rankFixedPairs(result.bottom);

    return result;
  }, [standings, pairMap]);

  const roundByType = useMemo(
    () =>
      new Map(rounds.map((round) => [round.round_type, round])),
    [rounds]
  );

  const roundRobinRound = roundByType.get("pair_round_robin");
  const semifinalRound = roundByType.get("split_semifinal");
  const finalRound = roundByType.get("split_final");

  async function createStageMatches(
    round: Round,
    pairings: [FixedPair, FixedPair][]
  ) {
    if (!tournament) return;

    const matchRows = pairings.map(([pair1, pair2], index) => ({
      round_id: round.id,
      fixed_pair1_id: pair1.id,
      fixed_pair2_id: pair2.id,
      court_number: courtNumber(
        index,
        pairings.length,
        tournament.courts
      ),
      match_number: index + 1,
      team1_score: null,
      team2_score: null,
      winner_team: null,
      status: "scheduled",
    }));

    const { data: inserted, error: matchError } = await supabase
      .from("matches")
      .insert(matchRows)
      .select();

    if (matchError) throw matchError;

    const ordered = [...(inserted || [])].sort(
      (a, b) => a.match_number - b.match_number
    );
    const matchPlayerRows: {
      match_id: string;
      player_id: string;
      team_number: number;
    }[] = [];

    pairings.forEach(([pair1, pair2], index) => {
      for (const player of pairPlayers[pair1.id] || []) {
        matchPlayerRows.push({
          match_id: ordered[index].id,
          player_id: player.id,
          team_number: 1,
        });
      }

      for (const player of pairPlayers[pair2.id] || []) {
        matchPlayerRows.push({
          match_id: ordered[index].id,
          player_id: player.id,
          team_number: 2,
        });
      }
    });

    const { error: playerError } = await supabase
      .from("match_players")
      .insert(matchPlayerRows);

    if (playerError) throw playerError;
  }

  async function createRound(
    roundNumber: number,
    roundType: Round["round_type"],
    pairings: [FixedPair, FixedPair][]
  ) {
    if (!tournament) return;

    const { data, error: roundError } = await supabase
      .from("rounds")
      .insert({
        tournament_id: tournament.id,
        round_number: roundNumber,
        round_type: roundType,
        status: "generated",
      })
      .select()
      .single();

    if (roundError) throw roundError;

    await createStageMatches(data as Round, pairings);
  }

  async function generateRoundRobin() {
    if (!tournament || roundRobinRound) return;

    try {
      setWorking(true);
      setError("");
      setSuccess("");

      const topPairs = pairs.filter((pair) => pair.pool_name === "top");
      const bottomPairs = pairs.filter(
        (pair) => pair.pool_name === "bottom"
      );

      if (topPairs.length !== 5 || bottomPairs.length !== 5) {
        throw new Error(
          "Both draws require exactly five fixed pairs."
        );
      }

      await createRound(6, "pair_round_robin", [
        ...roundRobinPairings(topPairs),
        ...roundRobinPairings(bottomPairs),
      ]);

      setSuccess("Both fixed-pair round robins were generated.");
      await load();
    } catch (generateError: unknown) {
      console.error(generateError);
      setError(
        describeError(
          generateError,
          "Unable to generate the round robin."
        )
      );
      setWorking(false);
    }
  }

  async function generateSemifinals() {
    if (!tournament || semifinalRound) return;

    try {
      setWorking(true);
      setError("");
      setSuccess("");

      if (roundRobinRound?.status !== "completed") {
        throw new Error("Complete both Championship and Plate round robins first.");
      }

      const pairings = (
        ["top", "bottom"] as SplitPool[]
      ).flatMap((pool) =>
        semifinalPairings(
          standingsByPool[pool].slice(0, 4).map((row) => row.pair)
        )
      );

      await createRound(7, "split_semifinal", pairings);
      setSuccess("Semifinals generated for Championship and Plate.");
      await load();
    } catch (generateError: unknown) {
      console.error(generateError);
      setError(
        describeError(generateError, "Unable to generate semifinals.")
      );
      setWorking(false);
    }
  }

  async function generateFinals() {
    if (!tournament || !semifinalRound || finalRound) return;

    try {
      setWorking(true);
      setError("");
      setSuccess("");

      if (semifinalRound.status !== "completed") {
        throw new Error("Complete all four semifinals first.");
      }

      const semifinalMatches = matches.filter(
        (match) => match.round_id === semifinalRound.id
      );
      const finalPairings: [FixedPair, FixedPair][] = [];

      for (const pool of ["top", "bottom"] as SplitPool[]) {
        const poolSemis = semifinalMatches.filter((match) => {
          const pair = match.fixed_pair1_id
            ? pairMap.get(match.fixed_pair1_id)
            : undefined;
          return pair?.pool_name === pool;
        });

        const winners = poolSemis
          .map((match) =>
            pairMap.get(
              match.winner_team === 1
                ? match.fixed_pair1_id || ""
                : match.fixed_pair2_id || ""
            )
          )
          .filter(Boolean) as FixedPair[];

        if (winners.length !== 2) {
          throw new Error(
            `${poolLabel(pool)} needs two semifinal winners.`
          );
        }

        finalPairings.push([winners[0], winners[1]]);
      }

      await createRound(8, "split_final", finalPairings);
      setSuccess("Finals generated for the Championship and Plate draws.");
      await load();
    } catch (generateError: unknown) {
      console.error(generateError);
      setError(
        describeError(generateError, "Unable to generate finals.")
      );
      setWorking(false);
    }
  }

  function updateScore(
    matchId: string,
    team: "team1" | "team2",
    value: string
  ) {
    const sanitized = sanitizeScoreInput(value);

    if (sanitized === null) return;

    setScores((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] || { team1: "", team2: "" }),
        [team]: sanitized,
      },
    }));
  }

  async function saveMatch(match: Match, round: Round) {
    if (!tournament) return;

    try {
      setWorking(true);
      setError("");
      setSuccess("");

      const score = scores[match.id];

      if (!score || score.team1 === "" || score.team2 === "") {
        throw new Error("Enter both scores.");
      }

      const team1Score = Number(score.team1);
      const team2Score = Number(score.team2);
      const scoreError = validateCompletedScore(
        team1Score,
        team2Score,
        round.round_type
      );

      if (scoreError) throw new Error(scoreError);

      const winnerTeam = team1Score > team2Score ? 1 : 2;
      const { data: updated, error: updateError } = await supabase
        .from("matches")
        .update({
          team1_score: team1Score,
          team2_score: team2Score,
          winner_team: winnerTeam,
          status: "completed",
        })
        .eq("id", match.id)
        .eq("status", "scheduled")
        .select("id")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated) throw new Error("This match was already saved.");

      if (round.round_type === "pair_round_robin") {
        const pair1Id = match.fixed_pair1_id;
        const pair2Id = match.fixed_pair2_id;

        if (!pair1Id || !pair2Id) {
          throw new Error("Fixed-pair identity is missing.");
        }

        for (const entry of [
          {
            pairId: pair1Id,
            won: winnerTeam === 1,
            pointsFor: team1Score,
            pointsAgainst: team2Score,
          },
          {
            pairId: pair2Id,
            won: winnerTeam === 2,
            pointsFor: team2Score,
            pointsAgainst: team1Score,
          },
        ]) {
          const { data: standing, error: standingError } = await supabase
            .from("fixed_pair_standings")
            .select("*")
            .eq("tournament_id", tournament.id)
            .eq("pair_id", entry.pairId)
            .single();

          if (standingError) throw standingError;

          const { error: standingsUpdateError } = await supabase
            .from("fixed_pair_standings")
            .update({
              matches_played: Number(standing.matches_played) + 1,
              wins: Number(standing.wins) + (entry.won ? 1 : 0),
              losses: Number(standing.losses) + (entry.won ? 0 : 1),
              standing_points:
                Number(standing.standing_points) +
                (entry.won ? PAIR_WIN_POINTS : 0),
              points_for:
                Number(standing.points_for) + entry.pointsFor,
              points_against:
                Number(standing.points_against) +
                entry.pointsAgainst,
            })
            .eq("tournament_id", tournament.id)
            .eq("pair_id", entry.pairId);

          if (standingsUpdateError) throw standingsUpdateError;
        }
      }

      const roundMatches = matches.filter(
        (item) => item.round_id === round.id
      );
      const completedCount = roundMatches.filter(
        (item) => item.status === "completed" || item.id === match.id
      ).length;

      if (completedCount === roundMatches.length) {
        const { error: roundError } = await supabase
          .from("rounds")
          .update({ status: "completed" })
          .eq("id", round.id);

        if (roundError) throw roundError;

        if (round.round_type === "split_final") {
          const { error: tournamentError } = await supabase
            .from("tournaments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", tournament.id);

          if (tournamentError) throw tournamentError;
        }
      }

      setSuccess("Result saved.");
      await load();
    } catch (saveError: unknown) {
      console.error(saveError);
      setError(
        describeError(saveError, "Unable to save the result.")
      );
      setWorking(false);
    }
  }

  const finalResults = useMemo(() => {
    if (!finalRound) return [];

    return matches
      .filter(
        (match) =>
          match.round_id === finalRound.id &&
          (match.winner_team === 1 || match.winner_team === 2)
      )
      .map((match) => {
        const pair1 = match.fixed_pair1_id
          ? pairMap.get(match.fixed_pair1_id)
          : undefined;
        const pair2 = match.fixed_pair2_id
          ? pairMap.get(match.fixed_pair2_id)
          : undefined;
        const champion = match.winner_team === 1 ? pair1 : pair2;
        const runnerUp = match.winner_team === 1 ? pair2 : pair1;

        return {
          pool: champion?.pool_name,
          champion,
          runnerUp,
        };
      });
  }, [finalRound, matches, pairMap]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex justify-end">
            <AppNav />
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            Loading Split Pairs tournament...
          </div>
        </div>
      </main>
    );
  }

  if (!tournament || tournament.format !== "split_pairs") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex justify-end">
            <AppNav links={["history", "format"]} />
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
            <h1 className="text-2xl font-black">Split Pairs Center</h1>
            <p className="mt-3 text-slate-400">
              No Split Pairs tournament is active.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black md:text-3xl">
              🔀 Split Pairs Center
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {tournament.name} · Championship and Plate draws
            </p>
          </div>

          <AppNav links={["standings", "history", "format"]}>
            <button
              onClick={load}
              className="min-h-11 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-800 sm:px-4"
            >
              🔄 Refresh
            </button>
          </AppNav>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300">
            {success}
          </div>
        )}

        {finalResults.length > 0 && (
          <section className="mb-6 grid gap-4 md:grid-cols-2">
            {finalResults.map((result) => (
              <article
                key={result.pool}
                className="rounded-2xl border border-yellow-700 bg-yellow-950/30 p-6 text-center"
              >
                <div className="text-xs font-bold uppercase tracking-widest text-yellow-500">
                  {poolLabel(result.pool || "")} Champions
                </div>
                <h2 className="mt-2 text-2xl font-black text-yellow-400">
                  {(pairPlayers[result.champion?.id || ""] || [])
                    .map((player) => player.name)
                    .join(" + ")}
                </h2>
                <p className="mt-3 text-sm text-slate-400">
                  Runners-up:{" "}
                  {(pairPlayers[result.runnerUp?.id || ""] || [])
                    .map((player) => player.name)
                    .join(" + ")}
                </p>
              </article>
            ))}
          </section>
        )}

        <section className="mb-6 grid gap-4 lg:grid-cols-2">
          {(["top", "bottom"] as SplitPool[]).map((pool) => (
            <article
              key={pool}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <h2 className="text-xl font-black">{poolLabel(pool)}</h2>
              <p className="mt-1 text-xs text-slate-500">
                2 points per win · tie-break: point difference, then
                points scored
              </p>
              <div className="mt-4 space-y-2">
                {standingsByPool[pool].map((row, index) => (
                  <div
                    key={row.pair_id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold">
                        <span className="mr-2 text-emerald-400">
                          {index + 1}.
                        </span>
                        {(pairPlayers[row.pair_id] || [])
                          .map((player) => player.name)
                          .join(" + ")}
                      </div>
                      <div className="shrink-0 font-black text-yellow-400">
                        {row.standing_points} pts
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {row.wins}W {row.losses}L · {row.points_for}-
                      {row.points_against}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        {!roundRobinRound && (
          <section className="mb-6 rounded-2xl border border-emerald-800 bg-emerald-950/20 p-6">
            <h2 className="text-xl font-black">
              Fixed pairs are ready
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Generate 10 matches in each draw. Every pair plays all
              four other pairs.
            </p>
            <button
              onClick={generateRoundRobin}
              disabled={working}
              className="mt-4 rounded-xl bg-emerald-600 px-6 py-3 font-bold hover:bg-emerald-500 disabled:opacity-50"
            >
              Generate Both Round Robins
            </button>
          </section>
        )}

        {roundRobinRound?.status === "completed" && !semifinalRound && (
          <section className="mb-6 rounded-2xl border border-emerald-800 bg-emerald-950/20 p-6">
            <h2 className="text-xl font-black">
              Round robins complete
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Top four in each draw advance: 1 vs 4 and 2 vs 3.
            </p>
            <button
              onClick={generateSemifinals}
              disabled={working}
              className="mt-4 rounded-xl bg-emerald-600 px-6 py-3 font-bold hover:bg-emerald-500 disabled:opacity-50"
            >
              Generate Both Semifinals
            </button>
          </section>
        )}

        {semifinalRound?.status === "completed" && !finalRound && (
          <section className="mb-6 rounded-2xl border border-yellow-700 bg-yellow-950/20 p-6">
            <h2 className="text-xl font-black">
              Semifinals complete
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Generate one final for Championship and one for Plate.
            </p>
            <button
              onClick={generateFinals}
              disabled={working}
              className="mt-4 rounded-xl bg-yellow-500 px-6 py-3 font-black text-slate-950 hover:bg-yellow-400 disabled:opacity-50"
            >
              Generate Both Finals
            </button>
          </section>
        )}

        {rounds.map((round) => {
          const roundMatches = matches.filter(
            (match) => match.round_id === round.id
          );

          return (
            <section key={round.id} className="mb-8">
              <h2 className="mb-1 text-2xl font-black">
                {stageLabel(round.round_type)}
              </h2>
              <p className="mb-4 text-xs text-slate-500">
                {scoreRuleHint(round.round_type)}
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                {roundMatches.map((match) => {
                  const pair1 = match.fixed_pair1_id
                    ? pairMap.get(match.fixed_pair1_id)
                    : undefined;
                  const pair2 = match.fixed_pair2_id
                    ? pairMap.get(match.fixed_pair2_id)
                    : undefined;
                  const score = scores[match.id] || {
                    team1: "",
                    team2: "",
                  };
                  const completed = match.status === "completed";

                  return (
                    <article
                      key={match.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                    >
                      <div className="text-xs uppercase tracking-widest text-slate-500">
                        {poolLabel(pair1?.pool_name || "")} · Match{" "}
                        {match.match_number} · Court{" "}
                        {match.court_number ?? "-"}
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                        <div>
                          <div className="font-bold text-emerald-400">
                            {(pairPlayers[pair1?.id || ""] || [])
                              .map((player) => player.name)
                              .join(" + ")}
                          </div>
                          <input
                            inputMode="numeric"
                            maxLength={2}
                            value={score.team1}
                            disabled={completed}
                            onChange={(event) =>
                              updateScore(
                                match.id,
                                "team1",
                                event.target.value
                              )
                            }
                            className="mt-3 h-12 w-full rounded-lg border border-slate-700 bg-slate-950 text-center text-xl font-black disabled:opacity-60"
                            placeholder="0"
                          />
                        </div>
                        <div className="text-center text-xs text-slate-500">
                          VS
                        </div>
                        <div>
                          <div className="font-bold text-blue-400 sm:text-right">
                            {(pairPlayers[pair2?.id || ""] || [])
                              .map((player) => player.name)
                              .join(" + ")}
                          </div>
                          <input
                            inputMode="numeric"
                            maxLength={2}
                            value={score.team2}
                            disabled={completed}
                            onChange={(event) =>
                              updateScore(
                                match.id,
                                "team2",
                                event.target.value
                              )
                            }
                            className="mt-3 h-12 w-full rounded-lg border border-slate-700 bg-slate-950 text-center text-xl font-black disabled:opacity-60"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      {!completed && (
                        <button
                          onClick={() => saveMatch(match, round)}
                          disabled={working}
                          className="mt-4 min-h-11 w-full rounded-lg bg-emerald-600 px-4 py-2 font-bold hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Save Result
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
