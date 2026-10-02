"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppNav from "@/app/components/AppNav";
import {
  championshipMatch,
  finalsScheduleLabel,
  formatDoublesTeam,
  thirdPlaceMatch,
} from "@/lib/finalResult";
import {
  sanitizeScoreInput,
  scoreRuleHint,
  validateCompletedScore,
} from "@/lib/scoreValidation";
import BestOfThreeScoreInputs from "@/app/components/BestOfThreeScoreInputs";
import CompletedMatches from "@/app/components/CompletedMatches";
import {
  loadCompletedMatches,
  type CompletedMatchView,
} from "@/lib/individualMatchEdit";
import { scrollToSection } from "@/lib/scrollToSection";
import {
  emptyGameInputs,
  formatMatchScoreLine,
  gameInputsFromMatch,
  individualQualificationCount,
  resolveBestOfThree,
  usesBestOfThree,
  type GameScoreInput,
} from "@/lib/bestOfThree";
import {
  drawNumberMap,
  drawPhaseForRound,
  type PlayerDrawNumber,
} from "@/lib/playerDraw";

type Tournament = {
  id: string;
  name: string;
  total_players: number;
  preliminary_rounds: number;
  courts: number;
  qualification_count: number;
  status: string;
  format?: string;
};

type Player = {
  id: string;
  tournament_id: string;
  name: string;
  seed?: number | null;
  active?: boolean;
};

type Round = {
  id: string;
  tournament_id: string;
  round_number: number;
  round_type:
    | "preliminary"
    | "quarterfinal"
    | "semifinal"
    | "final"
    | "pair_round_robin"
    | "split_semifinal"
    | "split_final";
  status: "pending" | "generated" | "in_progress" | "completed";
  created_at?: string;
};

type Match = {
  id: string;
  round_id: string;
  court_number: number | null;
  match_number: number;
  team1_score: number | null;
  team2_score: number | null;
  winner_team: number | null;
  status: "scheduled" | "in_progress" | "completed";
  created_at?: string;
  game_scores?: unknown;
};

type MatchPlayer = {
  id: string;
  match_id: string;
  player_id: string;
  team_number: number;
};

type Standing = {
  tournament_id: string;
  player_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  tournament_points: number;
  rank: number | null;
};

type ScoreInput = {
  team1: string;
  team2: string;
  games: GameScoreInput[];
};

type MatchView = Match & {
  team1Players: Player[];
  team2Players: Player[];
};

type HubView = "live" | "standings" | "results" | "progress";

const roundTypeLabel: Record<Round["round_type"], string> = {
  preliminary: "Preliminary",
  quarterfinal: "Quarterfinals",
  semifinal: "Semifinals",
  final: "Final",
  pair_round_robin: "Fixed-Pair Round Robin",
  split_semifinal: "Split-Pair Semifinals",
  split_final: "Split-Pair Finals",
};

function formatPoints(value: number | null | undefined) {
  return Number(value || 0).toFixed(1).replace(".0", "");
}

function roundTabLabel(round: Round) {
  if (round.round_type === "preliminary") {
    return `Round ${round.round_number}`;
  }

  if (round.round_type === "quarterfinal") return "Quarterfinals";
  if (round.round_type === "semifinal") return "Semifinals";
  if (round.round_type === "final") return "Final";

  return roundTypeLabel[round.round_type];
}

function getRoundTitle(round: Round | null, matchCount = 1) {
  if (!round) return "No Round";

  if (round.round_type === "preliminary") {
    return `Round ${round.round_number}`;
  }

  if (round.round_type === "final" && matchCount > 1) {
    return "Final & 3rd Place";
  }

  return roundTypeLabel[round.round_type];
}

function getStageDescription(
  round: Round | null,
  tournament: Tournament | null,
  matchCount = 1
) {
  if (!round || !tournament) return "";

  if (round.round_type === "preliminary") {
    return `Preliminary ${round.round_number} of ${tournament.preliminary_rounds}`;
  }

  if (round.round_type === "quarterfinal") {
    return "Top 16 Knockout";
  }

  if (round.round_type === "semifinal") {
    return individualQualificationCount(tournament.total_players) === 8
      ? "Top 8 from the prelims"
      : "Top 8 from the quarterfinals";
  }

  if (round.round_type === "final" && matchCount > 1) {
    return "Final and 3rd place. Semifinal pairs stay together.";
  }

  return "Championship Match";
}

export default function ControlCenterPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [roundSummaries, setRoundSummaries] = useState<
    Record<string, { done: number; total: number }>
  >({});
  const selectedRoundIdRef = useRef<string | null>(null);
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [completedMatches, setCompletedMatches] = useState<
    CompletedMatchView[]
  >([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [drawNumbers, setDrawNumbers] = useState<PlayerDrawNumber[]>([]);

  const [scoreInputs, setScoreInputs] = useState<
    Record<string, ScoreInput>
  >({});

  const [loading, setLoading] = useState(true);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeView, setActiveView] = useState<HubView>("live");
  const [matchFilter, setMatchFilter] = useState<"open" | "all">("open");
  const [courtFilter, setCourtFilter] = useState<number | null>(null);
  const dirtyMatchIds = useRef(new Set<string>());

  const loadControlCenter = useCallback(async () => {
    try {
      setError("");

      const activeTournamentId =
        typeof window !== "undefined"
          ? localStorage.getItem("activeTournamentId")
          : null;

      if (!activeTournamentId) {
        setTournament(null);
        setPlayers([]);
        setRounds([]);
        setCurrentRound(null);
        setMatches([]);
        setCompletedMatches([]);
        setStandings([]);
        setDrawNumbers([]);
        return;
      }

      const { data: tournamentData, error: tournamentError } =
        await supabase
          .from("tournaments")
          .select("*")
          .eq("id", activeTournamentId)
          .maybeSingle();

      if (tournamentError) {
        throw tournamentError;
      }

      if (!tournamentData) {
        localStorage.removeItem("activeTournamentId");
        setTournament(null);
        setPlayers([]);
        setRounds([]);
        setCurrentRound(null);
        setMatches([]);
        setCompletedMatches([]);
        setStandings([]);
        setDrawNumbers([]);
        return;
      }

      if (tournamentData.format === "team_groups") {
        window.location.href = "/team-center";
        return;
      }

      setTournament(tournamentData);

      const [
        playersResponse,
        roundsResponse,
        standingsResponse,
        drawNumbersResponse,
      ] = await Promise.all([
        supabase
          .from("players")
          .select("*")
          .eq("tournament_id", activeTournamentId)
          .order("name", { ascending: true }),

        supabase
          .from("rounds")
          .select("*")
          .eq("tournament_id", activeTournamentId)
          .order("round_number", { ascending: true }),

        supabase
          .from("player_standings")
          .select("*")
          .eq("tournament_id", activeTournamentId),
        supabase
          .from("player_draw_numbers")
          .select("player_id,phase,draw_number")
          .eq("tournament_id", activeTournamentId),
      ]);

      if (playersResponse.error) {
        throw playersResponse.error;
      }

      if (roundsResponse.error) {
        throw roundsResponse.error;
      }

      if (standingsResponse.error) {
        throw standingsResponse.error;
      }

      if (drawNumbersResponse.error) {
        throw drawNumbersResponse.error;
      }

      const loadedPlayers = (playersResponse.data || []) as Player[];
      const loadedRounds = (roundsResponse.data || []) as Round[];
      const loadedStandings = (standingsResponse.data || []) as Standing[];

      setPlayers(loadedPlayers);
      setRounds(loadedRounds);
      setStandings(loadedStandings);
      setDrawNumbers(
        (drawNumbersResponse.data || []) as PlayerDrawNumber[]
      );

      if (loadedRounds.length === 0) {
        selectedRoundIdRef.current = null;
        setCurrentRound(null);
        setRoundSummaries({});
        setMatches([]);
        return;
      }

      const { data: summaryRows, error: summaryError } = await supabase
        .from("matches")
        .select("round_id,status")
        .in(
          "round_id",
          loadedRounds.map((round) => round.id)
        );

      if (summaryError) {
        throw summaryError;
      }

      const summaries: Record<string, { done: number; total: number }> =
        {};

      (summaryRows || []).forEach((row) => {
        const summary = summaries[row.round_id] || { done: 0, total: 0 };
        summary.total += 1;

        if (row.status === "completed") {
          summary.done += 1;
        }

        summaries[row.round_id] = summary;
      });

      setRoundSummaries(summaries);

      /*
       * Stay on the round the table chose. Otherwise open the first
       * round that still has matches left.
       */
      const activeRound =
        loadedRounds.find(
          (round) => round.id === selectedRoundIdRef.current
        ) ||
        loadedRounds.find((round) => round.status !== "completed") ||
        loadedRounds[loadedRounds.length - 1];

      selectedRoundIdRef.current = activeRound.id;

      if (
        tournamentData.format === "split_pairs" &&
        activeRound.round_type !== "preliminary"
      ) {
        window.location.href = "/split-pairs-center";
        return;
      }

      setCurrentRound(activeRound);

      if (
        !tournamentData.format ||
        tournamentData.format === "individual"
      ) {
        setCompletedMatches(
          await loadCompletedMatches(activeTournamentId)
        );
      } else {
        setCompletedMatches([]);
      }

      const { data: matchData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .eq("round_id", activeRound.id)
        .order("match_number", { ascending: true });

      if (matchesError) {
        throw matchesError;
      }

      const loadedMatches = (matchData || []) as Match[];

      if (loadedMatches.length === 0) {
        setMatches([]);
        return;
      }

      const matchIds = loadedMatches.map((match) => match.id);

      const { data: matchPlayerData, error: matchPlayersError } =
        await supabase
          .from("match_players")
          .select("*")
          .in("match_id", matchIds);

      if (matchPlayersError) {
        throw matchPlayersError;
      }

      const loadedMatchPlayers = (matchPlayerData ||
        []) as MatchPlayer[];

      const playerMap = new Map(
        loadedPlayers.map((player) => [player.id, player])
      );

      const enrichedMatches: MatchView[] = loadedMatches.map((match) => {
        const matchPlayers = loadedMatchPlayers.filter(
          (mp) => mp.match_id === match.id
        );

        const team1Players = matchPlayers
          .filter((mp) => mp.team_number === 1)
          .map((mp) => playerMap.get(mp.player_id))
          .filter(Boolean) as Player[];

        const team2Players = matchPlayers
          .filter((mp) => mp.team_number === 2)
          .map((mp) => playerMap.get(mp.player_id))
          .filter(Boolean) as Player[];

        return {
          ...match,
          team1Players,
          team2Players,
        };
      });

      setMatches(enrichedMatches);

      const initialScores: Record<string, ScoreInput> = {};

      enrichedMatches.forEach((match) => {
        initialScores[match.id] = {
          team1:
            match.team1_score !== null
              ? String(match.team1_score)
              : "",
          team2:
            match.team2_score !== null
              ? String(match.team2_score)
              : "",
          games: gameInputsFromMatch(match.game_scores),
        };
      });

      setScoreInputs((current) => {
        const next = { ...initialScores };

        dirtyMatchIds.current.forEach((matchId) => {
          if (current[matchId] && next[matchId]) {
            next[matchId] = current[matchId];
          }
        });

        return next;
      });
    } catch (err: unknown) {
      console.error("Control center load error:", err);
      setError(
        (err instanceof Error ? err.message : "") ||
          "Unable to load the tournament control center."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // The callback performs the initial external data synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadControlCenter();

    const interval = setInterval(() => {
      loadControlCenter();
    }, 15000);

    return () => clearInterval(interval);
  }, [loadControlCenter]);

  const standingsWithPlayers = useMemo(() => {
    const playerMap = new Map(
      players.map((player) => [player.id, player])
    );

    return standings
      .map((standing) => ({
        ...standing,
        player: playerMap.get(standing.player_id),
        pointDifference:
          Number(standing.points_for || 0) -
          Number(standing.points_against || 0),
      }))
      .filter((row) => row.player)
      .sort((a, b) => {
        if (
          Number(b.tournament_points) !==
          Number(a.tournament_points)
        ) {
          return (
            Number(b.tournament_points) -
            Number(a.tournament_points)
          );
        }

        if (b.wins !== a.wins) {
          return b.wins - a.wins;
        }

        if (b.pointDifference !== a.pointDifference) {
          return b.pointDifference - a.pointDifference;
        }

        return (
          Number(b.points_for || 0) -
          Number(a.points_for || 0)
        );
      });
  }, [players, standings]);

  const activeDrawNumbers = useMemo(
    () =>
      drawNumberMap(
        drawNumbers,
        drawPhaseForRound(currentRound?.round_type)
      ),
    [currentRound?.round_type, drawNumbers]
  );

  const playerLabel = (player: Player) => {
    const number = activeDrawNumbers.get(player.id);

    return number ? `#${number} ${player.name}` : player.name;
  };

  const finishedInRound = useMemo(
    () =>
      matches.filter(
        (match) =>
          match.status === "completed" ||
          match.winner_team !== null
      ),
    [matches]
  );

  const pendingMatches = useMemo(
    () =>
      matches.filter(
        (match) =>
          match.status !== "completed" &&
          match.winner_team === null
      ),
    [matches]
  );

  const visibleMatches = useMemo(
    () =>
      matches.filter((match) => {
        const onCourt =
          courtFilter === null || match.court_number === courtFilter;
        const isOpen =
          match.status !== "completed" && match.winner_team === null;

        return onCourt && (matchFilter === "all" || isOpen);
      }),
    [courtFilter, matchFilter, matches]
  );

  const visibleMatchesByCourt = useMemo(() => {
    const grouped: Record<number, MatchView[]> = {};

    visibleMatches.forEach((match) => {
      const court = match.court_number || 1;
      grouped[court] = grouped[court] || [];
      grouped[court].push(match);
    });

    return grouped;
  }, [visibleMatches]);

  const progress = useMemo(() => {
    if (!currentRound || matches.length === 0) return 0;

    return Math.round(
      (finishedInRound.length / matches.length) * 100
    );
  }, [currentRound, matches.length, finishedInRound.length]);

  const tournamentProgress = useMemo(() => {
    if (!tournament) return 0;

    const completedRounds = rounds.filter(
      (round) => round.status === "completed"
    ).length;

    if (rounds.length === 0) return 0;

    return Math.round(
      (completedRounds / rounds.length) * 100
    );
  }, [tournament, rounds]);

  const allCurrentMatchesCompleted =
    matches.length > 0 &&
    matches.every(
      (match) =>
        match.status === "completed" ||
        match.winner_team !== null
    );

  const preliminaryRounds = rounds.filter(
    (round) => round.round_type === "preliminary"
  );
  const allPrelimsComplete =
    Boolean(tournament) &&
    preliminaryRounds.length >= (tournament?.preliminary_rounds || 0) &&
    preliminaryRounds.every((round) => round.status === "completed");
  const laterStageExists = rounds.some(
    (round) => round.round_type !== "preliminary"
  );

  const isFinalCompleted =
    currentRound?.round_type === "final" &&
    currentRound.status === "completed";

  const isTournamentCompleted =
    tournament?.status === "completed" || isFinalCompleted;

  const readyForNextStage =
    !isTournamentCompleted &&
    ((currentRound?.round_type === "preliminary" &&
      allPrelimsComplete &&
      !laterStageExists) ||
      (currentRound?.round_type !== "preliminary" &&
        currentRound?.round_type !== "final" &&
        allCurrentMatchesCompleted &&
        currentRound?.status === "completed"));

  const finalTeams = useMemo(() => {
    if (!isTournamentCompleted) {
      return null;
    }

    const finalMatch = championshipMatch(matches);
    const bronzeMatch = thirdPlaceMatch(matches);

    if (!finalMatch?.winner_team) {
      return null;
    }

    const thirdPlaceWinners = bronzeMatch?.winner_team
      ? bronzeMatch.winner_team === 1
        ? bronzeMatch.team1Players
        : bronzeMatch.team2Players
      : [];

    return {
      champions:
        finalMatch.winner_team === 1
          ? finalMatch.team1Players
          : finalMatch.team2Players,
      runnersUp:
        finalMatch.winner_team === 1
          ? finalMatch.team2Players
          : finalMatch.team1Players,
      thirdPlaceWinners,
    };
  }, [isTournamentCompleted, matches]);

  const updateScoreInput = (
    matchId: string,
    team: "team1" | "team2",
    value: string
  ) => {
    const sanitized = sanitizeScoreInput(value);

    if (sanitized === null) {
      return;
    }

    dirtyMatchIds.current.add(matchId);
    setScoreInputs((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] || {
          team1: "",
          team2: "",
          games: emptyGameInputs(),
        }),
        [team]: sanitized,
      },
    }));
  };

  const updateGameScoreInput = (
    matchId: string,
    gameIndex: number,
    team: "team1" | "team2",
    value: string
  ) => {
    dirtyMatchIds.current.add(matchId);
    setScoreInputs((current) => {
      const existing = current[matchId] || {
        team1: "",
        team2: "",
        games: emptyGameInputs(),
      };
      const games = [...(existing.games || emptyGameInputs())];

      while (games.length < 3) {
        games.push({ team1: "", team2: "" });
      }

      games[gameIndex] = {
        ...games[gameIndex],
        [team]: value,
      };

      return {
        ...current,
        [matchId]: {
          ...existing,
          games,
        },
      };
    });
  };

  const saveMatchResult = async (match: MatchView) => {
    try {
      setSavingMatchId(match.id);
      setError("");
      setSuccess("");

      const score = scoreInputs[match.id];

      if (!score) {
        throw new Error("Enter both scores.");
      }

      const bestOfThree = usesBestOfThree(
        currentRound?.round_type,
        tournament?.format
      );

      let team1Score: number;
      let team2Score: number;
      let winnerTeam: number;
      let winnerPoints: number;
      let loserPoints: number;
      let team1Rally: number;
      let team2Rally: number;
      let gameScores: { team1: number; team2: number }[] | null = null;

      if (bestOfThree) {
        const result = resolveBestOfThree(score.games || emptyGameInputs());

        if ("error" in result) {
          throw new Error(result.error);
        }

        team1Score = result.team1Games;
        team2Score = result.team2Games;
        winnerTeam = result.winnerTeam;
        team1Rally = result.team1Rally;
        team2Rally = result.team2Rally;
        winnerPoints =
          (winnerTeam === 1 ? team1Rally : team2Rally) / 2;
        loserPoints =
          (winnerTeam === 1 ? team2Rally : team1Rally) / 2;
        gameScores = result.games;
      } else {
        if (score.team1 === "" || score.team2 === "") {
          throw new Error("Enter both scores.");
        }

        team1Score = Number(score.team1);
        team2Score = Number(score.team2);

        const scoreError = validateCompletedScore(
          team1Score,
          team2Score,
          currentRound?.round_type
        );

        if (scoreError) {
          throw new Error(scoreError);
        }

        winnerTeam = team1Score > team2Score ? 1 : 2;
        team1Rally = team1Score;
        team2Rally = team2Score;
        const winningScore = Math.max(team1Score, team2Score);
        const losingScore = Math.min(team1Score, team2Score);
        winnerPoints = winningScore / 2;
        loserPoints = losingScore / 2;
      }

      if (
        match.team1Players.length !== 2 ||
        match.team2Players.length !== 2
      ) {
        throw new Error(
          "Each match must have exactly two players per team."
        );
      }

      /*
       * Protect against double scoring.
       */
      if (match.status === "completed") {
        throw new Error("This match has already been completed.");
      }

      const { data: updatedMatch, error: matchUpdateError } =
        await supabase
          .from("matches")
          .update({
            team1_score: team1Score,
            team2_score: team2Score,
            winner_team: winnerTeam,
            status: "completed",
            ...(gameScores ? { game_scores: gameScores } : {}),
          })
          .eq("id", match.id)
          .eq("status", "scheduled")
          .select("id")
          .maybeSingle();

      if (matchUpdateError) {
        throw matchUpdateError;
      }

      if (!updatedMatch) {
        throw new Error(
          "This match was already updated. Refresh the page."
        );
      }

      const team1PointsFor = team1Rally / 2;
      const team1PointsAgainst = team2Rally / 2;
      const team2PointsFor = team2Rally / 2;
      const team2PointsAgainst = team1Rally / 2;

      const team1Winner = winnerTeam === 1;

      const team1Players = match.team1Players;
      const team2Players = match.team2Players;

      for (const player of team1Players) {
        const isWinner = team1Winner;

        const points = isWinner ? winnerPoints : loserPoints;

        const { data: existingStanding, error: standingFetchError } =
          await supabase
            .from("player_standings")
            .select("*")
            .eq("tournament_id", tournament!.id)
            .eq("player_id", player.id)
            .single();

        if (standingFetchError) {
          throw standingFetchError;
        }

        const { error: standingUpdateError } = await supabase
          .from("player_standings")
          .update({
            matches_played:
              Number(existingStanding.matches_played || 0) + 1,
            wins:
              Number(existingStanding.wins || 0) +
              (isWinner ? 1 : 0),
            losses:
              Number(existingStanding.losses || 0) +
              (isWinner ? 0 : 1),
            points_for:
              Number(existingStanding.points_for || 0) +
              team1PointsFor,
            points_against:
              Number(existingStanding.points_against || 0) +
              team1PointsAgainst,
            tournament_points:
              Number(existingStanding.tournament_points || 0) +
              points,
          })
          .eq("tournament_id", tournament!.id)
          .eq("player_id", player.id);

        if (standingUpdateError) {
          throw standingUpdateError;
        }
      }

      for (const player of team2Players) {
        const isWinner = !team1Winner;

        const points = isWinner ? winnerPoints : loserPoints;

        const { data: existingStanding, error: standingFetchError } =
          await supabase
            .from("player_standings")
            .select("*")
            .eq("tournament_id", tournament!.id)
            .eq("player_id", player.id)
            .single();

        if (standingFetchError) {
          throw standingFetchError;
        }

        const { error: standingUpdateError } = await supabase
          .from("player_standings")
          .update({
            matches_played:
              Number(existingStanding.matches_played || 0) + 1,
            wins:
              Number(existingStanding.wins || 0) +
              (isWinner ? 1 : 0),
            losses:
              Number(existingStanding.losses || 0) +
              (isWinner ? 0 : 1),
            points_for:
              Number(existingStanding.points_for || 0) +
              team2PointsFor,
            points_against:
              Number(existingStanding.points_against || 0) +
              team2PointsAgainst,
            tournament_points:
              Number(existingStanding.tournament_points || 0) +
              points,
          })
          .eq("tournament_id", tournament!.id)
          .eq("player_id", player.id);

        if (standingUpdateError) {
          throw standingUpdateError;
        }
      }

      /*
       * Check whether every match in the current round is now complete.
       */
      const { data: roundMatches, error: roundMatchesError } =
        await supabase
          .from("matches")
          .select("id, status, winner_team")
          .eq("round_id", match.round_id);

      if (roundMatchesError) {
        throw roundMatchesError;
      }

      const roundComplete =
        (roundMatches || []).length > 0 &&
        (roundMatches || []).every(
          (item) =>
            item.status === "completed" ||
            item.winner_team !== null
        );

      if (roundComplete) {
        const { error: roundUpdateError } = await supabase
          .from("rounds")
          .update({
            status: "completed",
          })
          .eq("id", match.round_id);

        if (roundUpdateError) {
          throw roundUpdateError;
        }

        /*
         * If this was the Final, mark tournament completed.
         */
        if (currentRound?.round_type === "final") {
          const { error: tournamentUpdateError } = await supabase
            .from("tournaments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", tournament!.id);

          if (tournamentUpdateError) {
            throw tournamentUpdateError;
          }
        }
      }

      setSuccess(
        roundComplete
          ? "Match saved. Round completed!"
          : "Match result saved successfully."
      );

      dirtyMatchIds.current.delete(match.id);
      await loadControlCenter();
    } catch (err: unknown) {
      console.error("Save match error:", err);

      setError(
        (err instanceof Error ? err.message : "") ||
          "Unable to save the match result."
      );
    } finally {
      setSavingMatchId(null);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setSuccess("");
    await loadControlCenter();
  };

  const goHome = () => {
    window.location.href = "/";
  };

  const goLeaderboard = () => {
    window.location.href = "/leaderboard";
  };

  const goNewTournament = () => {
    localStorage.removeItem("activeTournamentId");
    window.location.href = "/?create=1#create-tournament";
  };

  const goTournamentHistory = () => {
    window.location.href = "/tournaments";
  };

  const goGenerateNextRound = () => {
    /*
     * The existing tournament page owns the round-generation engine.
     * Send the organizer back there after completing the current round.
     *
     * Your existing app/page.tsx will display the next-round controls.
     */
    window.location.href = "/#next-round";
  };

  const selectHubView = (view: HubView) => {
    setActiveView(view);
    scrollToSection("hub-content");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex justify-end">
            <AppNav />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
            <div className="text-4xl">🏸</div>
            <h1 className="mt-4 text-2xl font-bold">
              Loading Tournament Control Center...
            </h1>
            <p className="mt-2 text-slate-400">
              Connecting to your tournament.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
            <div className="text-5xl">🏸</div>

            <h1 className="mt-5 text-3xl font-bold">
              Tournament Control Center
            </h1>

            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              No active tournament was found. Create or resume a
              tournament from the home page.
            </p>

            <button
              onClick={goHome}
              className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white transition hover:bg-emerald-500"
            >
              🏠 Go to Tournament Home
            </button>

            <button
              onClick={goTournamentHistory}
              className="mt-3 rounded-xl border border-slate-700 px-6 py-3 font-bold transition hover:bg-slate-800"
            >
              📋 Tournament History
            </button>
          </div>
        </div>
      </main>
    );
  }

  const hubItems: { id: HubView; label: string }[] = [
    { id: "live", label: "Live" },
    { id: "standings", label: "Standings" },
    { id: "results", label: "Results" },
    { id: "progress", label: "Progress" },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 pb-36 text-white md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <header className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-4xl">🏸</span>

                <div>
                  <h1 className="text-xl font-black md:text-3xl">
                    {tournament.name}
                  </h1>

                  <p className="mt-1 text-sm text-slate-400">
                    {currentRound
                      ? getRoundTitle(currentRound, matches.length)
                      : "Tournament Control Center"}
                  </p>
                </div>
              </div>
            </div>

            <AppNav links={["leaderboard", "history", "format"]}>
              <button
                onClick={refresh}
                disabled={refreshing}
                className="min-h-11 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold transition hover:bg-slate-800 disabled:opacity-50 sm:px-4"
              >
                {refreshing ? "Refreshing..." : "🔄 Refresh"}
              </button>
            </AppNav>
          </div>
        </header>

        {/* ERROR / SUCCESS */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-300">
            <div className="font-bold">❌ Error</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300">
            <div className="font-bold">✅ {success}</div>
          </div>
        )}

        <nav
          aria-label="Control center sections"
          className="mb-6 hidden rounded-xl border border-slate-800 bg-slate-900 p-1 md:grid md:grid-cols-4"
        >
          {hubItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectHubView(item.id)}
              className={`min-h-11 rounded-lg px-4 py-2 text-sm font-bold transition ${
                activeView === item.id
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="fixed inset-x-4 bottom-20 z-30 md:sticky md:inset-x-auto md:top-4 md:mb-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/95 p-3 backdrop-blur">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                {readyForNextStage ? "Prelims complete" : "Selected round"}
              </div>
              <div className="truncate text-sm font-semibold">
                {readyForNextStage
                  ? "Ready to generate the next stage"
                  : `${pendingMatches.length} match${
                      pendingMatches.length === 1 ? "" : "es"
                    } remaining in this round`}
              </div>
            </div>
            {readyForNextStage ? (
              <button
                type="button"
                onClick={goGenerateNextRound}
                className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black hover:bg-emerald-500"
              >
                Next round
              </button>
            ) : (
              <button
                type="button"
                onClick={() => selectHubView("live")}
                className="shrink-0 rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-800"
              >
                Open live
              </button>
            )}
          </div>
        </div>

        <div id="hub-content" className="scroll-mt-4" />

        {/* TOURNAMENT SUMMARY */}
        {activeView === "progress" && (
        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Players
            </div>
            <div className="mt-1 text-2xl font-black">
              {tournament.total_players}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Courts
            </div>
            <div className="mt-1 text-2xl font-black">
              {tournament.courts}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Preliminary Rounds
            </div>
            <div className="mt-1 text-2xl font-black">
              {tournament.preliminary_rounds}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {tournament.format === "split_pairs"
                ? "After Prelims"
                : "Qualification"}
            </div>
            <div className="mt-1 text-2xl font-black">
              {tournament.format === "split_pairs"
                ? "Champ / Plate"
                : `Top ${
                    tournament.format === "team_groups"
                      ? tournament.qualification_count
                      : individualQualificationCount(tournament.total_players)
                  }`}
            </div>
          </div>
        </section>
        )}

        {/* TOURNAMENT STATUS */}
        {activeView === "progress" && (
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Tournament Status
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black">
                  {isTournamentCompleted
                    ? "🏆 Tournament Complete"
                    : currentRound
                    ? getRoundTitle(currentRound)
                    : "Ready"}
                </h2>

                {currentRound && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      currentRound.status === "completed"
                        ? "bg-emerald-950 text-emerald-400"
                        : "bg-blue-950 text-blue-400"
                    }`}
                  >
                    {currentRound.status.toUpperCase()}
                  </span>
                )}
              </div>

              {currentRound && (
                <p className="mt-1 text-sm text-slate-400">
                  {getStageDescription(
                    currentRound,
                    tournament,
                    matches.length
                  )}
                </p>
              )}
            </div>

            <div className="min-w-[220px]">
              <div className="mb-2 flex justify-between text-xs text-slate-400">
                <span>Tournament Progress</span>
                <span>{tournamentProgress}%</span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${tournamentProgress}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>
        )}

        {/* CURRENT ROUND */}
        {activeView === "live" && currentRound && (
          <section className="mb-8">
            {rounds.length > 1 && (
              <div className="mb-5 flex gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-2">
                {rounds.map((round) => {
                  const summary = roundSummaries[round.id];
                  const active = round.id === currentRound.id;

                  return (
                    <button
                      key={round.id}
                      type="button"
                      onClick={() => {
                        selectedRoundIdRef.current = round.id;
                        loadControlCenter();
                      }}
                      className={`min-h-14 min-w-[7.5rem] shrink-0 rounded-lg px-3 py-2 text-left transition ${
                        active
                          ? "bg-emerald-600 text-white"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <span className="block text-sm font-black">
                        {roundTabLabel(round)}
                      </span>
                      <span
                        className={`mt-1 block text-xs font-semibold ${
                          active ? "text-emerald-100" : "text-slate-500"
                        }`}
                      >
                        {summary
                          ? `${summary.done}/${summary.total} played`
                          : "Open"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                    Leaderboard
                  </div>
                  <p className="text-sm text-slate-400">
                    {tournament.format === "split_pairs"
                      ? "Top 10 reach the Championship draw."
                      : individualQualificationCount(tournament.total_players) ===
                          16
                        ? `Top 16 of ${tournament.total_players} reach the quarterfinals.`
                        : `Top 8 of ${tournament.total_players} reach the semifinals.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={goLeaderboard}
                  className="shrink-0 text-sm font-bold text-emerald-400 hover:text-emerald-300"
                >
                  Full board
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {standingsWithPlayers
                  .slice(
                    0,
                    tournament.format === "split_pairs"
                      ? 10
                      : individualQualificationCount(tournament.total_players)
                  )
                  .map((row, index) => (
                  <div
                    key={row.player_id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-950 px-3 py-2"
                  >
                    <div className="min-w-0 truncate">
                      <span className="mr-2 font-black text-emerald-400">
                        #{index + 1}
                      </span>
                      <span className="font-semibold">
                        {row.player ? playerLabel(row.player) : "Player"}
                      </span>
                    </div>
                    <div className="shrink-0 text-sm">
                      <span className="font-black text-yellow-400">
                        {formatPoints(row.tournament_points)}
                      </span>
                      <span className="ml-2 text-slate-500">
                        {row.wins}-{row.losses}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {standingsWithPlayers.length === 0 && (
                <p className="text-sm text-slate-500">
                  Scores will show here after the first match.
                </p>
              )}
            </div>

            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  Current Stage
                </div>

                <h2 className="text-2xl font-black">
                  {getRoundTitle(currentRound, matches.length)}
                </h2>

                <p className="text-sm text-slate-400">
                  {getStageDescription(
                    currentRound,
                    tournament,
                    matches.length
                  )}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {scoreRuleHint(
                    currentRound.round_type,
                    tournament.format
                  )}
                </p>
              </div>

              <div className="min-w-[220px]">
                <div className="mb-2 flex justify-between text-xs text-slate-400">
                  <span>
                    {finishedInRound.length} /{" "}
                    {matches.length} matches
                  </span>

                  <span>{progress}%</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-1">
                {(["open", "all"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setMatchFilter(filter)}
                    className={`min-h-10 rounded-md px-4 py-2 text-sm font-bold capitalize ${
                      matchFilter === filter
                        ? "bg-emerald-600 text-white"
                        : "text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    {filter}
                    {filter === "open" ? ` (${pendingMatches.length})` : ""}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setCourtFilter(null)}
                  className={`min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${
                    courtFilter === null
                      ? "bg-slate-700 text-white"
                      : "border border-slate-800 text-slate-400"
                  }`}
                >
                  All courts
                </button>
                {Array.from(
                  { length: tournament.courts },
                  (_, index) => index + 1
                ).map((court) => (
                  <button
                    key={court}
                    type="button"
                    onClick={() => setCourtFilter(court)}
                    className={`min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${
                      courtFilter === court
                        ? "bg-slate-700 text-white"
                        : "border border-slate-800 text-slate-400"
                    }`}
                  >
                    Court {court}
                  </button>
                ))}
              </div>
            </div>

            {finishedInRound.length > 0 && matchFilter === "open" && (
              <button
                type="button"
                onClick={() => setMatchFilter("all")}
                className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                    Latest result
                  </span>
                  <span className="block truncate text-sm font-semibold">
                    {finishedInRound[
                      finishedInRound.length - 1
                    ].team1Players
                      .map(playerLabel)
                      .join(" + ")}{" "}
                    vs{" "}
                    {finishedInRound[
                      finishedInRound.length - 1
                    ].team2Players
                      .map(playerLabel)
                      .join(" + ")}
                  </span>
                </span>
                <span className="shrink-0 font-black text-emerald-400">
                  {formatMatchScoreLine(
                    finishedInRound[finishedInRound.length - 1]
                  )}
                </span>
              </button>
            )}

            {/* COURTS */}
            <div className="grid gap-5 lg:grid-cols-3">
              {Array.from(
                {
                  length: tournament.courts,
                },
                (_, index) => index + 1
              ).map((courtNumber) => {
                const courtMatches =
                  visibleMatchesByCourt[courtNumber] || [];

                if (courtFilter !== null && courtFilter !== courtNumber) {
                  return null;
                }

                if (courtMatches.length === 0 && matchFilter === "open") {
                  return null;
                }

                return (
                  <div
                    key={courtNumber}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-slate-500">
                          Court
                        </div>

                        <div className="text-xl font-black">
                          {courtNumber}
                        </div>
                      </div>

                      <div className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-400">
                        {courtMatches.length} match
                        {courtMatches.length === 1
                          ? ""
                          : "es"}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {courtMatches.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">
                          No matches scheduled
                        </div>
                      )}

                      {courtMatches.map((match) => {
                        const score =
                          scoreInputs[match.id] || {
                            team1: "",
                            team2: "",
                            games: emptyGameInputs(),
                          };

                        const completed =
                          match.status === "completed" ||
                          match.winner_team !== null;

                        const team1Winner =
                          match.winner_team === 1;

                        const team2Winner =
                          match.winner_team === 2;

                        const bestOfThree = usesBestOfThree(
                          currentRound.round_type,
                          tournament.format
                        );

                        if (completed) {
                          return (
                            <div
                              key={match.id}
                              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold">
                                    {match.team1Players
                                      .map(playerLabel)
                                      .join(" + ")}
                                  </div>
                                  <div className="truncate text-sm text-slate-400">
                                    {match.team2Players
                                      .map(playerLabel)
                                      .join(" + ")}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <div className="font-black text-emerald-400">
                                    {formatMatchScoreLine(match)}
                                  </div>
                                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                                    Completed
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={match.id}
                            className={`rounded-xl border p-4 ${
                              completed
                                ? "border-emerald-900 bg-emerald-950/20"
                                : "border-slate-700 bg-slate-950"
                            }`}
                          >
                            <div className="mb-4 flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                {finalsScheduleLabel(
                                  currentRound.round_type,
                                  match.match_number,
                                  matches.length
                                )}
                              </span>

                              {completed ? (
                                <span className="rounded-full bg-emerald-950 px-2 py-1 text-[10px] font-bold text-emerald-400">
                                  COMPLETED
                                </span>
                              ) : (
                                <span className="rounded-full bg-blue-950 px-2 py-1 text-[10px] font-bold text-blue-400">
                                  OPEN
                                </span>
                              )}
                            </div>

                            {/* TEAM 1 */}
                            <div
                              className={`rounded-lg p-3 ${
                                team1Winner
                                  ? "bg-emerald-950/50 ring-1 ring-emerald-700"
                                  : "bg-slate-900"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    Team 1
                                  </div>

                                  <div className="mt-1 text-sm font-bold">
                                    {match.team1Players
                                      .map(playerLabel)
                                      .join(" + ")}
                                  </div>
                                </div>

                                {!bestOfThree && (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  value={score.team1}
                                  disabled={completed}
                                  onChange={(event) =>
                                    updateScoreInput(
                                      match.id,
                                      "team1",
                                      event.target.value
                                    )
                                  }
                                  className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-center text-xl font-black outline-none focus:border-emerald-500 disabled:opacity-60"
                                  placeholder="0"
                                />
                                )}
                              </div>
                            </div>

                            <div className="py-2 text-center text-xs font-bold text-slate-600">
                              VS
                            </div>

                            {/* TEAM 2 */}
                            <div
                              className={`rounded-lg p-3 ${
                                team2Winner
                                  ? "bg-emerald-950/50 ring-1 ring-emerald-700"
                                  : "bg-slate-900"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    Team 2
                                  </div>

                                  <div className="mt-1 text-sm font-bold">
                                    {match.team2Players
                                      .map(playerLabel)
                                      .join(" + ")}
                                  </div>
                                </div>

                                {!bestOfThree && (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  value={score.team2}
                                  disabled={completed}
                                  onChange={(event) =>
                                    updateScoreInput(
                                      match.id,
                                      "team2",
                                      event.target.value
                                    )
                                  }
                                  className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-center text-xl font-black outline-none focus:border-emerald-500 disabled:opacity-60"
                                  placeholder="0"
                                />
                                )}
                              </div>
                            </div>

                            {bestOfThree && (
                              <BestOfThreeScoreInputs
                                games={
                                  score.games || emptyGameInputs()
                                }
                                disabled={completed}
                                onChange={(gameIndex, team, value) =>
                                  updateGameScoreInput(
                                    match.id,
                                    gameIndex,
                                    team,
                                    value
                                  )
                                }
                              />
                            )}

                            {!completed && (
                              <button
                                onClick={() =>
                                  saveMatchResult(match)
                                }
                                disabled={
                                  savingMatchId === match.id
                                }
                                className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {savingMatchId === match.id
                                  ? "Saving..."
                                  : "Save Score"}
                              </button>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleMatches.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
                <div className="font-bold">No open matches</div>
                <p className="mt-1 text-sm text-slate-400">
                  Switch to All to review finished matches from this round.
                </p>
              </div>
            )}
          </section>
        )}

        {activeView === "results" &&
          (!tournament.format ||
          tournament.format === "individual") && (
          <CompletedMatches
            tournamentId={tournament.id}
            matches={completedMatches}
            onSaved={loadControlCenter}
          />
        )}
        {activeView === "results" &&
          completedMatches.length === 0 && (
            <section className="rounded-2xl border border-dashed border-slate-700 p-10 text-center">
              <h2 className="text-xl font-black">
                No completed matches yet
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Finished scores will be grouped here by round.
              </p>
            </section>
          )}

        {/* ROUND COMPLETE */}
        {activeView === "progress" &&
          currentRound &&
          readyForNextStage && (
            <section className="mb-8 rounded-2xl border border-emerald-800 bg-emerald-950/30 p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-bold uppercase tracking-widest text-emerald-400">
                    Round Complete
                  </div>

                  <h2 className="mt-1 text-2xl font-black">
                    {getRoundTitle(currentRound)} completed
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    All matches have been completed. Continue
                    to the next stage from the tournament page.
                  </p>
                </div>

                <button
                  onClick={goGenerateNextRound}
                  className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white transition hover:bg-emerald-500"
                >
                  ➡️ Generate Next Round
                </button>
              </div>
            </section>
          )}

        {/* FINAL COMPLETED */}
        {activeView === "progress" && isTournamentCompleted && (
          <section className="mb-8 overflow-hidden rounded-2xl border border-yellow-700 bg-gradient-to-br from-yellow-950/50 to-slate-950 p-8 text-center">
            <div className="text-6xl">🏆</div>

            <h2 className="mt-4 text-3xl font-black text-yellow-400">
              Tournament Complete!
            </h2>

            {finalTeams && (
              <div className="mx-auto mt-6 grid max-w-3xl gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-yellow-700 bg-yellow-950/30 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-yellow-500">
                    Champions
                  </div>
                  <div className="mt-2 text-lg font-black text-yellow-300">
                    {formatDoublesTeam(finalTeams.champions)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-600 bg-slate-900/70 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-300">
                    Runners Up
                  </div>
                  <div className="mt-2 text-lg font-black text-slate-100">
                    {formatDoublesTeam(finalTeams.runnersUp)}
                  </div>
                </div>

                {finalTeams.thirdPlaceWinners.length > 0 && (
                  <div className="rounded-xl border border-amber-800 bg-amber-950/20 p-4 md:col-span-2">
                    <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                      3rd Place
                    </div>
                    <div className="mt-2 text-lg font-black text-amber-200">
                      {formatDoublesTeam(finalTeams.thirdPlaceWinners)}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="mt-2 text-slate-300">
              The Final has been completed.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={goLeaderboard}
                className="rounded-xl bg-yellow-500 px-6 py-3 font-black text-slate-950 transition hover:bg-yellow-400"
              >
                📊 View Final Leaderboard
              </button>

              <button
                onClick={goTournamentHistory}
                className="rounded-xl border border-slate-700 px-6 py-3 font-bold transition hover:bg-slate-800"
              >
                📋 Tournament History
              </button>

              <button
                onClick={goNewTournament}
                className="rounded-xl border border-emerald-700 px-6 py-3 font-bold text-emerald-400 transition hover:bg-emerald-950"
              >
                ➕ New Tournament
              </button>
            </div>
          </section>
        )}

        {/* LEADERBOARD PREVIEW */}
        {activeView === "standings" && (
        <section className="mb-8">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Standings
              </div>

              <h2 className="text-2xl font-black">
                Current Leaderboard
              </h2>

              <p className="text-sm text-slate-400">
                Ranked by tournament points, wins and point
                differential.
              </p>
            </div>

            <button
              onClick={goLeaderboard}
              className="text-sm font-bold text-emerald-400 hover:text-emerald-300"
            >
              View Full Leaderboard →
            </button>
          </div>

          <div className="space-y-2 md:hidden">
            {standingsWithPlayers.map((row, index) => {
              const rank = index + 1;
              const qualificationCount =
                tournament.format === "split_pairs"
                  ? 10
                  : individualQualificationCount(tournament.total_players);

              return (
                <article
                  key={row.player_id}
                  className={`rounded-xl border p-4 ${
                    rank <= qualificationCount
                      ? "border-emerald-900 bg-emerald-950/20"
                      : "border-slate-800 bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="w-8 shrink-0 text-center text-lg font-black text-slate-400">
                        {rank}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-black">
                          {row.player ? playerLabel(row.player) : "Player"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.matches_played} played · {row.wins} wins ·{" "}
                          {row.losses} losses
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-black text-emerald-400">
                        {formatPoints(row.tournament_points)}
                      </div>
                      <div
                        className={`text-xs font-bold ${
                          row.pointDifference >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {row.pointDifference > 0 ? "+" : ""}
                        {formatPoints(row.pointDifference)} diff
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3 text-center">
                      MP
                    </th>
                    <th className="px-4 py-3 text-center">
                      W
                    </th>
                    <th className="px-4 py-3 text-center">
                      L
                    </th>
                    <th className="px-4 py-3 text-center">
                      PF
                    </th>
                    <th className="px-4 py-3 text-center">
                      PA
                    </th>
                    <th className="px-4 py-3 text-center">
                      Diff
                    </th>
                    <th className="px-4 py-3 text-right">
                      Points
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {standingsWithPlayers.map((row, index) => {
                      const rank = index + 1;
                      const qualificationCount =
                        tournament.format === "split_pairs"
                          ? 20
                          : individualQualificationCount(
                              tournament.total_players
                            );

                      return (
                        <tr
                          key={row.player_id}
                          className={`border-b border-slate-800 last:border-0 ${
                            rank <= qualificationCount
                              ? "bg-emerald-950/10"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-black">{rank}</span>

                              {rank <= qualificationCount && (
                                <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                                  {tournament.format === "split_pairs"
                                    ? rank <= 10
                                      ? "CHAMPIONSHIP"
                                      : "PLATE"
                                    : `TOP ${individualQualificationCount(tournament.total_players)}`}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-bold">
                            {row.player ? playerLabel(row.player) : "Player"}
                          </td>

                          <td className="px-4 py-3 text-center text-slate-400">
                            {row.matches_played}
                          </td>

                          <td className="px-4 py-3 text-center text-emerald-400">
                            {row.wins}
                          </td>

                          <td className="px-4 py-3 text-center text-red-400">
                            {row.losses}
                          </td>

                          <td className="px-4 py-3 text-center">
                            {formatPoints(row.points_for)}
                          </td>

                          <td className="px-4 py-3 text-center">
                            {formatPoints(
                              row.points_against
                            )}
                          </td>

                          <td
                            className={`px-4 py-3 text-center font-semibold ${
                              row.pointDifference >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {row.pointDifference > 0
                              ? "+"
                              : ""}
                            {formatPoints(
                              row.pointDifference
                            )}
                          </td>

                          <td className="px-4 py-3 text-right text-base font-black text-emerald-400">
                            {formatPoints(
                              row.tournament_points
                            )}
                          </td>
                        </tr>
                      );
                    })}

                  {standingsWithPlayers.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No standings available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        )}

        {/* QUALIFICATION / KNOCKOUT STATUS */}
        {activeView === "progress" && (
        <section className="mb-8 space-y-3">
          <div
            className={`rounded-2xl border p-5 ${
              rounds.some(
                (round) =>
                  round.round_type === "preliminary" &&
                  round.status === "completed"
              )
                ? "border-emerald-800 bg-emerald-950/20"
                : "border-slate-800 bg-slate-900"
            }`}
          >
            <div className="text-3xl">🏸</div>

            <h3 className="mt-3 font-black">
              Preliminary Rounds
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              {rounds.filter(
                (round) =>
                  round.round_type === "preliminary" &&
                  round.status === "completed"
              ).length}{" "}
              of {tournament.preliminary_rounds} completed
            </p>
          </div>

          <div
            className={`rounded-2xl border p-5 ${
              rounds.some(
                (round) =>
                  round.round_type === "semifinal" &&
                  round.status === "completed"
              )
                ? "border-emerald-800 bg-emerald-950/20"
                : "border-slate-800 bg-slate-900"
            }`}
          >
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Knockout stage
            </div>
            <h3 className="mt-2 font-black">Semifinals</h3>
            <p className="mt-1 text-sm text-slate-400">
              Two best-of-3 matches
            </p>
            {rounds.some(
              (round) => round.round_type === "semifinal"
            ) && (
              <div className="mt-2 text-xs font-bold text-emerald-400">
                Generated
              </div>
            )}
          </div>

          <div
            className={`rounded-2xl border p-5 ${
              rounds.some(
                (round) =>
                  round.round_type === "quarterfinal" &&
                  round.status === "completed"
              )
                ? "border-emerald-800 bg-emerald-950/20"
                : "border-slate-800 bg-slate-900"
            }`}
          >
            <div className="text-3xl">⚡</div>

            <h3 className="mt-3 font-black">
              {tournament.format === "split_pairs"
                ? "Fixed-Pair Round Robin"
                : "Quarterfinals"}
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              {tournament.format === "split_pairs"
                ? "Five pairs in each draw"
                : `Top ${individualQualificationCount(tournament.total_players)} players`}
            </p>

            {rounds.some(
              (round) =>
                round.round_type === "quarterfinal"
            ) && (
              <div className="mt-2 text-xs font-bold text-emerald-400">
                ✓ Generated
              </div>
            )}
          </div>

          <div
            className={`rounded-2xl border p-5 ${
              rounds.some(
                (round) =>
                  round.round_type === "final" &&
                  round.status === "completed"
              )
                ? "border-yellow-700 bg-yellow-950/20"
                : "border-slate-800 bg-slate-900"
            }`}
          >
            <div className="text-3xl">🏆</div>

            <h3 className="mt-3 font-black">
              {tournament.format === "split_pairs"
                ? "Two Finals"
                : "Championship"}
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              {tournament.format === "split_pairs"
                ? "Two semifinals → two finals"
                : "Semifinals → Final"}
            </p>

            {isTournamentCompleted && (
              <div className="mt-2 text-xs font-bold text-yellow-400">
                ✓ Champion decided
              </div>
            )}
          </div>
        </section>
        )}

        {/* BOTTOM NAV */}
        {activeView === "progress" && (
        <footer className="border-t border-slate-800 py-8">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={goHome}
              className="rounded-lg border border-slate-700 px-5 py-2 text-sm font-bold transition hover:bg-slate-800"
            >
              🏠 Tournament Home
            </button>

            <button
              onClick={goLeaderboard}
              className="rounded-lg border border-emerald-700 px-5 py-2 text-sm font-bold text-emerald-400 transition hover:bg-emerald-950"
            >
              📊 Full Leaderboard
            </button>

            <button
              onClick={goTournamentHistory}
              className="rounded-lg border border-slate-700 px-5 py-2 text-sm font-bold transition hover:bg-slate-800"
            >
              📋 Tournament History
            </button>

            <button
              onClick={refresh}
              className="rounded-lg border border-slate-700 px-5 py-2 text-sm font-bold transition hover:bg-slate-800"
            >
              🔄 Refresh
            </button>
          </div>

          <div className="mt-4 text-center text-xs text-slate-600">
            Shuttle and Chill Control Center
          </div>
        </footer>
        )}

        <nav
          aria-label="Control center sections"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-700 bg-slate-950/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden"
        >
          {hubItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectHubView(item.id)}
              className={`min-h-12 rounded-lg px-1 py-2 text-xs font-bold ${
                activeView === item.id
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}