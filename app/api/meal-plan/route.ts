import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { MealPlan } from '@/lib/models/MealPlan'
import { Dish } from '@/lib/models/Dish'

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// GET /api/meal-plan?weekStart=YYYY-MM-DD
export async function GET(request: NextRequest) {
  await connectDB()

  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('weekStart')
  const full = searchParams.get('full') === 'true'

  if (!weekStart) {
    return NextResponse.json({ error: 'weekStart required' }, { status: 400 })
  }

  const [year, month, day] = weekStart.split('-').map(Number)
  const start = new Date(year, month - 1, day)

  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    dates.push(toDateString(d))
  }

  const entries = await MealPlan.find({ date: { $in: dates } }).lean()

  const dishIds = [...new Set(entries.map(e => e.dish_id))]
  const dishFields = full
    ? 'name name_zh category tags favorites image_url who_for available typically_served critical_notes ingredients recipe notes reference_url'
    : 'name name_zh category tags favorites image_url who_for available typically_served critical_notes'
  const dishes = await Dish.find({ _id: { $in: dishIds } })
    .select(dishFields)
    .lean()
  const dishMap = Object.fromEntries(dishes.map(d => [d._id.toString(), d]))

  const enriched = entries.map(e => ({
    ...e,
    _id: e._id.toString(),
    dish: dishMap[e.dish_id],
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: NextRequest) {
  await connectDB()
  const body = await request.json()
  const entry = await MealPlan.create(body)
  return NextResponse.json({ ...entry.toObject(), _id: entry._id.toString() }, { status: 201 })
}
