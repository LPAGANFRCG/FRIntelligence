"""
Cliente de consulta para el RAG Corpus 'HOSPITAL TRAUMA' en Google Cloud Vertex AI.
Proyecto: FRCG-Tools-AG (ID: frcg-antigravity)
Corpus ID: projects/frcg-antigravity/locations/us-central1/ragCorpora/255759598760230912
"""

import sys
import io
import argparse
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

def query_rag_corpus(query_text: str, top_k: int = 5, distance_threshold: float = 0.8):
    """
    Realiza una búsqueda semántica en el Corpus de Vertex AI RAG Engine.
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
    
    return contexts[:top_k]

def display_results(query_text: str, contexts: list):
    """Muestra los resultados de forma clara y legible."""
    print("=" * 80)
    print(f"[Consulta] {query_text}")
    print(f"[Resultados] Fragmentos relevantes encontrados: {len(contexts)}")
    print("=" * 80)
    
    if not contexts:
        print("\n[Aviso] No se encontraron fragmentos relevantes para esta consulta.")
        print("Sugerencia: Prueba con palabras clave mas generales o terminos en ingles/espanol.\n")
        return

    for i, ctx in enumerate(contexts, 1):
        source = ctx.get("sourceUri", "Desconocido")
        filename = source.split("/")[-1] if "/" in source else source
        text = ctx.get("text", "").strip()
        dist = ctx.get("distance")
        
        print(f"\n[{i}] Archivo: {filename}")
        print(f"    Ruta GCS: {source}")
        if dist is not None:
            print(f"    Score / Distancia: {dist}")
        print("    " + "-" * 70)
        for line in text.splitlines():
            print(f"    {line}")
        print("    " + "-" * 70)

def main():
    parser = argparse.ArgumentParser(description="Consulta tu RAG Corpus en Vertex AI (Hospital Trauma)")
    parser.add_argument("query", nargs="*", help="Texto de la consulta a realizar")
    parser.add_argument("--top-k", type=int, default=5, help="Numero maximo de fragmentos (default: 5)")
    parser.add_argument("--threshold", type=float, default=0.8, help="Umbral de distancia vectorial (default: 0.8)")
    
    args = parser.parse_args()
    
    if args.query:
        query_text = " ".join(args.query)
        contexts = query_rag_corpus(query_text, top_k=args.top_k, distance_threshold=args.threshold)
        display_results(query_text, contexts)
    else:
        # Modo interactivo
        print("=" * 80)
        print("Conectado al RAG Corpus: HOSPITAL TRAUMA (FRCG-Tools-AG)")
        print("Escribe tu pregunta y presiona Enter. (Escribe 'salir' para terminar)")
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
