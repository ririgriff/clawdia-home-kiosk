# Manual Configuration Guide

This guide walks through every configurable aspect of Clawdia without using Claude Code. If you prefer the AI-assisted route, run `/clawdiainit` in Claude Code instead — it will provide a guided version of this interactively.

There are two files to edit:

1. **`config/family.ts`** — household members, app branding, auto-todo rules, meal shortcuts, and all household-specific logic
2. **`.env.local`** — API keys, secrets, and external service credentials

Both files are well-commented with inline documentation. This guide provides additional context for each section.

---

## 1. App name and mascot

The app name appears in the nav bar, PIN screen, browser tab, and AI Chat greeting. The mascot is a small character image displayed alongside the name.

You need two image files placed in the `public/` folder:
- **Nav bar mascot** (`MASCOT_FACE`) — ideally square, displayed at 36×36px
- **PIN screen mascot** (`MASCOT_FULL`) — ideally square, displayed at 160×160px

**In \****`config/family.ts`**\*\*:**
```ts
export const APP_NAME = "Your App Name";
export const MASCOT_FACE = "/your-mascot-face.png";
export const MASCOT_FULL = "/your-mascot-full.png";
```

### Updating favicons to match your mascot

After changing `MASCOT_FULL`, regenerate the three favicon files so the browser tab icon matches. The default Clawdia favicons are preserved so you can always revert.

**Step 1 — back up the default app icon** (one-time, skip if `app/icon.default.png` already exists):
```bash
cp app/icon.png app/icon.default.png
```

**Step 2 — generate favicons from your full image:**
```bash
cp public/your-mascot-full.png public/favicon.png
sips --resampleHeightWidth 32 32 public/your-mascot-full.png --out public/favicon-32.png
sips --resampleHeightWidth 32 32 public/your-mascot-full.png --out app/icon.png
```

> `sips` is built into macOS. On Linux, use `convert` from ImageMagick: `convert public/your-mascot-full.png -resize 32x32 public/favicon-32.png`

**To revert to Clawdia defaults:**
```bash
cp app/icon.default.png app/icon.png
cp public/clawdia-full.png public/favicon.png
sips --resampleHeightWidth 32 32 public/clawdia-full.png --out public/favicon-32.png
```
Then set `MASCOT_FACE = "/clawdia-face.png"` and `MASCOT_FULL = "/clawdia-full.png"` in `config/family.ts`.

---

## 2. Household members

Each person has a short **ID** (like `"alice"`) that gets stored in the database. **Choose these carefully** — changing them after you have data requires a database migration (see [Renaming members](#renaming-members-or-categories-after-you-have-data) at the end of this guide).

Each member has flags controlling which parts of the app they appear in:

| Flag | What it does |
| --- | --- |
| `calendar: true` | Appears as a participant in schedule events |
| `todos: true` | Can be assigned to-do items |
| `mealPicker: true` | Appears in the meal eaters picker |
| `schoolChild: true` | Designates this person as the school child. Enables the optional [Go-Home banner](#5-go-home-feature-optional-one-child-only) (Section 5) and pickup auto-reminders (Section 6). Only one member should have this. |

**In \****`config/family.ts`**\*\*:**
```ts
const MEMBERS = [
  {
    id: "alice",
    name: "Alice",
    initials: "A",
    calendar: true,
    todos: true,
    mealPicker: true,
    schoolChild: false,
    color: "#8b5cf6",     // any hex colour
  },
  // ... add more members
] as const;
```

---

## 3. AI Chat family context

The AI Chat assistant needs a short description of your household to give personalised responses. Without it, the AI can't refer to people by name or understand their roles.

**In \****`config/family.ts`**\*\*:**
```ts
export const FAMILY_DESCRIPTION = `\
- **Alice** — mum, primary user
- **Bob** — dad
- **Charlie** — child (school-age)
- **Helper** — household helper`;
```

---

## 4. Role assignment for auto-todos

Two roles control who gets assigned automatically generated recurring tasks:

- **`PRIMARY_USER`** — the main household manager. Gets assigned planning tasks like "Plan meals for the week."
- **`STAFF_ASSIGNEE`** — a helper or operational person. Gets assigned tasks like "Pick up child from school" and "Shop for ingredients."

Both must be IDs of members with `todos: true`.

**In \****`config/family.ts`**\*\*:**
```ts
export const PRIMARY_USER: TodoAssignee = "alice";
export const STAFF_ASSIGNEE: TodoAssignee = "helper";
```

---

## 5. Go-Home feature (optional, one child only)

> **Note:** This feature is fairly opinionated and was built for a specific household & school bus setup. It currently only supports **one school child**. If it doesn't fit your situation, leave it turned off — that's the default, and nothing else in the app depends on it.  The situation it is designed for is:  school has 3pm school bus and a late bus at 4pm for kids that stay on for afterschool activities.  Any activities that end after 4pm, child will have to be picked up.  Moreover, the parent registers a default pickup arrangement with school and any deviations from that will require the parent to inform the school in advance.  

The Go-Home feature shows a banner on the home dashboard and weekly calendar indicating how the school child is getting home that day. It reads the child's calendar events and works through this checklist:

1. Weekend → no banner
2. School or public holiday → no banner
3. Child has an appointment event → **Pickup**
4. Child's last event ends after `GO_HOME_PICKUP_AFTER` (default: 16:10) → **Pickup** *(too late for any bus)*
5. Child's last event ends after `GO_HOME_BUS_LATE_AFTER` (default: 15:10) → **Bus 4pm** *(too late for the 3pm bus)*
6. Otherwise → the weekday default you've configured

**In \****`config/family.ts`**\*\*:**
```ts
export const ENABLE_GO_HOME = false;   // set to true to enable

// If school ends after this time, it's too late for any bus — someone must pick up:
export const GO_HOME_PICKUP_AFTER = "16:10";
// If school ends after this time, the 3pm bus is missed — take the 4pm bus instead:
export const GO_HOME_BUS_LATE_AFTER = "15:10";

// Default home method per weekday (1=Mon … 5=Fri):
export const FALLBACK_HOME_DEFAULTS: Record<number, HomeMethod> = {
  1: "pickup",   // Monday
  2: "bus-3pm",  // Tuesday
  3: "pickup",   // Wednesday
  4: "bus-3pm",  // Thursday
  5: "bus-3pm",  // Friday
};

// School name and portal URL to be used for informing school of adhoc changes from default arrangement (shown on the settings page):
export const SCHOOL_NAME = "School";
export const SCHOOL_PORTAL_URL = "https://yourschool.edu";
```

Weekday defaults can also be changed any time through the app at `/settings/go-home` — no code change needed.

---

## 6. Automatic to-do reminders

The app generates to-do items automatically every morning at 6am by looking at your calendar for the next 30 days and applying rules you define. Each rule says: *when [condition], create a to-do called [title] and assign it to [person].*

A **dedup key** (`autoGenKey`) prevents the same to-do from being created twice. Choose something short and unique per rule.

> **About the Regenerate button:** On the `/todo` page, tapping **Regenerate** triggers the same logic immediately — useful after adding new calendar events. It will only create *new* to-dos for conditions that don't already have one. To-dos you've manually edited or checked off will never be overwritten by auto-generation.

### The six condition types

| Condition | Example |
| --- | --- |
| **Every week on a specific day** | Every Saturday → "Plan meals for the week" |
| **Every month on a specific date** | 1st of the month → "Review household budget" |
| **Nth weekday of the month** | Last Thursday → "Pay staff" |
| **N days before an event** | 2 days before travel → "Pack bags for {{eventTitle}}" |
| **When go-home is pickup** | Pickup day → "Pick up child from school" |
| **When school child has appointment** | Appointment → "Accompany child to {{appointmentTitle}}" |

Available placeholders: `{{schoolChild}}`, `{{appointmentTitle}}`, `{{eventTitle}}`, `{{eventDate}}`

**In \****`config/family.ts`***\* — edit the \****`AUTO_GEN_RULES`**\*\* array:**
```ts
export const AUTO_GEN_RULES: AutoGenRule[] = [
  {
    condition: { type: "day_of_week", days: [6] },   // 6 = Saturday
    title: "Plan meals for the week",
    assignee: PRIMARY_USER,
    autoGenKey: "meal-plan",
  },
  {
    condition: { type: "days_before_event", days: 2, eventType: "travel" },
    title: "Pack bags for {{eventTitle}}",
    assignee: PRIMARY_USER,
    autoGenKey: "pack-travel",
  },
  // ... add more rules
];
```

---

## 7. Meal shortcuts

The meal planner has quick-select buttons for picking who's eating — like "Adults", "Kids", "Everyone". You can rename these or change which people they include.

**In \****`config/family.ts`**\*\*:**
```ts
export const MEAL_SHORTCUTS: { label: string; members: string[] }[] = [
  { label: "Adults", members: ["alice", "bob"] },
  { label: "Kids",   members: ["child1"] },
  { label: "Everyone", members: ["alice", "bob", "child1"] },
];
```

---

## 8. Calendar integration

### Importing an external calendar (ICS)

You can connect any external calendar that provides an ICS URL — Google Calendar, Apple Calendar, school calendars, flight booking feeds, etc. A cron job syncs it every day at 10am.

**This is read-only on the kiosk's side** — events from the external feed appear in your schedule but can't be edited or deleted through the app. To change them, update the source calendar.

Set `ICS_FEED_URL` in `.env.local`, then optionally configure participant auto-detection:

**In \****`config/family.ts`**\*\*:**
```ts
export const ICS_PARTICIPANT_KEYWORDS = [
  { keywords: ["alice"], participant: "alice" as Participant },
  { keywords: ["charlie", "child1"], participant: "child1" as Participant },
];
```

### Exporting your kiosk calendar

You can subscribe to your kiosk calendar from any external calendar app. **This is read-only on the subscriber's side.**

Set `ICAL_SECRET` in `.env.local`, then subscribe to:

```
https://your-app.vercel.app/api/ical?token=YOUR_ICAL_SECRET
```

Optional filters: `&participant=alice` or `&type=appointment,travel`.

---

## 9. Link categories

The `/links` page organises saved links into categories. The default categories are `kids` (School & Activities), `food` (Food Shopping), and `other`. You can rename these or add new ones.

**In \****`lib/types.ts`**\*\*:**
```ts
export const LINK_CATEGORIES = [
  { slug: "school",   label: "School & Activities" },
  { slug: "shopping", label: "Shopping" },
  { slug: "other",    label: "Everything Else" },
] as const;
```

> If you already have links saved under old category slugs, you'll need to migrate them. Ask Claude Code: *"Write a migration script to rename the link category 'kids' to 'school' in MongoDB."*

---

## 10. Environment variables

Copy `env.example` to `.env.local` and fill in your values. For Vercel, add them under Project Settings → Environment Variables.

### Required — the app won't start without these

| Variable | What it is | How to get it |
| --- | --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string | [cloud.mongodb.com](https://cloud.mongodb.com) → your cluster → Connect → Drivers → copy the string. Free (M0 cluster). **Important:** under Network Access, allow `0.0.0.0/0` so Vercel's dynamic IPs can connect. |
| `KIOSK_PIN` | The PIN your household uses to unlock the kiosk | Choose any 6-digit number |
| `AUTH_SALT` | A random secret that secures the login cookie | Run `openssl rand -hex 32` in your terminal (or just make up any string) |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI Chat | [console.anthropic.com](https://console.anthropic.com) → API Keys. Pay-per-use (~$2–5/month typical usage). |

### Required for scheduled tasks

| Variable | What it is | How to get it |
| --- | --- | --- |
| `CRON_SECRET` | Protects the scheduled task endpoints | Run `openssl rand -hex 32` in your terminal (or just make up any string) — Vercel sends this automatically with cron requests |

### Optional — but highly recommended

| Variable | What it enables | How to get it | Without it |
| --- | --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | **Dish photo uploads** | [cloudinary.com](https://cloudinary.com) → Settings → API Keys. Free (25 credits/month). | Upload button won't work; existing photos still show |
| `CLOUDINARY_API_KEY` | Same | Same | Same |
| `CLOUDINARY_API_SECRET` | Same | Same | Same |
| `TAVILY_API_KEY` | **Automatic recipe lookup when adding dishes** | [tavily.com](https://tavily.com) → API Keys. Free (1,000 searches/month). | Recipe web search returns no results; you can still add dishes manually |
| `ICAL_SECRET` | Lets external apps subscribe to your kiosk calendar | Run `openssl rand -hex 32` in your terminal (or just make up any string) | Calendar export endpoint returns 401 |

### To set up later

These are only needed when you're ready to set up specific integrations — you can leave them out for now.

| Variable | What it enables | How to get it |
| --- | --- | --- |
| `ICS_FEED_URL` | Daily sync from an external calendar | Your calendar provider (Google Calendar → Settings → "Secret address in iCal format"; Apple Calendar → right-click calendar → Share) |
| `AGENT_API_KEY` | Enables the external agent (OpenClaw / WhatsApp) integration | Run `openssl rand -hex 32` in your terminal (or just make up any string) — set the same value as `KIOSK_AGENT_KEY` on the agent machine |

> **Cloudinary** is worth setting up even before you add any dishes — it takes 2 minutes and the meal planner is significantly nicer with photos.

---

You're done with configuration. Return to **Step 3** in the README to deploy to Vercel.

---

## Special Note:  Renaming members or categories after you have data

If you've been using the app and want to rename a member's ID (e.g. change `"charlie"` to `"mia"`), you must also update all existing database documents that reference the old ID. The same applies to link and dish category slugs.

| Collection | Field to update |
| --- | --- |
| `mealplans` | `eaters` array |
| `todoitems` | `assignee` |
| `scheduleevents` | `participants` array |
| `links` | `category` |
| `dishes` | `category` |

Ask Claude Code: *"Write a migration script to rename the member ID 'charlie' to 'mia' across all collections in MongoDB."*

Always back up your database before running migrations.
