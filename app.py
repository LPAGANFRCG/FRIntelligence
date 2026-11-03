import streamlit as st
import google.auth
import google.auth.transport.requests
from google.cloud import storage
import requests
import json
import base64
import os
import tempfile
import urllib.parse

# --- CONFIGURACIÓN DE PÁGINA ---
st.set_page_config(
    page_title="Hospital Trauma | RAG Intelligence",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- ESTILOS CSS MODERNOS (Glassmorphism & Healthcare Tech) ---
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

    html, body, [class*="css"] {
        font-family: 'Plus Jakarta Sans', sans-serif;
    }

    /* Fondo general */
    .stApp {
        background: radial-gradient(circle at 15% 20%, #0d1527 0%, #060b14 100%);
        color: #f1f5f9;
    }

    /* Hero Banner */
    .hero-container {
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%);
        border: 1px solid rgba(56, 189, 248, 0.2);
        box-shadow: 0 12px 30px -10px rgba(6, 182, 212, 0.15);
        border-radius: 20px;
        padding: 28px 36px;
        margin-bottom: 24px;
        backdrop-filter: blur(12px);
    }
    
    .hero-title {
        font-size: 2.2rem;
        font-weight: 800;
        background: linear-gradient(90deg, #38bdf8, #818cf8, #34d399);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .hero-subtitle {
        color: #94a3b8;
        font-size: 1.05rem;
        margin-bottom: 16px;
    }

    /* Badges */
    .badge-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
    }
    
    .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.02em;
    }
    
    .badge-blue {
        background: rgba(14, 165, 233, 0.15);
        color: #38bdf8;
        border: 1px solid rgba(14, 165, 233, 0.35);
    }
    
    .badge-green {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.35);
    }
    
    .badge-purple {
        background: rgba(168, 85, 247, 0.15);
        color: #c084fc;
        border: 1px solid rgba(168, 85, 247, 0.35);
    }

    /* Tarjetas de resultados */
    .doc-card {
        background: rgba(30, 41, 59, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 22px;
        margin-bottom: 20px;
        backdrop-filter: blur(16px);
        transition: all 0.25s ease-in-out;
    }

    .doc-card:hover {
        border-color: rgba(56, 189, 248, 0.4);
        box-shadow: 0 10px 25px -5px rgba(14, 165, 233, 0.15);
        transform: translateY(-2px);
    }

    .doc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        padding-bottom: 10px;
    }

    .doc-title {
        font-size: 1.15rem;
        font-weight: 700;
        color: #f8fafc;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .doc-path {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.78rem;
        color: #64748b;
        background: rgba(15, 23, 42, 0.6);
        padding: 4px 10px;
        border-radius: 8px;
        margin-bottom: 14px;
        word-break: break-all;
    }

    .similarity-pill {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.85rem;
        font-weight: 700;
    }

    .similarity-high {
        background: rgba(16, 185, 129, 0.2);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.4);
    }

    .similarity-med {
        background: rgba(245, 158, 11, 0.2);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.4);
    }

    /* Tablas dentro de los fragmentos */
    table {
        width: 100% !important;
        border-collapse: collapse !important;
        margin: 12px 0 !important;
        font-size: 0.88rem !important;
    }
    
    th {
        background: rgba(30, 41, 59, 0.8) !important;
        color: #38bdf8 !important;
        padding: 8px 12px !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }

    td {
        padding: 8px 12px !important;
        border: 1px solid rgba(255, 255, 255, 0.05) !important;
        background: rgba(15, 23, 42, 0.4) !important;
    }

    /* Visor de PDF embebido */
    .pdf-viewer-frame {
        border-radius: 14px;
        border: 2px solid rgba(56, 189, 248, 0.3);
        box-shadow: 0 15px 35px -10px rgba(0, 0, 0, 0.6);
        margin-top: 15px;
        background: #1e293b;
    }

    /* Botones primarios */
    .stButton > button[kind="primary"] {
        background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%) !important;
        border: none !important;
        border-radius: 10px !important;
        font-weight: 600 !important;
        padding: 8px 24px !important;
        box-shadow: 0 4px 14px 0 rgba(37, 99, 235, 0.39) !important;
        transition: all 0.2s ease !important;
    }

    .stButton > button[kind="primary"]:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 6px 20px 0 rgba(37, 99, 235, 0.55) !important;
    }

    /* Input text box */
    .stTextInput > div > div > input {
        border-radius: 12px !important;
        background: rgba(15, 23, 42, 0.8) !important;
        border: 1px solid rgba(56, 189, 248, 0.25) !important;
        color: #f8fafc !important;
        padding: 12px 18px !important;
        font-size: 1.05rem !important;
    }

    .stTextInput > div > div > input:focus {
        border-color: #38bdf8 !important;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2) !important;
    }
</style>
""", unsafe_allow_html=True)

# --- CONSTANTES ---
CORPUS_ID = "projects/frcg-antigravity/locations/us-central1/ragCorpora/255759598760230912"
LOCATION = "us-central1"
PROJECT_ID = "frcg-antigravity"

# --- FUNCIONES DE ACCESO AL RAG ---
@st.cache_resource(ttl=3000)
def get_credentials():
    creds, _ = google.auth.default()
    auth_req = google.auth.transport.requests.Request()
    creds.refresh(auth_req)
    return creds

def query_rag(query_text: str, top_k: int = 5, distance_threshold: float = 0.8):
    creds = get_credentials()
    if not creds.valid:
        auth_req = google.auth.transport.requests.Request()
        creds.refresh(auth_req)

    url = f"https://{LOCATION}-aiplatform.googleapis.com/v1beta1/projects/{PROJECT_ID}/locations/{LOCATION}:retrieveContexts"
    headers = {
        "Authorization": f"Bearer {creds.token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "vertexRagStore": {
            "ragResources": [{"ragCorpus": CORPUS_ID}],
            "vectorDistanceThreshold": distance_threshold
        },
        "query": {"text": query_text}
    }
    
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    if response.status_code != 200:
        raise Exception(f"Error {response.status_code}: {response.text}")
        
    data = response.json()
    contexts = data.get("contexts", {}).get("contexts", [])
    return contexts[:top_k]

# --- FUNCIONES PARA MANEJO DE PDFS DESDE GCS ---
@st.cache_data(show_spinner=False, max_entries=15)
def download_pdf_from_gcs(gs_uri: str) -> bytes:
    """Descarga los bytes del PDF directamente desde Google Cloud Storage."""
    clean = gs_uri.replace("gs://", "")
    parts = clean.split("/", 1)
    bucket_name = parts[0]
    blob_name = parts[1]
    
    client = storage.Client(project=PROJECT_ID)
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    return blob.download_as_bytes()

def get_doc_category(filename: str, source_uri: str):
    """Clasifica el documento para mostrar un badge profesional."""
    f = filename.upper()
    uri = source_uri.upper()
    if "DRAWINGS" in uri or f.startswith(("A-", "M-", "E-", "S-", "P-")):
        return ("📐 Plano / Dibujo", "badge-blue")
    elif "ADDENDUM" in f or "ADD#" in uri:
        return ("📝 Addendum", "badge-purple")
    elif "EQUIPMENT" in f or "MEDICAL" in f:
        return ("🏥 Equipamiento", "badge-green")
    elif "SPECIFICATION" in uri or "RFP" in uri or "ATTACHMENT" in f:
        return ("📋 Especificación / RFP", "badge-blue")
    return ("📄 Documento", "badge-purple")

# --- BARRA LATERAL (SIDEBAR) ---
with st.sidebar:
    st.markdown("### ⚙️ Parámetros de Búsqueda")
    top_k = st.slider("Resultados a mostrar (Top K)", 1, 15, 5, 1)
    threshold = st.slider(
        "Sensibilidad Semántica", 
        0.3, 1.0, 0.8, 0.05,
        help="0.8 es óptimo para términos médicos y códigos de planos. Valores más altos devuelven más contexto."
    )

    st.markdown("---")
    st.markdown("### ⚡ Preguntas Frecuentes")
    quick_queries = [
        "Operating Room equipment requirements",
        "Requisitos de filtros HEPA y unidades de aire",
        "Surgical scrub sink dual station y accesorios ADA",
        "Planos arquitectónicos de salas quirúrgicas",
        "Generador de emergencia y transferencia eléctrica",
        "Especificaciones de gases médicos y tomas de oxígeno"
    ]
    for q in quick_queries:
        if st.button(q, use_container_width=True):
            st.session_state["search_query"] = q

    st.markdown("---")
    st.markdown("### 🏥 Metadatos del Sistema")
    st.markdown(f"**Proyecto:** `FRCG-Tools-AG` (`{PROJECT_ID}`)")
    st.markdown(f"**Región:** `{LOCATION}`")
    st.markdown("**Corpus:** `HOSPITAL TRAUMA`")
    st.markdown("**Indexados:** 944 archivos (PDFs/Planos)")
    st.markdown("**Motor:** `Vertex AI RAG Engine`")
    st.markdown("**Embeddings:** `multilingual-002`")

# --- HERO BANNER ---
st.markdown("""
<div class="hero-container">
    <div class="hero-title">
        🏥 Hospital Trauma — RAG Explorer
    </div>
    <div class="hero-subtitle">
        Buscador semántico avanzado para planos, adendas y especificaciones técnicas de licitación.
    </div>
    <div class="badge-row">
        <span class="badge badge-green">🟢 Conexión Activa con Vertex AI</span>
        <span class="badge badge-blue">📁 944 Archivos Indexados</span>
        <span class="badge badge-purple">🌐 Multilingüe (Español / Inglés)</span>
        <span class="badge badge-blue">☁️ Google Cloud Storage Integrado</span>
    </div>
</div>
""", unsafe_allow_html=True)

# --- BARRA DE BÚSQUEDA ---
query_val = st.session_state.get("search_query", "")

col_input, col_btn = st.columns([5, 1])
with col_input:
    user_query = st.text_input(
        "Haz una pregunta o busca un plano:",
        value=query_val,
        placeholder="Ej: Especificaciones de filtros HEPA, Surgical Scrub Sinks, medidas de puertas...",
        label_visibility="collapsed"
    )
with col_btn:
    btn_search = st.button("🔍 Buscar", type="primary", use_container_width=True)

# --- EJECUCIÓN Y RENDERIZADO DE RESULTADOS ---
if (btn_search or user_query) and user_query.strip():
    query_text = user_query.strip()
    
    with st.spinner(f"Analizando 944 documentos en Vertex AI para: '{query_text}'..."):
        try:
            results = query_rag(query_text, top_k=top_k, distance_threshold=threshold)
            
            if not results:
                st.warning("⚠️ No se encontraron fragmentos relevantes. Prueba subiendo la sensibilidad a 0.85 o utilizando términos más generales.")
            else:
                st.markdown(f"### 🎯 Resultados encontrados ({len(results)} fragmentos)")

                # Pestañas para organizar la vista
                tab_cards, tab_sources = st.tabs(["📄 Fragmentos y Visor PDF", "📂 Documentos Involucrados"])

                with tab_sources:
                    unique_sources = list(set(r.get("sourceUri", "") for r in results if r.get("sourceUri")))
                    for s in unique_sources:
                        fname = s.split("/")[-1] if "/" in s else s
                        st.markdown(f"- 📄 **{fname}** (`{s}`)")

                with tab_cards:
                    for i, item in enumerate(results, start=1):
                        source_uri = item.get("sourceUri", "Desconocido")
                        filename = source_uri.split("/")[-1] if "/" in source_uri else source_uri
                        text = item.get("text", "").strip()
                        dist = item.get("distance")
                        
                        cat_label, cat_badge = get_doc_category(filename, source_uri)
                        
                        # Cálculo de porcentaje de relevancia intuitivo
                        relevance_pct = 95
                        if dist is not None:
                            relevance_pct = int(max(0, min(100, (1.0 - (dist / 1.5)) * 100)))

                        sim_class = "similarity-high" if relevance_pct >= 80 else "similarity-med"

                        # Tarjeta del documento
                        st.markdown(f"""
                        <div class="doc-card">
                            <div class="doc-header">
                                <div class="doc-title">
                                    <span class="badge {cat_badge}">{cat_label}</span>
                                    <span>#{i} • {filename}</span>
                                </div>
                                <div>
                                    <span class="similarity-pill {sim_class}">✨ Relevancia {relevance_pct}%</span>
                                </div>
                            </div>
                            <div class="doc-path">
                                🔗 <b>Cloud Storage:</b> {source_uri}
                            </div>
                        </div>
                        """, unsafe_allow_html=True)

                        # Renderizado del texto/tabla extraído
                        with st.container():
                            st.markdown(text)

                        # Botones de Acción para el PDF
                        col_view, col_win, col_dl, col_gcp = st.columns([1.5, 1.8, 1.5, 1.5])
                        
                        # Generador de clave única por item
                        item_key = f"pdf_item_{i}"
                        
                        with col_view:
                            view_pdf = st.checkbox(f"👁️ Ver PDF en pantalla", key=f"chk_{item_key}")
                        
                        # Descarga bajo demanda en memoria
                        pdf_data = None
                        if view_pdf:
                            try:
                                with st.spinner("Cargando PDF desde Google Cloud Storage..."):
                                    pdf_data = download_pdf_from_gcs(source_uri)
                            except Exception as dl_err:
                                st.error(f"No se pudo cargar el PDF: {dl_err}")

                        with col_win:
                            if st.button("🖥️ Abrir en Acrobat/Edge", key=f"win_{item_key}"):
                                try:
                                    if pdf_data is None:
                                        with st.spinner("Descargando PDF..."):
                                            pdf_data = download_pdf_from_gcs(source_uri)
                                    temp_dir = os.path.join(tempfile.gettempdir(), "rag_hospital_trauma")
                                    os.makedirs(temp_dir, exist_ok=True)
                                    clean_fname = "".join(c for c in filename if c.isalnum() or c in ("-", "_", ".", " ", "+")).strip()
                                    if not clean_fname.lower().endswith(".pdf"):
                                        clean_fname += ".pdf"
                                    local_pdf_path = os.path.join(temp_dir, clean_fname)
                                    with open(local_pdf_path, "wb") as f_out:
                                        f_out.write(pdf_data)
                                    os.startfile(local_pdf_path)
                                    st.toast(f"Abriendo {clean_fname} en tu visor de Windows...", icon="📂")
                                except Exception as win_err:
                                    st.error(f"Error al abrir en Windows: {win_err}")

                        with col_dl:
                            if pdf_data is not None:
                                st.download_button(
                                    label="📥 Descargar PDF",
                                    data=pdf_data,
                                    file_name=filename,
                                    mime="application/pdf",
                                    key=f"dl_{item_key}"
                                )
                            else:
                                if st.button("📥 Preparar Descarga", key=f"prep_{item_key}"):
                                    try:
                                        pdf_data = download_pdf_from_gcs(source_uri)
                                        st.download_button(
                                            label="💾 Guardar Archivo",
                                            data=pdf_data,
                                            file_name=filename,
                                            mime="application/pdf",
                                            key=f"save_{item_key}"
                                        )
                                    except Exception as d_err:
                                        st.error(f"Error: {d_err}")

                        with col_gcp:
                            # Link directo a la consola de Google Cloud Storage
                            clean_uri = source_uri.replace("gs://", "")
                            bucket_name, blob_name = clean_uri.split("/", 1)
                            encoded_blob = urllib.parse.quote(blob_name)
                            console_url = f"https://console.cloud.google.com/storage/browser/_details/{bucket_name}/{encoded_blob}?project={PROJECT_ID}"
                            st.link_button("🌐 Ver en GCP", url=console_url, use_container_width=True)

                        # Visor embebido interactivo si el checkbox está activo
                        if view_pdf and pdf_data:
                            b64_pdf = base64.b64encode(pdf_data).decode("utf-8")
                            pdf_iframe = f"""
                            <iframe 
                                class="pdf-viewer-frame"
                                src="data:application/pdf;base64,{b64_pdf}" 
                                width="100%" 
                                height="750px" 
                                type="application/pdf">
                            </iframe>
                            """
                            st.markdown(pdf_iframe, unsafe_allow_html=True)

                        st.markdown("---")

        except Exception as e:
            st.error(f"❌ Error al consultar Vertex AI RAG: {e}")

st.markdown("---")
st.markdown("<div style='text-align: center; color: #64748b; font-size: 0.85rem;'>FRCG-Tools-AG • Vertex AI RAG Engine • Diseñado para Hospital Trauma</div>", unsafe_allow_html=True)
