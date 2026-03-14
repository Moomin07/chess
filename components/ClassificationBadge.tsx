

"use client";

import React from "react";
import {
  MoveClassification,
  CLASSIFICATION_DISPLAY,
} from "@/lib/types";




interface ClassificationBadgeProps {
  classification: MoveClassification;

  size?: "sm" | "lg";

  animate?: boolean;

  showLabel?: boolean;

  className?: string;
}




export default function ClassificationBadge({
  classification,
  size = "sm",
  animate = true,
  showLabel = false,
  className = "",
}: ClassificationBadgeProps) {
  const display = CLASSIFICATION_DISPLAY[classification];

  if (!display) {
    return null; 
  }

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
      <span className={styles.symbol}>
        {display.symbol}
      </span>

      {(showLabel || size === "lg") && (
        <span className={styles.label}>
          {display.label}
        </span>
      )}
    </span>
  );
}


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


export function ClassificationSummary({
  counts,
  className = "",
}: {
  counts: Record<MoveClassification, number>;
  className?: string;
}) {
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