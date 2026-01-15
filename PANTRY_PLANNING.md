# Pantry & Consumables Tracker - Planning Notes

## Core Concept

A consumables tracking system separate from the main inventory. The inventory tracks **what I have** (with stories, provenance, meaning). This new system tracks **what I use up** (patterns, frequency, replenishment cycles).

## End Goals

- Auto-populating grocery list
- Track what I eat in a day
- Know when I need to meal prep
- As little friction as possible, as much automation as possible

## Data Inputs

### Receipt Scanning (Phase 1 - Now)
- Photograph receipts from Walmart (primary store)
- Use Claude vision to OCR and extract line items
- Capture as much granularity as possible from what's on the receipt (organic vs not, brand, size, price, store, date)

### Email Receipts (Phase 2 - Later)
- Set up email receipts from stores
- Parse automatically - less friction than photographing

### Daily Food Log
- Text box submitted once a day
- Natural language input: "had eggs and toast for breakfast, chipotle for lunch, pasta for dinner"
- AI extracts structured data from the free text

## Architecture Approach

NOT building inventory management ("I have 7 eggs in my fridge")

BUILDING a consumption pattern tracker ("I typically eat eggs 4x per week, I buy them every ~10 days")

Don't want to manually track inventory levels. Instead:
- Log what I buy (receipts)
- Log what I eat (daily log)
- System correlates over time to learn patterns
- Patterns drive the grocery list predictions

## Data Model (Rough)

### Product (canonical)
- The abstract concept: "eggs"

### Variant
- Specific version: "organic large eggs, Vital Farms, 12ct"
- Links to product
- Brand, size/variant descriptors, default unit quantity, default unit

### Purchase
- Instance of buying a variant
- Store, price, quantity, date
- Links to variant
- Comes from receipt scanning

### Food Log / Daily Log
- What I ate on a given day
- Natural language input, AI-extracted structure
- Meals, ingredients mentioned, timestamps

### Recipes
- Named meals I make
- List of ingredients with amounts
- Used when I log "made shakshuka" to understand what got consumed

### Meal Prep Log
- When I prepped meals
- What recipe, how many servings
- Helps predict when I'll need to prep again

## UI Ideas

### Landing Page
- Third card alongside Community and Inventory
- Teal/blue color theme
- Shows at-a-glance status:
  1. Grocery list preview ("You need: eggs, olive oil, +3 more")
  2. Meal prep countdown ("Meal prep in 2 days")
  3. Running low alerts ("3 items running low")

### Daily Log Screen
- Simple screen-sized interface
- Different buttons for different log functions:
  - Food Log
  - Receipt Scan
  - Meal Prep
  - Other
- AI-assisted form filling (like inventory's AI assistant)
- Natural language input → Claude extracts structured data
- Highlights fields AI couldn't determine, prompts me to fill those
- High assumption from AI, display sections it's not 100% sure on

### AI Form Filling Pattern
Same as inventory:
1. Free text input describing what I ate
2. "Extract & Fill Form" button
3. Shows extracted data with highlights on uncertain fields
4. I fill in the gaps
5. Save

## Technical Notes

- Walmart is primary store, pay with EBT (no automatic digital history)
- Receipt photos are the realistic input method for now
- Claude vision for OCR since it's already wired up for inventory
- Email parsing can come later as lower-friction alternative
- Patterns learned over time will make the system smarter

## Open Questions

- Exact schema for food log extraction
- How recipes link to purchases/consumption
- How grocery list generation actually works (threshold vs time-based vs recipe-planned)
- Where the grocery list lives (in app vs synced to phone notes/reminders)
