import projectManifest from '@/config/project_manifest.json';

export interface RetrievalTarget {
  type: 'RFI' | 'ADDENDUM' | 'SPECIFICATION' | 'DRAWING_LATEST' | 'DRAWING_SUPERSEDED' | 'GENERAL';
  label: string;
  file: string;
  gcs_uri: string;
  search_query: string;
  filterKeywords: string[];
}

export interface PreRagIntentResult {
  isComparative: boolean;
  targetA?: RetrievalTarget;
  targetB?: RetrievalTarget;
  hasUnanswered: boolean;
  resolvedEntities: {
    rfiNumber?: number;
    addendumNumber?: number;
    sheetNumber?: string;
    divisionCode?: string;
  };
}

/**
 * Pre-RAG Intent Parser & Query Expansion Router.
 * Resuelve superlativos ("último RFI", "último Addendum", "versión vigente")
 * de forma determinística apoyándose en el Project Manifest del proyecto.
 */
export function parsePreRagIntent(query: string): PreRagIntentResult {
  const lower = query.toLowerCase();

  const hasLatestRfi =
    lower.includes('último rfi') ||
    lower.includes('ultimo rfi') ||
    lower.includes('rfi más reciente') ||
    lower.includes('rfi mas reciente') ||
    lower.includes('ultimos rfi') ||
    lower.includes('últimos rfi');

  const hasAddendum3 =
    lower.includes('addendum 3') ||
    lower.includes('addendum #3') ||
    lower.includes('adenda 3') ||
    lower.includes('add #03') ||
    lower.includes('add#03') ||
    lower.includes('último addendum') ||
    lower.includes('ultimo addendum') ||
    lower.includes('addendum mas reciente') ||
    lower.includes('addendum más reciente');

  const hasAddendum2 =
    lower.includes('addendum 2') ||
    lower.includes('addendum #2') ||
    lower.includes('adenda 2') ||
    lower.includes('add #02') ||
    lower.includes('add#02');

  const hasUnanswered =
    lower.includes('no se hayan contestado') ||
    lower.includes('no contestadas') ||
    lower.includes('sin contestar') ||
    lower.includes('pendientes') ||
    lower.includes('sin responder') ||
    lower.includes('no aclaradas');

  const manifest = projectManifest as any;
  const latestRfi = manifest.hierarchy_summary?.latest_rfi;
  const latestAddendum = manifest.hierarchy_summary?.latest_addendum;

  const resolvedEntities: PreRagIntentResult['resolvedEntities'] = {};

  // Caso 1: Comparación RFI vs Addendum (ej. preguntas no contestadas)
  if ((hasLatestRfi || lower.includes('rfi')) && (hasAddendum3 || hasAddendum2 || lower.includes('addendum') || lower.includes('adenda'))) {
    const targetAddendum = hasAddendum2
      ? manifest.addenda?.find((a: any) => a.number === 2) || latestAddendum
      : latestAddendum;

    resolvedEntities.rfiNumber = latestRfi?.end || 42;
    resolvedEntities.addendumNumber = targetAddendum?.number || 3;

    return {
      isComparative: true,
      targetA: {
        type: 'RFI',
        label: `DOCUMENTO DE CONSULTA (RFI #${latestRfi?.end || 42} - Más Reciente)`,
        file: latestRfi?.filename || 'Exhibit 1 Request for Clarifications - FRCG Completed_42.pdf',
        gcs_uri: latestRfi?.gcs_uri || '',
        search_query: `${query.replace(/addendum\s*#?3?/gi, '').trim()} RFI preguntas contratista FRCG`,
        filterKeywords: ['completed_42', 'completed_40-41', 'completed_27-39', 'rfi'],
      },
      targetB: {
        type: 'ADDENDUM',
        label: `DOCUMENTO DE GOBIERNO / RESPUESTA (${targetAddendum?.id || 'ADDENDUM-03'} - Vigente)`,
        file: targetAddendum?.main_file || 'Addendum+No.+3.pdf',
        gcs_uri: targetAddendum?.main_gcs_uri || '',
        search_query: `${query.replace(/rfi/gi, '').trim()} Addendum 3 respuestas oficiales aclaraciones enmienda`,
        filterKeywords: ['addendum+no.+3', 'add#03', 'add #03', 'enmienda_num_3'],
      },
      hasUnanswered,
      resolvedEntities,
    };
  }

  // Detección universal de Planos (Sheet Number ej. A-1.2A, CU-101, S-1.0)
  const sheetMatch = query.match(/([A-Z]{1,2}-\d+(\.\d+)?[A-Z]?)/i);
  if (sheetMatch) {
    resolvedEntities.sheetNumber = sheetMatch[1].toUpperCase();
  }

  // Caso 2: Comparación de versiones de Planos (ej. A-1.2A entre Bid Set y Addenda)
  if (
    sheetMatch &&
    (lower.includes('revisi') ||
      lower.includes('versi') ||
      lower.includes('vigente') ||
      lower.includes('bid set') ||
      lower.includes('addenda') ||
      lower.includes('cambio') ||
      lower.includes('diferencia'))
  ) {
    const sheet = sheetMatch[1].toUpperCase();
    const sheetData = manifest.drawings?.[sheet];

    if (sheetData && Array.isArray(sheetData.versions) && sheetData.versions.length > 0) {
      const latestVer = sheetData.versions.find((v: any) => v.is_latest) || sheetData.versions[0];
      const supersededVer =
        sheetData.versions.find((v: any) => v.is_superseded) ||
        sheetData.versions[sheetData.versions.length - 1];

      return {
        isComparative: true,
        targetA: {
          type: 'DRAWING_LATEST',
          label: `PLANO VIGENTE (${sheet} - ${latestVer.version_tag})`,
          file: latestVer.filename,
          gcs_uri: latestVer.gcs_uri,
          search_query: `${sheet} plano oficial vigente detalles notas`,
          filterKeywords: [latestVer.filename.toLowerCase(), sheet.toLowerCase()],
        },
        targetB: {
          type: 'DRAWING_SUPERSEDED',
          label: `PLANO PRELIMINAR (${sheet} - ${supersededVer.version_tag})`,
          file: supersededVer.filename,
          gcs_uri: supersededVer.gcs_uri,
          search_query: `${sheet} preliminar base rev 0`,
          filterKeywords: [supersededVer.filename.toLowerCase(), 'bid set'],
        },
        hasUnanswered: false,
        resolvedEntities,
      };
    }
  }

  // Caso 3: Especificación vs Addendum (ej. División 11 según el último Addendum)
  const divMatch = query.match(/divisi[oó]n\s*(\d{1,2})/i);
  if (divMatch && (hasAddendum3 || hasAddendum2 || lower.includes('addendum'))) {
    const divNum = divMatch[1].padStart(2, '0');
    resolvedEntities.divisionCode = divNum;
    const divSpecs = manifest.specifications?.[divNum] || [];
    const divName = divSpecs[0]?.division_name || `División ${divNum}`;

    return {
      isComparative: true,
      targetA: {
        type: 'SPECIFICATION',
        label: `ESPECIFICACIONES BASE (División ${divNum} - ${divName})`,
        file: divSpecs[0]?.filename || `Division ${divNum}`,
        gcs_uri: divSpecs[0]?.gcs_uri || '',
        search_query: `División ${divNum} especificaciones tecnicas calidad materiales ${divName}`,
        filterKeywords: [divNum, 'specification', 'attachment'],
      },
      targetB: {
        type: 'ADDENDUM',
        label: `MODIFICACIONES EN ADDENDUM NO. 3 (Vigente)`,
        file: latestAddendum?.main_file || 'Addendum+No.+3.pdf',
        gcs_uri: latestAddendum?.main_gcs_uri || '',
        search_query: `División ${divNum} ${divName} Addendum 3 modificaciones cambios enmienda`,
        filterKeywords: ['addendum+no.+3', 'add#03', 'add #03'],
      },
      hasUnanswered: false,
      resolvedEntities,
    };
  }

  // Consulta estándar no comparativa pero con entidades resueltas
  if (hasLatestRfi) {
    resolvedEntities.rfiNumber = latestRfi?.end || 42;
  }
  if (hasAddendum3) {
    resolvedEntities.addendumNumber = 3;
  }

  return {
    isComparative: false,
    hasUnanswered,
    resolvedEntities,
  };
}
