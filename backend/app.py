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
            origin TEXT,
            main_photo TEXT,
            created_at TEXT,
            subcategory TEXT
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
        "origin": row[4],
        "mainPhoto": row[5],
        "createdAt": row[6],
        "subcategory": row[7]
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


@app.route('/', methods=['POST'])
@token_required
def add_item():
    # Get form fields
    item_id = request.form.get('id')
    item_name = request.form.get('itemName')
    description = request.form.get('description')
    category = request.form.get('category')
    origin = request.form.get('origin')
    created_at = request.form.get('createdAt')
    if not created_at:
        created_at = datetime.utcnow().isoformat()
    subcategory = request.form.get('subcategory')
    
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
        'INSERT INTO item (id, item_name, description, category, origin, main_photo, created_at, subcategory) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [item_id, item_name, description, category, origin, photo_url, created_at, subcategory]
    )
    
    # Return the created item
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory FROM item WHERE id=?', [item_id])    
    row = result.rows[0]
    return jsonify(row_to_dict(row)), 201



@app.route('/item/<item_id>', methods=['PUT'])
@token_required
def update_item(item_id):
    data = request.json
    conn = get_db()
    conn.execute('''
        UPDATE item SET item_name=?, description=?, category=?, origin=?, subcategory=?
        WHERE id=?
    ''', [data.get('itemName'), data.get('description'), data.get('category'),
           data.get('origin'), data.get('subcategory'), item_id])
    
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory FROM item WHERE id=?', [item_id])    
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
    
@app.route('/migrate-add-subcategory', methods=['POST'])
@token_required
def migrate_add_subcategory():
    conn = get_db()
    try:
        conn.execute('ALTER TABLE item ADD COLUMN subcategory TEXT')
        return jsonify({"message": "Subcategory column added successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/migrate-remove-new-purchase', methods=['POST'])
@token_required
def migrate_remove_new_purchase():
    conn = get_db()
    try:
        # SQLite way: create new table, copy data, drop old, rename
        conn.execute('''
            CREATE TABLE IF NOT EXISTS item_new (
                id TEXT PRIMARY KEY,
                item_name TEXT,
                description TEXT,
                category TEXT,
                origin TEXT,
                main_photo TEXT,
                created_at TEXT,
                subcategory TEXT
            )
        ''')
        conn.execute('''
            INSERT INTO item_new (id, item_name, description, category, origin, main_photo, created_at, subcategory)
            SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory
            FROM item
        ''')
        conn.execute('DROP TABLE item')
        conn.execute('ALTER TABLE item_new RENAME TO item')
        return jsonify({"message": "is_new_purchase column removed successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/', methods=['GET'])
def list_return():
    conn = get_db()
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory FROM item')
    items = [row_to_dict(row) for row in result.rows]
    return jsonify(items)

@app.route('/', methods=['GET'])
def list_return():
    conn = get_db()
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory FROM item')
    print(result.rows[0])  # Add this line
    items = [row_to_dict(row) for row in result.rows]
    return jsonify(items)

@app.route('/migrate-add-community-items', methods=['POST'])
@token_required
def migrate_add_community_items():
    conn = get_db()
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS community_item (
                id TEXT PRIMARY KEY,
                item_name TEXT,
                description TEXT,
                category TEXT,
                origin TEXT,
                main_photo TEXT,
                created_at TEXT,
                subcategory TEXT,
                submitted_by TEXT,
                approved INTEGER DEFAULT 0
            )
        ''')
        return jsonify({"message": "community_item table created successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
if __name__ == '__main__':
    app.run(debug=True, port=5000)
