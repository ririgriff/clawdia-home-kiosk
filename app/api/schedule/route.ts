import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ScheduleEvent } from '@/lib/models/ScheduleEvent'
import type { IScheduleEvent } from '@/lib/schedule-types'

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function expandRecurring(event: IScheduleEvent, fromStr: string, toStr: string, skipDates?: Set<string>): IScheduleEvent[] {
  if (!event.recurrence) return []
  const instances: IScheduleEvent[] = []
  const recUntil = event.recurrence.until
  const eventStart = event.start.slice(0, 10)

  const iterFrom = eventStart > fromStr ? eventStart : fromStr
  const iterTo   = recUntil  < toStr   ? recUntil   : toStr

  const cursor = new Date(iterFrom + 'T12:00:00')
  const end    = new Date(iterTo   + 'T12:00:00')

  while (cursor <= end) {
    const dow = cursor.getDay()
    if (event.recurrence.days.includes(dow)) {
      const dateStr = toDateString(cursor)
      if (!skipDates?.has(dateStr)) {
        const timeStart = event.start.length > 10 ? event.start.slice(10) : ''
        const timeEnd   = event.end && event.end.length > 10 ? event.end.slice(10) : ''
        instances.push({
          ...event,
          _id:   `${event._id}_${dateStr}`,
          start: dateStr + timeStart,
          end:   event.end ? (dateStr + timeEnd) : undefined,
        })
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return instances
}

// GET /api/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from')
  const to   = request.nextUrl.searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
  }

  await connectDB()

  // Fetch all events that could overlap the window.
  // Append T23:59 so that timed events on the last day of the range
  // (e.g. start='2026-03-18T08:15') are not excluded by string comparison.
  const docs = await ScheduleEvent.find({
    start: { $lte: to + 'T23:59' },
    $or: [
      { end:  { $gte: from } },
      { end:  { $exists: false } },
      { end:  null },
      { 'recurrence.frequency': { $exists: true } },
    ],
  }).lean() as unknown as IScheduleEvent[]

  // Build set of dates covered by school/public holidays (for suppressing classes)
  const holidayDates = new Set<string>()
  for (const doc of docs) {
    if ((doc.type === 'school-holiday' || doc.type === 'public-holiday') && !doc.recurrence?.frequency) {
      const start = doc.start.slice(0, 10)
      const end   = doc.end?.slice(0, 10) ?? start
      const cur   = new Date(start + 'T12:00:00')
      const endD  = new Date(end   + 'T12:00:00')
      while (cur <= endD) {
        holidayDates.add(toDateString(cur))
        cur.setDate(cur.getDate() + 1)
      }
    }
  }

  const result: IScheduleEvent[] = []

  for (const doc of docs) {
    if (doc.recurrence?.frequency) {
      let skipDates: Set<string> | undefined
      if (doc.type === 'class' || (doc.type === 'activity' && doc.title?.startsWith('CCA'))) {
        skipDates = new Set([...holidayDates, ...(doc.exceptions ?? [])])
      } else if (doc.exceptions?.length) {
        skipDates = new Set(doc.exceptions)
      }
      result.push(...expandRecurring(doc, from, to, skipDates))
    } else {
      result.push({ ...doc, _id: doc._id.toString() })
    }
  }

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  await connectDB()
  const body = await request.json()
  const event = await ScheduleEvent.create(body)
  return NextResponse.json({ ...event.toObject(), _id: event._id.toString() }, { status: 201 })
}
