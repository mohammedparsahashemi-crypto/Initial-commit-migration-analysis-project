from flask import Flask, send_from_directory
import os
import sys

# اضافه کردن پوشه backend به مسیر پایتون
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# ساخت اپلیکیشن Flask
app = Flask(__name__, static_folder='.', static_url_path='')

# سرو فایل‌های استاتیک (HTML, CSS, JS)
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

# ایمپورت کردن FastAPI از backend
try:
    from backend.main import app as fastapi_app
    from fastapi.middleware.wsgi import WSGIMiddleware
    app.wsgi_app = WSGIMiddleware(fastapi_app)
    print("✅ FastAPI mounted on /api")
except Exception as e:
    print(f"❌ Error: {e}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 10000)))
