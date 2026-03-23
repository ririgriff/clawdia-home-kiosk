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
export async function GET(req: NextRequest) {
  if (!verifyAgent(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date is required (format: YYYY-MM-DD)' }, { status: 400 })
  }

  await connectDB()

  const entries = await MealPlan.find({ date }).lean()

  const dishIds = [...new Set(entries.map(e => e.dish_id))]
  const dishes = await Dish.find({ _id: { $in: dishIds } }).lean()
  const dishMap = Object.fromEntries(dishes.map(d => [d._id.toString(), d]))

  // Group by slot in meal order
  const slotOrder = ['breakfast', 'lunch', 'snack', 'dinner']
  const grouped: Record<string, { dish: string; eaters: string[] }[]> = {}

  for (const slot of slotOrder) grouped[slot] = []

  for (const entry of entries) {
    const dish = dishMap[entry.dish_id]
    const slot = entry.slot
    if (!grouped[slot]) grouped[slot] = []
    grouped[slot].push({ dish: dish ? dish.name : 'Unknown dish', eaters: entry.eaters ?? [] })
  }

  return NextResponse.json({ date, slots: grouped })
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
