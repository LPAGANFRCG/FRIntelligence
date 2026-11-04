import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import { CitationSource, DisciplineType } from '@/types/construction-rag';

const PROJECT_ID = 'frcg-antigravity';
const PROJECT_NUMBER = '1004674164524';
const CORPUS_ID = `projects/${PROJECT_NUMBER}/locations/us-central1/ragCorpora/255759598760230912`;

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

const AEC_AUDITOR_SYSTEM_PROMPT = `Actúa como Ingeniero de Proyecto y Auditor de Documentos Técnicos AEC para Proyectos de Construcción en Puerto Rico (Estilo Chief Estimator & Senior Project Engineer).

JERARQUÍA Y PRECEDENCIA CONTRACTUAL OBLIGATORIA DE ARCHIVOS:
Debes clasificar y procesar internamente cada fragmento recuperado del RAG según su orden jerárquico estricto:

1. RFI / Aclaraciones (Archivos con "RFI", "Clarifications" o "Exhibit 1" en .../FRCG/RFI/):
   - Prioridad 1: Representan la interpretación vinculante más reciente sobre dudas de contratistas y licitadores.
   - Si la consulta menciona "RFI", preguntas o aclaraciones, prioriza explícitamente las respuestas contenidas en estos archivos antes de generalidades.
2. Addenda (Carpetas "Addenda" / "Add #03", "Add #02", "Add #01" en .../Bid Set/Addenda/):
   - Prioridades 2, 3 y 4: Los addenda posteriores modifican y prevalecen sobre addenda anteriores y sobre el Bid Set original (Add #03 > Add #02 > Add #01 > Bid Set).
   - Identifica siempre el número de Addendum citado y advierte si modifica planos preliminares (Rev 0).
3. Especificaciones Técnicas (Carpetas .../Specifications/ o "TS"):
   - Prioridad 5: Rigen la calidad de materiales, normas ASTM/ACI, pruebas de laboratorio y requisitos de submittals.
4. Planos / Drawings (Carpetas .../Drawings/ o archivos con prefijos A-, S-, M-, E-, P-, C-):
   - Prioridad 5: Rigen cantidades, dimensiones, ubicaciones y layouts. Prevalecen sobre especificaciones en cantidades y detalles geométricos.
5. Cómputos / Take-Off (.../Take-Off/):
   - Prioridad 6: Cómputos y metrados internos informativos de estimación.

REGLAS OBLIGATORIAS DE RESPUESTA:
- Cuando el usuario pregunte por un "RFI" o "Addendum", revisa y cita primero los documentos de esas categorías antes de responder con generalidades del libro de especificaciones.
- En el bloque de texto y citas, indica siempre la procedencia clara de cada afirmación con los tags interactivos [[HL-1]], [[HL-2]], etc.
- REDACCIÓN EJECUTIVA LIMPIA: Cero asteriscos triples (***) o dobles sueltos. Usa títulos limpios y listas bien organizadas.
- Al final absoluto y ÚNICAMENTE dentro de \`\`\`json:highlights\`\`\`, incluye la metadata para el visor interactivo (viewer_navigation y highlights). El texto principal debe quedar 100% limpio de llaves JSON.

FORMATO OBLIGATORIO DE SALIDA:

[Respuesta ejecutiva, técnica y contractual limpia, estructurada por jerarquía y con referencias [[HL-1]]]

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
      "label": "[PLANO] Detalle de Lámpara Quirúrgica",
      "box_2d": [730, 480, 758, 580],
      "exact_quoted_text": "SURGICAL O.R. THREE-LIGHT HEAD LAMP(CEILING MOUNTED)...",
      "color": "#F59E0B"
    }
  ]
}
\`\`\``;

interface DocumentHierarchyInfo {
  doc_type: 'RFI' | 'ADDENDUM' | 'SPECIFICATION' | 'DRAWING' | 'TAKEOFF' | 'GENERAL';
  priority: number;
  category_tag: string;
  rev: string;
  discipline: DisciplineType | string;
  sheetName: string;
  sheetTitle: string;
  filename: string;
  folder_path: string;
  isCurrent: boolean;
  color: string;
}

/**
 * Clasificador estricto de jerarquía documental AEC según la ruta en el bucket
 * "2026-12-01 Hospital Trauma/"
 */
function classifyDocumentHierarchy(sourceUri: string): DocumentHierarchyInfo {
  const uri = decodeURIComponent(sourceUri || '');
  const filename = uri.split('/').pop() || 'Documento.pdf';
  const folderPath = uri.substring(0, uri.lastIndexOf('/'));
  const cleanName = filename.replace(/\.pdf$/i, '').replace(/\.docx?$/i, '');

  let doc_type: DocumentHierarchyInfo['doc_type'] = 'GENERAL';
  let priority = 7;
  let category_tag = '[DOC]';
  let rev = 'Rev 0';
  let discipline: DisciplineType | string = 'General';
  let sheetName = cleanName.substring(0, 24);
  let sheetTitle = cleanName;
  let isCurrent = true;
  let color = '#71717A';

  // 1. RFI / Aclaraciones (.../FRCG/RFI/ o Exhibit 1) -> Prioridad 1
  if (
    uri.includes('/FRCG/RFI/') ||
    uri.includes('Exhibit 1 Request for Clarifications') ||
    uri.includes('Request_for_Clarifications') ||
    cleanName.toLowerCase().includes('rfi') ||
    cleanName.toLowerCase().includes('clarification')
  ) {
    doc_type = 'RFI';
    priority = 1;
    category_tag = '[RFI]';
    discipline = 'Specs';
    color = '#F59E0B'; // Ámbar dorado
    sheetName = 'RFI Clarification';
    if (cleanName.includes('Completed_')) {
      const matchNum = cleanName.match(/Completed_([0-9\-]+)/);
      if (matchNum) sheetName = `RFI #${matchNum[1]}`;
    } else if (cleanName.match(/RFI[_\-\s]*(\d+)/i)) {
      const matchRfi = cleanName.match(/RFI[_\-\s]*(\d+)/i);
      if (matchRfi) sheetName = `RFI #${matchRfi[1]}`;
    }
    sheetTitle = cleanName.replace(/[-_]/g, ' ').trim() || 'RFI Clarification Document';
  }
  // 2. Addendum 03 (.../Bid Set/Addenda/2026-10-29 - Add #03/) -> Prioridad 2 (Vigente)
  else if (
    uri.includes('Add #03') ||
    uri.includes('Add#03') ||
    uri.includes('Addendum+No.+3') ||
    uri.includes('Addendum No. 3') ||
    uri.includes('enmienda_Num_3') ||
    cleanName.includes('Addendum 3') ||
    cleanName.includes('Add #03')
  ) {
    doc_type = 'ADDENDUM';
    rev = 'Add 03';
    priority = 2;
    category_tag = '[ADDENDUM 03]';
    discipline = 'Addenda';
    color = '#10B981'; // Esmeralda (vigente)
    sheetName = 'Addendum No. 3';
    sheetTitle = cleanName.replace(/[-_]/g, ' ').trim() || 'Addendum No. 3 - Official Clarifications';
    isCurrent = true;
  }
  // 3. Addendum 02 (.../Bid Set/Addenda/2026-10-16 - Add#02/) -> Prioridad 3
  else if (
    uri.includes('Add #02') ||
    uri.includes('Add#02') ||
    uri.includes('Addendum+No.+2') ||
    uri.includes('Addendum No. 2') ||
    uri.includes('enmienda_Num_2') ||
    cleanName.includes('Addendum 2') ||
    cleanName.includes('Add #02')
  ) {
    doc_type = 'ADDENDUM';
    rev = 'Add 02';
    priority = 3;
    category_tag = '[ADDENDUM 02]';
    discipline = 'Addenda';
    color = '#3B82F6'; // Azul
    sheetName = 'Addendum No. 2';
    sheetTitle = cleanName.replace(/[-_]/g, ' ').trim() || 'Addendum No. 2 Document';
    isCurrent = true;
  }
  // 4. Addendum 01 (.../Bid Set/Addenda/2026-10-08 - Add #01/) -> Prioridad 4
  else if (
    uri.includes('Add #01') ||
    uri.includes('Add#01') ||
    uri.includes('Addendum+No+1') ||
    uri.includes('Addendum No. 1') ||
    uri.includes('enmienda_Num_1') ||
    cleanName.includes('Addendum 1') ||
    cleanName.includes('Add #01')
  ) {
    doc_type = 'ADDENDUM';
    rev = 'Add 01';
    priority = 4;
    category_tag = '[ADDENDUM 01]';
    discipline = 'Addenda';
    color = '#8B5CF6'; // Violeta
    sheetName = 'Addendum No. 1';
    sheetTitle = cleanName.replace(/[-_]/g, ' ').trim() || 'Addendum No. 1 Document';
    isCurrent = false;
  }
  // 5. Especificaciones Técnicas (.../Bid Set/Specifications/ o TS) -> Prioridad 5
  else if (
    uri.includes('/Specifications/') ||
    uri.includes('/TS-') ||
    uri.includes('Attachment') ||
    uri.includes('ATCH-')
  ) {
    doc_type = 'SPECIFICATION';
    priority = 5;
    category_tag = '[SPEC]';
    discipline = 'Specs';
    color = '#06B6D4'; // Cian
    const atchMatch = cleanName.match(/(Attachment\s+[A-Z0-9]+|ATCH-[A-Z0-9]+)/i);
    if (atchMatch) {
      sheetName = atchMatch[1].replace('ATCH-', 'Attachment ');
      sheetTitle = cleanName.replace(atchMatch[0], '').replace(/[-_]/g, ' ').trim() || 'Project Specification';
    } else {
      sheetName = cleanName.substring(0, 24);
      sheetTitle = cleanName.replace(/[-_]/g, ' ').trim();
    }
  }
  // 6. Planos / Drawings (.../Bid Set/Drawings/ o prefijos A-, S-, M-, E-, P-) -> Prioridad 5
  else if (
    uri.includes('/Drawings/') ||
    cleanName.match(/^[A-Z]-\d+(\.\d+)?[A-Z]?/i) ||
    cleanName.match(/^(CU|ED|EX|GL|PL|TS|FP|EP|MP|SP)-\d+/i)
  ) {
    doc_type = 'DRAWING';
    priority = 5;
    category_tag = '[DRAWING]';
    color = '#F59E0B'; // Ámbar
    const sheetMatch = cleanName.match(/([A-Z]{1,2}-\d+(\.\d+)?[A-Z]?)/i);
    if (sheetMatch) {
      sheetName = sheetMatch[1].toUpperCase();
      if (uri.includes('/Architectural/') || sheetName.startsWith('A-')) discipline = 'Architectural';
      else if (uri.includes('/Structural/') || sheetName.startsWith('S-')) discipline = 'Structural';
      else if (uri.includes('/Mechanical/') || sheetName.startsWith('M-')) discipline = 'Mechanical';
      else if (uri.includes('/Plumbing/') || sheetName.startsWith('P-')) discipline = 'Plumbing';
      else if (uri.includes('/Electrical/') || sheetName.startsWith('E-')) discipline = 'Electrical';
      else if (uri.includes('/Civil/') || sheetName.startsWith('C-')) discipline = 'Civil';
    }
    sheetTitle = cleanName
      .replace(/^[A-Z]{1,2}-\d+(\.\d+)?[A-Z]?-?/i, '')
      .replace(/-Rev\.\d+/i, '')
      .replace(/[-_]/g, ' ')
      .trim() || 'Plano de Construcción';
    isCurrent = !uri.toLowerCase().includes('rev.0') || uri.toLowerCase().includes('add #02');
  }
  // 7. Cómputos / Take-Off (.../Take-Off/) -> Prioridad 6
  else if (uri.includes('/Take-Off/') || cleanName.toLowerCase().includes('take off')) {
    doc_type = 'TAKEOFF';
    priority = 6;
    category_tag = '[TAKEOFF]';
    discipline = 'General';
    color = '#64748B'; // Slate
    sheetName = 'Cómputo Take-Off';
    sheetTitle = cleanName.replace(/[-_]/g, ' ').trim();
  }

  return {
    doc_type,
    priority,
    category_tag,
    rev,
    discipline,
    sheetName,
    sheetTitle,
    filename,
    folder_path: folderPath,
    isCurrent,
    color,
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

    // 2. Detección de Intención para Ponderación y Reranking
    const lowerQ = query.toLowerCase();
    const isRfiQuery =
      lowerQ.includes('rfi') ||
      lowerQ.includes('aclaraci') ||
      lowerQ.includes('clarification') ||
      lowerQ.includes('pregunta') ||
      lowerQ.includes('duda') ||
      lowerQ.includes('respuesta') ||
      lowerQ.includes('exhibit 1');

    const isAddendumQuery =
      lowerQ.includes('addendum') ||
      lowerQ.includes('adenda') ||
      lowerQ.includes('enmienda') ||
      lowerQ.includes('add #') ||
      lowerQ.includes('add#') ||
      lowerQ.includes('cambio') ||
      lowerQ.includes('modific');

    const isDrawingQuery =
      lowerQ.includes('plano') ||
      lowerQ.includes('drawing') ||
      lowerQ.includes('planta') ||
      lowerQ.includes('seccion') ||
      lowerQ.includes('elevacion') ||
      lowerQ.includes('layout') ||
      lowerQ.includes('dimension');

    const isSpecQuery =
      lowerQ.includes('especificacion') ||
      lowerQ.includes('norma') ||
      lowerQ.includes('astm') ||
      lowerQ.includes('aci') ||
      lowerQ.includes('material') ||
      lowerQ.includes('submittal');

    // 3. Ejecutar recuperación de fragmentos del Corpus RAG en us-central1 (umbral amplio para candidatos)
    const vertexRetrievalUrl = `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/us-central1:retrieveContexts`;

    const ragResponse = await fetch(vertexRetrievalUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vertexRagStore: {
          ragResources: [
            {
              ragCorpus: `projects/${PROJECT_ID}/locations/us-central1/ragCorpora/255759598760230912`,
            },
          ],
          vectorDistanceThreshold: 0.9,
        },
        query: { text: query },
      }),
    });

    let rawContexts: any[] = [];
    if (ragResponse.ok) {
      const ragData = await ragResponse.json();
      rawContexts = ragData.contexts?.contexts || [];
    }

    // 4. Inyección de Metadatos y Ponderación Jerárquica Contractual
    const enrichedContexts = rawContexts.map((ctx: any) => {
      const hierarchy = classifyDocumentHierarchy(ctx.sourceUri || '');
      const dist = typeof ctx.distance === 'number' ? ctx.distance : 0.5;

      // Cálculo de Score Ponderado: menor score = mayor relevancia
      let weightedScore = hierarchy.priority * 10 + dist * 5;

      // Ponderación agresiva si la consulta busca RFIs o Addendums
      if (isRfiQuery && hierarchy.doc_type === 'RFI') {
        weightedScore -= 50; // Prioriza RFIs al tope absoluto
      }
      if (isAddendumQuery && hierarchy.doc_type === 'ADDENDUM') {
        weightedScore -= 40; // Prioriza Addendums
        if (hierarchy.rev === 'Add 03') weightedScore -= 15; // Add 03 vigente tiene máxima prioridad
      }
      if (isSpecQuery && hierarchy.doc_type === 'SPECIFICATION') {
        weightedScore -= 20;
      }
      if (isDrawingQuery && hierarchy.doc_type === 'DRAWING') {
        weightedScore -= 20;
      }

      return {
        ...ctx,
        hierarchy,
        weightedScore,
      };
    });

    // Ordenar por score ponderado contractual
    enrichedContexts.sort((a: any, b: any) => a.weightedScore - b.weightedScore);

    // Seleccionar los mejores 8 fragmentos para el dossier
    const topContexts = enrichedContexts.slice(0, 8);

    // 5. Construir Dossier con Metadatos Inyectados y Jerarquía Contractual
    let contextDossier = '';
    if (topContexts.length > 0) {
      contextDossier =
        '\n\nEXPEDIENTE CONTRACTUAL JERÁRQUICO RECUPERADO DE VERTEX AI RAG:\n' +
        topContexts
          .map((ctx: any, idx: number) => {
            const h = ctx.hierarchy;
            const precedenceLabel =
              h.priority === 1
                ? 'MÁXIMA - Aclaración Vinculante RFI (Respuesta Oficial a Contratistas)'
                : h.priority === 2
                ? 'ALTA - Addendum No. 3 Vigente (Prevalece sobre Add #01, Add #02 y Planos Rev 0)'
                : h.priority === 3
                ? 'ALTA - Addendum No. 2'
                : h.priority === 4
                ? 'MEDIA - Addendum No. 1'
                : h.doc_type === 'SPECIFICATION'
                ? 'NORMATIVA - Especificaciones Técnicas (Calidad, Materiales, ASTM/ACI)'
                : 'GEOMÉTRICA - Planos de Obra (Dimensiones, Cómputos, Layouts)';

            return (
              `--- DOCUMENTO [${idx + 1}] ${h.category_tag} Prioridad: ${h.priority} | Tipo: ${h.doc_type} ---\n` +
              `Archivo: ${h.filename}\n` +
              `Ruta GCS: ${ctx.sourceUri}\n` +
              `Prevalencia Contractual: ${precedenceLabel}\n` +
              `Contenido:\n${(ctx.text || '').trim()}\n`
            );
          })
          .join('\n');
    }

    const interpretationUserPrompt = `CONSULTA TÉCNICA DEL CONTRATISTA / ESTIMADOR:
"${query}"
${contextDossier}

INSTRUCCIÓN DE AUDITORÍA CONTRACTUAL Y JERARQUÍA (OBLIGATORIA):
Procesa estos documentos aplicando con rigor la jerarquía documental de obras públicas:
- Si la consulta es sobre un RFI o duda, responde directamente con la aclaración vinculante de [RFI] (Prioridad 1).
- Si existe contradicción entre un plano preliminar (Rev 0) y un Addendum posterior ([ADDENDUM 03]), prevalece siempre el Addendum más reciente.
- Cita cada afirmación técnica con su tag correspondiente [[HL-1]], [[HL-2]], indicando la procedencia [RFI], [ADDENDUM] o [PLANO].
- Redacción ejecutiva, limpia y directa: PROHIBIDO usar asteriscos triples (***) o símbolos molestos de markdown.
- Cierra obligatoriamente con el bloque \`\`\`json:highlights\`\`\` para orientar y enfocar el visor PDF.`;

    // 6. Ejecutar Generación e Interpretación con Gemini en location=global
    const generateUrl = `https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/publishers/google/models/gemini-3.1-flash-lite:generateContent`;

    const modelPayload = {
      systemInstruction: {
        parts: [{ text: AEC_AUDITOR_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: interpretationUserPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.35,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    };

    const genResponse = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
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

    // 7. Procesar el Formato de Salida Dual
    let informeTecnico = fullGeneratedText;
    let documentMeta: any = null;
    let extractedHighlights: any[] = [];

    const jsonMatch = fullGeneratedText.match(/```(?:json:highlights|json)\s*([\s\S]*?)\s*```/i);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        documentMeta = parsed.viewer_navigation || parsed.document || null;
        extractedHighlights = parsed.highlights || [];
        informeTecnico = fullGeneratedText.replace(jsonMatch[0], '').trim();
        informeTecnico = informeTecnico.replace(/\*\*\*/g, '**');
      } catch (parseErr) {
        console.warn('Error parsing highlights JSON from model output:', parseErr);
      }
    }

    // Si el modelo no generó highlights JSON explícito, construirlo a partir de los topContexts
    if (extractedHighlights.length === 0 && topContexts.length > 0) {
      extractedHighlights = topContexts.slice(0, 4).map((ctx: any, idx: number) => {
        const h = ctx.hierarchy;
        const ymin = 180 + (idx * 150) % 600;
        const xmin = 120 + (idx * 100) % 500;
        const ymax = ymin + 180;
        const xmax = xmin + 420;

        return {
          id: `HL-${idx + 1}`,
          sheet_number: h.sheetName,
          sheet_title: h.sheetTitle,
          revision_status: h.isCurrent ? `${h.category_tag} CURRENT` : `${h.category_tag} SUPERSEDED`,
          label: `${h.category_tag} ${h.sheetName}`,
          color: h.color,
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

    // 8. Vincular cada highlight a la URL de streaming del PDF real con metadata jerárquica
    const citations: CitationSource[] = extractedHighlights.map((hl: any, idx: number) => {
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
      const pageNumber =
        typeof hl.target_page === 'number'
          ? hl.target_page
          : typeof hl.page_number === 'number'
          ? hl.page_number
          : typeof documentMeta?.target_page === 'number'
          ? documentMeta.target_page
          : 1;

      const rotation =
        typeof hl.force_rotation === 'number'
          ? hl.force_rotation
          : typeof hl.rotation_applied === 'number'
          ? hl.rotation_applied
          : typeof documentMeta?.force_rotation === 'number'
          ? documentMeta.force_rotation
          : typeof documentMeta?.recommended_rotation === 'number'
          ? documentMeta.recommended_rotation
          : 0;

      const autoZoom =
        typeof hl.recommended_zoom === 'number'
          ? hl.recommended_zoom
          : typeof hl.auto_zoom === 'number'
          ? hl.auto_zoom
          : typeof documentMeta?.recommended_zoom === 'number'
          ? documentMeta.recommended_zoom
          : 120;

      // Encontrar URI de GCS coincidente
      let gcsUri = '';
      const lowerDoc = targetDoc.toLowerCase();

      if (lowerDoc.includes('sarps') || lowerDoc.includes('attachment d')) {
        gcsUri =
          'gs://frcg-projects/2026-12-01  Hospital Trauma/Bid Set w. add #02/Specifications/RFP/Attachment/Attachment D SARPS Recommendations.pdf';
      } else if (lowerDoc.includes('attachment b') || lowerDoc.includes('technical spec')) {
        gcsUri =
          'gs://frcg-projects/2026-12-01  Hospital Trauma/Bid Set w. add #02/Specifications/Technical Specifications/Attachment B Technical Specifications.pdf';
      } else if (
        lowerDoc.includes('addendum 3') ||
        lowerDoc.includes('add #03') ||
        lowerDoc.includes('add#03') ||
        lowerDoc.includes('addendum no. 3')
      ) {
        gcsUri =
          'gs://frcg-projects/2026-12-01  Hospital Trauma/Bid Set/Addenda/2026-10-29 - Add#03/Addendum+No.+3.pdf';
      } else if (lowerDoc.includes('rfi') || lowerDoc.includes('clarification') || lowerDoc.includes('exhibit 1')) {
        gcsUri =
          'gs://frcg-projects/2026-12-01  Hospital Trauma/FRCG/RFI/Exhibit 1 Request for Clarifications - FRCG Completed_20-26 (combined).pdf';
      }

      if (!gcsUri) {
        const matchingContext = topContexts.find((rc: any) => {
          if (!rc.sourceUri) return false;
          const uriLower = rc.sourceUri.toLowerCase();
          if (targetDoc && uriLower.includes(targetDoc.toLowerCase())) return true;
          if (exactSnippet && rc.text && rc.text.includes(exactSnippet.substring(0, 30))) return true;
          return false;
        });

        gcsUri =
          matchingContext?.sourceUri ||
          topContexts[idx % (topContexts.length || 1)]?.sourceUri ||
          `gs://frcg-projects/2026-12-01  Hospital Trauma/Bid Set/Drawings/Architectural/${targetDoc || 'Drawing'}.pdf`;
      }

      const h = classifyDocumentHierarchy(gcsUri);

      // Convertir box_2d [ymin, xmin, ymax, xmax] (0-1000 scale) a porcentajes [left%, top%, width%, height%]
      const [ymin, xmin, ymax, xmax] = hl.box_2d || [200, 150, 450, 600];
      const top = (ymin / 1000) * 100;
      const left = (xmin / 1000) * 100;
      const width = ((xmax - xmin) / 1000) * 100;
      const height = ((ymax - ymin) / 1000) * 100;

      const calloutLabel = hl.label
        ? (hl.label.startsWith('[') ? hl.label : `${h.category_tag} ${hl.label}`)
        : `${h.category_tag} ${targetDoc || h.sheetName}`;

      return {
        id: hl.id || `HL-${idx + 1}`,
        sheet_number: hl.sheet_number || h.sheetName,
        target_document: targetDoc || h.sheetName,
        sheet_title: hl.sheet_title || h.sheetTitle,
        discipline: h.discipline as DisciplineType,
        revision: hl.revision_status || (h.isCurrent ? `${h.category_tag} Current` : `${h.category_tag} Superseded`),
        revision_date: '2026-10-29',
        is_current_ifc: h.isCurrent,
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
        bounding_box: [left, top, width, height],
        box_2d: hl.box_2d || [ymin, xmin, ymax, xmax],
        exact_quoted_text: exactSnippet,
        color: hl.color || h.color || color,
        style: hl.style || { color: hl.color || h.color || color, border_style: 'solid', border_width: 2 },
        text_excerpt: exactSnippet || hl.referenced_text_snippet || '',
        callout_tag: calloutLabel,
        doc_type: h.doc_type,
        category_tag: h.category_tag,
        priority: h.priority,
        folder_path: h.folder_path,
        file_name: h.filename,
      };
    });

    return NextResponse.json({
      answer: informeTecnico,
      viewer_navigation: documentMeta,
      document: documentMeta,
      highlights: extractedHighlights,
      citations: citations,
      suggested_followups: [
        '¿Cuáles son las aclaraciones vigentes de RFI sobre plomería y gases médicos?',
        'Verificar cambios del Addendum No. 3 en techos y filtros HEPA de quirófanos',
        'Auditar interferencias entre ductos MEP y especificación de Plenum',
        'Generar borrador de RFI formal para Procore ante ambigüedad en planos',
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
