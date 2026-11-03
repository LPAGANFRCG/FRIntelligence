"""Utils for the app."""

import base64
import hashlib
import hmac
import http.cookies
import io
import mimetypes
import os
import typing
import urllib.parse
from fastapi import FastAPI
from google.genai import types
import gradio as gr
from PIL import Image
import uvicorn

# The app secret this deployment was generated with. Empty means the deployment
# was configured without one.
secret_key = "wZOZ7mvu9qX2KzkG9etYSGAqRu9XTv1p"

# Vertex AI Studio appends the secret to the app URL as "?key="; "auth_key" is
# accepted as well so that a URL built by hand against the older spelling keeps
# working.
auth_key_query_params = ("key", "auth_key")

session_cookie_name = "session"

# Error message for invalid key.
ker_error_msg = """Please open the app from
<a target='_blank'
  href='https://console.cloud.google.com/vertex-ai/studio/saved-prompts/locations/global/559856202578657280?project=frcg-antigravity&deploy=true'>
  Vertex AI Studio
</a>, not Cloud Run.<br/><br/>
Or, obtain the key from the "Manage App" dialog within Vertex AI Studio and
append it to the url as "?key=SECRET_KEY"."""


# Google's Blue color theme
google_blue_color_hue = gr.themes.Color(
    name="google_blue",
    c50="#E8F0FE",
    c100="#D2E3FC",
    c200="#AECBFA",
    c300="#8AB4F8",
    c400="#669DF6",
    c500="#4285F4",
    c600="#1A73E8",
    c700="#1967D2",
    c800="#185ABC",
    c900="#0f172a",
    c950="#174EA6",
)

# Custom theme for the app.
custom_theme = gr.themes.Default(
    primary_hue=google_blue_color_hue,
    secondary_hue=google_blue_color_hue,
    font=[gr.themes.GoogleFont("Google Sans")]
).set(
    button_cancel_background_fill="*secondary_200",
    button_cancel_background_fill_dark="*secondary_200",
    button_cancel_background_fill_hover="*secondary_300",
    button_cancel_background_fill_hover_dark="*secondary_300",
    button_cancel_text_color="black",
    button_cancel_text_color_dark="white",
)

public_access_warning = """
<div style="background-color: #fffacd; border: 1px solid #eedc82; padding: 20px; margin: 20px; border-radius: 5px; color: #8b4513; font-weight: bold; text-align: center;">
  <span style="margin-right: 10px;">⚠️</span>
  Warning: This app allows unauthenticated access by default. Avoid using it for sensitive data. Access control is coming soon.
</div>"""

next_steps_html = """
<span>Next steps:</span>
<ul style="list-style-position: outside; margin-left: 1em;">
  <li>Go to Cloud Run
    <a target='_blank'
       href='https://console.cloud.google.com/run/detail/us-central1/genai-app-hospital-trauma-auditor-1-1793671453919/source?project=frcg-antigravity'
    >
      source code editor
    </a> to customize application code.
  </li>
  <li>Go to your
    <a target='_blank'
       href='https://console.cloud.google.com/vertex-ai/studio/saved-prompts/locations/global/559856202578657280?project=frcg-antigravity'
    >
        Vertex AI Studio prompt
    </a> to update and redeploy it.
  </li>
  <li>Go to Cloud Run
    <a target='_blank'
       href='https://console.cloud.google.com/run/detail/us-central1/genai-app-hospital-trauma-auditor-1-1793671453919/security?project=frcg-antigravity'
    >
      Security settings
    </a> to turn off unauthenticated access when it's not needed.
    <a target='_blank' href='https://cloud.google.com/run/docs/authenticating/overview'>
    Learn more
    </a>
  </li>
</ul>
"""


def matches_secret(presented: typing.Any, expected: str) -> bool:
  """Compares a value supplied by the caller against an expected secret.

  Both sides are compared as bytes: hmac.compare_digest rejects str arguments
  holding non-ASCII characters, and the caller chooses what it presents.

  Args:
    presented: The value supplied by the caller.
    expected: The value it has to equal.

  Returns:
    Whether the two are equal.
  """
  if not isinstance(presented, str) or not presented:
    return False
  return hmac.compare_digest(
      presented.encode("utf-8"), expected.encode("utf-8")
  )


def session_token() -> str:
  """Derives the session cookie value from the app secret.

  The cookie carries a derivation rather than the secret itself, so a browser
  that has visited the app does not also hold the key that opens it.

  Returns:
    The value to store in, and require from, the session cookie.
  """
  return hmac.new(
      secret_key.encode("utf-8"), b"genapp-session", hashlib.sha256
  ).hexdigest()


def is_authenticated(
    offered_keys: typing.Iterable[typing.Any], offered_session: typing.Any
) -> bool:
  """Whether a caller presented the app secret, or a session derived from it.

  Args:
    offered_keys: The values the caller offered as the app secret.
    offered_session: The value the caller offered as its session.

  Returns:
    Whether the caller may be served.
  """
  # Fail closed. A deployment with no secret configured has nothing to
  # authenticate against, so it serves nothing -- this app calls Vertex AI with
  # the runtime service account's own credentials and must never be open.
  if not secret_key:
    return False

  # Neither the secret nor the value presented against it is ever logged.
  if any(matches_secret(key, secret_key) for key in offered_keys):
    return True
  return matches_secret(offered_session, session_token())


def validate_key(request):
  """Rejects a model call that did not present the app secret.

  Args:
    request: The request object.

  Raises:
    gr.Error: The request did not present the app secret.
  """
  authenticated = is_authenticated(
      [request.query_params.get(name) for name in auth_key_query_params],
      request.cookies.get(session_cookie_name),
  )
  if not authenticated:
    raise gr.Error(
        ker_error_msg, None, title="[Authorization error] Invalid secret key"
    )


def keys_in_scope(scope) -> list[str]:
  """Reads the values offered as the app secret out of an ASGI scope.

  Args:
    scope: The ASGI connection scope.

  Returns:
    Every value the query string offered under an accepted parameter name.
  """
  query = urllib.parse.parse_qs(
      scope.get("query_string", b"").decode("latin-1")
  )
  return [
      value for name in auth_key_query_params for value in query.get(name, [])
  ]


def session_in_scope(scope) -> typing.Optional[str]:
  """Reads the session cookie out of an ASGI scope.

  Args:
    scope: The ASGI connection scope.

  Returns:
    The value of the session cookie, or None when it is absent or unparseable.
  """
  jar = http.cookies.SimpleCookie()
  for name, value in scope.get("headers", ()):
    if name == b"cookie":
      try:
        jar.load(value.decode("latin-1"))
      except http.cookies.CookieError:
        return None
  morsel = jar.get(session_cookie_name)
  return morsel.value if morsel else None


async def refuse(scope, send) -> None:
  """Turns a caller away without reaching the application.

  Args:
    scope: The ASGI connection scope.
    send: The ASGI send callable.
  """
  if scope["type"] == "websocket":
    await send({"type": "websocket.close", "code": 1008})
    return
  body = ker_error_msg.encode("utf-8")
  await send({
      "type": "http.response.start",
      "status": 403,
      "headers": [
          (b"content-type", b"text/html; charset=utf-8"),
          (b"content-length", str(len(body)).encode("latin-1")),
      ],
  })
  await send({"type": "http.response.body", "body": body})


def sending_session_cookie(send):
  """Wraps an ASGI send callable so the response carries the session cookie.

  Args:
    send: The ASGI send callable.

  Returns:
    A send callable that adds the cookie to the response head.
  """
  cookie = (
      f"{session_cookie_name}={session_token()}; Path=/; HttpOnly; Secure;"
      " SameSite=Strict"
  ).encode("latin-1")

  async def send_with_cookie(message):
    if message["type"] == "http.response.start":
      message.setdefault("headers", []).append((b"set-cookie", cookie))
    await send(message)

  return send_with_cookie


class AuthenticateEveryRoute:
  """Refuses any connection, of any protocol, that did not present the secret.

  This sits above routing rather than inside a single handler, so it covers the
  pages, the static assets, the queue and upload endpoints and the websocket --
  a check inside the model call leaves all of those open.
  """

  def __init__(self, app):
    self.app = app

  async def __call__(self, scope, receive, send):
    if scope["type"] not in ("http", "websocket"):
      await self.app(scope, receive, send)
      return

    if not is_authenticated(keys_in_scope(scope), session_in_scope(scope)):
      await refuse(scope, send)
      return

    # The browser replays the cookie on the requests the page makes for
    # itself, which do not carry the key.
    await self.app(scope, receive, sending_session_cookie(send))


def create_app(demo: gr.Blocks) -> FastAPI:
  """Wraps the Gradio app in a server that authenticates every route.

  Args:
    demo: The Gradio app.

  Returns:
    The application to serve.
  """
  app = FastAPI()
  gr.mount_gradio_app(app, demo, path="/", show_error=True)
  app.add_middleware(AuthenticateEveryRoute)
  return app


def serve(app: FastAPI) -> None:
  """Serves the app on the address Cloud Run gave it.

  Args:
    app: The application to serve.
  """
  uvicorn.run(
      app,
      host=os.environ.get("GRADIO_SERVER_NAME", "0.0.0.0"),
      port=int(os.environ.get("GRADIO_SERVER_PORT", "8080")),
  )


def get_part_from_file(file):
  """Help function to get the part from a file."""
  guessed_type = mimetypes.guess_type(file)
  if guessed_type:
    mime_type = guessed_type[0]
  else:
    mime_type = "application/octet-stream"
  with open(file, "rb") as f:
    data = f.read()
    return types.Part.from_bytes(
        data=data,
        mime_type=mime_type,
    )


def get_bytes_from_image(image: Image.Image, mime_type: str = "PNG") -> bytes:
  """Converts a PIL Image object to bytes in the specified format.

  Args:
      image: The PIL Image object.
      mime_type: The image format to save as (e.g., 'PNG', 'JPEG', 'GIF').
        Defaults to 'PNG'.

  Returns:
      A bytes object representing the image in the specified format.
  """
  img_byte_arr = io.BytesIO()
  image.save(img_byte_arr, format=mime_type)
  img_byte_arr = img_byte_arr.getvalue()
  return img_byte_arr


def get_parts_from_message(
    message: typing.Union[str, tuple[str, ...], dict[str, str], gr.Image],
):
  """Help function to get the parts from a message."""

  parts = []
  if isinstance(message, dict):
    parts = []
    if "text" in message and message["text"]:
      parts.append(types.Part.from_text(text=message["text"]))

    if "files" in message:
      for file in message["files"]:
        parts.append(get_part_from_file(file))
  elif isinstance(message, str):
    if message:
      parts.append(types.Part.from_text(text=message))
  elif isinstance(message, gr.Image):
    if message.type == "pil":
      bytes_data = get_bytes_from_image(message.value)
      parts.append(
          types.Part.from_bytes(data=bytes_data, mime_type=message.format)
      )
    elif message.type == "filepath":
      parts.append(get_part_from_file(message.value))
  else:
    for part in list(message):
      if part.startswith("/tmp/gradio"):
        parts.append(get_part_from_file(part))
      elif part:
        parts.append(types.Part.from_text(text=part))

  # To avoid error when sending empty message.
  if not parts:
    parts.append(types.Part.from_text(text=" "))

  return parts


def convert_blob_to_gr_image(blob: types.Blob) -> gr.Image:
  """Converts a blob of image data to a gr.Image object."""
  blob_data = blob.data
  # Create an in-memory binary stream using io.BytesIO
  image_stream = io.BytesIO(blob_data)

  # Open the image from the stream using PIL.Image.open()
  image = Image.open(image_stream)
  return gr.Image(image)


def image_blob_to_markdown_base64(blob: types.Blob) -> str:
  """Converts image bytes to a Markdown displayable string using Base64 encoding."""
  blob_data = blob.data
  base64_string = base64.b64encode(blob_data).decode("utf-8")
  markdown_string = (
      f'<img src="data:image/{blob.mime_type};base64,{base64_string}">'
  )
  return markdown_string


def convert_part_to_gr_type(
    part: types.Part,
    use_markdown: bool = False,
) -> typing.Optional[typing.Union[str, gr.Image]]:
  """Converts a part object to a str or gr.Image object."""
  if part.text:
    return part.text
  elif part.inline_data:
    if use_markdown:
      return image_blob_to_markdown_base64(part.inline_data)
    return convert_blob_to_gr_image(part.inline_data)
  else:
    return None


def convert_content_to_gr_type(
    content: typing.Optional[types.Content],
    use_markdown: bool = False,
) -> typing.Optional[typing.Union[str, gr.Image]]:
  """Converts a content object to a gr.ChatMessage object."""
  if content is None or content.parts is None:
    return []

  results = [
      convert_part_to_gr_type(part, use_markdown) for part in content.parts
  ]
  return [res for res in results if res is not None]