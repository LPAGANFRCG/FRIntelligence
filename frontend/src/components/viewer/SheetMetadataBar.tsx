'use client';

import React from 'react';
import { Layers, ShieldCheck, AlertCircle, Copy, Check, ExternalLink, Calendar } from 'lucide-react';
import { CitationSource } from '@/types/construction-rag';
import { cn } from '@/lib/utils';

interface SheetMetadataBarProps {
  currentSheet?: CitationSource;
  currentPage: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}

export const SheetMetadataBar: React.FC<SheetMetadataBarProps> = ({
  currentSheet,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const [copiedGcs, setCopiedGcs] = React.useState(false);

  if (!currentSheet) {
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400">
        <span>No document selected. Select any citation badge in the chat to inspect.</span>
      </div>
    );
  }

  const isCurrent = currentSheet.is_current_ifc;

  const handleCopyGcs = () => {
    navigator.clipboard.writeText(currentSheet.gcs_uri);
    setCopiedGcs(true);
    setTimeout(() => setCopiedGcs(false), 2000);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-zinc-900/95 border-b border-zinc-800/80 backdrop-blur-md text-xs">
      {/* Left: Sheet info */}
      <div className="flex items-center gap-2.5 overflow-hidden">
        <span className="font-mono font-bold text-sm text-cyan-400 flex items-center gap-1.5 shrink-0">
          <Layers className="h-4 w-4 text-cyan-400" />
          {currentSheet.sheet_number}
        </span>

        <span className="text-zinc-600 hidden sm:inline">•</span>

        <span className="font-semibold text-zinc-200 truncate max-w-[280px] lg:max-w-[380px]" title={currentSheet.sheet_title}>
          {currentSheet.sheet_title}
        </span>

        <span
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold tracking-wide shrink-0",
            isCurrent
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"
              : "bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1"
          )}
        >
          {isCurrent ? (
            <>
              <ShieldCheck className="h-3 w-3" />
              <span>CURRENT IFC</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3" />
              <span>SUPERSEDED</span>
            </>
          )}
        </span>
      </div>

      {/* Right: Revision stamp & Page navigation */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
          <Calendar className="h-3 w-3 text-zinc-500" />
          <span>{currentSheet.revision} ({currentSheet.revision_date})</span>
        </div>

        {/* Page Selector */}
        <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800 font-mono text-xs">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="px-1 text-zinc-400 hover:text-white disabled:opacity-30"
          >
            ◀
          </button>
          <span className="text-zinc-200 px-1">
            {currentPage} / {totalPages || 1}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages || 1, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="px-1 text-zinc-400 hover:text-white disabled:opacity-30"
          >
            ▶
          </button>
        </div>

        {/* GCS Copy */}
        <button
          onClick={handleCopyGcs}
          className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title={`Copy Cloud Storage URI: ${currentSheet.gcs_uri}`}
        >
          {copiedGcs ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
};
