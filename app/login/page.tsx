"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    window.location.replace("/");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <p className="text-slate-400">Opening Shuttle and Chill...</p>
    </main>
  );
}
