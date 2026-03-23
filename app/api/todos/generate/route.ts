import { NextRequest, NextResponse } from 'next/server'
import { generateTodosForDate } from '@/lib/todo-auto-gen'
import { TIMEZONE } from '@/config/family'

function hkDateString(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000)
    .toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

// POST /api/todos/generate
// Body (optional): { days: number }  — defaults to 30
// Generates auto todo items for today + the next N days and returns a summary.
export async function POST(req: NextRequest) {
  let days = 30
  try {
    const body = await req.json()
    if (typeof body.days === 'number' && body.days > 0) days = Math.min(body.days, 30)
  } catch { /* no body is fine */ }

  const results: Record<string, { created: number; skipped: number }> = {}
  for (let i = 0; i < days; i++) {
    const d = hkDateString(i)
    results[d] = await generateTodosForDate(d)
  }

  const totalCreated = Object.values(results).reduce((s, r) => s + r.created, 0)
  return NextResponse.json({ ok: true, totalCreated, results })
}
