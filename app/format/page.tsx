"use client";

import { useState } from "react";
import AppNav from "@/app/components/AppNav";

export default function TournamentFormatPage() {
  const [tab, setTab] = useState<"individual" | "team">("individual");

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
              Individual mixed doubles, or team groups of 3 or 4.
            </p>
          </div>

          <AppNav links={["history"]} />
        </header>

        <div
          role="tablist"
          aria-label="Tournament formats"
          className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-2"
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
              <ol className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
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
              <ol className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
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
              🏠 Tournament Manager
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
