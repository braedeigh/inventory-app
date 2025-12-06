from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader
from libsql_client import create_client_sync
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

def get_db():
    return create_client_sync(
        url=os.getenv('TURSO_DATABASE_URL'),
        auth_token=os.getenv('TURSO_AUTH_TOKEN')
    )

# Cloudinary config
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET')
)

def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS item (
            id TEXT PRIMARY KEY,
            item_name TEXT,
            description TEXT,
            category TEXT,
            is_new_purchase INTEGER,
            origin TEXT,
            main_photo TEXT
        )
    ''')

with app.app_context():
    init_db()

def row_to_dict(row):
    return {
        "id": row[0],
        "itemName": row[1],
        "description": row[2],
        "category": row[3],
        "isNewPurchase": bool(row[4]),
        "origin": row[5],
        "mainPhoto": row[6]
    }

@app.route('/', methods=['GET'])
def list_return():
    conn = get_db()
    result = conn.execute('SELECT * FROM item')
    items = [row_to_dict(row) for row in result.rows]
    return jsonify(items)

@app.route('/', methods=['POST'])
def add_item():
    data = request.json
    conn = get_db()
    conn.execute(
        'INSERT INTO item (id, item_name, description, category, is_new_purchase, origin) VALUES (?, ?, ?, ?, ?, ?)',
        [data.get('id'), data.get('itemName'), data.get('description'), 
         data.get('category'), data.get('isNewPurchase'), data.get('origin')]
    )
    return jsonify(data), 201

@app.route('/item/<item_id>', methods=['PUT'])
def update_item(item_id):
    data = request.json
    conn = get_db()
    conn.execute('''
        UPDATE item SET item_name=?, description=?, category=?, is_new_purchase=?, origin=?
        WHERE id=?
    ''', [data.get('itemName'), data.get('description'), data.get('category'),
          data.get('isNewPurchase'), data.get('origin'), item_id])
    
    result = conn.execute('SELECT * FROM item WHERE id=?', [item_id])
    rows = result.rows
    if not rows:
        return jsonify({"error": "Item not found"}), 404
    return jsonify(row_to_dict(rows[0]))

@app.route('/item/<item_id>', methods=['DELETE'])
def delete_item(item_id):
    conn = get_db()
    conn.execute('DELETE FROM item WHERE id=?', [item_id])
    return jsonify({"message": "Item deleted"})

@app.route('/item/<item_id>/photo', methods=['POST'])
def upload_photo(item_id):
    conn = get_db()
    
    if 'photo' not in request.files:
        return jsonify({"error": "No photo provided"}), 400
    
    file = request.files['photo']
    result = cloudinary.uploader.upload(file)
    
    conn.execute('UPDATE item SET main_photo=? WHERE id=?', [result['secure_url'], item_id])
    
    return jsonify({"url": result['secure_url']})

@app.route('/debug-env', methods=['GET'])
def debug_env():
    return jsonify({
        "cloud_name": os.getenv('CLOUDINARY_CLOUD_NAME'),
        "api_key": os.getenv('CLOUDINARY_API_KEY'),
        "secret_length": len(os.getenv('CLOUDINARY_API_SECRET', '')),
        "secret_first_3": os.getenv('CLOUDINARY_API_SECRET', '')[:3]
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
