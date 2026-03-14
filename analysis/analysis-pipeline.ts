//this code was written by moomin gulzar dar and belongs to him

import {
  AnalysisResult,
  EngineEvaluation,
  MoveClassification,
  CoachingLevel,
  GamePhase,
  PVLine,
  TacticalMotif,
  EvalHistoryEntry,
} from "@/lib/types";

import { EngineManager } from "@/engine/engine-manager";

import {
  normalizeScoreToWhite,
  normalizeMateToWhite,
  normalizeWDL,
  centipawnsToWinProbability,
  formatEvaluation,
} from "@/engine/uci-parser";

import {
  classifyMove,
  detectGamePhase,
  ClassificationInput,
} from "@/analysis/move-classifier";

import {
  analyzeMoveProperties,
  uciToSan,
  countLegalMoves,
  getSideToMove,
  getMoveNumber,
  PIECE_VALUES,
  MoveInfo,
} from "@/lib/chess-utils";

import {
  generateAnalysis,
  TemplateInput,
} from "@/nlg/template-engine";

import type { SearchResult } from "@/engine/stockfish-service";


export interface PipelineInput {
  fenBefore: string;
  fenAfter: string;
  playedMoveUci: string;
  playedMoveSan: string;
  color: "white" | "black";
  moveNumber: number;
  playerColor: "white" | "black";
  isPlayerMove: boolean;
  coachingLevel: CoachingLevel;
  isBookMove: boolean;
  openingName: string | null;
  openingEco: string | null;
  onProgress?: (partial: PartialAnalysis) => void;
}

export interface PartialAnalysis {
  stage: "classification" | "evaluation" | "full";
  classification?: MoveClassification;
  centipawnLoss?: number;
  evalCp?: number;
  winProbability?: number;
  result?: AnalysisResult;
}

export async function runAnalysisPipeline(
  input: PipelineInput
): Promise<AnalysisResult> {
  const startTime = performance.now();
  const manager = EngineManager.getInstance();

  console.log(`[Pipeline] ===== Analyzing move: ${input.playedMoveSan} (${input.playedMoveUci}) =====`);

  const moveInfo = analyzeMoveProperties(input.fenBefore, input.playedMoveUci);
  const legalMoveCount = countLegalMoves(input.fenBefore);
  const gamePhase = detectGamePhase(input.fenBefore, input.moveNumber);

  console.log(`[Pipeline] Move: ${moveInfo.san}, Capture: ${moveInfo.isCapture}, Check: ${moveInfo.isCheck}, Legal moves: ${legalMoveCount}`);

  if (input.isBookMove) {
    console.log("[Pipeline] Book move — skipping analysis");
    return createBookMoveResult(input, moveInfo, gamePhase, startTime);
  }

  if (legalMoveCount === 1) {
    console.log("[Pipeline] Forced move — quick eval only");
    return createForcedMoveResult(input, moveInfo, gamePhase, manager, startTime);
  }

  let preMoveAnalysis: SearchResult;
  let postMoveAnalysis: SearchResult;

  try {
    console.log("[Pipeline] Analyzing pre-move position...");
    preMoveAnalysis = await manager.analyzePosition(input.fenBefore, {
      multiPV: 3,
      moveTime: 800,
    });
    console.log(`[Pipeline] Pre-move analysis done. Best move: ${preMoveAnalysis.bestMove}, Lines: ${preMoveAnalysis.lines.length}, Depth: ${preMoveAnalysis.depth}`);

    console.log("[Pipeline] Analyzing post-move position...");
    postMoveAnalysis = await manager.analyzePosition(input.fenAfter, {
      multiPV: 1,
      moveTime: 400,
    });
    console.log(`[Pipeline] Post-move analysis done. Depth: ${postMoveAnalysis.depth}`);

  } catch (error) {
    console.error("[Pipeline] Engine analysis failed:", error);
    return createFallbackResult(input, moveInfo, gamePhase, startTime);
  }

  const isWhiteToMove = input.color === "white";
  const preMoveLines = preMoveAnalysis.lines;
  const bestLine = preMoveLines[0];
  const postBestLine = postMoveAnalysis.lines[0];

  if (!bestLine) {
    console.warn("[Pipeline] No pre-move lines found, returning fallback");
    return createFallbackResult(input, moveInfo, gamePhase, startTime);
  }

  const postMoveEvalCp = postBestLine?.score?.centipawns ?? null;
  const postMoveMate = postBestLine?.score?.mate ?? null;

  const evalBeforeWhite = normalizeLineScoreToWhite(bestLine, isWhiteToMove);
  const evalAfterWhite = postBestLine
    ? normalizeLineScoreToWhite(postBestLine, !isWhiteToMove)
    : 0;

  if (input.onProgress) {
    input.onProgress({
      stage: "evaluation",
      evalCp: evalAfterWhite,
      winProbability: centipawnsToWinProbability(evalAfterWhite),
    });
  }

  const classificationInput: ClassificationInput = {
    playedMoveUci: input.playedMoveUci,
    colorToMove: input.color,
    preMoveLines: preMoveLines,
    legalMoveCount,
    postMoveEvalCp: postMoveEvalCp,
    postMoveMate: postMoveMate,
    isBookMove: false,
    gamePhase,
    isCapture: moveInfo.isCapture,
    isCheck: moveInfo.isCheck,
    isSacrifice: moveInfo.isSacrifice,
    materialDelta: moveInfo.materialDelta,
  };

  const classificationResult = classifyMove(classificationInput);

  if (input.onProgress) {
    input.onProgress({
      stage: "classification",
      classification: classificationResult.classification,
      centipawnLoss: classificationResult.centipawnLoss,
    });
  }

  const tacticalMotifs = detectTacticalMotifs(moveInfo, preMoveLines);

  const bestMoveSan = uciToSan(input.fenBefore, classificationResult.bestMoveUci);

  const templateInput: TemplateInput = {
    moveInfo,
    classification: classificationResult.classification,
    centipawnLoss: classificationResult.centipawnLoss,
    evalBeforeCp: evalBeforeWhite,
    evalAfterCp: evalAfterWhite,
    mateBefore: bestLine.score.mate != null
      ? normalizeMateToWhite(bestLine.score.mate, isWhiteToMove)
      : null,
    mateAfter: postMoveMate != null
      ? normalizeMateToWhite(postMoveMate, !isWhiteToMove)
      : null,
    bestMoveUci: classificationResult.bestMoveUci,
    bestMoveSan,
    bestMoveEvalCp: classificationResult.bestMoveEvalWhite,
    topMoves: preMoveLines,
    fenBefore: input.fenBefore,
    fenAfter: input.fenAfter,
    gamePhase,
    moveNumber: input.moveNumber,
    playerColor: input.playerColor,
    isPlayerMove: input.isPlayerMove,
    isBookMove: false,
    openingName: input.openingName,
    openingEco: input.openingEco,
    tacticalMotifs,
    threats: detectThreats(postMoveAnalysis, input.fenAfter),
    coachingLevel: input.coachingLevel,
  };

  const layers = generateAnalysis(templateInput);

  const evalBefore = buildEngineEvaluation(preMoveAnalysis, bestLine, isWhiteToMove);
  const evalAfter = buildEngineEvaluation(postMoveAnalysis, postBestLine, !isWhiteToMove);

  const analysisTimeMs = performance.now() - startTime;

  const result: AnalysisResult = {
    classification: classificationResult.classification,
    centipawnLoss: classificationResult.centipawnLoss,
    evalBefore,
    evalAfter,
    bestMove: classificationResult.bestMoveUci,
    bestMoveSan,
    playedMove: input.playedMoveUci,
    playedMoveSan: input.playedMoveSan,
    topMoves: preMoveLines,
    layers,
    isBookMove: false,
    openingName: input.openingName,
    openingEco: input.openingEco,
    tacticalMotifs,
    gamePhase,
    threats: detectThreats(postMoveAnalysis, input.fenAfter),
    analysisTimeMs,
  };

  if (input.onProgress) {
    input.onProgress({
      stage: "full",
      classification: result.classification,
      centipawnLoss: result.centipawnLoss,
      evalCp: evalAfterWhite,
      winProbability: centipawnsToWinProbability(evalAfterWhite),
      result,
    });
  }

  return result;
}


function createBookMoveResult(
  input: PipelineInput,
  moveInfo: MoveInfo,
  gamePhase: GamePhase,
  startTime: number
): AnalysisResult {
  const templateInput: TemplateInput = {
    moveInfo,
    classification: MoveClassification.BOOK,
    centipawnLoss: 0,
    evalBeforeCp: 0,
    evalAfterCp: 0,
    mateBefore: null,
    mateAfter: null,
    bestMoveUci: input.playedMoveUci,
    bestMoveSan: input.playedMoveSan,
    bestMoveEvalCp: 0,
    topMoves: [],
    fenBefore: input.fenBefore,
    fenAfter: input.fenAfter,
    gamePhase,
    moveNumber: input.moveNumber,
    playerColor: input.playerColor,
    isPlayerMove: input.isPlayerMove,
    isBookMove: true,
    openingName: input.openingName,
    openingEco: input.openingEco,
    tacticalMotifs: [],
    threats: [],
    coachingLevel: input.coachingLevel,
  };

  const layers = generateAnalysis(templateInput);
  const emptyEval = createEmptyEvaluation();

  return {
    classification: MoveClassification.BOOK,
    centipawnLoss: 0,
    evalBefore: emptyEval,
    evalAfter: emptyEval,
    bestMove: input.playedMoveUci,
    bestMoveSan: input.playedMoveSan,
    playedMove: input.playedMoveUci,
    playedMoveSan: input.playedMoveSan,
    topMoves: [],
    layers,
    isBookMove: true,
    openingName: input.openingName,
    openingEco: input.openingEco,
    tacticalMotifs: [],
    gamePhase,
    threats: [],
    analysisTimeMs: performance.now() - startTime,
  };
}

async function createForcedMoveResult(
  input: PipelineInput,
  moveInfo: MoveInfo,
  gamePhase: GamePhase,
  manager: EngineManager,
  startTime: number
): Promise<AnalysisResult> {
  let evalAfterWhite = 0;
  let evalAfterObj = createEmptyEvaluation();

  try {
    const quickResult = await manager.quickEval(input.fenAfter, 10);
    const postLine = quickResult.lines[0];
    if (postLine) {
      const isOpponentWhite = input.color !== "white";
      evalAfterWhite = normalizeLineScoreToWhite(postLine, isOpponentWhite);
      evalAfterObj = buildEngineEvaluation(quickResult, postLine, isOpponentWhite);
    }
  } catch {
    // Use defaults
  }

  const templateInput: TemplateInput = {
    moveInfo,
    classification: MoveClassification.FORCED,
    centipawnLoss: 0,
    evalBeforeCp: evalAfterWhite,
    evalAfterCp: evalAfterWhite,
    mateBefore: null,
    mateAfter: null,
    bestMoveUci: input.playedMoveUci,
    bestMoveSan: input.playedMoveSan,
    bestMoveEvalCp: evalAfterWhite,
    topMoves: [],
    fenBefore: input.fenBefore,
    fenAfter: input.fenAfter,
    gamePhase,
    moveNumber: input.moveNumber,
    playerColor: input.playerColor,
    isPlayerMove: input.isPlayerMove,
    isBookMove: false,
    openingName: input.openingName,
    openingEco: input.openingEco,
    tacticalMotifs: [],
    threats: [],
    coachingLevel: input.coachingLevel,
  };

  const layers = generateAnalysis(templateInput);

  return {
    classification: MoveClassification.FORCED,
    centipawnLoss: 0,
    evalBefore: evalAfterObj,
    evalAfter: evalAfterObj,
    bestMove: input.playedMoveUci,
    bestMoveSan: input.playedMoveSan,
    playedMove: input.playedMoveUci,
    playedMoveSan: input.playedMoveSan,
    topMoves: [],
    layers,
    isBookMove: false,
    openingName: input.openingName,
    openingEco: input.openingEco,
    tacticalMotifs: [],
    gamePhase,
    threats: [],
    analysisTimeMs: performance.now() - startTime,
  };
}

function createFallbackResult(
  input: PipelineInput,
  moveInfo: MoveInfo,
  gamePhase: GamePhase,
  startTime: number
): AnalysisResult {
  const emptyEval = createEmptyEvaluation();

  return {
    classification: MoveClassification.GOOD,
    centipawnLoss: 0,
    evalBefore: emptyEval,
    evalAfter: emptyEval,
    bestMove: input.playedMoveUci,
    bestMoveSan: input.playedMoveSan,
    playedMove: input.playedMoveUci,
    playedMoveSan: input.playedMoveSan,
    topMoves: [],
    layers: {
      descriptive: `${moveInfo.pieceName} moves to ${moveInfo.to}.`,
      evaluative: "Engine analysis unavailable for this move.",
      consequential: "Unable to calculate the continuation.",
      corrective: "",
      strategic: `Game phase: ${gamePhase}.`,
      coachingTip: "Keep playing and learning from each move!",
    },
    isBookMove: false,
    openingName: input.openingName,
    openingEco: input.openingEco,
    tacticalMotifs: [],
    gamePhase,
    threats: [],
    analysisTimeMs: performance.now() - startTime,
  };
}



function normalizeLineScoreToWhite(line: PVLine, isWhiteToMove: boolean): number {
  if (line.score.mate != null) {
    const mateFromWhite = normalizeMateToWhite(line.score.mate, isWhiteToMove);
    return mateFromWhite > 0
      ? 10000 - (mateFromWhite - 1) * 100
      : -10000 + (Math.abs(mateFromWhite) - 1) * 100;
  }
  return normalizeScoreToWhite(line.score.centipawns ?? 0, isWhiteToMove);
}

function buildEngineEvaluation(
  searchResult: SearchResult,
  bestLine: PVLine | undefined,
  isWhiteToMove: boolean
): EngineEvaluation {
  if (!bestLine) return createEmptyEvaluation();

  const cpFromWhite = bestLine.score.centipawns != null
    ? normalizeScoreToWhite(bestLine.score.centipawns, isWhiteToMove)
    : null;

  const mateFromWhite = bestLine.score.mate != null
    ? normalizeMateToWhite(bestLine.score.mate, isWhiteToMove)
    : null;

  let winProb = 50;
  let drawProb = 0;
  let lossProb = 50;

  if (bestLine.wdl) {
    const normalized = normalizeWDL(bestLine.wdl, isWhiteToMove, true);
    winProb = normalized.win;
    drawProb = normalized.draw;
    lossProb = normalized.loss;
  } else if (cpFromWhite != null) {
    winProb = centipawnsToWinProbability(cpFromWhite);
    lossProb = 100 - winProb;
  }

  return {
    centipawns: cpFromWhite,
    mate: mateFromWhite,
    depth: bestLine.depth,
    selectiveDepth: bestLine.depth,
    winProbability: winProb,
    drawProbability: drawProb,
    lossProbability: lossProb,
    bestMove: searchResult.bestMove,
    ponderMove: searchResult.ponderMove ?? null,
    principalVariation: bestLine.moves,
    nodes: searchResult.totalNodes,
    nodesPerSecond: searchResult.timeMs > 0
      ? Math.round(searchResult.totalNodes / (searchResult.timeMs / 1000))
      : 0,
    timeMs: searchResult.timeMs,
  };
}

function createEmptyEvaluation(): EngineEvaluation {
  return {
    centipawns: 0,
    mate: null,
    depth: 0,
    selectiveDepth: 0,
    winProbability: 50,
    drawProbability: 0,
    lossProbability: 50,
    bestMove: "",
    ponderMove: null,
    principalVariation: [],
    nodes: 0,
    nodesPerSecond: 0,
    timeMs: 0,
  };
}

function detectTacticalMotifs(
  moveInfo: MoveInfo,
  preMoveLines: PVLine[]
): TacticalMotif[] {
  const motifs: TacticalMotif[] = [];

  if (moveInfo.isSacrifice) motifs.push(TacticalMotif.SACRIFICE);
  if (moveInfo.isCheckmate) motifs.push(TacticalMotif.CHECKMATE_THREAT);
  if (moveInfo.isPromotion) motifs.push(TacticalMotif.PROMOTION_THREAT);

  if (moveInfo.isCheck && (moveInfo.piece === "n" || moveInfo.piece === "q")) {
    if (preMoveLines[0]?.score?.centipawns != null && preMoveLines[0].score.centipawns > 200) {
      motifs.push(TacticalMotif.FORK);
    }
  }

  if (moveInfo.isCheckmate && (moveInfo.piece === "r" || moveInfo.piece === "q")) {
    if (moveInfo.to[1] === "1" || moveInfo.to[1] === "8") {
      motifs.push(TacticalMotif.BACK_RANK_MATE);
    }
  }

  return motifs;
}

function detectThreats(postMoveAnalysis: SearchResult, fenAfter: string): string[] {
  const threats: string[] = [];
  if (!postMoveAnalysis.lines[0]) return threats;

  const bestResponse = postMoveAnalysis.lines[0];
  const bestResponseMove = bestResponse.moves[0];
  if (!bestResponseMove) return threats;

  const threatSan = uciToSan(fenAfter, bestResponseMove);

  if (bestResponse.score.mate != null && bestResponse.score.mate > 0) {
    threats.push(`Checkmate threat: ${threatSan} starts a forced mate sequence`);
  }

  return threats;
}

export function createEvalHistoryEntry(
  result: AnalysisResult,
  moveNumber: number,
  color: "white" | "black",
  san: string
): EvalHistoryEntry {
  return {
    moveNumber,
    color,
    san,
    evaluation: result.evalAfter.centipawns ?? 0,
    winProbability: result.evalAfter.winProbability,
    classification: result.classification,
  };
}

export function calculateGameStats(results: AnalysisResult[]) {
  if (results.length === 0) {
    return {
      totalMoves: 0,
      accuracy: 100,
      averageCentipawnLoss: 0,
      classificationCounts: createEmptyClassificationCounts(),
      criticalMoments: [] as number[],
      bestMovePercentage: 100,
    };
  }

  const counts = createEmptyClassificationCounts();
  let totalCpLoss = 0;
  let bestMoveCount = 0;
  const evalSwings: { index: number; swing: number }[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    counts[r.classification]++;
    totalCpLoss += r.centipawnLoss;

    if (
      r.classification === MoveClassification.BEST ||
      r.classification === MoveClassification.BRILLIANT ||
      r.classification === MoveClassification.GREAT
    ) {
      bestMoveCount++;
    }

    if (i > 0) {
      const prevEval = results[i - 1].evalAfter.centipawns ?? 0;
      const currEval = r.evalAfter.centipawns ?? 0;
      evalSwings.push({ index: i, swing: Math.abs(currEval - prevEval) });
    }
  }

  const avgCpLoss = totalCpLoss / results.length;
  const accuracy = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * avgCpLoss) - 3.1668));

  evalSwings.sort((a, b) => b.swing - a.swing);
  const criticalMoments = evalSwings.slice(0, 5).map((s) => s.index);

  return {
    totalMoves: results.length,
    accuracy: Math.round(accuracy * 10) / 10,
    averageCentipawnLoss: Math.round(avgCpLoss * 10) / 10,
    classificationCounts: counts,
    criticalMoments,
    bestMovePercentage: Math.round((bestMoveCount / results.length) * 1000) / 10,
  };
}

function createEmptyClassificationCounts(): Record<MoveClassification, number> {
  return {
    [MoveClassification.BRILLIANT]: 0,
    [MoveClassification.GREAT]: 0,
    [MoveClassification.BEST]: 0,
    [MoveClassification.EXCELLENT]: 0,
    [MoveClassification.GOOD]: 0,
    [MoveClassification.BOOK]: 0,
    [MoveClassification.INACCURACY]: 0,
    [MoveClassification.MISTAKE]: 0,
    [MoveClassification.BLUNDER]: 0,
    [MoveClassification.MISS]: 0,
    [MoveClassification.FORCED]: 0,
  };
}