from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///inventory.db')
db = SQLAlchemy(app)

# Cloudinary config
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET')
)

class Item(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    item_name = db.Column(db.String(255))
    description = db.Column(db.Text)
    category = db.Column(db.String(50))
    is_new_purchase = db.Column(db.Boolean)
    origin = db.Column(db.String(255))
    main_photo = db.Column(db.String(500))  # NEW: stores Cloudinary URL

    def to_dict(self):
        return {
            "id": self.id,
            "itemName": self.item_name,
            "description": self.description,
            "category": self.category,
            "isNewPurchase": self.is_new_purchase,
            "origin": self.origin,
            "mainPhoto": self.main_photo  # NEW
        }

with app.app_context():
    db.create_all()

@app.route('/', methods=['GET'])
def list_return():
    items = Item.query.all()
    return jsonify([item.to_dict() for item in items])

@app.route('/', methods=['POST'])
def add_item():
    data = request.json
    
    new_item = Item(
        id=data.get('id'),
        item_name=data.get('itemName'),
        description=data.get('description'),
        category=data.get('category'),
        is_new_purchase=data.get('isNewPurchase'),
        origin=data.get('origin')
    )
    
    db.session.add(new_item)
    db.session.commit()
    
    return jsonify(new_item.to_dict()), 201


@app.route('/item/<item_id>', methods=['PUT'])
def update_item(item_id):
    item = Item.query.get(item_id)
    if not item:
        return jsonify({"error": "Item not found"}), 404
    
    data = request.json
    item.item_name = data.get('itemName', item.item_name)
    item.description = data.get('description', item.description)
    item.category = data.get('category', item.category)
    item.is_new_purchase = data.get('isNewPurchase', item.is_new_purchase)
    item.origin = data.get('origin', item.origin)
    
    db.session.commit()
    
    return jsonify(item.to_dict())


@app.route('/item/<item_id>', methods=['DELETE'])
def delete_item(item_id):
    item = Item.query.get(item_id)
    if not item:
        return jsonify({"error": "Item not found"}), 404
    
    db.session.delete(item)
    db.session.commit()
    
    return jsonify({"message": "Item deleted"})


# NEW: Photo upload route
@app.route('/item/<item_id>/photo', methods=['POST'])
def upload_photo(item_id):
    item = Item.query.get(item_id)
    if not item:
        return jsonify({"error": "Item not found"}), 404
    
    if 'photo' not in request.files:
        return jsonify({"error": "No photo provided"}), 400
    
    file = request.files['photo']
    
    # Upload to Cloudinary
    result = cloudinary.uploader.upload(file)
    
    # Save URL to database
    item.main_photo = result['secure_url']
    db.session.commit()
    
    return jsonify({"url": result['secure_url']})


if __name__ == '__main__':
    app.run(debug=True, port=5000)


    
@app.route('/debug-env', methods=['GET'])
def debug_env():
    return jsonify({
        "cloud_name": os.getenv('CLOUDINARY_CLOUD_NAME'),
        "api_key": os.getenv('CLOUDINARY_API_KEY'),
        "secret_length": len(os.getenv('CLOUDINARY_API_SECRET', '')),
        "secret_first_3": os.getenv('CLOUDINARY_API_SECRET', '')[:3]
    })