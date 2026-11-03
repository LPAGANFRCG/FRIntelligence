import { CitationSource, ChatMessage } from '@/types/construction-rag';

export const MOCK_CITATIONS: Record<string, CitationSource> = {
  'cite-a12a': {
    id: 'cite-a12a',
    sheet_number: 'A-1.2A',
    sheet_title: 'OPERATING ROOM EQUIPMENT LIST & CEILING FIXTURES',
    discipline: 'Architectural',
    revision: 'Rev 0 (Preliminary Bid Set)',
    revision_date: '2026-08-15',
    is_current_ifc: false,
    superseded_by: 'Addendum No. 3 (2026-10-29)',
    page_number: 1,
    total_pages: 1,
    file_url: '/sample-blueprint.pdf',
    gcs_uri: 'gs://frcg-projects/2026-12-01  Hospital Trauma/Bid Set/Drawings/Architectural/A-1.2A-OPERATING-ROOM-EQUIPMENT-LIST-Rev.0.pdf',
    rotation: 90,
    force_rotation: 90,
    recommended_rotation: 90,
    auto_zoom: 130,
    recommended_zoom: 130,
    box_2d: [730, 480, 758, 580],
    bounding_box: [48, 73, 10, 3],
    exact_quoted_text: 'SURGICAL O.R. THREE-LIGHT HEAD LAMP(CEILING MOUNTED)',
    text_excerpt: 'SURGICAL O.R. THREE-LIGHT HEAD LAMP(CEILING MOUNTED)... RECESSED OPERATING ROOM GRADE LED LIGHTING FIXTURE',
    callout_tag: 'Detail 2 - Equipment Legend',
    spec_section: 'Section 11 70 00 - Medical Equipment',
  },
  'cite-add3': {
    id: 'cite-add3',
    sheet_number: 'Addendum #3 (RFI-372)',
    sheet_title: 'OFFICIAL ADDENDUM NO. 3 - TECHNICAL CLARIFICATIONS',
    discipline: 'Addenda',
    revision: 'Add #03 (Current IFC)',
    revision_date: '2026-10-29',
    is_current_ifc: true,
    page_number: 1,
    total_pages: 14,
    file_url: '/addendum-3.pdf',
    gcs_uri: 'gs://frcg-projects/2026-12-01  Hospital Trauma/Bid Set/Addenda/2026-10-29 - Add#03/Addendum+No.+3.pdf',
    rotation: 0,
    force_rotation: 0,
    recommended_rotation: 0,
    auto_zoom: 120,
    recommended_zoom: 120,
    box_2d: [80, 320, 160, 620],
    bounding_box: [8, 32, 84, 30],
    exact_quoted_text: 'Laminar-flow diffusers shall be non-aspirating unidirectional diffusers',
    text_excerpt: 'Answer 372: Laminar-flow diffusers shall be non-aspirating unidirectional diffusers forming a primary supply array over the surgical field complying with ASHRAE 170. Terminal HEPA filters shall have an efficiency of not less than 99.97% at 0.3 micron with room-side replaceable test ports.',
    callout_tag: 'RFI 372 / Spec 23 74 00',
    spec_section: 'Section 23 74 00 - HVAC Purification & Air Handling',
  },
  'cite-atch-f': {
    id: 'cite-atch-f',
    sheet_number: 'Attachment F (A-1.2A Ref)',
    sheet_title: 'HOSPITALLER AND MEDICAL EQUIPMENT SPECIFICATIONS',
    discipline: 'Specs',
    revision: 'Rev 0 (IFC)',
    revision_date: '2026-09-01',
    is_current_ifc: true,
    page_number: 1,
    total_pages: 1,
    file_url: '/sample-blueprint.pdf',
    gcs_uri: 'gs://frcg-projects/2026-12-01  Hospital Trauma/Bid Set/Specifications/Technical Specifications/AT-Attachment/ATCH-F-HOSPITALLER-AND-MEDICAL-EQUIPMENT_Rev_0.pdf',
    rotation: 90,
    force_rotation: 90,
    recommended_rotation: 90,
    auto_zoom: 130,
    recommended_zoom: 130,
    box_2d: [120, 640, 260, 900],
    bounding_box: [12, 64, 48, 26],
    exact_quoted_text: 'Dual Station Surgical Scrub Sink (P16): Stainless steel Type 304',
    text_excerpt: 'Dual Station Surgical Scrub Sink (P16): Stainless steel Type 304, hands-free infrared electronic sensor faucets, digital scrub timer, 1/2" cold/hot water rough-in with thermostatic mixing valve.',
    callout_tag: 'Item P16 - Surgical Scrub Sink',
    spec_section: 'Section 22 40 00 - Plumbing Fixtures',
  },
  'cite-s201': {
    id: 'cite-s201',
    sheet_number: 'A-1.2A General Notes',
    sheet_title: 'CEILING FINISHES & WATER BASED EPOXY CLEAN ROOM SPECIFICATIONS',
    discipline: 'Architectural',
    revision: 'Rev 0 (IFC)',
    revision_date: '2026-08-15',
    is_current_ifc: true,
    page_number: 1,
    total_pages: 1,
    file_url: '/sample-blueprint.pdf',
    gcs_uri: 'gs://frcg-projects/2026-12-01  Hospital Trauma/Bid Set/Drawings/Architectural/A-1.2A-OPERATING-ROOM-EQUIPMENT-LIST-Rev.0.pdf',
    rotation: 90,
    force_rotation: 90,
    recommended_rotation: 90,
    auto_zoom: 130,
    recommended_zoom: 130,
    box_2d: [580, 200, 760, 580],
    bounding_box: [58, 20, 38, 38],
    exact_quoted_text: '5/8" MOISTURE RESISTANT OPERATING ROOM GYPSUM BOARD CEILING',
    text_excerpt: '5/8" MOISTURE RESISTANT OPERATING ROOM GYPSUM BOARD CEILING @ 9\'-6" A.F.F. WITH WATER BASED EPOXY CLEAN ROOM PAINT FINISH. 24"X 24" SQUARE LAY-IN GASKETED CEILING TILES @ 9\'-6" A.F.F. CLEAN ROOM TYPE MYLAR FINISH.',
    callout_tag: 'General Ceiling Notes',
    spec_section: 'Section 09 51 00 - Acoustical & Clean Room Ceilings',
  }
};

export const INITIAL_MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-welcome',
    role: 'assistant',
    timestamp: '10:00 AM',
    content: `### 👷 Construction Intelligence Active
Connected to **FRCG-Tools-AG** • **Hospital Trauma Project** (944 real indexed drawings, submittals, and bid specifications).

Every claim is cross-referenced with exact PDF sheet coordinates, revision stamps, and spec sections.
Select any query below or type your technical inquiry:`,
    citations: [],
    suggested_followups: [
      "What are the terminal HEPA filter specs in Operating Rooms?",
      "Check surgical scrub sink rough-in and ADA clearances",
      "Verify clean room ceiling finish specifications",
      "Identify conflicting notes between Arch A-1.2A and Addendum 3"
    ]
  },
  {
    id: 'msg-user-1',
    role: 'user',
    timestamp: '10:02 AM',
    content: 'What are the exact laminar flow diffuser and HEPA filter requirements for the 5 Operating Rooms, and is there any conflict in the bid set?',
    citations: []
  },
  {
    id: 'msg-assistant-1',
    role: 'assistant',
    timestamp: '10:02 AM',
    content: `### ⚠️ Revision Safety Notice
The reflected ceiling plans in [A-1.2A - Detail 2](cite-a12a) originally showed 4 laminar diffusers per room without engineering air device schedules. However, this sheet was **explicitly amended by Addendum #3**.

---

### Technical Summary & Requirements:

1. **Laminar Flow Primary Supply Array**:
   - Must be non-aspirating unidirectional diffusers forming a primary supply array directly over the surgical table.
   - Sizing and airflow must strictly adhere to **ASHRAE 170 for Operating Rooms**, including Room OR-E (approx. 400 SF) as confirmed in [Addendum #3 - RFI 372](cite-add3).

2. **Terminal HEPA Filter Specifications**:
   - **Quantity**: Four (4) 24" x 48" ceiling-mounted units per Operating Room (total of 20 units across 5 ORs).
   - **Efficiency Rating**: Not less than **99.97% at 0.3 micron**.
   - **Housing**: Room-side replaceable terminal housings with integrated test ports.
   - **Plenum Coordination**: Must coordinate with double utility service booms hung from structural deck per [A-1.2A - Detail 2](cite-a12a).

3. **Plumbing Rough-In Coordination**:
   - Scrub room corridors adjacent to ORs require **P16 Dual Station Scrub Sinks** with thermostatic mixing valves per [Attachment F - Item P16](cite-atch-f).`,
    citations: [
      MOCK_CITATIONS['cite-a12a'],
      MOCK_CITATIONS['cite-add3'],
      MOCK_CITATIONS['cite-atch-f']
    ],
    revision_conflict: {
      is_conflict: true,
      cited_sheet: 'A-1.2A',
      cited_revision: 'Rev 0 (Bid Set)',
      current_ifc_revision: 'Addendum #3 (Issued 2026-10-29)',
      superseded_notice: 'Sheet A-1.2A ceiling diffusers lack AHU integration notes and were superseded by Addendum 3 Question 372. Using Rev 0 without Addendum 3 will result in mechanical rework.',
      addendum_number: 'Addendum No. 3',
      superseded_date: '2026-10-29'
    },
    suggested_followups: [
      "Draft Procore RFI for mechanical contractor pricing",
      "Check structural deck load capacity for ceiling booms",
      "Review medical gas flow meter outlets in OR wall legend"
    ]
  }
];
