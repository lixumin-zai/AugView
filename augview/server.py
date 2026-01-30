"""
FastAPI server for AugView - serves the web UI and handles API requests.
"""

import asyncio
import json
import os
import webbrowser
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
import uvicorn
import numpy as np
from enum import Enum

from .core import get_current_viewer, AugView


class SafeJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles numpy types and enums."""
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, (np.bool_, np.bool8)):
            return bool(obj)
        elif isinstance(obj, (np.integer, np.int64, np.int32)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float64, np.float32)):
            return float(obj)
        elif isinstance(obj, Enum):
            return obj.name
        elif hasattr(obj, '__dict__'):
            return str(obj)
        try:
            return str(obj)
        except:
            return None


def safe_json_dumps(data):
    """Safely dump data to JSON using custom encoder."""
    return json.dumps(data, cls=SafeJSONEncoder)

# Store connected WebSocket clients
connected_clients: Set[WebSocket] = set()

# Reference to the current viewer
_server_viewer: Optional[AugView] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    yield


app = FastAPI(
    title="AugView",
    description="Image Augmentation Pipeline Visualizer",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def broadcast_update(pipeline_data: Dict):
    """Broadcast pipeline update to all connected clients."""
    if not connected_clients:
        return
    
    message = safe_json_dumps({
        "type": "pipeline_update",
        "data": pipeline_data
    })
    
    disconnected = set()
    for client in connected_clients:
        try:
            await client.send_text(message)
        except Exception:
            disconnected.add(client)
    
    # Clean up disconnected clients
    connected_clients.difference_update(disconnected)


def on_pipeline_update(pipeline):
    """Callback when pipeline is updated."""
    asyncio.create_task(broadcast_update(pipeline.to_dict()))


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await websocket.accept()
    connected_clients.add(websocket)
    
    try:
        # Send initial pipeline state
        viewer = _server_viewer or get_current_viewer()
        if viewer:
            await websocket.send_text(safe_json_dumps({
                "type": "pipeline_update",
                "data": viewer.pipeline.to_dict()
            }))
        
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "update_param":
                viewer = _server_viewer or get_current_viewer()
                if viewer:
                    viewer.update_step_param(
                        message["step_id"],
                        message["param_name"],
                        message["value"]
                    )
            elif message.get("type") == "toggle_step":
                viewer = _server_viewer or get_current_viewer()
                if viewer:
                    viewer.toggle_step(
                        message["step_id"],
                        message["enabled"]
                    )
            elif message.get("type") == "rerun":
                viewer = _server_viewer or get_current_viewer()
                if viewer and viewer.pipeline.original_image:
                    image = viewer.base64_to_image(viewer.pipeline.original_image)
                    viewer.process_image(image)
                    
    except WebSocketDisconnect:
        connected_clients.discard(websocket)


@app.get("/api/pipeline")
async def get_pipeline():
    """Get the current pipeline structure."""
    viewer = _server_viewer or get_current_viewer()
    if not viewer:
        return JSONResponse(
            status_code=404,
            content={"error": "No pipeline registered"}
        )
    return viewer.pipeline.to_dict()


@app.get("/api/step/{step_id}")
async def get_step(step_id: str):
    """Get details for a specific step."""
    viewer = _server_viewer or get_current_viewer()
    if not viewer:
        raise HTTPException(status_code=404, detail="No pipeline registered")
    
    for step in viewer.pipeline.steps:
        if step.id == step_id:
            return step.to_dict()
    
    raise HTTPException(status_code=404, detail="Step not found")


@app.put("/api/step/{step_id}/params")
async def update_step_params(step_id: str, params: Dict[str, Any]):
    """Update parameters for a specific step."""
    viewer = _server_viewer or get_current_viewer()
    if not viewer:
        raise HTTPException(status_code=404, detail="No pipeline registered")
    
    for param_name, value in params.items():
        success = viewer.update_step_param(step_id, param_name, value)
        if not success:
            raise HTTPException(status_code=400, detail=f"Failed to update {param_name}")
    
    return {"status": "ok"}


@app.put("/api/step/{step_id}/toggle")
async def toggle_step(step_id: str, enabled: bool):
    """Enable or disable a specific step."""
    viewer = _server_viewer or get_current_viewer()
    if not viewer:
        raise HTTPException(status_code=404, detail="No pipeline registered")
    
    success = viewer.toggle_step(step_id, enabled)
    if not success:
        raise HTTPException(status_code=404, detail="Step not found")
    
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image to process through the pipeline."""
    viewer = _server_viewer or get_current_viewer()
    if not viewer:
        raise HTTPException(status_code=404, detail="No pipeline registered")
    
    try:
        from PIL import Image
        import numpy as np
        import io
        
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_array = np.array(image)
        
        # Process through pipeline
        viewer.process_image(image_array)
        
        return {"status": "ok", "pipeline": viewer.pipeline.to_dict()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/rerun")
async def rerun_pipeline():
    """Re-run the pipeline with the current image."""
    viewer = _server_viewer or get_current_viewer()
    if not viewer:
        raise HTTPException(status_code=404, detail="No pipeline registered")
    
    if not viewer.pipeline.original_image:
        raise HTTPException(status_code=400, detail="No image loaded")
    
    try:
        image = viewer.base64_to_image(viewer.pipeline.original_image)
        viewer.process_image(image)
        return {"status": "ok", "pipeline": viewer.pipeline.to_dict()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Serve frontend static files
frontend_path = Path(__file__).parent / "frontend" / "dist"


@app.get("/")
async def serve_frontend():
    """Serve the frontend application."""
    index_path = frontend_path / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    else:
        # Return a simple placeholder if frontend not built
        return HTMLResponse("""
        <!DOCTYPE html>
        <html>
        <head>
            <title>AugView</title>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; 
                       align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: white; }
                .container { text-align: center; }
                h1 { color: #0ea5e9; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>AugView</h1>
                <p>Frontend not built. Run <code>npm run build</code> in the frontend directory.</p>
            </div>
        </body>
        </html>
        """)


# Mount static files if they exist
if frontend_path.exists():
    app.mount("/assets", StaticFiles(directory=frontend_path / "assets"), name="assets")


def start_server(
    viewer: Optional[AugView] = None,
    host: str = "127.0.0.1",
    port: int = 8080,
    open_browser: bool = True,
    reload: bool = False
):
    """
    Start the AugView visualization server.
    
    Args:
        viewer: Optional AugView instance. If not provided, uses the global instance.
        host: Host to bind to (default: 127.0.0.1)
        port: Port to bind to (default: 8080)
        open_browser: Whether to open browser automatically (default: True)
        reload: Enable hot reload for development (default: False)
    """
    global _server_viewer
    _server_viewer = viewer or get_current_viewer()
    
    if _server_viewer:
        _server_viewer.register_callback(lambda p: asyncio.create_task(broadcast_update(p.to_dict())))
    
    if open_browser:
        import threading
        def open_browser_delayed():
            import time
            time.sleep(1)
            webbrowser.open(f"http://{host}:{port}")
        
        threading.Thread(target=open_browser_delayed, daemon=True).start()
    
    print(f"\n🎨 AugView server starting at http://{host}:{port}\n")
    
    uvicorn.run(
        "augview.server:app" if reload else app,
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )
