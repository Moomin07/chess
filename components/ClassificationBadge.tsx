// ============================================================
// ChessMind Coach — Classification Badge Component
// ============================================================
//
// This component displays the colored badge next to each move
// in the move list. It shows the classification symbol and
// label for each move — Brilliant (!!), Blunder (??), etc.
//
// It comes in two sizes:
//   - "sm" (small): Just the symbol, used in the move list
//   - "lg" (large): Symbol + label, used in the analysis panel
//
// The badge animates in with a pop effect when it first appears.
//
// ============================================================

"use client";

import React from "react";
import {
  MoveClassification,
  CLASSIFICATION_DISPLAY,
} from "@/lib/types";


// ============================================================
// PROPS
// ============================================================

interface ClassificationBadgeProps {
  /** The move classification to display */
  classification: MoveClassification;

  /** Size variant: "sm" for move list, "lg" for analysis panel */
  size?: "sm" | "lg";

  /** Whether to animate the badge appearing */
  animate?: boolean;

  /** Whether to show the text label alongside the symbol */
  showLabel?: boolean;

  /** Optional additional CSS classes */
  className?: string;
}


// ============================================================
// COMPONENT
// ============================================================

export default function ClassificationBadge({
  classification,
  size = "sm",
  animate = true,
  showLabel = false,
  className = "",
}: ClassificationBadgeProps) {
  // Get display properties for this classification
  const display = CLASSIFICATION_DISPLAY[classification];

  if (!display) {
    return null; // Unknown classification — render nothing
  }

  // ── Size-dependent styles ──
  const sizeStyles = {
    sm: {
      container: "px-1.5 py-0.5 text-xs rounded",
      symbol: "text-xs font-bold",
      label: "text-xs ml-1",
    },
    lg: {
      container: "px-3 py-1.5 text-sm rounded-lg",
      symbol: "text-sm font-bold",
      label: "text-sm ml-1.5",
    },
  };

  const styles = sizeStyles[size];

  return (
    <span
      className={`
        inline-flex items-center
        ${styles.container}
        ${display.bgColor}
        ${display.color}
        ${animate ? "animate-badge-pop" : ""}
        ${className}
      `}
      title={display.description}
    >
      {/* Classification Symbol */}
      <span className={styles.symbol}>
        {display.symbol}
      </span>

      {/* Optional Text Label */}
      {(showLabel || size === "lg") && (
        <span className={styles.label}>
          {display.label}
        </span>
      )}
    </span>
  );
}


// ============================================================
// CLASSIFICATION ICON COMPONENT
// ============================================================
// A simpler version that shows just a colored dot with the
// symbol — used for very compact displays.
// ============================================================

export function ClassificationDot({
  classification,
  className = "",
}: {
  classification: MoveClassification;
  className?: string;
}) {
  const display = CLASSIFICATION_DISPLAY[classification];
  if (!display) return null;

  return (
    <span
      className={`
        inline-flex items-center justify-center
        w-5 h-5 rounded-full text-xs font-bold
        ${display.bgColor} ${display.color}
        ${className}
      `}
      title={`${display.label}: ${display.description}`}
    >
      {display.symbol}
    </span>
  );
}


// ============================================================
// CLASSIFICATION SUMMARY
// ============================================================
// Shows a summary of all classifications in a game.
// Used in the post-game review screen.
// ============================================================

export function ClassificationSummary({
  counts,
  className = "",
}: {
  counts: Record<MoveClassification, number>;
  className?: string;
}) {
  // Only show classifications that occurred at least once
  const displayOrder: MoveClassification[] = [
    MoveClassification.BRILLIANT,
    MoveClassification.GREAT,
    MoveClassification.BEST,
    MoveClassification.EXCELLENT,
    MoveClassification.GOOD,
    MoveClassification.BOOK,
    MoveClassification.INACCURACY,
    MoveClassification.MISTAKE,
    MoveClassification.BLUNDER,
    MoveClassification.MISS,
    MoveClassification.FORCED,
  ];

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {displayOrder.map((classification) => {
        const count = counts[classification];
        if (count === 0) return null;

        const display = CLASSIFICATION_DISPLAY[classification];

        return (
          <div
            key={classification}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded
              ${display.bgColor}
            `}
            title={display.description}
          >
            <span className={`text-xs font-bold ${display.color}`}>
              {display.symbol}
            </span>
            <span className={`text-xs ${display.color}`}>
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}