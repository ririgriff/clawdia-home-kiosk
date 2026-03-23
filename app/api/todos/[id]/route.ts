import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { TodoItem } from '@/lib/models/TodoItem'

type Ctx = { params: Promise<{ id: string }> }

// PUT /api/todos/:id — update a todo item
// Handles:
//   { done: true }               → sets doneAt to now
//   { done: false }              → clears doneAt
//   { source: 'manual' }        → converts auto item to manual (autoGenKey preserved for cron dedup)
//   { title, assignee, date }   → free-form field updates
export async function PUT(req: NextRequest, { params }: Ctx) {
  await connectDB()
  const { id } = await params
  const body = await req.json()
  const update: Record<string, unknown> = { ...body }

  if (body.done === true)  update.doneAt = new Date()
  if (body.done === false) update.doneAt = null

  const updated = await TodoItem.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true },
  ).lean()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...updated, _id: updated._id.toString() })
}

// DELETE /api/todos/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  await connectDB()
  const { id } = await params
  const deleted = await TodoItem.findByIdAndDelete(id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
