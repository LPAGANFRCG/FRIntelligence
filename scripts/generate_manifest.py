#!/usr/bin/env python3
"""
Dynamic Project Manifest Generator for Hospital Trauma AEC Documents.
Scans local directory or Google Cloud Storage bucket to build a structured,
deterministic manifest with version tracking, RFI sequence numbers,
Addenda timeline, Drawings versioning, and CSI MasterFormat divisions.
"""

import os
import sys
import io
import re
import json
import datetime
from pathlib import Path

# Asegurar compatibilidad UTF-8 en Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Paths
LOCAL_DEFAULT_PATH = r"X:\02 Subastas\2026-12-01  Hospital Trauma"
GCS_BUCKET_NAME = "frcg-projects"
GCS_PREFIX = "2026-12-01  Hospital Trauma/"
OUTPUT_JSON = "project_manifest.json"
FRONTEND_CONFIG_PATH = os.path.join("frontend", "src", "config", "project_manifest.json")

# CSI MasterFormat Division Names
CSI_DIVISIONS = {
    "00": "Procurement and Contracting Requirements",
    "01": "General Requirements",
    "02": "Existing Conditions",
    "03": "Concrete",
    "04": "Masonry",
    "05": "Metals (Structural Steel & Plenum Support)",
    "06": "Wood, Plastics, and Composites",
    "07": "Thermal and Moisture Protection",
    "08": "Openings (Doors, Frames, Hardware)",
    "09": "Finishes (Epoxy Flooring, Cleanroom Ceilings)",
    "10": "Specialties",
    "11": "Equipment (Medical Equipment, Surgical Lighting, Booms)",
    "12": "Furnishings",
    "13": "Special Construction",
    "14": "Conveying Equipment (Elevators)",
    "16": "Electrical Work (Luminarias, Alimentadores, Paneles)",
    "21": "Fire Suppression",
    "22": "Plumbing (Gases Médicos, Drenaje, Scrub Sinks)",
    "23": "Heating, Ventilating, and Air-Conditioning (HVAC / HEPA)",
    "26": "Electrical",
    "27": "Communications",
    "28": "Electronic Safety and Security",
    "31": "Earthwork",
    "32": "Exterior Improvements",
    "33": "Utilities",
}

def scan_local_project(base_path: str):
    """Escanea la jerarquía del proyecto localmente en X:\..."""
    print(f"[*] Escaneando estructura local en: {base_path}")
    
    rfis = []
    addenda = []
    drawings = {}
    specs = {div: [] for div in CSI_DIVISIONS.keys()}
    other_docs = []

    # 1. Escanear RFIs en FRCG/RFI
    rfi_dir = os.path.join(base_path, "FRCG", "RFI")
    if os.path.exists(rfi_dir):
        for f in os.listdir(rfi_dir):
            if f.lower().endswith(".pdf"):
                full_path = os.path.join(rfi_dir, f)
                match = re.search(r"Completed_([0-9]+)(?:-([0-9]+))?", f)
                if match:
                    start = int(match.group(1))
                    end = int(match.group(2)) if match.group(2) else start
                elif re.search(r"RFI[_\-\s]*(\d+)", f, re.I):
                    val = int(re.search(r"RFI[_\-\s]*(\d+)", f, re.I).group(1))
                    start, end = val, val
                else:
                    start, end = 0, 0

                gcs_uri = f"gs://{GCS_BUCKET_NAME}/{GCS_PREFIX}FRCG/RFI/{f}"
                rfis.append({
                    "id": f"RFI-{end}" if end > 0 else f"RFI-DOC",
                    "filename": f,
                    "range": [start, end],
                    "start": start,
                    "end": end,
                    "local_path": full_path,
                    "gcs_uri": gcs_uri,
                    "is_latest": False,
                })

    rfis.sort(key=lambda x: x["end"])
    if rfis:
        rfis[-1]["is_latest"] = True

    # 2. Escanear Addenda en Bid Set/Addenda
    addenda_dir = os.path.join(base_path, "Bid Set", "Addenda")
    if os.path.exists(addenda_dir):
        for d in sorted(os.listdir(addenda_dir)):
            full_d = os.path.join(addenda_dir, d)
            if os.path.isdir(full_d):
                match = re.search(r"(\d{4}-\d{2}-\d{2})\s*-\s*Add\s*#?0?(\d+)", d, re.I)
                date_str = match.group(1) if match else ""
                num = int(match.group(2)) if match else 0
                files = []
                for root, _, fs in os.walk(full_d):
                    for f in fs:
                        if f.lower().endswith(".pdf"):
                            rel_sub = os.path.relpath(os.path.join(root, f), base_path).replace("\\", "/")
                            gcs_uri = f"gs://{GCS_BUCKET_NAME}/{GCS_PREFIX}{rel_sub}"
                            files.append({
                                "filename": f,
                                "rel_path": rel_sub,
                                "gcs_uri": gcs_uri,
                            })

                main_pdf = next((x for x in files if "addendum" in x["filename"].lower()), files[0] if files else None)
                addenda.append({
                    "id": f"ADDENDUM-0{num}" if num < 10 else f"ADDENDUM-{num}",
                    "number": num,
                    "folder": d,
                    "date": date_str,
                    "is_latest": False,
                    "main_file": main_pdf["filename"] if main_pdf else "",
                    "main_gcs_uri": main_pdf["gcs_uri"] if main_pdf else "",
                    "all_files": files,
                })

    addenda.sort(key=lambda x: x["number"])
    if addenda:
        addenda[-1]["is_latest"] = True

    # 3. Escanear Planos (Drawings)
    for root, _, files in os.walk(base_path):
        # Ignorar carpetas no de planos si no están en Drawings o Addenda
        for f in files:
            if not f.lower().endswith(".pdf"):
                continue
            sheet_match = re.match(r"^([A-Z]{1,2}-\d+(\.\d+)?[A-Z]?)", f)
            if sheet_match:
                sheet = sheet_match.group(1).upper()
                rel_path = os.path.relpath(os.path.join(root, f), base_path).replace("\\", "/")
                gcs_uri = f"gs://{GCS_BUCKET_NAME}/{GCS_PREFIX}{rel_path}"
                is_old = "old-drawings" in rel_path.lower()
                is_add = "addenda" in rel_path.lower()
                is_add02 = "add #02" in rel_path.lower() or "add#02" in rel_path.lower()
                is_bid_w_add2 = "bid set w. add #02" in rel_path.lower()

                # Determinar disciplina
                discipline = "General"
                if "/architectural/" in rel_path.lower() or sheet.startswith("A-"): discipline = "Architectural"
                elif "/structural/" in rel_path.lower() or sheet.startswith("S-"): discipline = "Structural"
                elif "/mechanical/" in rel_path.lower() or sheet.startswith("M-"): discipline = "Mechanical"
                elif "/plumbing/" in rel_path.lower() or sheet.startswith("P-"): discipline = "Plumbing"
                elif "/electrical/" in rel_path.lower() or sheet.startswith("E-"): discipline = "Electrical"
                elif "/civil/" in rel_path.lower() or sheet.startswith("C-"): discipline = "Civil"

                if sheet not in drawings:
                    drawings[sheet] = {
                        "sheet_number": sheet,
                        "discipline": discipline,
                        "versions": []
                    }

                version_tag = "Addendum 02" if is_add02 else ("Bid Set w. Add 02" if is_bid_w_add2 else ("OLD" if is_old else "Bid Set Rev 0"))
                drawings[sheet]["versions"].append({
                    "filename": f,
                    "rel_path": rel_path,
                    "gcs_uri": gcs_uri,
                    "version_tag": version_tag,
                    "is_superseded": is_old or (not is_bid_w_add2 and not is_add02 and any("add #02" in x.lower() for x in [rel_path])),
                })

    # Marcar la versión latest en cada plano
    for sheet, data in drawings.items():
        v_list = data["versions"]
        # Preferencia de vigencia: Addenda > Bid Set w. add #02 > Bid Set base > OLD
        def sort_priority(v):
            p = v["rel_path"].lower()
            if "add#03" in p or "add #03" in p: return 4
            if "add#02" in p or "add #02" in p: return 3
            if "bid set w. add #02" in p: return 2
            if "old-drawings" in p: return 0
            return 1
        v_list.sort(key=sort_priority, reverse=True)
        for i, v in enumerate(v_list):
            v["is_latest"] = (i == 0)
            v["is_superseded"] = (i > 0) or ("old-drawings" in v["rel_path"].lower())

    # 4. Escanear Especificaciones Técnicas
    spec_dir = os.path.join(base_path, "Bid Set", "Specifications", "Technical Specifications")
    if os.path.exists(spec_dir):
        for d in sorted(os.listdir(spec_dir)):
            full_d = os.path.join(spec_dir, d)
            if os.path.isdir(full_d):
                div_match = re.match(r"^(\d{2})", d)
                div_code = div_match.group(1) if div_match else None
                for root, _, fs in os.walk(full_d):
                    for f in fs:
                        if f.lower().endswith(".pdf"):
                            rel_p = os.path.relpath(os.path.join(root, f), base_path).replace("\\", "/")
                            gcs_uri = f"gs://{GCS_BUCKET_NAME}/{GCS_PREFIX}{rel_p}"
                            item = {
                                "division": div_code or "Other",
                                "division_name": CSI_DIVISIONS.get(div_code, d),
                                "filename": f,
                                "rel_path": rel_p,
                                "gcs_uri": gcs_uri,
                            }
                            if div_code and div_code in specs:
                                specs[div_code].append(item)
                            else:
                                other_docs.append(item)

    # 5. Agregar Attachment B y Attachment F (Equipos Médicos / División 11)
    rfp_spec_dir = os.path.join(base_path, "Bid Set", "Specifications", "RFP", "Attachment")
    if os.path.exists(rfp_spec_dir):
        for f in os.listdir(rfp_spec_dir):
            if f.lower().endswith(".pdf"):
                rel_p = os.path.relpath(os.path.join(rfp_spec_dir, f), base_path).replace("\\", "/")
                gcs_uri = f"gs://{GCS_BUCKET_NAME}/{GCS_PREFIX}{rel_p}"
                div = "11" if "attachment f" in f.lower() else "01"
                specs[div].append({
                    "division": div,
                    "division_name": CSI_DIVISIONS.get(div, "Specialties"),
                    "filename": f,
                    "rel_path": rel_p,
                    "gcs_uri": gcs_uri,
                })

    manifest = {
        "project_name": "Hospital Trauma - Centro Médico de Puerto Rico",
        "generated_at": datetime.datetime.now().isoformat(),
        "hierarchy_summary": {
            "total_rfis": len(rfis),
            "latest_rfi": rfis[-1] if rfis else None,
            "total_addenda": len(addenda),
            "latest_addendum": addenda[-1] if addenda else None,
            "total_drawing_sheets": len(drawings),
            "total_spec_divisions": len([k for k, v in specs.items() if v]),
        },
        "rfis": rfis,
        "addenda": addenda,
        "drawings": drawings,
        "specifications": specs,
        "other_documents": other_docs[:30],
    }

    return manifest

def main():
    base_path = sys.argv[1] if len(sys.argv) > 1 else LOCAL_DEFAULT_PATH
    if not os.path.exists(base_path):
        print(f"[!] Ruta no encontrada: {base_path}. Verifique conexión a X: o especifique ruta alternativa.")
        sys.exit(1)

    manifest = scan_local_project(base_path)

    # Guardar en raíz
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"[✓] Manifiesto guardado en: {OUTPUT_JSON}")

    # Guardar en frontend/src/config/project_manifest.json si existe
    os.makedirs(os.path.dirname(FRONTEND_CONFIG_PATH), exist_ok=True)
    with open(FRONTEND_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"[✓] Manifiesto sincronizado en frontend: {FRONTEND_CONFIG_PATH}")

    # Resumen técnico
    s = manifest["hierarchy_summary"]
    print("\n" + "=" * 60)
    print("PROYECTO: " + manifest["project_name"])
    print(f"• Total RFIs: {s['total_rfis']} (Último vigente: {s['latest_rfi']['id']} - {s['latest_rfi']['filename']})")
    print(f"• Total Addenda: {s['total_addenda']} (Último vigente: {s['latest_addendum']['id']} - Fecha: {s['latest_addendum']['date']})")
    print(f"• Total Planos Mapeados: {s['total_drawing_sheets']} hojas distintas con tracking de revisión")
    print(f"• Divisiones CSI MasterFormat: {s['total_spec_divisions']} divisiones técnicas activas")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    main()
