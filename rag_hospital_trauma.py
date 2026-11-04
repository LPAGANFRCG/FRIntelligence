"""
Cliente y Pipeline de consulta para el RAG Corpus 'HOSPITAL TRAUMA' en Google Cloud Vertex AI.
Proyecto: FRCG-Tools-AG (ID: frcg-antigravity)
Corpus ID: projects/frcg-antigravity/locations/us-central1/ragCorpora/255759598760230912

Implementa clasificación estricta de precedencia contractual:
1. [RFI] (.../FRCG/RFI/): Prioridad 1 (Aclaraciones vinculantes a contratistas).
2. [ADDENDUM 03] (.../Add #03/): Prioridad 2 (Último Addendum vigente, prevalece sobre anteriores).
3. [ADDENDUM 02] (.../Add #02/): Prioridad 3.
4. [ADDENDUM 01] (.../Add #01/): Prioridad 4.
5. [SPEC] (.../Specifications/): Prioridad 5 (Calidad de materiales, normas ASTM/ACI).
6. [DRAWING] (.../Drawings/): Prioridad 5 (Cómputos, dimensiones, layouts).
7. [TAKEOFF] (.../Take-Off/): Prioridad 6 (Metrados internos de estimación).
"""

import sys
import io
import argparse
import urllib.parse
import re
import google.auth
import google.auth.transport.requests
import requests

# Asegurar codificación UTF-8 en consola de Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

CORPUS_ID = "projects/frcg-antigravity/locations/us-central1/ragCorpora/255759598760230912"
LOCATION = "us-central1"
PROJECT_ID = "frcg-antigravity"

def get_rag_credentials():
    """Obtiene y refresca las credenciales ADC de Google Cloud."""
    creds, _ = google.auth.default()
    auth_req = google.auth.transport.requests.Request()
    creds.refresh(auth_req)
    return creds

def classify_document_hierarchy(source_uri: str) -> dict:
    """Clasifica un documento según su ruta en GCS bajo la jerarquía del proyecto Hospital Trauma."""
    uri = urllib.parse.unquote(source_uri or "")
    filename = uri.split("/")[-1] if "/" in uri else "Documento.pdf"
    folder_path = uri[:uri.rfind("/")] if "/" in uri else ""
    clean_name = re.sub(r"\.(pdf|docx?)$", "", filename, flags=re.I)

    doc_type = "GENERAL"
    priority = 7
    category_tag = "[DOC]"
    rev = "Rev 0"
    discipline = "General"
    sheet_name = clean_name[:24]

    # 1. RFI / Aclaraciones
    if (
        "/FRCG/RFI/" in uri
        or "Exhibit 1 Request for Clarifications" in uri
        or "Request_for_Clarifications" in uri
        or "rfi" in clean_name.lower()
        or "clarification" in clean_name.lower()
    ):
        doc_type = "RFI"
        priority = 1
        category_tag = "[RFI]"
        discipline = "Specs"
        sheet_name = "RFI Clarification"
        match_num = re.search(r"Completed_([0-9\-]+)", clean_name)
        if match_num:
            sheet_name = f"RFI #{match_num.group(1)}"
        elif re.search(r"RFI[_\-\s]*(\d+)", clean_name, re.I):
            sheet_name = f"RFI #{re.search(r'RFI[_\-\s]*(\d+)', clean_name, re.I).group(1)}"

    # 2. Addendum 03 (Vigente)
    elif any(x in uri for x in ["Add #03", "Add#03", "Addendum+No.+3", "Addendum No. 3", "enmienda_Num_3"]) or "Add #03" in clean_name:
        doc_type = "ADDENDUM"
        rev = "Add 03"
        priority = 2
        category_tag = "[ADDENDUM 03]"
        discipline = "Addenda"
        sheet_name = "Addendum No. 3"

    # 3. Addendum 02
    elif any(x in uri for x in ["Add #02", "Add#02", "Addendum+No.+2", "Addendum No. 2", "enmienda_Num_2"]) or "Add #02" in clean_name:
        doc_type = "ADDENDUM"
        rev = "Add 02"
        priority = 3
        category_tag = "[ADDENDUM 02]"
        discipline = "Addenda"
        sheet_name = "Addendum No. 2"

    # 4. Addendum 01
    elif any(x in uri for x in ["Add #01", "Add#01", "Addendum+No+1", "Addendum No. 1", "enmienda_Num_1"]) or "Add #01" in clean_name:
        doc_type = "ADDENDUM"
        rev = "Add 01"
        priority = 4
        category_tag = "[ADDENDUM 01]"
        discipline = "Addenda"
        sheet_name = "Addendum No. 1"

    # 5. Especificaciones Técnicas
    elif "/Specifications/" in uri or "/TS-" in uri or "Attachment" in uri or "ATCH-" in uri:
        doc_type = "SPECIFICATION"
        priority = 5
        category_tag = "[SPEC]"
        discipline = "Specs"
        atch_match = re.search(r"(Attachment\s+[A-Z0-9]+|ATCH-[A-Z0-9]+)", clean_name, re.I)
        sheet_name = atch_match.group(1).replace("ATCH-", "Attachment ") if atch_match else clean_name[:20]

    # 6. Planos / Drawings
    elif "/Drawings/" in uri or re.match(r"^[A-Z]-\d+", clean_name, re.I) or re.match(r"^(CU|ED|EX|GL|PL|TS|FP|EP|MP|SP)-\d+", clean_name, re.I):
        doc_type = "DRAWING"
        priority = 5
        category_tag = "[DRAWING]"
        sheet_match = re.search(r"([A-Z]{1,2}-\d+(\.\d+)?[A-Z]?)", clean_name, re.I)
        if sheet_match:
            sheet_name = sheet_match.group(1).upper()
            if "/Architectural/" in uri or sheet_name.startswith("A-"): discipline = "Architectural"
            elif "/Structural/" in uri or sheet_name.startswith("S-"): discipline = "Structural"
            elif "/Mechanical/" in uri or sheet_name.startswith("M-"): discipline = "Mechanical"
            elif "/Plumbing/" in uri or sheet_name.startswith("P-"): discipline = "Plumbing"
            elif "/Electrical/" in uri or sheet_name.startswith("E-"): discipline = "Electrical"
            elif "/Civil/" in uri or sheet_name.startswith("C-"): discipline = "Civil"

    # 7. Take-Off / Cómputos Internos
    elif "/Take-Off/" in uri or "take off" in clean_name.lower():
        doc_type = "TAKEOFF"
        priority = 6
        category_tag = "[TAKEOFF]"
        discipline = "General"
        sheet_name = "Cómputo Take-Off"

    return {
        "doc_type": doc_type,
        "priority": priority,
        "category_tag": category_tag,
        "rev": rev,
        "discipline": discipline,
        "sheet_name": sheet_name,
        "filename": filename,
        "folder_path": folder_path,
        "clean_name": clean_name
    }

def query_rag_corpus(query_text: str, top_k: int = 8, distance_threshold: float = 0.9):
    """
    Realiza una búsqueda semántica en el Corpus de Vertex AI RAG Engine
    y aplica ponderación jerárquica contractual estricta.
    """
    creds = get_rag_credentials()
    
    url = f"https://{LOCATION}-aiplatform.googleapis.com/v1beta1/projects/{PROJECT_ID}/locations/{LOCATION}:retrieveContexts"
    headers = {
        "Authorization": f"Bearer {creds.token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "vertexRagStore": {
            "ragResources": [
                {
                    "ragCorpus": CORPUS_ID
                }
            ],
            "vectorDistanceThreshold": distance_threshold
        },
        "query": {
            "text": query_text
        }
    }
    
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    
    if response.status_code != 200:
        raise RuntimeError(f"Error consultando RAG ({response.status_code}): {response.text}")
        
    data = response.json()
    contexts = data.get("contexts", {}).get("contexts", [])
    
    # Inyección de metadatos y re-ranking contractual
    lower_q = query_text.lower()
    is_rfi_q = any(w in lower_q for w in ["rfi", "aclaraci", "clarification", "pregunta", "duda", "respuesta"])
    is_addendum_q = any(w in lower_q for w in ["addendum", "adenda", "enmienda", "add #", "add#", "cambio"])

    enriched = []
    for ctx in contexts:
        meta = classify_document_hierarchy(ctx.get("sourceUri", ""))
        dist = ctx.get("distance", 0.5) if isinstance(ctx.get("distance"), (int, float)) else 0.5
        
        weighted_score = meta["priority"] * 10 + dist * 5
        if is_rfi_q and meta["doc_type"] == "RFI":
            weighted_score -= 50
        if is_addendum_q and meta["doc_type"] == "ADDENDUM":
            weighted_score -= 40
            if meta["rev"] == "Add 03":
                weighted_score -= 15

        ctx["hierarchy"] = meta
        ctx["weighted_score"] = weighted_score
        enriched.append(ctx)

    enriched.sort(key=lambda x: x["weighted_score"])
    return enriched[:top_k]

def display_results(query_text: str, contexts: list):
    """Muestra los resultados estructurados por jerarquía contractual."""
    print("=" * 80)
    print(f"[Consulta] {query_text}")
    print(f"[Resultados] Fragmentos recuperados con jerarquía contractual: {len(contexts)}")
    print("=" * 80)
    
    if not contexts:
        print("\n[Aviso] No se encontraron fragmentos relevantes para esta consulta.")
        return

    for i, ctx in enumerate(contexts, 1):
        h = ctx.get("hierarchy", {})
        source = ctx.get("sourceUri", "Desconocido")
        text = ctx.get("text", "").strip()
        dist = ctx.get("distance")
        
        print(f"\n[{i}] {h.get('category_tag', '[DOC]')} {h.get('sheet_name', 'Doc')} (Prioridad: {h.get('priority')} | Tipo: {h.get('doc_type')})")
        print(f"    Archivo: {h.get('filename')}")
        print(f"    Ruta GCS: {source}")
        if dist is not None:
            print(f"    Vector Dist: {dist:.4f} | Weighted Rank Score: {ctx.get('weighted_score', 0):.2f}")
        print("    " + "-" * 70)
        for line in text.splitlines()[:5]:
            print(f"    {line}")
        if len(text.splitlines()) > 5:
            print("    ...")
        print("    " + "-" * 70)

def main():
    parser = argparse.ArgumentParser(description="Consulta RAG Corpus con Jerarquía Contractual (Hospital Trauma)")
    parser.add_argument("query", nargs="*", help="Texto de la consulta a realizar")
    parser.add_argument("--top-k", type=int, default=6, help="Numero maximo de fragmentos (default: 6)")
    parser.add_argument("--threshold", type=float, default=0.9, help="Umbral de distancia vectorial (default: 0.9)")
    
    args = parser.parse_args()
    
    if args.query:
        query_text = " ".join(args.query)
        contexts = query_rag_corpus(query_text, top_k=args.top_k, distance_threshold=args.threshold)
        display_results(query_text, contexts)
    else:
        print("=" * 80)
        print("Conectado al RAG Corpus: HOSPITAL TRAUMA (Jerarquía Contractual Activa)")
        print("Escribe tu pregunta (ej. 'RFI sobre plomeria' o 'Addendum 3'). (Escribe 'salir' para terminar)")
        print("=" * 80)
        while True:
            try:
                user_input = input("\nPregunta > ").strip()
                if not user_input:
                    continue
                if user_input.lower() in ("salir", "exit", "quit", "q"):
                    print("Hasta luego!")
                    break
                contexts = query_rag_corpus(user_input, top_k=args.top_k, distance_threshold=args.threshold)
                display_results(user_input, contexts)
            except KeyboardInterrupt:
                print("\nHasta luego!")
                break
            except Exception as e:
                print(f"\nError: {e}")

if __name__ == "__main__":
    main()
