// ============================================================
// ChessMind Coach — Analysis Panel Component
// ============================================================
//
// This is the main coaching display — the panel that shows
// the 6-layer natural language analysis for each move.
//
// Layout:
//   ┌──────────────────────────────────────┐
//   │  [Badge] Brilliant!!                  │
//   │                                       │
//   │  📝 What This Move Does               │
//   │  Knight captures the bishop on d5...  │
//   │                                       │
//   │  📊 Evaluation                        │
//   │  This is the engine's top choice...   │
//   │                                       │
//   │  🔮 What Happens Next                 │
//   │  1...Nxd5 2.exd5 Qxd5 3.Nc3...      │
//   │                                       │
//   │  💡 What You Should Have Played       │
//   │  Instead of Bg5, play Nd5! which...   │
//   │                                       │
//   │  🗺️ Strategic Context                 │
//   │  We are in the Sicilian middlegame... │
//   │                                       │
//   │  🎯 Coaching Tip                      │
//   │  Before capturing, always check...    │
//   └──────────────────────────────────────┘
//
// ============================================================

"use client";

import React, { useState } from "react";
import { AnalysisResult, MoveClassification } from "@/lib/types";
import ClassificationBadge from "./ClassificationBadge";


// ============================================================
// PROPS
// ============================================================

interface AnalysisPanelProps {
  /** The complete analysis result for the current move */
  analysis: AnalysisResult | null;

  /** The move in SAN notation (e.g., "Nf3") */
  moveSan: string;

  /** Whether analysis is currently in progress */
  isAnalyzing: boolean;

  /** Optional additional CSS classes */
  className?: string;
}


// ============================================================
// COMPONENT
// ============================================================

export default function AnalysisPanel({
  analysis,
  moveSan,
  isAnalyzing,
  className = "",
}: AnalysisPanelProps) {
  // Track which sections are expanded/collapsed
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["descriptive", "evaluative", "coachingTip"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // ── Analyzing state ──
  if (isAnalyzing) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-sm text-zinc-300">Analyzing {moveSan}...</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Evaluating position and generating coaching feedback
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── No analysis available ──
  if (!analysis) {
    return (
      <div className={`p-4 text-center text-zinc-500 ${className}`}>
        <p className="text-sm">Select a move to see analysis</p>
      </div>
    );
  }

  // ── Full analysis display ──
  const sections = [
    {
      key: "descriptive",
      icon: "📝",
      title: "What This Move Does",
      content: analysis.layers.descriptive,
    },
    {
      key: "evaluative",
      icon: "📊",
      title: "Evaluation",
      content: analysis.layers.evaluative,
    },
    {
      key: "consequential",
      icon: "🔮",
      title: "What Happens Next",
      content: analysis.layers.consequential,
    },
    {
      key: "corrective",
      icon: "💡",
      title: "What You Should Have Played",
      content: analysis.layers.corrective,
      // Only show if there's corrective content
      hidden: !analysis.layers.corrective || analysis.layers.corrective.length === 0,
    },
    {
      key: "strategic",
      icon: "🗺️",
      title: "Strategic Context",
      content: analysis.layers.strategic,
    },
    {
      key: "coachingTip",
      icon: "🎯",
      title: "Coaching Tip",
      content: analysis.layers.coachingTip,
    },
  ];

  return (
    <div className={`p-3 space-y-3 ${className}`}>
      {/* ── Header: Classification badge + move name ── */}
      <div className="flex items-center gap-3 pb-2 border-b border-zinc-700/50">
        <ClassificationBadge
          classification={analysis.classification}
          size="lg"
          showLabel={true}
        />
        <span className="font-mono text-lg text-white font-bold">
          {moveSan}
        </span>
        {analysis.centipawnLoss > 0 && (
          <span className="text-xs text-zinc-400 ml-auto">
            -{analysis.centipawnLoss}cp
          </span>
        )}
      </div>

      {/* ── Analysis sections ── */}
      {sections.map((section) => {
        if (section.hidden) return null;

        const isExpanded = expandedSections.has(section.key);

        return (
          <div
            key={section.key}
            className="rounded-lg bg-zinc-800/50 overflow-hidden"
          >
            {/* Section header (clickable to expand/collapse) */}
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center gap-2 px-3 py-2 
                         hover:bg-zinc-700/30 transition-colors text-left"
            >
              <span className="text-base">{section.icon}</span>
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide grow">
                {section.title}
              </span>
              <span className="text-zinc-500 text-xs">
                {isExpanded ? "▼" : "▶"}
              </span>
            </button>

            {/* Section content */}
            {isExpanded && (
              <div className="px-3 pb-3">
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Analysis metadata ── */}
      <div className="flex items-center justify-between text-xs text-zinc-600 pt-1">
        <span>
          Depth: {analysis.evalAfter.depth} | 
          Nodes: {(analysis.evalAfter.nodes / 1000).toFixed(0)}k
        </span>
        <span>
          {analysis.analysisTimeMs.toFixed(0)}ms
        </span>
      </div>
    </div>
  );
}