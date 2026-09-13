"use client";

export default function TournamentFormatPage() {
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
              How this doubles tournament is run and scored.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={goHistory}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold transition hover:bg-slate-800"
            >
              📋 History
            </button>

            <button
              onClick={goHome}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold transition hover:bg-slate-800"
            >
              🏠 Home
            </button>
          </div>
        </header>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-black">
            Doubles format
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Every match is doubles: two players versus two
            players. Player count must be divisible by 4,
            so the usual sizes are 16, 24, or 32 players.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-xs uppercase tracking-widest text-slate-500">
                Team
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

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
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

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-black">Scoring</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Each player earns half of their team&apos;s
            rally score as tournament points.
          </p>
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

        <section className="mb-6 rounded-2xl border border-yellow-700 bg-gradient-to-br from-yellow-950/40 to-slate-950 p-6">
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

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
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
