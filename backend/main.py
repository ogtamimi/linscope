#!/usr/bin/env python3
"""
linscope Backend - v1.0.0 (SQLite, batching, alerts feedback)
"""

import sqlite3
import json
import time
import asyncio
from datetime import datetime
from typing import List, Optional, Dict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, APIRouter
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os

# Initialize FastAPI
app = FastAPI(title="linscope", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------- SQLite Setup -------------------
DB_PATH = os.path.join(os.path.dirname(__file__), "linscope.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            timestamp REAL,
            datetime TEXT,
            pid INTEGER,
            ppid INTEGER,
            process TEXT,
            event TEXT,
            target TEXT,
            filename TEXT,
            source TEXT,
            hash TEXT,
            prev_hash TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS alerts_feedback (
            alert_id TEXT PRIMARY KEY,
            user_score INTEGER,
            feedback_type TEXT,
            created_at REAL
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def store_event(event: dict, prev_hash: str = None):
    """Store event in SQLite with hash chain"""
    import hashlib
    event_str = json.dumps(event, sort_keys=True)
    event_hash = hashlib.sha256(event_str.encode()).hexdigest()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        INSERT OR REPLACE INTO events 
        (id, timestamp, datetime, pid, ppid, process, event, target, filename, source, hash, prev_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        event.get("id"),
        event.get("timestamp"),
        event.get("datetime"),
        event.get("pid"),
        event.get("ppid"),
        event.get("process"),
        event.get("event"),
        event.get("target"),
        event.get("filename"),
        event.get("source"),
        event_hash,
        prev_hash
    ))
    conn.commit()
    conn.close()
    return event_hash

def get_events_from_db(limit=100, offset=0, event_type=None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    query = "SELECT id, timestamp, datetime, pid, ppid, process, event, target, filename, source FROM events"
    params = []
    if event_type:
        query += " WHERE event = ?"
        params.append(event_type)
    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    c.execute(query, params)
    rows = c.fetchall()
    conn.close()
    return [{
        "id": r[0], "timestamp": r[1], "datetime": r[2], "pid": r[3],
        "ppid": r[4], "process": r[5], "event": r[6], "target": r[7],
        "filename": r[8], "source": r[9]
    } for r in rows]

# ------------------- Internal Event Filter -------------------
INTERNAL_PROCESS_NAMES = {
    "python3", "python", "uvicorn", "gunicorn",
    "collector", "mock_collector", "bpftrace",
    "node", "vite", "npm", "npx",
    "ollama"  # Filter out Ollama AI service processes
}
INTERNAL_PATHS = ["/linscope", "collector/main.py", "uvicorn backend.main:app"]

def is_internal_event(event: dict) -> bool:
    proc = event.get("process", "").lower()
    cmd = (event.get("filename") or event.get("target") or "").lower()
    if proc in INTERNAL_PROCESS_NAMES:
        return True
    if any(p in cmd for p in INTERNAL_PATHS):
        return True
    return False

# ------------------- Event Batching (WebSocket) -------------------
event_batch = []
BATCH_INTERVAL = 0.2   # 200ms
MAX_BATCH_SIZE = 100
connected_clients: List[WebSocket] = []
alert_clients: List[WebSocket] = []
last_event_hash = None

# ------------------- Models -------------------
class EventBatch(BaseModel):
    events: List[dict]

class AlertFeedback(BaseModel):
    alert_id: str
    user_score: int   # 0-100
    feedback_type: str   # "useful", "not_useful"

class ChatRequest(BaseModel):
    message: str
    context_events: Optional[List[dict]] = None
    session_id: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    ollama_base_url: Optional[str] = None

class AnalyzeIncidentRequest(BaseModel):
    events: List[dict]
    provider: Optional[str] = None
    model: Optional[str] = None
    ollama_base_url: Optional[str] = None

# ------------------- Endpoints -------------------
@app.get("/")
async def root():
    return {"status": "linscope backend v1.0.0", "db": DB_PATH}

@app.post("/api/events/batch")
async def receive_batch(batch: EventBatch):
    global last_event_hash
    received = 0
    for ev in batch.events:
        if is_internal_event(ev):
            continue
        # Normalize
        ev["id"] = f"{ev.get('pid',0)}-{int(time.time()*1000)}"
        ev["datetime"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ev["timestamp"] = ev.get("timestamp", time.time())
        # Store with hash chain
        last_event_hash = store_event(ev, last_event_hash)
        # Add to broadcast batch
        event_batch.append(ev)
        received += 1
    return {"received": received}

@app.get("/api/events")
async def get_events_endpoint(limit: int = 100, offset: int = 0, event_type: Optional[str] = None):
    events = get_events_from_db(limit, offset, event_type)
    return {"events": events, "total": len(events), "offset": offset}

@app.post("/api/alerts/feedback")
async def alert_feedback(fb: AlertFeedback):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        INSERT INTO alerts_feedback (alert_id, user_score, feedback_type, created_at)
        VALUES (?, ?, ?, ?)
    ''', (fb.alert_id, fb.user_score, fb.feedback_type, time.time()))
    conn.commit()
    conn.close()
    return {"status": "ok", "alert_id": fb.alert_id}

@app.get("/api/alerts")
async def get_alerts(limit: int = 50):
    # Placeholder – in real implementation, alerts come from detection engine
    return {"alerts": [], "total": 0}

@app.post("/api/ai/chat")
async def ai_chat(req: ChatRequest):
    """
    AI chat endpoint - supports Ollama, Groq, or fallback responses
    To enable real AI, configure:
    - OLLAMA_URL environment variable (local LLM)
    - GROQ_API_KEY environment variable (cloud API)
    - GEMINI_API_KEY environment variable (Google Gemini)
    """
    try:
        from ai_service import ai_service
        context = req.context_events or []
        provider = req.provider
        model = req.model
        ollama_base_url = req.ollama_base_url
        response = ""
        async for chunk in ai_service.generate(
            req.message,
            context=context,
            provider=provider,
            model=model,
            ollama_base_url=ollama_base_url
        ):
            response += chunk
        return {"response": response, "provider": "configured"}
    except Exception as e:
        # Fallback response when AI service is not available
        fallback = f"Backend AI service not configured. Error: {str(e)}\n\nTo enable AI analysis:\n1. Install Ollama or configure Groq/Gemini API\n2. Set appropriate environment variables in backend\n3. Restart the backend service"
        return {"response": fallback, "provider": "fallback"}

@app.post("/api/ai/analyze-incident")
async def analyze_incident(request: AnalyzeIncidentRequest):
    """Analyze a set of events for security incidents"""
    try:
        from ai_service import ai_service
        analysis = await ai_service.analyze_incident(
            request.events, 
            provider=request.provider,
            model=request.model,
            ollama_base_url=request.ollama_base_url
        )
        return {"analysis": analysis}
    except Exception as e:
        return {"analysis": f"Incident analysis unavailable: {str(e)}", "provider": "fallback"}

# ------------------- VirusTotal Integration -------------------
# Import VirusTotal router
from virustotal import router as vt_router
app.include_router(vt_router)

# ------------------- WebSocket (with batching) -------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        # Send last 100 events as history
        history = get_events_from_db(limit=100)
        # Filter out internal events and ensure JSON serializable
        filtered_history = [
            {k: v for k, v in evt.items() if not callable(v) and not hasattr(v, '__await__')}
            for evt in history
            if not is_internal_event(evt)
        ]
        await websocket.send_text(json.dumps({"type": "history", "events": filtered_history}))
        while True:
            await websocket.receive_text()  # keep connection alive
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        except:
            pass
        if websocket in connected_clients:
            connected_clients.remove(websocket)

@app.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket):
    await websocket.accept()
    alert_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        alert_clients.remove(websocket)

async def batch_broadcaster():
    while True:
        await asyncio.sleep(BATCH_INTERVAL)
        if event_batch:
            message = json.dumps({
                "type": "batch",
                "events": event_batch[:],
                "timestamp": int(time.time() * 1000),
                "rate": len(event_batch) / BATCH_INTERVAL
            })
            for client in connected_clients[:]:
                try:
                    await client.send_text(message)
                except:
                    if client in connected_clients:
                        connected_clients.remove(client)
            event_batch.clear()

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(batch_broadcaster())
