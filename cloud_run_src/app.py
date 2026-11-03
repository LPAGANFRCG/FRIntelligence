"""Main entry point for the app.

This app is generated based on your prompt in Vertex AI Studio using
Google GenAI Python SDK (https://googleapis.github.io/python-genai/) and
Gradio (https://www.gradio.app/).

You can customize the app by editing the code in Cloud Run source code editor.
You can also update the prompt in Vertex AI Studio and redeploy it.
"""

import base64
from google import genai
from google.genai import types
import gradio as gr
import utils


def generate(
    message,
    history: list[gr.ChatMessage],
    request: gr.Request
):
  """Function to call the model based on the request."""

  utils.validate_key(request)

  client = genai.Client(
      vertexai=True,
      project="frcg-antigravity",
      location="global",
      http_options=types.HttpOptions(
          headers={"x-goog-api-client": "vertex-agent-studio-prompt-app/1"},
      ),
  )
  msg1_text1 = types.Part.from_text(text=f"""Actúa como un equipo multidisciplinario senior de construcción y estimados en Puerto Rico, alternando fluidamente según la consulta entre los roles de:
Senior Cost Estimator / Quantity Surveyor (enfoque en CSI MasterFormat, takeoffs, rendimientos, partidas, pricing de materiales, labor rates locales, equipo, overhead y contingencias).
Project Engineer (enfoque en planos técnicos, especificaciones, submittals, RFIs, detección de interferencias, códigos aplicables como PRBC, ACI, ASTM y estándares locales).
Project Manager / Superintendente (enfoque en constructibilidad, logística de obra, secuencia crítica, trade coordination y mitigación de riesgos de campo).
Instrucciones operativas obligatorias:
Grounding estricto: Basa tus respuestas exclusivamente en la información provista en los documentos del corpus RAG (planos, specs, addendums, scopes). Si un dato, dimensión, nota general o especificación no aparece o es ambiguo, señálalo explícitamente y formula el RFI correspondiente en vez de asumir o inventar.
Estructura y rigor técnico: Identifica siempre la división CSI pertinente (MasterFormat), la unidad de medida estándar (CY, SF, LF, TON, EA, etc.) y la referencia exacta del documento/plano citado.
Tono: Profesional, directo, técnico y pragmático para el entorno de construcción y licitación en Puerto Rico.""")


  model = "gemini-3.1-flash-lite"
  contents = [
    types.Content(
      role="user",
      parts=[
        msg1_text1
      ]
    ),
  ]

  for prev_msg in history:
    role = "user" if prev_msg["role"] == "user" else "model"
    parts = utils.get_parts_from_message(prev_msg["content"])
    if parts:
      contents.append(types.Content(role=role, parts=parts))

  if message:
    contents.append(
        types.Content(role="user", parts=utils.get_parts_from_message(message))
    )

  tools = [
      types.Tool(
          retrieval=types.Retrieval(
              vertex_rag_store=types.VertexRagStore(
                  rag_resources=[
                      types.VertexRagStoreRagResource(
                          rag_corpus="projects/1004674164524/locations/us-central1/ragCorpora/255759598760230912"
                      )
                  ],
              )
          )
      )
  ]
  generate_content_config = types.GenerateContentConfig(
      temperature=1,
      top_p=0.95,
      max_output_tokens=65535,
      safety_settings=[
          types.SafetySetting(
              category="HARM_CATEGORY_HATE_SPEECH",
              threshold="OFF"
          ),
          types.SafetySetting(
              category="HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold="OFF"
          ),
          types.SafetySetting(
              category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold="OFF"
          ),
          types.SafetySetting(
              category="HARM_CATEGORY_HARASSMENT",
              threshold="OFF"
          )
      ],
      tools=tools,
  )

  results = []
  for chunk in client.models.generate_content_stream(
      model=model,
      contents=contents,
      config=generate_content_config,
  ):
    if chunk.candidates and chunk.candidates[0] and chunk.candidates[0].content:
      results.extend(
          utils.convert_content_to_gr_type(chunk.candidates[0].content)
      )
      if results:
        yield results

with gr.Blocks(theme=utils.custom_theme) as demo:
  with gr.Row():
    gr.HTML(utils.public_access_warning)
  with gr.Row():
    with gr.Column(scale=1):
      with gr.Row():
        gr.HTML("<h2>Welcome to Vertex AI GenAI App!</h2>")
      with gr.Row():
        gr.HTML("""This prototype was built using your Vertex AI Studio prompt.
            Follow the steps and recommendations below to begin.""")
      with gr.Row():
        gr.HTML(utils.next_steps_html)

    with gr.Column(scale=2, variant="panel"):
      gr.ChatInterface(
          fn=generate,
          title="Hospital-Trauma-Auditor",
          type="messages",
          multimodal=True,
      )

app = utils.create_app(demo)

if __name__ == "__main__":
  utils.serve(app)