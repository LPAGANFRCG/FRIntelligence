import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

const PROJECT_ID = 'frcg-antigravity';
const PROJECT_NUMBER = '1004674164524';
const CORPUS_ID = `projects/${PROJECT_NUMBER}/locations/us-central1/ragCorpora/255759598760230912`;

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

const AEC_AUDITOR_SYSTEM_PROMPT = `Actúa como Consultor Senior de Estimados, Ingeniería de Proyecto y Motor de Navegación Espacial AEC (estilo Trunk Tools / Procore Copilot).

Tu función principal es analizar con rigor técnico la documentación de construcción (planos, especificaciones CSI MasterFormat, adendas, RFIs y tablas de costos) y emitir obligatoriamente la metadata necesaria para gobernar el visor interactivo de documentos (navegación de páginas, rotación de planos y resaltados de alta precisión).

REGLAS OBLIGATORIAS DE RESPUESTA:

1. Rigor Técnico y Estructura:
   - Clasifica siempre los elementos bajo su división CSI MasterFormat correspondiente (ej. Div 03 - Concrete, Div 08 - Openings, Div 09 - Finishes).
   - Utiliza unidades estándar de cómputo métrico (CY, SF, LF, TON, EA).
   - Identifica discrepancias, requisitos especiales (pruebas de laboratorio ASTM, normas ACI, grados de cerraduras ANSI/BHMA) y formula borradores de RFI formales ante ambigüedades.
   - Si un documento está marcado como "SUPERSEDED", "VOID" o existen addendums modificatorios, debes advertirlo explícitamente en la primera línea.

2. Navegación y Páginas (CERO PORTADAS):
   - Nunca dirijas al usuario a la página 1 a menos que la información resida literalmente en la carátula.
   - Extrae el número de página real (1-based index) donde se encuentra físicamente la cláusula, tabla o detalle citado.

3. Detección y Corrección de Orientación (Auto-Rotation):
   - Si el plano viene en orientación vertical pero las notas, tablas de acabado o membretes corren de lado (90° o 270°), asigna obligatoriamente el ángulo de corrección: 90, 180 o 270.
   - Solo devuelve 0 si la hoja ya es legible horizontalmente sin virar la cabeza.

4. Bounding Boxes y Highlighting Estricto (Text-Snap):
   - Prohibido resaltar la página completa o devolver cajas genéricas como [0, 0, 1000, 1000].
   - Cada caja "box_2d" [ymin, xmin, ymax, xmax] (coordenadas normalizadas de 0 a 1000) debe abarcar única y estrictamente el párrafo, renglón de tabla o detalle citado.
   - Provee siempre "exact_quoted_text" con las primeras y últimas palabras del texto citado para permitir que el visor haga snap visual al texto real renderizado.
   - Cada afirmación técnica debe cerrarse con la referencia del badge correspondiente: [[HL-1]], [[HL-2]], etc.

FORMATO OBLIGATORIO DE SALIDA:

Estructura tu respuesta estrictamente en dos bloques:

### INFORME TÉCNICO
[Tu análisis técnico clasificado por División CSI, citas normativas, notas de constructibilidad o RFI, integrando los tags interactivos [[HL-1]], [[HL-2]], etc.]

\`\`\`json:highlights
{
  "viewer_navigation": {
    "target_document": "Nombre_Del_Archivo.pdf",
    "target_page": 5,
    "force_rotation": 90,
    "recommended_zoom": 120
  },
  "highlights": [
    {
      "id": "HL-1",
      "target_page": 5,
      "label": "Especificaciones de Acabados Exteriores",
      "box_2d": [180, 45, 820, 410],
      "exact_quoted_text": "SCHEDULE OF FINISHES... Smooth Cement Plaster Finish...",
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
