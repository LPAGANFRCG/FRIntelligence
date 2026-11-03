'use client';

import { useState, useCallback } from 'react';
import { CitationSource, ChatMessage } from '@/types/construction-rag';

export interface RAGQueryResponse {
  answer: string;
  citations: CitationSource[];
  suggested_followups?: string[];
  error?: string;
}

/**
 * Normaliza las coordenadas del bounding box:
 * Admite tanto [ymin, xmin, ymax, xmax] como [x, y, width, height],
 * convirtiéndolas a porcentajes normalizados [x, y, width, height] para el canvas de PDF.
 */
export function normalizeBoundingBox(rawBox?: number[]): [number, number, number, number] {
  if (!rawBox || rawBox.length < 4) {
    return [15, 20, 60, 30]; // fallback
  }

  // Detectar si está en escala 0-1000 (común en Document AI / OCR)
  const isScale1000 = rawBox.some((v) => v > 100);
  const factor = isScale1000 ? 10 : 1;

  const [a, b, c, d] = rawBox.map((v) => v / factor);

  // Si c > a y d > b probablemente es [ymin, xmin, ymax, xmax]
  if (c > a && d > b && c <= 100 && d <= 100) {
    const ymin = a;
    const xmin = b;
    const ymax = c;
    const xmax = d;
    return [xmin, ymin, xmax - xmin, ymax - ymin];
  }

  // Formato [x, y, width, height]
  return [a, b, c, d];
}

export function useRAGQuery() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const queryRAG = useCallback(
    async (
      queryText: string,
      projectId: string = 'frcg-antigravity'
    ): Promise<RAGQueryResponse | null> => {
      setIsLoading(true);
      setError(null);

      const endpoint = process.env.NEXT_PUBLIC_RAG_API_URL || '/api/query';

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: queryText,
            project_id: projectId,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${response.status}`);
        }

        const data = await response.json();

        // Normalizar citas para asegurar compatibilidad con el visor de PDF
        const formattedCitations: CitationSource[] = (data.citations || []).map(
          (c: any, idx: number) => {
            const rawBox = c.bounding_box || [15, 20, 50, 30];
            const normalizedBox = normalizeBoundingBox(rawBox);

            return {
              id: c.id || `cite-${idx + 1}`,
              sheet_number: c.sheet_number || c.sheet_name || 'A-SPEC',
              target_document: c.target_document || c.sheet_number,
              sheet_title: c.sheet_title || 'DOCUMENTO DE CONSTRUCCIÓN',
              discipline: c.discipline || 'Architectural',
              revision: c.revision || 'Rev 0',
              revision_date: c.revision_date || '2026-10-29',
              is_current_ifc: c.is_current_ifc !== false,
              page_number: c.page_number || 1,
              total_pages: c.total_pages || 1,
              file_url: c.file_url || '/sample-blueprint.pdf',
              gcs_uri: c.gcs_uri || '',
              bounding_box: normalizedBox,
              box_2d: c.box_2d,
              exact_quoted_text: c.exact_quoted_text || c.text_excerpt,
              text_excerpt: c.text_excerpt || '',
              callout_tag: c.callout_tag || c.label || `Nota ${idx + 1}`,
              spec_section: c.spec_section,
              color: c.color || c.style?.color || '#F5A623',
              style: c.style || { color: c.color || '#F5A623', border_style: 'solid', border_width: 2 },
              rotation: c.rotation ?? c.recommended_rotation ?? 0,
              recommended_rotation: c.recommended_rotation ?? c.rotation ?? 0,
              auto_zoom: c.auto_zoom ?? c.recommended_zoom ?? 130,
              recommended_zoom: c.recommended_zoom ?? c.auto_zoom ?? 130,
            };
          }
        );

        setIsLoading(false);
        return {
          answer: data.answer || 'No se recibió texto de respuesta del backend RAG.',
          citations: formattedCitations,
          suggested_followups: data.suggested_followups || [],
        };
      } catch (err: any) {
        console.error('Error querying RAG backend:', err);
        setError(err.message || 'Error communicating with RAG backend');
        setIsLoading(false);
        return null;
      }
    },
    []
  );

  return {
    queryRAG,
    isLoading,
    error,
  };
}
