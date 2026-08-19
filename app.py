from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import sys

# اضافه کردن پوشه backend به مسیر
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# ========== FastAPI App ==========
app = FastAPI()

# ========== ایمپورت کردن مسیرهای بک‌اند ==========
try:
    from backend.main import app as fastapi_app
    # کپی کردن مسیرهای FastAPI اصلی
    for route in fastapi_app.routes:
        app.routes.append(route)
    print("✅ Backend routes loaded")
except Exception as e:
    print(f"❌ Error loading backend: {e}")

# ========== سرو فایل‌های استاتیک (فرانت‌اند) ==========
# سرو کردن فایل‌های استاتیک از ریشه پروژه
app.mount("/static", StaticFiles(directory="."), name="static")

@app.get("/")
async def index():
    return FileResponse("index.html")

@app.get("/{path:path}")
async def serve_static(path: str):
    # اگر فایل وجود داشت، برگردون
    file_path = path
    if os.path.exists(file_path):
        return FileResponse(file_path)
    # وگرنه 404
    return {"error": "File not found"}, 404

# ========== اجرا ==========
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
