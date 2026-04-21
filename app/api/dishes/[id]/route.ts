import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Dish } from '@/lib/models/Dish'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectDB()
  const dish = await Dish.findById(id).lean()
  if (!dish) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(dish)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectDB()
  const body = await request.json()
  const dish = await Dish.findByIdAndUpdate(id, { $set: body }, { new: true })
  if (!dish) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(dish)
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectDB()
  await Dish.findByIdAndUpdate(id, { $set: { deletedAt: new Date() } })
  return NextResponse.json({ success: true })
}
