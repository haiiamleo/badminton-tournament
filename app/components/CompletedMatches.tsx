"use client";

import { useState } from "react";
import BestOfThreeScoreInputs from "@/app/components/BestOfThreeScoreInputs";
import { usesBestOfThree } from "@/lib/bestOfThree";
import {
  describeDraftResult,
  draftFromMatch,
  editIndividualMatch,
  type CompletedMatchView,
  type ScoreDraft,
} from "@/lib/individualMatchEdit";
import { finalsScheduleLabel } from "@/lib/finalResult";
import { formatMatchScoreLine } from "@/lib/bestOfThree";
import { sanitizeScoreInput } from "@/lib/scoreValidation";

function roundLabel(match: CompletedMatchView, roundSize: number) {
  if (match.roundType === "preliminary") {
    return `Round ${match.roundNumber}`;
  }

  if (match.roundType === "quarterfinal") {
    return "Quarterfinals";
  }

  if (match.roundType === "semifinal") {
    return "Semifinals";
  }

  if (match.roundType === "final") {
    return roundSize > 1 ? "Final & 3rd Place" : "Final";
  }

  return `Round ${match.roundNumber}`;
}

export default function CompletedMatches({
  tournamentId,
  matches,
  onSaved,
}: {
  tournamentId: string;
  matches: CompletedMatchView[];
  onSaved: () => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScoreDraft | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const rounds = new Map<string, CompletedMatchView[]>();

  matches.forEach((match) => {
    const existing = rounds.get(match.roundId) || [];
    existing.push(match);
    rounds.set(match.roundId, existing);
  });

  function startEdit(match: CompletedMatchView) {
    setEditingId(match.id);
    setDraft(draftFromMatch(match));
    setPassword("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setPassword("");
    setMessage("");
  }

  async function saveEdit(match: CompletedMatchView) {
    if (!draft) {
      return;
    }

    try {
      const next = describeDraftResult(match.roundType, draft);

      if (
        match.laterRoundExists &&
        next.winnerTeam !== match.winnerTeam
      ) {
        const confirmed = window.confirm(
          "Changing the winner does not rebuild rounds that were already generated. Save this correction anyway?"
        );

        if (!confirmed) {
          return;
        }
      }

      setSaving(true);
      setMessage("");
      await editIndividualMatch(
        tournamentId,
        match,
        draft,
        password
      );
      cancelEdit();
      await onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update this score."
      );
    } finally {
      setSaving(false);
    }
  }

  if (matches.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-xl font-black sm:text-2xl">
          Completed matches
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Scores from finished preliminary and knockout matches.
          A correction needs the score-edit password.
        </p>
      </div>

      <div className="space-y-3">
        {[...rounds.entries()].reverse().map(([roundId, roundMatches]) => {
          const sample = roundMatches[0];

          return (
            <details
              key={roundId}
              className="group rounded-xl border border-slate-800 bg-slate-900"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
                <div>
                  <h3 className="font-black">
                    {roundLabel(sample, sample.matchesInRound)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {roundMatches.length} completed match
                    {roundMatches.length === 1 ? "" : "es"}
                  </p>
                </div>
                <span className="text-sm font-bold text-slate-400 group-open:hidden">
                  View
                </span>
                <span className="hidden text-sm font-bold text-slate-400 group-open:inline">
                  Close
                </span>
              </summary>

              <div className="space-y-3 border-t border-slate-800 p-3 sm:p-4">
                {roundMatches.map((match) => {
                  const editing = editingId === match.id;
                  const bestOfThree = usesBestOfThree(
                    match.roundType,
                    "individual"
                  );

                  return (
                    <article
                      key={match.id}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                          {finalsScheduleLabel(
                            match.roundType,
                            match.matchNumber,
                            match.matchesInRound
                          )}
                          {match.courtNumber
                            ? ` · Court ${match.courtNumber}`
                            : ""}
                        </div>
                        {!editing && (
                          <button
                            type="button"
                            onClick={() => startEdit(match)}
                            className="min-h-10 rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold hover:bg-slate-800"
                          >
                            Edit score
                          </button>
                        )}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                        <div className="font-semibold">
                          {match.team1Players
                            .map((player) => player.name)
                            .join(" + ")}
                        </div>
                        <div className="text-lg font-black">
                          {formatMatchScoreLine({
                            team1_score: match.team1Score,
                            team2_score: match.team2Score,
                            game_scores: match.gameScores,
                          })}
                        </div>
                        <div className="font-semibold sm:text-right">
                          {match.team2Players
                            .map((player) => player.name)
                            .join(" + ")}
                        </div>
                      </div>

                      {editing && draft && (
                        <div className="mt-4 border-t border-slate-800 pt-4">
                          {bestOfThree ? (
                            <BestOfThreeScoreInputs
                              games={draft.games}
                              onChange={(gameIndex, team, value) => {
                                setDraft((current) => {
                                  if (!current) {
                                    return current;
                                  }

                                  const games = current.games.map(
                                    (game, index) =>
                                      index === gameIndex
                                        ? { ...game, [team]: value }
                                        : game
                                  );

                                  return { ...current, games };
                                });
                              }}
                            />
                          ) : (
                            <div className="grid grid-cols-2 gap-3">
                              {(["team1", "team2"] as const).map(
                                (team) => (
                                  <input
                                    key={team}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={2}
                                    value={draft[team]}
                                    aria-label={`${team} score`}
                                    onChange={(event) => {
                                      const sanitized =
                                        sanitizeScoreInput(
                                          event.target.value
                                        );

                                      if (sanitized === null) {
                                        return;
                                      }

                                      setDraft((current) =>
                                        current
                                          ? {
                                              ...current,
                                              [team]: sanitized,
                                            }
                                          : current
                                      );
                                    }}
                                    className="h-12 rounded-lg border border-slate-700 bg-slate-900 text-center text-xl font-bold outline-none focus:border-emerald-500"
                                  />
                                )
                              )}
                            </div>
                          )}

                          <label className="mt-4 block text-sm font-semibold text-slate-300">
                            Score-edit password
                            <input
                              type="password"
                              autoComplete="off"
                              value={password}
                              onChange={(event) =>
                                setPassword(event.target.value)
                              }
                              className="mt-2 h-12 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 outline-none focus:border-emerald-500"
                            />
                          </label>

                          {message && (
                            <p className="mt-3 text-sm text-red-300">
                              {message}
                            </p>
                          )}

                          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              onClick={() => saveEdit(match)}
                              disabled={saving || password.length === 0}
                              className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
                            >
                              {saving ? "Saving..." : "Save correction"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={saving}
                              className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
