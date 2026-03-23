# To-Do Module

## Overview

The To-Do module manages the family's task list. Items can be dated (pinned to a specific day) or general (undated, floating). Items are assigned to household members (configured in `config/family.ts`). A daily cron job auto-generates items from schedule data and recurring household rules, looking 30 days ahead. Auto-generated items can be converted to manual for free editing.

---

## Routes

| Route | Purpose |
|-------|---------|
| `/todo` | Full to-do list — all items grouped by date, with filters and editing |

The panel on the home page dashboard (right column) shows today's and general items inline. A link in the panel header navigates to `/todo`.

Accessible from the **To-Do** item in the top nav (CheckSquare icon).

---

## Data Model

### TodoItem (`lib/models/TodoItem.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `title` | String | Required |
| `date` | String | Optional — `YYYY-MM-DD`. Absent = general/undated item. |
| `assignee` | `TodoAssignee` | Optional — derived from `config/family.ts` members with `todos: true` |
| `done` | Boolean | Default `false` |
| `doneAt` | Date | Set when `done` transitions to `true`; cleared on undo |
| `source` | `manual` \| `agent` \| `auto` | Default `manual` |
| `autoGenKey` | String | Unique sparse key used by auto-gen cron for dedup. Retained (not cleared) when item is converted from `auto` to `manual`, so the cron won't recreate it. |

**Indexes:** `{ date: 1, createdAt: 1 }`, `{ done: 1, doneAt: 1 }`, `{ autoGenKey: 1 }` (unique, sparse)

---

## Types

```typescript
type TodoAssignee = string  // union of IDs from config/family.ts MEMBERS where todos: true
type TodoSource   = 'manual' | 'agent' | 'auto'
```

`TodoAssignee`, `TODO_ASSIGNEES` (array for dropdowns), and `ASSIGNEE_STYLE` (colour tokens) are all derived from `config/family.ts` — the `MEMBERS` array with `todos: true`. `ASSIGNEE_STYLE` is shared between RemindersPanel and TodoList. `AUTO_GEN_RULES` is also defined in `config/family.ts`.

---

## Auto-Generation (`lib/todo-auto-gen.ts`)

The cron calls `generateTodosForDate(dateStr)` which:

1. Fetches schedule events for `dateStr` (expanding recurring events for that day, including multi-day holiday spans for GoHome detection).
2. Computes which auto-items apply.
3. Upserts each item by `autoGenKey` — skips if any record with that key already exists (whether `auto` or converted to `manual`).

### Condition types

Rules are defined in `config/family.ts` (`AUTO_GEN_RULES`). The evaluator in `lib/todo-auto-gen.ts` supports these condition types:

| Condition type | When it fires | Extra fields |
|----------------|---------------|--------------|
| `go_home_pickup` | `computeHomeMethod` returns `'pickup'` (requires `ENABLE_GO_HOME = true`) | — |
| `appointment_for_school_child` | Any appointment event for the school child on that date (requires `ENABLE_GO_HOME = true`) | — |
| `day_of_week` | Specific days of the week | `days: number[]` (0=Sun … 6=Sat) |
| `day_of_month` | Specific days of the month | `days: number[]` (1–31) |
| `nth_weekday_of_month` | Nth occurrence of a weekday in the month | `n: number` (1=first, 2=second, -1=last, -2=second-to-last), `weekday: number` (0=Sun…6=Sat) |
| `days_before_event` | N days before a matching future event | `days: number`, optional `eventType`, optional `participant` |

### Title placeholders

| Placeholder | Available in |
|-------------|-------------|
| `{{schoolChild}}` | All conditions |
| `{{appointmentTitle}}` | `appointment_for_school_child` |
| `{{eventTitle}}` | `days_before_event` |
| `{{eventDate}}` | `days_before_event` |

### AutoGenKey format

| Rule | Key |
|------|-----|
| Pickup | `pickup-YYYY-MM-DD` |
| Appointment | `appt-<mongoId>-YYYY-MM-DD` |
| Day of week / month | `<autoGenKey>-YYYY-MM-DD` |
| Days before event | `<autoGenKey>-<mongoId>-YYYY-MM-DD` |

---

## Converting Auto → Manual

When an auto-generated item needs editing, set `source: 'manual'` via PUT. The `autoGenKey` is intentionally **preserved** — this prevents the cron from recreating the item. Once converted, `title`, `assignee`, and `date` are freely editable.

---

## Cron Job

Defined in `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/todos", "schedule": "0 22 * * *" }]
}
```

`0 22 * * *` UTC = **06:00 HK time** (UTC+8). Generates items for the next 30 days (HK timezone). Already-existing items are skipped via `autoGenKey` dedup, so re-runs are safe.

**Auth:** Vercel automatically sends `Authorization: Bearer <CRON_SECRET>`. Set `CRON_SECRET` in Vercel environment variables.

**Manual trigger (dev/testing):**
```
GET /api/cron/todos?date=YYYY-MM-DD
```

---

## Internal API

### `GET /api/todos`
Returns all TodoItems sorted by date ascending (undated items last), then by `createdAt`.

### `POST /api/todos`
Creates a manual item. Required body: `{ title }`. Optional: `date`, `assignee`.

### `PUT /api/todos/:id`
Updates any fields. Special handling:
- `{ done: true }` → sets `doneAt` to now
- `{ done: false }` → clears `doneAt`
- `{ source: 'manual' }` → converts auto item to manual (keeps `autoGenKey`)

### `DELETE /api/todos/:id`
Deletes the item permanently.

---

## Agent API

All endpoints require `Authorization: Bearer <AGENT_API_KEY>`.

| Action | Method | URL |
|--------|--------|-----|
| List todos for a day + general | GET | `/api/agent/todos?date=YYYY-MM-DD` |
| List all todos | GET | `/api/agent/todos?all=true` |
| List undone todos | GET | `/api/agent/todos` |
| Create a todo | POST | `/api/agent/todos` |
| Update a todo | PUT | `/api/agent/todos?id=ITEM_ID` |
| Delete a todo | DELETE | `/api/agent/todos?id=ITEM_ID` |

Agent-created items have `source: 'agent'`.

Skill prompt available at: `GET /api/agent/skill?module=todos`

---

## UI Components

### RemindersPanel (`components/RemindersPanel/`)

Shown in the 320px right column of the home dashboard.

- **Overdue** section: past-due undone items shown at the top with a red date badge (e.g. "Mar 18")
- **Next 7 days**: one section per day (Today through 6 days ahead); Today always shown (shows "All clear ✓" if empty); future days only shown if they have items
- **General** section: undated items, shown if any exist
- **Completed items stay in-place**: done items remain in their date section with strikethrough, sorted to the bottom of the section
- **Inline title editing**: tap a title (undone items only) to edit in place
- **Inline assignee toggle**: all assignee chips shown on each row; tap to assign/unassign
- **Add form**: inline — title, assignee chips, date picker (defaults to today)
- **Convert button**: auto items show an `⚡ auto` badge; clicking it converts to manual
- **Delete**: always visible at reduced opacity (×)
- Header links to full `/todo` page via ↗ icon

### Schedule strip (`components/Schedule/index.tsx`)

To-do items also appear in the weekly schedule view, below the GoHome strip, grouped by day.

- **Checkbox** (left side of each row): toggles done/undone inline
- **Title + assignee pill** (right side): tap to open an edit bottom sheet
- Edit sheet: title input, assignee selector, Save / Delete / Cancel
- Assignee shown as a coloured name pill — not just a dot

### TodoList (`components/TodoList/`)

Full-page list at `/todo`.

- **Toolbar**: assignee filter chips (All + one per assignee) + Add item button
- **Today** group: always shown (shows "Nothing here ✓" if empty)
- **Upcoming** groups: one section per future date with items
- **General** group: undated items
- **Completed** section: collapsed by default, toggle to expand
- **Inline title editing**: tap a title to edit in place (converts auto → manual implicitly)
- **Assignee toggle**: tap any assignee chip on a row to assign/unassign

---

## Done-Item Visibility

**RemindersPanel (home dashboard):** Completed items stay in-place within their section with strikethrough styling, sorted to the bottom of the section. They remain visible indefinitely until deleted.

**TodoList (`/todo`):** Done items are collected in a collapsible "Completed" section at the bottom, hidden by default.

---

## Adding More Auto-Gen Rules

Add a new entry to `AUTO_GEN_RULES` in `config/family.ts`. The evaluator in `lib/todo-auto-gen.ts` will pick it up automatically. If you need a condition type that doesn't exist yet, add a new branch to `computeAutoItems()` and extend the `AutoGenCondition` union in `config/family.ts`.
