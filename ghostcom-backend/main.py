from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from crypto_utils import generate_secret_code
from rooms import room_manager
import asyncio

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Set to frontend origin in production!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Track live connections per room ---
live_connections = {}  # { room_code: set([WebSocket, ...]) }

# --- HTTP API endpoints required by frontend ---
@app.post("/api/generate_code")
async def api_generate_code(user_word: str = Form(None)):
    # Use your real code generation logic here!
    code = generate_secret_code(room_manager.get_codes(), user_word=user_word)
    return {"code": code}

@app.post("/api/create_room")
async def api_create_room(code: str = Form(...), expires_min: int = Form(...), owner: str = Form(...)):
    expires = max(60, min(expires_min * 60, 12*60*60))  # 1 min to 12 hr
    ok = room_manager.create_room(code, expires, owner)
    if not ok:
        raise HTTPException(400, "Room code already exists")
    return {"room": code, "expires_sec": expires}

@app.post("/api/join_room")
async def api_join_room(code: str = Form(...), user: str = Form(...)):
    ok = room_manager.join_room(code, user)
    if not ok:
        raise HTTPException(404, "Room not found or terminated")
    return {"room": code}

@app.websocket("/ws/{room_code}/{user}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, user: str):
    await websocket.accept()
    # Register this connection
    if room_code not in live_connections:
        live_connections[room_code] = set()
    live_connections[room_code].add(websocket)
    try:
        if not room_manager.join_room(room_code, user):
            await websocket.send_json({"system": True, "msg": "Room does not exist or is closed."})
            await websocket.close()
            return
        while True:
            data = await websocket.receive_json()
            msg = {
                "user": user,
                "msg": data.get("msg"),
                "ts": data.get("ts"),
                "system": False,
            }
            room_manager.add_message(room_code, msg)
            # Broadcast to all connections in the room
            for conn in list(live_connections[room_code]):
                try:
                    await conn.send_json(msg)
                except Exception:
                    live_connections[room_code].remove(conn)
    except WebSocketDisconnect:
        room_manager.leave_room(room_code, user)
        live_connections[room_code].remove(websocket)
    finally:
        # Clean up
        if websocket in live_connections.get(room_code, set()):
            live_connections[room_code].remove(websocket)
        room_manager.cleanup()