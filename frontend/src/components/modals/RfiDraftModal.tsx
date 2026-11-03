'use client';

import React, { useState } from 'react';
import { X, Copy, Check, FileDown, Send, Building2, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { RfiDraft, ChatMessage } from '@/types/construction-rag';

interface RfiDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: ChatMessage;
}

export const RfiDraftModal: React.FC<RfiDraftModalProps> = ({
  isOpen,
  onClose,
  message,
}) => {
  const [copied, setCopied] = useState(false);
  
  // Auto-generate realistic RFI from the message content
  const [rfiData, setRfiData] = useState<RfiDraft>(() => {
    const references = message?.citations.map((c) => ({
      sheet_or_spec: c.sheet_number,
      description: `${c.sheet_title} (${c.revision})`,
    })) || [
      { sheet_or_spec: 'A-1.2A', description: 'Operating Room Equipment List (Rev 0)' },
      { sheet_or_spec: 'Addendum #3', description: 'Technical Clarifications Item 372' },
      { sheet_or_spec: 'Spec 23 74 00', description: 'HVAC Air Purification & HEPA Filtration' }
    ];

    return {
      project_name: 'Hospital Trauma Emergency Center Expansion',
      rfi_number: 'RFI-0084',
      subject: 'Operating Room HEPA Diffuser Sizing vs Ceiling Boom Structural Plenum Conflict',
      date_initiated: new Date().toISOString().split('T')[0],
      author: 'Principal Field Project Engineer (FRCG)',
      assigned_to: 'Architect of Record / Lead Mechanical Engineer (ASEM)',
      schedule_impact: true,
      cost_impact: true,
      question: `Per Reflected Ceiling Plan A-1.2A and Attachment F, four (4) 24"x48" laminar flow diffusers with terminal HEPA filtration (99.97% efficiency) are specified over the surgical table. However, drawing A-1.2A also indicates a ceiling-hung structural double boom utility system occupying the same plenum airspace above the sterile surgical zone. 
      
Please confirm:
1. Exact coordination dimensions between the HEPA laminar array and the structural boom support hung base.
2. Confirmation that room-side replaceable filter access ports remain accessible without dismounting boom arm tracks.`,
      suggested_solution: 'Relocate the utility boom hung base 18 inches south of surgical field centerline to maintain continuous laminar airflow array and unobstructed HEPA access per ASHRAE 170.',
      references: references,
    };
  });

  if (!isOpen) return null;

  const procoreFormattedText = `
================================================================================
REQUEST FOR INFORMATION (RFI) - PROCORE IMPORT READY
================================================================================
Project:        ${rfiData.project_name}
RFI Number:     ${rfiData.rfi_number}
Date:           ${rfiData.date_initiated}
Author:         ${rfiData.author}
Assigned To:    ${rfiData.assigned_to}
Schedule Impact: ${rfiData.schedule_impact ? 'YES (Potential 3-day critical path delay)' : 'NO'}
Cost Impact:     ${rfiData.cost_impact ? 'YES (Lump sum mechanical adjustment)' : 'NO'}

SUBJECT:
${rfiData.subject}

DRAWING & SPECIFICATION REFERENCES:
${rfiData.references.map((r, i) => `  [${i + 1}] ${r.sheet_or_spec} - ${r.description}`).join('\n')}

DESCRIPTION OF PROBLEM / INQUIRY:
${rfiData.question}

CONTRACTOR'S PROPOSED SOLUTION / RECOMMENDATION:
${rfiData.suggested_solution}
================================================================================
Generated via AEC Construction Intelligence Platform (FRCG-Tools-AG)
`.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(procoreFormattedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(rfiData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rfiData.rfi_number}_Draft.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl bg-zinc-900 border border-zinc-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Structured RFI Generator
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-zinc-800 text-amber-400 border border-zinc-700">
                  {rfiData.rfi_number}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Standard AIA G716 / Procore Import Format</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-zinc-200">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs">
            <div>
              <label className="text-zinc-500 font-medium">Project</label>
              <div className="font-semibold text-zinc-200">{rfiData.project_name}</div>
            </div>
            <div>
              <label className="text-zinc-500 font-medium">Assigned Reviewer</label>
              <div className="font-semibold text-cyan-400">{rfiData.assigned_to}</div>
            </div>
            <div>
              <label className="text-zinc-500 font-medium">Schedule Impact</label>
              <div className="flex items-center gap-1.5 text-amber-400 font-medium mt-0.5">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Yes (Critical Path MEP)
              </div>
            </div>
            <div>
              <label className="text-zinc-500 font-medium">Cost Impact</label>
              <div className="flex items-center gap-1.5 text-amber-400 font-medium mt-0.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Yes (Lump sum adjustment)
              </div>
            </div>
          </div>

          {/* Subject Field */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Subject
            </label>
            <input
              type="text"
              value={rfiData.subject}
              onChange={(e) => setRfiData({ ...rfiData, subject: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700/80 text-white font-medium focus:border-amber-400 focus:outline-none"
            />
          </div>

          {/* Cited References */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Referenced Drawings & Specifications
            </label>
            <div className="space-y-1.5">
              {rfiData.references.map((ref, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/40 border border-zinc-800 text-xs">
                  <span className="px-2 py-0.5 rounded font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                    {ref.sheet_or_spec}
                  </span>
                  <span className="text-zinc-300">{ref.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Question Description */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Description of Inquiry
            </label>
            <textarea
              rows={4}
              value={rfiData.question}
              onChange={(e) => setRfiData({ ...rfiData, question: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700/80 text-zinc-200 text-xs font-mono leading-relaxed focus:border-amber-400 focus:outline-none"
            />
          </div>

          {/* Proposed Solution */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Contractor Recommended Solution
            </label>
            <textarea
              rows={2}
              value={rfiData.suggested_solution}
              onChange={(e) => setRfiData({ ...rfiData, suggested_solution: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700/80 text-zinc-200 text-xs font-mono leading-relaxed focus:border-amber-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/70">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
          >
            <FileDown className="h-4 w-4" />
            <span>Export JSON</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/25 transition-all"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-zinc-950 stroke-[3]" />
                  <span>Copied for Procore!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-zinc-950" />
                  <span>Copy Procore Format</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
