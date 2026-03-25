import { NextRequest, NextResponse } from 'next/server'
import { DISH_CATEGORIES, DISH_TAGS } from '@/lib/types'
import { APP_NAME, FAMILY_DESCRIPTION, PARTICIPANTS, TODO_ASSIGNEES, MEAL_MEMBERS, ENABLE_GO_HOME } from '@/config/family'

function verifyAgent(req: NextRequest): boolean {
  const key = process.env.AGENT_API_KEY
  if (!key) return false
  return req.headers.get('authorization') === `Bearer ${key}`
}

// GET /api/agent/skill?module=meals    — meal planning skill prompt (default)
// GET /api/agent/skill?module=schedule — schedule skill prompt
// GET /api/agent/skill?module=todos    — to-do skill prompt
// GET /api/agent/skill?module=links    — useful links skill prompt
export async function GET(req: NextRequest) {
  if (!verifyAgent(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const module_ = req.nextUrl.searchParams.get('module') ?? 'meals'
  const base    = req.nextUrl.origin

  if (module_ === 'schedule') {
    return new NextResponse(buildScheduleSkill(base), { headers: { 'Content-Type': 'text/plain' } })
  }
  if (module_ === 'todos') {
    return new NextResponse(buildTodosSkill(base), { headers: { 'Content-Type': 'text/plain' } })
  }
  if (module_ === 'links') {
    return new NextResponse(buildLinksSkill(base), { headers: { 'Content-Type': 'text/plain' } })
  }

  return new NextResponse(buildMealsSkill(base), { headers: { 'Content-Type': 'text/plain' } })
}

// ─── Schedule skill ───────────────────────────────────────────────────────────

function buildScheduleSkill(base: string): string {
  return `
## Skill: ${APP_NAME} — Schedule

You are helping manage the household calendar on the ${APP_NAME} home kiosk.

${FAMILY_DESCRIPTION}

Today's date should be inferred from context. When the user says "today", "tomorrow",
"this Monday" etc., resolve to an absolute YYYY-MM-DD date before making API calls.

---

### Workflow A — Summarise a day or period

1. User asks what's on (e.g. "what's on tomorrow?", "what's on this week?").
2. Resolve the date(s) to YYYY-MM-DD.
3. Fetch: GET ${base}/api/agent/schedule?date=YYYY-MM-DD
   Or for a range: GET ${base}/api/agent/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
4. Summarise in natural language. Group by participant if multiple people are involved.
   Mention times, locations, and any notes. If nothing is scheduled, say so clearly.
${ENABLE_GO_HOME ? `5. For any weekday, you can also check how the school child is getting home:
   GET ${base}/api/agent/go-home?date=YYYY-MM-DD
   Returns: method (pickup | bus-3pm | bus-4pm | null), label, and description.
   null means no school that day (weekend or holiday).` : ''}

---

### Workflow B — Add an event

1. User asks to add something to the calendar.
2. Collect the required information:
   - title (what is it?)
   - type — must be one of: class, activity, appointment, travel, school-holiday, public-holiday
   - participants — one or more of: ${PARTICIPANTS.map(p => p.value).join(', ')}
   - start — date (YYYY-MM-DD for all-day) or datetime (YYYY-MM-DDTHH:mm for timed)
   - all_day — true if no specific time
3. Optionally collect: end, location, notes, recurrence (for weekly repeating events).
4. Confirm the details with the user before submitting.
5. POST ${base}/api/agent/schedule
6. Confirm: "Added to the calendar."

---

### Workflow C — Edit an event

1. User asks to change something (e.g. "move the physio appointment to 3pm", "change the location of...").
2. Fetch the day to find the event: GET ${base}/api/agent/schedule?date=YYYY-MM-DD
3. Identify the event from the response. Confirm which event with the user if ambiguous.
4. ⚠️ If the event has a recurring _id (format: <id>_YYYY-MM-DD), warn the user:
   "This is a recurring event — editing it will change the entire series, not just this date."
   Wait for confirmation before proceeding.
5. PUT ${base}/api/agent/schedule?id=EVENT_ID with only the changed fields in the body.
6. Confirm: "Updated."

---

### Workflow D — Remove an event

1. User asks to cancel or remove an event.
2. Fetch the day to find the event: GET ${base}/api/agent/schedule?date=YYYY-MM-DD
3. Identify the event. Confirm with the user before deleting.
4. ⚠️ If the event is recurring (ID contains _YYYY-MM-DD), ask the user which scope:
   - "Just this date" → mode=single
   - "This date and all future occurrences" → mode=following
   - "The entire series" → mode=all
5. Call DELETE with the appropriate mode:
   - DELETE ${base}/api/agent/schedule?id=EVENT_ID&mode=all           (entire series)
   - DELETE ${base}/api/agent/schedule?id=EVENT_ID&mode=single&date=YYYY-MM-DD
   - DELETE ${base}/api/agent/schedule?id=EVENT_ID&mode=following&date=YYYY-MM-DD
   Use the instance date (the YYYY-MM-DD suffix of the recurring ID) as the date param.
6. Confirm: "Removed from the calendar."

---

### API endpoints

All requests require: \`Authorization: Bearer <KIOSK_AGENT_KEY>\`

| Action              | Method | URL |
|---------------------|--------|-----|
| Get events for a day     | GET    | ${base}/api/agent/schedule?date=YYYY-MM-DD |
| Get events for a range   | GET    | ${base}/api/agent/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD |
| Create an event          | POST   | ${base}/api/agent/schedule |
| Update an event          | PUT    | ${base}/api/agent/schedule?id=EVENT_ID |
| Delete (entire series)   | DELETE | ${base}/api/agent/schedule?id=EVENT_ID&mode=all |
| Delete (one instance)    | DELETE | ${base}/api/agent/schedule?id=EVENT_ID&mode=single&date=YYYY-MM-DD |
| Delete (this + following)| DELETE | ${base}/api/agent/schedule?id=EVENT_ID&mode=following&date=YYYY-MM-DD |
${ENABLE_GO_HOME ? `| Get school child home method | GET    | ${base}/api/agent/go-home?date=YYYY-MM-DD |` : ''}

---

### Event fields

**Required for POST:** \`title\`, \`type\`, \`start\`, \`all_day\`

**Optional:** \`end\`, \`participants\`, \`location\`, \`notes\`, \`recurrence\`

**Dates:**
- All-day event: \`start\` = "YYYY-MM-DD", \`all_day\` = true
- Timed event:   \`start\` = "YYYY-MM-DDTHH:mm", \`all_day\` = false
- Multi-day:     \`start\` and \`end\` both as "YYYY-MM-DD", \`all_day\` = true

**Recurrence (weekly only):**
\`\`\`json
{ "frequency": "weekly", "days": [1, 3], "until": "YYYY-MM-DD" }
\`\`\`
days: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

---

### Types and participants

Types: \`class\`, \`activity\`, \`appointment\`, \`travel\`, \`school-holiday\`, \`public-holiday\`
Participants: ${PARTICIPANTS.map(p => `\`${p.value}\``).join(', ')}

---

${ENABLE_GO_HOME ? `### Go-home response fields

\`\`\`json
{ "date": "2026-03-18", "method": "bus-4pm", "label": "School bus (4pm)", "description": "School bus (4pm)" }
\`\`\`

- \`method\`: \`pickup\` | \`bus-3pm\` | \`bus-4pm\` | \`null\`
- \`null\` means no school that day (weekend or holiday) — no chip is shown on the dashboard

---

` : ''}### Flight events (read-only)

Travel events with \`source: "ics-feed"\` are auto-synced daily from an external flight booking calendar. Do **not** edit or delete these — changes will be overwritten on the next sync. You can read and summarise them like any other event.

---

### Rules

- Always resolve relative dates ("tomorrow", "next Monday") to YYYY-MM-DD before API calls
- Always confirm additions and deletions with the user before submitting
- Always warn before editing a recurring event via PUT (it changes the whole series — there is no per-instance edit)
- Always ask scope (single / following / all) before deleting a recurring event
- For PUT, only include the fields that are changing in the request body
- Recurring event IDs from GET responses look like: 6abc123_2026-03-17 — use the full ID for PUT/DELETE
- Never edit or delete events where \`source === "ics-feed"\`
`.trim()
}

// ─── Todos skill ──────────────────────────────────────────────────────────────

function buildTodosSkill(base: string): string {
  return `
## Skill: ${APP_NAME} — To-Do List

You are helping manage the household to-do list on the ${APP_NAME} home kiosk.

${FAMILY_DESCRIPTION}

Assignees: ${TODO_ASSIGNEES.map(a => `\`${a.value}\``).join(', ')}

Items can be dated (specific day) or general (undated, floating).
Auto-generated items (source: 'auto') are created by the system based on schedule and meal data.
They can be converted to manual by updating \`source\` to \`'manual'\`.

---

### Workflow A — List to-dos

1. User asks what's on the to-do list (for a day, or generally).
2. Resolve any relative date to YYYY-MM-DD.
3. Fetch:
   - Specific day + general: GET ${base}/api/agent/todos?date=YYYY-MM-DD
   - Everything:             GET ${base}/api/agent/todos?all=true
4. Summarise. Group by assignee if helpful. Mention done/undone status.

---

### Workflow B — Add a to-do

1. Collect: title (required), assignee (${TODO_ASSIGNEES.map(a => a.value).join('/')}, optional), date (YYYY-MM-DD, optional).
2. Confirm the details before submitting.
3. POST ${base}/api/agent/todos
4. Confirm: "Added to the to-do list."

---

### Workflow C — Mark done or update

1. Fetch the list to identify the item: GET ${base}/api/agent/todos?date=YYYY-MM-DD
2. Identify the item by title. Confirm with user if ambiguous.
3. PUT ${base}/api/agent/todos?id=ITEM_ID
   - To mark done:   \`{ "done": true }\`
   - To mark undone: \`{ "done": false }\`
   - To edit title:  \`{ "title": "new title" }\`
   - To change date: \`{ "date": "YYYY-MM-DD" }\` or \`{ "date": null }\` for general
   - To convert auto → manual: \`{ "source": "manual" }\` (allows free editing)
4. Confirm the change.

---

### Workflow D — Remove a to-do

1. Identify the item (fetch first if needed).
2. Confirm with the user before deleting.
3. DELETE ${base}/api/agent/todos?id=ITEM_ID
4. Confirm: "Removed."

---

### API endpoints

All requests require: \`Authorization: Bearer <KIOSK_AGENT_KEY>\`

| Action                       | Method | URL |
|------------------------------|--------|-----|
| List todos (day + general)   | GET    | ${base}/api/agent/todos?date=YYYY-MM-DD |
| List all todos               | GET    | ${base}/api/agent/todos?all=true |
| Create a todo                | POST   | ${base}/api/agent/todos |
| Update a todo                | PUT    | ${base}/api/agent/todos?id=ITEM_ID |
| Delete a todo                | DELETE | ${base}/api/agent/todos?id=ITEM_ID |

---

### Rules

- Always resolve relative dates to YYYY-MM-DD before API calls
- Always confirm additions and deletions with the user first
- Auto-generated items (source: 'auto') should not be edited directly — convert to manual first
- A null or missing \`date\` means the item is general/undated (not tied to a specific day)
`.trim()
}

// ─── Meals skill ──────────────────────────────────────────────────────────────

function buildMealsSkill(base: string): string {
  const categories = DISH_CATEGORIES.map((c) => c.value).join(', ')
  const tags = DISH_TAGS.join(', ')

  return `
## Skill: ${APP_NAME} — Meal Planner

You are helping manage the household meal database and weekly meal plan on the ${APP_NAME} home kiosk.

${FAMILY_DESCRIPTION}

---

### Workflow A — Add a specific dish

1. User names a dish or shares a URL.
2. Use your web tools to look up the recipe (ingredients, recipe/method, URL for a nice photo, Chinese name if applicable).
3. Fetch existing dishes to check for duplicates: GET ${base}/api/agent/dishes
4. Map the dish to the taxonomy below.
5. Tell the user what you're about to submit. If anything is unclear, ask before sending.
6. Submit the dish (see API section below).
7. Confirm: "Added — it's pending your review in the app."

---

### Workflow B — Generate dish ideas by theme

1. User asks for ideas (e.g. "quick Japanese dinners", "vegetable sides for this week").
2. Fetch existing dishes to avoid duplicates: GET ${base}/api/agent/dishes
3. Propose a numbered list with a one-line description for each. Wait for confirmation.
4. On confirmation, research and submit each approved dish one by one as per Workflow A.
5. Report a summary: "Submitted X dishes — all pending your review in the app."

---

### Workflow C — Summarise the meal plan for a day

1. User asks what's planned (e.g. "what's for dinner tonight?", "what's on tomorrow?").
2. Resolve the date to YYYY-MM-DD.
3. Fetch: GET ${base}/api/agent/mealplan?date=YYYY-MM-DD
4. Summarise in plain language. Example:
   "Tomorrow: Charlie has congee and a boiled egg for breakfast, noodle soup for lunch, and steamed fish for dinner. Alice and Bob have the same dinner plus stir-fried broccoli."
5. If a slot is empty, mention it: "Nothing planned for snack yet."

---

### Workflow D — Add a dish to the meal plan

1. User asks to put a dish on the plan (e.g. "add chicken stir-fry to Tuesday's dinner", "plan congee for breakfast tomorrow").
2. Resolve the date to YYYY-MM-DD.
3. Confirm the slot: breakfast / lunch / snack / dinner.
4. Find the dish in the library: GET ${base}/api/agent/dishes
   - Match by name. If the dish isn't found, offer to add it to the library first (Workflow A) — it must be approved in the app before it can be planned.
   - If the dish is found but still pending, tell the user it needs approval in the app first.
5. Confirm who's eating (eaters). Use member IDs: ${MEAL_MEMBERS.map(m => m.id).join(', ')}. Ask if unclear.
6. Confirm the full details with the user before submitting:
   "[Dish name] · [Slot] · [Date] · For: [eaters]"
7. POST ${base}/api/agent/mealplan with body:
   \`{ "dish_id": "<id>", "date": "YYYY-MM-DD", "slot": "dinner", "eaters": ["alice", "bob"] }\`
8. Confirm: "Added to the meal plan."

---

### API endpoints

All requests require: \`Authorization: Bearer <KIOSK_AGENT_KEY>\`

| Action               | Method | URL |
|----------------------|--------|-----|
| List existing dishes | GET    | ${base}/api/agent/dishes |
| Submit a dish        | POST   | ${base}/api/agent/dishes |
| Get meal plan        | GET    | ${base}/api/agent/mealplan?date=YYYY-MM-DD |
| Add dish to plan     | POST   | ${base}/api/agent/mealplan |

### Dish fields (POST /api/agent/dishes body)

Required: \`name\`, \`category\`
Optional: \`name_zh\`, \`tags\`, \`notes\`, \`typically_served\`, \`recipe\`, \`ingredients\`, \`reference_url\`, \`favorites\`

\`favorites\` is an array of member IDs who like this dish: e.g. \`["alice", "bob", "child1"]\`. Omit to default to all members. Pass a subset if the dish is only liked by specific people (e.g. a kids-only dish: \`["child1"]\`).

### Meal plan entry fields (POST /api/agent/mealplan body)

Required: \`dish_id\`, \`date\` (YYYY-MM-DD), \`slot\` (breakfast / lunch / snack / dinner)
Optional: \`eaters\` (array of member IDs: ${MEAL_MEMBERS.map(m => m.id).join(', ')} — defaults to [])

\`typically_served\` is an array of meal slots: \`breakfast\`, \`lunch\`, \`snack\`, \`dinner\`
\`recipe\` is a plain-text string of numbered cooking steps — always populate this when submitting a dish
\`ingredients\` is an array of \`{ name, quantity, unit }\`

### Taxonomy (use exactly these values)

Categories: ${categories}
Tags: ${tags}

### Rules

- \`category\` is an array — a dish can belong to multiple categories
- Use taxonomy values exactly — do not invent new categories or tags
- Always check for duplicates before submitting
- All submissions are **pending** until approved in the app — always tell the user this
- For bulk submissions (Workflow B), always confirm the list with the user before sending
`.trim()
}

// ─── Links skill ──────────────────────────────────────────────────────────────

function buildLinksSkill(base: string): string {
  return `
## Skill: ${APP_NAME} — Links

You are helping manage the household's curated list of useful links on the ${APP_NAME} home kiosk.
Links are grouped into three categories: school & activities, food shopping, and others.

---

### Workflow A — List links

1. User asks to see links (e.g. "what food shopping sites do we have?", "show me the kids' school links").
2. Optionally resolve a category: kids / food / other.
3. Fetch: GET ${base}/api/agent/links  OR  GET ${base}/api/agent/links?category=kids|food|other
4. Summarise in natural language, grouped by category. Include the URL and notes for each.


---

### Workflow B — Add a link

1. User asks to add a link (e.g. "add City Super to food shopping").
2. Collect: title (required), url (required), category (required), notes (optional).
3. Confirm the details with the user before submitting.
4. POST ${base}/api/agent/links
5. Confirm: "Added to the Links page."

---

### Workflow C — Update a link

1. Fetch the list to find the link: GET ${base}/api/agent/links
2. Identify it by title. Confirm with user if ambiguous.
3. PUT ${base}/api/agent/links?id=LINK_ID  with only the changed fields.
4. Confirm: "Updated."

---

### Workflow D — Remove a link

1. Fetch the list to find the link.
2. Confirm with the user before deleting.
3. DELETE ${base}/api/agent/links?id=LINK_ID
4. Confirm: "Removed."

---

### API endpoints

All requests require: \`Authorization: Bearer <KIOSK_AGENT_KEY>\`

| Action            | Method | URL |
|-------------------|--------|-----|
| List all links    | GET    | ${base}/api/agent/links |
| List by category  | GET    | ${base}/api/agent/links?category=kids|food|other |
| Create a link     | POST   | ${base}/api/agent/links |
| Update a link     | PUT    | ${base}/api/agent/links?id=LINK_ID |
| Delete a link     | DELETE | ${base}/api/agent/links?id=LINK_ID |

---

### Link fields

**Required for POST:** \`title\`, \`url\`, \`category\`
**Optional:** \`notes\` (description shown below the title), \`order\` (sort position within category)

### Categories

| Value | Label |
|-------|-------|
| \`kids\`  | School & Activities |
| \`food\`  | Food Shopping |
| \`other\` | Others |

---

### Rules

- Always confirm additions and deletions with the user before submitting
- \`url\` must include the protocol (https://)
- For PUT, only include fields that are changing
`.trim()
}
