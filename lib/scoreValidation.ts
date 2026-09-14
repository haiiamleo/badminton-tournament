export function isKnockoutRound(roundType: string | null | undefined) {
  return (
    roundType === "quarterfinal" ||
    roundType === "semifinal" ||
    roundType === "third_place" ||
    roundType === "final"
  );
}

export function sanitizeScoreInput(value: string) {
  if (value === "") {
    return "";
  }

  if (!/^\d{0,2}$/.test(value)) {
    return null;
  }

  return value;
}

export function scoreRuleHint(roundType: string | null | undefined) {
  if (isKnockoutRound(roundType)) {
    return "QF / SF / 3rd / Final: first to 21, must win by 2. After 29-29, 30 is golden point.";
  }

  return "Prelims: first to 21. At 20-20, the next point wins (21-20).";
}

export function validateCompletedScore(
  team1Score: number,
  team2Score: number,
  roundType: string | null | undefined
) {
  if (
    !Number.isInteger(team1Score) ||
    !Number.isInteger(team2Score)
  ) {
    return "Scores must be whole numbers.";
  }

  if (team1Score < 0 || team2Score < 0) {
    return "Scores cannot be negative.";
  }

  if (team1Score === team2Score) {
    return "Badminton matches cannot end in a tie.";
  }

  const winner = Math.max(team1Score, team2Score);
  const loser = Math.min(team1Score, team2Score);

  if (isKnockoutRound(roundType)) {
    return validateKnockoutScore(winner, loser);
  }

  return validatePrelimScore(winner, loser);
}

function validatePrelimScore(winner: number, loser: number) {
  if (winner > 21 || loser > 21) {
    return "Preliminary games finish at 21. At 20-20, the next point is golden (21-20).";
  }

  if (winner < 21) {
    return "A preliminary game must be played to 21.";
  }

  return null;
}

function validateKnockoutScore(winner: number, loser: number) {
  if (winner > 30 || loser > 30) {
    return "Knockout games cap at 30. After 29-29, the next point wins (30-29).";
  }

  if (winner < 21) {
    return "A knockout game must reach at least 21 points.";
  }

  if (winner === 21) {
    if (loser > 19) {
      return "At 20-20 in knockout, play continues until a 2-point lead. 21-20 is not a finished game.";
    }

    return null;
  }

  if (winner === 30) {
    if (loser !== 28 && loser !== 29) {
      return "If the game reaches 30, the only valid scores are 30-28 or 30-29.";
    }

    return null;
  }

  if (loser !== winner - 2) {
    return `After 20-20, a knockout game must be won by 2 points (for example ${winner}-${winner - 2}).`;
  }

  return null;
}
