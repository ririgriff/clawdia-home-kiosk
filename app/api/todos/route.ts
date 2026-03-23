import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { TodoItem } from '@/lib/models/TodoItem'

// GET /api/todos — returns all todo items sorted by date asc (nulls last), then createdAt
export async function GET() {
  await connectDB()
  // Mongo sorts null/missing date fields first with asc; we want them last.
  // Fetch all and sort in JS so undated items appear after dated ones.
  const todos = await TodoItem.find({}).sort({ createdAt: 1 }).lean()
  const serialised = todos.map(t => ({ ...t, _id: t._id.toString() }))
  // Stable sort: dated first (ascending), then undated
  serialised.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date)
    if (a.date) return -1
    if (b.date) return 1
    return 0
  })
  return NextResponse.json(serialised)
}

// POST /api/todos — create a new todo item
export async function POST(req: NextRequest) {
  await connectDB()
  const body = await req.json()
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  const todo = await TodoItem.create({
    ...body,
    title:  body.title.trim(),
    source: body.source ?? 'manual',
    done:   false,
  })
  return NextResponse.json({ ...todo.toObject(), _id: todo._id.toString() }, { status: 201 })
}
