import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ScheduleEvent } from '@/lib/models/ScheduleEvent'
import type { IScheduleEvent } from '@/lib/schedule-types'

function verifyAgent(req: NextRequest): boolean {
  const key = process.env.AGENT_API_KEY
  if (!key) return false
  return req.headers.get('authorization') === `Bearer ${key}`
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function expandRecurring(event: IScheduleEvent, fromStr: string, toStr: string, skipDates?: Set<string>): IScheduleEvent[] {
  if (!event.recurrence?.frequency) return []
  const instances: IScheduleEvent[] = []
  const recUntil   = event.recurrence.until
  const eventStart = event.start.slice(0, 10)
  const iterFrom   = eventStart > fromStr ? eventStart : fromStr
  const iterTo     = recUntil  < toStr   ? recUntil   : toStr
  const cursor     = new Date(iterFrom + 'T12:00:00')
  const end        = new Date(iterTo   + 'T12:00:00')
  while (cursor <= end) {
    const dow = cursor.getDay()
    if (event.recurrence.days.includes(dow)) {
      const dateStr   = toDateString(cursor)
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

// GET /api/agent/schedule?date=YYYY-MM-DD
// GET /api/agent/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  if (!verifyAgent(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = req.nextUrl.searchParams
  const date   = params.get('date')
  const from   = params.get('from') ?? date
  const to     = params.get('to')   ?? date

  if (!from || !to) {
    return NextResponse.json({ error: 'Provide date=YYYY-MM-DD or from=YYYY-MM-DD&to=YYYY-MM-DD' }, { status: 400 })
  }

  await connectDB()

  const docs = await ScheduleEvent.find({
    start: { $lte: to + 'T23:59' },
    $or: [
      { end:  { $gte: from } },
      { end:  { $exists: false } },
      { end:  null },
      { 'recurrence.frequency': { $exists: true } },
    ],
  }).lean() as unknown as IScheduleEvent[]

  // Build holiday dates for class suppression
  const holidayDates = new Set<string>()
  for (const doc of docs) {
    if ((doc.type === 'school-holiday' || doc.type === 'public-holiday') && !doc.recurrence?.frequency) {
      const s = doc.start.slice(0, 10)
      const e = doc.end?.slice(0, 10) ?? s
      const cur = new Date(s + 'T12:00:00')
      const endD = new Date(e + 'T12:00:00')
      while (cur <= endD) { holidayDates.add(toDateString(cur)); cur.setDate(cur.getDate() + 1) }
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

  result.sort((a, b) => a.start.localeCompare(b.start))

  return NextResponse.json({ from, to, count: result.length, events: result })
}

// POST /api/agent/schedule — create an event
export async function POST(req: NextRequest) {
  if (!verifyAgent(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (!body.title || !body.type || !body.start) {
    return NextResponse.json({ error: 'title, type, and start are required' }, { status: 400 })
  }

  const validTypes = ['school-holiday', 'public-holiday', 'class', 'activity', 'travel', 'appointment']
  if (!validTypes.includes(body.type)) {
    return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 })
  }

  await connectDB()
  const event = await ScheduleEvent.create({ ...body, source: 'agent' })
  return NextResponse.json(
    { success: true, event: { ...event.toObject(), _id: event._id.toString() } },
    { status: 201 },
  )
}

// PUT /api/agent/schedule?id=EVENT_ID — update an event
export async function PUT(req: NextRequest) {
  if (!verifyAgent(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 })

  // Strip recurring-instance suffix (format: <mongoId>_YYYY-MM-DD)
  const baseId = id.split('_')[0]
  const body   = await req.json()

  await connectDB()
  const updated = await ScheduleEvent.findByIdAndUpdate(baseId, { $set: body }, { new: true }).lean() as IScheduleEvent | null

  if (!updated) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  return NextResponse.json({ success: true, event: { ...updated, _id: updated._id.toString() } })
}

// DELETE /api/agent/schedule?id=EVENT_ID&mode=all|single|following|range&date=YYYY-MM-DD
//
// mode=all (default)                    — delete entire series
// mode=single&date=...                  — skip just this date (adds to exceptions[])
// mode=following&date=...               — truncate series: set recurrence.until to day before date
// mode=range&from=...&to=...            — skip all dates in range (adds each to exceptions[])
export async function DELETE(req: NextRequest) {
  if (!verifyAgent(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = req.nextUrl.searchParams
  const id     = params.get('id')
  const mode   = params.get('mode') ?? 'all'
  const date   = params.get('date')

  if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
  if ((mode === 'single' || mode === 'following') && !date) {
    return NextResponse.json({ error: 'date param (YYYY-MM-DD) is required for mode=single and mode=following' }, { status: 400 })
  }

  const baseId = id.split('_')[0]
  await connectDB()

  if (mode === 'single') {
    const event = await ScheduleEvent.findById(baseId)
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    const exceptions = [...(event.exceptions ?? []), date]
    await ScheduleEvent.findByIdAndUpdate(baseId, { $set: { exceptions } })
    return NextResponse.json({ success: true, mode: 'single', date })
  }

  if (mode === 'following') {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    const until = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const updated = await ScheduleEvent.findByIdAndUpdate(baseId, { $set: { 'recurrence.until': until } }, { new: true })
    if (!updated) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    return NextResponse.json({ success: true, mode: 'following', until })
  }

  if (mode === 'range') {
    const from = params.get('from')
    const to   = params.get('to')
    if (!from || !to) {
      return NextResponse.json({ error: 'from and to params (YYYY-MM-DD) are required for mode=range' }, { status: 400 })
    }
    const event = await ScheduleEvent.findById(baseId)
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    const cursor = new Date(from + 'T12:00:00')
    const end    = new Date(to   + 'T12:00:00')
    const newDates: string[] = []
    while (cursor <= end) {
      const d = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      newDates.push(d)
      cursor.setDate(cursor.getDate() + 1)
    }
    const exceptions = [...new Set([...(event.exceptions ?? []), ...newDates])]
    await ScheduleEvent.findByIdAndUpdate(baseId, { $set: { exceptions } })
    return NextResponse.json({ success: true, mode: 'range', from, to, exceptions_added: newDates.length })
  }

  // mode=all
  const deleted = await ScheduleEvent.findByIdAndDelete(baseId)
  if (!deleted) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  return NextResponse.json({ success: true, mode: 'all' })
}
