import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ScheduleEvent } from '@/lib/models/ScheduleEvent'
import type { IScheduleEvent } from '@/lib/schedule-types'
import { APP_NAME, TIMEZONE } from '@/config/family'

// iCal day-of-week: JS 0=Sun … 6=Sat → iCal SU,MO…SA
const DOW: Record<number, string> = { 0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA' }

// iCal requires CRLF line endings and max-75-octet lines (fold with CRLF + space)
function fold(line: string): string {
  if (line.length <= 75) return line
  const out: string[] = []
  let cur = ''
  for (const ch of line) {
    if ((cur + ch).length > 75) { out.push(cur); cur = ' ' + ch }
    else cur += ch
  }
  if (cur) out.push(cur)
  return out.join('\r\n')
}

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')
}

// YYYY-MM-DD → YYYYMMDD
function d(s: string) { return s.slice(0, 10).replace(/-/g, '') }

// YYYY-MM-DDTHH:mm → YYYYMMDDTHHmm00
function dt(s: string) { return s.slice(0, 10).replace(/-/g, '') + 'T' + s.slice(11, 16).replace(':', '') + '00' }

// Add N days to YYYY-MM-DD, return YYYYMMDD
function nextDay(dateStr: string, n = 1): string {
  const x = new Date(dateStr + 'T12:00:00')
  x.setDate(x.getDate() + n)
  return x.toISOString().slice(0, 10).replace(/-/g, '')
}

// Add 1 hour to YYYY-MM-DDTHH:mm, return YYYYMMDDTHHmm00
function plusOneHour(s: string): string {
  const h = parseInt(s.slice(11, 13)) + 1
  return s.slice(0, 10).replace(/-/g, '') + 'T' + String(h).padStart(2, '0') + s.slice(14, 16) + '00'
}

function buildVEvent(e: IScheduleEvent): string {
  const lines: string[] = ['BEGIN:VEVENT']
  const appSlug = APP_NAME.toLowerCase().replace(/[^a-z0-9]/g, '')
  lines.push(`UID:${e._id}@${appSlug}.app`)
  lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`)

  const allDay = e.all_day || e.start.length <= 10

  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${d(e.start)}`)
    // iCal all-day DTEND is exclusive — day after the last day
    lines.push(`DTEND;VALUE=DATE:${e.end ? nextDay(e.end.slice(0, 10)) : nextDay(e.start.slice(0, 10))}`)
  } else {
    lines.push(`DTSTART;TZID=${TIMEZONE}:${dt(e.start)}`)
    lines.push(`DTEND;TZID=${TIMEZONE}:${e.end && e.end.length > 10 ? dt(e.end) : plusOneHour(e.start)}`)
  }

  // Recurring → RRULE
  if (e.recurrence?.frequency === 'weekly' && e.recurrence.days?.length) {
    const byDay = e.recurrence.days.map(n => DOW[n]).join(',')
    const until = d(e.recurrence.until) + 'T235959Z'
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${until}`)
  }

  lines.push(`SUMMARY:${esc(e.title)}`)

  // Build a rich description
  const descParts: string[] = []
  if (e.participants?.length) descParts.push(`Who: ${e.participants.join(', ')}`)
  if (e.travel_type)          descParts.push(`Travel: ${e.travel_type}`)
  if (e.origin)               descParts.push(`From: ${e.origin}`)
  if (e.destination)          descParts.push(`To: ${e.destination}`)
  if (e.notes)                descParts.push(e.notes)
  if (descParts.length)       lines.push(`DESCRIPTION:${esc(descParts.join('\\n'))}`)

  if (e.location)             lines.push(`LOCATION:${esc(e.location)}`)

  lines.push('END:VEVENT')
  return lines.map(fold).join('\r\n')
}

const VALID_TYPES = ['school-holiday', 'public-holiday', 'class', 'activity', 'travel', 'appointment']

// GET /api/ical?token=<ICAL_SECRET>
// Optional filters (combinable):
//   &participant=alice            — events where participants includes alice or family
//   &type=appointment            — single type
//   &type=appointment,travel     — comma-separated list of types
export async function GET(req: NextRequest) {
  const secret = process.env.ICAL_SECRET
  if (!secret) {
    return new NextResponse('iCal feed not configured — set ICAL_SECRET env var', { status: 404 })
  }

  if (req.nextUrl.searchParams.get('token') !== secret) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const participantFilter = req.nextUrl.searchParams.get('participant')
  const typeParam         = req.nextUrl.searchParams.get('type')
  const typeFilter        = typeParam
    ? typeParam.split(',').map(t => t.trim()).filter(t => VALID_TYPES.includes(t))
    : []

  await connectDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {}
  if (participantFilter) query.participants = { $in: [participantFilter, 'family'] }
  if (typeFilter.length)  query.type        = { $in: typeFilter }
  const events = await ScheduleEvent.find(query).lean() as IScheduleEvent[]

  const nameParts = [APP_NAME]
  if (participantFilter) nameParts.push(participantFilter.charAt(0).toUpperCase() + participantFilter.slice(1))
  if (typeFilter.length)  nameParts.push(typeFilter.join(', '))
  const calName = nameParts.length > 1 ? nameParts.join(' — ') : `${APP_NAME} Family Calendar`

  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${APP_NAME}//Family Calendar//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    `X-WR-TIMEZONE:${TIMEZONE}`,
    'BEGIN:VTIMEZONE',
    `TZID:${TIMEZONE}`,
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...events.map(buildVEvent),
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(cal, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${APP_NAME.toLowerCase().replace(/[^a-z0-9]/g, '')}.ics"`,
      'Cache-Control': 'no-cache',
    },
  })
}
