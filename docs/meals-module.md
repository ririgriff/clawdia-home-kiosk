# Meals Module

## Overview

The Meals module covers everything related to dishes and meal planning. It is split across two pages and a shared dish database, with an external agent API for AI-assisted dish submission.

---

## Routes

| Route | Purpose |
| --- | --- |
| `/plan` | Weekly meal planner — view and edit the meal plan |
| `/meals` | Dish management — browse, search, add, edit, toggle availability |

Both routes live under the **Meals** top-nav item, with a sub-nav bar (Plan Meals / Manage Dishes / Shopping).

---

## Data Models

### Dish (`lib/models/Dish.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| `name` | String | Required |
| `name_zh` | String | Optional Chinese name |
| `category` | String[] | Array of category values from taxonomy |
| `tags` | String[] | Array of tag strings from taxonomy |
| `notes` | String | Optional |
| `critical_notes` | String | Optional — always shown in red on dish cards; for allergies, key instructions, etc. |
| `who_for` | `adult` \ | `child` \ | `both` | Legacy field, kept for compatibility |
| `typically_served` | MealSlot[] | `breakfast`, `lunch`, `snack`, `dinner` |
| `image_url` | String | Cloudinary or external URL |
| `recipe` | String | Full recipe/method text |
| `ingredients` | `{ name, quantity, unit }[]` |  |
| `reference_url` | String | Source URL |
| `available` | Boolean | Default `true` — hides from planner when false |
| `requested` | Boolean | Groundwork for procurement module |
| `favorites` | String[] | Member IDs who like this dish (e.g. `['alice', 'child1']`) — drives per-member hearts in UI and favorites filter in RecipeDrawer |
| `status` | `active` \ | `pending` | `pending` = awaiting review (agent submissions) |
| `source` | `manual` \ | `agent` | How the dish was created |

Index: `{ status: 1, name: 1 }`

### Ingredient sub-document

| Field | Type | Notes |
| --- | --- | --- |
| `name` | String | Required |
| `quantity` | String |  |
| `unit` | String |  |
| `photo_url` | String | Optional — brand/product photo |
| `critical_notes` | String | Optional — shown in red; for must-use brands, substitution warnings |
| `purchase_link` | String | Optional — direct purchase URL |

Ingredient-level details are optional and intended only for ingredients where the specific brand or source matters. They are set via the expandable row in `AddDishModal`.

### MealPlanEntry (`lib/models/MealPlan.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| `date` | String | `YYYY-MM-DD` |
| `slot` | MealSlot | `breakfast`, `lunch`, `snack`, `dinner` — defined in `MEAL_SLOTS` in `lib/types.ts`; adding a new slot type requires a code change there |
| `dish_id` | String | Reference to Dish `_id` |
| `eaters` | String[] | Member IDs from `MEAL_MEMBERS` in `config/family.ts` (e.g. `['alice', 'bob']` or `['child1']`) |
| `note` | String | Optional — one-time note for this specific instance (e.g. "Make 5 portions"). Not stored on the Dish record. |

Index: `{ date: 1, slot: 1 }`

> **Migration note (eaters):** Older documents stored `who_for: 'adult' | 'child'` instead of `eaters`. Run `scripts/migrate-meal-eaters.ts` to convert existing data.

> **Migration note (favorites):** New dishes default to all meal-picker members via the schema default. If you have older dishes that need backfilling, run `scripts/migrate-all-favorites.ts` (update member IDs in that script to match your household first).

### Taxonomy (`lib/models/Taxonomy.ts`)

Stores categories and tags dynamically. Seeded on first load.

| Field | Type | Notes |
| --- | --- | --- |
| `type` | `category` \ | `tag` |  |
| `value` | String | Slug, e.g. `main-protein` |
| `label` | String | Display name, e.g. `Main Protein` |
| `color` | String | Tailwind classes (categories only) |

**Current categories:** soup, main-protein, vegetable, egg, carb, cold-dish, fruit, dessert, drink
*(breakfast and snack were removed — use **`typically_served`** instead)*

**Current tags:** beef, pork, chicken, fish, seafood, tofu, quick, slow-cook, adult, western, chinese, thai, japanese

---

## API Endpoints

### App API (PIN cookie auth)

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/dishes` | List active dishes (excludes `recipe`, `ingredients`, `notes` for performance) |
| GET | `/api/dishes/[id]` | Get a single dish by ID including all fields (`recipe`, `ingredients`, `notes`) — used by `DishViewSheet` |
| GET | `/api/dishes?status=pending` | List pending dishes for review queue |
| POST | `/api/dishes` | Create a dish |
| PUT | `/api/dishes/[id]` | Update a dish (uses `$set`) |
| DELETE | `/api/dishes/[id]` | Delete a dish |
| GET | `/api/meal-plan?weekStart=YYYY-MM-DD` | Get enriched entries for the week (dish fields: name, tags, image, critical_notes) |
| GET | `/api/meal-plan?weekStart=YYYY-MM-DD&full=true` | Same but includes `ingredients`, `recipe`, `notes` on each dish — used by Shopping page |
| POST | `/api/meal-plan` | Add a meal plan entry |
| PUT | `/api/meal-plan/[id]` | Update `eaters` and/or `note` on an existing entry (uses `$set`) |
| DELETE | `/api/meal-plan/[id]` | Remove a meal plan entry |
| GET | `/api/taxonomy` | List all categories and tags (seeds on first call) |
| POST | `/api/taxonomy` | Create a new category or tag |
| DELETE | `/api/taxonomy/[id]` | Delete a taxonomy item |

### Agent API (`Bearer <AGENT_API_KEY>` auth — no PIN cookie needed)

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/agent/schema` | Returns taxonomy, field reference, endpoint listing |
| GET | `/api/agent/skill` | Returns full skill prompt for OpenClaw / multi-purpose agents |
| GET | `/api/agent/dishes` | List active dishes (for duplicate checking) |
| POST | `/api/agent/dishes` | Submit a dish — always lands as `pending` |
| PATCH | `/api/agent/dishes` | Update fields on an existing dish — body: `{ id, ...fields }`; updatable: `name`, `name_zh`, `notes`, `critical_notes`, `tags`, `available`, `typically_served`, `image_url` |
| GET | `/api/agent/mealplan?date=YYYY-MM-DD` | Get meal plan for a specific day, grouped by slot with eaters array per dish |
| POST | `/api/agent/mealplan` | Add a dish to the meal plan — requires `dish_id`, `date`, `slot`; rejects if dish is still pending |

---

## Key Components

### Pages

| Component | Path |
| --- | --- |
| Plan Meals page | `app/plan/page.tsx` |
| Manage Dishes page | `app/meals/page.tsx` — card grid view; filter bar: Row 1 (sticky) has Meal slot pills + Liked by member pills + search box all in one row; Row 2 Category; Row 3 Tags. Shows critical_notes in red, ingredient sub-photos. Favorites hearts shown as permanent row on each card (top-right corner of image). |
| Shopping / Meal Prep page | `app/shopping/page.tsx` → `components/ShoppingView/index.tsx` |
| Home summary | `app/page.tsx` → `components/MealSummary/index.tsx` |

### Meal Planner (`components/MealPlanner/`)

| File | Purpose |
| --- | --- |
| `index.tsx` | State, data fetching, assign/remove logic |
| `WeeklyGrid.tsx` | 7-day grid — fills full available height, rows expand equally; sticky headers, horizontal scroll |
| `MealSlotCell.tsx` | Individual cell — dish photo cards (tap for View/Remove overlay), favorites hearts button (top-right corner, compact variant), `+` button pinned at bottom |
| `RecipeDrawer.tsx` | Slide-up dish picker — 3-row filter bar matching Manage Dishes style. Row 1 (sticky): Meal slot pills + divider + Liked by member pills + search box. Rows 2–3 (Category, Tags) scroll with the dish grid. Pre-populates slot from selected cell and Liked by from eaters. Stays open until Done. |
| `WhoForPicker.tsx` | Full-screen overlay to choose who the meal is for — individual member chips + quick-select shortcuts from config |
| `SlotDetailSheet.tsx` | Bottom sheet showing all dishes in a slot — flat list with per-row Eye (opens `DishViewSheet`) and ✕ (remove) buttons |
| `DishViewSheet.tsx` | Bottom sheet for viewing a plan entry — photo band, critical notes, who's eating (editable), one-time note, Save button (enabled only when changes made), then recipe/ingredients/notes fetched lazily from `GET /api/dishes/[id]`, and "Edit recipe in Dish Manager" link |
| `AddDishModal.tsx` | Create / edit dish form with photo upload, ingredient parser. The `name_zh` field is labelled "Local name" in the UI (supports any non-English name, e.g. Japanese). |
| `DishChip.tsx` | Compact dish tag (used in compact views) |
| `FavoriteHearts.tsx` | Per-member heart buttons. `compact` variant: single button shows stacked mini hearts, tap opens `position:fixed` popover to toggle each member. `row` variant: permanent row of per-member hearts (used on Manage Dishes card). Member colors from `MEAL_MEMBERS` config. |

### Home Summary (`components/MealSummary/index.tsx`)

- Shows today and tomorrow
- Desktop: 2-column side-by-side
- Mobile: Today/Tomorrow tab switcher
- Dish cards: tap to reveal edit/remove overlay (with ✕ dismiss button); favorites hearts button (compact variant) always visible on card
- "Plan meals" button links to `/plan`

### Click-to-edit from plan view

Tapping a dish card in `MealSlotCell` or a dish row in `SlotDetailSheet` reveals an action overlay with **Edit** and **Remove** buttons.

- **Edit** opens `EntryEditModal` — edits the plan entry instance (eaters, one-time note). An "Edit Recipe" button inside the modal navigates to `/meals?edit=<dishId>` to edit the dish record itself.
- **Remove** deletes the plan entry immediately.

The `/meals` page detects the `edit` query param after dishes load, opens `AddDishModal` for that dish, then clears the param from the URL.

---

## Navigation

```
Top nav:    Home | Meals | Calendar
Sub-nav:         Plan Meals | Manage Dishes | Shopping
```

- **Shopping** (`/shopping`) — meal prep and shopping list view. Shows this week's meals day-by-day (tap any dish to open `DishViewSheet` for the recipe). Below that, a consolidated alphabetical ingredient checklist across all planned dishes — checkboxes are local state (for supermarket use, not persisted).

- NavBar is responsive: icons-only on mobile (`< 640px`), labels on desktop
- Sub-nav appears automatically when on any `/plan`, `/meals`, or `/shopping` route

---

## Agent Integration (OpenClaw)

The external Claude agent (running on a separate machine, accessible via WhatsApp) uses the agent API to add dishes and query the meal plan.

**Setup on agent machine:**
- `KIOSK_API_BASE` = Vercel deployment URL
- `KIOSK_AGENT_KEY` = value of `AGENT_API_KEY` env var
- Skill file: `openclaw-skill/SKILL.md` → copy to `~/.openclaw/skills/meal-planner/SKILL.md`

The SKILL.md is a minimal bootstrap that fetches full instructions from `GET /api/agent/skill` at runtime — no need to update the skill file when the app changes.

**Agent workflows:**
1. **Add a dish** — research via web tools → submit → lands as pending
2. **Generate dish ideas** — propose list → confirm → submit batch
3. **Summarise meal plan** — fetch day → describe in plain language

---

## Review Queue

Agent-submitted dishes land as `status: pending`. On the `/meals` page:
- **Review** tab shows pending dishes with an "AI suggested" badge
- Actions: **Approve**, **Edit & Approve**, **Reject**
- Approved dishes move to the active dish list immediately

---

## RecipeDrawer Default Filters

When the dish picker drawer opens, it pre-filters based on context:

- **Meal slot** — defaults to the slot of the selected cell. Tap All or any other slot pill to override.
- **Liked by** — per-member heart pills (one per meal-picker member), multi-select. Defaults to the eaters for the selected cell. Shows dishes favorited by **any** of the selected members. Tap All or deselect all members to see every dish.
- **Category / Tags** — unfiltered by default. These rows live inside the scroll area so they don't reduce visible dish count on first open.

All filters reset each time the drawer opens for a new cell.

---

## Performance Notes

- `GET /api/dishes` excludes `recipe` and `notes` to reduce payload; `ingredients` is included (needed for ingredient sub-photos on cards)
- Meal plan entries are enriched server-side with minimal dish fields only
- Dishes and taxonomy load once on mount; week navigation only refetches the meal plan
- Dish model has a compound index on `{ status, name }`
