export type DrawPhase = "preliminary" | "knockout";

export type PlayerDrawNumber = {
  player_id: string;
  phase: DrawPhase;
  draw_number: number;
};

export function drawPhaseForRound(roundType?: string | null): DrawPhase {
  return roundType === "preliminary" ? "preliminary" : "knockout";
}

export function drawNumberMap(
  rows: PlayerDrawNumber[],
  phase: DrawPhase
) {
  return new Map(
    rows
      .filter((row) => row.phase === phase)
      .map((row) => [row.player_id, Number(row.draw_number)])
  );
}

export function hasCompleteDraw(
  rows: PlayerDrawNumber[],
  phase: DrawPhase,
  expectedCount: number
) {
  const phaseRows = rows.filter((row) => row.phase === phase);

  return (
    phaseRows.length === expectedCount &&
    new Set(phaseRows.map((row) => row.player_id)).size === expectedCount &&
    new Set(phaseRows.map((row) => Number(row.draw_number))).size ===
      expectedCount
  );
}
