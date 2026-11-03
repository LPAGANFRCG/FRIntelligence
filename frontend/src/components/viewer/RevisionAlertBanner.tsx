'use client';

import React from 'react';
import { AlertTriangle, ArrowRight, GitCompare, ShieldAlert } from 'lucide-react';
import { RevisionConflictInfo } from '@/types/construction-rag';

interface RevisionAlertBannerProps {
  conflict: RevisionConflictInfo;
  onSwitchToCurrentIfc?: () => void;
  onOpenCompare?: () => void;
}

export const RevisionAlertBanner: React.FC<RevisionAlertBannerProps> = ({
  conflict,
  onSwitchToCurrentIfc,
  onOpenCompare,
}) => {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-amber-500/60 bg-gradient-to-r from-amber-950/80 via-zinc-900/90 to-amber-950/80 p-4 shadow-xl shadow-amber-950/30 backdrop-blur-md">
      {/* Decorative safety stripe accent */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5 sm:mt-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-amber-200 text-sm tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                REVISION CONFLICT SAFETY ALERT
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
                Superseded Sheet Cited
              </span>
            </div>
            <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
              Cited: <strong className="text-white font-mono">{conflict.cited_sheet} ({conflict.cited_revision})</strong>. 
              {conflict.superseded_notice}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {onOpenCompare && (
            <button
              onClick={onOpenCompare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 transition-colors shadow-sm"
              title="Compare side-by-side with original Rev 0"
            >
              <GitCompare className="h-3.5 w-3.5 text-amber-400" />
              Compare Diff
            </button>
          )}

          {onSwitchToCurrentIfc && (
            <button
              onClick={onSwitchToCurrentIfc}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors shadow-md shadow-amber-500/20"
            >
              <span>View Latest IFC</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
