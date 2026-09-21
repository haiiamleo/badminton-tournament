"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import AppNav from "@/app/components/AppNav";
import { describeError } from "@/lib/errorMessage";
import { rankTeams } from "@/lib/teamTournament";
import {
  poolLabel,
  rankFixedPairs,
  type SplitPool,
} from "@/lib/splitPairsTournament";

type Player = {
  id: string;
  name: string;
};

type Standing = {
  player_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  tournament_points: number;
};

type LeaderboardRow = Standing & {
  player_name: string;
  rank: number;
};

type TeamRow = {
  team_id: string;
  name: string;
  group_name: string;
  match_wins: number;
  match_losses: number;
  fixture_wins: number;
  fixture_losses: number;
  matches_played: number;
};

type PairRow = {
  pair_id: string;
  pool_name: SplitPool;
  player_names: string;
  matches_played: number;
  wins: number;
  losses: number;
  standing_points: number;
  points_for: number;
  points_against: number;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [teamRows, setTeamRows] = useState<TeamRow[]>([]);
  const [pairRows, setPairRows] = useState<PairRow[]>([]);
  const [playerPools, setPlayerPools] = useState<
    Record<string, SplitPool>
  >({});
  const [splitView, setSplitView] = useState<"prelims" | "pairs">(
    "prelims"
  );
  const [format, setFormat] = useState<
    "individual" | "team_groups" | "split_pairs"
  >("individual");
  const [tournamentName, setTournamentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    setLoading(true);
    setMessage("");

    try {
      const tournamentId =
        localStorage.getItem("activeTournamentId");

      if (!tournamentId) {
        setMessage("No active tournament found.");
        return;
      }

      const { data: tournament, error: tournamentError } =
        await supabase
          .from("tournaments")
          .select("id, name, format")
          .eq("id", tournamentId)
          .single();

      if (tournamentError) {
        throw tournamentError;
      }

      setTournamentName(tournament.name);

      if (tournament.format === "team_groups") {
        setFormat("team_groups");

        const [
          { data: teams, error: teamsError },
          { data: standings, error: standingsError },
        ] = await Promise.all([
          supabase
            .from("teams")
            .select("id, name, group_name")
            .eq("tournament_id", tournamentId),
          supabase
            .from("team_standings")
            .select(
              "team_id, matches_played, match_wins, match_losses, fixture_wins, fixture_losses"
            )
            .eq("tournament_id", tournamentId),
        ]);

        if (teamsError) {
          throw teamsError;
        }

        if (standingsError) {
          throw standingsError;
        }

        const teamMap = new Map(
          (teams || []).map((team) => [team.id, team])
        );

        setTeamRows(
          rankTeams(standings || []).map((standing) => {
            const team = teamMap.get(standing.team_id);

            return {
              ...standing,
              name: team?.name || "Team",
              group_name: team?.group_name || "",
            };
          })
        );
        setRows([]);
        return;
      }

      setFormat(
        tournament.format === "split_pairs" ? "split_pairs" : "individual"
      );

      const { data: players, error: playersError } =
        await supabase
          .from("players")
          .select("id, name")
          .eq("tournament_id", tournamentId)
          .eq("active", true);

      if (playersError) {
        throw playersError;
      }

      if (tournament.format === "split_pairs") {
        const [
          { data: fixedPairs, error: pairError },
          { data: pairStandings, error: pairStandingsError },
        ] = await Promise.all([
          supabase
            .from("fixed_pairs")
            .select("id,pool_name")
            .eq("tournament_id", tournamentId),
          supabase
            .from("fixed_pair_standings")
            .select("*")
            .eq("tournament_id", tournamentId),
        ]);

        if (pairError) throw pairError;
        if (pairStandingsError) throw pairStandingsError;

        const fixedPairIds = (fixedPairs || []).map((pair) => pair.id);
        let memberRows: { pair_id: string; player_id: string }[] = [];

        if (fixedPairIds.length > 0) {
          const { data, error: memberError } = await supabase
            .from("fixed_pair_players")
            .select("pair_id,player_id")
            .in("pair_id", fixedPairIds);

          if (memberError) throw memberError;
          memberRows = data || [];
        }

        const playerNames = new Map(
          (players || []).map((player) => [player.id, player.name])
        );
        const fixedPairMap = new Map(
          (fixedPairs || []).map((pair) => [pair.id, pair])
        );

        const pools: Record<string, SplitPool> = {};

        memberRows.forEach((member) => {
          const pool = fixedPairMap.get(member.pair_id)?.pool_name;

          if (pool) {
            pools[member.player_id] = pool as SplitPool;
          }
        });

        const ranked = rankFixedPairs(pairStandings || []).map(
          (standing) => {
            const pair = fixedPairMap.get(standing.pair_id);

            return {
              ...standing,
              pool_name: (pair?.pool_name || "top") as SplitPool,
              player_names: memberRows
                .filter((member) => member.pair_id === standing.pair_id)
                .map(
                  (member) =>
                    playerNames.get(member.player_id) || "Unknown Player"
                )
                .join(" + "),
            };
          }
        );

        setPlayerPools(pools);
        setPairRows(ranked);

        // Pair results only exist once the round robins start, so open
        // on the prelim ranking until a pair has actually played.
        setSplitView(
          ranked.some((row) => row.matches_played > 0)
            ? "pairs"
            : "prelims"
        );
      } else {
        setPairRows([]);
        setPlayerPools({});
      }

      const { data: standings, error: standingsError } =
        await supabase
          .from("player_standings")
          .select(
            "player_id, matches_played, wins, losses, points_for, points_against, tournament_points"
          )
          .eq("tournament_id", tournamentId);

      if (standingsError) {
        throw standingsError;
      }

      const playerMap = new Map<string, string>();

      (players || []).forEach((player: Player) => {
        playerMap.set(player.id, player.name);
      });

      const sorted = [...(standings || [])].sort((a, b) => {
        const tournamentPoints =
          Number(b.tournament_points) -
          Number(a.tournament_points);

        if (tournamentPoints !== 0) {
          return tournamentPoints;
        }

        const wins = Number(b.wins) - Number(a.wins);

        if (wins !== 0) {
          return wins;
        }

        const pointDifferenceA =
          Number(a.points_for) - Number(a.points_against);
        const pointDifferenceB =
          Number(b.points_for) - Number(b.points_against);

        if (pointDifferenceB !== pointDifferenceA) {
          return pointDifferenceB - pointDifferenceA;
        }

        return Number(b.points_for) - Number(a.points_for);
      });

      const leaderboard: LeaderboardRow[] = sorted.map(
        (standing, index) => ({
          ...standing,
          player_name:
            playerMap.get(standing.player_id) || "Unknown Player",
          rank: index + 1,
        })
      );

      setRows(leaderboard);
      setTeamRows([]);
    } catch (error) {
      console.error(error);

      setMessage(describeError(error, "Unable to load leaderboard."));
    } finally {
      setLoading(false);
    }
  }

  const splitPairsReady = format === "split_pairs" && pairRows.length > 0;
  const showPairStandings = splitPairsReady && splitView === "pairs";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {format === "team_groups"
                ? "👥 Team Standings"
                : showPairStandings
                  ? "🔀 Split Pair Standings"
                : format === "split_pairs"
                  ? "🏸 Preliminary Ranking"
                : "🏸 Tournament Leaderboard"}
            </h1>

            {tournamentName && (
              <p className="mt-2 text-slate-400">{tournamentName}</p>
            )}
          </div>

          <AppNav
            links={[
              format === "team_groups"
                ? "team-center"
                : format === "split_pairs" && pairRows.length > 0
                  ? "split-pairs-center"
                  : "control-center",
              "history",
              "format",
            ]}
          >
            <button
              onClick={loadLeaderboard}
              className="min-h-11 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-800 sm:px-4"
            >
              🔄 Refresh
            </button>
          </AppNav>
        </div>

        {splitPairsReady && !loading && !message && (
          <div className="mb-6 inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
            {(
              [
                ["prelims", "🏸 Prelim ranking"],
                ["pairs", "🔀 Pair standings"],
              ] as const
            ).map(([view, label]) => (
              <button
                key={view}
                onClick={() => setSplitView(view)}
                className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  splitView === view
                    ? "bg-emerald-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
            Loading leaderboard...
          </div>
        ) : message ? (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-6 text-red-300">
            {message}
          </div>
        ) : format === "team_groups" ? (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-800 text-sm uppercase text-slate-300">
                  <tr>
                    <th className="px-4 py-4">Rank</th>
                    <th className="px-4 py-4">Team</th>
                    <th className="px-4 py-4 text-center">Group</th>
                    <th className="px-4 py-4 text-center">Match wins</th>
                    <th className="px-4 py-4 text-center">Match losses</th>
                    <th className="px-4 py-4 text-center">Fixtures</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRows.map((row, index) => (
                    <tr
                      key={row.team_id}
                      className="border-t border-slate-800"
                    >
                      <td className="px-4 py-4 font-bold text-emerald-400">
                        #{index + 1}
                      </td>
                      <td className="px-4 py-4 font-semibold">{row.name}</td>
                      <td className="px-4 py-4 text-center">
                        {row.group_name}
                      </td>
                      <td className="px-4 py-4 text-center text-emerald-400">
                        {row.match_wins}
                      </td>
                      <td className="px-4 py-4 text-center text-red-400">
                        {row.match_losses}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {row.fixture_wins}-{row.fixture_losses}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {teamRows.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                No team standings yet.
              </div>
            )}
          </div>
        ) : showPairStandings ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {(["top", "bottom"] as SplitPool[]).map((pool) => (
              <section
                key={pool}
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
              >
                <h2 className="bg-slate-800 px-4 py-4 text-lg font-black">
                  {poolLabel(pool)}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Pair</th>
                        <th className="px-4 py-3 text-center">W-L</th>
                        <th className="px-4 py-3 text-center">Diff</th>
                        <th className="px-4 py-3 text-center">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pairRows
                        .filter((row) => row.pool_name === pool)
                        .map((row, index) => (
                          <tr
                            key={row.pair_id}
                            className="border-t border-slate-800"
                          >
                            <td className="px-4 py-3 font-black text-emerald-400">
                              #{index + 1}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {row.player_names}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.wins}-{row.losses}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.points_for - row.points_against}
                            </td>
                            <td className="px-4 py-3 text-center font-black text-yellow-400">
                              {row.standing_points}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-800 text-sm uppercase text-slate-300">
                  <tr>
                    <th className="px-4 py-4">Rank</th>
                    <th className="px-4 py-4">Player</th>
                    {splitPairsReady && (
                      <th className="px-4 py-4 text-center">Draw</th>
                    )}
                    <th className="px-4 py-4 text-center">Played</th>
                    <th className="px-4 py-4 text-center">Wins</th>
                    <th className="px-4 py-4 text-center">Losses</th>
                    <th className="px-4 py-4 text-center">Points For</th>
                    <th className="px-4 py-4 text-center">Points Against</th>
                    <th className="px-4 py-4 text-center">
                      Tournament Points
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.player_id}
                      className={`border-t border-slate-800 ${
                        row.rank <= (format === "split_pairs" ? 10 : 16)
                          ? "bg-emerald-950/20"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-4 font-bold">
                        <span
                          className={
                            row.rank <= (format === "split_pairs" ? 10 : 16)
                              ? "text-emerald-400"
                              : ""
                          }
                        >
                          #{row.rank}
                        </span>
                      </td>

                      <td className="px-4 py-4 font-semibold">
                        {row.player_name}
                      </td>

                      {splitPairsReady && (
                        <td className="px-4 py-4 text-center text-slate-300">
                          {playerPools[row.player_id]
                            ? poolLabel(playerPools[row.player_id])
                            : "—"}
                        </td>
                      )}

                      <td className="px-4 py-4 text-center">
                        {row.matches_played}
                      </td>

                      <td className="px-4 py-4 text-center text-emerald-400">
                        {row.wins}
                      </td>

                      <td className="px-4 py-4 text-center text-red-400">
                        {row.losses}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {Number(row.points_for).toFixed(1)}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {Number(row.points_against).toFixed(1)}
                      </td>

                      <td className="px-4 py-4 text-center font-bold text-yellow-400">
                        {Number(row.tournament_points).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                No standings available yet.
              </div>
            )}
          </div>
        )}

        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
          {format === "team_groups" ? (
            <>
              <strong className="text-white">Qualification:</strong> Top 2
              teams in each group qualify. Semis are A1 vs B2 and A2 vs B1.
              Ranked by match wins, then fixture wins.
            </>
          ) : format === "split_pairs" ? (
            <>
              <strong className="text-white">Split Pairs:</strong>{" "}
              Prelims rank all 20 players. Fixed pairs then earn 2
              points per round-robin win; the top 4 in each draw
              advance to separate semifinals.
            </>
          ) : (
            <>
              <strong className="text-white">Qualification:</strong> Top 16
              players after the preliminary rounds qualify for the
              Quarterfinals.
            </>
          )}
        </div>
      </div>
    </main>
  );
}
