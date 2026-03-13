// ============================================================
// ChessMind Coach — Game Page (Complete)
// ============================================================

"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useGameStore } from "@/hooks/use-game-store";
import {
  CoachingLevel,
  COACHING_LEVEL_DISPLAY,
  BOT_LEVELS,
  PlayerColor,
} from "@/lib/types";

import ChessBoard from "@/components/ChessBoard";
import EvaluationBar from "@/components/EvaluationBar";
import { EvaluationBarHorizontal } from "@/components/EvaluationBar";
import MoveList from "@/components/MoveList";
import AnalysisPanel from "@/components/AnalysisPanel";


// ============================================================
// MAIN PAGE
// ============================================================

export default function GamePage() {
  const isGameActive = useGameStore((s) => s.isGameActive);
  return (
    <div className="min-h-screen bg-zinc-950">
      {isGameActive ? <GameView /> : <SetupView />}
    </div>
  );
}


// ============================================================
// SETUP VIEW
// ============================================================

function SetupView() {
  const [selectedColor, setSelectedColor] = useState<PlayerColor>("white");
  const [selectedBotIndex, setSelectedBotIndex] = useState(5);
  const [selectedCoaching, setSelectedCoaching] = useState(CoachingLevel.INTERMEDIATE);

  const initializeEngine = useGameStore((s) => s.initializeEngine);
  const startGame = useGameStore((s) => s.startGame);
  const isEngineReady = useGameStore((s) => s.isEngineReady);
  const engineError = useGameStore((s) => s.engineError);

  useEffect(() => {
    initializeEngine();
  }, [initializeEngine]);

  const selectedBot = BOT_LEVELS[selectedBotIndex];

  const handleStart = () => {
    if (!isEngineReady) return;
    startGame(selectedColor, selectedBot, selectedCoaching);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-lg bg-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-800">
        <h1 className="text-3xl font-bold text-center text-white mb-2">
          ♟ ChessMind Coach
        </h1>
        <p className="text-center text-zinc-400 mb-8">
          Play against AI and improve with every move
        </p>

        {/* Engine Status */}
        <div className="mb-6">
          {engineError ? (
            <div className="bg-red-500/10 text-red-400 text-sm rounded-lg p-3 text-center">
              ❌ Engine Error: {engineError}
            </div>
          ) : !isEngineReady ? (
            <div className="bg-blue-500/10 text-blue-400 text-sm rounded-lg p-3 text-center flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              Loading chess engine...
            </div>
          ) : (
            <div className="bg-green-500/10 text-green-400 text-sm rounded-lg p-3 text-center">
              ✅ Engine ready
            </div>
          )}
        </div>

        {/* Color Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-zinc-300 mb-3">Play as</label>
          <div className="flex gap-3">
            <button
              onClick={() => setSelectedColor("white")}
              className={`flex-1 py-3 rounded-xl font-semibold text-lg transition-all
                ${selectedColor === "white"
                  ? "bg-white text-zinc-900 shadow-lg shadow-white/20"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
            >
              ♔ White
            </button>
            <button
              onClick={() => setSelectedColor("black")}
              className={`flex-1 py-3 rounded-xl font-semibold text-lg transition-all
                ${selectedColor === "black"
                  ? "bg-zinc-700 text-white shadow-lg shadow-zinc-600/30 ring-2 ring-zinc-500"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
            >
              ♚ Black
            </button>
          </div>
        </div>

        {/* Bot Difficulty */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-zinc-300 mb-1">Opponent Difficulty</label>
          <p className="text-lg font-bold text-white">
            {selectedBot.name}
            <span className="text-sm font-normal text-zinc-400 ml-2">~{selectedBot.elo} Elo</span>
          </p>
          <p className="text-xs text-zinc-500 mb-3">{selectedBot.description}</p>
          <input
            type="range"
            min={0}
            max={BOT_LEVELS.length - 1}
            value={selectedBotIndex}
            onChange={(e) => setSelectedBotIndex(parseInt(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>Beginner (400)</span>
            <span>Full Engine (3500)</span>
          </div>
        </div>

        {/* Coaching Level */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-zinc-300 mb-3">Coaching Style</label>
          <div className="space-y-2">
            {Object.values(CoachingLevel).map((level) => {
              const display = COACHING_LEVEL_DISPLAY[level];
              return (
                <button
                  key={level}
                  onClick={() => setSelectedCoaching(level)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all
                    ${selectedCoaching === level
                      ? "bg-blue-500/20 ring-2 ring-blue-500 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                >
                  <span className="font-semibold text-sm">{display.label}</span>
                  <span className="block text-xs text-zinc-500 mt-0.5">{display.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={!isEngineReady}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all
            ${isEngineReady
              ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/30 active:scale-95"
              : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
            }`}
        >
          {isEngineReady ? "Start Game" : "Loading Engine..."}
        </button>
      </div>
    </div>
  );
}


// ============================================================
// GAME VIEW
// ============================================================

function GameView() {
  // ── State ──
  const fen = useGameStore((s) => s.fen);
  const moves = useGameStore((s) => s.moves);
  const playerColor = useGameStore((s) => s.playerColor);
  const isPlayerTurn = useGameStore((s) => s.isPlayerTurn);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const result = useGameStore((s) => s.result);
  const isAnalyzing = useGameStore((s) => s.isAnalyzing);
  const isBotThinking = useGameStore((s) => s.isBotThinking);
  const viewingMoveIndex = useGameStore((s) => s.viewingMoveIndex);
  const botLevel = useGameStore((s) => s.botLevel);
  const evalHistory = useGameStore((s) => s.evalHistory);
  const currentOpening = useGameStore((s) => s.currentOpening);
  const currentHint = useGameStore((s) => s.currentHint);

  // ── Actions ──
  const makePlayerMove = useGameStore((s) => s.makePlayerMove);
  const goToMove = useGameStore((s) => s.goToMove);
  const goForward = useGameStore((s) => s.goForward);
  const goBack = useGameStore((s) => s.goBack);
  const goToStart = useGameStore((s) => s.goToStart);
  const goToEnd = useGameStore((s) => s.goToEnd);
  const resign = useGameStore((s) => s.resign);
  const getViewingFen = useGameStore((s) => s.getViewingFen);
  const getLegalMovesForSquare = useGameStore((s) => s.getLegalMovesForSquare);
  const reset = useGameStore((s) => s.reset);
  const generateHint = useGameStore((s) => s.generateHint);

  // ── Derived state ──
  const displayFen = viewingMoveIndex === -1 ? fen : getViewingFen();
  const isViewingHistory = viewingMoveIndex !== -1;
  const canInteract = !isGameOver && isPlayerTurn && !isBotThinking && !isViewingHistory && !isAnalyzing;

  // ── Last move highlighting ──
  const lastMove = useMemo((): [string, string] | null => {
    const relevantIndex = viewingMoveIndex === -1 ? moves.length - 1 : viewingMoveIndex;
    const move = moves[relevantIndex];
    if (!move) return null;
    return [move.uci.substring(0, 2), move.uci.substring(2, 4)];
  }, [moves, viewingMoveIndex]);

  // ── Current move's analysis ──
  const currentAnalysis = useMemo(() => {
    const relevantIndex = viewingMoveIndex === -1 ? moves.length - 1 : viewingMoveIndex;
    return moves[relevantIndex] || null;
  }, [moves, viewingMoveIndex]);

  // ── Latest evaluation for the eval bar ──
  const latestEval = useMemo(() => {
    if (evalHistory.length === 0) return { cp: 0, mate: null, winProb: 50 };
    const latest = evalHistory[evalHistory.length - 1];
    return {
      cp: latest.evaluation,
      mate: null as number | null,
      winProb: latest.winProbability,
    };
  }, [evalHistory]);

  // ── Handle move ──
  const handleMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      makePlayerMove(from, to, promotion);
    },
    [makePlayerMove]
  );

  // ── Status text ──
  const statusText = useMemo(() => {
    if (isGameOver) return "Game Over";
    if (isBotThinking) return "Bot is thinking...";
    if (isAnalyzing) return "Analyzing move...";
    if (isPlayerTurn) return "Your turn";
    return "Waiting...";
  }, [isGameOver, isBotThinking, isAnalyzing, isPlayerTurn]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top Bar ── */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">♟ ChessMind</span>
          {currentOpening && (
            <span className="text-xs text-zinc-400 hidden sm:inline">{currentOpening}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">vs {botLevel.name} (~{botLevel.elo})</span>
          {(isBotThinking || isAnalyzing) && (
            <span className="text-xs text-yellow-400 flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              {statusText}
            </span>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="grow flex flex-col lg:flex-row items-start justify-center gap-4 p-4">
        {/* ── Eval Bar (desktop) ── */}
        <div className="hidden lg:block">
          <EvaluationBar
            centipawns={latestEval.cp}
            mate={latestEval.mate}
            winProbability={latestEval.winProb}
            height={560}
            width={32}
            flipped={playerColor === "black"}
            isAnalyzing={isAnalyzing}
          />
        </div>

        {/* ── Center: Board + Controls ── */}
        <div className="flex flex-col items-center w-full max-w-[480px]">
          {/* Opponent name */}
          <div className="w-full flex items-center justify-between mb-2 px-1">
            <span className="text-sm text-zinc-400">
              {playerColor === "white" ? `♚ ${botLevel.name}` : "♔ You"}
            </span>
            {isViewingHistory && (
              <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                Viewing move {viewingMoveIndex + 1}
              </span>
            )}
          </div>

          {/* Chess Board */}
          <ChessBoard
            fen={displayFen}
            orientation={playerColor}
            interactive={canInteract}
            onMove={handleMove}
            getLegalMoves={getLegalMovesForSquare}
            lastMove={lastMove}
          />

          {/* Player name */}
          <div className="w-full flex items-center justify-between mt-2 px-1">
            <span className="text-sm text-zinc-300 font-semibold">
              {playerColor === "white" ? "♔ You" : `♚ ${botLevel.name}`}
            </span>
            <span className="text-xs text-zinc-500">
              {isPlayerTurn && !isGameOver && !isAnalyzing ? "Your turn" : ""}
            </span>
          </div>

          {/* Eval Bar (mobile) */}
          <div className="lg:hidden mt-2 w-full">
            <EvaluationBarHorizontal
              centipawns={latestEval.cp}
              mate={latestEval.mate}
              winProbability={latestEval.winProb}
              height={20}
              isAnalyzing={isAnalyzing}
            />
          </div>

          {/* ── Hint Panel ── */}
          {isPlayerTurn && !isGameOver && !isAnalyzing && (
            // FIXED: Added min-h-[140px] to prevent layout jumping
            <div className="w-full mt-3 min-h-[140px]">
              {currentHint ? (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 h-full">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                      💡 Hint
                    </span>
                    <button
                      onClick={generateHint}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                  {currentHint.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-blue-300">
                      <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      Analyzing position...
                    </div>
                  ) : (
                    <p className="text-sm text-blue-200 leading-relaxed">
                      {currentHint.explanation}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  onClick={generateHint}
                  className="w-full py-2 rounded-xl text-sm font-medium
                             bg-blue-500/10 hover:bg-blue-500/20 text-blue-400
                             border border-blue-500/20 transition-colors"
                >
                  💡 Show Hint
                </button>
              )}
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center gap-2 mt-3 w-full justify-center">
            <NavButton onClick={goToStart} label="⏮" title="Go to start" />
            <NavButton onClick={goBack} label="◀" title="Previous move" />
            <NavButton onClick={goForward} label="▶" title="Next move" />
            <NavButton onClick={goToEnd} label="⏭" title="Go to latest" />
            <div className="w-px h-6 bg-zinc-700 mx-1" />
            {!isGameOver && (
              <NavButton onClick={resign} label="🏳️" title="Resign" danger />
            )}
            {isGameOver && (
              <button
                onClick={reset}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold
                           bg-green-600 hover:bg-green-500 text-white transition-colors"
              >
                New Game
              </button>
            )}
          </div>
        </div>

        {/* ── Right Panel: Moves + Analysis ── */}
        <div className="w-full lg:w-80 flex flex-col bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden lg:h-[600px] mt-4 lg:mt-0">
          {/* Move List */}
          <div className="border-b border-zinc-800">
            <div className="px-3 py-2 bg-zinc-800/50">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                Moves
              </span>
            </div>
            <MoveList
              moves={moves}
              viewingIndex={viewingMoveIndex}
              onMoveClick={goToMove}
              className="max-h-48 lg:max-h-52"
            />
          </div>

          {/* Analysis Panel */}
          <div className="grow overflow-y-auto">
            <div className="px-3 py-2 bg-zinc-800/50 border-b border-zinc-800">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                Analysis
              </span>
            </div>
            <AnalysisPanel
              analysis={currentAnalysis?.analysis || null}
              moveSan={currentAnalysis?.san || ""}
              isAnalyzing={currentAnalysis?.isAnalyzing || false}
            />
          </div>
        </div>
      </div>

      {/* ── Game Over Overlay ── */}
      {isGameOver && result && <GameOverOverlay result={result} onNewGame={reset} />}
    </div>
  );
}


// ============================================================
// NAVIGATION BUTTON
// ============================================================

function NavButton({
  onClick,
  label,
  title,
  danger = false,
}: {
  onClick: () => void;
  label: string;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-colors
        ${danger
          ? "bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
          : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
        }`}
    >
      {label}
    </button>
  );
}


// ============================================================
// GAME OVER OVERLAY
// ============================================================

function GameOverOverlay({
  result,
  onNewGame,
}: {
  result: { winner: string; reason: string; description: string };
  onNewGame: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const playerColor = useGameStore((s) => s.playerColor);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const isWin = result.winner === playerColor;
  const isDraw = result.winner === "draw";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl p-8 max-w-sm w-full text-center
                      border border-zinc-700 shadow-2xl animate-badge-pop">
        <div className="text-6xl mb-4">
          {isDraw ? "🤝" : isWin ? "🏆" : "😔"}
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {isDraw ? "Draw!" : isWin ? "You Win!" : "You Lose"}
        </h2>
        <p className="text-zinc-400 mb-6">{result.description}</p>
        <div className="space-y-3">
          <button
            onClick={onNewGame}
            className="w-full py-3 rounded-xl font-bold text-lg
                       bg-green-600 hover:bg-green-500 text-white transition-colors"
          >
            Play Again
          </button>
          <button
            onClick={() => setVisible(false)}
            className="w-full py-3 rounded-xl font-bold text-sm
                       bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
          >
            Review Game
          </button>
        </div>
      </div>
    </div>
  );
}