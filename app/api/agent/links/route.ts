import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Link } from '@/lib/models/Link'
import { LINK_CATEGORIES } from '@/lib/types'

function verifyAgent(req: NextRequest): boolean {
  const key = process.env.AGENT_API_KEY
  if (!key) return false
  return req.headers.get('authorization') === `Bearer ${key}`
}

// GET /api/agent/links?category=kids|food|other
export async function GET(req: NextRequest) {
  if (!verifyAgent(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const category = req.nextUrl.searchParams.get('category')
  const filter = category ? { category } : {}
  const links = await Link.find(filter).sort({ category: 1, order: 1, createdAt: 1 }).lean()
  return NextResponse.json({ count: links.length, links })
}

// POST /api/agent/links
export async function POST(req: NextRequest) {
  if (!verifyAgent(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.title || !body.url || !body.category) {
    return NextResponse.json({ error: 'title, url, and category are required' }, { status: 400 })
  }
  const validCategories = LINK_CATEGORIES.map(c => c.value)
  if (!validCategories.includes(body.category)) {
    return NextResponse.json({ error: `category must be one of: ${validCategories.join(', ')}` }, { status: 400 })
  }

  await connectDB()
  const link = await Link.create(body)
  return NextResponse.json({ success: true, link }, { status: 201 })
}

// PUT /api/agent/links?id=LINK_ID
export async function PUT(req: NextRequest) {
  if (!verifyAgent(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 })

  await connectDB()
  const body = await req.json()
  const link = await Link.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
  if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  return NextResponse.json({ success: true, link })
}

// DELETE /api/agent/links?id=LINK_ID
export async function DELETE(req: NextRequest) {
  if (!verifyAgent(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 })

  await connectDB()
  const deleted = await Link.findByIdAndDelete(id)
  if (!deleted) return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
