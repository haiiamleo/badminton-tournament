"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppNav from "@/app/components/AppNav";
import {
  MATCHES_PER_FIXTURE,
  defaultPairings,
  getCourtNumber,
  rankTeams,
  roundRobinPairs,
} from "@/lib/teamTournament";
import {
  sanitizeScoreInput,
  scoreRuleHint,
  validateCompletedScore,
} from "@/lib/scoreValidation";

type Tournament = {
  id: string;
  name: string;
  courts: number;
  format?: string;
  team_size?: number | null;
  status: string;
};

type Player = {
  id: string;
  name: string;
};

type Team = {
  id: string;
  name: string;
  group_name: string;
  seed: number;
};

type Standing = {
  team_id: string;
  matches_played: number;
  match_wins: number;
  match_losses: number;
  fixture_wins: number;
  fixture_losses: number;
};

type Fixture = {
  id: string;
  round_id: string;
  group_name: string | null;
  team1_id: string;
  team2_id: string;
  stage: string;
  status: string;
  team1_match_wins: number;
  team2_match_wins: number;
  winner_team_id: string | null;
};

type Match = {
  id: string;
  round_id: string;
  fixture_id: string | null;
  fixture_slot: number | null;
  court_number: number | null;
  match_number: number;
  team1_score: number | null;
  team2_score: number | null;
  winner_team: number | null;
  status: string;
};

type MatchPlayer = {
  match_id: string;
  player_id: string;
  team_number: number;
};

type ScoreInput = {
  team1: string;
  team2: string;
};

type PairingInput = {
  t1a: string;
  t1b: string;
  t2a: string;
  t2b: string;
};

function stageTitle(stage: string) {
  if (stage === "group") return "Group fixture";
  if (stage === "semifinal") return "Semifinal";
  if (stage === "third_place") return "3rd Place";
  if (stage === "final") return "Final";
  return stage;
}

export default function TeamCenterPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<
    Record<string, Player[]>
  >({});
  const [standings, setStandings] = useState<Standing[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayer[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreInput>>({});
  const [pairings, setPairings] = useState<Record<string, PairingInput>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const teamMap = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams]
  );

  const load = useCallback(async () => {
    try {
      setError("");

      const tournamentId = localStorage.getItem("activeTournamentId");

      if (!tournamentId) {
        setTournament(null);
        return;
      }

      const { data: tournamentData, error: tournamentError } =
        await supabase
          .from("tournaments")
          .select("*")
          .eq("id", tournamentId)
          .single();

      if (tournamentError) {
        throw tournamentError;
      }

      setTournament(tournamentData as Tournament);

      const [
        playersResponse,
        teamsResponse,
        standingsResponse,
        fixturesResponse,
      ] = await Promise.all([
        supabase
          .from("players")
          .select("id,name")
          .eq("tournament_id", tournamentId)
          .order("name"),
        supabase
          .from("teams")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("seed"),
        supabase
          .from("team_standings")
          .select("*")
          .eq("tournament_id", tournamentId),
        supabase
          .from("fixtures")
          .select("*")
          .eq("tournament_id", tournamentId),
      ]);

      if (playersResponse.error) throw playersResponse.error;
      if (teamsResponse.error) throw teamsResponse.error;
      if (standingsResponse.error) throw standingsResponse.error;
      if (fixturesResponse.error) throw fixturesResponse.error;

      const loadedPlayers = (playersResponse.data || []) as Player[];
      const loadedTeams = (teamsResponse.data || []) as Team[];
      const loadedFixtures = (fixturesResponse.data || []) as Fixture[];

      setTeams(loadedTeams);
      setStandings((standingsResponse.data || []) as Standing[]);
      setFixtures(loadedFixtures);

      const teamIds = loadedTeams.map((team) => team.id);
      const membership: Record<string, Player[]> = {};

      if (teamIds.length > 0) {
        const { data: memberRows, error: memberError } = await supabase
          .from("team_players")
          .select("team_id, player_id, slot")
          .in("team_id", teamIds)
          .order("slot");

        if (memberError) {
          throw memberError;
        }

        const localPlayerMap = new Map(
          loadedPlayers.map((player) => [player.id, player])
        );

        loadedTeams.forEach((team) => {
          membership[team.id] = (memberRows || [])
            .filter((row) => row.team_id === team.id)
            .map((row) => localPlayerMap.get(row.player_id))
            .filter(Boolean) as Player[];
        });
      }

      setTeamPlayers(membership);

      if (loadedFixtures.length === 0) {
        setMatches([]);
        setMatchPlayers([]);
        return;
      }

      const fixtureIds = loadedFixtures.map((fixture) => fixture.id);

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .in("fixture_id", fixtureIds)
        .order("fixture_slot");

      if (matchError) {
        throw matchError;
      }

      const loadedMatches = (matchData || []) as Match[];
      setMatches(loadedMatches);

      const matchIds = loadedMatches.map((match) => match.id);
      let loadedMatchPlayers: MatchPlayer[] = [];

      if (matchIds.length > 0) {
        const { data: matchPlayerData, error: matchPlayerError } =
          await supabase
            .from("match_players")
            .select("match_id, player_id, team_number")
            .in("match_id", matchIds);

        if (matchPlayerError) {
          throw matchPlayerError;
        }

        loadedMatchPlayers = (matchPlayerData || []) as MatchPlayer[];
        setMatchPlayers(loadedMatchPlayers);
      }

      const nextScores: Record<string, ScoreInput> = {};
      const nextPairings: Record<string, PairingInput> = {};

      loadedMatches.forEach((match) => {
        nextScores[match.id] = {
          team1:
            match.team1_score === null ? "" : String(match.team1_score),
          team2:
            match.team2_score === null ? "" : String(match.team2_score),
        };

        const entries = loadedMatchPlayers.filter(
          (entry) => entry.match_id === match.id
        );
        const team1 = entries.filter((entry) => entry.team_number === 1);
        const team2 = entries.filter((entry) => entry.team_number === 2);

        nextPairings[match.id] = {
          t1a: team1[0]?.player_id || "",
          t1b: team1[1]?.player_id || "",
          t2a: team2[0]?.player_id || "",
          t2b: team2[1]?.player_id || "",
        };
      });

      setScores(nextScores);
      setPairings(nextPairings);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the team tournament."
      );
    } finally {
      setLoading(false);
      setWorking(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groupedStandings = useMemo(() => {
    const byGroup: Record<string, (Standing & { team?: Team })[]> = {
      A: [],
      B: [],
    };

    standings.forEach((standing) => {
      const team = teamMap.get(standing.team_id);

      if (!team) {
        return;
      }

      byGroup[team.group_name]?.push({
        ...standing,
        team,
      });
    });

    byGroup.A = rankTeams(byGroup.A);
    byGroup.B = rankTeams(byGroup.B);

    return byGroup;
  }, [standings, teamMap]);

  const groupFixturesComplete =
    fixtures.filter((fixture) => fixture.stage === "group").length > 0 &&
    fixtures
      .filter((fixture) => fixture.stage === "group")
      .every((fixture) => fixture.status === "completed");

  const semisComplete =
    fixtures.filter((fixture) => fixture.stage === "semifinal").length ===
      2 &&
    fixtures
      .filter((fixture) => fixture.stage === "semifinal")
      .every((fixture) => fixture.status === "completed");

  const hasSemis = fixtures.some((fixture) => fixture.stage === "semifinal");
  const hasFinal = fixtures.some((fixture) => fixture.stage === "final");

  async function createFixtureMatches(
    roundId: string,
    fixtureId: string,
    team1Id: string,
    team2Id: string,
    courts: number,
    startIndex: number
  ) {
    const team1Ids = (teamPlayers[team1Id] || []).map((player) => player.id);
    const team2Ids = (teamPlayers[team2Id] || []).map((player) => player.id);
    const team1Pairs = defaultPairings(team1Ids);
    const team2Pairs = defaultPairings(team2Ids);

    const matchRows = Array.from({ length: MATCHES_PER_FIXTURE }, (_, index) => ({
      round_id: roundId,
      fixture_id: fixtureId,
      fixture_slot: index + 1,
      court_number: getCourtNumber(
        startIndex + index,
        MATCHES_PER_FIXTURE,
        courts
      ),
      match_number: startIndex + index + 1,
      team1_score: null,
      team2_score: null,
      winner_team: null,
      status: "scheduled",
    }));

    const { data: insertedMatches, error: matchError } = await supabase
      .from("matches")
      .insert(matchRows)
      .select();

    if (matchError) {
      throw matchError;
    }

    const sorted = [...(insertedMatches || [])].sort(
      (a, b) => (a.fixture_slot || 0) - (b.fixture_slot || 0)
    );

    const matchPlayerRows: {
      match_id: string;
      player_id: string;
      team_number: number;
    }[] = [];

    sorted.forEach((match, index) => {
      const pair1 = team1Pairs[index] || ["", ""];
      const pair2 = team2Pairs[index] || ["", ""];

      pair1.forEach((playerId) => {
        if (playerId) {
          matchPlayerRows.push({
            match_id: match.id,
            player_id: playerId,
            team_number: 1,
          });
        }
      });

      pair2.forEach((playerId) => {
        if (playerId) {
          matchPlayerRows.push({
            match_id: match.id,
            player_id: playerId,
            team_number: 2,
          });
        }
      });
    });

    if (matchPlayerRows.length > 0) {
      const { error: matchPlayerError } = await supabase
        .from("match_players")
        .insert(matchPlayerRows);

      if (matchPlayerError) {
        throw matchPlayerError;
      }
    }
  }

  async function generateGroupStage() {
    if (!tournament) {
      return;
    }

    try {
      setWorking(true);
      setError("");
      setSuccess("");

      if (fixtures.length > 0) {
        throw new Error("Group stage is already generated.");
      }

      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .insert({
          tournament_id: tournament.id,
          round_number: 1,
          round_type: "preliminary",
          status: "generated",
        })
        .select()
        .single();

      if (roundError) {
        throw roundError;
      }

      const groupA = teams.filter((team) => team.group_name === "A");
      const groupB = teams.filter((team) => team.group_name === "B");
      const pairs = [
        ...roundRobinPairs(groupA).map((pair) => ({
          pair,
          group_name: "A",
        })),
        ...roundRobinPairs(groupB).map((pair) => ({
          pair,
          group_name: "B",
        })),
      ];

      let matchIndex = 0;

      for (const item of pairs) {
        const { data: fixtureData, error: fixtureError } = await supabase
          .from("fixtures")
          .insert({
            tournament_id: tournament.id,
            round_id: roundData.id,
            group_name: item.group_name,
            team1_id: item.pair[0].id,
            team2_id: item.pair[1].id,
            stage: "group",
            status: "scheduled",
          })
          .select()
          .single();

        if (fixtureError) {
          throw fixtureError;
        }

        await createFixtureMatches(
          roundData.id,
          fixtureData.id,
          item.pair[0].id,
          item.pair[1].id,
          tournament.courts,
          matchIndex
        );

        matchIndex += MATCHES_PER_FIXTURE;
      }

      await supabase
        .from("tournaments")
        .update({ status: "in_progress" })
        .eq("id", tournament.id);

      setSuccess("Group stage generated. Set pairings, then save scores.");
      await load();
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate the group stage."
      );
      setWorking(false);
    }
  }

  async function generateSemifinals() {
    if (!tournament) {
      return;
    }

    try {
      setWorking(true);
      setError("");

      const a1 = groupedStandings.A[0]?.team;
      const a2 = groupedStandings.A[1]?.team;
      const b1 = groupedStandings.B[0]?.team;
      const b2 = groupedStandings.B[1]?.team;

      if (!a1 || !a2 || !b1 || !b2) {
        throw new Error("Each group needs at least two teams for the semis.");
      }

      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .insert({
          tournament_id: tournament.id,
          round_number: 2,
          round_type: "semifinal",
          status: "generated",
        })
        .select()
        .single();

      if (roundError) {
        throw roundError;
      }

      const semiPairs = [
        [a1, b2],
        [a2, b1],
      ] as const;

      for (const [index, pair] of semiPairs.entries()) {
        const { data: fixtureData, error: fixtureError } = await supabase
          .from("fixtures")
          .insert({
            tournament_id: tournament.id,
            round_id: roundData.id,
            group_name: null,
            team1_id: pair[0].id,
            team2_id: pair[1].id,
            stage: "semifinal",
            status: "scheduled",
          })
          .select()
          .single();

        if (fixtureError) {
          throw fixtureError;
        }

        await createFixtureMatches(
          roundData.id,
          fixtureData.id,
          pair[0].id,
          pair[1].id,
          tournament.courts,
          index * MATCHES_PER_FIXTURE
        );
      }

      setSuccess("Semifinals generated: A1 vs B2 and A2 vs B1.");
      await load();
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate the semifinals."
      );
      setWorking(false);
    }
  }

  async function generateFinals() {
    if (!tournament) {
      return;
    }

    try {
      setWorking(true);
      setError("");

      const semis = fixtures.filter((fixture) => fixture.stage === "semifinal");

      if (semis.length !== 2 || semis.some((fixture) => !fixture.winner_team_id)) {
        throw new Error("Complete both semifinals first.");
      }

      const winners = semis.map((fixture) => fixture.winner_team_id!) ;
      const losers = semis.map((fixture) =>
        fixture.winner_team_id === fixture.team1_id
          ? fixture.team2_id
          : fixture.team1_id
      );

      const { data: thirdRound, error: thirdError } = await supabase
        .from("rounds")
        .insert({
          tournament_id: tournament.id,
          round_number: 3,
          round_type: "third_place",
          status: "generated",
        })
        .select()
        .single();

      if (thirdError) {
        throw thirdError;
      }

      const { data: finalRound, error: finalError } = await supabase
        .from("rounds")
        .insert({
          tournament_id: tournament.id,
          round_number: 4,
          round_type: "final",
          status: "generated",
        })
        .select()
        .single();

      if (finalError) {
        throw finalError;
      }

      const { data: thirdFixture, error: thirdFixtureError } = await supabase
        .from("fixtures")
        .insert({
          tournament_id: tournament.id,
          round_id: thirdRound.id,
          team1_id: losers[0],
          team2_id: losers[1],
          stage: "third_place",
          status: "scheduled",
        })
        .select()
        .single();

      if (thirdFixtureError) {
        throw thirdFixtureError;
      }

      const { data: finalFixture, error: finalFixtureError } = await supabase
        .from("fixtures")
        .insert({
          tournament_id: tournament.id,
          round_id: finalRound.id,
          team1_id: winners[0],
          team2_id: winners[1],
          stage: "final",
          status: "scheduled",
        })
        .select()
        .single();

      if (finalFixtureError) {
        throw finalFixtureError;
      }

      await createFixtureMatches(
        thirdRound.id,
        thirdFixture.id,
        losers[0],
        losers[1],
        tournament.courts,
        0
      );

      await createFixtureMatches(
        finalRound.id,
        finalFixture.id,
        winners[0],
        winners[1],
        tournament.courts,
        MATCHES_PER_FIXTURE
      );

      setSuccess("3rd place match and Final generated.");
      await load();
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate the finals."
      );
      setWorking(false);
    }
  }

  async function savePairings(fixture: Fixture) {
    try {
      setWorking(true);
      setError("");

      const fixtureMatches = matches.filter(
        (match) => match.fixture_id === fixture.id
      );

      for (const match of fixtureMatches) {
        if (match.status === "completed") {
          continue;
        }

        const pairing = pairings[match.id];

        if (
          !pairing ||
          !pairing.t1a ||
          !pairing.t1b ||
          !pairing.t2a ||
          !pairing.t2b
        ) {
          throw new Error("Set both doubles pairs for every match.");
        }

        const { error: deleteError } = await supabase
          .from("match_players")
          .delete()
          .eq("match_id", match.id);

        if (deleteError) {
          throw deleteError;
        }

        const { error: insertError } = await supabase
          .from("match_players")
          .insert([
            { match_id: match.id, player_id: pairing.t1a, team_number: 1 },
            { match_id: match.id, player_id: pairing.t1b, team_number: 1 },
            { match_id: match.id, player_id: pairing.t2a, team_number: 2 },
            { match_id: match.id, player_id: pairing.t2b, team_number: 2 },
          ]);

        if (insertError) {
          throw insertError;
        }
      }

      setSuccess(`Pairing order saved for ${stageTitle(fixture.stage)}.`);
      await load();
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save pairings."
      );
      setWorking(false);
    }
  }

  async function saveMatch(match: Match, fixture: Fixture) {
    try {
      setWorking(true);
      setError("");
      setSuccess("");

      const score = scores[match.id];

      if (!score || score.team1 === "" || score.team2 === "") {
        throw new Error("Enter both scores.");
      }

      const team1Score = Number(score.team1);
      const team2Score = Number(score.team2);
      const roundType =
        fixture.stage === "group" ? "preliminary" : fixture.stage;
      const scoreError = validateCompletedScore(
        team1Score,
        team2Score,
        roundType
      );

      if (scoreError) {
        throw new Error(scoreError);
      }

      const winnerTeam = team1Score > team2Score ? 1 : 2;

      const { data: updatedMatch, error: matchError } = await supabase
        .from("matches")
        .update({
          team1_score: team1Score,
          team2_score: team2Score,
          winner_team: winnerTeam,
          status: "completed",
        })
        .eq("id", match.id)
        .eq("status", "scheduled")
        .select("id")
        .maybeSingle();

      if (matchError) {
        throw matchError;
      }

      if (!updatedMatch) {
        throw new Error("This match was already saved.");
      }

      const winnerTeamId =
        winnerTeam === 1 ? fixture.team1_id : fixture.team2_id;
      const loserTeamId =
        winnerTeam === 1 ? fixture.team2_id : fixture.team1_id;

      if (fixture.stage === "group") {
        for (const [teamId, isWinner] of [
          [winnerTeamId, true],
          [loserTeamId, false],
        ] as const) {
          const { data: standing, error: standingError } = await supabase
            .from("team_standings")
            .select("*")
            .eq("tournament_id", tournament!.id)
            .eq("team_id", teamId)
            .single();

          if (standingError) {
            throw standingError;
          }

          const { error: standingUpdateError } = await supabase
            .from("team_standings")
            .update({
              matches_played: Number(standing.matches_played) + 1,
              match_wins:
                Number(standing.match_wins) + (isWinner ? 1 : 0),
              match_losses:
                Number(standing.match_losses) + (isWinner ? 0 : 1),
            })
            .eq("tournament_id", tournament!.id)
            .eq("team_id", teamId);

          if (standingUpdateError) {
            throw standingUpdateError;
          }
        }
      }

      const team1Wins =
        Number(fixture.team1_match_wins) + (winnerTeam === 1 ? 1 : 0);
      const team2Wins =
        Number(fixture.team2_match_wins) + (winnerTeam === 2 ? 1 : 0);
      const fixtureMatches = matches.filter(
        (item) => item.fixture_id === fixture.id
      );
      const completedCount =
        fixtureMatches.filter(
          (item) => item.status === "completed" || item.id === match.id
        ).length;
      const fixtureComplete = completedCount === MATCHES_PER_FIXTURE;
      const winnerId = fixtureComplete
        ? team1Wins > team2Wins
          ? fixture.team1_id
          : fixture.team2_id
        : null;

      const { error: fixtureError } = await supabase
        .from("fixtures")
        .update({
          team1_match_wins: team1Wins,
          team2_match_wins: team2Wins,
          status: fixtureComplete ? "completed" : "in_progress",
          winner_team_id: winnerId,
        })
        .eq("id", fixture.id);

      if (fixtureError) {
        throw fixtureError;
      }

      if (fixtureComplete && winnerId) {
        if (fixture.stage === "group") {
          const loserId =
            winnerId === fixture.team1_id
              ? fixture.team2_id
              : fixture.team1_id;

          for (const [teamId, won] of [
            [winnerId, true],
            [loserId, false],
          ] as const) {
            const { data: standing, error: standingError } = await supabase
              .from("team_standings")
              .select("*")
              .eq("tournament_id", tournament!.id)
              .eq("team_id", teamId)
              .single();

            if (standingError) {
              throw standingError;
            }

            const { error: standingUpdateError } = await supabase
              .from("team_standings")
              .update({
                fixture_wins:
                  Number(standing.fixture_wins) + (won ? 1 : 0),
                fixture_losses:
                  Number(standing.fixture_losses) + (won ? 0 : 1),
              })
              .eq("tournament_id", tournament!.id)
              .eq("team_id", teamId);

            if (standingUpdateError) {
              throw standingUpdateError;
            }
          }
        }

        if (fixture.stage === "final") {
          await supabase
            .from("tournaments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", tournament!.id);
        }
      }

      setSuccess("Match saved. Team win recorded.");
      await load();
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save the match."
      );
      setWorking(false);
    }
  }

  function updateScore(
    matchId: string,
    team: "team1" | "team2",
    value: string
  ) {
    const sanitized = sanitizeScoreInput(value);

    if (sanitized === null) {
      return;
    }

    setScores((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] || { team1: "", team2: "" }),
        [team]: sanitized,
      },
    }));
  }

  function updatePairing(
    matchId: string,
    key: keyof PairingInput,
    value: string
  ) {
    setPairings((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] || {
          t1a: "",
          t1b: "",
          t2a: "",
          t2b: "",
        }),
        [key]: value,
      },
    }));
  }

  const finalFixture = fixtures.find((fixture) => fixture.stage === "final");
  const championTeam = finalFixture?.winner_team_id
    ? teamMap.get(finalFixture.winner_team_id)
    : null;
  const runnerUpTeam =
    finalFixture?.winner_team_id && championTeam
      ? teamMap.get(
          finalFixture.winner_team_id === finalFixture.team1_id
            ? finalFixture.team2_id
            : finalFixture.team1_id
        )
      : null;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex justify-end">
            <AppNav />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            Loading team tournament...
          </div>
        </div>
      </main>
    );
  }

  if (!tournament || tournament.format !== "team_groups") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <h1 className="text-2xl font-black">Team Center</h1>
          <p className="mt-3 text-slate-400">
            No team-group tournament is active. Create one from Home.
          </p>
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 font-bold"
          >
            🏠 Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black md:text-3xl">
              👥 Team Center
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {tournament.name} · {teams.length} teams · groups of{" "}
              {teams.filter((team) => team.group_name === "A").length}
            </p>
          </div>

          <AppNav links={["standings", "history", "format"]}>
            <button
              onClick={load}
              className="min-h-11 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-800 sm:px-4"
            >
              🔄 Refresh
            </button>
          </AppNav>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300">
            {success}
          </div>
        )}

        {championTeam && (
          <section className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-yellow-700 bg-yellow-950/30 p-6 text-center">
              <div className="text-sm font-bold uppercase tracking-widest text-yellow-500">
                Champions
              </div>
              <h2 className="mt-2 text-2xl font-black text-yellow-400">
                {championTeam.name}
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                {(teamPlayers[championTeam.id] || [])
                  .map((player) => player.name)
                  .join(" · ")}
              </p>
            </div>
            {runnerUpTeam && (
              <div className="rounded-2xl border border-slate-600 bg-slate-900 p-6 text-center">
                <div className="text-sm font-bold uppercase tracking-widest text-slate-300">
                  Runners Up
                </div>
                <h2 className="mt-2 text-2xl font-black">
                  {runnerUpTeam.name}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  {(teamPlayers[runnerUpTeam.id] || [])
                    .map((player) => player.name)
                    .join(" · ")}
                </p>
              </div>
            )}
          </section>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-2">
          {(["A", "B"] as const).map((groupName) => (
            <div
              key={groupName}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
            >
              <h2 className="text-xl font-black">Group {groupName}</h2>
              <p className="mt-1 text-xs text-slate-500">
                Ranked by match wins, then fixture wins.
              </p>
              <div className="mt-4 space-y-2">
                {groupedStandings[groupName].map((row, index) => (
                  <div
                    key={row.team_id}
                    className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="mr-2 font-black text-emerald-400">
                        {index + 1}
                      </span>
                      {row.team?.name}
                    </div>
                    <div className="text-slate-400">
                      {row.match_wins} match wins · {row.fixture_wins} fixtures
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {fixtures.length === 0 && (
          <section className="mb-8 rounded-2xl border border-emerald-800 bg-emerald-950/20 p-6">
            <h2 className="text-xl font-black">Ready for group stage</h2>
            <p className="mt-2 text-sm text-slate-400">
              Each team plays the other teams in its group. Every
              fixture has 5 doubles matches. A match win is worth 1
              team point. Top 2 in each group go to the semis.
            </p>
            <button
              onClick={generateGroupStage}
              disabled={working}
              className="mt-4 rounded-xl bg-emerald-600 px-6 py-3 font-bold hover:bg-emerald-500 disabled:opacity-50"
            >
              {working ? "Generating..." : "Generate Group Stage"}
            </button>
          </section>
        )}

        {groupFixturesComplete && !hasSemis && (
          <section className="mb-6 rounded-2xl border border-emerald-800 bg-emerald-950/20 p-6">
            <h2 className="text-xl font-black">Group stage complete</h2>
            <p className="mt-2 text-sm text-slate-400">
              Semifinals: Group A1 vs Group B2, and Group A2 vs Group B1.
            </p>
            <button
              onClick={generateSemifinals}
              disabled={working}
              className="mt-4 rounded-xl bg-emerald-600 px-6 py-3 font-bold hover:bg-emerald-500 disabled:opacity-50"
            >
              Generate Semifinals
            </button>
          </section>
        )}

        {semisComplete && !hasFinal && (
          <section className="mb-6 rounded-2xl border border-yellow-700 bg-yellow-950/20 p-6">
            <h2 className="text-xl font-black">Semifinals complete</h2>
            <p className="mt-2 text-sm text-slate-400">
              Semi losers play for 3rd. Semi winners play the Final.
            </p>
            <button
              onClick={generateFinals}
              disabled={working}
              className="mt-4 rounded-xl bg-yellow-500 px-6 py-3 font-black text-slate-950 hover:bg-yellow-400 disabled:opacity-50"
            >
              Generate 3rd Place + Final
            </button>
          </section>
        )}

        {(["group", "semifinal", "third_place", "final"] as const).map(
          (stage) => {
            const stageFixtures = fixtures.filter(
              (fixture) => fixture.stage === stage
            );

            if (stageFixtures.length === 0) {
              return null;
            }

            return (
              <section key={stage} className="mb-8">
                <h2 className="mb-4 text-2xl font-black">
                  {stageTitle(stage)}
                </h2>

                <div className="space-y-4">
                  {stageFixtures.map((fixture) => {
                    const team1 = teamMap.get(fixture.team1_id);
                    const team2 = teamMap.get(fixture.team2_id);
                    const fixtureMatches = matches.filter(
                      (match) => match.fixture_id === fixture.id
                    );

                    return (
                      <article
                        key={fixture.id}
                        className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-xs uppercase tracking-widest text-slate-500">
                              {fixture.group_name
                                ? `Group ${fixture.group_name}`
                                : stageTitle(fixture.stage)}
                            </div>
                            <h3 className="mt-1 text-xl font-black">
                              {team1?.name} vs {team2?.name}
                            </h3>
                            <p className="mt-1 text-sm text-slate-400">
                              {fixture.team1_match_wins} -{" "}
                              {fixture.team2_match_wins} match wins
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {scoreRuleHint(
                                fixture.stage === "group"
                                  ? "preliminary"
                                  : fixture.stage
                              )}
                            </p>
                          </div>

                          {fixture.status !== "completed" && (
                            <button
                              onClick={() => savePairings(fixture)}
                              disabled={working}
                              className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-400 hover:bg-emerald-950 disabled:opacity-50"
                            >
                              Save pairing order
                            </button>
                          )}
                        </div>

                        <div className="mt-4 space-y-3">
                          {fixtureMatches.map((match) => {
                            const pairing = pairings[match.id] || {
                              t1a: "",
                              t1b: "",
                              t2a: "",
                              t2b: "",
                            };
                            const score = scores[match.id] || {
                              team1: "",
                              team2: "",
                            };
                            const completed = match.status === "completed";
                            const team1Options =
                              teamPlayers[fixture.team1_id] || [];
                            const team2Options =
                              teamPlayers[fixture.team2_id] || [];

                            return (
                              <div
                                key={match.id}
                                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                              >
                                <div className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                                  Match {match.fixture_slot} · Court{" "}
                                  {match.court_number ?? "-"}
                                </div>

                                <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
                                  <div className="grid grid-cols-2 gap-2">
                                    <select
                                      value={pairing.t1a}
                                      disabled={completed}
                                      onChange={(event) =>
                                        updatePairing(
                                          match.id,
                                          "t1a",
                                          event.target.value
                                        )
                                      }
                                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                                    >
                                      <option value="">Player</option>
                                      {team1Options.map((player) => (
                                        <option
                                          key={player.id}
                                          value={player.id}
                                        >
                                          {player.name}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={pairing.t1b}
                                      disabled={completed}
                                      onChange={(event) =>
                                        updatePairing(
                                          match.id,
                                          "t1b",
                                          event.target.value
                                        )
                                      }
                                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                                    >
                                      <option value="">Player</option>
                                      {team1Options.map((player) => (
                                        <option
                                          key={player.id}
                                          value={player.id}
                                        >
                                          {player.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="flex items-center justify-center gap-2">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      maxLength={2}
                                      disabled={completed}
                                      value={score.team1}
                                      onChange={(event) =>
                                        updateScore(
                                          match.id,
                                          "team1",
                                          event.target.value
                                        )
                                      }
                                      className="w-14 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-center text-xl font-black"
                                      placeholder="0"
                                    />
                                    <span className="text-slate-600">-</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      maxLength={2}
                                      disabled={completed}
                                      value={score.team2}
                                      onChange={(event) =>
                                        updateScore(
                                          match.id,
                                          "team2",
                                          event.target.value
                                        )
                                      }
                                      className="w-14 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-center text-xl font-black"
                                      placeholder="0"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <select
                                      value={pairing.t2a}
                                      disabled={completed}
                                      onChange={(event) =>
                                        updatePairing(
                                          match.id,
                                          "t2a",
                                          event.target.value
                                        )
                                      }
                                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                                    >
                                      <option value="">Player</option>
                                      {team2Options.map((player) => (
                                        <option
                                          key={player.id}
                                          value={player.id}
                                        >
                                          {player.name}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={pairing.t2b}
                                      disabled={completed}
                                      onChange={(event) =>
                                        updatePairing(
                                          match.id,
                                          "t2b",
                                          event.target.value
                                        )
                                      }
                                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                                    >
                                      <option value="">Player</option>
                                      {team2Options.map((player) => (
                                        <option
                                          key={player.id}
                                          value={player.id}
                                        >
                                          {player.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {!completed && (
                                  <button
                                    onClick={() => saveMatch(match, fixture)}
                                    disabled={working}
                                    className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
                                  >
                                    Save match win
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          }
        )}
      </div>
    </main>
  );
}
