// ============================================================
// ChessMind Coach — Move List Component
// ============================================================
//
// Displays the game's move history in standard chess notation
// with classification badges next to each move. Clicking a
// move navigates to that position on the board.
//
// Layout:
//   1. e4  ✓  e5  ✓
//   2. Nf3 ✓  Nc6 ○
//   3. Bb5 !  a6  ?!
//
// Features:
//   - Color-coded badges for each move
//   - Click to navigate to any position
//   - Auto-scrolls to the latest move WITHOUT scrolling the whole page
//   - Shows "analyzing..." indicator
//   - Highlights the currently viewed move
//
// ============================================================

"use client";

import React, { useEffect, useRef } from "react";
import { MoveRecord } from "@/lib/types";
import ClassificationBadge from "./ClassificationBadge";


// ============================================================
// PROPS
// ============================================================

interface MoveListProps {
  /** Complete list of moves with their analysis */
  moves: MoveRecord[];

  /** Index of the currently viewed move (-1 = latest) */
  viewingIndex: number;

  /** Called when the user clicks on a move */
  onMoveClick: (index: number) => void;

  /** Optional additional CSS classes */
  className?: string;
}


// ============================================================
// COMPONENT
// ============================================================

export default function MoveList({
  moves,
  viewingIndex,
  onMoveClick,
  className = "",
}: MoveListProps) {
  // Ref for auto-scrolling to the latest move
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new moves are added
  // FIXED: Now we only scroll the internal container, not the whole page window
  useEffect(() => {
    if (viewingIndex === -1 && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [moves.length, viewingIndex]);

  // ── Group moves into pairs (white + black) ──
  const movePairs = groupMovesIntoPairs(moves);

  if (moves.length === 0) {
    return (
      <div className={`p-4 text-center text-zinc-500 ${className}`}>
        <p className="text-sm">No moves yet</p>
        <p className="text-xs mt-1">Make your first move to start the game</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`
        overflow-y-auto p-2 space-y-0.5 scroll-smooth
        ${className}
      `}
    >
      {movePairs.map((pair, pairIndex) => (
        <div
          key={pairIndex}
          className="flex items-center text-sm"
        >
          {/* Move number */}
          <span className="w-8 text-zinc-500 text-xs text-right mr-2 shrink-0">
            {pair.moveNumber}.
          </span>

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
      ))}

      {/* Auto-scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}


// ============================================================
// MOVE ENTRY — Individual move in the list
// ============================================================

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
        flex items-center gap-1 px-2 py-1 rounded min-w-20
        transition-colors duration-150 text-left
        ${isActive
          ? "bg-blue-500/30 text-white"
          : "hover:bg-zinc-700/50 text-zinc-300"
        }
      `}
    >
      {/* Move notation */}
      <span className="font-mono text-sm">
        {move.san}
      </span>

      {/* Classification badge or analyzing indicator */}
      {move.isAnalyzing ? (
        <span className="text-xs text-zinc-500 animate-pulse-glow">
          ...
        </span>
      ) : move.analysis ? (
        <ClassificationBadge
          classification={move.analysis.classification}
          size="sm"
          animate={false}
        />
      ) : null}
    </button>
  );
}


// ============================================================
// HELPERS
// ============================================================

interface MovePair {
  moveNumber: number;
  white: { move: MoveRecord; index: number } | null;
  black: { move: MoveRecord; index: number } | null;
}

/**
 * Group sequential moves into pairs (white + black per row).
 */
function groupMovesIntoPairs(moves: MoveRecord[]): MovePair[] {
  const pairs: MovePair[] = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];

    if (move.color === "white") {
      // Start a new pair
      pairs.push({
        moveNumber: move.moveNumber,
        white: { move, index: i },
        black: null,
      });
    } else {
      // Add to existing pair or create one
      if (pairs.length > 0 && pairs[pairs.length - 1].black === null) {
        pairs[pairs.length - 1].black = { move, index: i };
      } else {
        // Black move without a preceding white move (game started as black)
        pairs.push({
          moveNumber: move.moveNumber,
          white: null,
          black: { move, index: i },
        });
      }
    }
  }

  return pairs;
}

/**
 * Check if a move index is the currently active/viewed move.
 */
function isActiveMove(
  moveIndex: number,
  viewingIndex: number,
  totalMoves: number
): boolean {
  if (viewingIndex === -1) {
    // Viewing latest — last move is active
    return moveIndex === totalMoves - 1;
  }
  return moveIndex === viewingIndex;
}