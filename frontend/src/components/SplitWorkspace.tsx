'use client';

import React, { useState, useEffect } from 'react';
import { ChatContainer } from './chat/ChatContainer';
import { BlueprintViewer } from './viewer/BlueprintViewer';
import { RfiDraftModal } from './modals/RfiDraftModal';
import { RevisionCompareModal } from './viewer/RevisionCompareModal';
import { ChatMessage, CitationSource } from '@/types/construction-rag';
import { useRAGQuery } from '@/hooks/useRAGQuery';
import { MOCK_CITATIONS } from '@/mock/constructionData';

const STORAGE_KEY = 'hospital_trauma_active_chat';
const SESSION_PARAM = 'session';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEFAULT_WELCOME_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-welcome',
    role: 'assistant',
    timestamp: '10:00 AM',
    content: `### 👷 Asistente Senior de Ingeniería y Estimados AEC — Puerto Rico
Conectado en tiempo real a Vertex AI RAG Engine (Proyecto: \`frcg-antigravity\` / FRCG-Tools-AG).
Corpus ID: \`255759598760230912\` (944 planos y especificaciones contractuales indexadas).

---

### Auditoría Contractual Activa: Quirófanos de Trauma y Lámparas Quirúrgicas

* **División 11 70 00 — Equipo Quirúrgico (Lámparas LED de Techo)**:
  - En las cinco (5) Salas de Operaciones de Trauma, el sistema principal consiste en un ensamble de **tres cabezales de iluminación LED** suspendidos de techo (*Surgical O.R. Three-Light Head Lamp*) con control de intensidad variable [[HL-1]].
  - La tabla de equipos \`Detail 2\` estipula que las lámparas son suministradas por el dueño (*OFCI - Owner Furnished, Contractor Installed*), pero el anclaje, instalación eléctrica y calibración recaen 100% sobre el contratista general.

* **División 05 50 00 / Estructural — Soporte Rígido en Plenum**:
  - Exige placa base de interface y varillas roscadas ancladas a la losa superior de concreto, diseñadas con un factor de seguridad mínimo de **2.0** contra cargas de sismo y oscilación de los brazos articulados.

* **División 23 / 26 — Coordinación MEP y Conflicto con Addendum No. 3**:
  - Advertencia Crítica: La hoja preliminar \`A-1.2A (Rev 0)\` fue modificada por el **Addendum No. 3 (RFI-372)**, el cual rediseñó el cielo raso para incorporar cuatro (4) difusores de flujo laminar unidireccional y filtros HEPA terminales (99.97% @ 0.3μm).

> [!TIP]
> Recomendación Práctica de Campo y Licitación:
> Haz clic en el badge interactivo [[HL-1]] para ver el plano \`A-1.2A\` auto-rotado a 90° horizontal con el recuadro que abarca el renglón completo de la tabla. O selecciona cualquiera de las consultas rápidas abajo para auditar el resto de las disciplinas MEP y acabados.`,
    citations: [
      {
        ...MOCK_CITATIONS['cite-a12a'],
        doc_type: 'DRAWING',
        category_tag: '[PLANO]',
        priority: 5,
      },
    ],
    suggested_followups: [
      '¿Cuáles son las aclaraciones vigentes de RFI sobre plomería y gases médicos?',
      'Verificar cambios del Addendum No. 3 en techos y filtros HEPA de quirófanos',
      'Auditar interferencias entre ductos MEP y especificación de Plenum',
      'Generar borrador de RFI formal para Procore ante ambigüedad en planos',
    ],
  },
];

export const SplitWorkspace: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(DEFAULT_WELCOME_MESSAGES);
  const [sessionId, setSessionId] = useState<string>('');
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const [selectedCitation, setSelectedCitation] = useState<CitationSource | undefined>(
    MOCK_CITATIONS['cite-a12a']
  );
  const [activeRfiMessage, setActiveRfiMessage] = useState<ChatMessage | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Hook conectado directamente a la API RAG real
  const { queryRAG, isLoading, error } = useRAGQuery();

  // 1. Hidratación inicial desde localStorage y URL
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      let currentSessionId = urlParams.get(SESSION_PARAM);

      const cachedRaw = localStorage.getItem(STORAGE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && Array.isArray(cached.messages) && cached.messages.length > 0) {
          setMessages(cached.messages);
          if (!currentSessionId && cached.sessionId) {
            currentSessionId = cached.sessionId;
          }
        }
      }

      if (!currentSessionId) {
        currentSessionId = generateUUID();
      }

      setSessionId(currentSessionId);

      // Sincronizar URL con el identificador de sesión sin recargar
      const newUrl = new URL(window.location.href);
      if (newUrl.searchParams.get(SESSION_PARAM) !== currentSessionId) {
        newUrl.searchParams.set(SESSION_PARAM, currentSessionId);
        window.history.replaceState({}, '', newUrl.toString());
      }
    } catch (e) {
      console.warn('Error hydrating chat state from localStorage:', e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // 2. Persistencia automática inmediata en localStorage ante cambios en messages
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sessionId: sessionId || generateUUID(),
          messages,
          updatedAt: Date.now(),
        })
      );
    } catch (e) {
      console.warn('Error saving chat to localStorage:', e);
    }
  }, [messages, sessionId, isHydrated]);

  // Handler para reiniciar la sesión ("Nueva Consulta" / "Clear Chat")
  const handleClearChat = () => {
    const newSessionId = generateUUID();
    setSessionId(newSessionId);
    setMessages(DEFAULT_WELCOME_MESSAGES);
    setSelectedCitation(MOCK_CITATIONS['cite-a12a']);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            sessionId: newSessionId,
            messages: DEFAULT_WELCOME_MESSAGES,
            updatedAt: Date.now(),
          })
        );
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set(SESSION_PARAM, newSessionId);
        window.history.replaceState({}, '', newUrl.toString());
      } catch (e) {
        console.warn('Error resetting chat storage:', e);
      }
    }
  };

  // Handler 100% dinámico y real conectado a Vertex AI RAG
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
          sessionId={sessionId}
          activeCitationId={selectedCitation?.id}
          onSendMessage={handleSendMessage}
          onSelectCitation={(citation) => setSelectedCitation(citation)}
          onOpenRfiDraft={(msg) => setActiveRfiMessage(msg)}
          onOpenCompare={() => setIsCompareModalOpen(true)}
          onClearChat={handleClearChat}
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
