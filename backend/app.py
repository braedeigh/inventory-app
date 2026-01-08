from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader
from libsql_client import create_client_sync
import os
import jwt
import uuid
from datetime import datetime, timedelta
from functools import wraps

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization"]}})

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
            subcategory TEXT,
            secondhand TEXT
        )
    ''')

with app.app_context():
    init_db()

def row_to_dict(row):
    import json
    materials_raw = row[12] if len(row) > 12 else None
    materials = None
    if materials_raw:
        try:
            materials = json.loads(materials_raw)
        except:
            materials = None
    return {
        "id": row[0],
        "itemName": row[1],
        "description": row[2],
        "category": row[3],
        "origin": row[4],
        "mainPhoto": row[5],
        "createdAt": row[6],
        "subcategory": row[7],
        "secondhand": row[8],
        "lastEdited": row[9] if len(row) > 9 else None,
        "gifted": row[10] if len(row) > 10 else None,
        "private": row[11] if len(row) > 11 else None,
        "materials": materials,
        "privatePhotos": row[13] if len(row) > 13 else None,
        "privateDescription": row[14] if len(row) > 14 else None,
        "privateOrigin": row[15] if len(row) > 15 else None
    }

def get_item_photos(conn, item_id):
    """Get all photos for an item, ordered by position"""
    result = conn.execute(
        'SELECT id, url, position, created_at FROM item_photos WHERE item_id = ? ORDER BY position ASC',
        [item_id]
    )
    return [{"id": row[0], "url": row[1], "position": row[2], "createdAt": row[3]} for row in result.rows]

def row_to_dict_with_photos(row, conn):
    """Convert row to dict and include photos array"""
    item = row_to_dict(row)
    item["photos"] = get_item_photos(conn, item["id"])
    return item

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

def admin_required(f):
    """Decorator for endpoints that require admin role"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({"error": "Token missing"}), 401
        try:
            token = token.replace('Bearer ', '')
            payload = jwt.decode(token, os.getenv('JWT_SECRET', 'dev-secret'), algorithms=['HS256'])
            if payload.get('role') != 'admin':
                return jsonify({"error": "Admin access required"}), 403
        except:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    # Check admin credentials
    if username == os.getenv('ADMIN_USERNAME') and password == os.getenv('ADMIN_PASSWORD'):
        token = jwt.encode({
            'user': username,
            'role': 'admin',
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, os.getenv('JWT_SECRET', 'dev-secret'), algorithm='HS256')
        return jsonify({"token": token, "role": "admin"})

    # Check friend credentials
    if username == os.getenv('FRIEND_USERNAME') and password == os.getenv('FRIEND_PASSWORD'):
        token = jwt.encode({
            'user': username,
            'role': 'friend',
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, os.getenv('JWT_SECRET', 'dev-secret'), algorithm='HS256')
        return jsonify({"token": token, "role": "friend"})

    return jsonify({"error": "Invalid credentials"}), 401


@app.route('/', methods=['POST'])
@token_required
def add_item():
    import json as json_lib
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
    secondhand = request.form.get('secondhand')
    gifted = request.form.get('gifted')
    private = request.form.get('private')
    materials = request.form.get('materials')  # JSON string
    private_photos = request.form.get('privatePhotos')
    private_description = request.form.get('privateDescription')
    private_origin = request.form.get('privateOrigin')
    main_photo_index = int(request.form.get('mainPhotoIndex', 0))

    conn = get_db()

    # Handle multiple photos
    photos = request.files.getlist('photos')
    # Fallback to single photo for backwards compatibility
    if not photos or all(f.filename == '' for f in photos):
        single_photo = request.files.get('photo')
        if single_photo and single_photo.filename != '':
            photos = [single_photo]

    uploaded_photos = []
    main_photo_url = None

    for idx, file in enumerate(photos):
        if file and file.filename != '' and len(uploaded_photos) < 5:
            result = cloudinary.uploader.upload(file)
            photo_url = result['secure_url']

            # Determine position - main photo goes to position 0
            if idx == main_photo_index:
                position = 0
                main_photo_url = photo_url
            elif idx < main_photo_index:
                position = idx + 1
            else:
                position = idx

            uploaded_photos.append({
                "url": photo_url,
                "position": position
            })

    # Sort by position and reassign to ensure sequential positions
    uploaded_photos.sort(key=lambda x: x['position'])
    for i, photo in enumerate(uploaded_photos):
        photo['position'] = i

    # If no main photo was set, use the first one
    if not main_photo_url and uploaded_photos:
        main_photo_url = uploaded_photos[0]['url']

    # Fallback to existing URL if provided
    if main_photo_url is None:
        existing_url = request.form.get('mainPhoto')
        if existing_url:
            main_photo_url = existing_url

    # Save item to database
    conn.execute(
        'INSERT INTO item (id, item_name, description, category, origin, main_photo, created_at, subcategory, secondhand, gifted, private, materials, private_photos, private_description, private_origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [item_id, item_name, description, category, origin, main_photo_url, created_at, subcategory, secondhand, gifted, private, materials, private_photos, private_description, private_origin]
    )

    # Save photos to item_photos table
    for photo in uploaded_photos:
        photo_id = str(uuid.uuid4())
        conn.execute('''
            INSERT INTO item_photos (id, item_id, url, position, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', [photo_id, item_id, photo['url'], photo['position'], created_at])

    # Return the created item with photos
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory, secondhand, last_edited, gifted, private, materials, private_photos, private_description, private_origin FROM item WHERE id=?', [item_id])
    row = result.rows[0]
    item = row_to_dict(row)
    item['photos'] = get_item_photos(conn, item_id)
    return jsonify(item), 201



@app.route('/item/<item_id>', methods=['PUT'])
@admin_required
def update_item(item_id):
    import json as json_lib
    data = request.json
    conn = get_db()

    # Get current item to check if anything changed
    current = conn.execute('SELECT item_name, description, category, origin, subcategory, secondhand, gifted, private, last_edited, materials, private_photos, private_description, private_origin FROM item WHERE id=?', [item_id])
    current_row = current.rows[0] if current.rows else None

    if not current_row:
        return jsonify({"error": "Item not found"}), 404

    # Convert materials to JSON string for comparison and storage
    new_materials = data.get('materials')
    materials_json = json_lib.dumps(new_materials) if new_materials else None

    # Check if anything actually changed
    new_values = (
        data.get('itemName'),
        data.get('description'),
        data.get('category'),
        data.get('origin'),
        data.get('subcategory'),
        data.get('secondhand'),
        data.get('gifted'),
        data.get('private'),
        materials_json,
        data.get('privatePhotos'),
        data.get('privateDescription'),
        data.get('privateOrigin')
    )
    current_values = tuple(current_row[:8]) + (current_row[9], current_row[10], current_row[11], current_row[12])
    current_last_edited = current_row[8]

    # Only update last_edited if data actually changed
    if new_values != current_values:
        last_edited = datetime.utcnow().isoformat()
    else:
        last_edited = current_last_edited

    # Always run the UPDATE to ensure data is saved
    conn.execute('''
        UPDATE item SET item_name=?, description=?, category=?, origin=?, subcategory=?, secondhand=?, gifted=?, private=?, last_edited=?, materials=?, private_photos=?, private_description=?, private_origin=?
        WHERE id=?
    ''', [data.get('itemName'), data.get('description'), data.get('category'),
           data.get('origin'), data.get('subcategory'), data.get('secondhand'), data.get('gifted'), data.get('private'), last_edited, materials_json, data.get('privatePhotos'), data.get('privateDescription'), data.get('privateOrigin'), item_id])

    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory, secondhand, last_edited, gifted, private, materials, private_photos, private_description, private_origin FROM item WHERE id=?', [item_id])
    rows = result.rows
    if not rows:
        return jsonify({"error": "Item not found"}), 404
    return jsonify(row_to_dict(rows[0]))

@app.route('/item/<item_id>', methods=['DELETE'])
@admin_required
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

@app.route('/item/<item_id>/photos', methods=['POST'])
@token_required
def upload_photos(item_id):
    """Upload one or more photos for an item"""
    conn = get_db()

    if 'photos' not in request.files and 'photo' not in request.files:
        return jsonify({"error": "No photos provided"}), 400

    # Get current max position
    result = conn.execute('SELECT MAX(position) FROM item_photos WHERE item_id = ?', [item_id])
    max_pos = result.rows[0][0] if result.rows else None
    next_position = (max_pos + 1) if max_pos is not None else 0

    # Check current photo count
    count_result = conn.execute('SELECT COUNT(*) FROM item_photos WHERE item_id = ?', [item_id])
    current_count = count_result.rows[0][0] if count_result.rows else 0

    uploaded_photos = []
    files = request.files.getlist('photos') or [request.files.get('photo')]

    for file in files:
        if file and file.filename != '':
            # Check max 5 photos limit
            if current_count >= 5:
                break

            result = cloudinary.uploader.upload(file)
            photo_id = str(uuid.uuid4())
            created_at = datetime.utcnow().isoformat()

            conn.execute('''
                INSERT INTO item_photos (id, item_id, url, position, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', [photo_id, item_id, result['secure_url'], next_position, created_at])

            # Update main_photo if this is the first photo (position 0)
            if next_position == 0:
                conn.execute('UPDATE item SET main_photo=? WHERE id=?', [result['secure_url'], item_id])

            uploaded_photos.append({
                "id": photo_id,
                "url": result['secure_url'],
                "position": next_position,
                "createdAt": created_at
            })
            next_position += 1
            current_count += 1

    # Update last_edited if photos were uploaded
    if uploaded_photos:
        conn.execute('UPDATE item SET last_edited=? WHERE id=?', [datetime.utcnow().isoformat(), item_id])

    return jsonify({"photos": uploaded_photos})

@app.route('/item/<item_id>/photos/<photo_id>', methods=['DELETE'])
@admin_required
def delete_photo(item_id, photo_id):
    """Delete a single photo"""
    conn = get_db()

    # Get the photo being deleted
    result = conn.execute('SELECT position, url FROM item_photos WHERE id = ? AND item_id = ?', [photo_id, item_id])
    photo = result.rows[0] if result.rows else None

    if not photo:
        return jsonify({"error": "Photo not found"}), 404

    deleted_position = photo[0]

    # Delete the photo
    conn.execute('DELETE FROM item_photos WHERE id = ?', [photo_id])

    # Reorder remaining photos to fill the gap
    conn.execute('''
        UPDATE item_photos
        SET position = position - 1
        WHERE item_id = ? AND position > ?
    ''', [item_id, deleted_position])

    # If we deleted position 0 (main photo), update the item's main_photo
    if deleted_position == 0:
        new_main_result = conn.execute(
            'SELECT url FROM item_photos WHERE item_id = ? AND position = 0', [item_id]
        )
        new_main_url = new_main_result.rows[0][0] if new_main_result.rows else None
        conn.execute('UPDATE item SET main_photo=? WHERE id=?', [new_main_url, item_id])

    return jsonify({"message": "Photo deleted"})

@app.route('/item/<item_id>/photos/reorder', methods=['PUT'])
@admin_required
def reorder_photos(item_id):
    """Reorder photos - expects {"photoIds": ["id1", "id2", ...]} in order"""
    conn = get_db()
    data = request.json
    photo_ids = data.get('photoIds', [])

    # Update positions based on array order
    for position, photo_id in enumerate(photo_ids):
        conn.execute(
            'UPDATE item_photos SET position = ? WHERE id = ? AND item_id = ?',
            [position, photo_id, item_id]
        )

    # Update main_photo to be the first photo
    if photo_ids:
        first_photo_result = conn.execute(
            'SELECT url FROM item_photos WHERE id = ?', [photo_ids[0]]
        )
        if first_photo_result.rows:
            conn.execute('UPDATE item SET main_photo=? WHERE id=?', [first_photo_result.rows[0][0], item_id])

    return jsonify({"photos": get_item_photos(conn, item_id)})

@app.route('/item/<item_id>/photos', methods=['GET'])
def get_photos(item_id):
    """Get all photos for an item"""
    conn = get_db()
    photos = get_item_photos(conn, item_id)
    return jsonify({"photos": photos})

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
                subcategory TEXT,
                secondhand TEXT
            )
        ''')
        conn.execute('''
            INSERT INTO item_new (id, item_name, description, category, origin, main_photo, created_at, subcategory, secondhand)
            SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory, secondhand
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
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory, secondhand, last_edited, gifted, private, materials, private_photos, private_description, private_origin FROM item')
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
    
@app.route('/community', methods=['POST'])
def add_community_item():
    try:
        # Get form fields
        item_id = request.form.get('id')
        item_name = request.form.get('itemName')
        description = request.form.get('description')
        category = request.form.get('category')
        origin = request.form.get('origin')
        created_at = datetime.utcnow().isoformat()
        subcategory = request.form.get('subcategory', '')
        submitted_by = request.form.get('submittedBy', '')
        
        photo_url = None
        
        # Handle photo
        if 'photo' in request.files:
            file = request.files['photo']
            if file.filename != '':
                result = cloudinary.uploader.upload(file)
                photo_url = result['secure_url']
        
        conn = get_db()
        # Ensure the columns match your table exactly
        conn.execute(
            'INSERT INTO community_item (id, item_name, description, category, origin, main_photo, created_at, subcategory, submitted_by, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
            [item_id, item_name, description, category, origin, photo_url, created_at, subcategory, submitted_by]
        )
        
        return jsonify({"message": "Item submitted for review"}), 201
    except Exception as e:
        print(f"COMMUNITY ERROR: {str(e)}") # This shows up in Render Logs
        return jsonify({"error": str(e)}), 500
    
    return jsonify({"message": "Item submitted for review"}), 201
    
def community_row_to_dict(row):
    return {
        "id": row[0],
        "itemName": row[1],
        "description": row[2],
        "category": row[3],
        "origin": row[4],
        "mainPhoto": row[5],
        "createdAt": row[6],
        "subcategory": row[7],
        "submittedBy": row[8],
        "approved": row[9]
    }

@app.route('/community', methods=['GET'])
def get_community_items():
    conn = get_db()
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory, submitted_by, approved FROM community_item WHERE approved = 1')
    items = [community_row_to_dict(row) for row in result.rows]
    return jsonify(items)

@app.route('/community/pending', methods=['GET'])
@token_required
def get_pending_community_items():
    conn = get_db()
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory, submitted_by, approved FROM community_item WHERE approved = 0')
    items = [community_row_to_dict(row) for row in result.rows]
    return jsonify(items)

@app.route('/community/<item_id>/approve', methods=['PUT'])
@token_required
def approve_community_item(item_id):
    conn = get_db()
    conn.execute('UPDATE community_item SET approved = 1 WHERE id = ?', [item_id])
    return jsonify({"message": "Item approved"})

@app.route('/community/<item_id>', methods=['DELETE'])
@token_required
def delete_community_item(item_id):
    conn = get_db()
    conn.execute('DELETE FROM community_item WHERE id = ?', [item_id])
    return jsonify({"message": "Item deleted"})


@app.route('/random', methods=['GET'])
def get_random_item():
    conn = get_db()
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory, secondhand, last_edited, gifted, private, materials, private_photos, private_description, private_origin FROM item ORDER BY RANDOM() LIMIT 1')
    if result.rows:
        return jsonify(row_to_dict(result.rows[0]))
    return jsonify(None)

@app.route('/community/random', methods=['GET'])
def get_random_community_item():
    conn = get_db()
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory, submitted_by, approved FROM community_item WHERE approved = 1 ORDER BY RANDOM() LIMIT 1')
    if result.rows:
        return jsonify(community_row_to_dict(result.rows[0]))
    return jsonify(None)

@app.route('/migrate-community-fix', methods=['GET'])
def migrate_community_fix():
    conn = get_db()
    try:
        # Try to add missing columns if they don't exist
        conn.execute('ALTER TABLE community_item ADD COLUMN subcategory TEXT')
        conn.execute('ALTER TABLE community_item ADD COLUMN submitted_by TEXT')
        return "Migration successful"
    except Exception as e:
        return f"Migration info: {str(e)}"
    
@app.route('/migrate-community-final', methods=['GET'])
def migrate_community_final():
    conn = get_db()
    try:
        # Check and add subcategory
        try:
            conn.execute('ALTER TABLE community_item ADD COLUMN subcategory TEXT')
        except Exception:
            pass # Already exists
        
        # Check and add submitted_by
        try:
            conn.execute('ALTER TABLE community_item ADD COLUMN submitted_by TEXT')
        except Exception:
            pass # Already exists
            
        return jsonify({"message": "Community table migration successful"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/fix-community-db', methods=['GET'])
def fix_community_db():
    conn = get_db()
    try:
        # 1. Ensure the table exists
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
        
        # 2. Safety check: Try to add columns if they were missed previously
        try:
            conn.execute('ALTER TABLE community_item ADD COLUMN subcategory TEXT')
        except: pass
        
        try:
            conn.execute('ALTER TABLE community_item ADD COLUMN submitted_by TEXT')
        except: pass
            
        return "Community table is ready! You can now close this tab and try submitting."
    except Exception as e:
        return f"Error: {str(e)}"
    
@app.route('/migrate-add-secondhand', methods=['POST'])
@token_required
def migrate_add_secondhand():
    conn = get_db()
    try:
        conn.execute('ALTER TABLE item ADD COLUMN secondhand TEXT')
        return jsonify({"message": "secondhand column added successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/migrate-add-photos-table', methods=['POST'])
@token_required
def migrate_add_photos_table():
    conn = get_db()
    try:
        # Create item_photos table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS item_photos (
                id TEXT PRIMARY KEY,
                item_id TEXT NOT NULL,
                url TEXT NOT NULL,
                position INTEGER DEFAULT 0,
                created_at TEXT,
                FOREIGN KEY (item_id) REFERENCES item(id) ON DELETE CASCADE
            )
        ''')
        return jsonify({"message": "item_photos table created successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/migrate-existing-photos', methods=['POST'])
@token_required
def migrate_existing_photos():
    conn = get_db()
    try:
        # Get all items with mainPhoto
        result = conn.execute('SELECT id, main_photo FROM item WHERE main_photo IS NOT NULL AND main_photo != ""')
        migrated = 0
        for row in result.rows:
            item_id = row[0]
            photo_url = row[1]
            # Check if already migrated
            existing = conn.execute('SELECT id FROM item_photos WHERE item_id = ? AND position = 0', [item_id])
            if not existing.rows:
                photo_id = str(uuid.uuid4())
                conn.execute('''
                    INSERT INTO item_photos (id, item_id, url, position, created_at)
                    VALUES (?, ?, ?, 0, ?)
                ''', [photo_id, item_id, photo_url, datetime.utcnow().isoformat()])
                migrated += 1
        return jsonify({"message": f"Migrated {migrated} photos successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/migrate-add-last-edited-and-gifted', methods=['POST'])
@token_required
def migrate_add_last_edited_and_gifted():
    conn = get_db()
    errors = []
    try:
        conn.execute('ALTER TABLE item ADD COLUMN last_edited TEXT')
    except Exception as e:
        errors.append(f"last_edited: {str(e)}")
    try:
        conn.execute('ALTER TABLE item ADD COLUMN gifted TEXT')
    except Exception as e:
        errors.append(f"gifted: {str(e)}")

    if errors:
        return jsonify({"message": "Migration completed with notes", "notes": errors})
    return jsonify({"message": "last_edited and gifted columns added successfully"})

@app.route('/migrate-fix-photo-timestamps', methods=['POST'])
@token_required
def migrate_fix_photo_timestamps():
    """Fix photo timestamps to match their parent item's created_at"""
    conn = get_db()
    try:
        # Update each photo's created_at to match its parent item's created_at
        conn.execute('''
            UPDATE item_photos
            SET created_at = (
                SELECT item.created_at
                FROM item
                WHERE item.id = item_photos.item_id
            )
        ''')
        return jsonify({"message": "Photo timestamps updated to match item creation dates"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/migrate-add-private', methods=['POST'])
@token_required
def migrate_add_private():
    """Add private column to item table"""
    conn = get_db()
    try:
        conn.execute('ALTER TABLE item ADD COLUMN private TEXT')
        return jsonify({"message": "private column added successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/migrate-add-granular-privacy', methods=['POST'])
@token_required
def migrate_add_granular_privacy():
    """Add granular privacy columns for photos, description, origin"""
    conn = get_db()
    errors = []

    try:
        conn.execute('ALTER TABLE item ADD COLUMN private_photos TEXT')
    except Exception as e:
        errors.append(f"private_photos: {str(e)}")

    try:
        conn.execute('ALTER TABLE item ADD COLUMN private_description TEXT')
    except Exception as e:
        errors.append(f"private_description: {str(e)}")

    try:
        conn.execute('ALTER TABLE item ADD COLUMN private_origin TEXT')
    except Exception as e:
        errors.append(f"private_origin: {str(e)}")

    if errors:
        return jsonify({"message": "Migration completed with notes", "notes": errors})
    return jsonify({"message": "Granular privacy columns added successfully"})

@app.route('/migrate-add-materials', methods=['POST'])
@token_required
def migrate_add_materials():
    """Create materials table and add materials column to item table"""
    conn = get_db()
    errors = []

    # Create materials table
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS materials (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            )
        ''')
        # Insert default materials
        default_materials = ['Cotton', 'Polyester', 'Rayon']
        for mat in default_materials:
            try:
                conn.execute('INSERT INTO materials (id, name) VALUES (?, ?)',
                           [str(uuid.uuid4()), mat])
            except:
                pass  # Already exists
    except Exception as e:
        errors.append(f"materials table: {str(e)}")

    # Add materials column to item table
    try:
        conn.execute('ALTER TABLE item ADD COLUMN materials TEXT')
    except Exception as e:
        errors.append(f"materials column: {str(e)}")

    if errors:
        return jsonify({"message": "Migration completed with notes", "notes": errors})
    return jsonify({"message": "Materials table and column added successfully"})

@app.route('/materials', methods=['GET'])
def get_materials():
    """Get all available materials"""
    conn = get_db()
    result = conn.execute('SELECT id, name FROM materials ORDER BY name ASC')
    materials = [{"id": row[0], "name": row[1]} for row in result.rows]
    return jsonify(materials)

@app.route('/materials', methods=['POST'])
@token_required
def add_material():
    """Add a new material"""
    data = request.json
    name = data.get('name', '').strip()

    if not name:
        return jsonify({"error": "Material name is required"}), 400

    # Capitalize first letter, lowercase rest
    formatted_name = name[0].upper() + name[1:].lower() if len(name) > 1 else name.upper()

    conn = get_db()

    # Check if already exists
    existing = conn.execute('SELECT id, name FROM materials WHERE LOWER(name) = LOWER(?)', [formatted_name])
    if existing.rows:
        return jsonify({"id": existing.rows[0][0], "name": existing.rows[0][1], "existed": True})

    material_id = str(uuid.uuid4())
    conn.execute('INSERT INTO materials (id, name) VALUES (?, ?)', [material_id, formatted_name])

    return jsonify({"id": material_id, "name": formatted_name}), 201

@app.route('/extract-item', methods=['POST'])
@token_required
def extract_item():
    """Use Anthropic Claude to extract item fields from natural language description"""
    import json as json_lib

    # Check if API key is configured
    anthropic_key = os.getenv('ANTHROPIC_API_KEY')
    if not anthropic_key:
        return jsonify({"error": "ANTHROPIC_API_KEY not configured"}), 503

    data = request.json
    description = data.get('description', '')
    image_base64 = data.get('image')  # Optional base64 image
    image_media_type = data.get('imageMediaType', 'image/jpeg')  # e.g., image/jpeg, image/png

    if not description and not image_base64:
        return jsonify({"error": "Description or image required"}), 400

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=anthropic_key)

        # Get available materials for context
        conn = get_db()
        materials_result = conn.execute('SELECT name FROM materials ORDER BY name ASC')
        available_materials = [row[0] for row in materials_result.rows]

        # Build the extraction prompt
        system_prompt = """You are a helpful assistant that extracts structured data from item descriptions for a personal inventory catalog.

Extract the following fields from the user's description:
- itemName: A concise name for the item (e.g., "Blue Cotton T-Shirt", "Grandmother's Quilt")
- description: Preserve the user's words almost verbatim. Keep the personal stories, memories, tangents, opinions, and context exactly as spoken. Only remove information that's redundant because it's captured in other fields (like store name or material percentages if stated plainly). Do NOT smooth, formalize, or rewrite. Fragmented sentences are fine. Stream of consciousness is fine. The goal is to sound like the person, not like a product description.
- category: One of: clothing, jewelry, sentimental, bedding, other
- subcategory: For clothing only - one of: undershirt, shirt, sweater, jacket, dress, pants, shorts, skirt, shoes, socks, underwear, accessories, other
- origin: Where the item was purchased/obtained (store name, website, "gift from mom", etc.)
- materials: Array of {material: string, percentage: number} for clothing/bedding items. Use these known materials when applicable: """ + ', '.join(available_materials) + """
- secondhand: "new", "secondhand", "handmade", or "unknown"
- gifted: "yes" if it was a gift, "no" otherwise

Return ONLY a valid JSON object with these fields. Use null for fields you cannot determine."""

        # Build messages with optional image
        content = []
        if image_base64:
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": image_media_type,
                    "data": image_base64
                }
            })
        if description:
            content.append({
                "type": "text",
                "text": f"Extract inventory item data from this description:\n\n{description}"
            })

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=[
                {"role": "user", "content": content}
            ]
        )

        # Parse the response
        response_text = message.content[0].text

        # Try to extract JSON from the response (handle markdown code blocks)
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]

        extracted_data = json_lib.loads(response_text.strip())

        return jsonify(extracted_data)

    except json_lib.JSONDecodeError as e:
        return jsonify({"error": f"Failed to parse extraction result: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"Extraction failed: {str(e)}"}), 500


@app.route('/materials/<material_id>', methods=['DELETE'])
@admin_required
def delete_material(material_id):
    """Delete a material if it's not in use by any items"""
    conn = get_db()

    # Get the material name first
    material = conn.execute('SELECT name FROM materials WHERE id = ?', [material_id])
    if not material.rows:
        return jsonify({"error": "Material not found"}), 404

    material_name = material.rows[0][0]

    # Check if any items use this material
    # We need to search the JSON materials column for this material name
    items = conn.execute('SELECT id, materials FROM item WHERE materials IS NOT NULL')
    for row in items.rows:
        try:
            import json
            item_materials = json.loads(row[1]) if row[1] else []
            for mat in item_materials:
                if mat.get('material') == material_name:
                    return jsonify({"error": f"Cannot delete - material is in use by items"}), 400
        except:
            pass

    # Safe to delete
    conn.execute('DELETE FROM materials WHERE id = ?', [material_id])
    return jsonify({"message": "Material deleted"})


# Categories endpoints
@app.route('/migrate-add-categories', methods=['POST'])
@token_required
def migrate_add_categories():
    """Create categories table with default categories"""
    conn = get_db()
    errors = []

    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL
            )
        ''')
        # Insert default categories
        default_categories = [
            ('clothing', 'Clothing'),
            ('jewelry', 'Jewelry'),
            ('sentimental', 'Sentimental'),
            ('bedding', 'Bedding'),
            ('other', 'Other')
        ]
        for name, display_name in default_categories:
            try:
                conn.execute('INSERT INTO categories (id, name, display_name) VALUES (?, ?, ?)',
                           [str(uuid.uuid4()), name, display_name])
            except:
                pass  # Already exists
    except Exception as e:
        errors.append(f"categories table: {str(e)}")

    if errors:
        return jsonify({"message": "Migration completed with notes", "notes": errors})
    return jsonify({"message": "Categories table created successfully"})


@app.route('/categories', methods=['GET'])
def get_categories():
    """Get all available categories"""
    conn = get_db()
    try:
        result = conn.execute('SELECT id, name, display_name FROM categories ORDER BY display_name ASC')
        categories = [{"id": row[0], "name": row[1], "displayName": row[2]} for row in result.rows]
        return jsonify(categories)
    except Exception:
        # Table doesn't exist yet - return default categories for frontend to work
        return jsonify([
            {"id": "default-clothing", "name": "clothing", "displayName": "Clothing"},
            {"id": "default-jewelry", "name": "jewelry", "displayName": "Jewelry"},
            {"id": "default-sentimental", "name": "sentimental", "displayName": "Sentimental"},
            {"id": "default-bedding", "name": "bedding", "displayName": "Bedding"},
            {"id": "default-other", "name": "other", "displayName": "Other"}
        ])


@app.route('/categories', methods=['POST'])
@token_required
def add_category():
    """Add a new category"""
    data = request.json
    name = data.get('name', '').strip()

    if not name:
        return jsonify({"error": "Category name is required"}), 400

    # Create slug (lowercase, no spaces)
    slug = name.lower().replace(' ', '-')
    # Display name keeps original formatting
    display_name = name

    conn = get_db()

    # Check if already exists
    existing = conn.execute('SELECT id, name, display_name FROM categories WHERE LOWER(name) = LOWER(?)', [slug])
    if existing.rows:
        return jsonify({"id": existing.rows[0][0], "name": existing.rows[0][1], "displayName": existing.rows[0][2], "existed": True})

    category_id = str(uuid.uuid4())
    conn.execute('INSERT INTO categories (id, name, display_name) VALUES (?, ?, ?)', [category_id, slug, display_name])

    return jsonify({"id": category_id, "name": slug, "displayName": display_name}), 201


@app.route('/categories/<category_id>', methods=['DELETE'])
@admin_required
def delete_category(category_id):
    """Delete a category if it's not in use by any items"""
    conn = get_db()

    # Get the category name first
    category = conn.execute('SELECT name FROM categories WHERE id = ?', [category_id])
    if not category.rows:
        return jsonify({"error": "Category not found"}), 404

    category_name = category.rows[0][0]

    # Check if any items use this category
    items = conn.execute('SELECT COUNT(*) FROM item WHERE category = ?', [category_name])
    count = items.rows[0][0] if items.rows else 0

    if count > 0:
        return jsonify({"error": f"Cannot delete - category is used by {count} item(s)"}), 400

    # Safe to delete
    conn.execute('DELETE FROM categories WHERE id = ?', [category_id])
    return jsonify({"message": "Category deleted"})


# Subcategories endpoints
@app.route('/migrate-add-subcategories', methods=['POST'])
@token_required
def migrate_add_subcategories():
    """Create subcategories table with default subcategories"""
    conn = get_db()
    errors = []

    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS subcategories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                category TEXT NOT NULL
            )
        ''')
        # Insert default subcategories for clothing
        default_subcategories = [
            ('undershirt', 'Undershirt', 'clothing'),
            ('shirt', 'Shirt', 'clothing'),
            ('sweater', 'Sweater', 'clothing'),
            ('jacket', 'Jacket', 'clothing'),
            ('dress', 'Dress', 'clothing'),
            ('pants', 'Pants', 'clothing'),
            ('shorts', 'Shorts', 'clothing'),
            ('skirt', 'Skirt', 'clothing'),
            ('shoes', 'Shoes', 'clothing'),
            ('socks', 'Socks', 'clothing'),
            ('underwear', 'Underwear', 'clothing'),
            ('accessories', 'Accessories', 'clothing'),
            ('other', 'Other', 'clothing')
        ]
        for name, display_name, category in default_subcategories:
            try:
                conn.execute('INSERT INTO subcategories (id, name, display_name, category) VALUES (?, ?, ?, ?)',
                           [str(uuid.uuid4()), name, display_name, category])
            except:
                pass  # Already exists
    except Exception as e:
        errors.append(f"subcategories table: {str(e)}")

    if errors:
        return jsonify({"message": "Migration completed with notes", "notes": errors})
    return jsonify({"message": "Subcategories table created successfully"})


@app.route('/subcategories', methods=['GET'])
def get_subcategories():
    """Get all available subcategories, optionally filtered by category"""
    conn = get_db()
    category_filter = request.args.get('category')
    try:
        if category_filter:
            result = conn.execute('SELECT id, name, display_name, category FROM subcategories WHERE category = ? ORDER BY display_name ASC', [category_filter])
        else:
            result = conn.execute('SELECT id, name, display_name, category FROM subcategories ORDER BY display_name ASC')
        subcategories = [{"id": row[0], "name": row[1], "displayName": row[2], "category": row[3]} for row in result.rows]
        return jsonify(subcategories)
    except Exception:
        # Table doesn't exist yet - return default subcategories for frontend to work
        defaults = [
            {"id": "default-undershirt", "name": "undershirt", "displayName": "Undershirt", "category": "clothing"},
            {"id": "default-shirt", "name": "shirt", "displayName": "Shirt", "category": "clothing"},
            {"id": "default-sweater", "name": "sweater", "displayName": "Sweater", "category": "clothing"},
            {"id": "default-jacket", "name": "jacket", "displayName": "Jacket", "category": "clothing"},
            {"id": "default-dress", "name": "dress", "displayName": "Dress", "category": "clothing"},
            {"id": "default-pants", "name": "pants", "displayName": "Pants", "category": "clothing"},
            {"id": "default-shorts", "name": "shorts", "displayName": "Shorts", "category": "clothing"},
            {"id": "default-skirt", "name": "skirt", "displayName": "Skirt", "category": "clothing"},
            {"id": "default-shoes", "name": "shoes", "displayName": "Shoes", "category": "clothing"},
            {"id": "default-socks", "name": "socks", "displayName": "Socks", "category": "clothing"},
            {"id": "default-underwear", "name": "underwear", "displayName": "Underwear", "category": "clothing"},
            {"id": "default-accessories", "name": "accessories", "displayName": "Accessories", "category": "clothing"},
            {"id": "default-other", "name": "other", "displayName": "Other", "category": "clothing"}
        ]
        if category_filter:
            return jsonify([d for d in defaults if d["category"] == category_filter])
        return jsonify(defaults)


@app.route('/subcategories', methods=['POST'])
@token_required
def add_subcategory():
    """Add a new subcategory"""
    data = request.json
    name = data.get('name', '').strip()
    category = data.get('category', 'clothing')

    if not name:
        return jsonify({"error": "Subcategory name is required"}), 400

    # Create slug (lowercase, no spaces)
    slug = name.lower().replace(' ', '-')
    # Display name keeps original formatting
    display_name = name

    conn = get_db()

    # Check if already exists
    existing = conn.execute('SELECT id, name, display_name, category FROM subcategories WHERE LOWER(name) = LOWER(?) AND category = ?', [slug, category])
    if existing.rows:
        return jsonify({"id": existing.rows[0][0], "name": existing.rows[0][1], "displayName": existing.rows[0][2], "category": existing.rows[0][3], "existed": True})

    subcategory_id = str(uuid.uuid4())
    conn.execute('INSERT INTO subcategories (id, name, display_name, category) VALUES (?, ?, ?, ?)', [subcategory_id, slug, display_name, category])

    return jsonify({"id": subcategory_id, "name": slug, "displayName": display_name, "category": category}), 201


@app.route('/subcategories/<subcategory_id>', methods=['DELETE'])
@admin_required
def delete_subcategory(subcategory_id):
    """Delete a subcategory if it's not in use by any items"""
    conn = get_db()

    # Get the subcategory name first
    subcategory = conn.execute('SELECT name FROM subcategories WHERE id = ?', [subcategory_id])
    if not subcategory.rows:
        return jsonify({"error": "Subcategory not found"}), 404

    subcategory_name = subcategory.rows[0][0]

    # Check if any items use this subcategory
    items = conn.execute('SELECT COUNT(*) FROM item WHERE subcategory = ?', [subcategory_name])
    count = items.rows[0][0] if items.rows else 0

    if count > 0:
        return jsonify({"error": f"Cannot delete - subcategory is used by {count} item(s)"}), 400

    # Safe to delete
    conn.execute('DELETE FROM subcategories WHERE id = ?', [subcategory_id])
    return jsonify({"message": "Subcategory deleted"})


if __name__ == '__main__':
    app.run(debug=True, port=5000)