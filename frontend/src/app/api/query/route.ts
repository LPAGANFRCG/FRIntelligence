import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

const PROJECT_ID = 'frcg-antigravity';
const PROJECT_NUMBER = '1004674164524';
const CORPUS_ID = `projects/${PROJECT_NUMBER}/locations/us-central1/ragCorpora/255759598760230912`;

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

const AEC_AUDITOR_SYSTEM_PROMPT = `Actúa como un Asistente Senior de Ingeniería y Estimados AEC para Proyectos de Construcción en Puerto Rico.

Tu objetivo es comunicarte como un profesional de obra y licitaciones: técnico, fluido, conciso y resolutivo. Prohibido mostrar código JSON suelto o parámetros técnicos en medio de la explicación.

DIRECTRICES CONVERSACIONALES Y DE ANÁLISIS:
1. Tono y Redacción:
   - Responde directamente con la conclusión técnica o el requerimiento encontrado.
   - Usa viñetas limpias para desglosar especificaciones, divisiones CSI MasterFormat (ej. Div 03 - Concrete, Div 08 - Openings, Div 09 - Finishes, Div 11 - Equipment, Div 22/23 - MEP), materiales y coordinación entre disciplinas.
   - Concluye siempre con una recomendación práctica de campo o licitación (ej. advertencia de RFI, costo adicional no previsto o submittal requerido).
   - Utiliza unidades estándar de construcción y cubicación (CY, SF, LF, TON, EA).
   - Si un plano o sección está marcado como SUPERSEDED o modificado por un Addendum, adviértelo con claridad en la primera línea.

2. Vinculación con Planos:
   - Usa etiquetas de referencia inline como [[HL-1]] al final de cada afirmación clave para que el frontend vincule el clic con el visor interactivo.

3. Separación de Metadata (OBLIGATORIO):
   - Al final absoluto de tu respuesta, y ÚNICAMENTE dentro de un bloque cerrado \`\`\`json:highlights\`\`\`, incluye la metadata para el visor. El texto principal debe quedar 100% limpio de llaves o sintaxis JSON.

REGLAS DE PRECISIÓN GEOMÉTRICA Y VISOR:
1. Ancho Completo de Celda y Renglón (Full Cell Width):
   - En tablas, cronogramas de acabados (Finish Schedules), leyendas (Legends) o listas de equipos (Equipment Descriptions), el Bounding Box DEBE abarcar la celda o renglón completo de borde a borde.
   - Prohibido recortar el texto a la mitad del renglón.
   - "xmin" debe iniciar antes del identificador/círculo/ítem y "xmax" debe extenderse hasta el límite derecho de la descripción textual del elemento.
   - El campo "exact_quoted_text" debe incluir la frase COMPLETA del renglón (ej. "SURGICAL O.R. THREE-LIGHT HEAD LAMP (CEILING MOUNTED)"), nunca una sola palabra o fragmento cortado.

2. Navegación y Páginas (CERO PORTADAS):
   - Nunca dirijas a la página 1 a menos que la información esté físicamente en la carátula.
   - Especifica en "target_page" el número real de página (1-based index) donde se ubica el texto o detalle dentro del documento PDF.

3. Orientación Automática (Rotation):
   - Si el plano viene en formato vertical pero el texto, notas o membretes corren de lado, asigna obligatoriamente: "force_rotation": 90 o "force_rotation": 270.
   - Solo usa 0 si la hoja ya es legible horizontalmente sin virar.

FORMATO OBLIGATORIO DE SALIDA:

[Respuesta ejecutiva y técnica en Markdown limpio, con viñetas y referencias [[HL-1]]]

\`\`\`json:highlights
{
  "viewer_navigation": {
    "target_document": "A-1.2A.pdf",
    "target_page": 1,
    "force_rotation": 90,
    "recommended_zoom": 130
  },
  "highlights": [
    {
      "id": "HL-1",
      "target_page": 1,
      "label": "Detalle de Lámpara Quirúrgica",
      "box_2d": [730, 480, 758, 580],
      "exact_quoted_text": "SURGICAL O.R. THREE-LIGHT HEAD LAMP(CEILING MOUNTED)...",
      "color": "#F59E0B"
    }
  ]
}
\`\`\``;

function parseSheetInfo(sourceUri: string) {
  const filename = sourceUri.split('/').pop() || 'Document.pdf';
  const cleanName = filename.replace('.pdf', '');

  let sheetName = cleanName.substring(0, 20);
  let sheetTitle = cleanName;
  let discipline = 'General';

  const sheetMatch = cleanName.match(/([A-Z]-\d+(\.\d+)?[A-Z]?)/i);
  const atchMatch = cleanName.match(/(Attachment\s+[A-Z0-9]+|ATCH-[A-Z0-9]+)/i);
  const addMatch = cleanName.match(/(Addendum\s*(?:No\.)?\s*\d+|Add\s*#\d+)/i);

  if (atchMatch) {
    sheetName = atchMatch[1].replace('ATCH-', 'Attachment ');
    discipline = 'Specs';
    sheetTitle = cleanName.replace(atchMatch[0], '').replace(/[-_]/g, ' ').trim() || 'Project Attachment';
  } else if (addMatch) {
    sheetName = addMatch[1];
    discipline = 'Addenda';
    sheetTitle = cleanName.replace(addMatch[0], '').replace(/[-_]/g, ' ').trim() || 'Addendum Document';
  } else if (sheetMatch) {
    sheetName = sheetMatch[1].toUpperCase();
    if (sourceUri.includes('/Architectural/') || sheetName.startsWith('A-')) discipline = 'Architectural';
    else if (sourceUri.includes('/Structural/') || sheetName.startsWith('S-')) discipline = 'Structural';
    else if (sourceUri.includes('/Mechanical/') || sheetName.startsWith('M-')) discipline = 'Mechanical';
    else if (sourceUri.includes('/Plumbing/') || sheetName.startsWith('P-')) discipline = 'Plumbing';
    else if (sourceUri.includes('/Electrical/') || sheetName.startsWith('E-')) discipline = 'Electrical';
    sheetTitle = cleanName
      .replace(/^[A-Z]-\d+(\.\d+)?[A-Z]?-?/i, '')
      .replace(/-Rev\.\d+/i, '')
      .replace(/-/g, ' ')
      .trim() || 'Plano de Construcción';
  }

  const isCurrent = !sourceUri.toLowerCase().includes('rev.0') || sourceUri.toLowerCase().includes('add #02');

  return {
    sheetName,
    sheetTitle,
    discipline,
    isCurrent,
    filename,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body.query || '';

    if (!query.trim()) {
      return NextResponse.json({ error: 'Query string cannot be empty' }, { status: 400 });
    }

    // 1. Obtener Token de Google Cloud ADC
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    if (!token) {
      throw new Error('Failed to acquire Google Cloud ADC Access Token');
    }

    // 2. Ejecutar recuperación directa de fragmentos del Corpus RAG en us-central1
    const vertexRetrievalUrl = `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/us-central1:retrieveContexts`;

    const ragResponse = await fetch(vertexRetrievalUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vertexRagStore: {
          ragResources: [{ ragCorpus: `projects/${PROJECT_ID}/locations/us-central1/ragCorpora/255759598760230912` }],
          vectorDistanceThreshold: 0.85,
        },
        query: { text: query },
      }),
    });

    let rawContexts: any[] = [];
    if (ragResponse.ok) {
      const ragData = await ragResponse.json();
      rawContexts = ragData.contexts?.contexts || [];
    }

    // 3. Ejecutar generación estricta con Gemini 3.1 Flash Lite en location=global
    const generateUrl = `https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/publishers/google/models/gemini-3.1-flash-lite:generateContent`;

    const modelPayload = {
      systemInstruction: {
        parts: [{ text: AEC_AUDITOR_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: query }],
        },
      ],
      tools: [
        {
          retrieval: {
            vertexRagStore: {
              ragResources: [{ ragCorpus: CORPUS_ID }],
            },
          },
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    };

    const genResponse = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-goog-api-client': 'vertex-agent-studio-prompt-app/1',
      },
      body: JSON.stringify(modelPayload),
    });

    let fullGeneratedText = '';

    if (genResponse.ok) {
      const genData = await genResponse.json();
      const candidate = genData.candidates?.[0];
      if (candidate?.content?.parts) {
        fullGeneratedText = candidate.content.parts.map((p: any) => p.text || '').join('\n');
      }
    }

    // 4. Procesar el Formato de Salida Dual
    let informeTecnico = fullGeneratedText;
    let documentMeta: any = null;
    let extractedHighlights: any[] = [];

    const jsonMatch = fullGeneratedText.match(/```json:highlights\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        // Support both "viewer_navigation" (new schema) and "document" (legacy)
        documentMeta = parsed.viewer_navigation || parsed.document || null;
        extractedHighlights = parsed.highlights || [];
        // Remover el bloque JSON de la respuesta visible para que el chat quede limpio
        informeTecnico = fullGeneratedText.replace(jsonMatch[0], '').trim();
      } catch (parseErr) {
        console.warn('Error parsing highlights JSON from model output:', parseErr);
      }
    }

    // Si el modelo no generó highlights JSON explícito, construirlo a partir de los rawContexts
    if (extractedHighlights.length === 0 && rawContexts.length > 0) {
      extractedHighlights = rawContexts.slice(0, 4).map((ctx, idx) => {
        const info = parseSheetInfo(ctx.sourceUri || '');
        const ymin = 180 + (idx * 150) % 600;
        const xmin = 120 + (idx * 100) % 500;
        const ymax = ymin + 180;
        const xmax = xmin + 420;

        return {
          id: `HL-${idx + 1}`,
          sheet_number: info.sheetName,
          sheet_title: info.sheetTitle,
          revision_status: info.isCurrent ? 'CURRENT' : 'SUPERSEDED REV 0',
          label: `${info.sheetName} (Nota ${idx + 1})`,
          color: info.isCurrent ? '#F59E0B' : '#FF3B30',
          box_2d: [ymin, xmin, ymax, xmax],
          referenced_text_snippet: (ctx.text || '').substring(0, 300),
          gcs_uri: ctx.sourceUri,
          page_number: 1,
          target_page: 1,
          force_rotation: 0,
          rotation_applied: 0,
          recommended_zoom: 120,
        };
      });
    }

    // 5. Vincular cada highlight a la URL de streaming del PDF real
    const citations = extractedHighlights.map((hl: any, idx: number) => {
      const targetDoc = (
        hl.target_document || 
        hl.target_file || 
        documentMeta?.target_document || 
        documentMeta?.filename || 
        hl.sheet_number || 
        ''
      ).trim();
      const exactSnippet = hl.exact_quoted_text || hl.referenced_text_snippet || '';
      const color = hl.color || hl.style?.color || '#F59E0B';
      const pageNumber = typeof hl.target_page === 'number'
        ? hl.target_page
        : (typeof hl.page_number === 'number' 
          ? hl.page_number 
          : (typeof documentMeta?.target_page === 'number' ? documentMeta.target_page : 1));

      const rotation = typeof hl.force_rotation === 'number'
        ? hl.force_rotation
        : (typeof hl.rotation_applied === 'number'
          ? hl.rotation_applied
          : (typeof documentMeta?.force_rotation === 'number'
            ? documentMeta.force_rotation
            : (typeof documentMeta?.recommended_rotation === 'number' ? documentMeta.recommended_rotation : 0)));

      const autoZoom = typeof hl.recommended_zoom === 'number'
        ? hl.recommended_zoom
        : (typeof hl.auto_zoom === 'number'
          ? hl.auto_zoom
          : (typeof documentMeta?.recommended_zoom === 'number' ? documentMeta.recommended_zoom : 120));

      // Encontrar URI de GCS coincidente
      let gcsUri = '';

      // Heurísticas directas para documentos clave del proyecto
      const lowerDoc = targetDoc.toLowerCase();
      if (lowerDoc.includes('sarps') || lowerDoc.includes('attachment d')) {
        gcsUri = 'gs://frcg-projects/2026-12-01  Hospital Trauma/Bid Set w. add #02/Specifications/RFP/Attachment/Attachment D SARPS Recommendations.pdf';
      } else if (lowerDoc.includes('attachment b') || lowerDoc.includes('technical spec')) {
        gcsUri = 'gs://frcg-projects/2026-12-01  Hospital Trauma/Bid Set w. add #02/Specifications/Technical Specifications/Attachment B Technical Specifications.pdf';
      } else if (lowerDoc.includes('addendum 3') || lowerDoc.includes('add #03') || lowerDoc.includes('addendum no. 3')) {
        gcsUri = 'gs://frcg-projects/2026-12-01  Hospital Trauma/Bid Set w. add #02/Addenda/Addendum No. 3.pdf';
      }

      if (!gcsUri) {
        const matchingContext = rawContexts.find((rc) => {
          if (!rc.sourceUri) return false;
          const uriLower = rc.sourceUri.toLowerCase();
          if (targetDoc && uriLower.includes(targetDoc.toLowerCase())) return true;
          if (exactSnippet && rc.text && rc.text.includes(exactSnippet.substring(0, 30))) return true;
          return false;
        });

        gcsUri = matchingContext?.sourceUri || rawContexts[idx % (rawContexts.length || 1)]?.sourceUri || `gs://frcg-projects/2026-12-01  Hospital Trauma/Bid Set/Drawings/Architectural/${targetDoc || 'Drawing'}.pdf`;
      }

      const info = parseSheetInfo(gcsUri);

      // Convertir box_2d [ymin, xmin, ymax, xmax] (0-1000 scale) a porcentajes [left%, top%, width%, height%]
      const [ymin, xmin, ymax, xmax] = hl.box_2d || [200, 150, 450, 600];
      const top = (ymin / 1000) * 100;
      const left = (xmin / 1000) * 100;
      const width = ((xmax - xmin) / 1000) * 100;
      const height = ((ymax - ymin) / 1000) * 100;

      return {
        id: hl.id || `HL-${idx + 1}`,
        sheet_number: hl.sheet_number || info.sheetName,
        target_document: targetDoc || info.sheetName,
        sheet_title: hl.sheet_title || info.sheetTitle,
        discipline: info.discipline,
        revision: hl.revision_status || 'Current IFC',
        revision_date: '2026-10-29',
        is_current_ifc: !hl.revision_status?.toUpperCase().includes('SUPERSEDED'),
        page_number: pageNumber,
        target_page: pageNumber,
        total_pages: 1,
        rotation: rotation,
        force_rotation: rotation,
        recommended_rotation: rotation,
        auto_zoom: autoZoom,
        recommended_zoom: autoZoom,
        file_url: `/api/pdf?uri=${encodeURIComponent(gcsUri)}`,
        gcs_uri: gcsUri,
        bounding_box: [left, top, width, height], // Normalized for canvas
        box_2d: hl.box_2d || [ymin, xmin, ymax, xmax],
        exact_quoted_text: exactSnippet,
        color: color,
        style: hl.style || { color, border_style: 'solid', border_width: 2 },
        text_excerpt: exactSnippet || hl.referenced_text_snippet || '',
        callout_tag: hl.label || `${targetDoc || info.sheetName}`,
      };
    });

    return NextResponse.json({
      answer: informeTecnico,
      viewer_navigation: documentMeta,
      document: documentMeta,
      highlights: extractedHighlights,
      citations: citations,
      suggested_followups: [
        'Comprobar compatibilidad con marcos de acero y divisiones CSI 08',
        'Revisar especificaciones técnicas y requisitos de prueba ASTM',
        'Generar RFI formal para aclaración técnica con el proyectista',
      ],
    });
  } catch (error: any) {
    console.error('API /query dual format error:', error);
    return NextResponse.json(
      { error: error.message || 'Error executing dual output AEC audit' },
      { status: 500 }
    );
  }
}
