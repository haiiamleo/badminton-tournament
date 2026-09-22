import {
  tallyCompletedGames,
  type GameScoreInput,
} from "@/lib/bestOfThree";
import { sanitizeScoreInput } from "@/lib/scoreValidation";

type Props = {
  games: GameScoreInput[];
  disabled?: boolean;
  onChange: (
    gameIndex: number,
    team: "team1" | "team2",
    value: string
  ) => void;
};

export default function BestOfThreeScoreInputs({
  games,
  disabled = false,
  onChange,
}: Props) {
  const tally = tallyCompletedGames(games);
  const showGame3 = tally.team1Games === 1 && tally.team2Games === 1;
  const gameCount = showGame3 ? 3 : 2;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
        <span>Best of 3</span>
        <span className="text-slate-300">
          {tally.team1Games} - {tally.team2Games}
        </span>
      </div>

      {Array.from({ length: gameCount }, (_, index) => {
        const game = games[index] || { team1: "", team2: "" };

        return (
          <div
            key={index}
            className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2"
          >
            <div className="w-14 text-xs font-semibold text-slate-400">
              Game {index + 1}
            </div>

            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={game.team1}
              disabled={disabled}
              onChange={(event) => {
                const sanitized = sanitizeScoreInput(event.target.value);

                if (sanitized === null) {
                  return;
                }

                onChange(index, "team1", sanitized);
              }}
              className="h-12 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-center text-xl font-bold outline-none focus:border-emerald-500 disabled:opacity-50"
              placeholder="0"
              aria-label={`Game ${index + 1} team 1 score`}
            />

            <span className="text-center text-sm font-bold text-slate-600">
              -
            </span>

            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={game.team2}
              disabled={disabled}
              onChange={(event) => {
                const sanitized = sanitizeScoreInput(event.target.value);

                if (sanitized === null) {
                  return;
                }

                onChange(index, "team2", sanitized);
              }}
              className="h-12 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-center text-xl font-bold outline-none focus:border-blue-500 disabled:opacity-50"
              placeholder="0"
              aria-label={`Game ${index + 1} team 2 score`}
            />
          </div>
        );
      })}

      {!showGame3 && (
        <p className="text-xs text-slate-500">
          Game 3 is played only if the first two games are split.
        </p>
      )}
    </div>
  );
}
