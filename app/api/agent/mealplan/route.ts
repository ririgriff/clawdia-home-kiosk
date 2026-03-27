import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { MealPlan } from '@/lib/models/MealPlan'
import { Dish } from '@/lib/models/Dish'

function verifyAgent(req: NextRequest): boolean {
  const key = process.env.AGENT_API_KEY
  if (!key) return false
  return req.headers.get('authorization') === `Bearer ${key}`
}

// GET /api/agent/mealplan?date=YYYY-MM-DD
// GET /api/agent/mealplan?weekStart=YYYY-MM-DD
export async function GET(req: NextRequest) {
  if (!verifyAgent(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date      = req.nextUrl.searchParams.get('date')
  const weekStart = req.nextUrl.searchParams.get('weekStart')

  if (!date && !weekStart) {
    return NextResponse.json({ error: 'date or weekStart is required (format: YYYY-MM-DD)' }, { status: 400 })
  }

  await connectDB()

  const slotOrder = ['breakfast', 'lunch', 'snack', 'dinner']

  function buildGrouped(entries: { _id: unknown; dish_id: string; date: string; slot: string; eaters?: string[]; note?: string }[], dishMap: Record<string, { name: string }>) {
    const grouped: Record<string, { id: string; dish: string; eaters: string[]; note?: string }[]> = {}
    for (const slot of slotOrder) grouped[slot] = []
    for (const entry of entries) {
      const dish = dishMap[entry.dish_id]
      if (!grouped[entry.slot]) grouped[entry.slot] = []
      grouped[entry.slot].push({
        id: String(entry._id),
        dish: dish ? dish.name : 'Unknown dish',
        eaters: entry.eaters ?? [],
        ...(entry.note ? { note: entry.note } : {}),
      })
    }
    return grouped
  }

  if (weekStart) {
    // Return all 7 days of the week
    const [y, m, d] = weekStart.split('-').map(Number)
    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      const dt = new Date(y, m - 1, d + i)
      dates.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`)
    }

    const entries = await MealPlan.find({ date: { $in: dates } }).lean()
    const dishIds = [...new Set(entries.map(e => e.dish_id))]
    const dishes = await Dish.find({ _id: { $in: dishIds } }).lean()
    const dishMap = Object.fromEntries(dishes.map(d => [d._id.toString(), { name: d.name }]))

    const week: Record<string, Record<string, { id: string; dish: string; eaters: string[]; note?: string }[]>> = {}
    for (const dt of dates) {
      week[dt] = buildGrouped(entries.filter(e => e.date === dt), dishMap)
    }

    return NextResponse.json({ weekStart, week })
  }

  // Single day
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date!)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }

  const entries = await MealPlan.find({ date }).lean()
  const dishIds = [...new Set(entries.map(e => e.dish_id))]
  const dishes = await Dish.find({ _id: { $in: dishIds } }).lean()
  const dishMap = Object.fromEntries(dishes.map(d => [d._id.toString(), { name: d.name }]))

  return NextResponse.json({ date, slots: buildGrouped(entries, dishMap) })
}

// POST /api/agent/mealplan
// Body: { dish_id, date, slot, eaters }
export async function POST(req: NextRequest) {
  if (!verifyAgent(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { dish_id, date, slot, eaters } = body

  if (!dish_id || !date || !slot) {
    return NextResponse.json({ error: 'dish_id, date, and slot are required' }, { status: 400 })
  }

  await connectDB()

  // Verify dish exists and is active
  const dish = await Dish.findById(dish_id).lean()
  if (!dish) {
    return NextResponse.json({ error: 'Dish not found' }, { status: 404 })
  }
  if ((dish as { status?: string }).status === 'pending') {
    return NextResponse.json({ error: 'Dish is still pending approval — approve it in the app first' }, { status: 400 })
  }

  const entry = await MealPlan.create({ dish_id, date, slot, eaters: eaters ?? [] })
  return NextResponse.json({ ...entry.toObject(), _id: entry._id.toString() }, { status: 201 })
}

// PUT /api/agent/mealplan?id=ENTRY_ID
// Body: { eaters?, note? }
export async function PUT(req: NextRequest) {
  if (!verifyAgent(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if ('eaters' in body) update.eaters = body.eaters
  if ('note' in body) update.note = body.note

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Provide eaters and/or note to update' }, { status: 400 })
  }

  await connectDB()
  const entry = await MealPlan.findByIdAndUpdate(id, { $set: update }, { new: true }).lean()
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

  return NextResponse.json({ success: true, entry })
}

// DELETE /api/agent/mealplan?id=ENTRY_ID
export async function DELETE(req: NextRequest) {
  if (!verifyAgent(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  await connectDB()
  const entry = await MealPlan.findByIdAndDelete(id).lean()
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

  return NextResponse.json({ success: true })
}
