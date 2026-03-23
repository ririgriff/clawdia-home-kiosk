import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { ScheduleEvent } from '@/lib/models/ScheduleEvent'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectDB()
  const event = await ScheduleEvent.findById(id).lean()
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...event, _id: (event as { _id: { toString(): string } })._id.toString() })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectDB()
  const body = await request.json()
  const event = await ScheduleEvent.findByIdAndUpdate(id, { $set: body }, { new: true })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...event.toObject(), _id: event._id.toString() })
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectDB()
  await ScheduleEvent.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
