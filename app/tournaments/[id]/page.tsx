"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { deleteTournament } from "@/lib/deleteTournament";
import {
  formatDoublesTeam,
  getDoublesFinalResult,
} from "@/lib/finalResult";

type Tournament = {
  id: string;
  name: string;
  total_players: number;
  preliminary_rounds: number;
  courts: number;
  qualification_count: number;
  status: string;
  created_at: string;
  completed_at: string | null;
};

type Player = {
  id: string;
  name: string;
};

type Standing = {
  player_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  tournament_points: number;
};

type Round = {
  id: string;
  round_number: number;
  round_type: string;
  status: string;
};

type Match = {
  id: string;
  round_id: string;
  court_number: number | null;
  match_number: number;
  team1_score: number | null;
  team2_score: number | null;
  winner_team: number | null;
};

type MatchPlayer = {
  match_id: string;
  player_id: string;
  team_number: number;
};

function points(value: number | null | undefined) {
  return Number(value || 0)
    .toFixed(1)
    .replace(".0", "");
}

function roundName(round: Round) {
  if (round.round_type === "preliminary") {
    return `Round ${round.round_number}`;
  }

  if (round.round_type === "quarterfinal") {
    return "Quarterfinals";
  }

  if (round.round_type === "semifinal") {
    return "Semifinals";
  }

  if (round.round_type === "final") {
    return "Final";
  }

  return round.round_type;
}

export default function HistoricalTournamentPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] =
    useState<Tournament | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchPlayers, setMatchPlayers] = useState<
    MatchPlayer[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const loadTournament = async () => {
      try {
        setLoading(true);

        const [
          tournamentResponse,
          playersResponse,
          standingsResponse,
          roundsResponse,
        ] = await Promise.all([
          supabase
            .from("tournaments")
            .select("*")
            .eq("id", tournamentId)
            .single(),

          supabase
            .from("players")
            .select("id,name")
            .eq("tournament_id", tournamentId)
            .order("name"),

          supabase
            .from("player_standings")
            .select("*")
            .eq("tournament_id", tournamentId),

          supabase
            .from("rounds")
            .select("*")
            .eq("tournament_id", tournamentId)
            .order("round_number"),
        ]);

        if (tournamentResponse.error) {
          throw tournamentResponse.error;
        }

        if (playersResponse.error) {
          throw playersResponse.error;
        }

        if (standingsResponse.error) {
          throw standingsResponse.error;
        }

        if (roundsResponse.error) {
          throw roundsResponse.error;
        }

        const loadedRounds =
          (roundsResponse.data || []) as Round[];

        setTournament(
          tournamentResponse.data as Tournament
        );

        setPlayers((playersResponse.data || []) as Player[]);
        setStandings(
          (standingsResponse.data || []) as Standing[]
        );
        setRounds(loadedRounds);

        if (loadedRounds.length > 0) {
          const roundIds = loadedRounds.map(
            (round) => round.id
          );

          const { data: matchData, error: matchError } =
            await supabase
              .from("matches")
              .select("*")
              .in("round_id", roundIds)
              .order("match_number");

          if (matchError) {
            throw matchError;
          }

          const loadedMatches =
            (matchData || []) as Match[];

          setMatches(loadedMatches);

          if (loadedMatches.length > 0) {
            const matchIds = loadedMatches.map(
              (match) => match.id
            );

            const {
              data: matchPlayerData,
              error: matchPlayerError,
            } = await supabase
              .from("match_players")
              .select("*")
              .in("match_id", matchIds);

            if (matchPlayerError) {
              throw matchPlayerError;
            }

            setMatchPlayers(
              (matchPlayerData || []) as MatchPlayer[]
            );
          }
        }
      } catch (err: unknown) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load tournament history."
        );
      } finally {
        setLoading(false);
      }
    };

    if (tournamentId) {
      loadTournament();
    }
  }, [tournamentId]);

  const playerMap = useMemo(
    () =>
      new Map(
        players.map((player) => [player.id, player])
      ),
    [players]
  );

  const leaderboard = useMemo(() => {
    return standings
      .map((standing) => {
        const pointDifference =
          Number(standing.points_for || 0) -
          Number(standing.points_against || 0);

        return {
          ...standing,
          player: playerMap.get(standing.player_id),
          pointDifference,
        };
      })
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
          Number(b.points_for) -
          Number(a.points_for)
        );
      });
  }, [standings, playerMap]);

  const finalResult = useMemo(
    () =>
      getDoublesFinalResult(
        rounds,
        matches,
        matchPlayers,
        playerMap
      ),
    [rounds, matches, matchPlayers, playerMap]
  );

  const goHistory = () => {
    window.location.href = "/tournaments";
  };

  const goFormat = () => {
    window.location.href = "/format";
  };

  const goHome = () => {
    localStorage.removeItem("activeTournamentId");
    window.location.href = "/";
  };

  const removeTournament = async () => {
    if (!tournament) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${tournament.name}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      await deleteTournament(tournament.id);
      window.location.href = "/tournaments";
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete this tournament."
      );
      setDeleting(false);
    }
  };

  const openLeaderboard = () => {
    localStorage.setItem(
      "activeTournamentId",
      tournamentId
    );

    window.location.href = "/leaderboard";
  };

  const getPlayersForMatch = (matchId: string) => {
    const entries = matchPlayers.filter(
      (mp) => mp.match_id === matchId
    );

    return {
      team1: entries
        .filter((entry) => entry.team_number === 1)
        .map((entry) => playerMap.get(entry.player_id))
        .filter(Boolean) as Player[],

      team2: entries
        .filter((entry) => entry.team_number === 2)
        .map((entry) => playerMap.get(entry.player_id))
        .filter(Boolean) as Player[],
    };
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
          <div className="text-4xl">🏸</div>
          <div className="mt-4 font-bold">
            Loading tournament...
          </div>
        </div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-900 bg-slate-900 p-8 text-center">
          <div className="text-4xl">❌</div>

          <h1 className="mt-4 text-2xl font-black">
            Tournament Not Found
          </h1>

          <p className="mt-2 text-sm text-red-300">
            {error || "This tournament does not exist."}
          </p>

          <button
            onClick={goHistory}
            className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 font-bold hover:bg-emerald-500"
          >
            📋 Tournament History
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <header className="mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-4xl">🏆</span>

                <div>
                  <h1 className="text-3xl font-black">
                    {tournament.name}
                  </h1>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-400">
                      COMPLETED
                    </span>

                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                      {tournament.total_players} Players
                    </span>

                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                      {tournament.courts} Courts
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={openLeaderboard}
                className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-400 hover:bg-emerald-950"
              >
                📊 Leaderboard
              </button>

              <button
                onClick={goHistory}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-800"
              >
                📋 History
              </button>

              <button
                onClick={goFormat}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-800"
              >
                📖 Format
              </button>

              <button
                onClick={goHome}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-800"
              >
                🏠 Home
              </button>

              <button
                onClick={removeTournament}
                disabled={deleting}
                className="rounded-lg border border-red-800 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-950 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "🗑️ Delete"}
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-300">
            <div className="font-bold">❌ Error</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        {/* CHAMPIONS / RUNNERS UP */}
        {finalResult && (
          <section className="mb-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-yellow-700 bg-gradient-to-br from-yellow-950/50 to-slate-950 p-8 text-center">
              <div className="text-6xl">🏆</div>

              <div className="mt-3 text-sm font-bold uppercase tracking-widest text-yellow-500">
                Tournament Champions
              </div>

              <h2 className="mt-2 text-3xl font-black text-yellow-400">
                {formatDoublesTeam(finalResult.champions)}
              </h2>

              {finalResult.winnerScore != null &&
                finalResult.loserScore != null && (
                  <div className="mt-4 text-sm text-slate-400">
                    Final {finalResult.winnerScore} -{" "}
                    {finalResult.loserScore}
                  </div>
                )}
            </div>

            <div className="rounded-2xl border border-slate-600 bg-gradient-to-br from-slate-800/80 to-slate-950 p-8 text-center">
              <div className="text-6xl">🥈</div>

              <div className="mt-3 text-sm font-bold uppercase tracking-widest text-slate-300">
                Runners Up
              </div>

              <h2 className="mt-2 text-3xl font-black text-slate-100">
                {formatDoublesTeam(finalResult.runnersUp)}
              </h2>
            </div>
          </section>
        )}

        {/* TOURNAMENT INFO */}
        <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-500">
              Players
            </div>
            <div className="mt-1 text-2xl font-black">
              {tournament.total_players}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-500">
              Preliminary
            </div>
            <div className="mt-1 text-2xl font-black">
              {tournament.preliminary_rounds}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-500">
              Courts
            </div>
            <div className="mt-1 text-2xl font-black">
              {tournament.courts}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-500">
              Created
            </div>
            <div className="mt-1 text-sm font-bold">
              {new Date(
                tournament.created_at
              ).toLocaleDateString()}
            </div>
          </div>
        </section>

        {/* FINAL LEADERBOARD */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black">
              Final Leaderboard
            </h2>

            <p className="text-sm text-slate-400">
              Final tournament standings.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left">
                      Player
                    </th>
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
                  {leaderboard.map((row, index) => (
                    <tr
                      key={row.player_id}
                      className="border-b border-slate-800 last:border-0"
                    >
                      <td className="px-4 py-3 font-black">
                        {index === 0
                          ? "🥇"
                          : index === 1
                          ? "🥈"
                          : index === 2
                          ? "🥉"
                          : index + 1}
                      </td>

                      <td className="px-4 py-3 font-bold">
                        {row.player?.name}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {row.matches_played}
                      </td>

                      <td className="px-4 py-3 text-center text-emerald-400">
                        {row.wins}
                      </td>

                      <td className="px-4 py-3 text-center text-red-400">
                        {row.losses}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {points(row.points_for)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {points(row.points_against)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {row.pointDifference > 0 ? "+" : ""}
                        {points(row.pointDifference)}
                      </td>

                      <td className="px-4 py-3 text-right font-black text-emerald-400">
                        {points(row.tournament_points)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* MATCH HISTORY */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black">
              Match History
            </h2>

            <p className="text-sm text-slate-400">
              Every round and completed match from this
              tournament.
            </p>
          </div>

          <div className="space-y-6">
            {rounds.map((round) => {
              const roundMatches = matches.filter(
                (match) => match.round_id === round.id
              );

              return (
                <div
                  key={round.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black">
                        {roundName(round)}
                      </h3>

                      <p className="text-xs text-slate-500">
                        {round.status.toUpperCase()}
                      </p>
                    </div>

                    <div className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                      {roundMatches.length} matches
                    </div>
                  </div>

                  <div className="space-y-3">
                    {roundMatches.map((match) => {
                      const matchTeams =
                        getPlayersForMatch(match.id);

                      return (
                        <div
                          key={match.id}
                          className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                        >
                          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                            <div className="font-semibold">
                              {matchTeams.team1
                                .map(
                                  (player) =>
                                    player.name
                                )
                                .join(" + ")}
                            </div>

                            <div className="text-center">
                              <div className="text-xl font-black">
                                {match.team1_score ?? "-"}{" "}
                                <span className="text-slate-600">
                                  -
                                </span>{" "}
                                {match.team2_score ?? "-"}
                              </div>

                              <div className="mt-1 text-[10px] text-slate-500">
                                Court{" "}
                                {match.court_number ?? "-"}
                              </div>
                            </div>

                            <div className="font-semibold md:text-right">
                              {matchTeams.team2
                                .map(
                                  (player) =>
                                    player.name
                                )
                                .join(" + ")}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="border-t border-slate-800 py-8 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={goHistory}
              className="rounded-lg border border-slate-700 px-5 py-2 text-sm font-bold hover:bg-slate-800"
            >
              📋 Tournament History
            </button>

            <button
              onClick={goHome}
              className="rounded-lg border border-slate-700 px-5 py-2 text-sm font-bold hover:bg-slate-800"
            >
              🏠 Tournament Manager
            </button>

            <button
              onClick={removeTournament}
              disabled={deleting}
              className="rounded-lg border border-red-800 px-5 py-2 text-sm font-bold text-red-400 hover:bg-red-950 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "🗑️ Delete Tournament"}
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
