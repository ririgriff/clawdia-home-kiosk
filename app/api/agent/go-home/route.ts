import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ScheduleEvent } from '@/lib/models/ScheduleEvent'
import { Settings } from '@/lib/models/Settings'
import { computeHomeMethod, FALLBACK_HOME_DEFAULTS, HomeMethod } from '@/lib/home-method'
import { ENABLE_GO_HOME } from '@/config/family'

function verifyAgent(req: NextRequest): boolean {
  const key = process.env.AGENT_API_KEY
  if (!key) return false
  return req.headers.get('authorization') === `Bearer ${key}`
}

// GET /api/agent/go-home?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  if (!ENABLE_GO_HOME) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!verifyAgent(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date=YYYY-MM-DD is required' }, { status: 400 })
  }

  await connectDB()

  const [allEvents, setting] = await Promise.all([
    ScheduleEvent.find().lean(),
    Settings.findOne({ key: 'go-home' }).lean() as Promise<{ value?: Record<string, string> } | null>,
  ])

  const defaults: Record<number, HomeMethod> = setting?.value
    ? Object.fromEntries(Object.entries(setting.value).map(([k, v]) => [Number(k), v as HomeMethod]))
    : FALLBACK_HOME_DEFAULTS

  const method = computeHomeMethod(allEvents, date, defaults)

  const labels: Record<string, string> = {
    pickup: 'Pickup',
    'bus-3pm': 'School bus (3pm)',
    'bus-4pm': 'School bus (4pm)',
  }

  return NextResponse.json({
    date,
    method,
    label: method ? labels[method] : null,
    description: method === null ? 'No school (weekend or holiday)' : labels[method],
  })
}
