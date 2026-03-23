# Links Module

## Overview

A curated list of useful URLs grouped by category, accessible from the top nav. Designed for quick one-tap access on the kiosk touch screen.

---

## Route

| Route | Purpose |
|-------|---------|
| `/links` | View and manage useful links |

---

## Data Model

### Link (`lib/models/Link.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `category` | `kids` \| `food` \| `other` | Group the link belongs to |
| `title` | String | Required — display name |
| `url` | String | Required — destination URL |
| `notes` | String | Optional — description shown below the title |
| `order` | Number | Sort order within category (default 0) |

Index: `{ category: 1, order: 1 }`

### Categories

| Value | Label |
|-------|-------|
| `kids` | School & Activities |
| `food` | Food Shopping |
| `other` | Others |

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/links` | List all links, sorted by category then order |
| POST | `/api/links` | Create a link |
| PUT | `/api/links/[id]` | Update a link (uses `$set`) |
| DELETE | `/api/links/[id]` | Delete a link |

All endpoints require PIN cookie auth.

---

## UI

- Links are displayed grouped by category with a section header
- Each link is a large tap-friendly card (`minHeight: 72px`) that opens the URL in a new tab
- Card shows: title (large), notes (smaller, below)
- Edit (pencil) and Delete (trash) action buttons on the right side of each card
- Per-category **Add** button in the section header
- Slide-up modal for add/edit with category picker pills, title, URL, notes fields
