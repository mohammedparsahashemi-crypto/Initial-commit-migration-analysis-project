from flask import Flask, send_from_directory, jsonify 
import os 
import sys 
import json 
 
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend')) 
 
app = Flask(__name__, static_folder='.', static_url_path='') 
 
@app.route('/') 
def index(): 
    return send_from_directory('.', 'index.html') 
 
@app.route('/<path:path
def static_files(path): 
    return send_from_directory('.', path) 
 
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
 
if __name__ == '__main__': 
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 10000))) 
