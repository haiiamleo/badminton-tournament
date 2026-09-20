"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import AppNav from "@/app/components/AppNav";
import {
  generateIntelligentPairings,
  generateRandomPairings,
  type Pairing,
} from "../lib/tournamentEngine";
import { deleteTournament } from "../lib/deleteTournament";
import { formatDoublesTeam } from "../lib/finalResult";
import {
  sanitizeScoreInput,
  scoreRuleHint,
  validateCompletedScore,
} from "../lib/scoreValidation";
import {
  playerCountsForTeamSize,
  splitIntoTeams,
  teamLayout,
  type TeamSize,
} from "../lib/teamTournament";

type Player = {
  id: string;
  name: string;
  seed?: number | null;
  active?: boolean;
};

type MatchPlayer = {
  id?: string;
  match_id?: string;
  player_id: string;
  team_number: number;
};
 

type Match = {
  id: string;
  round_id: string;
  court_number: number | null;
  match_number: number;
  team1_score: number | null;
  team2_score: number | null;
  winner_team: number | null;
  status: string;
};

type Tournament = {
  id: string;
  name: string;
  total_players: number;
  preliminary_rounds: number;
  courts: number;
  qualification_count: number;
  status: string;
  format?: string;
  team_size?: number | null;
};

type Round = {
  id: string;
  tournament_id: string;
  round_number: number;
  round_type: string;
  status: string;
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

type ScoreState = {
  team1: string;
  team2: string;
};

export default function HomePage() {
  const [tournament, setTournament] =
    useState<Tournament | null>(null);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [currentRound, setCurrentRound] =
    useState<Round | null>(null);

  const [matches, setMatches] =
    useState<Match[]>([]);

  const [matchPlayers, setMatchPlayers] =
    useState<MatchPlayer[]>([]);

  const [standings, setStandings] =
    useState<Standing[]>([]);

  const [tournamentName, setTournamentName] =
    useState("");

  const [playerCount, setPlayerCount] =
    useState(24);

  const [preliminaryRounds, setPreliminaryRounds] =
    useState(6);

  const [courts, setCourts] =
    useState(3);

  const [tournamentFormat, setTournamentFormat] =
    useState<"individual" | "team_groups">("individual");

  const [teamSize, setTeamSize] =
    useState<TeamSize>(4);

  const [playerInput, setPlayerInput] =
    useState("");

  const [inputMode, setInputMode] =
    useState<"manual" | "paste">("manual");

  const [manualPlayers, setManualPlayers] =
    useState<string[]>(
      Array.from({ length: 24 }, () => "")
    );

  const [scores, setScores] =
    useState<Record<string, ScoreState>>({});

  const [loading, setLoading] =
    useState(false);

  const [generatingNextRound, setGeneratingNextRound] =
    useState(false);

  const [status, setStatus] =
    useState("");

  const [deletingTournament, setDeletingTournament] =
    useState(false);

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  /*
   * Restore the active tournament after browser refresh.
   */
  useEffect(() => {
    const activeTournamentId =
      localStorage.getItem("activeTournamentId");

    if (activeTournamentId) {
      loadTournamentData(activeTournamentId);
    }

    const params = new URLSearchParams(window.location.search);

    if (params.get("create") === "1") {
      setShowCreateForm(true);
    }
  }, []);

  useEffect(() => {
    setManualPlayers((current) =>
      Array.from(
        { length: playerCount },
        (_, index) => current[index] || ""
      )
    );

    if (tournamentFormat === "team_groups") {
      const options = playerCountsForTeamSize(teamSize);

      if (!options.includes(playerCount)) {
        setPlayerCount(options.includes(24) ? 24 : options[0]);
      }

      return;
    }

    if (![16, 24, 32].includes(playerCount)) {
      setPlayerCount(24);
    }
  }, [tournamentFormat, teamSize, playerCount]);

  /*
   * Load tournament and current round.
   */
  async function loadTournamentData(
    tournamentId: string
  ) {
    try {
      setLoading(true);

      const { data: tournamentData, error: tournamentError } =
        await supabase
          .from("tournaments")
          .select("*")
          .eq("id", tournamentId)
          .single();

      if (tournamentError) {
        throw tournamentError;
      }

      setTournament(tournamentData);

      const { data: playerData, error: playerError } =
        await supabase
          .from("players")
          .select("*")
          .eq("tournament_id", tournamentId)
          .eq("active", true)
          .order("seed");

      if (playerError) {
        throw playerError;
      }

      setPlayers(playerData || []);

      if (tournamentData.format === "team_groups") {
        setStandings([]);
        setCurrentRound(null);
        setMatches([]);
        setMatchPlayers([]);
        return;
      }

      const { data: standingData, error: standingError } =
        await supabase
          .from("player_standings")
          .select("*")
          .eq("tournament_id", tournamentId);

      if (standingError) {
        throw standingError;
      }

      setStandings(standingData || []);

      const { data: roundsData, error: roundsError } =
        await supabase
          .from("rounds")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("round_number", {
            ascending: false,
          })
          .limit(1);

      if (roundsError) {
        throw roundsError;
      }

      if (!roundsData || roundsData.length === 0) {
        setCurrentRound(null);
        setMatches([]);
        setMatchPlayers([]);
        return;
      }

      const latestRound = roundsData[0];

      setCurrentRound(latestRound);

      const { data: matchData, error: matchError } =
        await supabase
          .from("matches")
          .select("*")
          .eq("round_id", latestRound.id)
          .order("match_number");

      if (matchError) {
        throw matchError;
      }

      setMatches(matchData || []);

      const matchIds =
        (matchData || []).map((match) => match.id);

      if (matchIds.length === 0) {
        setMatchPlayers([]);
      } else {
        const { data: matchPlayerData, error: matchPlayerError } =
          await supabase
            .from("match_players")
            .select("*")
            .in("match_id", matchIds);

        if (matchPlayerError) {
          throw matchPlayerError;
        }

        setMatchPlayers(matchPlayerData || []);

        const initialScores: Record<
          string,
          ScoreState
        > = {};

        (matchData || []).forEach((match) => {
          initialScores[match.id] = {
            team1:
              match.team1_score === null
                ? ""
                : String(match.team1_score),
            team2:
              match.team2_score === null
                ? ""
                : String(match.team2_score),
          };
        });

        setScores(initialScores);
      }
    } catch (error) {
      console.error(error);

      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to load tournament."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Parse player names.
   */
  function getPlayerNames(): string[] {
    if (inputMode === "paste") {
      return playerInput
        .split(/\r?\n/)
        .map((name) => name.trim())
        .filter(Boolean);
    }

    return manualPlayers
      .slice(0, playerCount)
      .map((name) => name.trim())
      .filter(Boolean);
  }

  /*
   * Create tournament.
   */
  async function createTournament() {
    try {
      setLoading(true);
      setStatus("");

      const names = getPlayerNames();

      if (!tournamentName.trim()) {
        setStatus("Please enter a tournament name.");
        return;
      }

      if (names.length !== playerCount) {
        setStatus(
          `Please enter exactly ${playerCount} player names. You entered ${names.length}.`
        );
        return;
      }

      const uniqueNames = new Set(
        names.map((name) => name.toLowerCase())
      );

      if (uniqueNames.size !== names.length) {
        setStatus(
          "Player names must be unique."
        );
        return;
      }

      if (tournamentFormat === "individual" && playerCount % 4 !== 0) {
        setStatus(
          "Player count must be divisible by 4."
        );
        return;
      }

      if (tournamentFormat === "team_groups") {
        const layout = teamLayout(playerCount, teamSize);

        if (!layout.valid) {
          setStatus(
            "Team groups need an even number of teams, at least 4, with 3 or 4 players each."
          );
          return;
        }
      }

      /*
       * Closed group: tournaments are shared with anyone
       * who has the app URL. Login is not required.
       */
      const { data: tournamentData, error: tournamentError } =
        await supabase
          .from("tournaments")
          .insert({
            name: tournamentName.trim(),
            total_players: playerCount,
            preliminary_rounds:
              tournamentFormat === "team_groups"
                ? 1
                : preliminaryRounds,
            courts,
            qualification_count:
              tournamentFormat === "team_groups" ? 4 : 16,
            status: "setup",
            format: tournamentFormat,
            team_size:
              tournamentFormat === "team_groups" ? teamSize : null,
          })
          .select()
          .single();

      if (tournamentError) {
        throw tournamentError;
      }

      const playerRows = names.map(
        (name, index) => ({
          tournament_id: tournamentData.id,
          name,
          seed: index + 1,
          active: true,
        })
      );

      const { data: insertedPlayers, error: playersError } =
        await supabase
          .from("players")
          .insert(playerRows)
          .select();

      if (playersError) {
        throw playersError;
      }

      if (!insertedPlayers) {
        throw new Error(
          "Players were not created."
        );
      }

      if (tournamentFormat === "team_groups") {
        const orderedPlayers = [...insertedPlayers].sort(
          (a, b) => Number(a.seed || 0) - Number(b.seed || 0)
        );
        const grouped = splitIntoTeams(orderedPlayers, teamSize);

        for (const group of grouped) {
          const { data: teamData, error: teamError } = await supabase
            .from("teams")
            .insert({
              tournament_id: tournamentData.id,
              name: group.name,
              group_name: group.group_name,
              seed: group.seed,
            })
            .select()
            .single();

          if (teamError) {
            throw teamError;
          }

          const { error: memberError } = await supabase
            .from("team_players")
            .insert(
              group.members.map((player, slot) => ({
                team_id: teamData.id,
                player_id: player.id,
                slot: slot + 1,
              }))
            );

          if (memberError) {
            throw memberError;
          }

          const { error: teamStandingError } = await supabase
            .from("team_standings")
            .insert({
              tournament_id: tournamentData.id,
              team_id: teamData.id,
              matches_played: 0,
              match_wins: 0,
              match_losses: 0,
              fixture_wins: 0,
              fixture_losses: 0,
            });

          if (teamStandingError) {
            throw teamStandingError;
          }
        }
      } else {
        const standingRows =
          insertedPlayers.map((player) => ({
            tournament_id: tournamentData.id,
            player_id: player.id,
            matches_played: 0,
            wins: 0,
            losses: 0,
            points_for: 0,
            points_against: 0,
            tournament_points: 0,
            rank: null,
          }));

        const { error: standingsError } =
          await supabase
            .from("player_standings")
            .insert(standingRows);

        if (standingsError) {
          throw standingsError;
        }
      }

      const { error: scoringError } =
        await supabase
          .from("scoring_rules")
          .insert({
            tournament_id: tournamentData.id,
            points_per_game: 21,
            winner_score_multiplier: 1,
            loser_score_multiplier: 1,
          });

      if (scoringError) {
        throw scoringError;
      }

      localStorage.setItem(
        "activeTournamentId",
        tournamentData.id
      );

      if (tournamentFormat === "team_groups") {
        window.location.href = "/team-center";
        return;
      }

      setStatus(
        `Tournament created successfully! Tournament ID: ${tournamentData.id}`
      );

      await loadTournamentData(
        tournamentData.id
      );
    } catch (error) {
      console.error(error);

      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to create tournament."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Calculate court assignment.
   */
  function getCourtNumber(
    matchIndex: number,
    matchCount: number,
    courtCount: number
  ) {
    const matchesPerCourt =
      Math.ceil(matchCount / courtCount);

    return Math.min(
      courtCount,
      Math.floor(
        matchIndex / matchesPerCourt
      ) + 1
    );
  }

  /*
   * Create matches and players for a round.
   */
  async function createRound(
    roundNumber: number,
    roundType: string,
    pairings: Pairing[]
  ) {
    if (!tournament) {
      throw new Error(
        "No active tournament."
      );
    }

    const { data: roundData, error: roundError } =
      await supabase
        .from("rounds")
        .insert({
          tournament_id: tournament.id,
          round_number: roundNumber,
          round_type: roundType,
          status: "generated",
        })
        .select()
        .single();

    if (roundError) {
      throw roundError;
    }

    const matchRows = pairings.map(
      (_, index) => ({
        round_id: roundData.id,
        court_number: getCourtNumber(
          index,
          pairings.length,
          tournament.courts
        ),
        match_number: index + 1,
        team1_score: null,
        team2_score: null,
        winner_team: null,
        status: "scheduled",
      })
    );

    const { data: insertedMatches, error: matchesError } =
      await supabase
        .from("matches")
        .insert(matchRows)
        .select();

    if (matchesError) {
      throw matchesError;
    }

    if (!insertedMatches) {
      throw new Error(
        "Matches were not created."
      );
    }

    const sortedMatches =
      [...insertedMatches].sort(
        (a, b) =>
          a.match_number -
          b.match_number
      );

    const matchPlayerRows: {
      match_id: string;
      player_id: string;
      team_number: number;
    }[] = [];

    pairings.forEach((pairing, index) => {
      const match = sortedMatches[index];

      pairing.team1.forEach((playerId) => {
        matchPlayerRows.push({
          match_id: match.id,
          player_id: playerId,
          team_number: 1,
        });
      });

      pairing.team2.forEach((playerId) => {
        matchPlayerRows.push({
          match_id: match.id,
          player_id: playerId,
          team_number: 2,
        });
      });
    });

    const { error: matchPlayerError } =
      await supabase
        .from("match_players")
        .insert(matchPlayerRows);

    if (matchPlayerError) {
      throw matchPlayerError;
    }

    await supabase
      .from("tournaments")
      .update({
        status: "in_progress",
      })
      .eq("id", tournament.id);

    await loadTournamentData(
      tournament.id
    );
  }

  /*
   * Generate Round 1.
   * test 
   */
  async function generateRoundOne() {
    if (!tournament) {
      return;
    }

    if (currentRound) {
      setStatus(
        `Round ${currentRound.round_number} already exists.`
      );
      return;
    }

    try {
      setLoading(true);
      setStatus("");

      const shuffled = [...players];

      for (
        let i = shuffled.length - 1;
        i > 0;
        i--
      ) {
        const j = Math.floor(
          Math.random() * (i + 1)
        );

        [shuffled[i], shuffled[j]] =
          [shuffled[j], shuffled[i]];
      }

      const pairings: Pairing[] = [];

      for (
        let i = 0;
        i < shuffled.length;
        i += 4
      ) {
        pairings.push({
          team1: [
            shuffled[i].id,
            shuffled[i + 1].id,
          ],
          team2: [
            shuffled[i + 2].id,
            shuffled[i + 3].id,
          ],
        });
      }

      await createRound(
        1,
        "preliminary",
        pairings
      );

      setStatus(
        "Round 1 generated successfully."
      );
    } catch (error) {
      console.error(error);

      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to generate Round 1."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Retrieve all previous match-player history.
   */
  async function getHistoricalMatchPlayers() {
    if (!tournament) {
      return [];
    }

    const { data: rounds, error: roundsError } =
      await supabase
        .from("rounds")
        .select("id")
        .eq("tournament_id", tournament.id);

    if (roundsError) {
      throw roundsError;
    }

    const roundIds =
      (rounds || []).map(
        (round) => round.id
      );

    if (roundIds.length === 0) {
      return [];
    }

    const { data: historicalMatches, error: matchesError } =
      await supabase
        .from("matches")
        .select("id")
        .in("round_id", roundIds);

    if (matchesError) {
      throw matchesError;
    }

    const matchIds =
      (historicalMatches || []).map(
        (match) => match.id
      );

    if (matchIds.length === 0) {
      return [];
    }

    const { data: historicalPlayers, error: playerError } =
      await supabase
        .from("match_players")
        .select(
          "match_id, player_id, team_number"
        )
        .in("match_id", matchIds);

    if (playerError) {
      throw playerError;
    }

    return historicalPlayers || [];
  }

  /*
   * Determine top 16.
   */
  function getTop16(): Player[] {
    const standingMap = new Map<
      string,
      Standing
    >();

    standings.forEach((standing) => {
      standingMap.set(
        standing.player_id,
        standing
      );
    });

    const sortedPlayers =
      [...players].sort((a, b) => {
        const aStanding =
          standingMap.get(a.id);

        const bStanding =
          standingMap.get(b.id);

        const aTournamentPoints =
          Number(
            aStanding?.tournament_points || 0
          );

        const bTournamentPoints =
          Number(
            bStanding?.tournament_points || 0
          );

        if (
          bTournamentPoints !==
          aTournamentPoints
        ) {
          return (
            bTournamentPoints -
            aTournamentPoints
          );
        }

        const aWins =
          Number(aStanding?.wins || 0);

        const bWins =
          Number(bStanding?.wins || 0);

        if (bWins !== aWins) {
          return bWins - aWins;
        }

        const aDifference =
          Number(
            aStanding?.points_for || 0
          ) -
          Number(
            aStanding?.points_against || 0
          );

        const bDifference =
          Number(
            bStanding?.points_for || 0
          ) -
          Number(
            bStanding?.points_against || 0
          );

        if (
          bDifference !==
          aDifference
        ) {
          return (
            bDifference -
            aDifference
          );
        }

        return (
          Number(
            bStanding?.points_for || 0
          ) -
          Number(
            aStanding?.points_for || 0
          )
        );
      });

    return sortedPlayers.slice(
      0,
      tournament?.qualification_count ||
        16
    );
  }

  /*
   * Generate next round.
   */
  async function generateNextRound() {
    if (!tournament || !currentRound) {
      return;
    }

    if (
      currentRound.status !==
      "completed"
    ) {
      setStatus(
        "Complete all matches in the current round before generating the next round."
      );
      return;
    }

    try {
      setGeneratingNextRound(true);
      setStatus("");

      /*
       * PRELIMINARY -> PRELIMINARY
       */
      if (
        currentRound.round_type ===
          "preliminary" &&
        currentRound.round_number <
          tournament.preliminary_rounds
      ) {
        const historicalPlayers =
          await getHistoricalMatchPlayers();

        const enginePlayers =
          players.map((player) => ({
            id: player.id,
            name: player.name,
          }));

        const engineStandings =
          standings.map((standing) => ({
            player_id:
              standing.player_id,
            tournament_points:
              standing.tournament_points,
            wins: standing.wins,
            losses: standing.losses,
            points_for:
              standing.points_for,
            points_against:
              standing.points_against,
          }));

        const pairings =
          generateIntelligentPairings(
            enginePlayers,
            engineStandings,
            historicalPlayers,
            5000
          );

        await createRound(
          currentRound.round_number + 1,
          "preliminary",
          pairings
        );

        setStatus(
          `Round ${
            currentRound.round_number + 1
          } generated using intelligent pairing.`
        );

        return;
      }

      /*
       * FINAL PRELIMINARY -> QUARTERFINALS
       */
      if (
        currentRound.round_type ===
          "preliminary" &&
        currentRound.round_number ===
          tournament.preliminary_rounds
      ) {
        const top16 = getTop16();

        if (top16.length < 16) {
          throw new Error(
            "At least 16 qualified players are required for the Quarterfinals."
          );
        }

        const pairings =
          generateRandomPairings(
            top16.map((player) => ({
              id: player.id,
              name: player.name,
            }))
          );

        await createRound(
          currentRound.round_number + 1,
          "quarterfinal",
          pairings
        );

        setStatus(
          "Quarterfinals generated from the Top 16."
        );

        return;
      }

      /*
       * QUARTERFINALS -> SEMIFINALS
       */
      if (
        currentRound.round_type ===
        "quarterfinal"
      ) {
        const winners: string[] = [];

        for (const match of matches) {
          if (!match.winner_team) {
            continue;
          }

          const teamPlayers =
            matchPlayers.filter(
              (player) =>
                player.match_id ===
                  match.id &&
                player.team_number ===
                  match.winner_team
            );

          teamPlayers.forEach(
            (player) =>
              winners.push(
                player.player_id
              )
          );
        }

        if (winners.length !== 8) {
          throw new Error(
            "All four Quarterfinal matches must be completed before generating the Semifinals."
          );
        }

        const winnerPlayers =
          winners
            .map((id) =>
              players.find(
                (player) =>
                  player.id === id
              )
            )
            .filter(
              (
                player
              ): player is Player =>
                Boolean(player)
            );

        const pairings =
          generateRandomPairings(
            winnerPlayers.map((player) => ({
              id: player.id,
              name: player.name,
            }))
          );

        await createRound(
          currentRound.round_number + 1,
          "semifinal",
          pairings
        );

        setStatus(
          "Semifinals generated from the Quarterfinal winners."
        );

        return;
      }

      /*
       * SEMIFINALS -> FINAL
       */
      if (
        currentRound.round_type ===
        "semifinal"
      ) {
        const winners: string[] = [];

        for (const match of matches) {
          if (!match.winner_team) {
            continue;
          }

          const teamPlayers =
            matchPlayers.filter(
              (player) =>
                player.match_id ===
                  match.id &&
                player.team_number ===
                  match.winner_team
            );

          teamPlayers.forEach(
            (player) =>
              winners.push(
                player.player_id
              )
          );
        }

        if (winners.length !== 4) {
          throw new Error(
            "Both Semifinal matches must be completed before generating the Final."
          );
        }

        const winnerPlayers =
          winners
            .map((id) =>
              players.find(
                (player) =>
                  player.id === id
              )
            )
            .filter(
              (
                player
              ): player is Player =>
                Boolean(player)
            );

        const pairings =
          generateRandomPairings(
            winnerPlayers.map((player) => ({
              id: player.id,
              name: player.name,
            }))
          );

        await createRound(
          currentRound.round_number + 1,
          "final",
          pairings
        );

        setStatus(
          "Final generated."
        );

        return;
      }

      if (
        currentRound.round_type ===
        "final"
      ) {
        setStatus(
          "The tournament is already complete."
        );
      }
    } catch (error) {
      console.error(error);

      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to generate the next round."
      );
    } finally {
      setGeneratingNextRound(false);
    }
  }

  /*
   * Update score input.
   */
  function updateScore(
    matchId: string,
    team: "team1" | "team2",
    value: string
  ) {
    const sanitized = sanitizeScoreInput(value);

    if (sanitized === null) {
      return;
    }

    setScores((previous) => ({
      ...previous,
      [matchId]: {
        ...(previous[matchId] || {
          team1: "",
          team2: "",
        }),
        [team]: sanitized,
      },
    }));
  }

  /*
   * Save a match result.
   */
  async function saveMatchResult(
    match: Match
  ) {
    try {
      const score =
        scores[match.id];

      if (!score) {
        setStatus(
          "Please enter both scores."
        );
        return;
      }

      if (
        score.team1 === "" ||
        score.team2 === ""
      ) {
        setStatus(
          "Please enter both scores."
        );
        return;
      }

      const team1Score =
        Number(score.team1);

      const team2Score =
        Number(score.team2);

      const scoreError = validateCompletedScore(
        team1Score,
        team2Score,
        currentRound?.round_type
      );

      if (scoreError) {
        setStatus(scoreError);
        return;
      }

      if (match.status === "completed") {
        setStatus(
          "This match has already been saved."
        );
        return;
      }

      const winnerTeam =
        team1Score > team2Score
          ? 1
          : 2;

      const winnerScore =
        winnerTeam === 1
          ? team1Score
          : team2Score;

      const loserScore =
        winnerTeam === 1
          ? team2Score
          : team1Score;

      const winnerPoints =
        winnerScore / 2;

      const loserPoints =
        loserScore / 2;

      const team1Players =
        matchPlayers.filter(
          (player) =>
            player.match_id ===
              match.id &&
            player.team_number === 1
        );

      const team2Players =
        matchPlayers.filter(
          (player) =>
            player.match_id ===
              match.id &&
            player.team_number === 2
        );

      if (
        team1Players.length !== 2 ||
        team2Players.length !== 2
      ) {
        setStatus(
          "Each match must have exactly 2 players per team."
        );
        return;
      }

      /*
       * Update match only if it is still scheduled.
       */
      const { data: updatedMatch, error: matchError } =
        await supabase
          .from("matches")
          .update({
            team1_score:
              team1Score,
            team2_score:
              team2Score,
            winner_team:
              winnerTeam,
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
        setStatus(
          "This match has already been saved."
        );
        return;
      }

      /*
       * Update Team 1
       */
      for (const player of team1Players) {
        const isWinner =
          winnerTeam === 1;

        const pointsFor =
          isWinner
            ? winnerPoints
            : loserPoints;

        const pointsAgainst =
          isWinner
            ? loserPoints
            : winnerPoints;

        const { data: standing, error: standingError } =
          await supabase
            .from("player_standings")
            .select("*")
            .eq(
              "tournament_id",
              tournament!.id
            )
            .eq(
              "player_id",
              player.player_id
            )
            .single();

        if (standingError) {
          throw standingError;
        }

        const { error: updateError } =
          await supabase
            .from("player_standings")
            .update({
              matches_played:
                Number(
                  standing.matches_played
                ) + 1,

              wins:
                Number(
                  standing.wins
                ) +
                (isWinner ? 1 : 0),

              losses:
                Number(
                  standing.losses
                ) +
                (isWinner ? 0 : 1),

              points_for:
                Number(
                  standing.points_for
                ) + pointsFor,

              points_against:
                Number(
                  standing.points_against
                ) + pointsAgainst,

              tournament_points:
                Number(
                  standing.tournament_points
                ) + pointsFor,
            })
            .eq(
              "tournament_id",
              tournament!.id
            )
            .eq(
              "player_id",
              player.player_id
            );

        if (updateError) {
          throw updateError;
        }
      }

      /*
       * Update Team 2
       */
      for (const player of team2Players) {
        const isWinner =
          winnerTeam === 2;

        const pointsFor =
          isWinner
            ? winnerPoints
            : loserPoints;

        const pointsAgainst =
          isWinner
            ? loserPoints
            : winnerPoints;

        const { data: standing, error: standingError } =
          await supabase
            .from("player_standings")
            .select("*")
            .eq(
              "tournament_id",
              tournament!.id
            )
            .eq(
              "player_id",
              player.player_id
            )
            .single();

        if (standingError) {
          throw standingError;
        }

        const { error: updateError } =
          await supabase
            .from("player_standings")
            .update({
              matches_played:
                Number(
                  standing.matches_played
                ) + 1,

              wins:
                Number(
                  standing.wins
                ) +
                (isWinner ? 1 : 0),

              losses:
                Number(
                  standing.losses
                ) +
                (isWinner ? 0 : 1),

              points_for:
                Number(
                  standing.points_for
                ) + pointsFor,

              points_against:
                Number(
                  standing.points_against
                ) + pointsAgainst,

              tournament_points:
                Number(
                  standing.tournament_points
                ) + pointsFor,
            })
            .eq(
              "tournament_id",
              tournament!.id
            )
            .eq(
              "player_id",
              player.player_id
            );

        if (updateError) {
          throw updateError;
        }
      }

      /*
       * Check whether all matches in this round
       * are completed.
       */
      const { data: roundMatches, error: roundMatchesError } =
        await supabase
          .from("matches")
          .select("id, status")
          .eq(
            "round_id",
            currentRound!.id
          );

      if (roundMatchesError) {
        throw roundMatchesError;
      }

      const allCompleted =
        (roundMatches || []).length > 0 &&
        (roundMatches || []).every(
          (m) =>
            m.status ===
            "completed"
        );

      if (allCompleted) {
        const { error: roundError } =
          await supabase
            .from("rounds")
            .update({
              status: "completed",
            })
            .eq(
              "id",
              currentRound!.id
            );

        if (roundError) {
          throw roundError;
        }

        if (
          currentRound!.round_type ===
          "final"
        ) {
          await supabase
            .from("tournaments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq(
              "id",
              tournament!.id
            );

          setStatus(
            "🏆 Final completed! Tournament is complete."
          );
        } else {
          setStatus(
            `✓ ${
              getRoundDisplayName(
                currentRound!
              )
            } completed. Ready for the next round.`
          );
        }
      } else {
        setStatus(
          `Match ${match.match_number} saved successfully.`
        );
      }

      await loadTournamentData(
        tournament!.id
      );
    } catch (error) {
      console.error(error);

      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to save match result."
      );
    }
  }

  function getRoundDisplayName(
    round: Round
  ) {
    switch (round.round_type) {
      case "preliminary":
        return `Round ${round.round_number}`;

      case "quarterfinal":
        return "Quarterfinals";

      case "semifinal":
        return "Semifinals";

      case "final":
        return "Final";

      default:
        return `Round ${round.round_number}`;
    }
  }

  function getTeamPlayers(
    matchId: string,
    teamNumber: number
  ) {
    return matchPlayers
      .filter(
        (player) =>
          player.match_id ===
            matchId &&
          player.team_number ===
            teamNumber
      )
      .map((player) =>
        players.find(
          (p) =>
            p.id ===
            player.player_id
        )
      )
      .filter(
        (
          player
        ): player is Player =>
          Boolean(player)
      );
  }

  const matchesByCourt =
    useMemo(() => {
      const grouped =
        new Map<
          number,
          Match[]
        >();

      matches.forEach((match) => {
        const court =
          match.court_number || 1;

        if (!grouped.has(court)) {
          grouped.set(
            court,
            []
          );
        }

        grouped
          .get(court)!
          .push(match);
      });

      return grouped;
    }, [matches]);

  const completedMatches =
    matches.filter(
      (match) =>
        match.status ===
        "completed"
    ).length;

  const progress =
    matches.length === 0
      ? 0
      : Math.round(
          (completedMatches /
            matches.length) *
            100
        );

  const top16 =
    currentRound &&
    currentRound.round_type ===
      "preliminary" &&
    currentRound.round_number ===
      tournament?.preliminary_rounds
      ? getTop16()
      : [];

  function isCurrentRoundComplete() {
    return (
      currentRound?.status ===
      "completed"
    );
  }

  function getNextRoundButtonText() {
    if (!currentRound) {
      return "";
    }

    if (
      currentRound.round_type ===
        "preliminary" &&
      currentRound.round_number <
        (tournament?.preliminary_rounds ||
          0)
    ) {
      return `Generate Round ${
        currentRound.round_number + 1
      } — Intelligent Pairing`;
    }

    if (
      currentRound.round_type ===
        "preliminary" &&
      currentRound.round_number ===
        tournament?.preliminary_rounds
    ) {
      return "Generate Quarterfinals — Top 16";
    }

    if (
      currentRound.round_type ===
      "quarterfinal"
    ) {
      return "Generate Semifinals";
    }

    if (
      currentRound.round_type ===
      "semifinal"
    ) {
      return "Generate Final";
    }

    return "";
  }

  function startNewTournament() {
    localStorage.removeItem(
      "activeTournamentId"
    );

    window.location.href = "/?create=1";
  }

  function goTournamentHistory() {
    window.location.href = "/tournaments";
  }

  function goFormat() {
    window.location.href = "/format";
  }

  function goControlCenter() {
    window.location.href = "/control-center";
  }

  function goTeamCenter() {
    window.location.href = "/team-center";
  }

  async function removeActiveTournament() {
    if (!tournament) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${tournament.name}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingTournament(true);
      setStatus("");
      await deleteTournament(tournament.id);
      window.location.href = "/";
    } catch (error) {
      console.error(error);
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to delete this tournament."
      );
      setDeletingTournament(false);
    }
  }

  /*
   * SETUP SCREEN
   */
  if (!tournament) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="mb-8 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                🏸 Baddy Smash
              </h1>

              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
                Create a new tournament or open
                completed results from history.
              </p>
            </div>

            <AppNav links={["history", "format"]} />
          </div>

          <div className="mb-6 grid gap-4 sm:mb-8 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="rounded-2xl border border-emerald-800 bg-emerald-950/30 p-5 text-left transition hover:bg-emerald-950/50 sm:p-6"
            >
              <div className="text-3xl">➕</div>

              <h2 className="mt-3 text-xl font-black">
                Create New Tournament
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Set up players, courts, and
                preliminary rounds.
              </p>
            </button>

            <button
              onClick={goTournamentHistory}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left transition hover:bg-slate-800 sm:p-6"
            >
              <div className="text-3xl">📋</div>

              <h2 className="mt-3 text-xl font-black">
                Tournament History
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                View completed tournaments,
                champions, and match results.
              </p>
            </button>

            <button
              onClick={goFormat}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left transition hover:bg-slate-800 md:col-span-2 sm:p-6"
            >
              <div className="text-3xl">📖</div>

              <h2 className="mt-3 text-xl font-black">
                Tournament Format
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                See how doubles pairing, scoring,
                qualification, and champions work.
              </p>
            </button>
          </div>

          {showCreateForm && (
          <div
            id="create-tournament"
            className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6"
          >
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-bold">
                Create New Tournament
              </h2>

              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setTournamentFormat("individual")
                }
                className={`rounded-xl border p-4 text-left ${
                  tournamentFormat === "individual"
                    ? "border-emerald-600 bg-emerald-950/40"
                    : "border-slate-800 bg-slate-950"
                }`}
              >
                <div className="font-black">Individual doubles</div>
                <p className="mt-1 text-sm text-slate-400">
                  Mixed pairings, individual points, Top 16 knockout.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setTournamentFormat("team_groups")
                }
                className={`rounded-xl border p-4 text-left ${
                  tournamentFormat === "team_groups"
                    ? "border-emerald-600 bg-emerald-950/40"
                    : "border-slate-800 bg-slate-950"
                }`}
              >
                <div className="font-black">Team groups</div>
                <p className="mt-1 text-sm text-slate-400">
                  3 or 4 players per team, group round robin, then semis.
                </p>
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div className="min-w-0">
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Tournament Name
                </label>

                <input
                  value={tournamentName}
                  onChange={(e) =>
                    setTournamentName(
                      e.target.value
                    )
                  }
                  placeholder="Weekend Badminton Tournament"
                  className="min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Players
                </label>

                <select
                  value={playerCount}
                  onChange={(e) =>
                    setPlayerCount(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                >
                  {(tournamentFormat === "team_groups"
                    ? playerCountsForTeamSize(teamSize)
                    : [16, 24, 32]
                  ).map((count) => (
                    <option key={count} value={count}>
                      {count} Players
                    </option>
                  ))}
                </select>
              </div>

              {tournamentFormat === "team_groups" ? (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Players per team
                </label>

                <select
                  value={teamSize}
                  onChange={(e) =>
                    setTeamSize(
                      Number(e.target.value) as TeamSize
                    )
                  }
                  className="min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                >
                  <option value={3}>3 Players</option>
                  <option value={4}>4 Players</option>
                </select>
              </div>
              ) : (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Preliminary Rounds
                </label>

                <select
                  value={
                    preliminaryRounds
                  }
                  onChange={(e) =>
                    setPreliminaryRounds(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                >
                  {[4, 5, 6, 7, 8].map(
                    (round) => (
                      <option
                        key={round}
                        value={round}
                      >
                        {round} Rounds
                      </option>
                    )
                  )}
                </select>
              </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Courts
                </label>

                <select
                  value={courts}
                  onChange={(e) =>
                    setCourts(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                >
                  <option value={2}>
                    2 Courts
                  </option>

                  <option value={3}>
                    3 Courts
                  </option>

                  <option value={4}>
                    4 Courts
                  </option>
                </select>
              </div>
            </div>

            {tournamentFormat === "team_groups" && (
              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                {(() => {
                  const layout = teamLayout(playerCount, teamSize);

                  if (!layout.valid) {
                    return "Choose a player count that splits into an even number of teams.";
                  }

                  return `${layout.teamCount} teams of ${teamSize} · Group A (${layout.groupSize}) and Group B (${layout.groupSize}) · 5 doubles per fixture · match wins only · top 2 per group to semis (A1 vs B2, A2 vs B1). Players are assigned in order: 1-${teamSize} become Team A.`;
                })()}
              </div>
            )}

            <div className="mt-7 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button
                onClick={() =>
                  setInputMode(
                    "manual"
                  )
                }
                className={`min-h-11 rounded-lg px-4 py-2 font-semibold ${
                  inputMode === "manual"
                    ? "bg-emerald-600"
                    : "bg-slate-800"
                }`}
              >
                Enter Players
              </button>

              <button
                onClick={() =>
                  setInputMode(
                    "paste"
                  )
                }
                className={`min-h-11 rounded-lg px-4 py-2 font-semibold ${
                  inputMode === "paste"
                    ? "bg-emerald-600"
                    : "bg-slate-800"
                }`}
              >
                Paste List
              </button>
            </div>

            {inputMode === "manual" ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {Array.from({
                  length: playerCount,
                }).map((_, index) => (
                  <input
                    key={index}
                    value={
                      manualPlayers[
                        index
                      ] || ""
                    }
                    onChange={(e) => {
                      const updated =
                        [
                          ...manualPlayers,
                        ];

                      updated[
                        index
                      ] =
                        e.target.value;

                      setManualPlayers(
                        updated
                      );
                    }}
                    placeholder={`Player ${
                      index + 1
                    }`}
                    className="min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-6">
                <textarea
                  value={
                    playerInput
                  }
                  onChange={(e) =>
                    setPlayerInput(
                      e.target.value
                    )
                  }
                  placeholder={`Paste one player per line\nPlayer 1\nPlayer 2\nPlayer 3`}
                  rows={10}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                />

                <p className="mt-2 text-sm text-slate-500">
                  Enter exactly{" "}
                  {playerCount}{" "}
                  players.
                </p>
              </div>
            )}

            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <button
                onClick={createTournament}
                disabled={loading}
                className="min-h-12 w-full rounded-lg bg-emerald-600 px-6 py-3 font-bold hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
              >
                {loading
                  ? "Creating..."
                  : "Create Tournament"}
              </button>

              <button
                onClick={goTournamentHistory}
                className="min-h-12 w-full rounded-lg border border-slate-700 px-6 py-3 font-semibold hover:bg-slate-800 sm:w-auto"
              >
                📋 Tournament History
              </button>

              <button
                onClick={goFormat}
                className="min-h-12 w-full rounded-lg border border-slate-700 px-6 py-3 font-semibold hover:bg-slate-800 sm:w-auto"
              >
                📖 Format
              </button>
            </div>

            {status && (
              <div className="mt-6 break-words rounded-lg border border-slate-700 bg-slate-950 p-4 text-sm leading-6">
                {status}
              </div>
            )}
          </div>
          )}
        </div>
      </main>
    );
  }

  if (tournament.format === "team_groups") {
    const groupedTeams = splitIntoTeams(
      [...players].sort(
        (a, b) => Number(a.seed || 0) - Number(b.seed || 0)
      ),
      (tournament.team_size === 3 ? 3 : 4) as TeamSize
    );

    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="mb-6 flex flex-col gap-5 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                🏸 Baddy Smash
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-400 sm:text-base">
                Team groups format. Run fixtures from Team Center.
              </p>
            </div>

            <AppNav
              links={[
                "team-center",
                "standings",
                "history",
                "format",
                "new",
              ]}
            >
              <button
                onClick={() => loadTournamentData(tournament.id)}
                className="min-h-11 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-800 sm:px-4"
              >
                🔄 Refresh
              </button>
            </AppNav>
          </div>

          <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Active Team Tournament
            </div>

            <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="break-words text-2xl font-black">
                  {tournament.name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {tournament.total_players} Players
                  {" | "}
                  {groupedTeams.length} Teams of {tournament.team_size || 4}
                  {" | "}
                  {tournament.courts} Courts
                  {" | "}
                  Group A vs Group B
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:flex-col">
                <button
                  onClick={goTeamCenter}
                  className="min-h-11 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold transition hover:bg-emerald-500 lg:min-w-[200px]"
                >
                  👥 Open Team Center
                </button>

                <button
                  onClick={removeActiveTournament}
                  disabled={deletingTournament}
                  className="min-h-11 w-full rounded-lg border border-red-800 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-950 disabled:opacity-50 lg:min-w-[200px]"
                >
                  {deletingTournament
                    ? "Deleting..."
                    : "🗑️ Delete Tournament"}
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {groupedTeams.map((team) => (
              <article
                key={team.name}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="text-xs uppercase tracking-widest text-slate-500">
                  Group {team.group_name}
                </div>
                <h3 className="mt-1 text-xl font-black">{team.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {team.members.map((player) => player.name).join(" · ")}
                </p>
              </article>
            ))}
          </section>

          {status && (
            <div className="mt-6 break-words rounded-lg border border-slate-700 bg-slate-950 p-4 text-sm leading-6">
              {status}
            </div>
          )}
        </div>
      </main>
    );
  }

  const finalMatch =
    currentRound?.round_type === "final"
      ? matches.find(
          (match) =>
            match.winner_team === 1 ||
            match.winner_team === 2
        )
      : undefined;

  const champions = finalMatch?.winner_team
    ? getTeamPlayers(
        finalMatch.id,
        finalMatch.winner_team
      )
    : [];

  const runnersUp = finalMatch?.winner_team
    ? getTeamPlayers(
        finalMatch.id,
        finalMatch.winner_team === 1 ? 2 : 1
      )
    : [];

  /*
   * DASHBOARD
   */
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-5 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              🏸 Baddy Smash
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-400 sm:text-base">
              Create a new tournament, resume the
              active event, or open history.
            </p>
          </div>

          <AppNav
            links={[
              "control-center",
              "leaderboard",
              "history",
              "format",
              "new",
            ]}
          >
            <button
              onClick={() =>
                loadTournamentData(
                  tournament.id
                )
              }
              className="min-h-11 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-800 sm:px-4"
            >
              🔄 Refresh
            </button>
          </AppNav>
        </div>

        <div className="mb-6 grid gap-4 sm:mb-8 md:grid-cols-2">
          <button
            onClick={startNewTournament}
            className="rounded-2xl border border-emerald-800 bg-emerald-950/30 p-5 text-left transition hover:bg-emerald-950/50 sm:p-6"
          >
            <div className="text-3xl">➕</div>

            <h2 className="mt-3 text-xl font-black">
              Create New Tournament
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Clears the active tournament ID so
              the previous event is not reopened.
            </p>
          </button>

          <button
            onClick={goTournamentHistory}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left transition hover:bg-slate-800 sm:p-6"
          >
            <div className="text-3xl">📋</div>

            <h2 className="mt-3 text-xl font-black">
              Tournament History
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Open completed tournaments, champions,
              and match results.
            </p>
          </button>

          <button
            onClick={goFormat}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left transition hover:bg-slate-800 md:col-span-2 sm:p-6"
          >
            <div className="text-3xl">📖</div>

            <h2 className="mt-3 text-xl font-black">
              Tournament Format
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              See how doubles pairing, scoring,
              qualification, and champions work.
            </p>
          </button>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:mb-8 sm:p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            Active Tournament
          </div>

          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-black">
                {tournament.name}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400 sm:text-base">
                {tournament.total_players} Players
                {" | "}
                {tournament.preliminary_rounds} Rounds
                {" | "}
                {tournament.courts} Courts
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:flex-col">
              <button
                onClick={goControlCenter}
                className="min-h-11 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold transition hover:bg-emerald-500 lg:min-w-[200px]"
              >
                🎛️ Control Center
              </button>

              <button
                onClick={removeActiveTournament}
                disabled={deletingTournament}
                className="min-h-11 w-full rounded-lg border border-red-800 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-950 disabled:opacity-50 lg:min-w-[200px]"
              >
                {deletingTournament
                  ? "Deleting..."
                  : "🗑️ Delete Tournament"}
              </button>
            </div>
          </div>
        </section>

        <section className="mb-6 sm:mb-8">
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Quick Links
          </div>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <button
              onClick={() => {
                window.location.href =
                  "/leaderboard";
              }}
              className="min-h-11 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-950"
            >
              📊 Leaderboard
            </button>

            <button
              onClick={goTournamentHistory}
              className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              📋 Tournament History
            </button>

            <button
              onClick={goFormat}
              className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              📖 Format
            </button>
          </div>
        </section>

        {currentRound && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
              <p className="text-sm text-slate-400">
                Current Stage
              </p>

              <p className="mt-1 text-lg font-bold sm:text-xl">
                {getRoundDisplayName(
                  currentRound
                )}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
              <p className="text-sm text-slate-400">
                Matches
              </p>

              <p className="mt-1 text-lg font-bold sm:text-xl">
                {completedMatches} /{" "}
                {matches.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
              <p className="text-sm text-slate-400">
                Progress
              </p>

              <p className="mt-1 text-lg font-bold sm:text-xl">
                {progress}%
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
              <p className="text-sm text-slate-400">
                Status
              </p>

              <p
                className={`mt-1 text-lg font-bold sm:text-xl ${
                  currentRound.status ===
                  "completed"
                    ? "text-emerald-400"
                    : "text-yellow-400"
                }`}
              >
                {currentRound.status ===
                "completed"
                  ? "Completed"
                  : "In Progress"}
              </p>
            </div>
          </div>
        )}

        {status && (
          <div className="mb-6 break-words rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm leading-6">
            {status}
          </div>
        )}

        {!currentRound ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
            <h2 className="text-2xl font-bold">
              Ready to Start
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400 sm:text-base">
              Round 1 will randomly pair all
              players.
            </p>

            <button
              onClick={generateRoundOne}
              disabled={loading}
              className="mt-6 min-h-12 w-full rounded-lg bg-emerald-600 px-6 py-3 font-bold hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
            >
              {loading
                ? "Generating..."
                : "🎲 Generate Round 1"}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:mb-8 sm:p-5">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold">
                    {getRoundDisplayName(
                      currentRound
                    )}
                  </h2>

                  <p className="text-sm leading-6 text-slate-400">
                    Enter the final score for
                    each match. {scoreRuleHint(currentRound.round_type)}
                  </p>
                </div>

                <span className="font-bold text-emerald-400">
                  {progress}%
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </div>

            {Array.from(
              {
                length:
                  tournament.courts,
              },
              (_, index) =>
                index + 1
            ).map((courtNumber) => {
              const courtMatches =
                matchesByCourt.get(
                  courtNumber
                ) || [];

              if (
                courtMatches.length ===
                0
              ) {
                return null;
              }

              return (
                <section
                  key={courtNumber}
                  className="mb-7 sm:mb-8"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold sm:text-2xl">
                      Court{" "}
                      {courtNumber}
                    </h2>

                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
                      {courtMatches.length}{" "}
                      {courtMatches.length === 1
                        ? "Match"
                        : "Matches"}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
                    {courtMatches.map(
                      (match) => {
                        const team1 =
                          getTeamPlayers(
                            match.id,
                            1
                          );

                        const team2 =
                          getTeamPlayers(
                            match.id,
                            2
                          );

                        const score =
                          scores[
                            match.id
                          ] || {
                            team1: "",
                            team2: "",
                          };

                        const completed =
                          match.status ===
                          "completed";

                        return (
                          <div
                            key={
                              match.id
                            }
                            className={`min-w-0 rounded-xl border p-4 sm:p-5 ${
                              completed
                                ? "border-emerald-900 bg-emerald-950/20"
                                : "border-slate-800 bg-slate-900"
                            }`}
                          >
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <h3 className="text-base font-bold sm:text-lg">
                                Match{" "}
                                {
                                  match.match_number
                                }
                              </h3>

                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold sm:px-3 sm:text-xs ${
                                  completed
                                    ? "bg-emerald-900 text-emerald-300"
                                    : "bg-yellow-900 text-yellow-300"
                                }`}
                              >
                                {completed
                                  ? "COMPLETED"
                                  : "SCHEDULED"}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                              <div className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 p-4">
                                <p className="mb-3 font-bold text-emerald-400">
                                  Team 1
                                </p>

                                <div className="space-y-1">
                                  {team1.map(
                                    (
                                      player
                                    ) => (
                                      <p
                                        key={
                                          player.id
                                        }
                                        className="break-words text-sm leading-6 text-slate-200"
                                      >
                                        {
                                          player.name
                                        }
                                      </p>
                                    )
                                  )}
                                </div>

                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  value={
                                    score.team1
                                  }
                                  disabled={
                                    completed
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateScore(
                                      match.id,
                                      "team1",
                                      e.target
                                        .value
                                    )
                                  }
                                  className="mt-4 h-14 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-center text-2xl font-bold outline-none focus:border-emerald-500 disabled:opacity-50"
                                  placeholder="0"
                                />
                              </div>

                              <div className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 p-4">
                                <p className="mb-3 font-bold text-blue-400">
                                  Team 2
                                </p>

                                <div className="space-y-1">
                                  {team2.map(
                                    (
                                      player
                                    ) => (
                                      <p
                                        key={
                                          player.id
                                        }
                                        className="break-words text-sm leading-6 text-slate-200"
                                      >
                                        {
                                          player.name
                                        }
                                      </p>
                                    )
                                  )}
                                </div>

                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  value={
                                    score.team2
                                  }
                                  disabled={
                                    completed
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateScore(
                                      match.id,
                                      "team2",
                                      e.target
                                        .value
                                    )
                                  }
                                  className="mt-4 h-14 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-center text-2xl font-bold outline-none focus:border-blue-500 disabled:opacity-50"
                                  placeholder="0"
                                />
                              </div>
                            </div>

                            {!completed && (
                              <button
                                onClick={() =>
                                  saveMatchResult(
                                    match
                                  )
                                }
                                className="mt-4 min-h-12 w-full rounded-lg bg-emerald-600 px-4 py-3 font-bold hover:bg-emerald-500"
                              >
                                💾 Save Result
                              </button>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </section>
              );
            })}

            {isCurrentRoundComplete() &&
              currentRound.round_type !==
                "final" && (
                <div className="mt-8 rounded-2xl border border-emerald-800 bg-emerald-950/30 p-5 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold text-emerald-400 sm:text-2xl">
                        ✓{" "}
                        {getRoundDisplayName(
                          currentRound
                        )}{" "}
                        Complete
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-slate-300 sm:text-base">
                        All matches have been
                        completed. You can now
                        generate the next stage.
                      </p>
                    </div>

                    <button
                      onClick={
                        generateNextRound
                      }
                      disabled={
                        generatingNextRound
                      }
                      className="min-h-12 w-full rounded-lg bg-emerald-600 px-6 py-3 font-bold hover:bg-emerald-500 disabled:opacity-50 lg:w-auto lg:shrink-0"
                    >
                      {generatingNextRound
                        ? "Generating..."
                        : getNextRoundButtonText()}
                    </button>
                  </div>
                </div>
              )}

            {isCurrentRoundComplete() &&
              currentRound.round_type ===
                "final" && (
                <div className="mt-8 rounded-2xl border border-yellow-700 bg-yellow-950/30 p-5 text-center sm:p-8">
                  <div className="text-5xl">
                    🏆
                  </div>

                  <h2 className="mt-4 text-2xl font-bold text-yellow-400 sm:text-3xl">
                    Tournament Complete!
                  </h2>

                  {(champions.length > 0 ||
                    runnersUp.length > 0) && (
                    <div className="mx-auto mt-6 grid max-w-3xl gap-4 md:grid-cols-2">
                      {champions.length > 0 && (
                        <div className="min-w-0 rounded-xl border border-yellow-700 bg-yellow-950/30 p-4">
                          <div className="text-xs font-bold uppercase tracking-widest text-yellow-500">
                            Champions
                          </div>

                          <div className="mt-2 break-words text-lg font-black text-yellow-300">
                            {formatDoublesTeam(champions)}
                          </div>
                        </div>
                      )}

                      {runnersUp.length > 0 && (
                        <div className="min-w-0 rounded-xl border border-slate-600 bg-slate-900/70 p-4">
                          <div className="text-xs font-bold uppercase tracking-widest text-slate-300">
                            Runners Up
                          </div>

                          <div className="mt-2 break-words text-lg font-black text-slate-100">
                            {formatDoublesTeam(runnersUp)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
                    The Final has been
                    completed.
                  </p>

                  <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap sm:justify-center">
                    <button
                      onClick={() => {
                        window.location.href =
                          "/leaderboard";
                      }}
                      className="min-h-12 w-full rounded-lg bg-yellow-600 px-6 py-3 font-bold text-black hover:bg-yellow-500 sm:w-auto"
                    >
                      📊 View Final Leaderboard
                    </button>

                    <button
                      onClick={goTournamentHistory}
                      className="min-h-12 w-full rounded-lg border border-slate-700 px-6 py-3 font-bold hover:bg-slate-800 sm:w-auto"
                    >
                      📋 Tournament History
                    </button>

                    <button
                      onClick={startNewTournament}
                      className="min-h-12 w-full rounded-lg border border-emerald-700 px-6 py-3 font-bold text-emerald-400 hover:bg-emerald-950 sm:w-auto"
                    >
                      ➕ New Tournament
                    </button>
                  </div>
                </div>
              )}

            {top16.length === 16 && (
              <div className="mt-8 rounded-2xl border border-purple-800 bg-purple-950/20 p-5 sm:p-6">
                <h2 className="text-xl font-bold text-purple-300 sm:text-2xl">
                  🏆 Top 16 Qualified
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  These players will enter the
                  Quarterfinals.
                </p>

                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {top16.map(
                    (
                      player,
                      index
                    ) => (
                      <div
                        key={
                          player.id
                        }
                        className="min-w-0 rounded-lg border border-slate-800 bg-slate-900 p-3"
                      >
                        <span className="mr-2 font-bold text-purple-400">
                          #{index + 1}
                        </span>

                        <span className="break-words">
                          {player.name}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
