import { NextRequest, NextResponse } from 'next/server'
import { generateTodosForDate } from '@/lib/todo-auto-gen'
import { TIMEZONE } from '@/config/family'

/** Returns today's date in HK timezone (YYYY-MM-DD). */
function hkDateString(offset = 0): string {
  const d = new Date(Date.now() + offset * 86_400_000)
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

/**
 * GET /api/cron/todos
 *
 * Called by Vercel Cron at 22:00 UTC (= 06:00 HK time).
 * Generates auto todo items for the next 30 days (HK timezone).
 * Already-existing items are skipped via autoGenKey dedup, so re-runs are safe.
 *
 * Manual trigger: GET /api/cron/todos?date=YYYY-MM-DD
 * (generates only for that date — useful for testing)
 *
 * Auth: Vercel automatically sends Authorization: Bearer <CRON_SECRET>.
 * If CRON_SECRET env var is not set the endpoint is open (dev only).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dateParam = req.nextUrl.searchParams.get('date')
  const dates = dateParam
    ? [dateParam]
    : Array.from({ length: 30 }, (_, i) => hkDateString(i))  // today + next 29 days

  const results: Record<string, { created: number; skipped: number }> = {}
  for (const d of dates) {
    results[d] = await generateTodosForDate(d)
  }

  return NextResponse.json({ ok: true, results })
}
