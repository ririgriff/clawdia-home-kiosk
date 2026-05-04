import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Dish } from '@/lib/models/Dish'
import { MealPlan } from '@/lib/models/MealPlan'

export async function GET(request: NextRequest) {
  await connectDB()
  const status = request.nextUrl.searchParams.get('status')

  if (status === 'pending') {
    const dishes = await Dish.find({ status: 'pending', deletedAt: null })
      .select('-recipe -notes')
      .sort({ createdAt: -1 })
      .lean()
    return NextResponse.json(dishes)
  }

  if (status === 'deleted') {
    const dishes = await Dish.find({ deletedAt: { $ne: null } })
      .select('-recipe -notes')
      .sort({ deletedAt: -1 })
      .lean()
    return NextResponse.json(dishes)
  }

  const [dishes, counts] = await Promise.all([
    Dish.find({ status: { $ne: 'pending' }, deletedAt: null })
      .select('-recipe -notes')
      .lean(),
    MealPlan.aggregate([{ $group: { _id: '$dish_id', count: { $sum: 1 } } }]),
  ])

  const countMap: Record<string, number> = Object.fromEntries(
    counts.map((c: { _id: string; count: number }) => [c._id, c.count])
  )

  dishes.sort((a, b) => {
    const diff = (countMap[String(b._id)] ?? 0) - (countMap[String(a._id)] ?? 0)
    return diff !== 0 ? diff : a.name.localeCompare(b.name)
  })

  return NextResponse.json(dishes)
}

export async function POST(request: NextRequest) {
  await connectDB()
  const body = await request.json()
  const dish = await Dish.create(body)
  return NextResponse.json(dish, { status: 201 })
}
