// ============================================================
// ChessMind Coach — Evaluation Bar Component
// ============================================================
//
// The vertical bar on the side of the chess board that shows
// who is winning. When White is better, the white portion
// grows. When Black is better, the black portion grows.
//
// Features:
//   - Smooth animation when evaluation changes
//   - Displays numerical evaluation (centipawns or mate)
//   - Win probability percentage overlay
//   - Color-coded for intuitive understanding
//   - Handles mate scores with special display
//
// The bar is oriented vertically:
//   TOP    = Black's side (black fills from top)
//   BOTTOM = White's side (white fills from bottom)
//
// ============================================================

"use client";

import React, { useMemo } from "react";
import {
  formatEvaluation,
  centipawnsToWinProbability,
} from "@/engine/uci-parser";


// ============================================================
// PROPS
// ============================================================

interface EvaluationBarProps {
  /** Evaluation in centipawns from White's perspective.
   *  Positive = White is better, Negative = Black is better.
   *  null if using mate score instead. */
  centipawns: number | null;

  /** Mate-in-N from White's perspective.
   *  Positive = White can force mate, Negative = Black can force mate.
   *  null if no forced mate. */
  mate: number | null;

  /** Win probability for White (0-100). If provided, shown as text.
   *  If not provided, calculated from centipawns. */
  winProbability?: number;

  /** Height of the bar in pixels. Default: 400 */
  height?: number;

  /** Width of the bar in pixels. Default: 32 */
  width?: number;

  /** Whether the board is flipped (Black on bottom) */
  flipped?: boolean;

  /** Whether the engine is currently analyzing */
  isAnalyzing?: boolean;

  /** Optional additional CSS classes */
  className?: string;
}


// ============================================================
// COMPONENT
// ============================================================

export default function EvaluationBar({
  centipawns,
  mate,
  winProbability,
  height = 400,
  width = 32,
  flipped = false,
  isAnalyzing = false,
  className = "",
}: EvaluationBarProps) {
  // ── Calculate the white portion percentage ──
  // This determines how much of the bar is white (from bottom)
  const whitePercentage = useMemo(() => {
    // Mate scores: show extreme values
    if (mate !== null && mate !== undefined) {
      if (mate > 0) {
        // White can force mate — almost full white
        return 95;
      } else {
        // Black can force mate — almost full black
        return 5;
      }
    }

    // Use provided win probability or calculate from centipawns
    if (winProbability !== undefined) {
      return Math.max(2, Math.min(98, winProbability));
    }

    if (centipawns !== null && centipawns !== undefined) {
      const winProb = centipawnsToWinProbability(centipawns);
      return Math.max(2, Math.min(98, winProb));
    }

    // Default: equal position
    return 50;
  }, [centipawns, mate, winProbability]);

  // ── Format the evaluation text ──
  const evalText = useMemo(() => {
    return formatEvaluation(centipawns, mate);
  }, [centipawns, mate]);

  // ── Determine which side's eval to show at the wider end ──
  const showWhiteEval = whitePercentage >= 50;

  // ── If board is flipped, we need to flip the bar too ──
  const displayPercentage = flipped ? 100 - whitePercentage : whitePercentage;

  return (
    <div
      className={`
        relative flex flex-col overflow-hidden rounded-sm
        ${isAnalyzing ? "animate-pulse-glow" : ""}
        ${className}
      `}
      style={{ height: `${height}px`, width: `${width}px` }}
      title={`Evaluation: ${evalText}`}
    >
      {/* ── Black portion (top) ── */}
      <div
        className="bg-zinc-800 eval-bar-transition relative"
        style={{ height: `${100 - displayPercentage}%` }}
      >
        {/* Show eval text on black's side if Black is better */}
        {!showWhiteEval && (
          <div className="absolute bottom-1 left-0 right-0 flex justify-center">
            <span className="text-white text-xs font-bold px-0.5">
              {evalText}
            </span>
          </div>
        )}
      </div>

      {/* ── Divider line ── */}
      <div className="h-px bg-zinc-500 w-full shrink-0" />

      {/* ── White portion (bottom) ── */}
      <div
        className="bg-zinc-100 eval-bar-transition relative grow"
        style={{ height: `${displayPercentage}%` }}
      >
        {/* Show eval text on white's side if White is better */}
        {showWhiteEval && (
          <div className="absolute top-1 left-0 right-0 flex justify-center">
            <span className="text-zinc-800 text-xs font-bold px-0.5">
              {evalText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================
// HORIZONTAL EVALUATION BAR (for mobile / compact layouts)
// ============================================================

export function EvaluationBarHorizontal({
  centipawns,
  mate,
  winProbability,
  height = 24,
  isAnalyzing = false,
  className = "",
}: Omit<EvaluationBarProps, "width" | "flipped"> & { height?: number }) {
  const whitePercentage = useMemo(() => {
    if (mate !== null && mate !== undefined) {
      return mate > 0 ? 95 : 5;
    }
    if (winProbability !== undefined) {
      return Math.max(2, Math.min(98, winProbability));
    }
    if (centipawns !== null && centipawns !== undefined) {
      return Math.max(2, Math.min(98, centipawnsToWinProbability(centipawns)));
    }
    return 50;
  }, [centipawns, mate, winProbability]);

  const evalText = formatEvaluation(centipawns, mate);

  return (
    <div
      className={`
        relative flex overflow-hidden rounded-sm w-full
        ${isAnalyzing ? "animate-pulse-glow" : ""}
        ${className}
      `}
      style={{ height: `${height}px` }}
      title={`Evaluation: ${evalText}`}
    >
      {/* White portion (left) */}
      <div
        className="bg-zinc-100 eval-bar-transition relative"
        style={{ width: `${whitePercentage}%` }}
      >
        {whitePercentage >= 50 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-zinc-800 text-xs font-bold">
              {evalText}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px bg-zinc-500 shrink-0" />

      {/* Black portion (right) */}
      <div
        className="bg-zinc-800 eval-bar-transition relative grow"
      >
        {whitePercentage < 50 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {evalText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================
// MINI EVAL DISPLAY (just the number, no bar)
// ============================================================

export function EvalDisplay({
  centipawns,
  mate,
  className = "",
}: {
  centipawns: number | null;
  mate: number | null;
  className?: string;
}) {
  const evalText = formatEvaluation(centipawns, mate);
  const isPositive = (centipawns !== null && centipawns > 0) ||
                     (mate !== null && mate > 0);
  const isNegative = (centipawns !== null && centipawns < 0) ||
                     (mate !== null && mate < 0);

  return (
    <span
      className={`
        font-mono font-bold text-sm
        ${isPositive ? "text-white" : ""}
        ${isNegative ? "text-zinc-400" : ""}
        ${!isPositive && !isNegative ? "text-zinc-300" : ""}
        ${className}
      `}
    >
      {evalText}
    </span>
  );
}