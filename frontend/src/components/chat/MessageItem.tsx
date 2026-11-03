'use client';

import React, { useState } from 'react';
import { Bot, User, Copy, Check, FileSpreadsheet, Sparkles, MapPin, Eye } from 'lucide-react';
import { ChatMessage, CitationSource } from '@/types/construction-rag';
import { SourceCitationBadge } from './SourceCitationBadge';
import { RevisionAlertBanner } from '../viewer/RevisionAlertBanner';

interface MessageItemProps {
  message: ChatMessage;
  activeCitationId?: string;
  onSelectCitation: (citation: CitationSource) => void;
  onOpenRfiDraft: (message: ChatMessage) => void;
  onOpenCompare?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  activeCitationId,
  onSelectCitation,
  onOpenRfiDraft,
  onOpenCompare,
}) => {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === 'assistant';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Parser que procesa:
   * 1. Filtro estricto para que NUNCA se filtre JSON en la pantalla
   * 2. Tokens interactivos del protocolo AEC: [[HL-1]] o [[HL-1: A-7.22 Nota 5]]
   * 3. Formato markdown estándar: [Texto](cite-id)
   */
  const renderFormattedContent = (content: string) => {
    // Filtro de frontend: Elimina bloques JSON de highlights y cualquier residuo técnico
    const cleanContent = content
      .replace(/```json:highlights[\s\S]*?```/gi, '')
      .replace(/```json[\s\S]*?```/gi, '')
      .replace(/\{[\s\r\n]*"viewer_navigation"[\s\S]*?\}/gi, '')
      .trim();

    const combinedRegex = /(\[\[(HL-\d+)(?::\s*([^\]]+))?\]\]|\[([^\]]+)\]\((cite-[a-zA-Z0-9-]+|HL-\d+)\))/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = combinedRegex.exec(cleanContent)) !== null) {
      if (match.index > lastIndex) {
        parts.push(cleanContent.substring(lastIndex, match.index));
      }

      let highlightId = '';
      let labelText = '';

      if (match[2]) {
        highlightId = match[2];
        labelText = match[3] || match[2];
      } else if (match[5]) {
        highlightId = match[5];
        labelText = match[4];
      }

      const foundCitation = message.citations.find(
        (c) => c.id.toLowerCase() === highlightId.toLowerCase() || c.id.replace('cite-', 'HL-').toLowerCase() === highlightId.toLowerCase()
      ) || message.citations[0];

      if (foundCitation) {
        const isActive = activeCitationId === foundCitation.id;
        const color = foundCitation.color || foundCitation.style?.color || '#f59e0b';
        const displayLabel = (labelText && labelText !== highlightId)
          ? labelText
          : (foundCitation.callout_tag && !foundCitation.callout_tag.startsWith('Nota'))
            ? `${highlightId} • ${foundCitation.callout_tag}`
            : `${highlightId} • ${foundCitation.target_document || foundCitation.sheet_number}`;

        parts.push(
          <button
            key={`hl-token-${match.index}`}
            type="button"
            onClick={() => onSelectCitation(foundCitation)}
            onMouseEnter={() => onSelectCitation(foundCitation)}
            style={{
              borderColor: isActive ? '#f59e0b' : '#3d3215',
              backgroundColor: isActive ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.15)',
              color: '#fbbf24',
            }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 my-0.5 rounded text-xs font-mono font-bold transition-all shadow-sm border hover:border-amber-400 align-middle group cursor-pointer select-none"
            title={`Click/Hover para centrar recuadro en ${foundCitation.target_document || foundCitation.sheet_number}`}
          >
            <MapPin className="h-3 w-3 shrink-0 text-amber-400" />
            <span>{displayLabel}</span>
            <Eye className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
          </button>
        );
      } else {
        parts.push(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < cleanContent.length) {
      parts.push(cleanContent.substring(lastIndex));
    }

    return (
      <div className="text-xs sm:text-sm leading-relaxed space-y-3 whitespace-pre-wrap font-sans text-[#ffffff]">
        {parts.map((p, idx) => (
          <React.Fragment key={idx}>{p}</React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div
      className={`group relative flex gap-3 p-4 rounded-xl border transition-colors ${
        isAssistant
          ? 'bg-[#12151b] border-[#1f242e] shadow-md'
          : 'bg-[#12151b]/60 border-[#1f242e] ml-6'
      }`}
    >
      {/* Role Avatar */}
      <div
        className={`flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg font-bold text-xs shadow-sm ${
          isAssistant
            ? 'bg-amber-500 text-zinc-950 font-black'
            : 'bg-[#1f242e] text-[#8a93a0]'
        }`}
      >
        {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>

      {/* Message Body */}
      <div className="flex-1 space-y-3 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between text-xs text-[#8a93a0]">
          <span className="font-semibold text-[#ffffff]">
            {isAssistant ? 'AEC Technical Engine' : 'Field Engineer'}
          </span>
          <span className="font-mono text-[11px] text-[#8a93a0]">{message.timestamp}</span>
        </div>

        {/* Safety Conflict Alert if detected */}
        {message.revision_conflict?.is_conflict && (
          <RevisionAlertBanner
            conflict={message.revision_conflict}
            onOpenCompare={onOpenCompare}
            onSwitchToCurrentIfc={() => {
              const currentCite = message.citations.find((c) => c.is_current_ifc);
              if (currentCite) onSelectCitation(currentCite);
            }}
          />
        )}

        {/* Formatted Content */}
        {renderFormattedContent(message.content)}

        {/* Bottom Citations Tray */}
        {isAssistant && message.citations.length > 0 && (
          <div className="pt-2 border-t border-[#1f242e]/80">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8a93a0] mb-1.5 flex items-center gap-1.5">
              <span>Recuadros Bounding Box Vinculados ({message.citations.length}):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {message.citations.map((c) => (
                <SourceCitationBadge
                  key={c.id}
                  citation={c}
                  isActive={activeCitationId === c.id}
                  onSelect={onSelectCitation}
                />
              ))}
            </div>
          </div>
        )}

        {/* Action Bar */}
        {isAssistant && (
          <div className="flex items-center justify-between pt-2 border-t border-[#1f242e]/60 text-xs">
            <button
              onClick={() => onOpenRfiDraft(message)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#151821] text-amber-400 hover:bg-[#1a1e29] border border-amber-500/30 transition-all text-xs font-medium"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Draft Procore RFI</span>
            </button>

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[#8a93a0] hover:text-[#ffffff] hover:bg-[#151821] transition-colors"
              title="Copy answer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
