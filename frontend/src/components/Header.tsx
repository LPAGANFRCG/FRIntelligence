'use client';

import React from 'react';
import { HardHat, Layers, ShieldCheck, Database, Sliders, ExternalLink, Activity } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md px-4 flex items-center justify-between z-30 shrink-0">
      {/* Brand & Project Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-zinc-950 font-black shadow-lg shadow-amber-500/20">
            <HardHat className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1">
                TRUNK<span className="text-amber-400">RAG</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                  AEC PRO
                </span>
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5">
              <span>PROJECT:</span>
              <span className="text-zinc-200 font-bold">FRCG-Tools-AG / Hospital Trauma</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle: System Status Badges */}
      <div className="hidden md:flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[11px]">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Vertex RAG Corpus <strong>#255759598760230912</strong></span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 font-mono text-[11px]">
          <Database className="h-3 w-3 text-cyan-400" />
          <span>944 Indexed Sheets (PDF & Vector CAD)</span>
        </div>
      </div>

      {/* Right: Actions & Tools */}
      <div className="flex items-center gap-2 text-xs">
        <a
          href="https://console.cloud.google.com/vertex-ai?project=frcg-antigravity"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
        >
          <span>Vertex AI Console</span>
          <ExternalLink className="h-3 w-3 text-zinc-500" />
        </a>

        <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-amber-400" title="Active Account: yamilx999@gmail.com">
          AG
        </div>
      </div>
    </header>
  );
};
