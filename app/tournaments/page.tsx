"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppNav from "@/app/components/AppNav";
import { deleteTournament } from "@/lib/deleteTournament";

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
  format?: string;
  team_size?: number | null;
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString();
}

export default function TournamentHistoryPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError("");

        const { data, error: loadError } = await supabase
          .from("tournaments")
          .select(
            "id, name, total_players, preliminary_rounds, courts, qualification_count, status, created_at, completed_at, format, team_size"
          )
          .order("created_at", { ascending: false });

        if (loadError) {
          throw loadError;
        }

        setTournaments((data || []) as Tournament[]);
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

    loadHistory();
  }, []);

  const completedTournaments = useMemo(
    () =>
      tournaments.filter(
        (tournament) => tournament.status === "completed"
      ),
    [tournaments]
  );

  const inProgressTournaments = useMemo(
    () =>
      tournaments.filter(
        (tournament) => tournament.status !== "completed"
      ),
    [tournaments]
  );

  const goHome = () => {
    window.location.href = "/";
  };

  const goFormat = () => {
    window.location.href = "/format";
  };

  const startNewTournament = () => {
    localStorage.removeItem("activeTournamentId");
    window.location.href = "/?create=1";
  };

  const openCompletedTournament = (tournamentId: string) => {
    window.location.href = `/tournaments/${tournamentId}`;
  };

  const resumeTournament = (tournament: Tournament) => {
    localStorage.setItem("activeTournamentId", tournament.id);

    if (tournament.status === "setup") {
      window.location.href = "/";
      return;
    }

    if (tournament.format === "team_groups") {
      window.location.href = "/team-center";
      return;
    }

    window.location.href = "/control-center";
  };

  const removeTournament = async (tournament: Tournament) => {
    const confirmed = window.confirm(
      `Delete "${tournament.name}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(tournament.id);
      setError("");
      await deleteTournament(tournament.id);
      setTournaments((current) =>
        current.filter((item) => item.id !== tournament.id)
      );
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete this tournament."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-black">
              📋 Tournament History
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Completed tournaments stay here until you
              delete them. Starting a new tournament does
              not overwrite the old one.
            </p>
          </div>

          <AppNav links={["new", "format"]} />
        </header>

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="text-4xl">🏸</div>
            <div className="mt-4 font-bold">
              Loading tournament history...
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-300">
            <div className="font-bold">❌ Error</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        {!loading && (
          <div className="space-y-10">
            <section>
              <div className="mb-4">
                <h2 className="text-2xl font-black">
                  Completed
                </h2>
                <p className="text-sm text-slate-400">
                  Final results for closed tournaments.
                </p>
              </div>

              {completedTournaments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
                  No completed tournaments yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {completedTournaments.map((tournament) => (
                    <article
                      key={tournament.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
                    >
                      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-bold uppercase tracking-widest text-yellow-500">
                            🏆 Completed
                          </div>

                          <h3 className="mt-2 text-2xl font-black">
                            {tournament.name}
                          </h3>

                          <p className="mt-2 text-sm text-slate-400">
                            {tournament.total_players} Players
                            {" · "}
                            {tournament.format === "team_groups"
                              ? `Team groups · ${tournament.team_size || 4} per team`
                              : `${tournament.preliminary_rounds} Preliminary Rounds`}
                            {" · "}
                            {tournament.courts} Courts
                          </p>

                          <p className="mt-2 text-xs text-slate-500">
                            Created: {formatDate(tournament.created_at)}
                            {" · "}
                            Completed:{" "}
                            {formatDate(tournament.completed_at)}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:min-w-[200px]">
                          <button
                            onClick={() =>
                              openCompletedTournament(tournament.id)
                            }
                            className="rounded-xl bg-yellow-500 px-6 py-3 font-black text-slate-950 transition hover:bg-yellow-400"
                          >
                            🏆 View Tournament
                          </button>

                          <button
                            onClick={() => removeTournament(tournament)}
                            disabled={deletingId === tournament.id}
                            className="rounded-xl border border-red-800 px-6 py-3 font-bold text-red-400 transition hover:bg-red-950 disabled:opacity-50"
                          >
                            {deletingId === tournament.id
                              ? "Deleting..."
                              : "🗑️ Delete"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-4">
                <h2 className="text-2xl font-black">
                  In Progress
                </h2>
                <p className="text-sm text-slate-400">
                  Resume a live tournament in Control Center or Team Center.
                </p>
              </div>

              {inProgressTournaments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
                  No tournaments currently in progress.
                </div>
              ) : (
                <div className="space-y-4">
                  {inProgressTournaments.map((tournament) => (
                    <article
                      key={tournament.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
                    >
                      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-bold uppercase tracking-widest text-emerald-400">
                            🏸 {tournament.status === "setup"
                              ? "Setup"
                              : "In Progress"}
                          </div>

                          <h3 className="mt-2 text-2xl font-black">
                            {tournament.name}
                          </h3>

                          <p className="mt-2 text-sm text-slate-400">
                            {tournament.total_players} Players
                            {" · "}
                            {tournament.format === "team_groups"
                              ? `Team groups · ${tournament.team_size || 4} per team`
                              : `${tournament.preliminary_rounds} Preliminary Rounds`}
                            {" · "}
                            {tournament.courts} Courts
                          </p>

                          <p className="mt-2 text-xs text-slate-500">
                            Created: {formatDate(tournament.created_at)}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:min-w-[200px]">
                          <button
                            onClick={() =>
                              resumeTournament(tournament)
                            }
                            className="rounded-xl bg-emerald-600 px-6 py-3 font-black transition hover:bg-emerald-500"
                          >
                            {tournament.status === "setup"
                              ? "🏠 Continue Setup"
                              : tournament.format === "team_groups"
                                ? "👥 Team Center"
                                : "🎛️ Control Center"}
                          </button>

                          <button
                            onClick={() => removeTournament(tournament)}
                            disabled={deletingId === tournament.id}
                            className="rounded-xl border border-red-800 px-6 py-3 font-bold text-red-400 transition hover:bg-red-950 disabled:opacity-50"
                          >
                            {deletingId === tournament.id
                              ? "Deleting..."
                              : "🗑️ Delete"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
