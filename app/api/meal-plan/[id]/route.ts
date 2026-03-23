import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { MealPlan } from '@/lib/models/MealPlan'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  await connectDB()
  await MealPlan.findByIdAndUpdate(id, { $set: body })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await connectDB()
  await MealPlan.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}
