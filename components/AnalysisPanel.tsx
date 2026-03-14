//minimal panel

"use client";

import React, { useState } from "react";
import { AnalysisResult } from "@/lib/types";
import ClassificationBadge from "./ClassificationBadge";

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  moveSan: string;
  isAnalyzing: boolean;
  className?: string;
}

export default function AnalysisPanel({
  analysis,
  moveSan,
  isAnalyzing,
  className = "",
}: AnalysisPanelProps) {
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

  if (isAnalyzing) {
    return (
      <div className={`p-6 h-full flex flex-col items-center justify-center text-center ${className}`}>
        <div className="w-8 h-8 border-4 border-[#3c3934] border-t-[#81b64c] rounded-full animate-spin mb-4" />
        <p className="text-lg font-bold text-white">Analyzing {moveSan}</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className={`p-8 h-full flex flex-col items-center justify-center text-center ${className}`}>
        <span className="text-4xl opacity-30 mb-2">♟</span>
        <p className="text-sm font-bold text-zinc-500">Awaiting Move</p>
      </div>
    );
  }

  const sections = [
    { key: "descriptive", icon: "📝", title: "The Move", content: analysis.layers.descriptive },
    { key: "evaluative", icon: "📊", title: "Evaluation", content: analysis.layers.evaluative },
    { key: "consequential", icon: "🔮", title: "Continuation", content: analysis.layers.consequential },
    { key: "corrective", icon: "💡", title: "Alternatives", content: analysis.layers.corrective, hidden: !analysis.layers.corrective },
    { key: "strategic", icon: "🗺️", title: "Strategy", content: analysis.layers.strategic },
    { key: "coachingTip", icon: "🎯", title: "Advice", content: analysis.layers.coachingTip },
  ];

  return (
    <div className={`p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-3 pb-4 border-b border-white/5">
        <ClassificationBadge classification={analysis.classification} size="lg" showLabel={false} />
        <div className="flex flex-col">
          <span className="font-bold text-2xl text-white">{moveSan}</span>
          <span className="text-xs font-bold text-zinc-400 uppercase">
            {analysis.classification}
          </span>
        </div>
        {analysis.centipawnLoss > 0 && (
          <div className="ml-auto text-right">
            <span className="block text-lg font-bold text-red-400">-{analysis.centipawnLoss}</span>
            <span className="block text-[10px] uppercase font-bold text-zinc-500">CP Loss</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {sections.map((section) => {
          if (section.hidden) return null;
          const isExpanded = expandedSections.has(section.key);

          return (
            <div key={section.key} className="bg-[#1f1e1b] rounded border border-white/5">
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#2a2825] transition-colors rounded"
              >
                <span className="text-sm">{section.icon}</span>
                <span className="text-xs font-bold text-zinc-300 uppercase grow">{section.title}</span>
                <span className="text-zinc-500 text-xs font-bold">{isExpanded ? "−" : "+"}</span>
              </button>
              
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-white/5 mt-1">
                  <p className="text-sm text-zinc-300 font-medium whitespace-pre-line">
                    {section.content}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-600 pt-2 mt-4">
        <span>Depth: {analysis.evalAfter.depth} • Nodes: {(analysis.evalAfter.nodes / 1000).toFixed(0)}k</span>
        <span>{analysis.analysisTimeMs.toFixed(0)}ms</span>
      </div>
    </div>
  );
}