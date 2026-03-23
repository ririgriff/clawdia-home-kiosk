import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { TodoItem } from '@/lib/models/TodoItem'

function verifyAgent(req: NextRequest): boolean {
  const key = process.env.AGENT_API_KEY
  if (!key) return false
  return req.headers.get('authorization') === `Bearer ${key}`
}

/**
 * GET /api/agent/todos
 *
 * Query params (pick one):
 *   ?date=YYYY-MM-DD   → todos for that specific date + all general (undated) items
 *   ?all=true          → everything
 *   (none)             → all non-done items
 */
export async function GET(req: NextRequest) {
  if (!verifyAgent(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const params = req.nextUrl.searchParams
  const date   = params.get('date')
  const all    = params.get('all') === 'true'

  let filter: Record<string, unknown> = {}
  if (!all) {
    if (date) {
      filter = { $or: [{ date }, { date: { $exists: false } }, { date: null }] }
    } else {
      filter = { done: false }
    }
  }

  const todos = await TodoItem.find(filter).sort({ date: 1, createdAt: 1 }).lean()
  return NextResponse.json({
    count: todos.length,
    todos: todos.map(t => ({ ...t, _id: t._id.toString() })),
  })
}

// POST /api/agent/todos — create a todo item
export async function POST(req: NextRequest) {
  if (!verifyAgent(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const body = await req.json()
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  const todo = await TodoItem.create({ ...body, title: body.title.trim(), source: 'agent', done: false })
  return NextResponse.json(
    { success: true, todo: { ...todo.toObject(), _id: todo._id.toString() } },
    { status: 201 },
  )
}

// PUT /api/agent/todos?id=ID — update (title, done, assignee, date, source)
export async function PUT(req: NextRequest) {
  if (!verifyAgent(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 })

  await connectDB()
  const body   = await req.json()
  const update = { ...body }
  if (body.done === true)  update.doneAt = new Date()
  if (body.done === false) update.doneAt = null

  const updated = await TodoItem.findByIdAndUpdate(id, { $set: update }, { new: true }).lean()
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, todo: { ...updated, _id: updated._id.toString() } })
}

// DELETE /api/agent/todos?id=ID
export async function DELETE(req: NextRequest) {
  if (!verifyAgent(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 })

  await connectDB()
  const deleted = await TodoItem.findByIdAndDelete(id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
