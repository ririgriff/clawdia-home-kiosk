# Home Kiosk App

## Project Overview

A family home kiosk app running on a large android tablet, accessed via **Fully Kiosk Browser** (touch screen, no mouse, no keyboard). Built with Next.js 15 App Router, deployed on Vercel, data in MongoDB Atlas.

The app name is set in `APP_NAME` in `config/family.ts` — read that file first; do not assume the name. The backend is also accessed by an external openclaw robot which is able to reach users via interfaces like WhatsApp.

---

## Family Config — Read This First

**Before starting any task, read ****`config/family.ts`****.** It is the single source of truth for all family-specific values: app name (`APP_NAME`), timezone (`TIMEZONE`), member IDs, colours, roles, meal shortcuts, go-home thresholds, auto-gen todo rules, and ICS keywords. Do not hardcode any of these values — always derive them from the config. The derived types `Participant`, `TodoAssignee`, and helpers `getMemberInitials()` / `getMemberColor()` all come from this file.

`config/family.ts` is gitignored (private). The public repo ships `config/family.example.ts` with generic placeholder data. A `predev`/`prebuild` script auto-copies `family.example.ts` → `family.ts` on a fresh clone.

**Mascot & favicons:** If `MASCOT_FULL` is changed to a custom image, regenerate the three favicon files from the new full image. Always back up the default icon first if `app/icon.default.png` doesn't already exist:
```bash
# Back up default (once only)
cp app/icon.png app/icon.default.png
# Regenerate favicons from the new full image
cp public/<new-full-image>.png public/favicon.png
sips --resampleHeightWidth 32 32 public/<new-full-image>.png --out public/favicon-32.png
sips --resampleHeightWidth 32 32 public/<new-full-image>.png --out app/icon.png
```
To revert to Clawdia defaults: `cp app/icon.default.png app/icon.png` and copy `clawdia-full.png` back to `favicon.png` / `favicon-32.png`.

---

## Touch Screen Rules (CRITICAL)

**This app runs on a 32" portrait 9:16 touch screen with no mouse, though landscape mode is also supported for home and menu planning screens.** All interactive elements must meet these standards:

- **Minimum touch target: 44×44px** on every button, link, and interactive element. Use `minWidth`/`minHeight: 44` in inline styles or `min-w-[44px] min-h-[44px]` in Tailwind. Padding alone is not enough — verify the combined rendered size.
- **No hover-only states.** `opacity-0 group-hover:opacity-100` means permanently invisible on touch. Use always-visible at reduced opacity (`opacity: 0.4`) instead.
- **List rows with embedded action buttons:** Use `items-stretch` on the row container and make action buttons (checkbox, delete) `flex items-center justify-center` with `minWidth: 44` so they fill the full row height naturally.
- **Form inputs, selects, date pickers:** `minHeight: 44` on all.
- **Dense secondary views** (e.g. schedule day strips): `minHeight: 40px` per item is acceptable when layout space is constrained.

**Before finishing any component with buttons, checkboxes, chips, or icon buttons — check every one against the 44px rule. Assume the device has no mouse.**

---

## Tech Stack

- **Next.js 15 App Router** — `app/` directory, route handlers, server components
- **MongoDB Atlas + Mongoose** — all data; models in `lib/models/`
- **Vercel** — hosting and cron jobs
- **Tailwind CSS** — utility classes; custom CSS variables for theming
- **lucide-react** — all icons (consistent `size` + `strokeWidth={1.75}`)
- **Cloudinary** — dish/food image hosting

---

## Authentication

### PIN Auth (internal app)

All routes are PIN-protected via `middleware.ts` (Next.js middleware). A successful PIN sets a cookie.

**Public paths** that bypass PIN auth:

```typescript
const PUBLIC_PATHS = ["/pin", "/api/auth", "/api/agent", "/api/cron"];
```

If you add a new API route that should be callable without a PIN cookie (e.g. a new cron endpoint), **add its prefix to \****`PUBLIC_PATHS`***\* in \****`middleware.ts`**. Forgetting this is a production bug — Vercel's cron runner and external agents don't send PIN cookies.

### Bearer Token Auth (agent / cron)

- `/api/agent/*` routes require `Authorization: Bearer <AGENT_API_KEY>`
- `/api/cron/*` routes require `Authorization: Bearer <CRON_SECRET>`
- Both env vars are set in Vercel environment variables

---

## Date & Time Conventions

- **Timezone:** Always use `TIMEZONE` from `config/family.ts` — never hardcode a timezone string
- **Date strings:** Always `YYYY-MM-DD` format — use `toLocaleDateString('en-CA', { timeZone: TIMEZONE })`
- **Parsing date strings:** Use `new Date(dateStr + 'T12:00:00')` — avoids midnight UTC rollover causing off-by-one day errors
- **Date comparison:** ISO date strings compare lexicographically — `dateA < dateB` is safe for ordering
- **Cron schedule:** Vercel cron runs at UTC — account for the UTC offset from `TIMEZONE` when scheduling

---

## API Patterns

### Internal app API (`/api/`)

- PIN cookie required
- Updates use `$set` — never replace the whole document
- Use `.lean()` on Mongoose queries for read-only endpoints (returns plain JS objects, faster)
- Route handlers that use `params` in Next.js 15 must `await` them: `const { id } = await params`

### External Agent API (`/api/agent/`)

- Bearer token required
- Agent-submitted content (dishes, todos) should be tagged with `source: 'agent'` and land in a pending/review state where appropriate

### Recurring event IDs

Recurring event instances have synthetic IDs: `<realMongoId>_YYYY-MM-DD`. When editing or deleting, strip the suffix: `id.split('_')[0]`

### GoHome computation

`computeHomeMethod(allEvents, dateStr, defaults?, schoolChild?)` in `lib/home-method.ts`. Always pass the **full unfiltered events array**, not just events for that date — multi-day holiday events must be detected across their full span.

---

## CSS Variables (theming)

| Variable | Usage |
| --- | --- |
| `--parchment-2` | Page background |
| `--parchment-3` | Card / row background |
| `--parchment-4` | Slightly darker card / header |
| `--ember` | Primary accent (orange) |
| `--ember-bg` | Active state background (light orange) |
| `--border` | Border colour |
| `--ink` | Primary text |
| `--ink-2` | Secondary text |
| `--ink-3` | Tertiary text |
| `--ink-4` | Muted / disabled text and icons |

---

## Module Structure

| Module | Routes | Docs |
| --- | --- | --- |
| Home dashboard | `/` | — |
| Meal planner | `/plan`, `/meals` | `docs/meals-module.md` |
| Schedule | `/schedule`, `/settings/go-home` | `docs/schedule-module.md` |
| To-Do | `/todo` | `docs/todo-module.md` |
| Links | `/links` | `docs/links-module.md` |
| AI Chat | (overlay, all pages) | `docs/ai-chat.md` |

Each module follows the same layout: models in `lib/models/`, types in `lib/`, API handlers in `app/api/`, React components in `components/`.

**Before working on any module, read its docs file** to understand the data model, API patterns, and UX decisions before touching code.

---

## Vercel Cron

Cron jobs are defined in `vercel.json`. Two are currently active: `/api/cron/todos` (daily auto-todos) and `/api/cron/ics-sync` (calendar sync).

- Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically
- Always add `CRON_SECRET` to Vercel env vars for any new cron endpoint
- New cron paths must be in `PUBLIC_PATHS` in `middleware.ts`

---

## NavBar

- `components/NavBar.tsx` — top nav + optional meals sub-nav
- Adding a new top-level section: add to `topNav` array, add a new `CheckSquare`-style icon from lucide-react
- Sub-nav only appears when `inMeals` — modelled after meals pattern if adding sub-nav to other sections
- Nav items on mobile are icons-only (`hidden sm:inline` on labels)
- Icon buttons in the nav bar must have `minWidth: 44, minHeight: 44`

---

## GoHome Feature

Controlled by `ENABLE_GO_HOME` in `config/family.ts`. When `false`, all Go Home UI is hidden and go-home auto-todos are suppressed. Currently supports one school child only.

Decision logic lives in `lib/home-method.ts`. Full behaviour documented in `docs/schedule-module.md`. Settings configurable at `/settings/go-home`.

---

## OpenClaw Agent Integration

Each module skill has two parts: a tiny bootstrap `openclaw-skill/<module>/SKILL.md` installed on the agent machine, and a server-side skill route (`/api/agent/skill?module=<name>`) that builds the full prompt dynamically. Full design documented in the README (Step 5).

### Adding a new skill

1. Add a `build<Module>Skill(base)` function to `app/api/agent/skill/route.ts` and add a branch for `?module=<name>`
2. Create `openclaw-skill/<module>/SKILL.md` with the bootstrap pattern:
```markdown
   Fetch your full instructions before doing anything:
   GET $KIOSK_API_BASE/api/agent/skill?module=<name>
   Authorization: Bearer $KIOSK_AGENT_KEY
   Read the response and follow it exactly.
```
3. Copy the SKILL.md to `~/.openclaw/skills/<module>/SKILL.md` on the agent machine

---

## AI Chat

An in-app AI chatbot mounted globally in `app/layout.tsx`. Full details in `docs/ai-chat.md`.

- **API route:** `POST /api/chat` — PIN-cookie-protected
- **Component:** `components/ClawdiaChat/index.tsx`
- **System prompt:** `SYSTEM_PROMPT` constant in `app/api/chat/route.ts`
- **Tools:** 17 tools in `executeTool()` — meal plan, dishes, todos, schedule, links, go-home
- **Voice input:** Web Speech API (Chromium only). Cast `window` explicitly — `SpeechRecognition` types are not in the default TS lib, do not use global types.
- **`create_dish`**** / \****`create_todo`***\* / \****`create_event`** via chat land with `source: 'agent'` and enter pending/review flows

---

## Documentation & Git Workflow

**After completing any meaningful feature or fix, always do all three steps without waiting to be asked:**

1. Update the relevant `docs/*.md` file for any changed module
2. Commit with a concise message describing what changed and why
3. Push to GitHub (`git push`)

### Module docs — update when their module changes

| Module | Doc file |
| --- | --- |
| Meal planner | `docs/meals-module.md` |
| Schedule | `docs/schedule-module.md` |
| To-Do | `docs/todo-module.md` |
| Links | `docs/links-module.md` |
| AI Chat | `docs/ai-chat.md` |

### Key non-module docs — keep these in sync

| File | Audience | Update when |
| --- | --- | --- |
| `README.md` | Anyone cloning the repo — overview, setup steps, feature list | A new feature is added, setup steps change, or external services change |
| `docs/manual-configuration.md` | Users configuring the app by hand (no Claude Code) — mirrors the `/clawdiainit` skill step-by-step | `config/family.ts` structure changes, new env vars added, or new configurable behaviour introduced |
| `.claude/commands/clawdiainit.md` | The `/clawdiainit` Claude Code setup wizard | Same triggers as `manual-configuration.md` — these two must stay in sync with each other |
| `docs/system-architecture.md` | Developers understanding the full system — routes, models, data flow, env vars | New API routes, models, external services, or auth patterns added |
| `.interface-design/system.md` | Developers implementing UI — colour palette, typography, spacing, component patterns | Design tokens or CSS variables change |

---

## Code Style

- No over-engineering. Only make the change that was asked for.
- Don't add error handling for scenarios that can't happen in this app's context.
- Don't add comments unless the logic is non-obvious.
- Prefer editing existing components over creating new ones.
- Keep components in `components/<ModuleName>/index.tsx` — co-locate sub-components in the same file unless they're large enough to deserve their own file.
