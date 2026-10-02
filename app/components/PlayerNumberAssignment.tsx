"use client";

import { useEffect, useMemo, useState } from "react";

type AssignmentPlayer = {
  id: string;
  name: string;
};

export type NumberAssignment = {
  drawNumber: number;
  playerId: string;
  name: string;
};

export default function PlayerNumberAssignment({
  phase,
  players,
  onSave,
}: {
  phase: "preliminary" | "knockout";
  players: AssignmentPlayer[];
  onSave: (assignments: NumberAssignment[]) => Promise<void>;
}) {
  const [names, setNames] = useState<string[]>([]);
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // A new phase receives a fresh, empty chit assignment sheet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNames(Array.from({ length: players.length }, () => ""));
    setPlayerIds(Array.from({ length: players.length }, () => ""));
    setMessage("");
  }, [phase, players.length]);

  const duplicateNames = useMemo(() => {
    const normalized = names
      .map((name) => name.trim().toLocaleLowerCase())
      .filter(Boolean);

    return normalized.length !== new Set(normalized).size;
  }, [names]);

  async function save() {
    setMessage("");

    let assignments: NumberAssignment[];

    if (phase === "preliminary") {
      if (names.some((name) => !name.trim())) {
        setMessage("Enter one player name against every number.");
        return;
      }

      if (duplicateNames) {
        setMessage("Each player name must be unique.");
        return;
      }

      assignments = players.map((player, index) => ({
        drawNumber: index + 1,
        playerId: player.id,
        name: names[index].trim(),
      }));
    } else {
      if (playerIds.some((playerId) => !playerId)) {
        setMessage("Choose one qualified player against every number.");
        return;
      }

      if (new Set(playerIds).size !== players.length) {
        setMessage("Each qualified player can be assigned only once.");
        return;
      }

      const playerMap = new Map(
        players.map((player) => [player.id, player.name])
      );

      assignments = playerIds.map((playerId, index) => ({
        drawNumber: index + 1,
        playerId,
        name: playerMap.get(playerId) || "Player",
      }));
    }

    try {
      setSaving(true);
      await onSave(assignments);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the number draw."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-700 bg-amber-950/20 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-amber-400">
            Chit draw
          </div>
          <h2 className="mt-1 text-2xl font-black">
            Assign names to numbers
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            {phase === "preliminary"
              ? `Players pick chits 1–${players.length}. Enter each name beside the number they picked. The preliminary schedule will show these numbers.`
              : `The ${players.length} qualifiers pick fresh chits. Select each qualified player beside the new knockout number. Their preliminary scores remain attached to their names.`}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {players.map((player, index) => {
          const drawNumber = index + 1;

          return (
            <label
              key={`${phase}-${drawNumber}`}
              className="rounded-xl border border-slate-800 bg-slate-950 p-3"
            >
              <span className="mb-2 block text-sm font-black text-amber-400">
                Number {drawNumber}
              </span>

              {phase === "preliminary" ? (
                <input
                  value={names[index] || ""}
                  onChange={(event) => {
                    const next = [...names];
                    next[index] = event.target.value;
                    setNames(next);
                  }}
                  placeholder="Player name"
                  className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 outline-none focus:border-amber-500"
                />
              ) : (
                <select
                  value={playerIds[index] || ""}
                  onChange={(event) => {
                    const next = [...playerIds];
                    next[index] = event.target.value;
                    setPlayerIds(next);
                  }}
                  className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 outline-none focus:border-amber-500"
                >
                  <option value="">Choose player</option>
                  {players.map((option) => (
                    <option
                      key={option.id}
                      value={option.id}
                      disabled={
                        playerIds.includes(option.id) &&
                        playerIds[index] !== option.id
                      }
                    >
                      {option.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          );
        })}
      </div>

      {message && (
        <p className="mt-4 text-sm font-semibold text-red-300">{message}</p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-5 min-h-12 w-full rounded-xl bg-amber-500 px-5 py-3 font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50 sm:w-auto"
      >
        {saving
          ? "Saving draw..."
          : phase === "preliminary"
            ? "Save prelim number draw"
            : "Save knockout number draw"}
      </button>
    </section>
  );
}
