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


---

## Consumables & Meal Tracking System

A pantry management system that tracks what you have, what you eat, and what you need to buy. Connected to the inventory app through shared auth, database, and UI components.

### Core Concept

You say what you ate. The system subtracts ingredients from your stock. Over time it learns your patterns and auto-generates shopping lists before you run out.

### Data Model

**consumable_types** — The vocabulary of things you buy
- id
- name ("Eggs", "Milk", "Rice")
- category ("dairy", "protein", "grain", "produce", "pantry", etc.)
- unit ("count", "oz", "lbs", "gallons", "tbsp")
- photo (optional)
- default_quantity (how many you typically buy at once)
- default_store (where you usually get it)

**current_stock** — What you have right now
- id
- consumable_type_id
- quantity
- purchased_date
- expiration_date (optional)

**recipes** — Meals you make
- id
- name ("Scrambled eggs with toast")
- instructions (optional)
- photo (optional)
- prep_time (optional)
- tags (breakfast, quick, vegetarian, etc.)

**recipe_ingredients** — What goes into each recipe
- id
- recipe_id
- consumable_type_id
- quantity
- unit
- optional (boolean — can you skip this ingredient?)

**meal_log** — What you actually ate
- id
- recipe_id (nullable — could be a known recipe or freeform)
- name (freeform if not a recipe — "ate out", "snacked on chips")
- logged_at
- servings (default 1 — did you make double?)
- notes

**consumption_log** — Direct stock changes not tied to meals
- id
- consumable_type_id
- quantity_used
- logged_at
- reason ("expired", "spilled", "gave away", or auto-generated from meal)

**shopping_list** — What you need to buy
- id
- consumable_type_id
- quantity_needed
- auto_generated (boolean — system added vs manual)
- reason ("low stock", "for recipe: Lasagna", "manual add")
- added_at
- purchased (boolean)
- purchased_at

### User Flows

**Logging a meal (primary interaction):**
1. You say or type: "I made scrambled eggs with toast"
2. LLM matches to existing recipe OR creates new recipe and asks about ingredients
3. System subtracts ingredients from current_stock
4. Logs the meal with timestamp
5. If any ingredient went to zero or below threshold, adds to shopping_list

**Adding stock (after shopping):**
1. You say: "I bought eggs, milk, bread, and butter"
2. LLM parses, matches to consumable_types
3. Adds to current_stock with today's date
4. Marks items as purchased in shopping_list

**Checking what you need:**
1. Open /shopping
2. See auto-generated list based on:
   - Items below threshold (you have 2 eggs, you use 9/week)
   - Items expiring soon
   - Ingredients needed for planned meals
3. Can add manual items
4. Check off as you shop

**Creating a recipe:**
1. You say: "My pasta recipe is 8oz pasta, half jar of sauce, garlic, parmesan"
2. LLM parses ingredients, matches or creates consumable_types
3. Recipe saved for future logging

### Auto-Shopping Logic

System calculates weekly usage per consumable from meal_log over past 30 days:
- You logged scrambled eggs 8 times (24 eggs)
- You logged baking cookies twice (4 eggs)
- Total: 28 eggs / 4 weeks = 7 eggs/week

Current stock: 3 eggs
Projected days until out: 3 days
Threshold: 7 days supply
Action: Add "Eggs (1 dozen)" to shopping_list

### LLM Integration Points

1. **Meal logging** — Parse "I made X" into recipe match or creation
2. **Stock updates** — Parse "I bought X, Y, Z" into stock additions
3. **Recipe creation** — Parse ingredient lists into structured data
4. **Smart suggestions** — "You haven't eaten vegetables in 3 days" or "You have spinach expiring tomorrow, here are recipes"

### UI Pages

- `/pantry` — Current stock overview, organized by category, shows low/expiring items prominently
- `/log` — Quick meal logging, voice/text input, recent meals for quick re-log
- `/recipes` — Your recipe collection, can browse and log from here
- `/shopping` — Auto-generated + manual list, checkboxes, organized by store section
- `/consumables` — Manage the vocabulary of things you buy (like materials for inventory)

### Connection to Inventory App

- Shared authentication (same login)
- Shared database (Turso)
- Shared UI components (navigation, cards, filters)
- Shared LLM extraction infrastructure
- Landing page links to both Inventory and Pantry

### Future Enhancements

- Barcode scanning to add stock
- Receipt photo scanning to bulk-add purchases
- Meal planning calendar ("What should I make this week based on what I have?")
- Nutrition tracking (calories, macros per recipe)
- Cost tracking (how much do you spend on food per week)
- Sharing recipes with other users
- Integration with grocery delivery APIs

### Receipt Scanning

**Flow:**
1. Take photo of receipt after shopping
2. LLM extracts line items: item name, quantity, price, store name, date
3. Matches to existing consumable_types or suggests new ones
4. Adds to current_stock with purchase date and price
5. Marks matching items as purchased in shopping_list

**Purchase history tracked:**
- What you bought
- When you bought it
- Where you bought it
- How much you paid

**Over time this enables:**
- "You usually buy eggs at HEB for $3.50 but they're $4.20 at Target"
- "Your grocery spending is up 15% this month"
- "You bought olive oil 3 weeks ago, you usually go through a bottle in 6 weeks"
- Price history per item
- Preferred store per item

### Updated Data Model (for Receipt Scanning)

**purchases** — Receipt-level data
- id
- store_name
- purchase_date
- receipt_photo_url
- subtotal
- tax
- total
- notes

**purchase_items** — Line items from receipts
- id
- purchase_id
- consumable_type_id (nullable if unmatched)
- raw_text ("LG EGGS 12CT")
- quantity
- unit_price
- total_price
- matched (boolean — did it link to a consumable_type?)

This links to current_stock — when you scan a receipt, it both logs the purchase AND updates your stock.
