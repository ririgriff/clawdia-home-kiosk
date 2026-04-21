import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Dish } from '@/lib/models/Dish'

export async function GET(request: NextRequest) {
  await connectDB()
  const status = request.nextUrl.searchParams.get('status')

  let filter: Record<string, unknown>
  let sortOrder: Record<string, 1 | -1>

  if (status === 'pending') {
    filter = { status: 'pending', deletedAt: null }
    sortOrder = { createdAt: -1 }
  } else if (status === 'deleted') {
    filter = { deletedAt: { $ne: null } }
    sortOrder = { deletedAt: -1 }
  } else {
    filter = { status: { $ne: 'pending' }, deletedAt: null }
    sortOrder = { name: 1 }
  }

  const dishes = await Dish.find(filter)
    .select('-recipe -notes')
    .sort(sortOrder)
    .lean()
  return NextResponse.json(dishes)
}

export async function POST(request: NextRequest) {
  await connectDB()
  const body = await request.json()
  const dish = await Dish.create(body)
  return NextResponse.json(dish, { status: 201 })
}
