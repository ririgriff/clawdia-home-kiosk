import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Dish } from '@/lib/models/Dish'

export async function GET(request: NextRequest) {
  await connectDB()
  const status = request.nextUrl.searchParams.get('status')
  const filter = status === 'pending'
    ? { status: 'pending' }
    : { status: { $ne: 'pending' } }
  const dishes = await Dish.find(filter)
    .select('-recipe -notes')
    .sort(status === 'pending' ? { createdAt: -1 } : { name: 1 })
    .lean()
  return NextResponse.json(dishes)
}

export async function POST(request: NextRequest) {
  await connectDB()
  const body = await request.json()
  const dish = await Dish.create(body)
  return NextResponse.json(dish, { status: 201 })
}
