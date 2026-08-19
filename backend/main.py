from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from backend.api.routes import router
import os

app = FastAPI(title="آرانش - سامانه پایش مهاجرت")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")

# ========== سرو کردن فرانت‌اند ==========
@app.get("/")
async def index():
    return FileResponse("index.html")

@app.get("/{path:path}")
async def serve_static(path: str):
    if os.path.exists(path):
        return FileResponse(path)
    return {"error": "File not found"}, 404

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
