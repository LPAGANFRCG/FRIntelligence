import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

const PROJECT_ID = 'frcg-antigravity';
const PROJECT_NUMBER = '1004674164524';
const CORPUS_ID = `projects/${PROJECT_NUMBER}/locations/us-central1/ragCorpora/255759598760230912`;

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

const AEC_AUDITOR_SYSTEM_PROMPT = `Actúa como Auditor Técnico AEC y Motor de Anotación Espacial para Especificaciones y Planos de Hospitales.

REGLAS CRÍTICAS DE PÁGINA Y HIGHLIGHTS:

1. Prohibido apuntar a la Portada / Página 1 (Page Target Estricto):
   - En libros de especificaciones o anexos multipágina (ej. Attachment B Technical Specifications de 829 páginas, Attachment D SARPS, Addendum No. 3), las cláusulas técnicas NUNCA están en la portada (página 1).
   - Extrae obligatoriamente el número de página real ("target_page" / "page_number") dentro del documento PDF donde reside la cláusula citada (ej. si la sección de puertas contra fuego o dampers está en la página 127 o 342, reporta 127 o 342).
   - Extrae el número de página real del chunk recuperado por el corpus RAG.

2. Ajuste Estricto del Bounding Box (Tight Fit - No cajas vacías):
   - Cada caja "box_2d" debe abarcar ÚNICA y EXCLUSIVAMENTE el párrafo, tabla, nota o detalle que contiene la prueba directa de lo que afirmas.
   - Prohibido incluir márgenes en blanco, párrafos adyacentes o títulos no relacionados.
   - Si no estás 100% seguro de la posición geométrica exacta [ymin, xmin, ymax, xmax] en esa página, NO inventes coordenadas genéricas al centro.
   - Provee siempre "exact_quoted_text" con la frase o párrafo exacto citado para que el cliente pueda hacer snap visual con PDF.js al texto real renderizado.
   - Las coordenadas normalizadas van de 0 a 1000: [ymin, xmin, ymax, xmax] donde (0,0) es la esquina superior izquierda de la página y (1000,1000) la inferior derecha.

3. Orientación y Zoom Recomendado:
   - "recommended_rotation": 0, 90, 180, o 270 según la orientación nativa de lectura.
   - "auto_zoom": porcentaje de zoom sugerido (ej. 120, 140, 200) para enfocar y centrar la nota legiblemente.

4. Sincronización Interactiva en el Texto:
   - Cada afirmación o partida analizada debe concluir con el badge del highlight correspondiente: [[HL-#]] para que el frontend vincule el click/hover al viewport del visor.

FORMATO OBLIGATORIO DE RESPUESTA:

### REPORTE TÉCNICO
[Presenta tu análisis técnico clasificado por División CSI, requerimientos de especificación, impacto en el estimado y alertas de revisión, insertando los badges [[HL-1]], [[HL-2]], etc.]

\`\`\`json:highlights
{
  "document": {
    "filename": "Attachment B Technical Specifications.pdf",
    "target_page": 127,
    "recommended_rotation": 0,
    "recommended_zoom": 130
  },
  "highlights": [
    {
      "id": "HL-1",
      "target_file": "Attachment B Technical Specifications.pdf",
      "target_page": 127,
      "label": "Requerimientos de Puertas y Fuego",
      "exact_quoted_text": "Door assemblies subject to smoke compartmentation and fire-resistance...",
      "box_2d": [320, 150, 480, 850],
      "rotation_applied": 0,
      "auto_zoom": 130
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
        documentMeta = parsed.document || null;
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
          color: info.isCurrent ? '#FFB800' : '#FF3B30',
          box_2d: [ymin, xmin, ymax, xmax],
          referenced_text_snippet: (ctx.text || '').substring(0, 300),
          gcs_uri: ctx.sourceUri,
          page_number: 1,
          target_page: 1,
          rotation_applied: 0,
          auto_zoom: 120,
        };
      });
    }

    // 5. Vincular cada highlight a la URL de streaming del PDF real
    const citations = extractedHighlights.map((hl: any, idx: number) => {
      const targetDoc = (hl.target_file || hl.target_document || documentMeta?.filename || hl.sheet_number || '').trim();
      const exactSnippet = hl.exact_quoted_text || hl.referenced_text_snippet || '';
      const color = hl.style?.color || hl.color || '#F5A623';
      const pageNumber = typeof hl.target_page === 'number'
        ? hl.target_page
        : (typeof hl.page_number === 'number' 
          ? hl.page_number 
          : (typeof documentMeta?.target_page === 'number' ? documentMeta.target_page : 1));

      const rotation = typeof hl.rotation_applied === 'number'
        ? hl.rotation_applied
        : (typeof documentMeta?.recommended_rotation === 'number' ? documentMeta.recommended_rotation : 0);

      const autoZoom = typeof hl.auto_zoom === 'number'
        ? hl.auto_zoom
        : (typeof documentMeta?.recommended_zoom === 'number' ? documentMeta.recommended_zoom : 130);

      // Encontrar URI de GCS coincidente
      let gcsUri = '';

      // Direct document heuristics for known key documents
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
        total_pages: 1,
        rotation: rotation,
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
      document: documentMeta,
      highlights: extractedHighlights,
      citations: citations,
      suggested_followups: [
        'Comprobar compatibilidad con marcos de acero y divisiones CSI 08',
        'Revisar cerraduras con certificación ANSI/BHMA y cilindros maestros',
        'Generar RFI formal para aprobación de submittal de cerrajería',
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
