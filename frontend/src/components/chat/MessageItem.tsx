'use client';

import React, { useState } from 'react';
import {
  Bot,
  User,
  Copy,
  Check,
  FileSpreadsheet,
  MapPin,
  Eye,
  ShieldAlert,
  Scale,
  DollarSign,
  CheckCircle2,
  Layers,
  Sparkles,
} from 'lucide-react';
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

interface MarkdownBlock {
  type: 'heading' | 'numbered' | 'bullet' | 'blockquote' | 'paragraph' | 'hr';
  level?: number;
  title?: string;
  num?: string;
  text?: string;
  lines?: string[];
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  activeCitationId,
  onSelectCitation,
  onOpenRfiDraft,
  onOpenCompare,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedRfi, setCopiedRfi] = useState(false);
  const isAssistant = message.role === 'assistant';

  /**
   * Limpia residuos técnicos y elimina cualquier bloque JSON
   */
  const cleanMessageText = (content: string) => {
    return content
      .replace(/```(?:json:highlights|json)[\s\S]*?```/gi, '')
      .replace(/\{[\s\r\n]*"viewer_navigation"[\s\S]*?\}/gi, '')
      .trim();
  };

  const handleCopy = () => {
    // Copia texto completamente limpio de asteriscos y JSON
    const textToCopy = cleanMessageText(message.content).replace(/\*{1,3}/g, '');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyRfi = (rfiText: string) => {
    const cleanRfi = rfiText.replace(/\*{1,3}/g, '');
    navigator.clipboard.writeText(cleanRfi);
    setCopiedRfi(true);
    setTimeout(() => setCopiedRfi(false), 2000);
  };

  /**
   * Asigna ícono temático y diseño ejecutivo según la categoría del encabezado
   */
  const getHeadingTheme = (title: string) => {
    const lower = title.toLowerCase();

    if (
      lower.includes('diagnóstico') ||
      lower.includes('diagnostico') ||
      lower.includes('análisis') ||
      lower.includes('analisis') ||
      lower.includes('riesgo') ||
      lower.includes('vacío')
    ) {
      return {
        icon: <ShieldAlert className="h-4 w-4 text-cyan-400 shrink-0" />,
        badgeText: 'DIAGNÓSTICO TÉCNICO',
        containerClass:
          'border-l-4 border-l-cyan-500 bg-gradient-to-r from-cyan-950/40 via-cyan-950/15 to-transparent border border-cyan-500/20 text-cyan-300',
        titleClass: 'text-cyan-100 font-bold',
      };
    }

    if (
      lower.includes('prevalencia') ||
      lower.includes('contractual') ||
      lower.includes('legal') ||
      lower.includes('norma') ||
      lower.includes('subcontratista') ||
      lower.includes('discrepancia')
    ) {
      return {
        icon: <Scale className="h-4 w-4 text-amber-400 shrink-0" />,
        badgeText: 'CONDICIONES CONTRACTUALES',
        containerClass:
          'border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-950/40 via-amber-950/15 to-transparent border border-amber-500/20 text-amber-300',
        titleClass: 'text-amber-100 font-bold',
      };
    }

    if (
      lower.includes('económico') ||
      lower.includes('economico') ||
      lower.includes('costo') ||
      lower.includes('estimad') ||
      lower.includes('precio') ||
      lower.includes('csi') ||
      lower.includes('partida')
    ) {
      return {
        icon: <DollarSign className="h-4 w-4 text-emerald-400 shrink-0" />,
        badgeText: 'IMPACTO ECONÓMICO & ESTIMADOS',
        containerClass:
          'border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-950/40 via-emerald-950/15 to-transparent border border-emerald-500/20 text-emerald-300',
        titleClass: 'text-emerald-100 font-bold',
      };
    }

    if (
      lower.includes('plan de acción') ||
      lower.includes('plan de accion') ||
      lower.includes('operativo') ||
      lower.includes('campo') ||
      lower.includes('inmediato') ||
      lower.includes('coordinación')
    ) {
      return {
        icon: <CheckCircle2 className="h-4 w-4 text-violet-400 shrink-0" />,
        badgeText: 'PLAN DE ACCIÓN DE CAMPO',
        containerClass:
          'border-l-4 border-l-violet-500 bg-gradient-to-r from-violet-950/40 via-violet-950/15 to-transparent border border-violet-500/20 text-violet-300',
        titleClass: 'text-violet-100 font-bold',
      };
    }

    if (lower.includes('rfi') || lower.includes('borrador') || lower.includes('procore')) {
      return {
        icon: <FileSpreadsheet className="h-4 w-4 text-orange-400 shrink-0" />,
        badgeText: 'BORRADOR PROCORE RFI',
        containerClass:
          'border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-950/40 via-orange-950/15 to-transparent border border-orange-500/20 text-orange-300',
        titleClass: 'text-orange-100 font-bold',
      };
    }

    return {
      icon: <Layers className="h-4 w-4 text-zinc-400 shrink-0" />,
      badgeText: 'SECCIÓN TÉCNICA',
      containerClass:
        'border-l-4 border-l-zinc-500 bg-zinc-900/40 border border-zinc-700/30 text-zinc-300',
      titleClass: 'text-zinc-100 font-bold',
    };
  };

  /**
   * Parser inline: Convierte citas [[HL-1]], negritas, cursivas y códigos en elementos limpios
   * ELIMINA cualquier residuo de asteriscos sueltos (***, **, *)
   */
  const renderInlineContent = (content: string) => {
    // Regex que captura citas, negrita+cursiva (***), negrita (**), cursiva (*) y código (`)
    const inlineRegex =
      /(\[\[(HL-\d+)(?:\s*[:•\-]\s*([^\]]+))?\]\]|\[([^\]]+)\]\((cite-[a-zA-Z0-9-]+|HL-\d+)\)|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = inlineRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        // Texto plano previo: eliminamos asteriscos sueltos que hayan quedado sin cerrar
        const textBefore = content.substring(lastIndex, match.index).replace(/\*{1,3}/g, '');
        if (textBefore) {
          elements.push(textBefore);
        }
      }

      if (match[2]) {
        // Tag [[HL-1]] o [[HL-1 • Criterios]]
        const highlightId = match[2];
        const customLabel = match[3]?.trim();
        const foundCitation =
          message.citations.find(
            (c) =>
              c.id.toLowerCase() === highlightId.toLowerCase() ||
              c.id.replace('cite-', 'HL-').toLowerCase() === highlightId.toLowerCase()
          ) || message.citations[0];

        const isActive = foundCitation && activeCitationId === foundCitation.id;
        const categoryBadge = foundCitation?.category_tag;
        let displayLabel =
          customLabel || (foundCitation ? `${highlightId} • ${foundCitation.sheet_number}` : highlightId);
        if (categoryBadge && !displayLabel.startsWith('[')) {
          displayLabel = `${categoryBadge} ${displayLabel}`;
        }

        elements.push(
          <button
            key={`cite-token-${match.index}`}
            type="button"
            onClick={() => foundCitation && onSelectCitation(foundCitation)}
            onMouseEnter={() => foundCitation && onSelectCitation(foundCitation)}
            style={{
              borderColor: isActive ? '#f59e0b' : '#3d3215',
              backgroundColor: isActive ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.15)',
              color: '#fbbf24',
            }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 my-0.5 rounded text-xs font-mono font-bold transition-all shadow-sm border hover:border-amber-400 align-middle group cursor-pointer select-none"
            title={
              foundCitation
                ? `Click para enfocar en ${foundCitation.sheet_number || foundCitation.target_document}`
                : highlightId
            }
          >
            <MapPin className="h-3 w-3 shrink-0 text-amber-400" />
            <span>{displayLabel}</span>
            <Eye className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
          </button>
        );
      } else if (match[5]) {
        // Markdown [Texto](HL-1)
        const labelText = match[4];
        const highlightId = match[5];
        const foundCitation =
          message.citations.find(
            (c) =>
              c.id.toLowerCase() === highlightId.toLowerCase() ||
              c.id.replace('cite-', 'HL-').toLowerCase() === highlightId.toLowerCase()
          ) || message.citations[0];

        const isActive = foundCitation && activeCitationId === foundCitation.id;
        const categoryBadge = foundCitation?.category_tag;
        let displayLabel = labelText;
        if (categoryBadge && !displayLabel.startsWith('[')) {
          displayLabel = `${categoryBadge} ${displayLabel}`;
        }

        elements.push(
          <button
            key={`md-cite-${match.index}`}
            type="button"
            onClick={() => foundCitation && onSelectCitation(foundCitation)}
            onMouseEnter={() => foundCitation && onSelectCitation(foundCitation)}
            style={{
              borderColor: isActive ? '#f59e0b' : '#3d3215',
              backgroundColor: isActive ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.15)',
              color: '#fbbf24',
            }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 my-0.5 rounded text-xs font-mono font-bold transition-all shadow-sm border hover:border-amber-400 align-middle group cursor-pointer select-none"
            title={foundCitation ? `Click para enfocar en ${foundCitation.sheet_number}` : labelText}
          >
            <MapPin className="h-3 w-3 shrink-0 text-amber-400" />
            <span>{labelText}</span>
            <Eye className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
          </button>
        );
      } else if (match[6]) {
        // Negrita + Cursiva (***texto***) -> Texto limpio destacado
        elements.push(
          <strong key={`bold-italic-${match.index}`} className="font-bold text-amber-300 italic">
            {match[6]}
          </strong>
        );
      } else if (match[7]) {
        // Negrita (**texto**) -> Texto limpio y blanco
        elements.push(
          <strong key={`bold-${match.index}`} className="font-semibold text-white">
            {match[7]}
          </strong>
        );
      } else if (match[8]) {
        // Cursiva (*texto*) -> Texto limpio
        elements.push(
          <em key={`italic-${match.index}`} className="italic text-zinc-300 font-normal">
            {match[8]}
          </em>
        );
      } else if (match[9]) {
        // Código (`code`) -> Pill estilizado
        elements.push(
          <code
            key={`code-${match.index}`}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-[#1c2230] text-amber-300 font-mono text-xs border border-zinc-700/50"
          >
            {match[9]}
          </code>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      const remaining = content.substring(lastIndex).replace(/\*{1,3}/g, '');
      if (remaining) {
        elements.push(remaining);
      }
    }

    return elements;
  };

  /**
   * Helper para renderizar items de lista estructurados dividiendo Título y Cuerpo
   */
  const renderStructuredItem = (rawText: string) => {
    // Si inicia con **Título:** o **Título**:
    const titleMatch = rawText.match(/^\*\*([^*]+)\*\*[:\s]*(.*)$/);

    if (titleMatch) {
      const cleanTitle = titleMatch[1].replace(/[:\s]+$/, '');
      const bodyText = titleMatch[2];

      return (
        <div className="space-y-1">
          <div className="font-bold text-white tracking-wide text-xs sm:text-sm">
            {cleanTitle}
          </div>
          {bodyText && (
            <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {renderInlineContent(bodyText)}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
        {renderInlineContent(rawText)}
      </div>
    );
  };

  /**
   * Parser que descompone el Markdown en bloques AST de alto nivel
   */
  const parseMarkdownBlocks = (text: string): MarkdownBlock[] => {
    const clean = cleanMessageText(text);
    const lines = clean.split('\n');
    const blocks: MarkdownBlock[] = [];
    let currentParagraph: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        blocks.push({ type: 'paragraph', text: currentParagraph.join(' ').trim() });
        currentParagraph = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        flushParagraph();
        continue;
      }

      // Separador horizontal --- o ***
      if (line === '---' || line === '***' || line === '___') {
        flushParagraph();
        blocks.push({ type: 'hr' });
        continue;
      }

      // Encabezados ### o ## o #
      if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
        flushParagraph();
        const level = line.startsWith('### ') ? 3 : line.startsWith('## ') ? 2 : 1;
        const title = line.replace(/^#{1,3}\s+/, '').replace(/\*{1,3}/g, '').trim();
        blocks.push({ type: 'heading', level, title });
        continue;
      }

      // Citas / Bloque RFI con >
      if (line.startsWith('>')) {
        flushParagraph();
        const firstLine = line.replace(/^>\s*/, '').replace(/\[!(TIP|NOTE|WARNING|IMPORTANT)\]/i, '').trim();
        const quoteLines = firstLine ? [firstLine] : [];
        while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
          i++;
          const cleanQ = lines[i].trim().replace(/^>\s*/, '').replace(/\[!(TIP|NOTE|WARNING|IMPORTANT)\]/i, '').trim();
          if (cleanQ) quoteLines.push(cleanQ);
        }
        if (quoteLines.length > 0) {
          blocks.push({ type: 'blockquote', lines: quoteLines });
        }
        continue;
      }

      // Lista numerada: 1. **Title:** text
      const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        flushParagraph();
        blocks.push({ type: 'numbered', num: numMatch[1], text: numMatch[2] });
        continue;
      }

      // Viñetas: * text o - text
      const bulletMatch = line.match(/^[\*\-]\s+(.*)$/);
      if (bulletMatch) {
        flushParagraph();
        blocks.push({ type: 'bullet', text: bulletMatch[1] });
        continue;
      }

      // Párrafo ordinario
      currentParagraph.push(line);
    }

    flushParagraph();
    return blocks;
  };

  /**
   * Renderizado final de todos los bloques con estética ejecutiva AEC
   */
  const renderFormattedBlocks = (content: string) => {
    const blocks = parseMarkdownBlocks(content);

    return (
      <div className="space-y-3.5 text-xs sm:text-sm leading-relaxed font-sans text-zinc-100">
        {blocks.map((block, idx) => {
          if (block.type === 'heading' && block.title) {
            const theme = getHeadingTheme(block.title);
            return (
              <div
                key={`h-${idx}`}
                className={`mt-4 mb-2 p-2.5 rounded-r-lg flex items-center justify-between gap-2.5 shadow-sm ${theme.containerClass}`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {theme.icon}
                  <span className={`text-xs sm:text-sm ${theme.titleClass} truncate`}>
                    {block.title}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-black/30 shrink-0 hidden sm:inline-block">
                  {theme.badgeText}
                </span>
              </div>
            );
          }

          if (block.type === 'numbered' && block.text) {
            return (
              <div
                key={`num-${idx}`}
                className="flex items-start gap-3 p-3 rounded-lg bg-[#141824] border border-[#232938] hover:border-amber-500/40 hover:bg-[#161c2a] transition-all shadow-sm"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 font-mono text-xs font-black shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                  {block.num}
                </div>
                <div className="flex-1">
                  {renderStructuredItem(block.text)}
                </div>
              </div>
            );
          }

          if (block.type === 'bullet' && block.text) {
            return (
              <div
                key={`bullet-${idx}`}
                className="flex items-start gap-3 py-1.5 pl-1"
              >
                <span className="h-2 w-2 rounded-full bg-amber-400 mt-2 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                <div className="flex-1">
                  {renderStructuredItem(block.text)}
                </div>
              </div>
            );
          }

          if (block.type === 'blockquote' && block.lines) {
            const rawQuote = block.lines.join('\n');
            return (
              <div
                key={`quote-${idx}`}
                className="my-3 rounded-xl bg-gradient-to-b from-[#181a24] to-[#11131b] border border-orange-500/40 p-4 shadow-lg"
              >
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-orange-500/20">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
                    <FileSpreadsheet className="h-4 w-4 text-orange-400" />
                    <span>Borrador RFI (Procore Format)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyRfi(rawQuote)}
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 font-medium transition-colors border border-orange-500/30"
                  >
                    {copiedRfi ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar RFI</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="space-y-1.5 text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans">
                  {block.lines.map((qLine, qIdx) => (
                    <div
                      key={`ql-${qIdx}`}
                      className="bg-[#0e1017]/70 rounded-md px-3 py-1.5 border border-zinc-800/60"
                    >
                      {renderStructuredItem(qLine)}
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (block.type === 'hr') {
            return <hr key={`hr-${idx}`} className="border-t border-[#232938] my-3" />;
          }

          if (block.type === 'paragraph' && block.text) {
            return (
              <p key={`p-${idx}`} className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
                {renderInlineContent(block.text)}
              </p>
            );
          }

          return null;
        })}
      </div>
    );
  };

  return (
    <div
      className={`group relative flex gap-3 p-4 rounded-xl border transition-colors ${
        isAssistant
          ? 'bg-[#121620] border-[#222938] shadow-lg'
          : 'bg-[#12151b]/70 border-[#1f242e] ml-6'
      }`}
    >
      {/* Role Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg font-bold text-xs shadow-md ${
          isAssistant
            ? 'bg-amber-500 text-zinc-950 font-black shadow-amber-500/20'
            : 'bg-[#1f242e] text-[#8a93a0]'
        }`}
      >
        {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>

      {/* Message Body */}
      <div className="flex-1 space-y-3 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between text-xs text-[#8a93a0]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">
              {isAssistant ? 'AEC Technical Engine' : 'Field Engineer'}
            </span>
            {isAssistant && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-400">
                <Sparkles className="h-2.5 w-2.5" />
                Vertex RAG
              </span>
            )}
          </div>
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
        {renderFormattedBlocks(message.content)}

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
