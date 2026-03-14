//uci protocaol

import { EngineInfoLine, EngineResponse } from "@/lib/types";

export function parseUCIResponse(line: string): EngineResponse | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

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
  return null;
}


function parseBestMove(line: string): EngineResponse {
  const tokens = line.split(/\s+/);


  const bestMove = tokens[1] || "(none)";

  if (bestMove === "(none)") {
    return {
      type: "bestmove",
      bestMove: "(none)",
      ponderMove: undefined,
    };
  }

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

function parseInfoLine(line: string): EngineResponse | null {
  const tokens = line.split(/\s+/);

  if (tokens[1] === "string") {
    return null;
  }

  if (line.includes("currmove") && !line.includes("score")) {
    return null;
  }

  const info: EngineInfoLine = {};
  let i = 1; 

  while (i < tokens.length) {
    const token = tokens[i];

    switch (token) {
      
      case "depth": {
        const value = parseInt(tokens[i + 1]);
        if (!isNaN(value)) {
          info.depth = value;
        }
        i += 2;
        break;
      }

    
      case "seldepth": {
        const value = parseInt(tokens[i + 1]);
        if (!isNaN(value)) {
          info.selectiveDepth = value;
        }
        i += 2;
        break;
      }

      case "multipv": {
        const value = parseInt(tokens[i + 1]);
        if (!isNaN(value)) {
          info.multiPV = value;
        }
        i += 2;
        break;
      }

      
      case "score": {
        info.score = {};
        i++; 

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

  
        if (i < tokens.length && tokens[i] === "upperbound") {
          info.score.upperBound = true;
          i++;
        } else if (i < tokens.length && tokens[i] === "lowerbound") {
          info.score.lowerBound = true;
          i++;
        }
        break;
      }


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

  
      case "nodes": {
        const value = parseInt(tokens[i + 1]);
        if (!isNaN(value)) {
          info.nodes = value;
        }
        i += 2;
        break;
      }


      case "nps": {
        const value = parseInt(tokens[i + 1]);
        if (!isNaN(value)) {
          info.nodesPerSecond = value;
        }
        i += 2;
        break;
      }

 
      case "time": {
        const value = parseInt(tokens[i + 1]);
        if (!isNaN(value)) {
          info.timeMs = value;
        }
        i += 2;
        break;
      }


      case "pv": {
        info.pv = tokens.slice(i + 1);
        i = tokens.length;
        break;
      }

  
      case "hashfull":
      case "tbhits":
      case "currmovenumber": {
        i += 2;
        break;
      }

      case "currmove": {
        i += 2;
        break;
      }

      default: {
        i++;
        break;
      }
    }
  }

  if (info.depth !== undefined || info.score !== undefined || info.pv !== undefined) {
    return {
      type: "info",
      info,
    };
  }

  return null;
}

export function formatEvaluation(
  centipawns: number | null,
  mate: number | null
): string {
  if (mate !== null && mate !== undefined) {
    if (mate > 0) {
      return `M${mate}`;
    } else {
      return `M${mate}`; 
    }
  }

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
  let win = wdl.win / 10;
  let draw = wdl.draw / 10;
  let loss = wdl.loss / 10;

  if (fromWhitePerspective && !isWhiteToMove) {
    const temp = win;
    win = loss;
    loss = temp;
  }

  return {
    win: Math.round(win * 10) / 10,
    draw: Math.round(draw * 10) / 10,
    loss: Math.round(loss * 10) / 10,
  };
}


/**
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
 * @param centipawns - Evaluation in centipawns from White's perspective
 * @returns Win probability for White (0-100)
 */
export function centipawnsToWinProbability(centipawns: number): number {
  const clamped = Math.max(-2000, Math.min(2000, centipawns));

  const probability = 50 + 50 * (2 / (1 + Math.pow(10, -clamped / 400)) - 1);

  return Math.max(0.5, Math.min(99.5, Math.round(probability * 10) / 10));
}


/**
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
  const bestEffective = toEffectiveCentipawns(bestEvalCp, bestMate);
  const playedEffective = toEffectiveCentipawns(playedEvalCp, playedMate);

  const loss = bestEffective - playedEffective;

  return Math.max(0, loss);
}


/**
 * @param centipawns - Centipawn score (null if position is a forced mate)
 * @param mate - Mate-in-N (null if no forced mate)
 * @returns A single number suitable for comparison
 */
function toEffectiveCentipawns(
  centipawns: number | null,
  mate: number | null
): number {
  if (mate !== null && mate !== undefined) {
    if (mate > 0) {
      return 10000 - (mate - 1) * 100;
    } else {
      return -10000 + (Math.abs(mate) - 1) * 100;
    }
  }

  if (centipawns !== null && centipawns !== undefined) {
    return Math.max(-9000, Math.min(9000, centipawns));
  }

  return 0;
}


/**
 * @param uciMove - Move in UCI notation
 * @returns true if the move is a promotion
 */
export function isPromotion(uciMove: string): boolean {
  return uciMove.length === 5 && "qrbnQRBN".includes(uciMove[4]);
}


/**

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