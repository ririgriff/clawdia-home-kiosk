import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Taxonomy } from '@/lib/models/Taxonomy'

const COLOR_POOL = [
  'bg-blue-100 text-blue-800',
  'bg-red-100 text-red-800',
  'bg-green-100 text-green-800',
  'bg-yellow-100 text-yellow-800',
  'bg-amber-100 text-amber-800',
  'bg-cyan-100 text-cyan-800',
  'bg-purple-100 text-purple-800',
  'bg-lime-100 text-lime-800',
  'bg-pink-100 text-pink-800',
  'bg-teal-100 text-teal-800',
  'bg-orange-100 text-orange-800',
  'bg-indigo-100 text-indigo-800',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
]

const SEED_CATEGORIES = [
  { value: 'soup',         label: 'Soup',         color: 'bg-blue-100 text-blue-800' },
  { value: 'main-protein', label: 'Main Protein', color: 'bg-red-100 text-red-800' },
  { value: 'vegetable',    label: 'Vegetable',    color: 'bg-green-100 text-green-800' },
  { value: 'egg',          label: 'Egg Dish',     color: 'bg-yellow-100 text-yellow-800' },
  { value: 'carb',         label: 'Carb / Staple', color: 'bg-amber-100 text-amber-800' },
  { value: 'cold-dish',    label: 'Cold Dish',    color: 'bg-cyan-100 text-cyan-800' },
  { value: 'fruit',        label: 'Fruit',        color: 'bg-lime-100 text-lime-800' },
  { value: 'dessert',      label: 'Dessert',      color: 'bg-pink-100 text-pink-800' },
  { value: 'drink',        label: 'Drink',        color: 'bg-teal-100 text-teal-800' },
]

const SEED_TAGS = [
  'beef', 'pork', 'chicken', 'fish', 'seafood', 'tofu',
  'quick', 'slow-cook', 'adult',
  'western', 'chinese', 'thai', 'japanese',
]

export async function GET() {
  await connectDB()

  const count = await Taxonomy.countDocuments()
  if (count === 0) {
    await Taxonomy.insertMany([
      ...SEED_CATEGORIES.map(c => ({ type: 'category', ...c })),
      ...SEED_TAGS.map(t => ({
        type: 'tag',
        value: t.toLowerCase().replace(/\s+/g, '-'),
        label: t,
        color: '',
      })),
    ])
  }

  const items = await Taxonomy.find().sort({ type: 1, label: 1 }).lean()
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  await connectDB()
  const { type, label } = await req.json()
  if (!type || !label?.trim()) {
    return NextResponse.json({ error: 'type and label required' }, { status: 400 })
  }

  const value = label.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  // Pick next color from pool for categories
  let color = ''
  if (type === 'category') {
    const catCount = await Taxonomy.countDocuments({ type: 'category' })
    color = COLOR_POOL[catCount % COLOR_POOL.length]
  }

  try {
    const item = await Taxonomy.create({ type, value, label: label.trim(), color })
    return NextResponse.json(item, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 11000) {
      return NextResponse.json({ error: 'Already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
