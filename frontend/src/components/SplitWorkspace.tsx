'use client';

import React, { useState } from 'react';
import { ChatContainer } from './chat/ChatContainer';
import { BlueprintViewer } from './viewer/BlueprintViewer';
import { RfiDraftModal } from './modals/RfiDraftModal';
import { RevisionCompareModal } from './viewer/RevisionCompareModal';
import { ChatMessage, CitationSource } from '@/types/construction-rag';
import { useRAGQuery } from '@/hooks/useRAGQuery';
import { MOCK_CITATIONS } from '@/mock/constructionData';

export const SplitWorkspace: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      timestamp: '10:00 AM',
      content: `### 👷 Construction Intelligence Conectada al Backend Real
Conectado a **Vertex AI RAG Engine** (Proyecto: \`frcg-antigravity\` / **FRCG-Tools-AG**).
Corpus ID: \`255759598760230912\` (944 planos y especificaciones técnicas indexadas).

Todas las consultas son procesadas en tiempo real contra los documentos de licitación y planos de obra. 
Escribe cualquier consulta técnica abajo (ej. *"door schedules y herrajes"*, *"filtros HEPA"*, *"scrub sinks"*).`,
      citations: [MOCK_CITATIONS['cite-a12a']],
      suggested_followups: [
        "Door schedules y herrajes de puertas",
        "Requisitos de filtros HEPA en salas de operaciones",
        "Especificaciones de scrub sinks P16 y plomería",
        "Generador de emergencia y transferencia eléctrica",
      ],
    },
  ]);

  const [selectedCitation, setSelectedCitation] = useState<CitationSource | undefined>(
    MOCK_CITATIONS['cite-a12a']
  );
  const [activeRfiMessage, setActiveRfiMessage] = useState<ChatMessage | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Hook conectado directamente a la API RAG real
  const { queryRAG, isLoading, error } = useRAGQuery();

  // Handler 100% dinámico y real: ELIMINADO EL MOCK HARDCODED
  const handleSendMessage = async (queryText: string) => {
    // 1. Mensaje del usuario
    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: queryText,
      citations: [],
    };

    setMessages((prev) => [...prev, userMsg]);

    // 2. Llamada real al backend RAG
    const ragResult = await queryRAG(queryText, 'frcg-antigravity');

    if (ragResult) {
      const assistantMsg: ChatMessage = {
        id: `msg-assistant-${Date.now()}`,
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: ragResult.answer,
        citations: ragResult.citations,
        suggested_followups: ragResult.suggested_followups,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Si el backend devolvió citas, cargar la primera automáticamente en el visor PDF
      if (ragResult.citations.length > 0) {
        setSelectedCitation(ragResult.citations[0]);
      }
    } else {
      // Manejo de error de conexión
      const errorMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: `❌ **Error consultando el backend RAG:**\n\`${error || 'No se pudo contactar con el endpoint'}\`.\n\nVerifica que el servicio esté corriendo o que la variable \`NEXT_PUBLIC_RAG_API_URL\` en \`.env.local\` sea accesible.`,
        citations: [],
        suggested_followups: ['Reintentar consulta', 'Verificar credenciales de Google Cloud'],
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  return (
    <div className="flex w-full h-full overflow-hidden bg-[#0b0d11]">
      {/* Panel Izquierdo: Workspace / Chat Técnico (50% estricto) */}
      <div className="w-1/2 h-full flex flex-col bg-[#0b0d11] overflow-hidden shrink-0">
        <ChatContainer
          messages={messages}
          activeCitationId={selectedCitation?.id}
          onSendMessage={handleSendMessage}
          onSelectCitation={(citation) => setSelectedCitation(citation)}
          onOpenRfiDraft={(msg) => setActiveRfiMessage(msg)}
          onOpenCompare={() => setIsCompareModalOpen(true)}
          onClearChat={() => setMessages([])}
          isStreaming={isLoading}
        />
      </div>

      {/* Divisor central vertical sutil de 1px (#1f242e) */}
      <div className="w-[1px] bg-[#1f242e] h-full shrink-0" />

      {/* Panel Derecho: Visor de Documentos y Planos (50% estricto) */}
      <div className="w-1/2 h-full flex flex-col bg-[#12151b] overflow-hidden">
        <BlueprintViewer
          selectedCitation={selectedCitation}
          onClearCitation={() => setSelectedCitation(undefined)}
          onSelectCitation={(citation) => setSelectedCitation(citation)}
        />
      </div>

      {/* Modal Generador de RFI Estructurado para Procore */}
      {activeRfiMessage && (
        <RfiDraftModal
          isOpen={!!activeRfiMessage}
          onClose={() => setActiveRfiMessage(null)}
          message={activeRfiMessage}
        />
      )}

      {/* Modal de Comparación de Revisiones */}
      <RevisionCompareModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
      />
    </div>
  );
};
