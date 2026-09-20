"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppNav from "@/app/components/AppNav";
import { formatDoublesTeam } from "@/lib/finalResult";
import {
  sanitizeScoreInput,
  scoreRuleHint,
  validateCompletedScore,
} from "@/lib/scoreValidation";

type Tournament = {
  id: string;
  name: string;
  total_players: number;
  preliminary_rounds: number;
  courts: number;
  qualification_count: number;
  status: string;
  format?: string;
};

type Player = {
  id: string;
  tournament_id: string;
  name: string;
  seed?: number | null;
  active?: boolean;
};

type Round = {
  id: string;
  tournament_id: string;
  round_number: number;
  round_type: "preliminary" | "quarterfinal" | "semifinal" | "final";
  status: "pending" | "generated" | "in_progress" | "completed";
  created_at?: string;
};

type Match = {
  id: string;
  round_id: string;
  court_number: number | null;
  match_number: number;
  team1_score: number | null;
  team2_score: number | null;
  winner_team: number | null;
  status: "scheduled" | "in_progress" | "completed";
  created_at?: string;
};

type MatchPlayer = {
  id: string;
  match_id: string;
  player_id: string;
  team_number: number;
};

type Standing = {
  tournament_id: string;
  player_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  tournament_points: number;
  rank: number | null;
};

type ScoreInput = {
  team1: string;
  team2: string;
};

type MatchView = Match & {
  team1Players: Player[];
  team2Players: Player[];
};

const roundTypeLabel: Record<Round["round_type"], string> = {
  preliminary: "Preliminary",
  quarterfinal: "Quarterfinals",
  semifinal: "Semifinals",
  final: "Final",
};

function formatPoints(value: number | null | undefined) {
  return Number(value || 0).toFixed(1).replace(".0", "");
}

function getRoundTitle(round: Round | null) {
  if (!round) return "No Round";

  if (round.round_type === "preliminary") {
    return `Round ${round.round_number}`;
  }

  return roundTypeLabel[round.round_type];
}

function getStageDescription(
  round: Round | null,
  tournament: Tournament | null
) {
  if (!round || !tournament) return "";

  if (round.round_type === "preliminary") {
    return `Preliminary ${round.round_number} of ${tournament.preliminary_rounds}`;
  }

  if (round.round_type === "quarterfinal") {
    return "Top 16 Knockout";
  }

  if (round.round_type === "semifinal") {
    return "Top 8 Knockout";
  }

  return "Championship Match";
}

export default function ControlCenterPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);

  const [scoreInputs, setScoreInputs] = useState<
    Record<string, ScoreInput>
  >({});

  const [loading, setLoading] = useState(true);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadControlCenter = useCallback(async () => {
    try {
      setError("");

      const activeTournamentId =
        typeof window !== "undefined"
          ? localStorage.getItem("activeTournamentId")
          : null;

      if (!activeTournamentId) {
        setTournament(null);
        setPlayers([]);
        setRounds([]);
        setCurrentRound(null);
        setMatches([]);
        setStandings([]);
        return;
      }

      const { data: tournamentData, error: tournamentError } =
        await supabase
          .from("tournaments")
          .select("*")
          .eq("id", activeTournamentId)
          .single();

      if (tournamentError) {
        throw tournamentError;
      }

      if (tournamentData.format === "team_groups") {
        window.location.href = "/team-center";
        return;
      }

      setTournament(tournamentData);

      const [
        playersResponse,
        roundsResponse,
        standingsResponse,
      ] = await Promise.all([
        supabase
          .from("players")
          .select("*")
          .eq("tournament_id", activeTournamentId)
          .order("name", { ascending: true }),

        supabase
          .from("rounds")
          .select("*")
          .eq("tournament_id", activeTournamentId)
          .order("round_number", { ascending: true }),

        supabase
          .from("player_standings")
          .select("*")
          .eq("tournament_id", activeTournamentId),
      ]);

      if (playersResponse.error) {
        throw playersResponse.error;
      }

      if (roundsResponse.error) {
        throw roundsResponse.error;
      }

      if (standingsResponse.error) {
        throw standingsResponse.error;
      }

      const loadedPlayers = (playersResponse.data || []) as Player[];
      const loadedRounds = (roundsResponse.data || []) as Round[];
      const loadedStandings = (standingsResponse.data || []) as Standing[];

      setPlayers(loadedPlayers);
      setRounds(loadedRounds);
      setStandings(loadedStandings);

      if (loadedRounds.length === 0) {
        setCurrentRound(null);
        setMatches([]);
        return;
      }

      /*
       * Prefer the latest non-completed round.
       * If everything is completed, use the latest completed round.
       */
      const activeRound =
        [...loadedRounds]
          .reverse()
          .find(
            (round) =>
              round.status === "in_progress" ||
              round.status === "generated"
          ) ||
        [...loadedRounds].reverse()[0];

      setCurrentRound(activeRound);

      const { data: matchData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .eq("round_id", activeRound.id)
        .order("match_number", { ascending: true });

      if (matchesError) {
        throw matchesError;
      }

      const loadedMatches = (matchData || []) as Match[];

      if (loadedMatches.length === 0) {
        setMatches([]);
        return;
      }

      const matchIds = loadedMatches.map((match) => match.id);

      const { data: matchPlayerData, error: matchPlayersError } =
        await supabase
          .from("match_players")
          .select("*")
          .in("match_id", matchIds);

      if (matchPlayersError) {
        throw matchPlayersError;
      }

      const loadedMatchPlayers = (matchPlayerData ||
        []) as MatchPlayer[];

      const playerMap = new Map(
        loadedPlayers.map((player) => [player.id, player])
      );

      const enrichedMatches: MatchView[] = loadedMatches.map((match) => {
        const matchPlayers = loadedMatchPlayers.filter(
          (mp) => mp.match_id === match.id
        );

        const team1Players = matchPlayers
          .filter((mp) => mp.team_number === 1)
          .map((mp) => playerMap.get(mp.player_id))
          .filter(Boolean) as Player[];

        const team2Players = matchPlayers
          .filter((mp) => mp.team_number === 2)
          .map((mp) => playerMap.get(mp.player_id))
          .filter(Boolean) as Player[];

        return {
          ...match,
          team1Players,
          team2Players,
        };
      });

      setMatches(enrichedMatches);

      const initialScores: Record<string, ScoreInput> = {};

      enrichedMatches.forEach((match) => {
        initialScores[match.id] = {
          team1:
            match.team1_score !== null
              ? String(match.team1_score)
              : "",
          team2:
            match.team2_score !== null
              ? String(match.team2_score)
              : "",
        };
      });

      setScoreInputs(initialScores);
    } catch (err: any) {
      console.error("Control center load error:", err);
      setError(
        err?.message ||
          "Unable to load the tournament control center."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadControlCenter();

    const interval = setInterval(() => {
      loadControlCenter();
    }, 15000);

    return () => clearInterval(interval);
  }, [loadControlCenter]);

  const standingsWithPlayers = useMemo(() => {
    const playerMap = new Map(
      players.map((player) => [player.id, player])
    );

    return standings
      .map((standing) => ({
        ...standing,
        player: playerMap.get(standing.player_id),
        pointDifference:
          Number(standing.points_for || 0) -
          Number(standing.points_against || 0),
      }))
      .filter((row) => row.player)
      .sort((a, b) => {
        if (
          Number(b.tournament_points) !==
          Number(a.tournament_points)
        ) {
          return (
            Number(b.tournament_points) -
            Number(a.tournament_points)
          );
        }

        if (b.wins !== a.wins) {
          return b.wins - a.wins;
        }

        if (b.pointDifference !== a.pointDifference) {
          return b.pointDifference - a.pointDifference;
        }

        return (
          Number(b.points_for || 0) -
          Number(a.points_for || 0)
        );
      });
  }, [players, standings]);

  const completedMatches = useMemo(
    () =>
      matches.filter(
        (match) =>
          match.status === "completed" ||
          match.winner_team !== null
      ),
    [matches]
  );

  const pendingMatches = useMemo(
    () =>
      matches.filter(
        (match) =>
          match.status !== "completed" &&
          match.winner_team === null
      ),
    [matches]
  );

  const matchesByCourt = useMemo(() => {
    const grouped: Record<number, MatchView[]> = {};

    matches.forEach((match) => {
      const court = match.court_number || 1;

      if (!grouped[court]) {
        grouped[court] = [];
      }

      grouped[court].push(match);
    });

    Object.keys(grouped).forEach((court) => {
      grouped[Number(court)].sort(
        (a, b) => a.match_number - b.match_number
      );
    });

    return grouped;
  }, [matches]);

  const progress = useMemo(() => {
    if (!currentRound || matches.length === 0) return 0;

    return Math.round(
      (completedMatches.length / matches.length) * 100
    );
  }, [currentRound, matches.length, completedMatches.length]);

  const tournamentProgress = useMemo(() => {
    if (!tournament) return 0;

    const completedRounds = rounds.filter(
      (round) => round.status === "completed"
    ).length;

    if (rounds.length === 0) return 0;

    return Math.round(
      (completedRounds / rounds.length) * 100
    );
  }, [tournament, rounds]);

  const allCurrentMatchesCompleted =
    matches.length > 0 &&
    matches.every(
      (match) =>
        match.status === "completed" ||
        match.winner_team !== null
    );

  const isFinalCompleted =
    currentRound?.round_type === "final" &&
    currentRound.status === "completed";

  const isTournamentCompleted =
    tournament?.status === "completed" || isFinalCompleted;

  const finalTeams = useMemo(() => {
    if (!isTournamentCompleted) {
      return null;
    }

    const finalMatch = matches.find(
      (match) =>
        match.winner_team === 1 || match.winner_team === 2
    );

    if (!finalMatch?.winner_team) {
      return null;
    }

    return {
      champions:
        finalMatch.winner_team === 1
          ? finalMatch.team1Players
          : finalMatch.team2Players,
      runnersUp:
        finalMatch.winner_team === 1
          ? finalMatch.team2Players
          : finalMatch.team1Players,
    };
  }, [isTournamentCompleted, matches]);

  const updateScoreInput = (
    matchId: string,
    team: "team1" | "team2",
    value: string
  ) => {
    const sanitized = sanitizeScoreInput(value);

    if (sanitized === null) {
      return;
    }

    setScoreInputs((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] || {
          team1: "",
          team2: "",
        }),
        [team]: sanitized,
      },
    }));
  };

  const saveMatchResult = async (match: MatchView) => {
    try {
      setSavingMatchId(match.id);
      setError("");
      setSuccess("");

      const score = scoreInputs[match.id];

      if (!score) {
        throw new Error("Enter both scores.");
      }

      if (
        score.team1 === "" ||
        score.team2 === ""
      ) {
        throw new Error("Enter both scores.");
      }

      const team1Score = Number(score.team1);
      const team2Score = Number(score.team2);

      const scoreError = validateCompletedScore(
        team1Score,
        team2Score,
        currentRound?.round_type
      );

      if (scoreError) {
        throw new Error(scoreError);
      }

      if (
        match.team1Players.length !== 2 ||
        match.team2Players.length !== 2
      ) {
        throw new Error(
          "Each match must have exactly two players per team."
        );
      }

      const winnerTeam = team1Score > team2Score ? 1 : 2;

      /*
       * Your scoring rule:
       *
       * Winning player:
       * winning score / 2
       *
       * Losing player:
       * losing score / 2
       *
       * Example:
       * 21 - 12
       * Winners = 10.5 each
       * Losers  = 6 each
       */

      const winningScore =
        winnerTeam === 1 ? team1Score : team2Score;

      const losingScore =
        winnerTeam === 1 ? team2Score : team1Score;

      const winnerPoints = winningScore / 2;
      const loserPoints = losingScore / 2;

      /*
       * Protect against double scoring.
       */
      if (match.status === "completed") {
        throw new Error("This match has already been completed.");
      }

      const { data: updatedMatch, error: matchUpdateError } =
        await supabase
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

      if (matchUpdateError) {
        throw matchUpdateError;
      }

      if (!updatedMatch) {
        throw new Error(
          "This match was already updated. Refresh the page."
        );
      }

      const team1Winner = winnerTeam === 1;

      const team1Players = match.team1Players;
      const team2Players = match.team2Players;

      for (const player of team1Players) {
        const isWinner = team1Winner;

        const points = isWinner ? winnerPoints : loserPoints;

        const { data: existingStanding, error: standingFetchError } =
          await supabase
            .from("player_standings")
            .select("*")
            .eq("tournament_id", tournament!.id)
            .eq("player_id", player.id)
            .single();

        if (standingFetchError) {
          throw standingFetchError;
        }

        const { error: standingUpdateError } = await supabase
          .from("player_standings")
          .update({
            matches_played:
              Number(existingStanding.matches_played || 0) + 1,
            wins:
              Number(existingStanding.wins || 0) +
              (isWinner ? 1 : 0),
            losses:
              Number(existingStanding.losses || 0) +
              (isWinner ? 0 : 1),
            points_for:
              Number(existingStanding.points_for || 0) +
              team1Score / 2,
            points_against:
              Number(existingStanding.points_against || 0) +
              team2Score / 2,
            tournament_points:
              Number(existingStanding.tournament_points || 0) +
              points,
          })
          .eq("tournament_id", tournament!.id)
          .eq("player_id", player.id);

        if (standingUpdateError) {
          throw standingUpdateError;
        }
      }

      for (const player of team2Players) {
        const isWinner = !team1Winner;

        const points = isWinner ? winnerPoints : loserPoints;

        const { data: existingStanding, error: standingFetchError } =
          await supabase
            .from("player_standings")
            .select("*")
            .eq("tournament_id", tournament!.id)
            .eq("player_id", player.id)
            .single();

        if (standingFetchError) {
          throw standingFetchError;
        }

        const { error: standingUpdateError } = await supabase
          .from("player_standings")
          .update({
            matches_played:
              Number(existingStanding.matches_played || 0) + 1,
            wins:
              Number(existingStanding.wins || 0) +
              (isWinner ? 1 : 0),
            losses:
              Number(existingStanding.losses || 0) +
              (isWinner ? 0 : 1),
            points_for:
              Number(existingStanding.points_for || 0) +
              team2Score / 2,
            points_against:
              Number(existingStanding.points_against || 0) +
              team1Score / 2,
            tournament_points:
              Number(existingStanding.tournament_points || 0) +
              points,
          })
          .eq("tournament_id", tournament!.id)
          .eq("player_id", player.id);

        if (standingUpdateError) {
          throw standingUpdateError;
        }
      }

      /*
       * Check whether every match in the current round is now complete.
       */
      const { data: roundMatches, error: roundMatchesError } =
        await supabase
          .from("matches")
          .select("id, status, winner_team")
          .eq("round_id", match.round_id);

      if (roundMatchesError) {
        throw roundMatchesError;
      }

      const roundComplete =
        (roundMatches || []).length > 0 &&
        (roundMatches || []).every(
          (item) =>
            item.status === "completed" ||
            item.winner_team !== null
        );

      if (roundComplete) {
        const { error: roundUpdateError } = await supabase
          .from("rounds")
          .update({
            status: "completed",
          })
          .eq("id", match.round_id);

        if (roundUpdateError) {
          throw roundUpdateError;
        }

        /*
         * If this was the Final, mark tournament completed.
         */
        if (currentRound?.round_type === "final") {
          const { error: tournamentUpdateError } = await supabase
            .from("tournaments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", tournament!.id);

          if (tournamentUpdateError) {
            throw tournamentUpdateError;
          }
        }
      }

      setSuccess(
        roundComplete
          ? "Match saved. Round completed!"
          : "Match result saved successfully."
      );

      await loadControlCenter();
    } catch (err: any) {
      console.error("Save match error:", err);

      setError(
        err?.message ||
          "Unable to save the match result."
      );
    } finally {
      setSavingMatchId(null);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setSuccess("");
    await loadControlCenter();
  };

  const goHome = () => {
    window.location.href = "/";
  };

  const goLeaderboard = () => {
    window.location.href = "/leaderboard";
  };

  const goNewTournament = () => {
    localStorage.removeItem("activeTournamentId");
    window.location.href = "/";
  };

  const goTournamentHistory = () => {
    window.location.href = "/tournaments";
  };

  const goGenerateNextRound = () => {
    /*
     * The existing tournament page owns the round-generation engine.
     * Send the organizer back there after completing the current round.
     *
     * Your existing app/page.tsx will display the next-round controls.
     */
    window.location.href = "/";
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex justify-end">
            <AppNav />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
            <div className="text-4xl">🏸</div>
            <h1 className="mt-4 text-2xl font-bold">
              Loading Tournament Control Center...
            </h1>
            <p className="mt-2 text-slate-400">
              Connecting to your tournament.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
            <div className="text-5xl">🏸</div>

            <h1 className="mt-5 text-3xl font-bold">
              Tournament Control Center
            </h1>

            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              No active tournament was found. Create or resume a
              tournament from the home page.
            </p>

            <button
              onClick={goHome}
              className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white transition hover:bg-emerald-500"
            >
              🏠 Go to Tournament Home
            </button>

            <button
              onClick={goTournamentHistory}
              className="mt-3 rounded-xl border border-slate-700 px-6 py-3 font-bold transition hover:bg-slate-800"
            >
              📋 Tournament History
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-6">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <header className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-4xl">🏸</span>

                <div>
                  <h1 className="text-2xl font-black md:text-3xl">
                    Tournament Control Center
                  </h1>

                  <p className="mt-1 text-sm text-slate-400">
                    {tournament.name}
                  </p>
                </div>
              </div>
            </div>

            <AppNav links={["leaderboard", "history", "format"]}>
              <button
                onClick={refresh}
                disabled={refreshing}
                className="min-h-11 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold transition hover:bg-slate-800 disabled:opacity-50 sm:px-4"
              >
                {refreshing ? "Refreshing..." : "🔄 Refresh"}
              </button>
            </AppNav>
          </div>
        </header>

        {/* ERROR / SUCCESS */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-300">
            <div className="font-bold">❌ Error</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300">
            <div className="font-bold">✅ {success}</div>
          </div>
        )}

        {/* TOURNAMENT SUMMARY */}
        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Players
            </div>
            <div className="mt-1 text-2xl font-black">
              {tournament.total_players}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Courts
            </div>
            <div className="mt-1 text-2xl font-black">
              {tournament.courts}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Preliminary Rounds
            </div>
            <div className="mt-1 text-2xl font-black">
              {tournament.preliminary_rounds}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Qualification
            </div>
            <div className="mt-1 text-2xl font-black">
              Top {tournament.qualification_count}
            </div>
          </div>
        </section>

        {/* TOURNAMENT STATUS */}
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Tournament Status
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black">
                  {isTournamentCompleted
                    ? "🏆 Tournament Complete"
                    : currentRound
                    ? getRoundTitle(currentRound)
                    : "Ready"}
                </h2>

                {currentRound && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      currentRound.status === "completed"
                        ? "bg-emerald-950 text-emerald-400"
                        : "bg-blue-950 text-blue-400"
                    }`}
                  >
                    {currentRound.status.toUpperCase()}
                  </span>
                )}
              </div>

              {currentRound && (
                <p className="mt-1 text-sm text-slate-400">
                  {getStageDescription(
                    currentRound,
                    tournament
                  )}
                </p>
              )}
            </div>

            <div className="min-w-[220px]">
              <div className="mb-2 flex justify-between text-xs text-slate-400">
                <span>Tournament Progress</span>
                <span>{tournamentProgress}%</span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${tournamentProgress}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* CURRENT ROUND */}
        {currentRound && (
          <section className="mb-8">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  Current Stage
                </div>

                <h2 className="text-2xl font-black">
                  {getRoundTitle(currentRound)}
                </h2>

                <p className="text-sm text-slate-400">
                  {getStageDescription(
                    currentRound,
                    tournament
                  )}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {scoreRuleHint(currentRound.round_type)}
                </p>
              </div>

              <div className="min-w-[220px]">
                <div className="mb-2 flex justify-between text-xs text-slate-400">
                  <span>
                    {completedMatches.length} /{" "}
                    {matches.length} matches
                  </span>

                  <span>{progress}%</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* COURTS */}
            <div className="grid gap-5 lg:grid-cols-3">
              {Array.from(
                {
                  length: tournament.courts,
                },
                (_, index) => index + 1
              ).map((courtNumber) => {
                const courtMatches =
                  matchesByCourt[courtNumber] || [];

                return (
                  <div
                    key={courtNumber}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-slate-500">
                          Court
                        </div>

                        <div className="text-xl font-black">
                          {courtNumber}
                        </div>
                      </div>

                      <div className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-400">
                        {courtMatches.length} match
                        {courtMatches.length === 1
                          ? ""
                          : "es"}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {courtMatches.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">
                          No matches scheduled
                        </div>
                      )}

                      {courtMatches.map((match) => {
                        const score =
                          scoreInputs[match.id] || {
                            team1: "",
                            team2: "",
                          };

                        const completed =
                          match.status === "completed" ||
                          match.winner_team !== null;

                        const team1Winner =
                          match.winner_team === 1;

                        const team2Winner =
                          match.winner_team === 2;

                        return (
                          <div
                            key={match.id}
                            className={`rounded-xl border p-4 ${
                              completed
                                ? "border-emerald-900 bg-emerald-950/20"
                                : "border-slate-700 bg-slate-950"
                            }`}
                          >
                            <div className="mb-4 flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Match {match.match_number}
                              </span>

                              {completed ? (
                                <span className="rounded-full bg-emerald-950 px-2 py-1 text-[10px] font-bold text-emerald-400">
                                  COMPLETED
                                </span>
                              ) : (
                                <span className="rounded-full bg-blue-950 px-2 py-1 text-[10px] font-bold text-blue-400">
                                  OPEN
                                </span>
                              )}
                            </div>

                            {/* TEAM 1 */}
                            <div
                              className={`rounded-lg p-3 ${
                                team1Winner
                                  ? "bg-emerald-950/50 ring-1 ring-emerald-700"
                                  : "bg-slate-900"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    Team 1
                                  </div>

                                  <div className="mt-1 text-sm font-bold">
                                    {match.team1Players
                                      .map(
                                        (player) =>
                                          player.name
                                      )
                                      .join(" + ")}
                                  </div>
                                </div>

                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  value={score.team1}
                                  disabled={completed}
                                  onChange={(event) =>
                                    updateScoreInput(
                                      match.id,
                                      "team1",
                                      event.target.value
                                    )
                                  }
                                  className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-center text-xl font-black outline-none focus:border-emerald-500 disabled:opacity-60"
                                  placeholder="0"
                                />
                              </div>
                            </div>

                            <div className="py-2 text-center text-xs font-bold text-slate-600">
                              VS
                            </div>

                            {/* TEAM 2 */}
                            <div
                              className={`rounded-lg p-3 ${
                                team2Winner
                                  ? "bg-emerald-950/50 ring-1 ring-emerald-700"
                                  : "bg-slate-900"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    Team 2
                                  </div>

                                  <div className="mt-1 text-sm font-bold">
                                    {match.team2Players
                                      .map(
                                        (player) =>
                                          player.name
                                      )
                                      .join(" + ")}
                                  </div>
                                </div>

                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  value={score.team2}
                                  disabled={completed}
                                  onChange={(event) =>
                                    updateScoreInput(
                                      match.id,
                                      "team2",
                                      event.target.value
                                    )
                                  }
                                  className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-center text-xl font-black outline-none focus:border-emerald-500 disabled:opacity-60"
                                  placeholder="0"
                                />
                              </div>
                            </div>

                            {!completed && (
                              <button
                                onClick={() =>
                                  saveMatchResult(match)
                                }
                                disabled={
                                  savingMatchId === match.id
                                }
                                className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {savingMatchId === match.id
                                  ? "Saving..."
                                  : "Save Score"}
                              </button>
                            )}

                            {completed && (
                              <div className="mt-4 text-center text-xs text-slate-500">
                                {match.team1_score} -{" "}
                                {match.team2_score}
                                {match.winner_team && (
                                  <span className="ml-2 text-emerald-400">
                                    • Team{" "}
                                    {match.winner_team} wins
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ROUND COMPLETE */}
        {currentRound &&
          allCurrentMatchesCompleted &&
          currentRound.status === "completed" &&
          !isTournamentCompleted && (
            <section className="mb-8 rounded-2xl border border-emerald-800 bg-emerald-950/30 p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-bold uppercase tracking-widest text-emerald-400">
                    Round Complete
                  </div>

                  <h2 className="mt-1 text-2xl font-black">
                    {getRoundTitle(currentRound)} completed
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    All matches have been completed. Continue
                    to the next stage from the tournament page.
                  </p>
                </div>

                <button
                  onClick={goGenerateNextRound}
                  className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white transition hover:bg-emerald-500"
                >
                  ➡️ Generate Next Round
                </button>
              </div>
            </section>
          )}

        {/* FINAL COMPLETED */}
        {isTournamentCompleted && (
          <section className="mb-8 overflow-hidden rounded-2xl border border-yellow-700 bg-gradient-to-br from-yellow-950/50 to-slate-950 p-8 text-center">
            <div className="text-6xl">🏆</div>

            <h2 className="mt-4 text-3xl font-black text-yellow-400">
              Tournament Complete!
            </h2>

            {finalTeams && (
              <div className="mx-auto mt-6 grid max-w-3xl gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-yellow-700 bg-yellow-950/30 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-yellow-500">
                    Champions
                  </div>
                  <div className="mt-2 text-lg font-black text-yellow-300">
                    {formatDoublesTeam(finalTeams.champions)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-600 bg-slate-900/70 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-300">
                    Runners Up
                  </div>
                  <div className="mt-2 text-lg font-black text-slate-100">
                    {formatDoublesTeam(finalTeams.runnersUp)}
                  </div>
                </div>
              </div>
            )}

            <p className="mt-2 text-slate-300">
              The Final has been completed.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={goLeaderboard}
                className="rounded-xl bg-yellow-500 px-6 py-3 font-black text-slate-950 transition hover:bg-yellow-400"
              >
                📊 View Final Leaderboard
              </button>

              <button
                onClick={goTournamentHistory}
                className="rounded-xl border border-slate-700 px-6 py-3 font-bold transition hover:bg-slate-800"
              >
                📋 Tournament History
              </button>

              <button
                onClick={goNewTournament}
                className="rounded-xl border border-emerald-700 px-6 py-3 font-bold text-emerald-400 transition hover:bg-emerald-950"
              >
                ➕ New Tournament
              </button>
            </div>
          </section>
        )}

        {/* LEADERBOARD PREVIEW */}
        <section className="mb-8">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Standings
              </div>

              <h2 className="text-2xl font-black">
                Current Leaderboard
              </h2>

              <p className="text-sm text-slate-400">
                Ranked by tournament points, wins and point
                differential.
              </p>
            </div>

            <button
              onClick={goLeaderboard}
              className="text-sm font-bold text-emerald-400 hover:text-emerald-300"
            >
              View Full Leaderboard →
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3 text-center">
                      MP
                    </th>
                    <th className="px-4 py-3 text-center">
                      W
                    </th>
                    <th className="px-4 py-3 text-center">
                      L
                    </th>
                    <th className="px-4 py-3 text-center">
                      PF
                    </th>
                    <th className="px-4 py-3 text-center">
                      PA
                    </th>
                    <th className="px-4 py-3 text-center">
                      Diff
                    </th>
                    <th className="px-4 py-3 text-right">
                      Points
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {standingsWithPlayers
                    .slice(0, 16)
                    .map((row, index) => {
                      const rank = index + 1;

                      return (
                        <tr
                          key={row.player_id}
                          className={`border-b border-slate-800 last:border-0 ${
                            rank <=
                            tournament.qualification_count
                              ? "bg-emerald-950/10"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-black">
                                {rank === 1
                                  ? "🥇"
                                  : rank === 2
                                  ? "🥈"
                                  : rank === 3
                                  ? "🥉"
                                  : rank}
                              </span>

                              {rank <=
                                tournament.qualification_count && (
                                <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                                  TOP 16
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-bold">
                            {row.player?.name}
                          </td>

                          <td className="px-4 py-3 text-center text-slate-400">
                            {row.matches_played}
                          </td>

                          <td className="px-4 py-3 text-center text-emerald-400">
                            {row.wins}
                          </td>

                          <td className="px-4 py-3 text-center text-red-400">
                            {row.losses}
                          </td>

                          <td className="px-4 py-3 text-center">
                            {formatPoints(row.points_for)}
                          </td>

                          <td className="px-4 py-3 text-center">
                            {formatPoints(
                              row.points_against
                            )}
                          </td>

                          <td
                            className={`px-4 py-3 text-center font-semibold ${
                              row.pointDifference >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {row.pointDifference > 0
                              ? "+"
                              : ""}
                            {formatPoints(
                              row.pointDifference
                            )}
                          </td>

                          <td className="px-4 py-3 text-right text-base font-black text-emerald-400">
                            {formatPoints(
                              row.tournament_points
                            )}
                          </td>
                        </tr>
                      );
                    })}

                  {standingsWithPlayers.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No standings available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* QUALIFICATION / KNOCKOUT STATUS */}
        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div
            className={`rounded-2xl border p-5 ${
              rounds.some(
                (round) =>
                  round.round_type === "preliminary" &&
                  round.status === "completed"
              )
                ? "border-emerald-800 bg-emerald-950/20"
                : "border-slate-800 bg-slate-900"
            }`}
          >
            <div className="text-3xl">🏸</div>

            <h3 className="mt-3 font-black">
              Preliminary Rounds
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              {rounds.filter(
                (round) =>
                  round.round_type === "preliminary" &&
                  round.status === "completed"
              ).length}{" "}
              of {tournament.preliminary_rounds} completed
            </p>
          </div>

          <div
            className={`rounded-2xl border p-5 ${
              rounds.some(
                (round) =>
                  round.round_type === "quarterfinal" &&
                  round.status === "completed"
              )
                ? "border-emerald-800 bg-emerald-950/20"
                : "border-slate-800 bg-slate-900"
            }`}
          >
            <div className="text-3xl">⚡</div>

            <h3 className="mt-3 font-black">
              Quarterfinals
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              Top {tournament.qualification_count} players
            </p>

            {rounds.some(
              (round) =>
                round.round_type === "quarterfinal"
            ) && (
              <div className="mt-2 text-xs font-bold text-emerald-400">
                ✓ Generated
              </div>
            )}
          </div>

          <div
            className={`rounded-2xl border p-5 ${
              rounds.some(
                (round) =>
                  round.round_type === "final" &&
                  round.status === "completed"
              )
                ? "border-yellow-700 bg-yellow-950/20"
                : "border-slate-800 bg-slate-900"
            }`}
          >
            <div className="text-3xl">🏆</div>

            <h3 className="mt-3 font-black">
              Championship
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              Semifinals → Final
            </p>

            {isTournamentCompleted && (
              <div className="mt-2 text-xs font-bold text-yellow-400">
                ✓ Champion decided
              </div>
            )}
          </div>
        </section>

        {/* BOTTOM NAV */}
        <footer className="border-t border-slate-800 py-8">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={goHome}
              className="rounded-lg border border-slate-700 px-5 py-2 text-sm font-bold transition hover:bg-slate-800"
            >
              🏠 Tournament Home
            </button>

            <button
              onClick={goLeaderboard}
              className="rounded-lg border border-emerald-700 px-5 py-2 text-sm font-bold text-emerald-400 transition hover:bg-emerald-950"
            >
              📊 Full Leaderboard
            </button>

            <button
              onClick={goTournamentHistory}
              className="rounded-lg border border-slate-700 px-5 py-2 text-sm font-bold transition hover:bg-slate-800"
            >
              📋 Tournament History
            </button>

            <button
              onClick={refresh}
              className="rounded-lg border border-slate-700 px-5 py-2 text-sm font-bold transition hover:bg-slate-800"
            >
              🔄 Refresh
            </button>
          </div>

          <div className="mt-4 text-center text-xs text-slate-600">
            Baddy Smash Control Center
          </div>
        </footer>
      </div>
    </main>
  );
}