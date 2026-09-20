"use client";

import { useState } from "react";
import AppNav from "@/app/components/AppNav";
import FormatDiagram, {
  type DiagramStep,
} from "@/app/components/FormatDiagram";

const individualSteps: DiagramStep[] = [
  {
    nodes: [
      {
        title: "Preliminary rounds",
        detail: "Everyone plays · random, then smart pairing",
      },
    ],
  },
  {
    nodes: [
      {
        title: "Quarterfinals",
        detail: "Top 16 qualify · 4 doubles matches",
      },
    ],
  },
  {
    nodes: [
      { title: "Semifinals", detail: "8 winners · 2 doubles matches" },
    ],
  },
  {
    nodes: [{ title: "Final", detail: "4 winners · 1 doubles match" }],
  },
  {
    nodes: [{ title: "Champions", detail: "The winning pair" }],
  },
];

const splitPairSteps: DiagramStep[] = [
  {
    nodes: [
      { title: "Random prelims", detail: "5 rounds · all 20 players" },
    ],
  },
  {
    nodes: [
      {
        title: "Rank split",
        detail: "Ranks 1-10 Championship · 11-20 Plate",
      },
    ],
  },
  {
    nodes: [
      {
        title: "Championship pairs",
        detail: "1+10, 2+9, 3+8, 4+7, 5+6",
      },
      {
        title: "Plate pairs",
        detail: "11+20, 12+19, 13+18, 14+17, 15+16",
      },
    ],
  },
  {
    nodes: [
      {
        title: "Championship RR",
        detail: "10 matches · 2 pts a win",
      },
      { title: "Plate RR", detail: "10 matches · 2 pts a win" },
    ],
  },
  {
    nodes: [
      { title: "Championship SF", detail: "1 v 4 and 2 v 3" },
      { title: "Plate SF", detail: "1 v 4 and 2 v 3" },
    ],
  },
  {
    nodes: [
      {
        title: "Championship final",
        detail: "Champion and runner-up",
      },
      { title: "Plate final", detail: "Champion and runner-up" },
    ],
  },
];

const teamSteps: DiagramStep[] = [
  {
    nodes: [
      { title: "Teams formed", detail: "Even number of teams of 3 or 4" },
    ],
  },
  {
    nodes: [
      { title: "Group A", detail: "Round robin · 5 matches a fixture" },
      { title: "Group B", detail: "Round robin · 5 matches a fixture" },
    ],
  },
  {
    nodes: [
      { title: "Semifinals", detail: "A1 v B2 and A2 v B1" },
    ],
  },
  {
    nodes: [
      { title: "3rd place", detail: "The two semifinal losers" },
      { title: "Final", detail: "The two semifinal winners" },
    ],
  },
  {
    nodes: [{ title: "Champions", detail: "The winning team" }],
  },
];

function individualTotal(players: number, prelimRounds: number) {
  return (players / 4) * prelimRounds + 7;
}

function teamMatchTotal(playerCount: number, teamSize: number) {
  const teamCount = playerCount / teamSize;
  const groupSize = teamCount / 2;
  const groupFixtures = groupSize * (groupSize - 1);
  const knockoutFixtures = 4;

  return (groupFixtures + knockoutFixtures) * 5;
}

function MatchCounts({
  rows,
  total,
  note,
}: {
  rows: { label: string; count: number }[];
  total: number;
  note?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-xl font-black">How many matches</h2>
      <p className="mt-2 text-sm text-slate-400">
        Every number below is a doubles match, two versus two.
      </p>
      <div className="mt-4 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
          >
            <span className="text-slate-300">{row.label}</span>
            <span className="shrink-0 font-black text-emerald-400">
              {row.count}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 bg-emerald-950/30 px-4 py-3 text-sm">
          <span className="font-black">Total</span>
          <span className="shrink-0 text-lg font-black text-yellow-400">
            {total}
          </span>
        </div>
      </div>
      {note && (
        <p className="mt-3 text-sm leading-6 text-slate-400">{note}</p>
      )}
    </section>
  );
}

export default function TournamentFormatPage() {
  const [tab, setTab] = useState<
    "individual" | "split_pairs" | "team"
  >("individual");

  const goHome = () => {
    window.location.href = "/";
  };

  const goHistory = () => {
    window.location.href = "/tournaments";
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-black">
              📖 Tournament Format
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Choose individual, split-pair, or team-group play.
            </p>
          </div>

          <AppNav links={["history"]} />
        </header>

        <div
          role="tablist"
          aria-label="Tournament formats"
          className="mb-6 grid grid-cols-1 gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-2 sm:grid-cols-3"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "individual"}
            onClick={() => setTab("individual")}
            className={`rounded-xl px-4 py-3 text-sm font-black transition duration-300 ${
              tab === "individual"
                ? "bg-emerald-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            Individual doubles
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "split_pairs"}
            onClick={() => setTab("split_pairs")}
            className={`rounded-xl px-4 py-3 text-sm font-black transition duration-300 ${
              tab === "split_pairs"
                ? "bg-emerald-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            Split pairs
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "team"}
            onClick={() => setTab("team")}
            className={`rounded-xl px-4 py-3 text-sm font-black transition duration-300 ${
              tab === "team"
                ? "bg-emerald-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            Team groups
          </button>
        </div>

        <div className="relative overflow-hidden">
          <div
            role="tabpanel"
            className={`space-y-6 transition-all duration-300 ease-out ${
              tab === "individual"
                ? "translate-x-0 opacity-100"
                : "pointer-events-none absolute inset-x-0 top-0 -translate-x-6 opacity-0"
            }`}
          >
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-black">
                Individual doubles
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Mixed pairings. Players earn rally points. Top 16
                go to knockout. Every match is doubles: two
                players versus two players. Player count must be
                divisible by 4, so the usual sizes are 16, 24, or
                32 players.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Pair
                  </div>
                  <div className="mt-1 font-bold">2 players</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Match
                  </div>
                  <div className="mt-1 font-bold">2 vs 2</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Ties
                  </div>
                  <div className="mt-1 font-bold">Not allowed</div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-black">
                Tournament stages
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                One path from the first round to the title.
              </p>
              <div className="mt-4">
                <FormatDiagram
                  label="Individual doubles stages: preliminary rounds, quarterfinals, semifinals, final, champions."
                  steps={individualSteps}
                />
              </div>
              <ol className="mt-6 space-y-4 text-sm leading-6 text-slate-300">
                <li>
                  <strong className="text-white">
                    1. Preliminary rounds
                  </strong>
                  <div className="mt-1">
                    Everyone plays. Round 1 is random. Later
                    preliminary rounds use intelligent pairing
                    to avoid repeat partners and opponents, and
                    to keep team strength close.
                  </div>
                </li>
                <li>
                  <strong className="text-white">
                    2. Quarterfinals
                  </strong>
                  <div className="mt-1">
                    The Top 16 players qualify. They are paired
                    randomly into 4 doubles matches.
                  </div>
                </li>
                <li>
                  <strong className="text-white">
                    3. Semifinals
                  </strong>
                  <div className="mt-1">
                    The 8 quarterfinal winners are paired
                    randomly into 2 doubles matches.
                  </div>
                </li>
                <li>
                  <strong className="text-white">4. Final</strong>
                  <div className="mt-1">
                    The 4 semifinal winners play one doubles
                    match for the title.
                  </div>
                </li>
              </ol>
            </section>

            <MatchCounts
              rows={[
                { label: "6 preliminary rounds (6 per round)", count: 36 },
                { label: "Quarterfinals", count: 4 },
                { label: "Semifinals", count: 2 },
                { label: "Final", count: 1 },
              ]}
              total={individualTotal(24, 6)}
              note="Usual setup is 24 players and 6 prelims: 43 matches. Knockout is always 7. Each prelim round is players ÷ 4 matches, so 16 players is 4 a round and 32 players is 8 a round."
            />

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="px-6 pt-6">
                <h3 className="text-lg font-black">Other sizes</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Total matches for 4 to 8 prelim rounds.
                </p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="bg-slate-950 text-xs uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Players</th>
                      {[4, 5, 6, 7, 8].map((rounds) => (
                        <th key={rounds} className="px-3 py-3 text-center">
                          {rounds}R
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[16, 24, 32].map((players) => (
                      <tr
                        key={players}
                        className="border-t border-slate-800"
                      >
                        <td className="px-6 py-3 font-semibold">
                          {players}
                        </td>
                        {[4, 5, 6, 7, 8].map((rounds) => (
                          <td
                            key={rounds}
                            className={`px-3 py-3 text-center ${
                              players === 24 && rounds === 6
                                ? "font-black text-yellow-400"
                                : "text-slate-300"
                            }`}
                          >
                            {individualTotal(players, rounds)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-black">Scoring</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Each player earns half of their team&apos;s
                rally score as tournament points.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
                  <div className="font-bold text-emerald-400">
                    Prelims
                  </div>
                  <p className="mt-2 text-slate-300">
                    Played to 21. At 20-20, the next point is
                    golden, so the game ends 21-20.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
                  <div className="font-bold text-yellow-400">
                    QF / SF / Final
                  </div>
                  <p className="mt-2 text-slate-300">
                    First to 21, must win by 2. After 20-20,
                    play continues to 22-20, 23-21, and so on,
                    until 29-29. Then 30 is golden point.
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
                <div className="font-bold text-emerald-400">
                  Example: 21 - 12
                </div>
                <p className="mt-2 text-slate-300">
                  Winning pair: 21 / 2 ={" "}
                  <strong className="text-white">10.5</strong>{" "}
                  points each
                </p>
                <p className="mt-1 text-slate-300">
                  Losing pair: 12 / 2 ={" "}
                  <strong className="text-white">6</strong>{" "}
                  points each
                </p>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                The leaderboard ranks players by tournament
                points, then wins, then point difference, then
                points scored.
              </p>
            </section>

            <section className="rounded-2xl border border-yellow-700 bg-gradient-to-br from-yellow-950/40 to-slate-950 p-6">
              <h2 className="text-xl font-black text-yellow-400">
                Champions and runners up
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Because this is doubles, the title is a pair,
                not the first name on the leaderboard.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-yellow-700 bg-yellow-950/30 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-yellow-500">
                    Champions
                  </div>
                  <p className="mt-2 text-sm text-slate-200">
                    Both players on the Final winning team.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-600 bg-slate-900/70 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-300">
                    Runners Up
                  </div>
                  <p className="mt-2 text-sm text-slate-200">
                    Both players on the Final losing team.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div
            role="tabpanel"
            className={`space-y-6 transition-all duration-300 ease-out ${
              tab === "team"
                ? "translate-x-0 opacity-100"
                : "pointer-events-none absolute inset-x-0 top-0 translate-x-6 opacity-0"
            }`}
          >
            <section className="rounded-2xl border border-emerald-800 bg-emerald-950/20 p-6">
              <h2 className="text-xl font-black">
                Team groups
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Teams of 3 or 4. Group round robin, then semis,
                3rd place, and final. Ranked by match wins.
                Players are split into Group A and Group B.
                Example: 24 players and 4 per team makes 6 teams
                (A-F), with 3 teams in each group. Names entered
                in order fill Team A first, then B, and so on.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Team size
                  </div>
                  <div className="mt-1 font-bold">3 or 4 players</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Fixture
                  </div>
                  <div className="mt-1 font-bold">5 doubles matches</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Team point
                  </div>
                  <div className="mt-1 font-bold">1 per match win</div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-black">
                Tournament stages
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Two groups run side by side, then merge into the
                knockout.
              </p>
              <div className="mt-4">
                <FormatDiagram
                  accent="#38bdf8"
                  label="Team group stages: teams formed, Group A and Group B round robins, semifinals, 3rd place and final, champions."
                  steps={teamSteps}
                />
              </div>
              <ol className="mt-6 space-y-4 text-sm leading-6 text-slate-300">
                <li>
                  <strong className="text-white">1. Prelims</strong>
                  <div className="mt-1">
                    Round robin inside each group. Before a fixture,
                    set the 5 pairing order. Each doubles game is to
                    21, with golden point at 20-20. Individual rally
                    points are not stored. The winning pair gives
                    their team 1 match win.
                  </div>
                </li>
                <li>
                  <strong className="text-white">2. Semifinals</strong>
                  <div className="mt-1">
                    Top 2 from each group qualify: A1 vs B2 and A2 vs
                    B1. Same 5-match fixture. Knockout scoring: first
                    to 21, win by 2, cap 30.
                  </div>
                </li>
                <li>
                  <strong className="text-white">
                    3. 3rd place and Final
                  </strong>
                  <div className="mt-1">
                    Semi losers play for 3rd. Semi winners play the
                    Final. Champions are the winning team.
                  </div>
                </li>
              </ol>
            </section>

            <MatchCounts
              rows={[
                {
                  label: "Group prelims (6 fixtures × 5)",
                  count: 30,
                },
                { label: "Semifinals (2 fixtures × 5)", count: 10 },
                { label: "3rd place (1 fixture × 5)", count: 5 },
                { label: "Final (1 fixture × 5)", count: 5 },
              ]}
              total={teamMatchTotal(24, 4)}
              note="Usual setup is 24 players and 4 per team: 50 matches. Each team-vs-team fixture is always 5 doubles games. Knockout is always 4 fixtures, or 20 matches."
            />

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="px-6 pt-6">
                <h3 className="text-lg font-black">Other sizes</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Total doubles matches for each allowed field.
                </p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="bg-slate-950 text-xs uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Setup</th>
                      <th className="px-3 py-3 text-center">Prelims</th>
                      <th className="px-3 py-3 text-center">Knockout</th>
                      <th className="px-6 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        label: "12 players · 3 per team",
                        players: 12,
                        size: 3,
                      },
                      {
                        label: "16 players · 4 per team",
                        players: 16,
                        size: 4,
                      },
                      {
                        label: "18 players · 3 per team",
                        players: 18,
                        size: 3,
                      },
                      {
                        label: "24 players · 4 per team",
                        players: 24,
                        size: 4,
                      },
                      {
                        label: "24 players · 3 per team",
                        players: 24,
                        size: 3,
                      },
                      {
                        label: "32 players · 4 per team",
                        players: 32,
                        size: 4,
                      },
                    ].map((row) => {
                      const total = teamMatchTotal(row.players, row.size);
                      const knockout = 20;
                      const usual = row.players === 24 && row.size === 4;

                      return (
                        <tr
                          key={row.label}
                          className="border-t border-slate-800"
                        >
                          <td className="px-6 py-3 font-semibold">
                            {row.label}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-300">
                            {total - knockout}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-300">
                            {knockout}
                          </td>
                          <td
                            className={`px-6 py-3 text-right font-black ${
                              usual
                                ? "text-yellow-400"
                                : "text-emerald-400"
                            }`}
                          >
                            {total}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <section className="rounded-2xl border border-yellow-700 bg-gradient-to-br from-yellow-950/40 to-slate-950 p-6">
              <h2 className="text-xl font-black text-yellow-400">
                Champions
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                The title belongs to the team that wins the Final
                fixture, not to individual rally-point totals.
              </p>
            </section>
          </div>

          <div
            role="tabpanel"
            className={`space-y-6 transition-all duration-300 ease-out ${
              tab === "split_pairs"
                ? "translate-x-0 opacity-100"
                : "pointer-events-none absolute inset-x-0 top-0 translate-x-6 opacity-0"
            }`}
          >
            <section className="rounded-2xl border border-purple-800 bg-purple-950/20 p-6">
              <h2 className="text-xl font-black">
                20-player Split Pairs
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                This format begins as an individual event, then locks
                players into balanced doubles pairs for two parallel
                draws: Championship and Plate.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Players
                  </div>
                  <div className="mt-1 font-bold">Exactly 20</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Prelims
                  </div>
                  <div className="mt-1 font-bold">5 random rounds</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Winners
                  </div>
                  <div className="mt-1 font-bold">One per draw</div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-black">
                Tournament stages
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                The field splits in two after the prelims and the
                draws never meet again.
              </p>
              <div className="mt-4">
                <FormatDiagram
                  accent="#c084fc"
                  label="Split pairs stages: five random prelim rounds, rank split, Championship and Plate fixed pairs, round robins, semifinals, and two finals."
                  steps={splitPairSteps}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-black">
                1. Random preliminary rounds
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                All 20 players receive completely random partners and
                opponents for five rounds. Each player receives half
                of their team&apos;s rally score. Player rankings use
                tournament points, then wins, point difference, and
                points scored.
              </p>
              <p className="mt-3 text-sm text-slate-400">
                Prelim games are first to 21 with a golden point at
                20-20.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-black">
                2. Rank split and fixed pairs
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Ranks 1–10 enter the Championship draw. Ranks 11–20
                enter the Plate draw. Inside each draw, the fixed pairs
                are 1+10, 2+9, 3+8, 4+7, and 5+6. Partners remain
                together for the rest of the tournament.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-black">
                3. Fixed-pair round robin
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                The five pairs in each draw play all four other pairs.
                A win earns 2 standing points. Ties are broken by
                match point difference, then total points scored.
              </p>
              <p className="mt-3 text-sm text-slate-400">
                These matches are first to 21, win by 2, with a cap
                of 30.
              </p>
            </section>

            <section className="rounded-2xl border border-yellow-700 bg-gradient-to-br from-yellow-950/40 to-slate-950 p-6">
              <h2 className="text-xl font-black text-yellow-400">
                4. Parallel semifinals and finals
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                The top four pairs in each draw advance. Semifinals
                are 1 vs 4 and 2 vs 3. The winners play a final in
                their own draw, producing a Championship winner and
                runner-up plus a Plate winner and runner-up.
              </p>
            </section>

            <MatchCounts
              rows={[
                { label: "5 random prelim rounds", count: 25 },
                { label: "Championship round robin", count: 10 },
                { label: "Plate round robin", count: 10 },
                { label: "Championship semifinals", count: 2 },
                { label: "Plate semifinals", count: 2 },
                { label: "Championship final", count: 1 },
                { label: "Plate final", count: 1 },
              ]}
              total={51}
              note="This format is always 20 players, so the match count never changes."
            />
          </div>
        </div>

        <section className="mb-8 mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-black">
            Starting a new tournament
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Creating a new tournament does not delete the
            old one. Old events stay in History until you
            delete them. New Tournament only clears the
            local active tournament ID so the previous
            event is not auto-resumed.
          </p>
        </section>

        <footer className="border-t border-slate-800 py-8 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={goHome}
              className="rounded-lg border border-slate-700 px-5 py-2 text-sm font-bold hover:bg-slate-800"
            >
              🏠 Baddy Smash
            </button>

            <button
              onClick={goHistory}
              className="rounded-lg border border-slate-700 px-5 py-2 text-sm font-bold hover:bg-slate-800"
            >
              📋 Tournament History
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
