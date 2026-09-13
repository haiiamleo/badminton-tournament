"use client";

import { supabase } from "@/lib/supabase";

export default function LogoutButton() {
  async function logout() {
    await supabase.auth.signOut();

    localStorage.removeItem(
      "activeTournamentId"
    );

    window.location.href = "/login";
  }

  return (
    <button
      onClick={logout}
      className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-950"
    >
      🚪 Logout
    </button>
  );
}