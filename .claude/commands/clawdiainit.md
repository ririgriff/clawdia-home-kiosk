# Clawdia Setup Wizard

**Before doing anything else**, display this welcome banner as plain text output — do not use a bash command, just print it directly:

```
╔══════════════════════════════════════════════════╗
║   🦞  CLAWDIA SETUP   ·   Home Kiosk Wizard      ║
╚══════════════════════════════════════════════════╝
```

You are guiding a new user through setting up their Clawdia home kiosk app. Work through the phases below in order. Be friendly, concise, and practical — the goal is to get them running as fast as possible.

Before starting, check whether `config/family.ts` exists (not just `config/family.example.ts`). Then read both `config/family.ts` (if it exists) and `.env.local` (or `env.example` if `.env.local` doesn't exist yet).

---

## RETURNING USER — config already exists

If `config/family.ts` already exists, **do not run the full wizard**. Instead:

1. Read `config/family.ts` and `.env.local` in full.

2. For each env var that has a live test, **run the test now** if the var is filled, so the status list shows real results. Run all four tests in parallel before displaying anything. Use the same test commands defined in Phase 6:
   - **MONGODB_URI** — run the Node.js `mongodb` connection test (5s timeout)
   - **ANTHROPIC_API_KEY** — run the Node.js `@anthropic-ai/sdk` models list test
   - **Cloudinary** — run the Node.js `cloudinary.api.ping()` test (only if all 3 vars are filled)
   - **TAVILY_API_KEY** — run the `curl` Bearer token test

3. Build a numbered status list. For env vars without a live test, show filled/not set. For env vars with a live test, show the test result:
   - `✅ filled · ✅ connection verified` — filled and test passed
   - `✅ filled · ❌ [error message]` — filled but test failed, show the specific error
   - `⬜ not set` — var is missing or empty in `.env.local`

```
Your current Clawdia configuration:

HOUSEHOLD
  1. Members          — [list names, e.g. "Alice, Bob, Helper (3 members)"] / ⬜ not set
  2. Role assignments — PRIMARY_USER: [value] · STAFF_ASSIGNEE: [value] / ⬜ not set
  3. App name         — "[value]" / ⬜ not set
  4. Timezone         — [value] / ⬜ not set
  5. Mascot images    — [custom / using defaults]
  6. AI description   — [filled / ⬜ not set]
  7. Meal shortcuts   — [X shortcuts / none]

ENVIRONMENT VARIABLES
  8.  MONGODB_URI         — ✅ filled · ✅ connection verified / ✅ filled · ❌ [error] / ⬜ not set
  9.  KIOSK_PIN           — ✅ filled / ⬜ not set
 10.  ANTHROPIC_API_KEY   — ✅ filled · ✅ connection verified / ✅ filled · ❌ [error] / ⬜ not set
 11.  AUTH_SALT           — ✅ filled / ⬜ not set
 12.  CRON_SECRET         — ✅ filled / ⬜ not set
 13.  Cloudinary (3 vars) — ✅ all filled · ✅ connection verified / ✅ filled · ❌ [error] / ⚠️ partial / ⬜ not set
 14.  TAVILY_API_KEY      — ✅ filled · ✅ connection verified / ✅ filled · ❌ [error] / ⬜ not set
 15.  AGENT_API_KEY       — ✅ filled / ⬜ not set
 16.  ICS_FEED_URL        — ✅ filled / ⬜ not set
 17.  ICAL_SECRET         — ✅ filled / ⬜ not set

OPTIONAL FEATURES
 18. Go-Home feature   — [enabled / disabled]
 19. ICS calendar sync — [configured / ⬜ not set]
 20. Auto-todo rules   — [X rules active]
```

3. Then ask: **"What would you like to update? Enter a number (or multiple numbers separated by commas), or type 'all' to run the full setup wizard from the beginning."**

4. Jump directly to the relevant phase(s) for whatever they select. When done with each selected item, re-show the updated status list and ask if there's anything else to change.

5. If they type `all`, proceed to PHASE 1 below as if it's a first-time setup.

---

## FIRST-TIME USER — no config yet

If `config/family.ts` does not exist, tell the user: "Welcome to Clawdia setup! I'll walk you through configuring your household. This should take about 10 minutes. Let's go phase by phase — you can always come back and change anything later."

---

## PHASE 1 — Household Members ⚠️ (take your time here)

**This is the most important phase.** Member IDs get stored in the database — every calendar event, to-do, and meal entry will reference them. Changing IDs later requires a data migration, so it's worth getting right now.

### Step 1 — Explain and count

Tell the user:

> "⚠️ **Before we start — a quick heads up:** Most of Clawdia's settings are easy to change later. This phase is the exception. The member IDs you set here get stored in the database alongside every calendar event, to-do, and meal plan entry you create. If you rename or change an ID after data has accumulated, you'll need to run a database migration to update all the existing records. So it's worth taking a moment to get this right — don't worry, I'll guide you through it."

> "Let's set up the people in your household. I'll ask about three groups:
>
> - **Adults** (parents, guardians) — appear in the calendar, can be assigned to-dos, and show up in the meal planner
> - **Children** — same as adults: in the calendar, assignable to to-dos, and in the meal planner
> - **Supporting staff** (helper, nanny, driver, etc.) — in the calendar and assignable to to-dos, but are excluded from the meal planner as an "eater" as we assume that they typically don't eat with the family - but there will be an opportunity to customize later so don't worry!
>
> We'll fine-tune any of this after if needed."

Then ask all three in a single message:

> "How many people are in each group? Reply with three numbers on one line, e.g. `2 adults, 1 child, 1 staff` — or just `2, 1, 1` if you prefer."
>
> - Adults (parents, guardians)?
> - Children?
> - Supporting staff (helper, nanny, driver, etc.)? — 0 if none

### Step 2 — Collect names and details

Once you have the counts, collect details for each person **by group** (all adults first, then children, then staff). For each person ask in a single message:

1. **Name** — display name (e.g. "Alice", "Maria")
2. **ID** — for adults and children, suggest a short lowercase slug from the name (e.g. `alice`). For staff, always assign `staff1`, `staff2`, etc. regardless of their name — explain: "I'm using `staff1` as the ID rather than their name. This means if your staff ever changes, you just update the name, initials, and colour — no database migration needed."
3. **Initials** — suggest 1–2 chars from the name
4. **Colour** — suggest one from this palette based on what's not yet taken: purple `#8b5cf6`, teal `#4a7c6f`, sky `#0891b2`, amber `#f59e0b`, green `#059669`, rose `#e11d48`, orange `#ea580c`, pink `#db2777`

Assign roles automatically based on group — do not ask:

- **Adults:** `calendar: true`, `todos: true`, `mealPicker: true`, `schoolChild: false`
- **Children:** `calendar: true`, `todos: true`, `mealPicker: true`, `schoolChild: false`
- **Staff:** `calendar: true`, `todos: true`, `mealPicker: false`, `schoolChild: false`

### Step 2b — Deduplicate initials

After collecting all members, check for duplicate initials across the full list. If any duplicates exist:

1. For each duplicate group, attempt to auto-resolve by using 2-character initials: first letter + the first letter that makes it unique (try the 2nd character of the name, then 3rd, etc.)
2. If auto-resolution produces a unique result for everyone, apply it silently — no need to ask
3. If there are still conflicts after attempting 2-character initials, flag them explicitly and ask the user to choose

Show the resolved initials in the Step 3 summary table (not before).

### Step 3 — Summary and confirm

Once all members are collected, print the flag legend followed by the summary table:

> **What the flags mean:**
> - **Calendar** ✅ — can be tagged as a participant on schedule events (e.g. "dentist — Alice")
> - **To-do** ✅ — can be assigned tasks (e.g. "Pick up Charlie — staff1")
> - **Meal planner** ✅ — appears in the 'who's eating' selector when planning meals

```
Name     ID       Initials  Colour     Calendar  To-do  Meal planner
───────  ───────  ────────  ─────────  ────────  ─────  ────────────
Alice    alice    A         #8b5cf6    ✅        ✅     ✅
Bob      bob      B         #0891b2    ✅        ✅     ✅
Charlie  charlie  C         #f59e0b    ✅        ✅     ✅
Maria    staff1   M         #059669    ✅        ✅     ❌
```

Then ask:

> "Does this look right?
> 1. Yes, looks good — move on
> 2. I need to make changes"

If they choose 2, ask what they'd like to change. Make the changes and re-show the updated table, then ask the same question again.

---

## PHASE 2 — Role Assignments

From the members with `todos: true`, ask each question **one at a time**. Present the eligible members as a numbered list so the user can reply with a number.

First question:
> "Who is the **primary user** — the adult who plans meals and manages the household?
>
> 1. Name (ID)
> 2. Name (ID)
> ..."

Once answered, ask the second question:
> "Is there someone who assists with day-to-day tasks like shopping, school runs, and errands — for example a helper or staff member? Or does the primary user handle those too? (If there is more than one, choose a default — you can fine-tune which tasks go to whom later.)
>
> 1. Name (ID)
> 2. Name (ID)
> ..."

Present all `todos: true` members as a numbered list (including the primary user — no need for a separate "same as primary user" option).

→ First answer sets `PRIMARY_USER`, second sets `STAFF_ASSIGNEE`.

If there's only one `todos: true` member, set both to that member and note it.
If there are no `todos: true` members, skip and note that AUTO_GEN_RULES won't work yet.

---

## PHASE 3 — App Branding & Timezone

Show the current defaults and ask "keep or change?" for each:

- **App name:** currently `"Clawdia"` — this appears in the nav bar, PIN screen, and browser tab.
  > 1. Keep
  > 2. Change

- **Timezone:** Run this shell command to detect the system timezone:

```bash
  readlink /etc/localtime 2>/dev/null | sed 's|.*/zoneinfo/||' || cat /etc/timezone 2>/dev/null
```

If the command returns a valid IANA timezone (e.g. `Asia/Hong_Kong`, `America/New_York`), propose that as the default. If it returns nothing or an unrecognisable value, fall back to proposing `"Asia/Hong_Kong"`. Show the detected timezone to the user and ask:

> "I detected your system timezone as `[detected]`. Is this the timezone your kiosk will be in?
> 1. Yes, keep it
> 2. Change it"

If they want to change it, show this numbered list and ask them to pick:

```
  Asia
   1. Asia/Hong_Kong
   2. Asia/Singapore
   3. Asia/Shanghai
   4. Asia/Tokyo
   5. Asia/Seoul
   6. Asia/Bangkok
   7. Asia/Kolkata
   8. Asia/Dubai
   9. Asia/Karachi

  Australia & Pacific
  10. Australia/Sydney
  11. Australia/Melbourne
  12. Australia/Perth
  13. Pacific/Auckland
  14. Pacific/Honolulu

  Europe
  15. Europe/London
  16. Europe/Paris
  17. Europe/Berlin
  18. Europe/Amsterdam
  19. Europe/Zurich
  20. Europe/Rome
  21. Europe/Madrid
  22. Europe/Stockholm
  23. Europe/Athens
  24. Europe/Moscow

  Americas
  25. America/New_York
  26. America/Chicago
  27. America/Denver
  28. America/Los_Angeles
  29. America/Toronto
  30. America/Vancouver
  31. America/Sao_Paulo
  32. America/Mexico_City
  33. America/Buenos_Aires

  Africa & Middle East
  34. Africa/Cairo
  35. Africa/Johannesburg
  36. Africa/Lagos

  Other
  37. UTC
```

If they pick a number, use that IANA string. If they type a timezone directly, use it as-is.

- **Mascot images:** currently using the default Clawdia lobster images in `public/`.
  > 1. Keep the defaults
  > 2. Customise with my own images

  If customising:
  1. Ask the user to drop their two replacement PNGs into `public/` and tell you the filenames (e.g. `mymascot-face.png`, `mymascot-full.png`).
  2. Update `MASCOT_FACE` and `MASCOT_FULL` in `config/family.ts` to point to the new files (e.g. `/mymascot-face.png`).
  3. Back up the default app icon before overwriting it:
     ```bash
     cp app/icon.png app/icon.default.png
     ```
  4. Generate the three favicon files from their full image:
     ```bash
     cp public/<their-full-image>.png public/favicon.png
     sips --resampleHeightWidth 32 32 public/<their-full-image>.png --out public/favicon-32.png
     sips --resampleHeightWidth 32 32 public/<their-full-image>.png --out app/icon.png
     ```
  5. Tell the user: "✅ Favicons updated. To revert to Clawdia defaults at any time: `cp app/icon.default.png app/icon.png`, copy `clawdia-full.png` back to `favicon.png` and `favicon-32.png`, and update `MASCOT_FACE`/`MASCOT_FULL` in `config/family.ts`."

---

## PHASE 4 — AI Chat Description

Using the members defined in Phase 1, auto-generate a `FAMILY_DESCRIPTION` in this format:

```
- **Name** — role/description
- **Name** — role/description
```

Base the role descriptions on their flags: adults with `todos: true` → likely parents/primary users, `schoolChild: true` → child, members with no `mealPicker`/`todos` but `calendar: true` → might be a pet, `todos: true` but no `calendar` → likely staff.

Show the generated description and ask:

> "This gets injected into the AI chat so Clawdia knows your household.
> 1. Looks good — move on
> 2. I'd like to adjust some descriptions"

---

## PHASE 5 — Meal Shortcuts

Shortcuts are optional convenience buttons in the meal eaters picker (e.g. tap "Adults" instead of tapping each adult individually). The app works fine with an empty list — users can always select eaters one by one.

From the `mealPicker: true` members, auto-generate sensible defaults:

- If there are adults + children: "Adults" (non-schoolChild mealPickers), "Kids" (schoolChild mealPickers), "Everyone" (all mealPickers)
- If everyone is an adult: just "Everyone"
- Adjust if the household has a helper who is also a mealPicker

Show the generated shortcuts and say:

> "These are optional quick-select buttons in the meal planner — the app works fine without them.
> 1. Accept
> 2. Adjust
> 3. Skip (no shortcuts)"

If they skip, set `MEAL_SHORTCUTS = []`.

---

## PHASE 6 — Environment Variables

Tell the user: "Now let's set up your API keys and secrets. I'll generate the random secrets for you."

### Required (ask one at a time):

1. **MONGODB_URI** — "Paste your MongoDB Atlas connection string. Format: `mongodb+srv://user:password@cluster.mongodb.net/home-kiosk?retryWrites=true&w=majority`. If you haven't created a cluster yet, go to cloud.mongodb.com → free M0 cluster → Connect → Drivers."

   Once the user pastes the URI, immediately test it by running this command (substituting their URI). Run from a temp directory so it doesn't depend on the project's `node_modules`:

   ```bash
   TEST_DIR=$(mktemp -d) && cd "$TEST_DIR" && npm init -y --quiet > /dev/null 2>&1 && npm install mongodb --quiet > /dev/null 2>&1 && TEST_URI="<their URI>" node -e "const { MongoClient } = require('mongodb'); const client = new MongoClient(process.env.TEST_URI, { serverSelectionTimeoutMS: 5000 }); client.connect().then(() => { console.log('OK'); client.close(); }).catch(err => { console.error(err.name + ': ' + err.message); process.exit(1); });" ; cd - > /dev/null ; rm -rf "$TEST_DIR"
   ```

   Interpret the result and tell the user:
   - Output is `OK` → "✅ MongoDB connection successful!"
   - `MongoParseError` → "❌ URI format looks wrong — check for typos in the connection string."
   - `bad auth` or `Authentication failed` → "❌ Wrong username or password in the URI — double-check your Atlas database user credentials."
   - `ENOTFOUND` or `getaddrinfo` → "❌ Cluster hostname not found — check that you copied the full URI correctly from Atlas."
   - Timeout / `Server selection timed out` → "❌ Connection timed out — your current IP is probably not whitelisted. Go to MongoDB Atlas → Network Access → Add IP Address → Add Current IP Address, then try again."

   Do not proceed to the next env var until the connection test passes (or the user explicitly asks to skip).

2. **KIOSK_PIN** — "Choose a 6-digit PIN for your household. Everyone who uses the kiosk will enter this. (Must be exactly 6 digits — the PIN screen is hardcoded to 6.)"

3. **ANTHROPIC_API_KEY** — "Paste your Anthropic API key (starts with `sk-ant-`). Get one at console.anthropic.com → API Keys."

   Once the user pastes the key, test it immediately from a temp directory:

   ```bash
   TEST_DIR=$(mktemp -d) && cd "$TEST_DIR" && npm init -y --quiet > /dev/null 2>&1 && npm install @anthropic-ai/sdk --quiet > /dev/null 2>&1 && TEST_KEY="<their key>" node -e "const Anthropic = require('@anthropic-ai/sdk'); const client = new Anthropic({ apiKey: process.env.TEST_KEY }); client.models.list().then(() => console.log('OK')).catch(err => { console.error(err.status + ': ' + err.message); process.exit(1); });" ; cd - > /dev/null ; rm -rf "$TEST_DIR"
   ```

   Interpret the result:
   - `OK` → "✅ Anthropic API key valid!"
   - `401` → "❌ Invalid API key — check you copied it in full from console.anthropic.com."
   - `403` → "❌ Key doesn't have the right permissions — check it's an API key, not an OAuth token."
   - Network error → "❌ Couldn't reach Anthropic API — check your internet connection."

   Do not proceed until the test passes (or the user explicitly asks to skip).

4. **AUTH_SALT** and **CRON_SECRET** — "I'll generate these for you." Run `openssl rand -hex 32` twice and show the values. Tell the user: "These will be saved to your `.env.local` file — you'll need to copy them from there when you add environment variables to Vercel in Step 3 of the README."

### Recommended (explain why, offer skip):

5. **Cloudinary** (dish photo uploads) — "Cloudinary lets you upload photos for dishes in the meal planner from your computer or by providing a URL. Without it, the upload button won't work — you can still use the app, but dish cards won't have photos (it looks MUCH better with beautiful photos!). Setting it up takes about 2 minutes at cloudinary.com (free plan). Set up now or skip for later?" If setting up: ask for `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

   Once all three are provided, test them immediately from a temp directory:

   ```bash
   TEST_DIR=$(mktemp -d) && cd "$TEST_DIR" && npm init -y --quiet > /dev/null 2>&1 && npm install cloudinary --quiet > /dev/null 2>&1 && CLOUD_NAME="<cloud_name>" CLOUD_KEY="<api_key>" CLOUD_SECRET="<api_secret>" node -e "const cloudinary = require('cloudinary').v2; cloudinary.config({ cloud_name: process.env.CLOUD_NAME, api_key: process.env.CLOUD_KEY, api_secret: process.env.CLOUD_SECRET }); cloudinary.api.ping().then(() => console.log('OK')).catch(err => { console.error(err.message || JSON.stringify(err)); process.exit(1); });" ; cd - > /dev/null ; rm -rf "$TEST_DIR"
   ```

   Interpret the result:
   - `OK` → "✅ Cloudinary credentials valid!"
   - `Must supply api_key` or `Must supply cloud_name` → "❌ One of the three values is missing or blank."
   - `Invalid API key` or `401` → "❌ API key or secret is wrong — double-check them in your Cloudinary dashboard under Settings → API Keys."
   - Cloud name error → "❌ Cloud name not found — check the cloud name in the top-left of your Cloudinary dashboard."

   Do not proceed until the test passes (or the user explicitly asks to skip).

6. **Tavily** (recipe web search) — "Tavily powers the recipe web search in the Add Dish drawer and AI chat — it lets Clawdia find recipes on the web for you just using the name of the dish. Free plan gives 1,000 searches/month. Worth doing now if you can as it saves a lot of time and enables you to populate your recipe book quickly - you can always go back to manually edit the recipes or put in your own in due course. Set up now or skip for later?" If setting up: ask for `TAVILY_API_KEY`. Get it at tavily.com.

   Once the user pastes the key, test it immediately:

   ```bash
   TEST_KEY="<their key>" curl -s -o /dev/null -w "%{http_code}" -X POST "https://api.tavily.com/search" -H "Content-Type: application/json" -H "Authorization: Bearer $TEST_KEY" -d '{"query":"test","max_results":1}'
   ```

   Interpret the HTTP status code:
   - `200` → "✅ Tavily API key valid!"
   - `401` or `403` → "❌ Invalid API key — check you copied it correctly from tavily.com."
   - `000` or network error → "❌ Couldn't reach Tavily API — check your internet connection."

   Do not proceed until the test passes (or the user explicitly asks to skip).

### Optional (mention briefly, suggest skipping for now):

Tell the user: "The following are for optional features — I'd recommend skipping these for now and coming back once your system is up and running:"

- `ICS_FEED_URL` — for importing an external calendar (Google/Outlook). Covered in Phase 7.
- `ICAL_SECRET` — only needed if you want external apps to subscribe to your kiosk calendar. Skip for now.
- `AGENT_API_KEY` — only needed for OpenClaw/WhatsApp integration (Step 5 in the README). Skip for now.

---

## PHASE 7 — Optional Features (encourage to skip, come back later)

### Go-Home feature

Explain the feature as follows:

> "⚠️ **Heads up — this feature is highly opinionated.** It was built specifically for the creator's household and may not fit yours. I'd recommend skipping it unless you're curious to explore how it works, or your situation happens to match closely.
>
> **What it does:** When enabled, a banner appears on the home dashboard and weekly calendar each school day showing how your child is getting home — automatically calculated from their calendar events. It also drives two auto-generated to-dos:
> - **'Pick up [child] from school'** → assigned to your staff/helper on days when pickup is needed
> - **'Accompany [child] to [appointment]'** → assigned to your staff/helper when the child has an appointment event
>
> **The scenario it was built for:**
> - The school runs **two rounds of buses** — one at 3pm and one at 4pm
> - Activities ending after 4pm mean the child misses both buses and must be picked up
> - The school has a **registered default pickup arrangement** — any deviation from that default requires the parent to inform the school in advance
> - The app tracks the default and flags when something different is happening
>
> The logic works through this checklist each day:
> 1. Weekend or holiday → no banner
> 2. Child has an appointment event → **Pickup**
> 3. Child's last event ends after the pickup cutoff (e.g. 16:10) → **Pickup** (too late for any bus)
> 4. Child's last event ends after the late-bus cutoff (e.g. 15:10) → **Bus 4pm** (missed the 3pm bus)
> 5. Otherwise → the weekday default you've configured
>
> Does this match your situation? Or would you like to skip for now?"

Present as:
> 1. Yes, this matches my situation — set it up
> 2. Skip for now

- If **yes**:
  1. Ask which child is the school child (numbered list of children from Phase 1) — set `schoolChild: true` on that member
  2. Ask how many bus rounds the school has:
     > "How many rounds of school buses does your school run?
     > 1. One round (after which the child must be picked up)
     > 2. Two rounds (e.g. 3pm and 4pm — after the second, pickup is needed)"
  3. Ask for `SCHOOL_NAME` (e.g. "ABC Primary")
  4. Ask for `SCHOOL_PORTAL_URL` — tell them it's optional (used to link to the school portal when informing the school of changes). They can skip if not relevant.
  5. If **one bus round**: only ask for one cutoff time (`GO_HOME_PICKUP_AFTER`, default `"15:10"`). Set `GO_HOME_BUS_LATE_AFTER` equal to `GO_HOME_PICKUP_AFTER` (effectively disabling the 4pm bus logic). Weekday defaults will only offer `bus` or `pickup`.
  6. If **two bus rounds**: ask for both cutoff times:
     - `GO_HOME_BUS_LATE_AFTER` — if last event ends after this, child takes the late bus (default `"15:10"`)
     - `GO_HOME_PICKUP_AFTER` — if last event ends after this, child must be picked up (default `"16:10"`)
  7. Ask for `FALLBACK_HOME_DEFAULTS` per weekday (Mon–Fri):
     > "What is [child]'s **regular schedule** for getting home — assuming no deviations or special activities? Enter one number per day, Mon to Fri, separated by commas.
     >
     > 1. bus-3pm *(or just 'bus' if one round)*
     > 2. bus-4pm *(only shown if two rounds)*
     > 3. pickup
     >
     > e.g. `1,1,2,1,1` means bus Mon/Tue/Thu/Fri, late bus Wed"
  8. Set `ENABLE_GO_HOME = true`

- If **no/skip**: set `ENABLE_GO_HOME = false`. Tell them: "No problem — fully off by default. You can enable it anytime by editing `config/family.ts` and reading `docs/manual-configuration.md`."

### ICS Calendar Sync

"Clawdia can import events from an external calendar feed (Google Calendar, Outlook, etc.) via an ICS URL. This is great if you already manage your family calendar somewhere else and want it to appear on the kiosk automatically.

Skip for now and come back later? Or set up now?"

- If setting up: ask for `ICS_FEED_URL` and walk through `ICS_PARTICIPANT_KEYWORDS` (map keywords in event titles to member IDs so events get auto-assigned).
- If skipping: tell them where to find this later (Phase 6 of `docs/manual-configuration.md`).

### Auto-todo rules

Show the full list of default rules. For each rule, the assignee defaults to either `PRIMARY_USER` or `STAFF_ASSIGNEE` as shown — but if the household has multiple staff members with different responsibilities, offer to let them assign each rule individually.

```
1. [pickup]         Pick up {{schoolChild}} from school          → STAFF_ASSIGNEE  (fires on pickup days — only if Go-Home enabled)
2. [appt]           Accompany {{schoolChild}} to {{appointment}} → STAFF_ASSIGNEE  (fires on school child appointments — only if Go-Home enabled)
3. [meal-plan]      Plan meals for the week                      → PRIMARY_USER    (every Saturday)
4. [meal-shop]      Shop for meal ingredients                    → STAFF_ASSIGNEE  (every Sunday)
5. [budget-review]  Review household budget                      → PRIMARY_USER    (1st of month)
6. [monthly-review] Monthly household review                     → PRIMARY_USER    (first Monday of month)
7. [pay-staff-thu]  Pay monthly staff                            → PRIMARY_USER    (last Thursday of month)
8. [pay-staff-fri]  Pay monthly staff                            → PRIMARY_USER    (last Friday of month)
9. [pack-travel]    Pack bags for {{eventTitle}}                 → PRIMARY_USER    (2 days before any "travel" event)
```

Tell them: "Rules 1–2 only fire if Go-Home is enabled. Rules 7–8 (pay staff) are probably only relevant if you have a household helper. You can always edit or add rules later in `config/family.ts`. Keep all, or remove any?"

If they want to remove some, remove those entries from `AUTO_GEN_RULES`. If they want to add a custom rule, help them define it.

**If the household has more than one staff member** (i.e. multiple members with `todos: true` who are not adults), ask: "You have multiple staff members — would you like to assign specific rules to specific people, or keep the defaults?"

- If yes: go through each rule that currently points to `STAFF_ASSIGNEE` and ask who should handle it, presenting the `todos: true` members as a numbered list
- If no: leave the defaults as-is (`STAFF_ASSIGNEE` for all staff-type rules)

Any rule assignee can be any `TodoAssignee` — the `assignee` field in `AUTO_GEN_RULES` accepts any member with `todos: true`, not just `PRIMARY_USER` or `STAFF_ASSIGNEE`.

---

## PHASE 8 — Write Files & Wrap Up

Now write both files based on everything collected:

1. **`config/family.ts`** — rewrite the full file using the structure from `config/family.example.ts` as a template, substituting all collected values. Keep all comments from the example file intact — they help future editors.

2. **`.env.local`** — write all collected env vars. For any skipped optional vars, include them as blank commented-out lines with the description from `env.example`, so the user knows they exist.

After writing, print a clear summary:

```
✅ Setup complete! Here's what was configured:

  config/family.ts
  - X household members: [names]
  - App name: [name]
  - Timezone: [tz]
  - PRIMARY_USER: [name] · STAFF_ASSIGNEE: [name]
  - Mascot: [custom / Clawdia defaults]
  - Go-Home: [enabled ([child], [N] bus round(s), cutoff [time]) / disabled]
  - ICS sync: [configured / not set up]
  - Auto-todo rules: X active

  .env.local
  - MONGODB_URI: ✅
  - KIOSK_PIN: ✅
  - ANTHROPIC_API_KEY: ✅
  - AUTH_SALT: ✅
  - CRON_SECRET: ✅
  - Cloudinary: [✅ / ⏭️ skipped]
  - Tavily: [✅ / ⏭️ skipped]

⏭️ Skipped for later
  - [list only items that were skipped, one line each with the env var name]
```

Then tell them:

"🎉 **Congratulations — you've completed the hardest part of the setup!** Your household is configured, your API keys are in place, and both files are ready to go. From here it's mostly clicking buttons in Vercel. You're very close to having your kiosk up and running!

**Head back to the README and continue from Step 3** to commit your config, deploy to Vercel, and finish setting up your kiosk."
