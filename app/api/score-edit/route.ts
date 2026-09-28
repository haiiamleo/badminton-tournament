import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  describeDraftResult,
  describeStoredResult,
  type CompletedMatchView,
  type ScoreDraft,
} from "@/lib/individualMatchEdit";

export const dynamic = "force-dynamic";

function passwordsMatch(provided: string, configured: string) {
  const providedBytes = Buffer.from(provided);
  const configuredBytes = Buffer.from(configured);

  if (providedBytes.length !== configuredBytes.length) {
    return false;
  }

  return timingSafeEqual(providedBytes, configuredBytes);
}

export async function POST(request: Request) {
  const configured = process.env.SCORE_EDIT_PASSWORD;

  if (!configured) {
    return NextResponse.json(
      {
        error:
          "Score editing is not configured. Set SCORE_EDIT_PASSWORD on the server.",
      },
      { status: 503 }
    );
  }

  let password = "";
  let tournamentId = "";
  let matchId = "";
  let draft: ScoreDraft | null = null;

  try {
    const body = (await request.json()) as {
      password?: unknown;
      tournamentId?: unknown;
      matchId?: unknown;
      draft?: unknown;
    };
    if (typeof body.password === "string") {
      password = body.password.slice(0, 200);
    }
    if (typeof body.tournamentId === "string") {
      tournamentId = body.tournamentId;
    }
    if (typeof body.matchId === "string") {
      matchId = body.matchId;
    }
    if (body.draft && typeof body.draft === "object") {
      draft = body.draft as ScoreDraft;
    }
  } catch {
    password = "";
  }

  if (!password || !passwordsMatch(password, configured)) {
    return NextResponse.json(
      { error: "Incorrect password." },
      { status: 401 }
    );
  }

  if (!tournamentId || !matchId || !draft) {
    return NextResponse.json(
      { error: "Missing score correction details." },
      { status: 400 }
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("id, format")
      .eq("id", tournamentId)
      .maybeSingle();

    if (tournamentError) {
      throw tournamentError;
    }

    if (
      !tournament ||
      (tournament.format && tournament.format !== "individual")
    ) {
      return NextResponse.json(
        { error: "Only individual-format scores can be corrected here." },
        { status: 400 }
      );
    }

    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, round_id, match_number, court_number, team1_score, team2_score, winner_team, status, game_scores"
      )
      .eq("id", matchId)
      .eq("status", "completed")
      .maybeSingle();

    if (matchError) {
      throw matchError;
    }

    if (!match) {
      return NextResponse.json(
        { error: "Only a finished match can be edited." },
        { status: 409 }
      );
    }

    const [{ data: round, error: roundError }, { data: members, error: memberError }] =
      await Promise.all([
        supabase
          .from("rounds")
          .select("id, tournament_id, round_number, round_type")
          .eq("id", match.round_id)
          .eq("tournament_id", tournamentId)
          .maybeSingle(),
        supabase
          .from("match_players")
          .select("player_id, team_number")
          .eq("match_id", matchId),
      ]);

    if (roundError) {
      throw roundError;
    }
    if (memberError) {
      throw memberError;
    }
    if (!round) {
      return NextResponse.json(
        { error: "This match does not belong to the selected tournament." },
        { status: 400 }
      );
    }

    const team1Players = (members || [])
      .filter((member) => member.team_number === 1)
      .map((member) => ({ id: member.player_id, name: "" }));
    const team2Players = (members || [])
      .filter((member) => member.team_number === 2)
      .map((member) => ({ id: member.player_id, name: "" }));

    if (team1Players.length !== 2 || team2Players.length !== 2) {
      return NextResponse.json(
        { error: "Each doubles team must contain two players." },
        { status: 409 }
      );
    }

    const stored: CompletedMatchView = {
      id: match.id,
      roundId: match.round_id,
      roundNumber: Number(round.round_number),
      roundType: round.round_type,
      matchNumber: match.match_number,
      courtNumber: match.court_number,
      team1Score: match.team1_score,
      team2Score: match.team2_score,
      winnerTeam: match.winner_team,
      gameScores: match.game_scores,
      status: match.status,
      team1Players,
      team2Players,
      matchesInRound: 1,
      laterRoundExists: false,
    };
    const previous = describeStoredResult(stored);
    const next = describeDraftResult(round.round_type, draft);

    const subtract = (
      before: typeof previous.points.team1,
      after: typeof next.points.team1
    ) => ({
      pointsFor: after.pointsFor - before.pointsFor,
      pointsAgainst: after.pointsAgainst - before.pointsAgainst,
      tournamentPoints:
        after.tournamentPoints - before.tournamentPoints,
      win: after.win - before.win,
      loss: after.loss - before.loss,
    });
    const team1Delta = subtract(
      previous.points.team1,
      next.points.team1
    );
    const team2Delta = subtract(
      previous.points.team2,
      next.points.team2
    );

    const playerDeltas = [
      ...team1Players.map((player) => ({
        playerId: player.id,
        delta: team1Delta,
      })),
      ...team2Players.map((player) => ({
        playerId: player.id,
        delta: team2Delta,
      })),
    ];

    for (const entry of playerDeltas) {
      const { data: standing, error: standingError } = await supabase
        .from("player_standings")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("player_id", entry.playerId)
        .single();

      if (standingError) {
        throw standingError;
      }

      const { error: updateError } = await supabase
        .from("player_standings")
        .update({
          wins: Number(standing.wins || 0) + entry.delta.win,
          losses: Number(standing.losses || 0) + entry.delta.loss,
          points_for:
            Number(standing.points_for || 0) + entry.delta.pointsFor,
          points_against:
            Number(standing.points_against || 0) +
            entry.delta.pointsAgainst,
          tournament_points:
            Number(standing.tournament_points || 0) +
            entry.delta.tournamentPoints,
        })
        .eq("tournament_id", tournamentId)
        .eq("player_id", entry.playerId);

      if (updateError) {
        throw updateError;
      }
    }

    const { data: updated, error: updateMatchError } = await supabase
      .from("matches")
      .update({
        team1_score: next.team1Score,
        team2_score: next.team2Score,
        winner_team: next.winnerTeam,
        game_scores: next.gameScores,
      })
      .eq("id", matchId)
      .eq("status", "completed")
      .select("id")
      .maybeSingle();

    if (updateMatchError) {
      throw updateMatchError;
    }
    if (!updated) {
      throw new Error("The finished match changed before it was updated.");
    }

    return NextResponse.json({
      ok: true,
      winnerChanged: previous.winnerTeam !== next.winnerTeam,
    });
  } catch (error) {
    console.error("Score correction failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update this score.",
      },
      { status: 500 }
    );
  }
}
