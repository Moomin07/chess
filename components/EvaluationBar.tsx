//minimal evalualtion bar
"use client";
import React from "react";

interface EvalBarProps {
  centipawns: number | null;
  mate: number | null;
  winProbability: number;
  height?: number;
  width?: number;
  flipped?: boolean;
  isAnalyzing?: boolean;
}

export default function EvaluationBar({
  centipawns,
  mate,
  winProbability,
  height = 560,
  width = 24,
  flipped = false,
  isAnalyzing = false,
}: EvalBarProps) {
  let fillPercentage = 50;
  let evalText = "0.0";
  let isWhiteAdvantage = true;

  if (mate !== null) {
    fillPercentage = mate > 0 ? 100 : 0;
    evalText = `M${Math.abs(mate)}`;
    isWhiteAdvantage = mate > 0;
  } else if (centipawns !== null) {
    const cp = Math.max(-1000, Math.min(1000, centipawns));
    fillPercentage = 50 + (cp / 20); 
    const evalValue = cp / 100;
    evalText = Math.abs(evalValue).toFixed(1);
    isWhiteAdvantage = cp >= 0;
  }

  const whiteHeight = `${fillPercentage}%`;
  const blackHeight = `${100 - fillPercentage}%`;

  return (
    <div
      style={{ height: height ? `${height}px` : '100%', width: `${width}px` }}
      className={`
        relative overflow-hidden flex flex-col bg-[#312e2b] rounded-sm
        ${flipped ? "flex-col-reverse" : ""}
        ${isAnalyzing ? "opacity-80" : "opacity-100"}
      `}
    >
      {/* Black's section */}
      <div
        className="w-full bg-[#403d39] transition-all duration-300 flex items-start justify-center pt-1"
        style={{ height: blackHeight }}
      >
        {!isWhiteAdvantage && (
          <span className="text-[10px] font-bold text-zinc-300 select-none">
            {evalText}
          </span>
        )}
      </div>

      {/* White's section */}
      <div
        className="w-full bg-white transition-all duration-300 flex items-end justify-center pb-1"
        style={{ height: whiteHeight }}
      >
        {isWhiteAdvantage && (
          <span className="text-[10px] font-bold text-black select-none">
            {evalText}
          </span>
        )}
      </div>
      
      {/* Center notch */}
      <div className="absolute top-1/2 left-0 w-full h-px bg-red-500/50 z-20" />
    </div>
  );
}

// ── Horizontal Version for Mobile ──
export function EvaluationBarHorizontal({
  centipawns,
  mate,
  winProbability,
  height = 8,
  isAnalyzing = false,
}: EvalBarProps) {
  let fillPercentage = 50;

  if (mate !== null) {
    fillPercentage = mate > 0 ? 100 : 0;
  } else if (centipawns !== null) {
    const cp = Math.max(-1000, Math.min(1000, centipawns));
    fillPercentage = 50 + (cp / 20);
  }

  return (
    <div
      style={{ height: `${height}px` }}
      className={`
        w-full relative overflow-hidden flex bg-[#403d39] rounded-sm
        ${isAnalyzing ? "opacity-80" : "opacity-100"}
      `}
    >
      <div
        className="h-full bg-white transition-all duration-300"
        style={{ width: `${fillPercentage}%` }}
      />
      <div className="absolute left-1/2 top-0 h-full w-px bg-red-500/50 z-20" />
    </div>
  );
}