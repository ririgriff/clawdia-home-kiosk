# Schedule Module

## Overview

The Schedule module tracks the family's school terms, holidays, classes, activities, appointments, and travel. It supports all-day and timed events, multi-day spans, and weekly recurring events. Events are colour-coded by type. Three calendar views are available: Week, Month, and Year.

---

## Route

| Route | Purpose |
| --- | --- |
| `/schedule` | Schedule — week / month / year views, add/edit events |

Accessible from the **Schedule** item in the top nav.

---

## Data Model

### ScheduleEvent (`lib/models/ScheduleEvent.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| `title` | String | Required |
| `type` | EventType | See event types below |
| `participants` | Participant[] | Member IDs (e.g. `alice`, `bob`, `child1`) plus the special value `family` — type and `PARTICIPANTS` array derived from `config/family.ts` |
| `start` | String | `YYYY-MM-DD` (all-day) or `YYYY-MM-DDTHH:mm` (timed) |
| `end` | String | Optional — same format as `start`. Multi-day events use `YYYY-MM-DD` end. |
| `all_day` | Boolean | Default `true` |
| `recurrence` | Object | Optional — weekly only (see below) |
| `exceptions` | String[] | Dates (`YYYY-MM-DD`) to skip for recurring events ("this event only" deletions) |
| `location` | String | Optional — non-travel events |
| `travel_type` | `work` \ | `family` | Travel events only |
| `origin` | String | Travel events only |
| `destination` | String | Travel events only |
| `notes` | String | Optional |
| `source` | `manual` \ | `import` | Default `manual` |

**Recurrence object:**

| Field | Type | Notes |
| --- | --- | --- |
| `frequency` | `weekly` | Only supported frequency |
| `days` | Number[] | Days of week: 0=Sun, 1=Mon, … 6=Sat |
| `until` | String | `YYYY-MM-DD` — last date of recurrence |

**Indexes:** `{ start: 1 }`, `{ type: 1 }`

---

## Event Types

Defined in `lib/schedule-types.ts`.

| Value | Label | Colour |
| --- | --- | --- |
| `school-holiday` | School Holiday | Purple |
| `public-holiday` | Public Holiday | Red/pink |
| `class` | Class | Blue |
| `activity` | Activity | Teal |
| `travel` | Travel | Amber |
| `appointment` | Appointment | Pink |

All colour definitions live in `EVENT_TYPE_COLORS` — used by `EventChip` and the Year view dots.

---

## Participants

Derived from `config/family.ts` — members with `calendar: true`, plus group aliases in `CALENDAR_GROUPS`.

Derived from `config/family.ts` at runtime — the values below reflect `config/family.example.ts` defaults and will differ in your private instance.

| Value | Label |
| --- | --- |
| `alice` | Alice |
| `bob` | Bob |
| `child1` | Charlie |
| `pet` | Pet |
| `family` | Family |

---

## API Endpoints

All routes use PIN cookie auth (standard app auth).

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD` | Fetch events in window — recurring events are expanded server-side |
| POST | `/api/schedule` | Create an event |
| GET | `/api/schedule/[id]` | Fetch a single event by ID |
| PUT | `/api/schedule/[id]` | Update an event (uses `$set`) |
| DELETE | `/api/schedule/[id]` | Delete an event |

### Recurring event expansion

The GET route expands recurring events into virtual instances server-side:
- Queries the DB for events where `start <= to` and (`end >= from` OR `end` is missing)
- For each recurring event, walks day-by-day between `max(eventStart, from)` and `min(recurrence.until, to)`
- Checks `recurrence.days.includes(dayOfWeek)` for each day
- Skips dates in the event's `exceptions` array
- Returns virtual instances with synthetic `_id = ${realId}_${dateStr}`

When editing or deleting a recurring instance, the real `_id` is extracted by splitting on `_` before the date suffix.

### Recurring event deletion (3 modes)

Handled by the ScheduleSummary component and available on the full Schedule page (edit modal has a Delete button):

| Mode | API call | Effect |
| --- | --- | --- |
| This event only | `PUT /api/schedule/[baseId]` with `{ exceptions: [..., date] }` | Adds date to exceptions array; that instance is skipped on next expand |
| This and all following | `PUT /api/schedule/[baseId]` with `{ 'recurrence.until': dayBefore }` | Shortens recurrence end date |
| Entire series | `DELETE /api/schedule/[baseId]` | Deletes the master event document |

**Important:** All dates are stored and compared as ISO strings (`YYYY-MM-DD`). Lexicographic comparison is safe for date ordering. Time parsing uses `new Date(dateStr + 'T12:00:00')` to avoid midnight timezone rollover.

---

## Key Components

| File | Purpose |
| --- | --- |
| `components/Schedule/index.tsx` | Main view — week/month/year switcher, navigation, data fetch, event layout |
| `components/Schedule/EventChip.tsx` | Colour-coded event pill — title, participants, location |
| `components/Schedule/AddEventModal.tsx` | Add / edit event form |
| `app/schedule/page.tsx` | Page wrapper — includes NavBar |
| `lib/schedule-types.ts` | Types, constants, colour definitions |
| `lib/models/ScheduleEvent.ts` | Mongoose model |

---

## Views

### Week view
- Mon–Sun 7-column grid
- Sticky day headers with today highlighted in ember orange
- All-day strip at the top for all-day and multi-day events
- Time grid 06:00–22:00 (`HOUR_PX = 64` per hour)
- Timed events positioned absolutely by start time and duration
- Click empty time slot to open Add modal pre-filled with that date/time
- Scrolled to 08:00 on mount

### Month view
- 7-column grid (Mon–Sun), rows sized equally to fill available height
- Days outside the current month shown at 35% opacity
- Up to 3 event chips per cell; overflow shown as "+N more"
- Today's date highlighted with ember circle
- Click a day cell to add an event for that day
- Click an event chip to edit it

### Year view
- 12 mini-calendars in a responsive grid (`auto-fill, minmax(200px, 1fr)`)
- Each day shows coloured dots for event types present (up to 3 dots, one per unique type)
- Click a day to jump to week view for that week
- Click a month name to jump to month view for that month

---

## AddEventModal

Form fields adapt by event type:

| Field | All types | Travel only | Class / Activity / Appointment |
| --- | --- | --- | --- |
| Title | ✓ | ✓ | ✓ |
| Type | ✓ | ✓ | ✓ |
| Participants | ✓ | ✓ | ✓ |
| All-day toggle | ✓ | ✓ | ✓ |
| Start / end date | ✓ | ✓ (labelled Departure / Return) | ✓ |
| Start / end time | ✓ (when not all-day) | ✓ | ✓ |
| Location | ✓ | — | ✓ |
| Travel type (work/family) | — | ✓ | — |
| Origin / Destination | — | ✓ | — |
| Recurring toggle + days + until | — | — | ✓ |
| Notes | ✓ | ✓ | ✓ |

Delete button is shown when editing an existing event. For recurring events, pressing Delete shows a 3-choice dialog (same options as the home dashboard overlay): this event only / this and all following / entire series.

---

## Home Dashboard — Schedule Summary

`components/ScheduleSummary/index.tsx` renders today and tomorrow's events in the home dashboard.

- **`+`**** button** — right-aligned on each day column header; links to `/schedule?add=YYYY-MM-DD` which auto-opens the Add modal pre-filled with that date.
- **Tappable events** — tap any event row to show a dark overlay with Edit and Remove buttons.
  - Edit → navigates to `/schedule?edit=<baseId>`, auto-opens the edit modal.
  - Remove on a non-recurring event → deletes immediately.
  - Remove on a recurring event → shows the 3-choice delete dialog (see below).
- **Deep-links** — `ScheduleView` reads `?add=` and `?edit=` from the URL on mount (cleared immediately with `router.replace`). The page is wrapped in `Suspense` to support `useSearchParams`.

---

## Agent API

All routes require `Authorization: Bearer <AGENT_API_KEY>`.

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/agent/schedule?date=YYYY-MM-DD` | Events for a single day |
| GET | `/api/agent/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD` | Events for a date range |
| POST | `/api/agent/schedule` | Create an event |
| PUT | `/api/agent/schedule?id=EVENT_ID` | Update an event (entire series if recurring) |
| DELETE | `/api/agent/schedule?id=EVENT_ID&mode=all` | Delete entire series |
| DELETE | `/api/agent/schedule?id=EVENT_ID&mode=single&date=YYYY-MM-DD` | Skip one instance (adds to exceptions[]) |
| DELETE | `/api/agent/schedule?id=EVENT_ID&mode=following&date=YYYY-MM-DD` | Truncate series from date onwards |

GET responses expand recurring events into instances with synthetic IDs (`<mongoId>_YYYY-MM-DD`). `exceptions[]` is respected — deleted-by-exception instances are not returned.

Skill prompt is served at `GET /api/agent/skill?module=schedule`. The agent is instructed to ask the user which delete scope applies before calling DELETE on a recurring event.

---

## School Calendar Data

School holidays and public holidays are entered as all-day events with type `school-holiday` or `public-holiday` on the calendar. They can be added manually via the `/schedule` UI or seeded in bulk via a script.

To seed your school's calendar:
1. Get your school's academic calendar (usually a PDF or ICS from the school portal)
2. Create a seed script modelled on the pattern in `scripts/seed-tts-calendar.js` (in your private repo), with your school's dates and `participants: [SCHOOL_CHILD_ID]`
3. Run it once against your database: `node scripts/your-seed-script.js`

Alternatively, if your school publishes an ICS calendar feed, configure `ICS_FEED_URL` to sync it automatically. The ICS sync cron runs daily at `0 2 * * *` UTC (10:00 HK time).

---

#### Academic Year 2025–2026

**Term 1 (Aug–Dec 2025)**
| Date | Event | Type |
| --- | --- | --- |
| 4–5 Aug | New Staff Induction (school closed) | school-holiday |
| 6–7 Aug | Staff Training (school closed) | school-holiday |
| 8 Aug | Orientation Day | school-holiday |
| 9 Aug | National Day | public-holiday |
| 11 Aug | Start of Term 1 | — (term start marker) |
| 13–24 Oct | Half-term Break | school-holiday |
| 20 Oct | Deepavali | public-holiday |
| 15 Dec – 9 Jan | Christmas Break | school-holiday |
| 25 Dec | Christmas Day | public-holiday |

**Term 2 (Jan–Apr 2026)**
| Date | Event | Type |
| --- | --- | --- |
| 1 Jan | New Year's Day | public-holiday |
| 12–23 Jan | Professional Development (school closed) | school-holiday |
| 26 Jan | Start of Term 2 | — |
| 16–20 Feb | Half-term Break | school-holiday |
| 17–18 Feb | Chinese New Year | public-holiday |
| 20 Mar | Hari Raya Puasa (TBA) | public-holiday |
| 3–10 Apr | Easter Break | school-holiday |
| 3 Apr | Good Friday | public-holiday |

**Term 3 (Apr–Jul 2026)**
| Date | Event | Type |
| --- | --- | --- |
| 13 Apr | Start of Term 3 | — |
| 27 Apr | Professional Development (school closed) | school-holiday |
| 1 May | Labour Day | public-holiday |
| 18–22 May | Half-term Break | school-holiday |
| 22 May | Vesak Day | public-holiday |
| 27 May | Hari Raya Haji (TBA) | public-holiday |
| 1 Jun | Public Holiday in lieu | public-holiday |
| 6 Jul | Summer Break begins | school-holiday |

#### Academic Year 2026–2027

**Term 1 (Aug–Dec 2026)**
| Date | Event | Type |
| --- | --- | --- |
| 10 Aug | National Day (observed) | public-holiday |
| 11–12 Aug | New Staff Induction (school closed) | school-holiday |
| 13–14 Aug | Professional Development (school closed) | school-holiday |
| 14 Aug | Orientation Day | school-holiday |
| 17 Aug | Start of Term 1 | — |
| 19–30 Oct | Half-term Break | school-holiday |
| 19 Oct | Professional Development (school closed) | school-holiday |
| 8 Nov | Deepavali | public-holiday |
| 9 Nov | Replacement holiday for Deepavali | public-holiday |
| 14 Dec – 1 Jan | Christmas Break | school-holiday |
| 25 Dec | Christmas Day | public-holiday |

**Term 2 (Jan–Apr 2027)**
| Date | Event | Type |
| --- | --- | --- |
| 1 Jan | New Year's Day | public-holiday |
| 4 Jan | Start of Term 2 | — |
| 8 Feb | Professional Development (school closed) | school-holiday |
| 15–19 Feb | Half-term Break | school-holiday |
| 17–18 Feb | Chinese New Year | public-holiday |
| 11 Mar | Hari Raya Puasa (TBA) | public-holiday |
| 26 Mar | Good Friday | public-holiday |
| 29 Mar – 9 Apr | Easter Break | school-holiday |

**Term 3 (Apr–Jul 2027)**
| Date | Event | Type |
| --- | --- | --- |
| 12 Apr | Start of Term 3 | — |
| 1 May | Labour Day | public-holiday |
| 17 May | Hari Raya Haji (TBA) | public-holiday |
| 24–28 May | Half-term Break | school-holiday |
| 24 May | Vesak Day | public-holiday |
| 31 May | Professional Development (school closed) | school-holiday |
| 5 Jul | Summer Break begins | school-holiday |

---

## GoHome Feature

> **Feature flag:** Controlled by `ENABLE_GO_HOME` in `config/family.ts`. Set to `false` to hide all Go Home UI and disable related auto-todos (useful for households without a school child). Currently supports **one school child** only — the first member with `schoolChild: true` in `MEMBERS`.

Automatically determines how the school child gets home on any given day and shows it as a banner at the bottom of each day column in the Schedule Summary panel on the home dashboard.

### What it shows

Each day column (Today / Tomorrow) displays a colour-coded chip:

| Method | Colour | Meaning |
| --- | --- | --- |
| Bus 3pm | Teal | School bus, 3 pm departure |
| Bus 4pm | Blue | School bus, 4 pm departure |
| Pickup | Amber | Adult collection required |

Nothing is shown for weekends or school/public holidays.

### Decision logic

Evaluated in order — the first matching rule wins:

1. **Weekend** (Sat/Sun) → no chip
2. **School or public holiday** covering the date → no chip
3. **Appointment event** for the school child → **Pickup** (adult accompaniment required)
4. **Latest school-child event ends after 16:10** → **Pickup**
5. **Latest school-child event ends after 15:10** → **Bus 4pm**
6. **Otherwise** → use the stored per-day default (configurable — see below)

Normal school days end before the `GO_HOME_BUS_LATE_AFTER` threshold, so rule 6 applies on days without after-school activities.

### Per-day defaults

Stored in MongoDB (`Settings` collection, key `go-home`) and configurable via the settings page. Used as the fallback when no rule above overrides the method.

Initial defaults:

| Day | Default |
| --- | --- |
| Monday | Pickup |
| Tuesday | Bus 3pm |
| Wednesday | Pickup |
| Thursday | Bus 3pm |
| Friday | Bus 3pm |

If no settings document exists in the DB, `FALLBACK_HOME_DEFAULTS` in `lib/home-method.ts` is used.

### Changing the logic

All decision logic lives in one file: **`lib/home-method.ts`**

- `HomeMethod` — type: `'bus-3pm' | 'bus-4pm' | 'pickup'`
- `FALLBACK_HOME_DEFAULTS` — code-level fallback defaults if DB has none
- `computeHomeMethod(allEvents, dateStr, defaults?, schoolChild?)` — pure function, returns `HomeMethod | null`. `schoolChild` defaults to `SCHOOL_CHILD` from config; pass explicitly for testing or multi-child scenarios.

Pass `allEvents` (the full array returned by the API, not pre-filtered by date) so multi-day holiday events are correctly detected across their full date range.

### Settings page

Route: `/settings/go-home` (gear icon in the top-right of the nav bar)

Lets you change the per-day default method for Mon–Fri. Changes are saved immediately to MongoDB via `PUT /api/settings/go-home`.

Also contains a link to the school parent portal (configured via `SCHOOL_PORTAL_URL` in `config/family.ts`) for notifying the school of transport changes on specific days.

### Files

| File | Purpose |
| --- | --- |
| `lib/home-method.ts` | Core logic — types, defaults, `computeHomeMethod()` |
| `lib/models/Settings.ts` | Generic key/value MongoDB settings model |
| `app/api/settings/go-home/route.ts` | GET / PUT API for persisted defaults |
| `components/GoHomeSettings/index.tsx` | Settings form (client component) |
| `app/settings/go-home/page.tsx` | Settings page |
| `components/ScheduleSummary/index.tsx` | Fetches events + settings, renders GoHome chip per day column. Events are tappable: dark overlay with Edit / Remove buttons. Recurring events show a 3-choice delete dialog. |

### When the data refreshes

The GoHome computation runs client-side on every page load. The `ScheduleSummary` component fetches both `/api/schedule` and `/api/settings/go-home` concurrently on mount. There is no background polling — if the kiosk screen stays open overnight, dates will be stale until the page is reloaded.

---

## iCal Feed

Provides a read-only `.ics` subscription feed that any calendar app (Outlook, Apple Calendar, Google Calendar) can subscribe to.

### Endpoint

```
GET /api/ical?token=<ICAL_SECRET>
```

`ICAL_SECRET` must be set as a Vercel environment variable. The endpoint returns `401` if the token is wrong and `404` if the env var is not set.

### Query parameters

All parameters are optional and combinable.

| Parameter | Description | Example |
| --- | --- | --- |
| `token` | **Required.** Must match `ICAL_SECRET` env var. | `token=abc123` |
| `participant` | Filter to events where participants includes this person **or** `family`. | `participant=alice` |
| `type` | Filter to one or more event types (comma-separated). | `type=appointment` or `type=appointment,travel` |

### Event types

| Value | What it covers |
| --- | --- |
| `appointment` | Medical, physio, dental, and other personal appointments |
| `travel` | Trips — work or family. Includes origin, destination, travel type in description. |
| `class` | Regular school classes and timetabled sessions |
| `activity` | CCAs, sports, extracurriculars |
| `school-holiday` | School term breaks, half-terms, and professional development days |
| `public-holiday` | Public holidays |

### Example URLs

All events:
```
https://your-app.vercel.app/api/ical?token=YOUR_TOKEN
```

One person's personal feed (their events + family events):
```
https://your-app.vercel.app/api/ical?token=YOUR_TOKEN&participant=alice
```

Appointments and travel only (useful for an Outlook work calendar):
```
https://your-app.vercel.app/api/ical?token=YOUR_TOKEN&type=appointment,travel
```

One person's appointments and travel:
```
https://your-app.vercel.app/api/ical?token=YOUR_TOKEN&participant=alice&type=appointment,travel
```

### Subscribing in Outlook

1. Copy your feed URL (with token)
2. **Outlook on the web:** Calendar → Add calendar → Subscribe from web → paste URL
3. **Outlook desktop (Mac/Windows):** File → Account Settings → Internet Calendars → New → paste URL

Outlook refreshes subscribed calendars periodically (every few hours). Changes made in the kiosk app will appear in Outlook on the next refresh.

### What's included in each event

- **Title** — event title
- **Date/time** — all-day or timed, with HKT timezone (`Asia/Hong_Kong`)
- **Location** — if set
- **Description** — participants, notes, and for travel events: origin, destination, travel type
- **Recurrence** — recurring events use `RRULE` so they appear correctly across all future dates in Outlook

### Setup

Set `ICAL_SECRET` in Vercel → Settings → Environment Variables. Choose any long random string. The same token is used for all feed URLs — keep it private.

---

## Future Work

- **Import endpoint** — parse school calendar URLs / PDFs and bulk-insert events
- **Monthly + annual print view** — for physical display or export
- **iCal / Google Calendar sync** — import public holiday feeds
