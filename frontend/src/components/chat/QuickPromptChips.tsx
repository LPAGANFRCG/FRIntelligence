'use client';

import React from 'react';
import { Sparkles, ArrowUpRight } from 'lucide-react';

interface QuickPromptChipsProps {
  suggestions: string[];
  onSelect: (prompt: string) => void;
}

export const QuickPromptChips: React.FC<QuickPromptChipsProps> = ({
  suggestions,
  onSelect,
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 p-3 bg-zinc-950/70 border-t border-zinc-800/80">
      <div className="w-full flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 mb-1">
        <Sparkles className="h-3 w-3 text-amber-400" />
        <span>SUGGESTED TECHNICAL FOLLOW-UPS:</span>
      </div>
      {suggestions.map((s, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(s)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/90 text-zinc-300 hover:text-white hover:bg-zinc-700/90 border border-zinc-700/60 transition-all text-left group"
        >
          <span>{s}</span>
          <ArrowUpRight className="h-3 w-3 text-zinc-500 group-hover:text-amber-400 transition-colors shrink-0" />
        </button>
      ))}
    </div>
  );
};
