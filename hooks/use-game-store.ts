// ============================================================
// ChessMind Coach — Game Store (Complete)
// ============================================================

import { create } from "zustand";
import { Chess } from "chess.js";

import {
  MoveRecord,
  MoveClassification,
  CoachingLevel,
  GamePhase,
  PlayerColor,
  BotLevel,
  BOT_LEVELS,
  GameResult,
  GameEndReason,
  EvalHistoryEntry,
  AnalysisResult,
  AppSettings,
  DEFAULT_SETTINGS,
} from "@/lib/types";

import {
  STARTING_FEN,
  uciToSan,
  getLegalMoves,
  analyzeMoveProperties,
} from "@/lib/chess-utils";

import { EngineManager } from "@/engine/engine-manager";
import { runAnalysisPipeline, createEvalHistoryEntry } from "@/analysis/analysis-pipeline";


// ============================================================
// ANALYSIS QUEUE — One analysis at a time
// ============================================================

let analysisQueue: Array<{
  moveIndex: number;
  resolve: () => void;
}> = [];
let isProcessingQueue = false;

async function processAnalysisQueue(
  get: () => GameStore,
  set: (fn: (s: GameStore) => Partial<GameStore>) => void
) {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (analysisQueue.length > 0) {
    const task = analysisQueue.shift()!;
    try {
      await doAnalyzeMove(task.moveIndex, get, set);
    } catch (err) {
      console.error("[Queue] Analysis failed for move", task.moveIndex, err);
    }
    task.resolve();
  }

  isProcessingQueue = false;
}

async function doAnalyzeMove(
  moveIndex: number,
  get: () => GameStore,
  set: (fn: (s: GameStore) => Partial<GameStore>) => void
) {
  const state = get();
  const moveRecord = state.moves[moveIndex];

  if (!moveRecord) {
    console.warn("[Store] No move at index", moveIndex);
    return;
  }

  set(() => ({ isAnalyzing: true }));

  try {
    console.log(`[Store] Starting analysis for move ${moveIndex + 1}: ${moveRecord.san}`);

    const result = await runAnalysisPipeline({
      fenBefore: moveRecord.fenBefore,
      fenAfter: moveRecord.fenAfter,
      playedMoveUci: moveRecord.uci,
      playedMoveSan: moveRecord.san,
      color: moveRecord.color,
      moveNumber: moveRecord.moveNumber,
      playerColor: state.playerColor,
      isPlayerMove: moveRecord.color === state.playerColor,
      coachingLevel: state.coachingLevel,
      isBookMove: false,
      openingName: state.currentOpening,
      openingEco: state.currentEco,
    });

    set((s) => {
      const updatedMoves = [...s.moves];
      if (updatedMoves[moveIndex]) {
        updatedMoves[moveIndex] = {
          ...updatedMoves[moveIndex],
          analysis: result,
          isAnalyzing: false,
        };
      }

      const newEvalEntry = createEvalHistoryEntry(
        result,
        moveRecord.moveNumber,
        moveRecord.color,
        moveRecord.san
      );

      return {
        moves: updatedMoves,
        isAnalyzing: analysisQueue.length > 0,
        evalHistory: [...s.evalHistory, newEvalEntry],
        gamePhase: result.gamePhase,
        currentOpening: result.openingName || s.currentOpening,
        currentEco: result.openingEco || s.currentEco,
      };
    });

    console.log(
      `[Store] Analysis done for move ${moveIndex + 1}: ` +
      `${result.classification} (${result.centipawnLoss}cp) in ${result.analysisTimeMs.toFixed(0)}ms`
    );

  } catch (error) {
    console.error("[Store] Analysis failed for move", moveIndex, error);
    set((s) => {
      const updatedMoves = [...s.moves];
      if (updatedMoves[moveIndex]) {
        updatedMoves[moveIndex] = {
          ...updatedMoves[moveIndex],
          isAnalyzing: false,
        };
      }
      return { moves: updatedMoves, isAnalyzing: analysisQueue.length > 0 };
    });
  }
}


// ============================================================
// STORE INTERFACE
// ============================================================

interface HintData {
  bestMove: string;
  bestMoveSan: string;
  explanation: string;
  evalCp: number;
  isLoading: boolean;
}

interface GameStore {
  gameId: string;
  fen: string;
  moves: MoveRecord[];
  playerColor: PlayerColor;
  botLevel: BotLevel;
  coachingLevel: CoachingLevel;
  gamePhase: GamePhase;
  isPlayerTurn: boolean;
  isGameOver: boolean;
  result: GameResult | null;
  isGameActive: boolean;
  isAnalyzing: boolean;
  isBotThinking: boolean;
  isEngineReady: boolean;
  engineError: string | null;
  viewingMoveIndex: number;
  evalHistory: EvalHistoryEntry[];
  currentOpening: string | null;
  currentEco: string | null;
  isInBook: boolean;
  settings: AppSettings;
  _chess: Chess;
  currentHint: HintData | null;

  initializeEngine: () => Promise<void>;
  startGame: (playerColor: PlayerColor, botLevel: BotLevel, coachingLevel: CoachingLevel) => Promise<void>;
  makePlayerMove: (from: string, to: string, promotion?: string) => Promise<void>;
  makeBotMove: () => Promise<void>;
  queueAnalysis: (moveIndex: number) => void;
  generateHint: () => Promise<void>;
  goToMove: (index: number) => void;
  goForward: () => void;
  goBack: () => void;
  goToStart: () => void;
  goToEnd: () => void;
  resign: () => void;
  offerDraw: () => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  reset: () => void;
  getViewingFen: () => string;
  getLegalMovesForSquare: (square: string) => string[];
}


// ============================================================
// INITIAL STATE
// ============================================================

const initialState = {
  gameId: "",
  fen: STARTING_FEN,
  moves: [] as MoveRecord[],
  playerColor: "white" as PlayerColor,
  botLevel: BOT_LEVELS[5],
  coachingLevel: CoachingLevel.INTERMEDIATE,
  gamePhase: GamePhase.OPENING,
  isPlayerTurn: true,
  isGameOver: false,
  result: null as GameResult | null,
  isGameActive: false,
  isAnalyzing: false,
  isBotThinking: false,
  isEngineReady: false,
  engineError: null as string | null,
  viewingMoveIndex: -1,
  evalHistory: [] as EvalHistoryEntry[],
  currentOpening: null as string | null,
  currentEco: null as string | null,
  isInBook: false,
  settings: DEFAULT_SETTINGS,
  _chess: new Chess(),
  currentHint: null as HintData | null,
};


// ============================================================
// THE STORE
// ============================================================

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  // ══════════════════════════════════════════
  // Initialize Engine
  // ══════════════════════════════════════════
  initializeEngine: async () => {
    try {
      set({ engineError: null });
      const manager = EngineManager.getInstance();
      await manager.initialize();
      set({ isEngineReady: true });
      console.log("[GameStore] Engines ready!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to initialize engine";
      console.error("[GameStore] Engine init failed:", message);
      set({ engineError: message, isEngineReady: false });
    }
  },

  // ══════════════════════════════════════════
  // Start Game
  // ══════════════════════════════════════════
  startGame: async (playerColor, botLevel, coachingLevel) => {
    console.log(`[GameStore] Starting: ${playerColor}, ${botLevel.name} (~${botLevel.elo}), ${coachingLevel}`);

    analysisQueue = [];
    isProcessingQueue = false;

    const gameId = `game_${Date.now()}`;
    const chess = new Chess();

    set({
      gameId,
      fen: STARTING_FEN,
      moves: [],
      playerColor,
      botLevel,
      coachingLevel,
      gamePhase: GamePhase.OPENING,
      isPlayerTurn: playerColor === "white",
      isGameOver: false,
      result: null,
      isGameActive: true,
      isAnalyzing: false,
      isBotThinking: false,
      viewingMoveIndex: -1,
      evalHistory: [],
      currentOpening: null,
      currentEco: null,
      isInBook: false,
      _chess: chess,
      currentHint: null,
    });

    const manager = EngineManager.getInstance();
    try {
      await manager.configureBotLevel(botLevel);
      await manager.newAnalysisGame();
    } catch (error) {
      console.error("[GameStore] Bot config failed:", error);
    }

    // If player is black, bot goes first
    if (playerColor === "black") {
      setTimeout(() => {
        get().makeBotMove();
      }, 500);
    } else {
      // Player is white — generate initial hint
      setTimeout(() => {
        get().generateHint();
      }, 1000);
    }
  },

  // ══════════════════════════════════════════
  // Player Move
  // ══════════════════════════════════════════
  makePlayerMove: async (from, to, promotion) => {
    const state = get();
    if (!state.isGameActive || state.isGameOver || !state.isPlayerTurn || state.isBotThinking) {
      return;
    }

    // Clear hint
    set({ currentHint: null });

    const chess = state._chess;
    const fenBefore = chess.fen();

    let move;
    try {
      move = chess.move({ from, to, promotion: (promotion || "q") as "q" | "r" | "b" | "n" });
    } catch {
      return;
    }
    if (!move) return;

    const fenAfter = chess.fen();
    const uci = from + to + (move.promotion || "");
    const san = move.san;
    const moveNumber = Math.ceil((state.moves.length + 1) / 2);
    const color: PlayerColor = move.color === "w" ? "white" : "black";

    console.log(`[GameStore] Player: ${san} (${uci})`);

    const moveRecord: MoveRecord = {
      moveNumber,
      color,
      san,
      uci,
      fenBefore,
      fenAfter,
      analysis: null,
      isAnalyzing: true,
      timestamp: Date.now(),
    };

    set((s) => ({
      fen: fenAfter,
      moves: [...s.moves, moveRecord],
      isPlayerTurn: false,
      viewingMoveIndex: -1,
    }));

    // Check game over
    const gameEnd = checkGameEndState(chess);
    if (gameEnd) {
      set({ isGameOver: true, isGameActive: false, result: gameEnd });
      const moveIdx = get().moves.length - 1;
      doAnalyzeMove(moveIdx, get, set);
      return;
    }

    // Analyze player's move FIRST, then bot responds
    const moveIdx = get().moves.length - 1;
    doAnalyzeMove(moveIdx, get, set).then(() => {
      const currentState = get();
      if (currentState.isGameActive && !currentState.isGameOver && !currentState.isPlayerTurn) {
        get().makeBotMove();
      }
    });
  },

  // ══════════════════════════════════════════
  // Bot Move
  // ══════════════════════════════════════════
  makeBotMove: async () => {
    const state = get();
    if (!state.isGameActive || state.isGameOver || state.isPlayerTurn) return;

    set({ isBotThinking: true });

    const manager = EngineManager.getInstance();
    const chess = state._chess;
    const fenBefore = chess.fen();

    try {
      const botResult = await manager.getBotMove(fenBefore);
      let botMoveUci = botResult.bestMove;

      if (botMoveUci === "(none)") {
        set({ isBotThinking: false });
        return;
      }

      botMoveUci = applyBotRandomness(botResult, state.botLevel, fenBefore);

      const from = botMoveUci.substring(0, 2);
      const to = botMoveUci.substring(2, 4);
      const promo = botMoveUci.length === 5 ? botMoveUci[4] : undefined;

      let move;
      try {
        move = chess.move({ from, to, promotion: (promo || "q") as "q" | "r" | "b" | "n" });
      } catch {
        const bf = botResult.bestMove.substring(0, 2);
        const bt = botResult.bestMove.substring(2, 4);
        const bp = botResult.bestMove.length === 5 ? botResult.bestMove[4] : undefined;
        move = chess.move({ from: bf, to: bt, promotion: (bp || "q") as "q" | "r" | "b" | "n" });
      }

      if (!move) {
        set({ isBotThinking: false });
        return;
      }

      const fenAfter = chess.fen();
      const uci = move.from + move.to + (move.promotion || "");
      const san = move.san;
      const moveNumber = Math.ceil((get().moves.length + 1) / 2);
      const color: PlayerColor = move.color === "w" ? "white" : "black";

      console.log(`[GameStore] Bot: ${san} (${uci})`);

      const moveRecord: MoveRecord = {
        moveNumber,
        color,
        san,
        uci,
        fenBefore,
        fenAfter,
        analysis: null,
        isAnalyzing: true,
        timestamp: Date.now(),
      };

      set((s) => ({
        fen: fenAfter,
        moves: [...s.moves, moveRecord],
        isPlayerTurn: true,
        isBotThinking: false,
        viewingMoveIndex: -1,
      }));

      const gameEnd = checkGameEndState(chess);
      if (gameEnd) {
        set({ isGameOver: true, isGameActive: false, result: gameEnd });
      }

      // Analyze bot's move, then generate hint for player
      const botMoveIdx = get().moves.length - 1;
      doAnalyzeMove(botMoveIdx, get, set).then(() => {
        const current = get();
        if (current.isPlayerTurn && !current.isGameOver && current.isGameActive) {
          get().generateHint();
        }
      });

    } catch (error) {
      console.error("[GameStore] Bot error:", error);
      set({ isBotThinking: false });
    }
  },

  // ══════════════════════════════════════════
  // Queue Analysis
  // ══════════════════════════════════════════
  queueAnalysis: (moveIndex: number) => {
    analysisQueue.push({
      moveIndex,
      resolve: () => {},
    });
    processAnalysisQueue(get, set);
  },

  // ══════════════════════════════════════════
  // Generate Hint — Best move suggestion
  // ══════════════════════════════════════════
  generateHint: async () => {
    const state = get();

    if (!state.isGameActive || state.isGameOver || !state.isPlayerTurn || state.isBotThinking) {
      return;
    }

    set({
      currentHint: {
        bestMove: "",
        bestMoveSan: "",
        explanation: "Analyzing position...",
        evalCp: 0,
        isLoading: true,
      },
    });

    try {
      const manager = EngineManager.getInstance();
      const result = await manager.analyzePosition(state.fen, {
        multiPV: 3,
        moveTime: 2000,
      });

      const bestLine = result.lines[0];
      if (!bestLine || !bestLine.moves[0]) {
        set({ currentHint: null });
        return;
      }

      const bestMoveUci = bestLine.moves[0];
      const bestMoveSan = uciToSan(state.fen, bestMoveUci);
      const isWhiteToMove = state.fen.split(" ")[1] === "w";
      const evalCp = isWhiteToMove
        ? (bestLine.score.centipawns ?? 0)
        : -(bestLine.score.centipawns ?? 0);

      const level = state.coachingLevel;
      let explanation = "";

      // Analyze what the best move does
      const moveInfo = analyzeMoveProperties(state.fen, bestMoveUci);

      if (level === CoachingLevel.BEGINNER) {
        if (moveInfo.isCapture) {
          explanation = `Consider playing ${bestMoveSan} — you can capture the ${moveInfo.capturedPieceName || "piece"} on ${moveInfo.to}! `;
          explanation += `This wins material and improves your position.`;
        } else if (moveInfo.isCastling) {
          explanation = `Consider castling (${bestMoveSan}) — get your king to safety! `;
          explanation += `Castling is one of the most important moves in chess.`;
        } else if (moveInfo.isCheck) {
          explanation = `Consider playing ${bestMoveSan} — it gives check to the opponent's king! `;
          explanation += `Giving check forces your opponent to respond to the threat.`;
        } else {
          explanation = `The best move is ${bestMoveSan}. `;
          if (moveInfo.piece === "n" || moveInfo.piece === "b") {
            explanation += `This develops your ${moveInfo.pieceName} to an active square where it controls more of the board.`;
          } else if (moveInfo.piece === "p") {
            explanation += `This pawn move helps you control important central squares.`;
          } else if (moveInfo.piece === "r") {
            explanation += `Moving your rook to ${moveInfo.to} puts it on a more active file.`;
          } else if (moveInfo.piece === "q") {
            explanation += `This queen move improves your position and creates threats.`;
          } else {
            explanation += `This move improves your ${moveInfo.pieceName}'s position.`;
          }
        }
      } else if (level === CoachingLevel.INTERMEDIATE) {
        explanation = `Best move: ${bestMoveSan}`;

        if (moveInfo.isCapture) {
          explanation += ` (captures ${moveInfo.capturedPieceName} on ${moveInfo.to})`;
        }
        if (moveInfo.isCheck) {
          explanation += ` (check)`;
        }

        explanation += `. Eval: ${evalCp > 0 ? "+" : ""}${(evalCp / 100).toFixed(1)}. `;

        // Show alternatives
        if (result.lines.length > 1) {
          const alts = result.lines.slice(1, 3).map((l) => {
            const san = uciToSan(state.fen, l.moves[0]);
            const cp = isWhiteToMove
              ? (l.score.centipawns ?? 0)
              : -(l.score.centipawns ?? 0);
            return `${san} (${cp > 0 ? "+" : ""}${(cp / 100).toFixed(1)})`;
          });
          explanation += `Alternatives: ${alts.join(", ")}.`;
        }

        // Show continuation
        if (bestLine.moves.length > 1) {
          const pvSans = buildPVSans(state.fen, bestLine.moves.slice(0, 6));
          if (pvSans.length > 1) {
            explanation += ` Expected: ${pvSans.join(" ")}.`;
          }
        }
      } else {
        // Advanced
        explanation = `Best: ${bestMoveSan} [${evalCp > 0 ? "+" : ""}${(evalCp / 100).toFixed(2)}]`;

        // Show PV
        if (bestLine.moves.length > 1) {
          const pvSans = buildPVSans(state.fen, bestLine.moves.slice(0, 8));
          if (pvSans.length > 1) {
            explanation += ` PV: ${pvSans.join(" ")}`;
          }
        }

        // Show alternatives
        if (result.lines.length > 1) {
          const alts = result.lines.slice(1, 3).map((l) => {
            const san = uciToSan(state.fen, l.moves[0]);
            const cp = isWhiteToMove
              ? (l.score.centipawns ?? 0)
              : -(l.score.centipawns ?? 0);
            return `${san}[${cp > 0 ? "+" : ""}${(cp / 100).toFixed(2)}]`;
          });
          explanation += ` | ${alts.join(" ")}`;
        }

        explanation += ` (depth ${bestLine.depth})`;
      }

      set({
        currentHint: {
          bestMove: bestMoveUci,
          bestMoveSan,
          explanation,
          evalCp,
          isLoading: false,
        },
      });

    } catch (error) {
      console.error("[GameStore] Hint generation failed:", error);
      set({ currentHint: null });
    }
  },

  // ══════════════════════════════════════════
  // Navigation
  // ══════════════════════════════════════════
  goToMove: (index) => {
    const state = get();
    if (index < -1 || index >= state.moves.length) return;
    set({ viewingMoveIndex: index });
  },

  goForward: () => {
    const state = get();
    if (state.viewingMoveIndex === -1) return;
    const next = state.viewingMoveIndex + 1;
    set({ viewingMoveIndex: next >= state.moves.length ? -1 : next });
  },

  goBack: () => {
    const state = get();
    if (state.viewingMoveIndex === -1) {
      if (state.moves.length > 0) set({ viewingMoveIndex: state.moves.length - 1 });
    } else if (state.viewingMoveIndex > 0) {
      set({ viewingMoveIndex: state.viewingMoveIndex - 1 });
    }
  },

  goToStart: () => {
    set({ viewingMoveIndex: 0 });
  },

  goToEnd: () => {
    set({ viewingMoveIndex: -1 });
  },

  getViewingFen: () => {
    const state = get();
    if (state.viewingMoveIndex === -1) return state.fen;
    if (state.viewingMoveIndex === 0 && state.moves.length > 0) return state.moves[0].fenBefore;
    const move = state.moves[state.viewingMoveIndex];
    return move ? move.fenAfter : state.fen;
  },

  getLegalMovesForSquare: (square) => {
    const state = get();
    if (state.viewingMoveIndex !== -1 || state.isGameOver || !state.isPlayerTurn || state.isBotThinking) {
      return [];
    }
    try {
      const moves = getLegalMoves(state.fen);
      return moves.filter((m) => m.from === square).map((m) => m.to);
    } catch {
      return [];
    }
  },

  // ══════════════════════════════════════════
  // Game Actions
  // ══════════════════════════════════════════
  resign: () => {
    const state = get();
    if (!state.isGameActive) return;
    const winner: PlayerColor = state.playerColor === "white" ? "black" : "white";
    set({
      isGameOver: true,
      isGameActive: false,
      result: {
        winner,
        reason: GameEndReason.RESIGNATION,
        description: `${state.playerColor === "white" ? "White" : "Black"} resigned`,
      },
    });
  },

  offerDraw: () => {
    const state = get();
    if (!state.isGameActive) return;
    const lastEval = state.evalHistory[state.evalHistory.length - 1];
    if ((lastEval && Math.abs(lastEval.evaluation) < 50) || state._chess.isDraw()) {
      set({
        isGameOver: true,
        isGameActive: false,
        result: {
          winner: "draw",
          reason: GameEndReason.AGREEMENT,
          description: "Draw by agreement",
        },
      });
    }
  },

  updateSettings: (newSettings) => {
    set((s) => ({ settings: { ...s.settings, ...newSettings } }));
  },

  reset: () => {
    analysisQueue = [];
    isProcessingQueue = false;
    set({
      ...initialState,
      _chess: new Chess(),
      isEngineReady: get().isEngineReady,
      settings: get().settings,
    });
  },
}));


// ============================================================
// HELPER FUNCTIONS
// ============================================================

function checkGameEndState(chess: Chess): GameResult | null {
  if (chess.isCheckmate()) {
    const winner: PlayerColor = chess.turn() === "w" ? "black" : "white";
    return {
      winner,
      reason: GameEndReason.CHECKMATE,
      description: `Checkmate! ${winner === "white" ? "White" : "Black"} wins!`,
    };
  }
  if (chess.isStalemate()) {
    return { winner: "draw", reason: GameEndReason.STALEMATE, description: "Stalemate" };
  }
  if (chess.isThreefoldRepetition()) {
    return { winner: "draw", reason: GameEndReason.THREEFOLD_REP, description: "Threefold repetition" };
  }
  if (chess.isInsufficientMaterial()) {
    return { winner: "draw", reason: GameEndReason.INSUFFICIENT, description: "Insufficient material" };
  }
  if (chess.isDraw()) {
    return { winner: "draw", reason: GameEndReason.FIFTY_MOVE, description: "Fifty-move rule" };
  }
  return null;
}

function applyBotRandomness(
  botResult: { bestMove: string; lines: Array<{ moves: string[] }> },
  botLevel: BotLevel,
  fen: string
): string {
  if (botLevel.randomness <= 0) return botResult.bestMove;
  if (Math.random() > botLevel.randomness) return botResult.bestMove;

  if (botLevel.randomness >= 0.5) {
    try {
      const chess = new Chess(fen);
      const legalMoves = chess.moves({ verbose: true });
      if (legalMoves.length > 0) {
        const goodMoves = legalMoves.filter((m) => m.captured || m.san.includes("+"));
        const pool = goodMoves.length > 0 && Math.random() > 0.3 ? goodMoves : legalMoves;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        return pick.from + pick.to + (pick.promotion || "");
      }
    } catch {
      /* fall through */
    }
  }

  if (botResult.lines && botResult.lines.length > 1) {
    const idx = Math.min(
      Math.floor(Math.random() * 3) + 1,
      botResult.lines.length - 1
    );
    const alt = botResult.lines[idx];
    if (alt?.moves?.[0]) return alt.moves[0];
  }

  return botResult.bestMove;
}

/**
 * Convert a sequence of UCI moves to SAN notation
 * by replaying them on a chess board.
 */
function buildPVSans(fen: string, uciMoves: string[]): string[] {
  const sans: string[] = [];
  try {
    const chess = new Chess(fen);
    for (const uciMove of uciMoves) {
      const from = uciMove.substring(0, 2);
      const to = uciMove.substring(2, 4);
      const promo = uciMove.length === 5 ? uciMove[4] : undefined;
      const move = chess.move({
        from,
        to,
        promotion: promo as "q" | "r" | "b" | "n" | undefined,
      });
      if (move) {
        sans.push(move.san);
      } else {
        break;
      }
    }
  } catch {
    // Return what we have
  }
  return sans;
}