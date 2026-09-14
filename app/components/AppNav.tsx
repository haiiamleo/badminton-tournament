"use client";

import type { ReactNode } from "react";

export type NavTarget =
  | "control-center"
  | "team-center"
  | "leaderboard"
  | "standings"
  | "history"
  | "format"
  | "new";

const baseClass =
  "min-h-11 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold transition hover:bg-slate-800 sm:px-4";

const primaryClass =
  "min-h-11 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold transition hover:bg-emerald-500 sm:px-4";

const accentClass =
  "min-h-11 rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-950 sm:px-4";

const navItems: Record<
  NavTarget,
  { label: string; href: string; className: string; clearActive?: boolean }
> = {
  "control-center": {
    label: "🎛️ Control Center",
    href: "/control-center",
    className: primaryClass,
  },
  "team-center": {
    label: "👥 Team Center",
    href: "/team-center",
    className: primaryClass,
  },
  leaderboard: {
    label: "📊 Leaderboard",
    href: "/leaderboard",
    className: accentClass,
  },
  standings: {
    label: "📊 Standings",
    href: "/leaderboard",
    className: accentClass,
  },
  history: {
    label: "📋 History",
    href: "/tournaments",
    className: baseClass,
  },
  format: {
    label: "📖 Format",
    href: "/format",
    className: baseClass,
  },
  new: {
    label: "➕ New Tournament",
    href: "/?create=1",
    className: accentClass,
    clearActive: true,
  },
};

/*
 * Shared navigation. Home is always rendered so every page can get
 * back to the tournament manager, except on the home page itself.
 */
export default function AppNav({
  links = [],
  showHome = true,
  clearActiveOnHome = false,
  children,
}: {
  links?: NavTarget[];
  showHome?: boolean;
  clearActiveOnHome?: boolean;
  children?: ReactNode;
}) {
  const go = (href: string, clearActive?: boolean) => {
    if (clearActive) {
      localStorage.removeItem("activeTournamentId");
    }

    window.location.href = href;
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
      {children}

      {links.map((link) => {
        const item = navItems[link];

        return (
          <button
            key={link}
            onClick={() => go(item.href, item.clearActive)}
            className={item.className}
          >
            {item.label}
          </button>
        );
      })}

      {showHome && (
        <button
          onClick={() => go("/", clearActiveOnHome)}
          className={baseClass}
        >
          🏠 Home
        </button>
      )}
    </div>
  );
}
