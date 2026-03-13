// ============================================================
// ChessMind Coach — Minimalist Move List
// ============================================================

"use client";

import React, { useEffect, useRef } from "react";
import { MoveRecord } from "@/lib/types";
import ClassificationBadge from "./ClassificationBadge";

interface MoveListProps {
  moves: MoveRecord[];
  viewingIndex: number;
  onMoveClick: (index: number) => void;
  className?: string;
}

export default function MoveList({
  moves,
  viewingIndex,
  onMoveClick,
  className = "",
}: MoveListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewingIndex === -1 && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [moves.length, viewingIndex]);

  const movePairs = groupMovesIntoPairs(moves);

  if (moves.length === 0) {
    return (
      <div className={`p-4 text-center text-zinc-500 flex flex-col items-center justify-center ${className}`}>
        <p className="text-sm font-bold">No moves yet</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`overflow-y-auto ${className}`}>
      {movePairs.map((pair, pairIndex) => (
        <div 
          key={pairIndex} 
          className={`flex items-center text-sm ${pairIndex % 2 === 0 ? "bg-[#262421]" : "bg-[#2a2825]"}`}
        >
          {/* Move number (Standard flat style) */}
          <div className="w-10 py-1.5 px-2 text-xs font-bold text-zinc-500 text-right bg-[#1f1e1b] border-r border-white/5 shrink-0">
            {pair.moveNumber}.
          </div>

          <div className="flex-1 flex px-2 py-1 gap-2">
            {/* White's move */}
            {pair.white && (
              <MoveEntry
                move={pair.white.move}
                index={pair.white.index}
                isActive={isActiveMove(pair.white.index, viewingIndex, moves.length)}
                onClick={() => onMoveClick(pair.white!.index)}
              />
            )}

            {/* Black's move */}
            {pair.black && (
              <MoveEntry
                move={pair.black.move}
                index={pair.black.index}
                isActive={isActiveMove(pair.black.index, viewingIndex, moves.length)}
                onClick={() => onMoveClick(pair.black!.index)}
              />
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} className="h-1" />
    </div>
  );
}

function MoveEntry({
  move,
  index,
  isActive,
  onClick,
}: {
  move: MoveRecord;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-between px-2 py-1 rounded-sm
        transition-colors font-bold text-sm
        ${isActive
          ? "bg-[#4b4842] text-white"
          : "hover:bg-[#3c3934] text-zinc-300"
        }
      `}
    >
      <span>{move.san}</span>
      {move.isAnalyzing ? (
        <span className="text-zinc-500 animate-pulse text-xs">...</span>
      ) : move.analysis ? (
        <ClassificationBadge
          classification={move.analysis.classification}
          size="sm"
          animate={false}
          showLabel={false}
        />
      ) : null}
    </button>
  );
}

// ── Helpers ──
interface MovePair {
  moveNumber: number;
  white: { move: MoveRecord; index: number } | null;
  black: { move: MoveRecord; index: number } | null;
}

function groupMovesIntoPairs(moves: MoveRecord[]): MovePair[] {
  const pairs: MovePair[] = [];
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (move.color === "white") {
      pairs.push({ moveNumber: move.moveNumber, white: { move, index: i }, black: null });
    } else {
      if (pairs.length > 0 && pairs[pairs.length - 1].black === null) {
        pairs[pairs.length - 1].black = { move, index: i };
      } else {
        pairs.push({ moveNumber: move.moveNumber, white: null, black: { move, index: i } });
      }
    }
  }
  return pairs;
}

function isActiveMove(moveIndex: number, viewingIndex: number, totalMoves: number): boolean {
  if (viewingIndex === -1) return moveIndex === totalMoves - 1;
  return moveIndex === viewingIndex;
}