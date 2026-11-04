'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUp, Paperclip, Mic, Volume2, Database, ChevronDown, 
  Share2, Plus, BookOpen, FileText, ExternalLink, Download, 
  Copy, Check, ThumbsUp, ThumbsDown, FileSpreadsheet, RotateCcw,
  Sparkles, Layers
} from 'lucide-react';
import { ChatMessage, CitationSource } from '@/types/construction-rag';
import { MessageItem } from './MessageItem';

interface ChatContainerProps {
  messages: ChatMessage[];
  activeCitationId?: string;
  onSendMessage: (text: string) => void;
  onSelectCitation: (citation: CitationSource) => void;
  onOpenRfiDraft: (message: ChatMessage) => void;
  onOpenCompare: () => void;
  onClearChat?: () => void;
  isStreaming?: boolean;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  activeCitationId,
  onSendMessage,
  onSelectCitation,
  onOpenRfiDraft,
  onOpenCompare,
  onClearChat,
  isStreaming = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [sourcesPageIndex, setSourcesPageIndex] = useState(0);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [thumbsState, setThumbsState] = useState<'up' | 'down' | null>(null);
  const [isCopiedShare, setIsCopiedShare] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Derive conversation title from user's first query or default
  const userFirstQuery = messages.find((m) => m.role === 'user')?.content;
  const conversationTitle = userFirstQuery
    ? userFirstQuery.length > 36 
      ? `${userFirstQuery.substring(0, 36)}...` 
      : userFirstQuery
    : 'Interior Framing & Finishes';

  // Get latest assistant message citations
  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const citations = latestAssistantMessage?.citations || [];
  const SOURCES_PER_PAGE = 3;
  const totalSources = citations.length;
  const totalPages = Math.ceil(totalSources / SOURCES_PER_PAGE) || 1;
  const displayedSources = citations.slice(
    sourcesPageIndex * SOURCES_PER_PAGE,
    (sourcesPageIndex + 1) * SOURCES_PER_PAGE
  );

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isStreaming) return;
    onSendMessage(inputText.trim());
    setInputText('');
    setSourcesPageIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopySummary = () => {
    if (!latestAssistantMessage) return;
    navigator.clipboard.writeText(latestAssistantMessage.content);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopiedShare(true);
    setTimeout(() => setIsCopiedShare(false), 2000);
  };

  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-PR,es-ES,en-US';
    recognition.interimResults = false;

    if (!isVoiceListening) {
      setIsVoiceListening(true);
      recognition.start();
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsVoiceListening(false);
      };
      recognition.onerror = () => setIsVoiceListening(false);
      recognition.onend = () => setIsVoiceListening(false);
    } else {
      setIsVoiceListening(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0b0d11] text-[#ffffff] overflow-hidden select-none">
      {/* 1. Header superior mínimo: Breadcrumbs + Share */}
      <div className="h-11 border-b border-[#1f242e] px-6 flex items-center justify-between shrink-0 bg-[#0b0d11]">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#8a93a0] truncate">
          <span className="hover:text-[#ffffff] transition-colors cursor-pointer">Conversations</span>
          <span>&gt;</span>
          <span className="text-[#ffffff] font-semibold truncate max-w-[280px] lg:max-w-[400px]">
            {conversationTitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Cloud Run • v2.1 AEC Live</span>
          </div>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs text-[#8a93a0] hover:text-[#ffffff] px-2.5 py-1 rounded bg-[#12151b] border border-[#1f242e] hover:border-[#2f3747] transition-all"
            title="Copy share link"
          >
            {isCopiedShare ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{isCopiedShare ? 'Copied' : 'Share'}</span>
          </button>

          {onClearChat && (
            <button
              onClick={onClearChat}
              className="p-1 rounded text-[#8a93a0] hover:text-[#ffffff] hover:bg-[#12151b] transition-colors"
              title="New consultation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Área central de lectura (Scroll vertical nativo ultra-fino) */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-6 custom-scrollbar select-text">
        {/* H2 Title Grande, Bold, Blanco Puro */}
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-[#ffffff]">
            {conversationTitle}
          </h2>
          <p className="text-xs font-mono text-[#8a93a0] mt-1">
            Grounded on Vertex AI RAG • Project FRCG-Tools-AG (Hospital Trauma)
          </p>
        </div>

        {/* Message Thread */}
        <div className="space-y-6">
          {messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              activeCitationId={activeCitationId}
              onSelectCitation={onSelectCitation}
              onOpenRfiDraft={onOpenRfiDraft}
              onOpenCompare={onOpenCompare}
            />
          ))}

          {isStreaming && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#12151b] border border-[#1f242e] text-xs text-[#8a93a0] animate-pulse">
              <Sparkles className="h-4 w-4 text-amber-400 animate-spin" />
              <span>Analyzing 944 project sheets and extracting verified bounding boxes...</span>
            </div>
          )}
        </div>

        {/* 1-Click RAG Suggested Queries */}
        {latestAssistantMessage?.suggested_followups && latestAssistantMessage.suggested_followups.length > 0 && !isStreaming && (
          <div className="p-3.5 rounded-xl bg-[#151922]/80 border border-[#232938] space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Consultas Técnicas Sugeridas (1-Click RAG Audit):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {latestAssistantMessage.suggested_followups.map((suggestion, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => onSendMessage(suggestion)}
                  className="text-left text-xs p-2.5 rounded-lg bg-[#12151b] hover:bg-[#1a202c] border border-[#1f242e] hover:border-amber-500/50 text-zinc-300 hover:text-white transition-all shadow-sm flex items-start gap-2 group cursor-pointer"
                >
                  <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform font-bold shrink-0">→</span>
                  <span className="leading-snug">{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bloque 'Summary' con fila de utilidad inferior */}
        {latestAssistantMessage && !isStreaming && (
          <div className="pt-4 border-t border-[#1f242e] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8a93a0]">
                Engineering Summary
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopySummary}
                  className="p-1.5 rounded hover:bg-[#12151b] text-[#8a93a0] hover:text-[#ffffff] transition-colors"
                  title="Copy technical summary"
                >
                  {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setThumbsState(thumbsState === 'up' ? null : 'up')}
                  className={`p-1.5 rounded hover:bg-[#12151b] transition-colors ${
                    thumbsState === 'up' ? 'text-amber-400 bg-[#12151b]' : 'text-[#8a93a0] hover:text-[#ffffff]'
                  }`}
                  title="Accurate citation"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setThumbsState(thumbsState === 'down' ? null : 'down')}
                  className={`p-1.5 rounded hover:bg-[#12151b] transition-colors ${
                    thumbsState === 'down' ? 'text-red-400 bg-[#12151b]' : 'text-[#8a93a0] hover:text-[#ffffff]'
                  }`}
                  title="Inaccurate / review needed"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onOpenRfiDraft(latestAssistantMessage)}
                  className="ml-2 flex items-center gap-1 px-2.5 py-1 rounded bg-[#12151b] hover:bg-[#1f242e] border border-[#1f242e] text-[11px] text-[#8a93a0] hover:text-[#ffffff] transition-colors"
                  title="Convert to RFI Draft"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                  <span>Draft RFI</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sección de Fuentes Citadas: Sources (X) */}
        {citations.length > 0 && (
          <div className="pt-2 border-t border-[#1f242e] space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#8a93a0]">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#8a93a0]" />
                <span>Sources ({totalSources})</span>
              </div>
              <span className="font-mono text-[11px] text-[#8a93a0]">
                {totalSources > 0 ? `${sourcesPageIndex * SOURCES_PER_PAGE + 1}-${Math.min((sourcesPageIndex + 1) * SOURCES_PER_PAGE, totalSources)} of ${totalSources}` : '0 of 0'}
              </span>
            </div>

            {/* Lista vertical de tarjetas de fuentes */}
            <div className="space-y-2">
              {displayedSources.map((c, idx) => {
                const isActive = activeCitationId === c.id;
                const fileName = c.target_document || c.sheet_number || 'Construction Document.pdf';
                const subTitle = c.sheet_title 
                  ? `${c.sheet_title} • Page ${c.page_number || 1}`
                  : `Drawings / Architectural • Page ${c.page_number || 1}`;

                return (
                  <div
                    key={c.id || idx}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-[#151922] border-amber-500/50 shadow-md'
                        : 'bg-[#12151b] border-[#1f242e] hover:border-[#2f3747]'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden mr-3">
                      <div className="p-2 rounded bg-[#1a1d24] text-[#8a93a0] shrink-0 border border-[#1f242e]">
                        <FileText className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="truncate">
                        <h4 className="text-xs font-bold text-[#ffffff] truncate">
                          {fileName}
                        </h4>
                        <p className="text-[11px] text-[#8a93a0] truncate font-sans">
                          {subTitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Botón 'C' para centrar cita en visor */}
                      <button
                        onClick={() => onSelectCitation(c)}
                        className={`h-7 w-7 rounded font-mono text-xs font-bold flex items-center justify-center transition-all ${
                          isActive
                            ? 'bg-amber-500 text-zinc-950 shadow-sm'
                            : 'bg-[#1a1d24] hover:bg-[#252a35] text-[#ffffff] border border-[#1f242e]'
                        }`}
                        title={`Center citation in PDF viewer (Page ${c.page_number || 1})`}
                      >
                        C
                      </button>

                      {/* Botón de apertura / descarga */}
                      <a
                        href={c.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-7 w-7 rounded bg-[#1a1d24] hover:bg-[#252a35] text-[#8a93a0] hover:text-[#ffffff] border border-[#1f242e] flex items-center justify-center transition-colors"
                        title="Open PDF in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paginador inferior para las fuentes */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1 text-xs text-[#8a93a0]">
                <span>
                  {sourcesPageIndex * SOURCES_PER_PAGE + 1}-{Math.min((sourcesPageIndex + 1) * SOURCES_PER_PAGE, totalSources)} of {totalSources}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSourcesPageIndex((p) => Math.max(0, p - 1))}
                    disabled={sourcesPageIndex <= 0}
                    className="px-2 py-1 rounded bg-[#12151b] border border-[#1f242e] hover:border-[#2f3747] text-[#8a93a0] hover:text-[#ffffff] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    &lt; Back
                  </button>
                  <button
                    onClick={() => setSourcesPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={sourcesPageIndex >= totalPages - 1}
                    className="px-2 py-1 rounded bg-[#12151b] border border-[#1f242e] hover:border-[#2f3747] text-[#8a93a0] hover:text-[#ffffff] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    Next &gt;
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Barra de entrada flotante inferior (Chat Dock) */}
      <div className="p-4 lg:p-6 bg-gradient-to-t from-[#0b0d11] via-[#0b0d11] to-transparent shrink-0">
        <div className="bg-[#151821] border border-[#232834] rounded-2xl p-2.5 shadow-2xl focus-within:border-amber-500/50 transition-colors">
          {/* Text Area */}
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a technical question about drawings, specs or RFIs..."
            disabled={isStreaming}
            className="w-full bg-transparent text-xs text-[#ffffff] placeholder-[#8a93a0] resize-none focus:outline-none px-2 py-1 leading-relaxed font-sans"
          />

          {/* Dock Controls Row */}
          <div className="flex items-center justify-between pt-1 border-t border-[#1f242e]/60 mt-1">
            {/* Left Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1f242e] hover:bg-[#282f3d] text-[#8a93a0] hover:text-[#ffffff] text-[11px] font-mono transition-colors"
                title="Active Scope: All project drawings and specifications"
              >
                <Database className="w-3 h-3 text-amber-400" />
                <span>All project docs</span>
                <ChevronDown className="w-2.5 h-2.5" />
              </button>

              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-[#1f242e] text-[#8a93a0] hover:text-[#ffffff] transition-colors"
                title="Attach document or reference image"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={toggleVoice}
                className={`p-1.5 rounded-lg transition-colors ${
                  isVoiceListening
                    ? 'bg-red-500/20 text-red-400 animate-pulse'
                    : 'hover:bg-[#1f242e] text-[#8a93a0] hover:text-[#ffffff]'
                }`}
                title="Voice technical inquiry"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-[#1f242e] text-[#8a93a0] hover:text-[#ffffff] transition-colors"
                title="Text-to-speech audio response"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Right Controls: Send Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!inputText.trim() || isStreaming}
              className="h-7 w-7 rounded-full bg-amber-500 hover:bg-amber-400 text-[#0b0d11] font-bold flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
              title="Submit Query (Enter)"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Disclaimer Text */}
        <p className="text-center text-[10.5px] text-[#8a93a0]/80 mt-2 font-sans">
          Trunk Tools is AI and can make mistakes. Verify answers against your project documents.
        </p>
      </div>
    </div>
  );
};
