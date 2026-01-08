# Future Features & Vision for Transparency App

## Core Mission
Public transparency as performance art and political statement about ethical consumption under capitalism. Document the attempt to live a "net regenerative lifestyle" with full supply chain visibility.

## Phase 2-3: Visual Documentation (Months 3-4)
- [ ] Image upload for each item
- [ ] Thumbnail display in table
- [ ] Individual item detail pages (learn React Router)
- [ ] Full-size image display
- [ ] Multiple images per item

## Phase 4: Financial Transparency (Months 5-6)
- [ ] Income/expense tracking
- [ ] Public financial dashboard
- [ ] Monthly CSV imports from Bank of America
- [ ] Amazon purchase history integration
- [ ] "Cost of ethical consumption" calculator
- [ ] Donation button integration

## Phase 5: Search & Filter (Months 7-8)
- [ ] Text search across item names and descriptions
- [ ] Filter by category
- [ ] Filter by purchase date
- [ ] Filter by origin
- [ ] Advanced filter combinations

## Phase 6: Provenance Mapping (Months 9-12)
- [ ] Supply chain origin mapping
- [ ] Geographic visualization of where items come from
- [ ] Carbon footprint estimates (if data available)
- [ ] Granular sourcing documentation
- [ ] Handle "cannot determine origin" cases honestly

## Phase 7: AI-Enhanced Features
- [ ] Receipt scanning with LLM (auto-populate form from receipt image)
- [ ] AI outfit recommendations (filter clothing, generate combinations)
- [ ] Natural language search ("show me things from Bangladesh")
- [ ] Automatic categorization suggestions

## Phase 8: Social/Public Layer
- [ ] Make site publicly viewable
- [ ] Privacy controls (choose what's public vs private per item/field)
- [ ] Social sharing functionality
- [ ] User accounts (if going multi-user)
- [ ] Community product database (crowdsourced sourcing info)
- [ ] Most sustainable products ranking
- [ ] Potential commission/affiliate model

## Technical Infrastructure
- [ ] CSV import for bulk data
- [ ] Edit/delete items
- [ ] Data persistence (localStorage → database)
- [ ] Backend server (when needed)
- [ ] Cloud image storage
- [ ] API integrations (Plaid for banking, if feasible)

## Open Source Strategy
- [ ] Clean up codebase
- [ ] Write comprehensive documentation
- [ ] Create contribution guidelines
- [ ] Launch on GitHub publicly
- [ ] Build community around the tool

## Portfolio/Career Goals
- Demonstrate full-stack development skills
- Show creative problem-solving
- Document as conceptual art piece
- Use for tech job applications if biotech doesn't work out



## user feedback
"item added" haptic feedback
for clothing to classify the material it's made of and washing instructions

## features i want to add one at a time:
filter for specific kinds of items on the display by category
rearrange list by chronology vs. item type vs whatever type in alphabetical order on the list
auto scroll to the top when editing, except i would honestly rather just the edit make the list editable, like they all turn into text boxes that you can edit and then save, where edit button turns to save and then back when you click save

ideally i would have a login app. and then each item could have multiple photos with one displayed as the main photo as a thumbnail that you can click on to expand each item onto its own page with the rest of the photos

 add a feature where i can private certain items and put them behind a paywall

 i want it to basically be a life tracker people can use. it has a place for recipes with nutrient content, it helps people show each other where they buy stuff they like, etc., i would love to have it be like a lifestyle social media

 verbal UX where it prompts verbally your item information so you just talk to it and describe each item and take a photo as you go

 receipt scanner auto detects / fills out what you have in your food stock
 track inventory over time


FRONTEND (React)

 Install React Router
 Set up routes (home, item detail, wishlist, about)
 Make table rows clickable (navigate to detail page)
 Add hover states on rows (color change, cursor pointer)
 Add stopPropagation to Edit/Delete buttons
 Build ItemDetail component
 Photo layout: main photo left, thumbnails right
 Add photo button always top-left in thumbnails
 "Add Photo" text on main when no photos
 Click thumbnail → swaps to main
 Hover on thumbnail → show "make main" and "delete" options
 Undo button for photo deletes and edits
 Update item data structure to include photos array and mainPhotoIndex
 Build Wishlist page
 Build About page
 Mobile-responsive design for Safari on phone
 Frosted glass effect (CSS blur) for private/paywalled items


BACKEND (Flask/Python)

 Set up Flask server
 Connect to database (SQLite or PostgreSQL)
 Replace localStorage with API calls
 Create API endpoints: get items, add item, edit item, delete item
 Set up Cloudinary account
 Image upload endpoint
 Store image URLs in database


AUTH & USERS

 Login system
 Admin view (you - full edit access)
 Public view (read-only)
 Paid user view (unlocked paywall items)
 Visibility field per item: public / paywalled
 Price field for paywalled items
 Track which items each user has unlocked
 Subscription option (unlocks everything)


PAYMENTS (Stripe)

 Stripe integration
 Per-item purchase flow
 Subscription flow
 Show payment history publicly
 Show where money gets allocated


COMMENTS/FEEDBACK

 Comments on individual items
 Toggle: public or private
 Toggle: anonymous or named
 General suggestions page (maybe)


LLM SEARCH

 Vector embeddings of items
 RAG setup
 "Ask me anything" search box
 LLM generates summary with links to items


CONTENT

 Write About page (why you're doing this)
 Actually inventory your stuff with photos
 Fill out wishlist with "why I want it" / "why I haven't bought it"


FLOATING CARD CLOUD VIEW

A 2D spatial view where items appear as floating cards loosely clustered by category.

Default state:
- All items displayed as small cards (thumbnail + name)
- Cards loosely grouped by category — clothing drifts toward one area, jewelry another, etc.
- Not a rigid grid, more organic clustering
- Color-coded borders by category

Filtering behavior:
- When you select a filter, matching items float to center/become prominent
- Non-matching items fade out, shrink, or drift to edges
- Adding more filters (category → subcategory → material) tightens the cluster
- Smooth animations as cards reorganize

Interaction:
- Click and drag to pan around the space
- Click a card to open item details
- Maybe scroll to zoom, or keep it flat single-plane with just panning

Technical approach:
- CSS transforms for positioning
- Framer Motion for animations
- Calculate positions based on category/subcategory groupings
- No need for D3 or Three.js — keep it simple

Cards display:
- Thumbnail image
- Item name
- Category color indicator
- Keep them small so many fit on screen

This would be an alternate view mode, not replacing the list view. Toggle between "List" and "Cloud" views.


LATER / MAYBE

 PWA (installable on phone)
 Wishlist voting (should I buy this?)
 Cost-per-use tracking
 "How long have I had this" timestamps
 Oldest/newest/most expensive quick links
 Let visitors compare their own stuff (anonymous submission)


