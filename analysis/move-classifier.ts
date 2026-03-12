// ============================================================
// ChessMind Coach — Move Classifier (FIXED)
// ============================================================
//
// KEY FIX: Centipawn loss is calculated by comparing the
// played move's score against the best move's score from
// the SAME MultiPV search (same depth, same position).
//
// This avoids the bug where depth differences between
// pre-move and post-move analysis give incorrect cp loss.
//
// How Chess.com/Lichess do it:
//   1. Analyze position with MultiPV 3-5
//   2. Find the played move in the PV lines
//   3. CP loss = best line score - played move's line score
//   4. If played move isn't in the lines, use post-move eval
//
// ============================================================

import {
  MoveClassification,
  PVLine,
  GamePhase,
} from "@/lib/types";

import {
  calculateCentipawnLoss,
  normalizeScoreToWhite,
  normalizeMateToWhite,
} from "@/engine/uci-parser";


// ============================================================
// THRESHOLDS
// ============================================================

const THRESHOLDS = {
  EXCELLENT_MAX: 10,
  GOOD_MAX: 30,
  INACCURACY_MAX: 100,
  MISTAKE_MAX: 250,
  BLUNDER_MIN: 250,
  BRILLIANT_EVAL_GAP: 150,
  MISS_THRESHOLD: 100,
  GREAT_GAP: 50,
} as const;


// ============================================================
// TYPES
// ============================================================

export interface ClassificationInput {
  playedMoveUci: string;
  colorToMove: "white" | "black";
  preMoveLines: PVLine[];
  legalMoveCount: number;
  postMoveEvalCp: number | null;
  postMoveMate: number | null;
  isBookMove: boolean;
  gamePhase: GamePhase;
  isCapture: boolean;
  isCheck: boolean;
  isSacrifice: boolean;
  materialDelta: number;
}

export interface ClassificationResult {
  classification: MoveClassification;
  centipawnLoss: number;
  bestMoveUci: string;
  bestMoveEvalWhite: number;
  playedMoveEvalWhite: number;
  isMissedOpportunity: boolean;
  missedMateIn: number | null;
  reason: string;
}


// ============================================================
// MAIN CLASSIFIER — FIXED VERSION
// ============================================================

export function classifyMove(input: ClassificationInput): ClassificationResult {
  const {
    playedMoveUci,
    colorToMove,
    preMoveLines,
    legalMoveCount,
    postMoveEvalCp,
    postMoveMate,
    isBookMove,
    gamePhase,
    isCapture,
    isCheck,
    isSacrifice,
    materialDelta,
  } = input;

  const bestLine = preMoveLines[0];
  const secondBestLine = preMoveLines.length > 1 ? preMoveLines[1] : null;

  if (!bestLine) {
    return {
      classification: MoveClassification.GOOD,
      centipawnLoss: 0,
      bestMoveUci: playedMoveUci,
      bestMoveEvalWhite: 0,
      playedMoveEvalWhite: 0,
      isMissedOpportunity: false,
      missedMateIn: null,
      reason: "No engine analysis available",
    };
  }

  const bestMoveUci = bestLine.moves[0] || playedMoveUci;
  const isWhite = colorToMove === "white";

  // ═══════════════════════════════════════════════════
  // KEY FIX: Check if the played move matches any PV line
  // and calculate cp loss from the SAME search
  // ═══════════════════════════════════════════════════

  const isEngineBestMove = playedMoveUci === bestMoveUci;

  // Try to find the played move in the MultiPV lines
  const playedMoveLineIndex = preMoveLines.findIndex(
    (line) => line.moves[0] === playedMoveUci
  );

  let centipawnLoss: number;
  let playedMoveScore: number;
  const bestMoveScore = getEffectiveScore(bestLine);

  if (isEngineBestMove) {
    // Player played the BEST move — centipawn loss is ALWAYS 0
    centipawnLoss = 0;
    playedMoveScore = bestMoveScore;
    console.log("[Classifier] Played move matches engine best — cp loss = 0");
  } else if (playedMoveLineIndex >= 0) {
    // Player's move is in the MultiPV lines — compare within same search
    const playedLine = preMoveLines[playedMoveLineIndex];
    playedMoveScore = getEffectiveScore(playedLine);
    centipawnLoss = Math.max(0, bestMoveScore - playedMoveScore);
    console.log(`[Classifier] Played move found in PV${playedMoveLineIndex + 1} — cp loss = ${centipawnLoss}`);
  } else {
    // Player's move is NOT in any PV line — use post-move evaluation
    // This means the move was worse than all top 3-5 candidates
    const playedEvalFromMover = getPlayedEvalFromMoverPerspective(
      postMoveEvalCp, postMoveMate, isWhite
    );
    const bestEvalFromMover = {
      cp: bestLine.score.centipawns ?? null,
      mate: bestLine.score.mate ?? null,
    };

    centipawnLoss = calculateCentipawnLoss(
      bestEvalFromMover.cp,
      bestEvalFromMover.mate,
      playedEvalFromMover.cp,
      playedEvalFromMover.mate
    );
    playedMoveScore = bestMoveScore - centipawnLoss;
    console.log(`[Classifier] Played move NOT in PV lines — using post-move eval — cp loss = ${centipawnLoss}`);
  }

  // Normalize evaluations to White's perspective for display
  const bestMoveEvalWhite = getEvalFromWhitePerspective(bestLine, isWhite);
  const playedMoveEvalWhite = isEngineBestMove
    ? bestMoveEvalWhite
    : bestMoveEvalWhite - (isWhite ? centipawnLoss : -centipawnLoss);

  // Check for missed mate
  const missedMateIn = checkMissedMate(bestLine, postMoveMate, isEngineBestMove);

  // Check for missed opportunity
  const isMissedOpportunity = checkMissedOpportunity(
    bestLine, secondBestLine, centipawnLoss, isEngineBestMove
  );

  // Build base result
  const baseResult = {
    centipawnLoss,
    bestMoveUci,
    bestMoveEvalWhite,
    playedMoveEvalWhite,
    isMissedOpportunity,
    missedMateIn,
  };


  // ═══════════════════════════════════════
  // CLASSIFICATION CHAIN
  // ═══════════════════════════════════════

  // 1. FORCED
  if (legalMoveCount === 1) {
    return {
      ...baseResult,
      classification: MoveClassification.FORCED,
      reason: "Only one legal move was available",
    };
  }

  // 2. BOOK
  if (isBookMove) {
    return {
      ...baseResult,
      classification: MoveClassification.BOOK,
      reason: "This move is part of established opening theory",
    };
  }

  // 3. If player played the best move, check for Brilliant/Great/Best
  if (isEngineBestMove || centipawnLoss === 0) {
    // Check BRILLIANT
    const brilliantCheck = checkBrilliant(
      bestLine, secondBestLine, preMoveLines,
      isSacrifice, materialDelta, isCheck, gamePhase
    );
    if (brilliantCheck.isBrilliant) {
      return {
        ...baseResult,
        classification: MoveClassification.BRILLIANT,
        reason: brilliantCheck.reason,
      };
    }

    // Check GREAT
    const greatCheck = checkGreat(
      bestLine, secondBestLine, isCapture, isCheck, gamePhase
    );
    if (greatCheck.isGreat) {
      return {
        ...baseResult,
        classification: MoveClassification.GREAT,
        reason: greatCheck.reason,
      };
    }

    // It's BEST
    return {
      ...baseResult,
      classification: MoveClassification.BEST,
      reason: "This is the engine's top recommended move",
    };
  }

  // 4. BLUNDER
  if (centipawnLoss > THRESHOLDS.BLUNDER_MIN) {
    const allowsMate = postMoveMate !== null && postMoveMate < 0;
    return {
      ...baseResult,
      classification: MoveClassification.BLUNDER,
      reason: allowsMate
        ? `Allows forced checkmate in ${Math.abs(postMoveMate!)} moves. CP loss: ${centipawnLoss}`
        : `Loses ${centipawnLoss} centipawns (${(centipawnLoss / 100).toFixed(1)} pawns). Best was ${bestMoveUci}`,
    };
  }

  // Also blunder if allows new mate
  if (
    postMoveMate !== null && postMoveMate < 0 &&
    (bestLine.score.mate == null || bestLine.score.mate > 0)
  ) {
    return {
      ...baseResult,
      classification: MoveClassification.BLUNDER,
      reason: `Allows forced checkmate in ${Math.abs(postMoveMate)} moves`,
    };
  }

  // 5. MISS
  if (isMissedOpportunity && centipawnLoss >= THRESHOLDS.MISS_THRESHOLD) {
    return {
      ...baseResult,
      classification: MoveClassification.MISS,
      reason: missedMateIn
        ? `Missed checkmate in ${missedMateIn} moves with ${bestMoveUci}`
        : `Missed a strong tactical opportunity with ${bestMoveUci} (${centipawnLoss}cp better)`,
    };
  }

  // 6. MISTAKE
  if (centipawnLoss > THRESHOLDS.INACCURACY_MAX) {
    return {
      ...baseResult,
      classification: MoveClassification.MISTAKE,
      reason: `Loses ${centipawnLoss} centipawns. Better was ${bestMoveUci}`,
    };
  }

  // 7. INACCURACY
  if (centipawnLoss > THRESHOLDS.GOOD_MAX) {
    return {
      ...baseResult,
      classification: MoveClassification.INACCURACY,
      reason: `Loses ${centipawnLoss} centipawns. More accurate was ${bestMoveUci}`,
    };
  }

  // 8. EXCELLENT
  if (centipawnLoss <= THRESHOLDS.EXCELLENT_MAX) {
    return {
      ...baseResult,
      classification: MoveClassification.EXCELLENT,
      reason: `Very close to best (only ${centipawnLoss}cp difference)`,
    };
  }

  // 9. GOOD
  return {
    ...baseResult,
    classification: MoveClassification.GOOD,
    reason: `Reasonable move (${centipawnLoss}cp from best). Slightly better was ${bestMoveUci}`,
  };
}


// ============================================================
// BRILLIANT DETECTION
// ============================================================

function checkBrilliant(
  bestLine: PVLine,
  secondBestLine: PVLine | null,
  allLines: PVLine[],
  isSacrifice: boolean,
  materialDelta: number,
  isCheck: boolean,
  gamePhase: GamePhase
): { isBrilliant: boolean; reason: string } {

  // Criterion A: Material sacrifice
  if (isSacrifice && materialDelta < -100 && bestLine.moves.length >= 4) {
    return {
      isBrilliant: true,
      reason: `Brilliant sacrifice! Giving up ${Math.abs(materialDelta / 100).toFixed(1)} pawns worth for a deep combination`,
    };
  }

  // Criterion B: Only good move — huge gap to second best
  if (secondBestLine) {
    const gap = getEffectiveScore(bestLine) - getEffectiveScore(secondBestLine);
    if (gap >= THRESHOLDS.BRILLIANT_EVAL_GAP && gamePhase !== GamePhase.OPENING && allLines.length >= 3) {
      return {
        isBrilliant: true,
        reason: `Brilliant find! The only good move — next best was ${gap}cp worse`,
      };
    }
  }

  // Criterion C: Deep forcing sequence
  if (bestLine.moves.length >= 6 && bestLine.depth >= 12) {
    const score = getEffectiveScore(bestLine);
    if ((score >= 300 || bestLine.score.mate != null) && !isSimpleRecapture(bestLine)) {
      return {
        isBrilliant: true,
        reason: `Brilliant ${bestLine.moves.length}-move combination`,
      };
    }
  }

  return { isBrilliant: false, reason: "" };
}


// ============================================================
// GREAT DETECTION
// ============================================================

function checkGreat(
  bestLine: PVLine,
  secondBestLine: PVLine | null,
  isCapture: boolean,
  isCheck: boolean,
  gamePhase: GamePhase
): { isGreat: boolean; reason: string } {
  if (!secondBestLine) return { isGreat: false, reason: "" };

  const gap = getEffectiveScore(bestLine) - getEffectiveScore(secondBestLine);

  if (gap < THRESHOLDS.GREAT_GAP) return { isGreat: false, reason: "" };
  if (isCapture && bestLine.moves.length <= 2) return { isGreat: false, reason: "" };
  if (isCheck && gamePhase === GamePhase.OPENING) return { isGreat: false, reason: "" };

  return {
    isGreat: true,
    reason: `Strong move, ${gap}cp better than the next alternative`,
  };
}


// ============================================================
// MISSED OPPORTUNITY DETECTION
// ============================================================

function checkMissedOpportunity(
  bestLine: PVLine,
  secondBestLine: PVLine | null,
  centipawnLoss: number,
  isEngineBestMove: boolean
): boolean {
  if (isEngineBestMove) return false;

  if (bestLine.score.mate != null && bestLine.score.mate > 0) return true;

  if (centipawnLoss >= THRESHOLDS.MISS_THRESHOLD) {
    const bestScore = getEffectiveScore(bestLine);
    if (bestScore >= 200) return true;
  }

  return false;
}

function checkMissedMate(
  bestLine: PVLine,
  postMoveMate: number | null,
  isEngineBestMove: boolean
): number | null {
  if (isEngineBestMove) return null;
  if (bestLine.score.mate != null && bestLine.score.mate > 0) {
    return bestLine.score.mate;
  }
  return null;
}


// ============================================================
// HELPERS
// ============================================================

function getEffectiveScore(line: PVLine): number {
  if (line.score.mate != null) {
    return line.score.mate > 0
      ? 10000 - (line.score.mate - 1) * 100
      : -10000 + (Math.abs(line.score.mate) - 1) * 100;
  }
  return line.score.centipawns ?? 0;
}

function getPlayedEvalFromMoverPerspective(
  postMoveEvalCp: number | null,
  postMoveMate: number | null,
  isWhiteToMove: boolean
): { cp: number | null; mate: number | null } {
  return {
    cp: postMoveEvalCp !== null ? -postMoveEvalCp : null,
    mate: postMoveMate !== null ? -postMoveMate : null,
  };
}

function getEvalFromWhitePerspective(line: PVLine, isWhiteToMove: boolean): number {
  if (line.score.mate != null) {
    const mateFromWhite = normalizeMateToWhite(line.score.mate, isWhiteToMove);
    return mateFromWhite > 0
      ? 10000 - (mateFromWhite - 1) * 100
      : -10000 + (Math.abs(mateFromWhite) - 1) * 100;
  }
  return normalizeScoreToWhite(line.score.centipawns ?? 0, isWhiteToMove);
}

function isSimpleRecapture(line: PVLine): boolean {
  if (line.moves.length < 3) return false;
  const target = line.moves[0].substring(2, 4);
  let count = 0;
  for (let i = 1; i < Math.min(line.moves.length, 4); i++) {
    if (line.moves[i].substring(2, 4) === target) count++;
  }
  return count >= 2;
}


// ============================================================
// GAME PHASE DETECTION
// ============================================================

export function detectGamePhase(fen: string, moveNumber: number): GamePhase {
  const piecePart = fen.split(" ")[0];
  let queens = 0, rooks = 0, bishops = 0, knights = 0;

  for (const char of piecePart) {
    switch (char.toLowerCase()) {
      case "q": queens++; break;
      case "r": rooks++; break;
      case "b": bishops++; break;
      case "n": knights++; break;
    }
  }

  const total = queens + rooks + bishops + knights;

  if (total <= 4) return GamePhase.ENDGAME;
  if (queens === 0 && total <= 6) return GamePhase.ENDGAME;
  if (moveNumber <= 12 && total >= 12) return GamePhase.OPENING;
  if (moveNumber <= 8) return GamePhase.OPENING;

  return GamePhase.MIDDLEGAME;
}