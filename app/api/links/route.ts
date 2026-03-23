import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Link } from '@/lib/models/Link'

export async function GET() {
  await connectDB()
  const links = await Link.find().sort({ category: 1, order: 1, createdAt: 1 }).lean()
  return NextResponse.json(links)
}

export async function POST(request: NextRequest) {
  await connectDB()
  const body = await request.json()
  const link = await Link.create(body)
  return NextResponse.json(link, { status: 201 })
}
