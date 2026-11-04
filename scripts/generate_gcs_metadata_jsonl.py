#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GCS Metadata JSONL Generator for Vertex AI Search / Agent Studio & Vertex RAG Engine
Project: 2026-12-01 Hospital Trauma
Bucket: gs://frcg-projects/2026-12-01  Hospital Trauma/
"""

import os
import sys
import json
import re
import urllib.parse
import io
import requests
import google.auth
from google.auth.transport.requests import Request

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

PROJECT_ID = "frcg-antigravity"
PROJECT_NUMBER = "1004674164524"
RAG_CORPUS_ID = "255759598760230912"
GCS_BUCKET = "frcg-projects"
GCS_PREFIX = "2026-12-01  Hospital Trauma"
LOCAL_ROOT = r"X:\02 Subastas\2026-12-01  Hospital Trauma"

def get_auth_token():
    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    creds.refresh(Request())
    return creds.token

def fetch_all_rag_files(token):
    print("--> Fetching all ragFiles from Vertex AI RAG Corpus...")
    headers = {"Authorization": f"Bearer {token}"}
    base_url = f"https://us-central1-aiplatform.googleapis.com/v1beta1/projects/{PROJECT_ID}/locations/us-central1/ragCorpora/{RAG_CORPUS_ID}/ragFiles"
    
    all_files = []
    page_token = None
    
    while True:
        url = f"{base_url}?pageSize=100" + (f"&pageToken={page_token}" if page_token else "")
        res = requests.get(url, headers=headers)
        if res.status_code != 200:
            print(f"Warning: Failed to list ragFiles ({res.status_code}): {res.text[:200]}")
            break
        data = res.json()
        files = data.get("ragFiles", [])
        all_files.extend(files)
        page_token = data.get("nextPageToken")
        if not page_token:
            break
            
    print(f"    Total ragFiles fetched from Corpus: {len(all_files)}")
    
    # Map by cleaned filename and by exact GCS URI
    rag_map_by_name = {}
    rag_map_by_uri = {}
    
    for f in all_files:
        fid = f.get("name", "").split("/")[-1]
        display_name = f.get("displayName", "")
        uris = f.get("gcsSource", {}).get("uris", [])
        
        if display_name:
            rag_map_by_name[display_name.lower()] = fid
            
        for u in uris:
            clean_u = u.replace("+", " ")
            rag_map_by_uri[u] = fid
            rag_map_by_uri[clean_u] = fid
            fname = u.split("/")[-1]
            rag_map_by_name[fname.lower()] = fid
            rag_map_by_name[fname.replace("+", " ").lower()] = fid
            
    return rag_map_by_name, rag_map_by_uri

def sanitize_id(text):
    clean = re.sub(r'[^a-zA-Z0-9_\-]', '_', text)
    clean = re.sub(r'_+', '_', clean).strip('_')
    return clean[:60] if clean else "doc"

def classify_document(rel_path, filename):
    lower_path = rel_path.lower().replace("\\", "/")
    lower_name = filename.lower()
    
    doc_type = "general"
    sequence_or_revision = "0"
    is_latest = True
    discipline = "General"
    sheet_number = None
    folder_path = os.path.dirname(rel_path).replace("\\", "/")
    
    # 1. RFI
    if "/frc g/rfi/" in lower_path or "/rfi/" in lower_path or "completed_" in lower_name or "request for clarification" in lower_name:
        doc_type = "rfi"
        discipline = "Specs"
        match_num = re.search(r'completed_([0-9\-]+)', lower_name)
        if match_num:
            sequence_or_revision = match_num.group(1)
            # RFI 42 is the latest
            is_latest = (sequence_or_revision == "42")
            sheet_number = f"RFI-{sequence_or_revision}"
        elif "rfi" in lower_name:
            m = re.search(r'rfi[_\-\s]*(\d+)', lower_name)
            if m:
                sequence_or_revision = m.group(1)
                is_latest = (sequence_or_revision == "42")
                sheet_number = f"RFI-{sequence_or_revision}"
            else:
                sequence_or_revision = "1"
                is_latest = False
                sheet_number = "RFI"
        else:
            sequence_or_revision = "1"
            is_latest = False
            sheet_number = "RFI"

    # 2. Addendum
    elif "/addenda/" in lower_path or "addendum" in lower_name or "enmienda" in lower_name or "add #" in lower_path or "add#" in lower_path:
        doc_type = "addendum"
        discipline = "Addenda"
        if "add #03" in lower_path or "add#03" in lower_path or "addendum+no.+3" in lower_name or "addendum no. 3" in lower_name or "enmienda_num_3" in lower_name:
            sequence_or_revision = "03"
            is_latest = True
            sheet_number = "ADDENDUM-03"
        elif "add #02" in lower_path or "add#02" in lower_path or "addendum+no.+2" in lower_name or "addendum no. 2" in lower_name or "enmienda_num_2" in lower_name:
            sequence_or_revision = "02"
            is_latest = False
            sheet_number = "ADDENDUM-02"
        elif "add #01" in lower_path or "add#01" in lower_path or "addendum+no+1" in lower_name or "addendum no. 1" in lower_name or "enmienda_num_1" in lower_name:
            sequence_or_revision = "01"
            is_latest = False
            sheet_number = "ADDENDUM-01"
        else:
            sequence_or_revision = "01"
            is_latest = False
            sheet_number = "ADDENDUM"

    # 3. Specifications
    elif "/specifications/" in lower_path or "/ts-" in lower_name or "attachment" in lower_name or "atch-" in lower_name:
        doc_type = "spec"
        discipline = "Specs"
        is_latest = not ("old" in lower_path or "superseded" in lower_path)
        atch_m = re.search(r'(attachment\s+[a-z0-9]+|atch-[a-z0-9]+)', lower_name)
        if atch_m:
            sequence_or_revision = atch_m.group(1).upper()
            sheet_number = sequence_or_revision
        else:
            sequence_or_revision = "Rev 0"
            sheet_number = filename[:20]

    # 4. Drawings
    elif "/drawings/" in lower_path or re.match(r'^[a-z]{1,2}-\d+', lower_name) or re.match(r'^(cu|ed|ex|gl|pl|ts|fp|ep|mp|sp)-\d+', lower_name):
        doc_type = "drawing"
        sheet_m = re.match(r'([a-z]{1,2}-\d+(\.\d+)?[a-z]?)', lower_name)
        if sheet_m:
            sheet_number = sheet_m.group(1).upper()
        else:
            sheet_number = filename[:12].upper()
            
        if sheet_number.startswith("A-"):
            discipline = "Architectural"
        elif sheet_number.startswith("S-"):
            discipline = "Structural"
        elif sheet_number.startswith("M-"):
            discipline = "Mechanical"
        elif sheet_number.startswith("E-"):
            discipline = "Electrical"
        elif sheet_number.startswith("P-"):
            discipline = "Plumbing"
        elif sheet_number.startswith("C-") or sheet_number.startswith("CU-"):
            discipline = "Civil"
        else:
            discipline = "General"
            
        rev_m = re.search(r'rev\.?(\d+)', lower_name)
        if rev_m:
            sequence_or_revision = f"Rev.{rev_m.group(1)}"
        elif "add #02" in lower_path or "add 02" in lower_name:
            sequence_or_revision = "Add 02"
        else:
            sequence_or_revision = "Rev 0"
            
        # Versioning precedence: Add 02 or Bid Set w. add #02 is latest
        if "old" in lower_path or "superseded" in lower_path:
            is_latest = False
        elif "bid set w. add #02" in lower_path or "add #02" in lower_path or "add#03" in lower_path:
            is_latest = True
        elif "bid set/" in lower_path:
            # If in base Bid Set, superseded if updated in Bid Set w. add #02
            is_latest = False
        else:
            is_latest = True

    # 5. Takeoff
    elif "take-off" in lower_path or "take off" in lower_name:
        doc_type = "takeoff"
        discipline = "General"
        sequence_or_revision = "1.0"
        is_latest = True
        sheet_number = "TAKEOFF"
        
    return {
        "document_type": doc_type,
        "sequence_or_revision": str(sequence_or_revision),
        "folder_path": folder_path,
        "is_latest": is_latest,
        "discipline": discipline,
        "sheet_number": sheet_number or filename[:15],
    }

def upload_to_gcs(local_file_path, gcs_blob_name, token):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/jsonl"
    }
    upload_url = f"https://storage.googleapis.com/upload/storage/v1/b/{GCS_BUCKET}/o?uploadType=media&name={urllib.parse.quote(gcs_blob_name)}"
    
    with open(local_file_path, "rb") as f:
        data = f.read()
        
    res = requests.post(upload_url, headers=headers, data=data)
    if res.status_code in [200, 201]:
        print(f"    Uploaded to gs://{GCS_BUCKET}/{gcs_blob_name} ({len(data)} bytes)")
        return True
    else:
        print(f"    Upload failed ({res.status_code}): {res.text[:200]}")
        return False

def main():
    print("=" * 80)
    print("  GCS METADATA JSONL GENERATOR & DATA STORE INDEXER")
    print(f"  Project Root: {LOCAL_ROOT}")
    print(f"  Target GCS:   gs://{GCS_BUCKET}/{GCS_PREFIX}/")
    print("=" * 80)
    
    token = get_auth_token()
    rag_map_by_name, rag_map_by_uri = fetch_all_rag_files(token)
    
    records_all = []
    records_rfis = []
    records_addenda = []
    records_drawings = []
    records_specs = []
    
    document_index = {}
    
    count = 0
    for root, dirs, files in os.walk(LOCAL_ROOT):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext not in [".pdf", ".docx", ".doc"]:
                continue
                
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, LOCAL_ROOT).replace("\\", "/")
            
            # Form GCS URI
            gcs_uri = f"gs://{GCS_BUCKET}/{GCS_PREFIX}/{rel_path}"
            
            # Find RAG File ID if existing
            fname_clean = f.lower()
            rag_file_id = rag_map_by_uri.get(gcs_uri) or rag_map_by_name.get(fname_clean) or ""
            
            meta = classify_document(rel_path, f)
            doc_id = sanitize_id(f"{meta['document_type']}_{meta['sheet_number']}_{meta['sequence_or_revision']}_{count}")
            
            struct_data = {
                "document_type": meta["document_type"],
                "sequence_or_revision": meta["sequence_or_revision"],
                "folder_path": meta["folder_path"],
                "is_latest": meta["is_latest"],
                "discipline": meta["discipline"],
                "sheet_number": meta["sheet_number"],
                "filename": f,
                "rag_file_id": rag_file_id,
            }
            
            # Vertex AI Search JSONL Record
            record = {
                "id": doc_id,
                "jsonData": json.dumps(struct_data),
                "structData": struct_data,
                "content": {
                    "mimeType": "application/pdf" if ext == ".pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "uri": gcs_uri
                }
            }
            
            records_all.append(record)
            
            if meta["document_type"] == "rfi":
                records_rfis.append(record)
            elif meta["document_type"] == "addendum":
                records_addenda.append(record)
            elif meta["document_type"] == "drawing":
                records_drawings.append(record)
            elif meta["document_type"] == "spec":
                records_specs.append(record)
                
            # Store in lookup index
            document_index[f] = {
                **struct_data,
                "id": doc_id,
                "gcs_uri": gcs_uri,
                "local_path": full_path,
            }
            if meta["sheet_number"]:
                # Keep latest sheet in index
                if meta["sheet_number"] not in document_index or meta["is_latest"]:
                    document_index[meta["sheet_number"]] = {
                        **struct_data,
                        "id": doc_id,
                        "gcs_uri": gcs_uri,
                        "local_path": full_path,
                    }
                    
            count += 1
            
    print(f"\n--> Processed {count} documents:")
    print(f"    - RFIs:           {len(records_rfis)}")
    print(f"    - Addenda:        {len(records_addenda)}")
    print(f"    - Drawings:       {len(records_drawings)}")
    print(f"    - Specifications: {len(records_specs)}")
    print(f"    - Total Records:  {len(records_all)}")
    
    # Write JSONL files locally
    os.makedirs("metadata_output", exist_ok=True)
    
    def write_jsonl(filename, records):
        p = os.path.join("metadata_output", filename)
        with open(p, "w", encoding="utf-8") as out:
            for r in records:
                # Vertex AI Search accepts line with structData and content
                line_data = {
                    "id": r["id"],
                    "structData": r["structData"],
                    "content": r["content"]
                }
                out.write(json.dumps(line_data, ensure_ascii=False) + "\n")
        print(f"    Wrote: {p} ({len(records)} lines)")
        return p
        
    path_all = write_jsonl("metadata_hospital_trauma_all.jsonl", records_all)
    path_rfis = write_jsonl("metadata_rfis.jsonl", records_rfis)
    path_addenda = write_jsonl("metadata_addenda.jsonl", records_addenda)
    path_drawings = write_jsonl("metadata_drawings.jsonl", records_drawings)
    path_specs = write_jsonl("metadata_specs.jsonl", records_specs)
    
    # Save document_index.json locally and to frontend/src/config/
    index_path = "document_index.json"
    with open(index_path, "w", encoding="utf-8") as out:
        json.dump(document_index, out, indent=2, ensure_ascii=False)
    print(f"    Wrote: {index_path} ({len(document_index)} entries)")
    
    frontend_config_dir = os.path.join("frontend", "src", "config")
    os.makedirs(frontend_config_dir, exist_ok=True)
    frontend_index_path = os.path.join(frontend_config_dir, "document_index.json")
    with open(frontend_index_path, "w", encoding="utf-8") as out:
        json.dump(document_index, out, indent=2, ensure_ascii=False)
    print(f"    Synchronized: {frontend_index_path}")
    
    # Upload to Cloud Storage
    print("\n--> Uploading JSONL metadata files to Google Cloud Storage...")
    upload_to_gcs(path_all, f"{GCS_PREFIX}/metadata/metadata_hospital_trauma_all.jsonl", token)
    upload_to_gcs(path_rfis, f"{GCS_PREFIX}/metadata/metadata_rfis.jsonl", token)
    upload_to_gcs(path_addenda, f"{GCS_PREFIX}/metadata/metadata_addenda.jsonl", token)
    upload_to_gcs(path_drawings, f"{GCS_PREFIX}/metadata/metadata_drawings.jsonl", token)
    upload_to_gcs(path_specs, f"{GCS_PREFIX}/metadata/metadata_specs.jsonl", token)
    
    print("\n" + "=" * 80)
    print("  METADATA INGESTION ARTIFACTS READY IN GCS:")
    print(f"  gs://{GCS_BUCKET}/{GCS_PREFIX}/metadata/metadata_hospital_trauma_all.jsonl")
    print(f"  gs://{GCS_BUCKET}/{GCS_PREFIX}/metadata/metadata_rfis.jsonl")
    print(f"  gs://{GCS_BUCKET}/{GCS_PREFIX}/metadata/metadata_addenda.jsonl")
    print(f"  gs://{GCS_BUCKET}/{GCS_PREFIX}/metadata/metadata_drawings.jsonl")
    print(f"  gs://{GCS_BUCKET}/{GCS_PREFIX}/metadata/metadata_specs.jsonl")
    print("=" * 80)

if __name__ == "__main__":
    main()
