// ============================================================
// ChessMind Coach — UCI Protocol Parser
// ============================================================
//
// The Universal Chess Interface (UCI) is a text-based protocol
// for communicating with chess engines. Stockfish sends us
// lines of text, and this parser converts them into our typed
// TypeScript objects.
//
// UCI Output Examples:
//
//   "uciok"
//     → Engine has initialized and is ready for configuration
//
//   "readyok"
//     → Engine has finished processing and is ready for commands
//
//   "info depth 22 seldepth 34 multipv 1 score cp 35 wdl 450 300 250
//    nodes 4523891 nps 3012594 time 1502 pv e2e4 e7e5 g1f3 b8c6"
//     → Intermediate analysis data (sent many times during search)
//
//   "bestmove e2e4 ponder e7e5"
//     → The engine's final recommendation
//
// This parser handles ALL of these formats and extracts every
// piece of data into structured, type-safe objects.
// ============================================================

import { EngineInfoLine, EngineResponse } from "@/lib/types";


// ============================================================
// MAIN PARSER — Entry Point
// ============================================================
// Takes a raw string line from Stockfish and returns a typed
// EngineResponse object. This is the function that all other
// code calls.
//
// Usage:
//   const response = parseUCIResponse("bestmove e2e4 ponder e7e5");
//   if (response.type === "bestmove") {
//     console.log(response.bestMove);  // "e2e4"
//   }
// ============================================================

export function parseUCIResponse(line: string): EngineResponse | null {
  // Trim whitespace and ignore empty lines
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  // Route to the appropriate sub-parser based on the first word
  if (trimmed === "uciok") {
    return { type: "uciok" };
  }

  if (trimmed === "readyok") {
    return { type: "readyok" };
  }

  if (trimmed.startsWith("bestmove")) {
    return parseBestMove(trimmed);
  }

  if (trimmed.startsWith("info")) {
    return parseInfoLine(trimmed);
  }

  // Unknown or irrelevant lines (like "id name Stockfish 17")
  // are silently ignored — they don't affect our analysis.
  return null;
}


// ============================================================
// BESTMOVE PARSER
// ============================================================
// Parses: "bestmove e2e4 ponder e7e5"
// Or:     "bestmove e2e4"               (no ponder move)
// Or:     "bestmove (none)"             (no legal moves — game over)
//
// The bestmove is in UCI notation: source square + target square,
// optionally with a promotion piece.
// Examples:
//   "e2e4"   → pawn from e2 to e4
//   "g1f3"   → knight from g1 to f3
//   "e7e8q"  → pawn promotes to queen
//   "e1g1"   → kingside castling (king moves two squares)
// ============================================================

function parseBestMove(line: string): EngineResponse {
  const tokens = line.split(/\s+/);

  // tokens[0] = "bestmove"
  // tokens[1] = the move (e.g., "e2e4") or "(none)"
  // tokens[2] = "ponder" (optional)
  // tokens[3] = the ponder move (optional)

  const bestMove = tokens[1] || "(none)";

  // Handle the edge case where the engine says there are no moves
  if (bestMove === "(none)") {
    return {
      type: "bestmove",
      bestMove: "(none)",
      ponderMove: undefined,
    };
  }

  // Extract ponder move if present
  let ponderMove: string | null = null;
  if (tokens.length >= 4 && tokens[2] === "ponder") {
    ponderMove = tokens[3];
  }

  return {
    type: "bestmove",
    bestMove,
    ponderMove: ponderMove ?? undefined,
  };
}


// ============================================================
// INFO LINE PARSER
// ============================================================
// This is the most complex parser. Stockfish sends dozens of
// "info" lines during each search, progressively reporting
// deeper and deeper analysis. Each line contains multiple
// key-value fields that we need to extract.
//
// Full example:
// "info depth 22 seldepth 34 multipv 1 score cp 35 wdl 450 300 250
//  nodes 4523891 nps 3012594 hashfull 456 tbhits 0 time 1502
//  pv e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6"
//
// Fields we care about:
//   depth      — How many half-moves (plies) deep the engine searched
//   seldepth   — The deepest selective extension explored
//   multipv    — Which line this is (1=best, 2=second-best, etc.)
//   score cp   — Centipawn evaluation (100 cp ≈ 1 pawn advantage)
//   score mate — Mate-in-N (positive = engine can mate, negative = getting mated)
//   wdl        — Win/Draw/Loss probabilities (three integers summing to 1000)
//   nodes      — Number of positions examined
//   nps        — Nodes per second (speed indicator)
//   time       — Time spent in milliseconds
//   pv         — Principal Variation (the predicted best play sequence)
//
// Fields we ignore:
//   hashfull   — How full the hash table is (not useful for coaching)
//   tbhits     — Tablebase hits (not relevant in browser)
//   currmove   — Currently searching this move (too granular)
//   string     — Debug messages from the engine
// ============================================================

function parseInfoLine(line: string): EngineResponse | null {
  const tokens = line.split(/\s+/);

  // Skip "info string ..." lines — these are debug messages
  if (tokens[1] === "string") {
    return null;
  }

  // Skip lines that only have "currmove" (current move being searched)
  // These are sent very rapidly and just clutter our data
  if (line.includes("currmove") && !line.includes("score")) {
    return null;
  }

  const info: EngineInfoLine = {};
  let i = 1; // Start after "info"

  while (i < tokens.length) {
    const token = tokens[i];

    switch (token) {
      // ──────────────────────────────────
      // DEPTH — Search depth in half-moves
      // ──────────────────────────────────
      case "depth": {
        const value = parseInt(tokens[i + 1]);
        if (!isNaN(value)) {
          info.depth = value;
        }
        i += 2;
        break;
      }

      // ──────────────────────────────────
      // SELDEPTH — Selective search depth
      // (deepest line explored including
      // extensions for checks, captures, etc.)
      // ──────────────────────────────────
      case "seldepth": {
        const value = parseInt(tokens[i + 1]);
        if (!isNaN(value)) {
          info.selectiveDepth = value;
        }
        i += 2;
        break;
      }

      // ──────────────────────────────────
      // MULTIPV — Which principal variation
      // line this is. When we request the
      // top 3 moves, we get multipv 1, 2, 3.
      // ──────────────────────────────────
      case "multipv": {
        const value = parseInt(tokens[i + 1]);
        if (!isNaN(value)) {
          info.multiPV = value;
        }
        i += 2;
        break;
      }

      // ──────────────────────────────────
      // SCORE — The evaluation of the position
      //
      // Two formats:
      //   "score cp 35"    → 35 centipawns advantage
      //   "score mate 5"   → Forced mate in 5 moves
      //
      // CRITICAL SIGN CONVENTION:
      // Stockfish reports scores from the perspective
      // of the SIDE TO MOVE. So if it's Black's turn
      // and score is +100, that means Black is ahead
      // by 100 centipawns. We'll normalize this to
      // White's perspective later in the analysis pipeline.
      //
      // After cp/mate value, there may be "upperbound"
      // or "lowerbound" — these indicate the score is
      // not exact (the engine is still searching).
      // ──────────────────────────────────
      case "score": {
        info.score = {};
        i++; // move past "score"

        if (tokens[i] === "cp") {
          const value = parseInt(tokens[i + 1]);
          if (!isNaN(value)) {
            info.score.centipawns = value;
          }
          i += 2;
        } else if (tokens[i] === "mate") {
          const value = parseInt(tokens[i + 1]);
          if (!isNaN(value)) {
            info.score.mate = value;
          }
          i += 2;
        } else {
          i++;
        }

        // Check for upperbound/lowerbound modifiers
        if (i < tokens.length && tokens[i] === "upperbound") {
          info.score.upperBound = true;
          i++;
        } else if (i < tokens.length && tokens[i] === "lowerbound") {
          info.score.lowerBound = true;
          i++;
        }
        break;
      }

      // ──────────────────────────────────
      // WDL — Win/Draw/Loss probabilities
      //
      // Format: "wdl 450 300 250"
      // Three integers that sum to 1000:
      //   450 → 45.0% win probability
      //   300 → 30.0% draw probability
      //   250 → 25.0% loss probability
      //
      // These are from the perspective of the
      // side to move, just like the cp score.
      //
      // Available in Stockfish 15+.
      // ──────────────────────────────────
      case "wdl": {
        const win = parseInt(tokens[i + 1]);
        const draw = parseInt(tokens[i + 2]);
        const loss = parseInt(tokens[i + 3]);
        if (!isNaN(win) && !isNaN(draw) && !isNaN(loss)) {
          info.wdl = { win, draw, loss };
        }
        i += 4;
        break;
      }

      // ──────────────────────────────────
      // NODES — Total positions examined
      // ──────────────────────────────────
      case "nodes": {
        const value = parseInt(tokens[i + 1]);
        if (!isNaN(value)) {
          info.nodes = value;
        }
        i += 2;
        break;
      }

      // ──────────────────────────────────
      // NPS — Nodes per second (engine speed)
      // ──────────────────────────────────
      case "nps": {
        const value = parseInt(tokens[i + 1]);
        if (!isNaN(value)) {
          info.nodesPerSecond = value;
        }
        i += 2;
        break;
      }

      // ──────────────────────────────────
      // TIME — Milliseconds spent searching
      // ──────────────────────────────────
      case "time": {
        const value = parseInt(tokens[i + 1]);
        if (!isNaN(value)) {
          info.timeMs = value;
        }
        i += 2;
        break;
      }

      // ──────────────────────────────────
      // PV — Principal Variation
      //
      // The predicted best play sequence from
      // this position. ALWAYS the last field
      // in the info line — everything after
      // "pv" is a move in UCI notation.
      //
      // Example: "pv e2e4 e7e5 g1f3 b8c6"
      // means the engine predicts:
      //   1. e4 e5 2. Nf3 Nc6
      // ──────────────────────────────────
      case "pv": {
        // Everything after "pv" is the move sequence
        info.pv = tokens.slice(i + 1);
        // PV is always last, so we're done parsing
        i = tokens.length;
        break;
      }

      // ──────────────────────────────────
      // IGNORED FIELDS
      // We skip these — they're not useful
      // for coaching analysis.
      // ──────────────────────────────────
      case "hashfull":
      case "tbhits":
      case "currmovenumber": {
        i += 2; // Skip the field and its value
        break;
      }

      case "currmove": {
        i += 2;
        break;
      }

      // Unknown field — skip it
      default: {
        i++;
        break;
      }
    }
  }

  // Only return info lines that have meaningful data
  // (at minimum a depth and either a score or a PV)
  if (info.depth !== undefined || info.score !== undefined || info.pv !== undefined) {
    return {
      type: "info",
      info,
    };
  }

  return null;
}


// ============================================================
// UTILITY FUNCTIONS
// ============================================================
// Helper functions for working with parsed engine data.
// ============================================================

/**
 * Convert a centipawn score to a human-readable evaluation string.
 *
 * Examples:
 *   35     → "+0.35"
 *   -150   → "-1.50"
 *   0      → "0.00"
 *   null   → (uses mate score instead)
 *
 * When a mate score is present, it takes priority:
 *   mate 5  → "M5"  (can force mate in 5)
 *   mate -3 → "M-3" (getting mated in 3)
 */
export function formatEvaluation(
  centipawns: number | null,
  mate: number | null
): string {
  // Mate scores always take priority
  if (mate !== null && mate !== undefined) {
    if (mate > 0) {
      return `M${mate}`;
    } else {
      return `M${mate}`; // Already negative, so "M-3"
    }
  }

  // Centipawn score — convert to pawns (divide by 100)
  if (centipawns !== null && centipawns !== undefined) {
    const pawns = centipawns / 100;
    if (pawns > 0) {
      return `+${pawns.toFixed(2)}`;
    } else if (pawns < 0) {
      return pawns.toFixed(2);
    } else {
      return "0.00";
    }
  }

  return "?";
}


/**
 * Convert a centipawn score to a human-readable description.
 *
 * Used in the coaching analysis to translate engine numbers
 * into words that make sense to humans.
 *
 * @param centipawns - Evaluation in centipawns from White's perspective
 * @returns A descriptive string like "slight advantage for White"
 */
export function describeEvaluation(centipawns: number): string {
  const absCp = Math.abs(centipawns);
  const side = centipawns > 0 ? "White" : "Black";

  if (absCp <= 15) {
    return "The position is completely equal";
  } else if (absCp <= 50) {
    return `${side} has a tiny edge, but the position is roughly equal`;
  } else if (absCp <= 100) {
    return `${side} has a slight advantage`;
  } else if (absCp <= 200) {
    return `${side} has a clear advantage`;
  } else if (absCp <= 500) {
    return `${side} has a winning advantage`;
  } else {
    return `${side} is completely winning`;
  }
}


/**
 * Convert WDL integers (0-1000 each, from engine) to percentages (0-100).
 *
 * The engine reports WDL from the side to move's perspective.
 * This function can optionally flip them to always be from White's perspective.
 *
 * @param wdl - Raw WDL from engine { win, draw, loss } (each 0-1000)
 * @param isWhiteToMove - Whether White is the side to move
 * @param fromWhitePerspective - If true, return values from White's view
 * @returns Percentages { win, draw, loss } (each 0-100)
 */
export function normalizeWDL(
  wdl: { win: number; draw: number; loss: number },
  isWhiteToMove: boolean,
  fromWhitePerspective: boolean = true
): { win: number; draw: number; loss: number } {
  // Convert from 0-1000 to 0-100 percentages
  let win = wdl.win / 10;
  let draw = wdl.draw / 10;
  let loss = wdl.loss / 10;

  // If we want White's perspective but Black is to move,
  // flip win and loss (Black's win = White's loss)
  if (fromWhitePerspective && !isWhiteToMove) {
    const temp = win;
    win = loss;
    loss = temp;
  }

  return {
    win: Math.round(win * 10) / 10,    // Round to 1 decimal
    draw: Math.round(draw * 10) / 10,
    loss: Math.round(loss * 10) / 10,
  };
}


/**
 * Normalize a centipawn score to White's perspective.
 *
 * Stockfish reports scores from the side to move's perspective.
 * For consistent display (positive = good for White), we need
 * to negate the score when Black is the side to move.
 *
 * @param centipawns - Score from the side to move's perspective
 * @param isWhiteToMove - Whether White is the side to move
 * @returns Score from White's perspective
 */
export function normalizeScoreToWhite(
  centipawns: number,
  isWhiteToMove: boolean
): number {
  return isWhiteToMove ? centipawns : -centipawns;
}


/**
 * Normalize a mate score to White's perspective.
 *
 * Positive mate score from White's perspective means White can
 * force checkmate. Negative means Black can force checkmate.
 *
 * @param mate - Mate-in-N from the side to move's perspective
 * @param isWhiteToMove - Whether White is the side to move
 * @returns Mate score from White's perspective
 */
export function normalizeMateToWhite(
  mate: number,
  isWhiteToMove: boolean
): number {
  return isWhiteToMove ? mate : -mate;
}


/**
 * Convert a centipawn evaluation to a win probability percentage.
 *
 * When WDL data is not available from the engine, we can
 * approximate win probability from centipawns using a logistic
 * function. This formula is a commonly used approximation that
 * reasonably matches Stockfish's internal WDL model.
 *
 * The formula: winProb = 50 + 50 * (2 / (1 + 10^(-cp/400)) - 1)
 *
 * @param centipawns - Evaluation in centipawns from White's perspective
 * @returns Win probability for White (0-100)
 */
export function centipawnsToWinProbability(centipawns: number): number {
  // Clamp extreme values to prevent floating point issues
  const clamped = Math.max(-2000, Math.min(2000, centipawns));

  // Logistic function that maps centipawns to win probability
  const probability = 50 + 50 * (2 / (1 + Math.pow(10, -clamped / 400)) - 1);

  // Clamp result to [0.5, 99.5] — there's always some chance of each outcome
  return Math.max(0.5, Math.min(99.5, Math.round(probability * 10) / 10));
}


/**
 * Compare two evaluations and determine the centipawn loss.
 *
 * This is the key calculation for move classification. It tells
 * us how much worse the played move was compared to the best move.
 *
 * IMPORTANT SIGN CONVENTION:
 * Both evaluations must be from the same perspective (the side
 * that just moved). The loss is always >= 0.
 *
 * Examples:
 *   Best move eval: +150 cp, Played move eval: +80 cp → Loss = 70 cp
 *   Best move eval: +50 cp, Played move eval: +50 cp → Loss = 0 cp
 *   Best move eval: +200 cp, Played move eval: -100 cp → Loss = 300 cp
 *
 * Special cases with mate scores:
 *   Best move: mate in 5, Played move: +100 cp → Very large loss
 *   Best move: +100 cp, Played move: getting mated in 3 → Enormous loss
 *
 * @param bestEvalCp - Centipawn eval of the best move (from mover's perspective)
 * @param bestMate - Mate score of the best move (null if no mate)
 * @param playedEvalCp - Centipawn eval after the played move (from mover's perspective)
 * @param playedMate - Mate score after the played move (null if no mate)
 * @returns The centipawn loss (always >= 0)
 */
export function calculateCentipawnLoss(
  bestEvalCp: number | null,
  bestMate: number | null,
  playedEvalCp: number | null,
  playedMate: number | null
): number {
  // Convert both evaluations to a comparable "effective centipawn" value.
  // Mate scores get converted to very large centipawn values.
  const bestEffective = toEffectiveCentipawns(bestEvalCp, bestMate);
  const playedEffective = toEffectiveCentipawns(playedEvalCp, playedMate);

  // Loss is how much worse the played move is compared to the best
  const loss = bestEffective - playedEffective;

  // Loss should never be negative (the played move can't be better
  // than the best move — if it is, it means the analysis at different
  // depths found slightly different results, and we just call it 0)
  return Math.max(0, loss);
}


/**
 * Convert a (centipawns, mate) pair to a single comparable number.
 *
 * Mate scores are converted to very large centipawn values so
 * they can be compared with regular evaluations:
 *   - Mate in 1 → 10000 (winning immediately)
 *   - Mate in 5 → 9500  (winning soon)
 *   - Getting mated in 1 → -10000
 *   - Getting mated in 5 → -9500
 *
 * The formula: ±(10000 - (abs(mate) - 1) * 100)
 * This ensures mate in 1 > mate in 2 > ... > mate in 10 > any regular eval
 *
 * @param centipawns - Centipawn score (null if position is a forced mate)
 * @param mate - Mate-in-N (null if no forced mate)
 * @returns A single number suitable for comparison
 */
function toEffectiveCentipawns(
  centipawns: number | null,
  mate: number | null
): number {
  // If there's a mate score, convert it to a very large centipawn value
  if (mate !== null && mate !== undefined) {
    if (mate > 0) {
      // Can force mate — very good. Shorter mate = bigger number.
      return 10000 - (mate - 1) * 100;
    } else {
      // Getting mated — very bad. Shorter mate = more negative number.
      return -10000 + (Math.abs(mate) - 1) * 100;
    }
  }

  // Regular centipawn score
  if (centipawns !== null && centipawns !== undefined) {
    // Clamp to [-9000, 9000] to keep it below mate territory
    return Math.max(-9000, Math.min(9000, centipawns));
  }

  // No evaluation available — treat as equal position
  return 0;
}


/**
 * Check if a UCI move string represents a promotion.
 *
 * Promotion moves in UCI notation have 5 characters instead
 * of 4, with the 5th character being the promotion piece.
 *
 * Examples:
 *   "e7e8q" → pawn promotes to queen
 *   "a2a1n" → pawn promotes to knight (underpromotion)
 *   "e2e4"  → normal move (not promotion)
 *
 * @param uciMove - Move in UCI notation
 * @returns true if the move is a promotion
 */
export function isPromotion(uciMove: string): boolean {
  return uciMove.length === 5 && "qrbnQRBN".includes(uciMove[4]);
}


/**
 * Extract the source and destination squares from a UCI move.
 *
 * @param uciMove - Move in UCI notation (e.g., "e2e4")
 * @returns { from, to, promotion? }
 */
export function parseUCIMove(uciMove: string): {
  from: string;
  to: string;
  promotion?: string;
} {
  return {
    from: uciMove.substring(0, 2),
    to: uciMove.substring(2, 4),
    promotion: uciMove.length === 5 ? uciMove[4] : undefined,
  };
}