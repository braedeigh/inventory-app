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
            subcategory TEXT,
            secondhand TEXT
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
        "subcategory": row[7],
        "secondhand": row[8]
    }

def get_item_photos(conn, item_id):
    """Get all photos for an item, ordered by position"""
    result = conn.execute(
        'SELECT id, url, position FROM item_photos WHERE item_id = ? ORDER BY position ASC',
        [item_id]
    )
    return [{"id": row[0], "url": row[1], "position": row[2]} for row in result.rows]

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
    secondhand = request.form.get('secondhand')
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
        'INSERT INTO item (id, item_name, description, category, origin, main_photo, created_at, subcategory, secondhand) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [item_id, item_name, description, category, origin, main_photo_url, created_at, subcategory, secondhand]
    )

    # Save photos to item_photos table
    for photo in uploaded_photos:
        photo_id = str(uuid.uuid4())
        conn.execute('''
            INSERT INTO item_photos (id, item_id, url, position, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', [photo_id, item_id, photo['url'], photo['position'], created_at])

    # Return the created item with photos
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory, secondhand FROM item WHERE id=?', [item_id])
    row = result.rows[0]
    item = row_to_dict(row)
    item['photos'] = get_item_photos(conn, item_id)
    return jsonify(item), 201



@app.route('/item/<item_id>', methods=['PUT'])
@token_required
def update_item(item_id):
    data = request.json
    conn = get_db()
    conn.execute('''
        UPDATE item SET item_name=?, description=?, category=?, origin=?, subcategory=?, secondhand=?
        WHERE id=?
    ''', [data.get('itemName'), data.get('description'), data.get('category'),
           data.get('origin'), data.get('subcategory'), data.get('secondhand'), item_id])
    
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory, secondhand FROM item WHERE id=?', [item_id])    
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

            conn.execute('''
                INSERT INTO item_photos (id, item_id, url, position, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', [photo_id, item_id, result['secure_url'], next_position, datetime.utcnow().isoformat()])

            # Update main_photo if this is the first photo (position 0)
            if next_position == 0:
                conn.execute('UPDATE item SET main_photo=? WHERE id=?', [result['secure_url'], item_id])

            uploaded_photos.append({
                "id": photo_id,
                "url": result['secure_url'],
                "position": next_position
            })
            next_position += 1
            current_count += 1

    return jsonify({"photos": uploaded_photos})

@app.route('/item/<item_id>/photos/<photo_id>', methods=['DELETE'])
@token_required
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
@token_required
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
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory, secondhand FROM item')
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
    result = conn.execute('SELECT id, item_name, description, category, origin, main_photo, created_at, subcategory, secondhand FROM item ORDER BY RANDOM() LIMIT 1')
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)