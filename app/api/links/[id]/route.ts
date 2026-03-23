import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Link } from '@/lib/models/Link'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  const body = await request.json()
  const link = await Link.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
  return NextResponse.json(link)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  await Link.findByIdAndDelete(id)
  return NextResponse.json({ ok: true })
}
