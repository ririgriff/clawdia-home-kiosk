import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ScheduleEvent } from '@/lib/models/ScheduleEvent'
import type { Participant } from '@/lib/schedule-types'
import { ICS_PARTICIPANT_KEYWORDS } from '@/config/family'

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ─── ICS parser ───────────────────────────────────────────────────────────────

interface VEvent {
  uid:      string
  summary:  string
  dtstart:  string
  dtend:    string
  allDay:   boolean
  location: string
  notes:    string
}

function unfold(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '')
}

function parseDatetime(value: string): { str: string; allDay: boolean } {
  // All-day: YYYYMMDD (no T)
  if (!value.includes('T')) {
    return {
      str: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
      allDay: true,
    }
  }
  // Timed: YYYYMMDDTHHmmss[Z] — store as local time (TZID is local departure/arrival)
  const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  const time = `${value.slice(9, 11)}:${value.slice(11, 13)}`
  return { str: `${date}T${time}`, allDay: false }
}

function parseVEvents(raw: string): VEvent[] {
  const text  = unfold(raw)
  const lines = text.split('\n')
  const events: VEvent[] = []
  let cur: Record<string, string> | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue }
    if (line === 'END:VEVENT' && cur) {
      const uid     = cur['UID']     ?? ''
      const summary = cur['SUMMARY'] ?? ''
      const dtstart = cur['DTSTART'] ?? ''
      const dtend   = cur['DTEND']   ?? cur['DTSTART'] ?? ''

      if (uid && dtstart && !summary.startsWith('Canceled:')) {
        const start = parseDatetime(dtstart)
        const end   = parseDatetime(dtend)
        events.push({
          uid,
          summary: summary.replace(/\\,/g, ',').replace(/\\n/g, ' ').trim(),
          dtstart: start.str,
          dtend:   end.str,
          allDay:  start.allDay,
          location: (cur['LOCATION'] ?? '').replace(/\\,/g, ',').trim(),
          notes:    '',
        })
      }
      cur = null
      continue
    }
    if (!cur) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const rawKey = line.slice(0, colonIdx)
    const value  = line.slice(colonIdx + 1)
    // Strip TZID and other params to get base key (e.g. DTSTART;TZID=... → DTSTART)
    const baseKey = rawKey.split(';')[0]
    cur[baseKey]  = value
  }

  return events
}

// ─── Participant detection ────────────────────────────────────────────────────

function detectParticipants(summary: string): Participant[] {
  const lower = summary.toLowerCase()
  const found: Participant[] = []
  for (const { keywords, participant } of ICS_PARTICIPANT_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) found.push(participant)
  }
  return found.length > 0 ? found : ['family']
}

// ─── Cron handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const feedUrl = process.env.ICS_FEED_URL
  if (!feedUrl) return NextResponse.json({ error: 'ICS_FEED_URL not set' }, { status: 500 })

  // Fetch feed
  const res = await fetch(feedUrl, { cache: 'no-store' })
  if (!res.ok) return NextResponse.json({ error: `Feed fetch failed: ${res.status}` }, { status: 502 })
  const raw = await res.text()

  const vevents = parseVEvents(raw)

  await connectDB()

  let upserted = 0
  const seenUids: string[] = []

  for (const ev of vevents) {
    seenUids.push(ev.uid)
    await ScheduleEvent.findOneAndUpdate(
      { external_uid: ev.uid },
      {
        $set: {
          title:        ev.summary,
          type:         'travel',
          participants: detectParticipants(ev.summary),
          start:        ev.dtstart,
          end:          ev.dtend !== ev.dtstart ? ev.dtend : undefined,
          all_day:      ev.allDay,
          location:     ev.location || undefined,
          source:       'ics-feed',
          external_uid: ev.uid,
        },
      },
      { upsert: true },
    )
    upserted++
  }

  // Remove events from this feed that are no longer in the feed
  const deleted = await ScheduleEvent.deleteMany({
    source: 'ics-feed',
    external_uid: { $nin: seenUids },
  })

  return NextResponse.json({ ok: true, upserted, removed: deleted.deletedCount })
}
