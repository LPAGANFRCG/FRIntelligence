'use client';

import React, { useState } from 'react';
import { FileText, Layers, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
import { CitationSource } from '@/types/construction-rag';
import { cn } from '@/lib/utils';

interface SourceCitationBadgeProps {
  citation: CitationSource;
  isActive?: boolean;
  onSelect: (citation: CitationSource) => void;
}

export const SourceCitationBadge: React.FC<SourceCitationBadgeProps> = ({
  citation,
  isActive = false,
  onSelect,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const isCurrent = citation.is_current_ifc;

  return (
    <span className="relative inline-block my-0.5 mx-1 align-middle">
      <button
        onClick={() => onSelect(citation)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all duration-150 shadow-sm border",
          isActive
            ? "bg-amber-500 text-zinc-950 border-amber-400 font-bold ring-2 ring-amber-400/40 shadow-amber-500/30 scale-105"
            : isCurrent
            ? "bg-zinc-800/90 text-cyan-300 border-cyan-500/30 hover:bg-zinc-700 hover:border-cyan-400 hover:text-cyan-200"
            : "bg-amber-950/40 text-amber-300 border-amber-500/40 hover:bg-amber-900/60 hover:text-amber-200"
        )}
      >
        <Layers className="h-3 w-3 shrink-0 text-amber-400" />
        <span className="font-semibold">{citation.sheet_number}</span>
        {citation.callout_tag && (
          <span className="opacity-80 text-[10px] hidden sm:inline">
            • {citation.callout_tag}
          </span>
        )}
        {isCurrent ? (
          <span title="Issued for Construction">
            <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
          </span>
        ) : (
          <span title="Superseded Sheet">
            <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
          </span>
        )}
      </button>

      {/* Hover preview tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-zinc-900/95 border border-zinc-700/80 rounded-lg shadow-2xl backdrop-blur-md text-left pointer-events-none animate-fade-in">
          <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-zinc-800 pb-1">
            <span className="font-mono text-xs font-bold text-white flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-cyan-400" />
              {citation.sheet_number}
            </span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                isCurrent
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-red-500/20 text-red-300 border border-red-500/30"
              )}
            >
              {isCurrent ? "Current IFC" : "Superseded"}
            </span>
          </div>

          <p className="text-xs font-medium text-zinc-200 line-clamp-2">
            {citation.sheet_title}
          </p>

          <div className="mt-2 text-[11px] text-zinc-400 space-y-0.5">
            <div><span className="text-zinc-500">Discipline:</span> {citation.discipline}</div>
            <div><span className="text-zinc-500">Revision:</span> {citation.revision} ({citation.revision_date})</div>
            {citation.spec_section && (
              <div><span className="text-zinc-500">Spec:</span> {citation.spec_section}</div>
            )}
          </div>

          <div className="mt-2 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-cyan-400 font-mono">
            <span>Click to inspect drawing</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </div>
        </div>
      )}
    </span>
  );
};
