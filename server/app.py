import asyncio
import json
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from server import db
from server.cli import run_agent

DIST_DIR = Path(__file__).resolve().parent.parent / "dist"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# ---------- Chat SSE endpoint ----------

@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    message = body.get("message")
    conv_id = body.get("conversationId")

    if not message:
        return JSONResponse({"error": "message is required"}, status_code=400)

    if not conv_id:
        conv_id = str(uuid.uuid4())
        preview = message[:30] + "..." if len(message) > 30 else message
        db.create_conversation(conv_id, preview)

    db.add_message(conv_id, "user", message)

    async def event_stream():
        yield _sse({"type": "conversation", "id": conv_id})

        accumulated = ""
        try:
            async for event in run_agent(message):
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
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        file = DIST_DIR / full_path
        if file.is_file():
            return FileResponse(str(file))
        return FileResponse(str(DIST_DIR / "index.html"))
