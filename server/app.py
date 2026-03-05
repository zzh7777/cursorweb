import asyncio
import json
import uuid
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

from fastapi import FastAPI, Request, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from server import db, config
from server.cli import run_agent, LOG_DIR

DIST_DIR = Path(__file__).resolve().parent.parent / "dist"
ADMIN_HTML = Path(__file__).resolve().parent / "admin.html"
IMAGE_DIR = Path(__file__).resolve().parent.parent / "data" / "images"
IMAGE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Settings API ----------


@app.get("/api/settings")
def get_settings():
    return config.get_settings()


@app.patch("/api/settings")
async def patch_settings(request: Request):
    body = await request.json()
    updated = config.update_settings(body)
    return updated


# ---------- Conversations API ----------

@app.get("/api/conversations")
def list_conversations():
    return db.get_conversations()


@app.post("/api/conversations", status_code=201)
async def create_conversation(request: Request):
    body = await request.json()
    conv_id = str(uuid.uuid4())
    title = body.get("title", "New Chat")
    conv = db.create_conversation(conv_id, title)
    return conv


@app.get("/api/conversations/{conv_id}")
def get_conversation(conv_id: str):
    conv = db.get_conversation(conv_id)
    if not conv:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return conv


@app.patch("/api/conversations/{conv_id}")
async def patch_conversation(conv_id: str, request: Request):
    body = await request.json()
    title = body.get("title")
    if not title:
        return JSONResponse({"error": "title is required"}, status_code=400)
    db.update_conversation_title(conv_id, title)
    return {"ok": True}


@app.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str):
    db.delete_conversation(conv_id)
    return {"ok": True}

# ---------- Messages API ----------

@app.get("/api/conversations/{conv_id}/messages")
def list_messages(conv_id: str):
    return db.get_messages(conv_id)

# ---------- Admin / Debug API ----------

@app.get("/admin")
async def admin_page():
    if ADMIN_HTML.is_file():
        return HTMLResponse(ADMIN_HTML.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>admin.html not found</h1>", status_code=404)


@app.get("/api/debug/logs")
def debug_list_logs():
    if not LOG_DIR.is_dir():
        return []
    logs = sorted(LOG_DIR.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [
        {
            "name": f.name,
            "size": f.stat().st_size,
            "modified": f.stat().st_mtime,
        }
        for f in logs[:50]
    ]


@app.get("/api/debug/logs/{filename}")
def debug_read_log(filename: str):
    log_file = LOG_DIR / filename
    if not log_file.is_file() or ".." in filename:
        return JSONResponse({"error": "Not found"}, status_code=404)
    content = log_file.read_text(encoding="utf-8")
    return {"name": filename, "content": content}


@app.get("/api/debug/conversations")
def debug_all_conversations():
    convs = db.get_conversations()
    result = []
    for c in convs:
        msgs = db.get_messages(c["id"])
        result.append({**c, "messages": msgs, "message_count": len(msgs)})
    return result

# ---------- Image upload endpoint ----------

@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        return JSONResponse(
            {"error": f"Unsupported image type: {file.content_type}"},
            status_code=400,
        )

    ext = file.content_type.split("/")[-1].replace("jpeg", "jpg")
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.{ext}"
    save_path = IMAGE_DIR / filename

    content = await file.read()
    save_path.write_bytes(content)

    return {"path": str(save_path), "filename": filename}


@app.get("/api/images/{filename}")
def serve_image(filename: str):
    file_path = IMAGE_DIR / filename
    if not file_path.is_file() or ".." in filename:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return FileResponse(str(file_path))

# ---------- Chat SSE endpoint ----------

@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    message = body.get("message")
    conv_id = body.get("conversationId")
    image_filenames = body.get("imageFilenames") or []
    image_paths = body.get("imagePaths") or []

    if not message:
        return JSONResponse({"error": "message is required"}, status_code=400)

    is_new = not conv_id
    if is_new:
        conv_id = str(uuid.uuid4())
        preview = message[:30] + "..." if len(message) > 30 else message
        db.create_conversation(conv_id, preview)

    cli_session_id = None if is_new else db.get_cli_session_id(conv_id)

    db.add_message(conv_id, "user", message, images=image_filenames or None)

    prompt = message
    if image_paths:
        paths_text = "\n".join(f"  {i+1}. {p}" for i, p in enumerate(image_paths))
        prompt = (
            f"I have attached {len(image_paths)} image(s). Their file paths are:\n"
            f"{paths_text}\n"
            f"Please read each image using the Read tool first, then respond to my request.\n\n"
            f"{message}"
        )

    async def event_stream():
        yield _sse({"type": "conversation", "id": conv_id})

        accumulated = ""
        try:
            async for event in run_agent(prompt, cli_session_id=cli_session_id):
                if await request.is_disconnected():
                    break

                etype = event.get("type")

                if etype == "text":
                    accumulated += event.get("content", "")
                    yield _sse({"type": "text", "content": event.get("content", "")})

                elif etype == "tool":
                    yield _sse({"type": "tool", "name": event.get("name"), "status": event.get("status")})

                elif etype == "init":
                    yield _sse({"type": "init", "model": event.get("model", "")})

                elif etype == "session":
                    db.set_cli_session_id(conv_id, event["session_id"])

                elif etype == "done":
                    if accumulated:
                        db.add_message(conv_id, "assistant", accumulated)
                    yield _sse({"type": "done"})
                    return

                elif etype == "error":
                    yield _sse({"type": "error", "message": event.get("message", "")})
                    return

        except asyncio.CancelledError:
            pass

        if accumulated:
            db.add_message(conv_id, "assistant", accumulated)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Conversation-Id": conv_id,
        },
    )


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"

# ---------- SPA static files + fallback ----------

if DIST_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="spa")

    @app.exception_handler(StarletteHTTPException)
    async def spa_fallback(request: Request, exc: StarletteHTTPException):
        if exc.status_code == 404 and not request.url.path.startswith("/api/"):
            index = DIST_DIR / "index.html"
            if index.is_file():
                return FileResponse(str(index))
        return JSONResponse({"error": exc.detail}, status_code=exc.status_code)
