# Inventory App

A personal inventory tracker with AI-powered data entry, multi-photo
support, and flexible visualization tools.

Built to explore full-stack development with a focus on reducing
friction — the AI assistant turns voice or text descriptions into
structured item data so cataloging is fast and painless.

![Cloud View Screenshot](screenshot.png)

## Features

### AI-Powered Data Entry
- Describe an item in natural language (text or voice) and the AI
  extracts name, category, origin, materials, and more
- Attach a photo and the AI uses vision to identify details
- Highlights fields the AI couldn't fill so you know what to complete

### Multi-Photo Support
- Upload up to 5 photos per item
- Set a main photo for thumbnails
- Reorder, replace, or delete photos from the detail page
- Undo accidental photo deletions

### Two View Modes
- **Cloud View**: Interactive grid with items grouped by category,
  color-coded borders, and subcategory clustering for clothing/jewelry
- **List View**: Sortable table (newest, oldest, alphabetical, random)

### Advanced Filtering
- Filter by category, subcategory, source (new/secondhand/handmade),
  gifted status, and materials
- Filters show live counts
- Material filter appears when clothing or bedding is selected

### Privacy Controls
- Mark entire items as private
- Granular control: hide photos, description, or origin independently
- Private content blurred for non-admin viewers

### Additional Features
- Full-text search across all fields
- Track materials with percentages (e.g., "80% cotton, 20% polyester")
- Manage categories, subcategories, and materials on the fly
- Community "Show & Tell" section for user submissions
- Undo delete for items (session-based)
- Mobile-responsive design

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS, React Router |
| Backend | Flask, Python |
| Database | Turso (SQLite on the edge) |
| Image Storage | Cloudinary |
| AI | Claude API (Sonnet) |
| Auth | JWT (admin/friend roles) |
| Hosting | Vercel (frontend), Render (backend) |

## Run Locally

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### Environment Variables

Create `.env` files in both `frontend/` and `backend/` directories.

**Backend `.env`:**
```
TURSO_DATABASE_URL=your_turso_url
TURSO_AUTH_TOKEN=your_turso_token
CLOUDINARY_URL=your_cloudinary_url
ANTHROPIC_API_KEY=your_claude_api_key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_password
FRIEND_USERNAME=friend
FRIEND_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
```

## Live Demo

[your-deployed-url.vercel.app](https://your-deployed-url.vercel.app)

## Roadmap

- [ ] Consumables & pantry tracking
- [ ] Receipt scanning for grocery imports
- [ ] CSV import/export
- [ ] Item statistics dashboard
