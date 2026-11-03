export type BoundingBox = [number, number, number, number]; // [ymin, xmin, ymax, xmax] or [x, y, w, h]

export type DisciplineType = 
  | 'Architectural' 
  | 'Structural' 
  | 'Mechanical' 
  | 'Electrical' 
  | 'Plumbing' 
  | 'Specs' 
  | 'Addenda'
  | 'General';

export interface HighlightItem {
  id: string; // e.g. "HL-1"
  sheet_number?: string; // e.g. "A-7.23"
  target_document?: string; // e.g. "Attachment D - SARPS Recommendations"
  sheet_title?: string;
  revision_status?: 'CURRENT' | 'SUPERSEDED' | string;
  label: string; // e.g. "SARPS Rec. 7: Countertops & Casework"
  color?: string; // e.g. "#F5A623", "#FFB800", "#FF3B30", "#007AFF", "#34D399"
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] in 0-1000 scale
  exact_quoted_text?: string;
  referenced_text_snippet?: string;
  page_number?: number;
  rotation_applied?: number; // 0, 90, 180, 270
  auto_zoom?: number; // e.g. 100, 120, 140, 200
  style?: {
    color?: string;
    border_style?: string;
    border_width?: number;
  };
  file_url?: string;
  gcs_uri?: string;
}

export interface DocumentNavigationMeta {
  filename?: string;
  target_page?: number;
  recommended_rotation?: number; // 0, 90, 180, 270
  recommended_zoom?: number; // percentage e.g. 100, 120, 140, 200
}

export interface CitationSource {
  id: string;
  sheet_number: string;
  target_document?: string;
  sheet_title: string;
  discipline: DisciplineType;
  revision: string;
  revision_date: string;
  is_current_ifc: boolean;
  superseded_by?: string;
  page_number: number;
  total_pages: number;
  file_url: string;
  gcs_uri: string;
  bounding_box: BoundingBox; // converted to normalized [left%, top%, width%, height%]
  box_2d?: [number, number, number, number]; // original [ymin, xmin, ymax, xmax] (0-1000 scale)
  rotation?: number; // 0, 90, 180, 270
  recommended_rotation?: number;
  auto_zoom?: number; // percentage e.g. 100, 120, 140
  recommended_zoom?: number;
  exact_quoted_text?: string;
  text_excerpt: string;
  spec_section?: string;
  callout_tag?: string;
  color?: string;
  style?: {
    color?: string;
    border_style?: string;
    border_width?: number;
  };
}

export interface RevisionConflictInfo {
  is_conflict: boolean;
  cited_revision: string;
  cited_sheet: string;
  current_ifc_revision: string;
  superseded_notice: string;
  addendum_number?: string;
  superseded_date?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  raw_response?: string;
  timestamp: string;
  citations: CitationSource[];
  highlights?: HighlightItem[];
  suggested_followups?: string[];
  revision_conflict?: RevisionConflictInfo;
  is_streaming?: boolean;
}

export interface RfiDraft {
  project_name: string;
  rfi_number: string;
  subject: string;
  date_initiated: string;
  author: string;
  assigned_to: string;
  schedule_impact: boolean;
  cost_impact: boolean;
  question: string;
  suggested_solution: string;
  references: {
    sheet_or_spec: string;
    description: string;
  }[];
}

export interface DocumentFilterState {
  discipline: string;
  documentType: string;
  onlyCurrentIfc: boolean;
  searchTerm: string;
}

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}
