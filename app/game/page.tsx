//pageeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
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
import EvaluationBar, { EvaluationBarHorizontal } from "@/components/EvaluationBar";
import MoveList from "@/components/MoveList";
import AnalysisPanel from "@/components/AnalysisPanel";

const PIECE_SYMBOLS: Record<string, string> = {
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", // Black pieces
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕"  // White pieces
};

function getMaterialState(fen: string) {
  const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, P: 1, N: 3, B: 3, R: 5, Q: 9 };
  const start: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, P: 8, N: 2, B: 2, R: 2, Q: 1 };
  const current: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, P: 0, N: 0, B: 0, R: 0, Q: 0 };
  
  const board = fen.split(" ")[0];
  let wScore = 0; let bScore = 0;
  
  for (const char of board) {
    if (current[char] !== undefined) current[char]++;
    if (char >= 'A' && char <= 'Z' && pieceValues[char]) wScore += pieceValues[char];
    if (char >= 'a' && char <= 'z' && pieceValues[char]) bScore += pieceValues[char];
  }
  
  const whiteCaptured: string[] = []; 
  const blackCaptured: string[] = []; 
  const order = ['q', 'r', 'b', 'n', 'p']; 
  
  for (const p of order) {
    const blackTaken = start[p] - current[p];
    for (let i = 0; i < blackTaken; i++) whiteCaptured.push(p);
    
    const P = p.toUpperCase();
    const whiteTaken = start[P] - current[P];
    for (let i = 0; i < whiteTaken; i++) blackCaptured.push(P);
  }
  
  return {
    whiteCaptured,
    blackCaptured,
    whiteAdvantage: Math.max(0, wScore - bScore),
    blackAdvantage: Math.max(0, bScore - wScore),
  };
}

export default function GamePage() {
  const isGameActive = useGameStore((s) => s.isGameActive);
  return (
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col">
      {isGameActive ? <GameView /> : <SetupView />}
    </div>
  );
}


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
    <div className="flex-1 flex items-center justify-center p-4 checkerboard-bg">
      <div className="w-full max-w-md surface-panel p-6 sm:p-8">
        
        <div className="flex justify-center mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <span className="text-[#81b64c]">♟</span> ChessMind
          </h1>
        </div>

        <div className="mb-6">
          {engineError ? (
            <div className="bg-red-900/30 text-red-400 text-sm rounded px-3 py-2 text-center font-medium">
              Engine Error: {engineError}
            </div>
          ) : !isEngineReady ? (
            <div className="bg-zinc-800 text-zinc-400 text-sm rounded px-3 py-2 text-center flex items-center justify-center gap-2 font-medium">
              <div className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
              Loading Engine...
            </div>
          ) : null}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-zinc-400 mb-2">I want to play as</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedColor("white")}
              className={`flex-1 py-3 rounded font-bold transition-colors border-2
                ${selectedColor === "white"
                  ? "bg-white text-black border-white"
                  : "bg-[#3c3934] text-zinc-300 border-transparent hover:bg-[#4b4842]"
                }`}
            >
              White
            </button>
            <button
              onClick={() => setSelectedColor("black")}
              className={`flex-1 py-3 rounded font-bold transition-colors border-2
                ${selectedColor === "black"
                  ? "bg-[#1f1e1b] text-white border-zinc-600"
                  : "bg-[#3c3934] text-zinc-300 border-transparent hover:bg-[#4b4842]"
                }`}
            >
              Black
            </button>
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-bold text-zinc-400 mb-2">Opponent</label>
          <div className="bg-[#1f1e1b] p-4 rounded border border-white/5">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-white">{selectedBot.name}</span>
              <span className="text-sm text-[#81b64c] font-bold">{selectedBot.elo} Elo</span>
            </div>
            <p className="text-xs text-zinc-500 mb-4">{selectedBot.description}</p>
            <input
              type="range"
              min={0}
              max={BOT_LEVELS.length - 1}
              value={selectedBotIndex}
              onChange={(e) => setSelectedBotIndex(parseInt(e.target.value))}
              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#81b64c]"
            />
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={!isEngineReady}
          className="w-full py-4 text-xl action-button flex justify-center items-center"
        >
          Play
        </button>
      </div>
    </div>
  );
}


function GameView() {
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
  const currentHint = useGameStore((s) => s.currentHint);

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

  const displayFen = viewingMoveIndex === -1 ? fen : getViewingFen();
  const isViewingHistory = viewingMoveIndex !== -1;
  const canInteract = !isGameOver && isPlayerTurn && !isBotThinking && !isViewingHistory && !isAnalyzing;

  const lastMove = useMemo((): [string, string] | null => {
    const relevantIndex = viewingMoveIndex === -1 ? moves.length - 1 : viewingMoveIndex;
    const move = moves[relevantIndex];
    if (!move) return null;
    return [move.uci.substring(0, 2), move.uci.substring(2, 4)];
  }, [moves, viewingMoveIndex]);

  const currentAnalysis = useMemo(() => {
    const relevantIndex = viewingMoveIndex === -1 ? moves.length - 1 : viewingMoveIndex;
    return moves[relevantIndex] || null;
  }, [moves, viewingMoveIndex]);

  const latestEval = useMemo(() => {
    if (evalHistory.length === 0) return { cp: 0, mate: null, winProb: 50 };
    const latest = evalHistory[evalHistory.length - 1];
    return {
      cp: latest.evaluation,
      mate: null as number | null,
      winProb: latest.winProbability,
    };
  }, [evalHistory]);

  const material = useMemo(() => getMaterialState(displayFen), [displayFen]);
  const isPlayerWhite = playerColor === "white";

  const topPlayerName = isPlayerWhite ? botLevel.name : "You";
  const bottomPlayerName = isPlayerWhite ? "You" : botLevel.name;
  
  const topCaptured = isPlayerWhite ? material.blackCaptured : material.whiteCaptured;
  const bottomCaptured = isPlayerWhite ? material.whiteCaptured : material.blackCaptured;
  
  const topAdvantage = isPlayerWhite ? material.blackAdvantage : material.whiteAdvantage;
  const bottomAdvantage = isPlayerWhite ? material.whiteAdvantage : material.blackAdvantage;

  const handleMove = useCallback((from: string, to: string, promotion?: string) => {
    makePlayerMove(from, to, promotion);
  }, [makePlayerMove]);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* ── Top Bar ── */}
      <div className="bg-[#262421] px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-20 border-b border-[#1f1e1b]">
        <span className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-[#81b64c]">♟</span> ChessMind
        </span>
        <div className="flex items-center gap-3">
          {(isBotThinking || isAnalyzing) && (
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
              <div className="w-3 h-3 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
              {isBotThinking ? "Bot is thinking..." : "Analyzing..."}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10 p-2 lg:p-6 gap-4 lg:gap-6 justify-center">
        
        <div className="shrink-0 flex flex-row items-start justify-center relative z-20 w-full lg:w-auto lg:overflow-y-auto lg:pb-8">
          
          <div className="hidden lg:flex shrink-0 mr-4 py-[28px]">
            <EvaluationBar
              centipawns={latestEval.cp}
              mate={latestEval.mate}
              winProbability={latestEval.winProb}
              height={undefined} 
              width={24}
              flipped={playerColor === "black"}
              isAnalyzing={isAnalyzing}
            />
          </div>

          <div className="flex flex-col w-full max-w-[480px] lg:max-w-[min(480px,calc(100vh-220px))]">
            
            <div className="flex justify-between items-end mb-1 px-1 h-7">
              <div className="flex items-center gap-2">
                <div className="bg-[#1f1e1b] rounded text-xs px-1.5 py-0.5 font-bold text-zinc-400">Bot</div>
                <span className="text-sm font-bold text-white truncate max-w-[120px] lg:max-w-full">{topPlayerName}</span>
                <span className="text-sm text-zinc-500 font-medium">({botLevel.elo})</span>
              </div>
            </div>
            
   
            <div className="flex items-center px-1 mb-2 h-5">
              <div className="flex text-lg leading-none tracking-tight text-zinc-400">
                {topCaptured.map((p, i) => <span key={i}>{PIECE_SYMBOLS[p]}</span>)}
              </div>
              {topAdvantage > 0 && (
                <span className="ml-2 text-xs font-bold text-zinc-400">+{topAdvantage}</span>
              )}
            </div>

            <div className="lg:hidden mb-2">
               <EvaluationBarHorizontal
                  centipawns={latestEval.cp}
                  mate={latestEval.mate}
                  winProbability={latestEval.winProb}
                  height={8}
                  isAnalyzing={isAnalyzing}
                />
            </div>

           
            <div className="rounded overflow-hidden w-full">
              <ChessBoard
                fen={displayFen}
                orientation={playerColor}
                interactive={canInteract}
                onMove={handleMove}
                getLegalMoves={getLegalMovesForSquare}
                lastMove={lastMove}
              />
            </div>

            
            <div className="flex items-center px-1 mt-2 h-5">
              <div className="flex text-lg leading-none tracking-tight text-zinc-400">
                {bottomCaptured.map((p, i) => <span key={i}>{PIECE_SYMBOLS[p]}</span>)}
              </div>
              {bottomAdvantage > 0 && (
                <span className="ml-2 text-xs font-bold text-zinc-400">+{bottomAdvantage}</span>
              )}
            </div>

           
            <div className="flex justify-between items-start mt-1 px-1 h-7">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{bottomPlayerName}</span>
              </div>
              <span className="text-xs font-bold text-[#81b64c]">
                {isPlayerTurn && !isGameOver && !isAnalyzing && !isViewingHistory ? "Your Turn" : ""}
              </span>
            </div>

            <div className="flex items-center justify-center gap-1 mt-2">
              <NavButton onClick={goToStart} label="⏮" />
              <NavButton onClick={goBack} label="◀" />
              <NavButton onClick={goForward} label="▶" />
              <NavButton onClick={goToEnd} label="⏭" />
              <div className="w-px h-6 bg-white/10 mx-2" />
              {!isGameOver && <NavButton onClick={resign} label="🏳️" />}
            </div>
          </div>
        </div>

    
        <div className="flex-1 overflow-y-auto w-full lg:max-w-[400px] scroll-smooth z-10 flex flex-col gap-4 pb-10">
          
      
          {isPlayerTurn && !isGameOver && !isAnalyzing && (
            <div className="surface-panel p-4 shrink-0">
              {currentHint ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#81b64c] uppercase">Coach Hint</span>
                  </div>
                  {currentHint.isLoading ? (
                    <div className="text-sm text-zinc-400 font-medium">Analyzing position...</div>
                  ) : (
                    <p className="text-sm text-zinc-300 font-medium leading-relaxed">
                      {currentHint.explanation}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  onClick={generateHint}
                  className="w-full py-2 rounded font-bold surface-button"
                >
                  💡 Show Hint
                </button>
              )}
            </div>
          )}

      
          <div className="surface-panel overflow-hidden flex flex-col max-h-[250px] shrink-0">
            <div className="bg-[#1f1e1b] px-3 py-2 border-b border-[#312e2b]">
              <span className="text-xs font-bold text-zinc-400 uppercase">Moves</span>
            </div>
            <MoveList
              moves={moves}
              viewingIndex={viewingMoveIndex}
              onMoveClick={goToMove}
              className="flex-1"
            />
          </div>

          <div className="surface-panel overflow-hidden flex-1 flex flex-col">
            <div className="bg-[#1f1e1b] px-3 py-2 border-b border-[#312e2b]">
              <span className="text-xs font-bold text-zinc-400 uppercase">Analysis</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AnalysisPanel
                analysis={currentAnalysis?.analysis || null}
                moveSan={currentAnalysis?.san || ""}
                isAnalyzing={currentAnalysis?.isAnalyzing || false}
              />
            </div>
          </div>

        </div>
      </div>

      {isGameOver && result && <GameOverOverlay result={result} onNewGame={reset} />}
    </div>
  );
}


function NavButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded surface-button text-lg flex items-center justify-center shrink-0"
    >
      {label}
    </button>
  );
}


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
    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const isWin = result.winner === playerColor;
  const isDraw = result.winner === "draw";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="surface-panel p-8 max-w-sm w-full text-center border border-white/10 shadow-2xl">
        <div className="text-5xl mb-4">
          {isDraw ? "🤝" : isWin ? "🏆" : "😔"}
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {isDraw ? "Draw" : isWin ? "You Win!" : "You Lose"}
        </h2>
        <p className="text-sm font-medium text-zinc-400 mb-6">{result.description}</p>
        <div className="space-y-3">
          <button
            onClick={onNewGame}
            className="w-full py-3 action-button text-lg"
          >
            Play Again
          </button>
          <button
            onClick={() => setVisible(false)}
            className="w-full py-3 surface-button"
          >
            Review Board
          </button>
        </div>
      </div>
    </div>
  );
}