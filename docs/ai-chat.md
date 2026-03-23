# AI Chat

## Overview

An in-app AI chatbot powered by Claude, accessible via a floating button in the bottom-right corner of every page. Lets the family interact with all app data using natural language, including voice input.

---

## Architecture

### Backend — `app/api/chat/route.ts`

- **POST `/api/chat`** — PIN-protected (cookie). Accepts `{ messages, model }`, streams a Server-Sent Events response.
- Uses **Anthropic SDK streaming** (`anthropic.messages.stream()`).
- **Multi-turn tool use loop**: streams text tokens as they arrive, then executes any tool calls server-side, feeds results back to the model, and continues until `stop_reason === 'end_turn'`.
- All Mongoose calls happen directly in `executeTool()` — no internal HTTP round-trips.
- `{TODAY_DATETIME}` placeholder in `SYSTEM_PROMPT` is replaced at request time with current HK date/time.

### Frontend — `components/ClawdiaChat/index.tsx`

- Mounted once in `app/layout.tsx` — available on every page.
- Floating 64×64 trigger button with the `MASCOT_FACE` image from `config/family.ts`.
- Chat panel slides up from the bottom (`height: 88vh`).

---

## SSE Event Format

The route streams `data: {...}\n\n` events with these types:

| Event type | Payload | Meaning |
|------------|---------|---------|
| `text` | `{ text: string }` | Streamed text chunk — append to current bubble |
| `tool_start` | `{ name: string }` | Tool execution beginning — show activity indicator |
| `tool_done` | `{ name: string }` | Tool execution complete — hide activity indicator |
| `done` | — | Full response complete — commit streaming bubble to history |
| `error` | `{ message: string }` | Something went wrong |

---

## Tools

| Tool name | Action |
|-----------|--------|
| `get_meal_plan` | Fetch meal plan entries for a date range, enriched with dish names |
| `search_dishes` | Search dish library by name, category, or tags |
| `add_meal_to_plan` | Add a dish to a plan slot — accepts `eaters: string[]` (member IDs from `config/family.ts`) |
| `remove_meal_from_plan` | Remove a plan entry by `_id` |
| `create_dish` | Submit a new dish — lands as `status: pending, source: agent` |
| `get_todos` | List to-dos, optionally filtered by date/assignee |
| `create_todo` | Add a to-do — lands as `source: agent` |
| `update_todo` | Mark done/undone, rename, **reassign** (`assignee`), or **change date** |
| `delete_todo` | Permanently delete |
| `get_schedule` | Fetch calendar events for a date range (includes recurring series) |
| `create_event` | Add a calendar event — lands as `source: agent` |
| `update_event` | Edit an event (strips `_YYYY-MM-DD` suffix for recurring instances) |
| `delete_event` | Delete an event |
| `get_links` | List useful links, optionally filtered by category |
| `create_link` | Add a useful link |
| `get_go_home` | Compute how the school child gets home on a given date using `computeHomeMethod()` |

---

## System Prompt

The `SYSTEM_PROMPT` constant is at the top of `app/api/chat/route.ts`, clearly labelled for easy editing. Add family context, rules, and preferences there. The `{TODAY_DATETIME}` placeholder is replaced at request time.

---

## UI Features

### Model selector
Three options in the header dropdown:
- **Haiku 4.5** — fast
- **Sonnet 4.6** — balanced (default)
- **Opus 4.6** — most capable

### Voice input (Web Speech API)
- 64×64 round mic button in the input bar.
- Only shown when `SpeechRecognition` / `webkitSpeechRecognition` is available (Chromium-based browsers).
- While listening: 2 `animate-ping` ripple rings + 5 animated equalizer bars (`@keyframes soundbar`).
- On result: auto-sends the transcribed text immediately.

### New chat
- `SquarePen` icon button in the header, visible only when there are messages.
- Clears conversation history, streaming state, and tool activity — returns to the empty state.

### TTS (Text-to-Speech)
- Toggle button in the header (Volume2 / VolumeX icon).
- When enabled, assistant responses are read aloud via `SpeechSynthesisUtterance`.

### Tool activity badges
After each assistant message, any tools that were used appear as small pill badges below the message text.

---

## Key Implementation Notes

- **SpeechRecognition typing**: Web Speech API types aren't in the default TS lib. `window` is cast as `Window & { SpeechRecognition?: ...; webkitSpeechRecognition?: unknown }`. `recognitionRef` is typed as `{ stop: () => void } | null`.
- **`create_dish` / `create_todo` / `create_event`**: all land with `source: 'agent'` so they enter the appropriate pending/review flows, consistent with the external WhatsApp agent.
- **Go-home**: `get_go_home` runs `computeHomeMethod()` server-side using the full events array + Settings `go-home` key — the same logic as the dashboard chip. Never stored, always computed fresh.
- **`get_schedule` recurring events**: the query uses `$or` — non-recurring events with `start` in range, plus recurring events where `start <= dateTo` AND `recurrence.until >= dateFrom`. A naive `start >= dateFrom` filter silently misses recurring events that started before the queried date.
- **`update_todo` fields**: `done`, `title`, `assignee` (member ID from `TODO_ASSIGNEES` in config), `date` (YYYY-MM-DD or null for undated).
