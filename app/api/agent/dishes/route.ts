import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Dish } from '@/lib/models/Dish'

function verifyAgent(req: NextRequest): boolean {
  const key = process.env.AGENT_API_KEY
  if (!key) return false
  return req.headers.get('authorization') === `Bearer ${key}`
}

// GET — list active dishes (so agent can check what already exists)
export async function GET(req: NextRequest) {
  if (!verifyAgent(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await connectDB()
  const dishes = await Dish.find({ status: { $ne: 'pending' } })
    .select('_id name name_zh category tags who_for available')
    .sort({ name: 1 })
    .lean()
  return NextResponse.json(dishes)
}

// PATCH — update fields on an existing dish
export async function PATCH(req: NextRequest) {
  if (!verifyAgent(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { id, ...fields } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const ALLOWED = ['notes', 'critical_notes', 'tags', 'available', 'typically_served', 'name', 'name_zh']
  const update: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in fields) update[key] = fields[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  await connectDB()
  const dish = await Dish.findByIdAndUpdate(id, { $set: update }, { new: true })
    .select('_id name notes critical_notes tags available typically_served').lean()

  if (!dish) {
    return NextResponse.json({ error: 'Dish not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, dish })
}

// POST — submit a dish for review
export async function POST(req: NextRequest) {
  if (!verifyAgent(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  if (!body.name || !body.category) {
    return NextResponse.json(
      { error: 'name and category are required' },
      { status: 400 }
    )
  }

  await connectDB()
  const dish = await Dish.create({
    ...body,
    status: 'pending',
    source: 'agent',
  })

  return NextResponse.json(
    { success: true, dish: { _id: dish._id, name: dish.name, status: dish.status } },
    { status: 201 }
  )
}
