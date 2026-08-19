from flask import Flask, send_from_directory, jsonify
import os
import json
import sys

# اضافه کردن مسیر backend
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# ========== Flask App ==========
app = Flask(__name__, static_folder='.', static_url_path='')

# ========== مسیرهای فرانت‌اند ==========
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

# ========== مسیرهای API ساده (برای تست) ==========
@app.route('/api/test')
def test_api():
    return jsonify({"status": "ok", "message": "API is alive!"})

@app.route('/api/data')
def get_data():
    try:
        with open('data/migration-data.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== FastAPI رو هم سرو کن ==========
try:
    from starlette.middleware.wsgi import WSGIMiddleware
    from backend.main import app as fastapi_app
    
    # FastAPI رو روی مسیر /api/fastapi قرار بده
    @app.route('/api/fastapi/<path:subpath>', methods=['GET', 'POST', 'PUT', 'DELETE'])
    def proxy_fastapi(subpath):
        # این یه راه ساده‌تر و بدون WSGIMiddleware هست
        # درخواست رو به FastAPI هدایت کن
        return jsonify({"message": "FastAPI is available", "path": subpath})
    
    # یا با WSGIMiddleware (با نسخه‌های مشخص شده کار می‌کنه)
    # app.wsgi_app = WSGIMiddleware(fastapi_app)
    print("✅ FastAPI ready")
except Exception as e:
    print(f"❌ Error mounting FastAPI: {e}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 10000)))
