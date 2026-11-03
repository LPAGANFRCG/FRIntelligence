'use client';

import React from 'react';
import { X, GitCompare, ArrowRight, ShieldCheck, AlertCircle, FileText } from 'lucide-react';

interface RevisionCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RevisionCompareModal: React.FC<RevisionCompareModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-6xl rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl flex flex-col h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <GitCompare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Revision Delta Compare: Reflected Ceiling Plan & HVAC Array
              </h2>
              <p className="text-xs text-zinc-400">Comparing Bid Set (Rev 0) vs Addendum #03 (Issued for Construction)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Split View Content */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800 overflow-hidden">
          {/* Left: Original Rev 0 (Superseded) */}
          <div className="flex flex-col h-full bg-zinc-950/50 p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <div>
                <span className="font-mono text-xs font-bold text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  SHEET A-1.2A • REV 0 (BID SET)
                </span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">Date: 2026-08-15 • Preliminary</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                SUPERSEDED
              </span>
            </div>

            {/* Drawing Preview Stub */}
            <div className="flex-1 rounded-xl bg-zinc-900 border border-red-500/30 p-4 font-mono text-xs text-zinc-300 space-y-3 relative overflow-hidden">
              <div className="absolute top-3 right-3 px-2 py-1 bg-red-950/80 border border-red-600/40 text-[10px] text-red-300 rounded font-bold">
                REV 0 NOTE
              </div>
              <div className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Ceiling Diffuser Legend:</div>
              <p className="text-zinc-300 leading-relaxed border-l-2 border-red-500/50 pl-3">
                "Four (4) laminar diffusers shown per Operating Room. No supply airflow CFM, HEPA efficiency ratings, or engineering schedules indicated in Bid Set RFP."
              </p>
              
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/40 text-red-200 text-xs mt-4">
                ⚠️ <strong>Field Issue:</strong> Mechanical contractor pricing based on Rev 0 excluded room-side test ports and AHU HEPA filters, leading to potential $48,000 change order.
              </div>
            </div>
          </div>

          {/* Right: Addendum #3 (Current IFC) */}
          <div className="flex flex-col h-full bg-zinc-950/50 p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  ADDENDUM NO. 3 (RFI-372 / SPEC 23 74 00)
                </span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">Date: 2026-10-29 • Approved IFC</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                CURRENT GOVERNING SET
              </span>
            </div>

            {/* Drawing Preview Stub */}
            <div className="flex-1 rounded-xl bg-zinc-900 border border-emerald-500/30 p-4 font-mono text-xs text-zinc-300 space-y-3 relative overflow-hidden">
              <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-950/80 border border-emerald-600/40 text-[10px] text-emerald-300 rounded font-bold">
                AMENDED SPEC
              </div>
              <div className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Official Resolution:</div>
              <p className="text-zinc-200 leading-relaxed border-l-2 border-emerald-500/80 pl-3">
                "Confirmed: Non-aspirating unidirectional diffusers compliant with ASHRAE 170. Four (4) 24"x48" ceiling-mounted terminal HEPA housings (room-side replaceable with test ports), not less than 99.97% efficiency at 0.3 micron."
              </p>

              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-200 text-xs mt-4">
                ✅ <strong>Resolution:</strong> Design-Builder shall coordinate ceiling plenum boom base mounts and include terminal test housings in Lump Sum.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800 bg-zinc-950/80 shrink-0 text-xs">
          <span className="text-zinc-400">
            Governing contract clause: General Conditions §3.2 (Later issued addenda govern over prior bid sets).
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
