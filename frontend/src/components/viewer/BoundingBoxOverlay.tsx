'use client';

import React from 'react';
import { BoundingBox, CitationSource } from '@/types/construction-rag';
import { X, ZoomIn, Info, ShieldAlert } from 'lucide-react';

interface BoundingBoxOverlayProps {
  citation: CitationSource;
  onClose: () => void;
  onZoomToBox?: () => void;
}

export const BoundingBoxOverlay: React.FC<BoundingBoxOverlayProps> = ({
  citation,
  onClose,
  onZoomToBox,
}) => {
  const [x, y, width, height] = citation.bounding_box;

  return (
    <div
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
      className="absolute pointer-events-auto border-2 border-amber-500 rounded-md bg-amber-500/15 shadow-2xl animate-pulse-border transition-all duration-300 z-30 group"
    >
      {/* Corner CAD Crosshair Ticks */}
      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-amber-400" />
      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-amber-400" />
      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-amber-400" />
      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-amber-400" />

      {/* Floating Citation Callout Pill */}
      <div className="absolute -top-10 left-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-950/95 border border-amber-500 text-amber-300 text-xs font-mono font-bold shadow-xl backdrop-blur-md whitespace-nowrap">
        <span>📍 {citation.sheet_number}</span>
        {citation.callout_tag && (
          <span className="text-zinc-400 font-normal">({citation.callout_tag})</span>
        )}
        {!citation.is_current_ifc && (
          <span className="px-1.5 py-0.2 rounded bg-red-500/30 text-red-300 text-[10px] font-bold">
            SUPERSEDED
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1 p-0.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Hover snippet preview on the box */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-0 mb-2 w-80 p-2.5 rounded-lg bg-zinc-950/95 border border-zinc-700 text-xs text-zinc-200 shadow-2xl pointer-events-none backdrop-blur-md">
        <div className="font-bold text-amber-400 text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1">
          <Info className="h-3 w-3" />
          Specified Technical Note:
        </div>
        <p className="font-mono text-[11px] line-clamp-3 text-zinc-300 leading-relaxed">
          "{citation.text_excerpt}"
        </p>
      </div>
    </div>
  );
};
