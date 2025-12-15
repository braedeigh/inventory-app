from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader
from libsql_client import create_client_sync
import os
import jwt
from datetime import datetime, timedelta
from functools import wraps
from datetime import datetime

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
        "mainPhoto": row[6],
        "createdAt": row[7]
    }

# Auth helper
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({"error": "Token missing"}), 401
        try:
            token = token.replace('Bearer ', '')
            jwt.decode(token, os.getenv('JWT_SECRET', 'dev-secret'), algorithms=['HS256'])
        except:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if username == os.getenv('ADMIN_USERNAME') and password == os.getenv('ADMIN_PASSWORD'):
        token = jwt.encode({
            'user': username,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, os.getenv('JWT_SECRET', 'dev-secret'), algorithm='HS256')
        return jsonify({"token": token})
    
    return jsonify({"error": "Invalid credentials"}), 401


@app.route('/', methods=['GET'])
def list_return():
    conn = get_db()
    result = conn.execute('SELECT * FROM item')
    items = [row_to_dict(row) for row in result.rows]
    return jsonify(items)

@app.route('/', methods=['POST'])
@token_required
def add_item():
    # Get form fields
    item_id = request.form.get('id')
    item_name = request.form.get('itemName')
    description = request.form.get('description')
    category = request.form.get('category')
    is_new_purchase = request.form.get('isNewPurchase') == 'true'  # Convert string to bool
    origin = request.form.get('origin')
    created_at = datetime.utcnow().isoformat()
    
    photo_url = None
    
    # Handle photo if present
    if 'photo' in request.files:
        file = request.files['photo']
        if file.filename != '':
            result = cloudinary.uploader.upload(file)
            photo_url = result['secure_url']

    if photo_url is None:
        existing_url = request.form.get('mainPhoto')
        if existing_url:
            photo_url = existing_url
    
    # Save to database
    conn = get_db()
    conn.execute(
        'INSERT INTO item (id, item_name, description, category, is_new_purchase, origin, main_photo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [item_id, item_name, description, category, is_new_purchase, origin, photo_url, created_at]
    )
    
    # Return the created item
    result = conn.execute('SELECT * FROM item WHERE id=?', [item_id])
    row = result.rows[0]
    return jsonify(row_to_dict(row)), 201



@app.route('/item/<item_id>', methods=['PUT'])
@token_required
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
@token_required
def delete_item(item_id):
    conn = get_db()
    conn.execute('DELETE FROM item WHERE id=?', [item_id])
    return jsonify({"message": "Item deleted"})

@app.route('/item/<item_id>/photo', methods=['POST'])
@token_required
def upload_photo(item_id):
    conn = get_db()
    
    if 'photo' not in request.files:
        return jsonify({"error": "No photo provided"}), 400
    
    file = request.files['photo']
    result = cloudinary.uploader.upload(file)
    
    conn.execute('UPDATE item SET main_photo=? WHERE id=?', [result['secure_url'], item_id])
    
    return jsonify({"url": result['secure_url']})

@app.route('/debug-env', methods=['GET'])
@token_required
def debug_env():
    return jsonify({
        "cloud_name": os.getenv('CLOUDINARY_CLOUD_NAME'),
        "api_key": os.getenv('CLOUDINARY_API_KEY'),
        "secret_length": len(os.getenv('CLOUDINARY_API_SECRET', '')),
        "secret_first_3": os.getenv('CLOUDINARY_API_SECRET', '')[:3]
    })

@app.route('/migrate-add-timestamp', methods=['POST'])
@token_required
def migrate_add_timestamp():
    conn = get_db()
    try:
        conn.execute('ALTER TABLE item ADD COLUMN created_at TEXT')
        return jsonify({"message": "Column added successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
