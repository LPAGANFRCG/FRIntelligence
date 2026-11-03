# 🏥 Hospital Trauma | RAG Intelligence Explorer

Interfaz gráfica moderna y conector de búsqueda semántica para el **RAG Corpus** en Google Cloud Vertex AI.

- **Proyecto (Display):** `FRCG-Tools-AG`
- **Proyecto (ID técnico):** `frcg-antigravity`
- **Ubicación:** `us-central1`
- **Corpus:** `HOSPITAL TRAUMA`
- **Resource ID:** `projects/frcg-antigravity/locations/us-central1/ragCorpora/255759598760230912`
- **Archivos:** 944 documentos (PDFs de especificaciones técnicas, addenda y planos arquitectónicos)
- **Modelo de Embeddings:** `text-multilingual-embedding-002`

---

## 🌐 Cómo usar la Interfaz Gráfica (Browser GUI)

La aplicación corre en tu navegador en:
👉 **[http://localhost:8501](http://localhost:8501)**

Para iniciarla en cualquier momento:
1. Haz doble clic en [`iniciar_gui.bat`](file:///C:/Testing%20RAG%20w%20Cloud/iniciar_gui.bat)
2. O ejecuta en PowerShell:
```powershell
python -m streamlit run app.py
```

---

## ✨ Novedades y Capacidades Agregadas

1. **Diseño Visual de Alto Nivel:**
   - Tema oscuro moderno con estilo *Glassmorphism* (Slate / Cyan / Emerald).
   - Badges automáticos de categorización: `📐 Plano / Dibujo`, `📋 Especificación / RFP`, `📝 Addendum`, `🏥 Equipamiento`.
   - Indicador visual de porcentaje de relevancia semántica (`✨ Relevancia 95%`).
   - Renderizado completo de tablas técnicas (se leen como tablas limpias en vez de texto plano).

2. **Apertura y Visualización Directa de PDFs:**
   - 👁️ **Ver PDF en pantalla:** Incrusta el visor interactivo de PDF dentro del navegador con zoom, páginas y búsqueda interna.
   - 🖥️ **Abrir en Acrobat / Edge:** Descarga el archivo temporalmente y lo abre directamente en tu lector predeterminado de Windows con un solo clic.
   - 📥 **Descargar PDF:** Para guardarlo en tu computadora.
   - 🌐 **Ver en GCP:** Enlace directo al archivo en la consola de Google Cloud Storage.
