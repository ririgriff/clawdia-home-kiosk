import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Settings } from '@/lib/models/Settings'
import { FALLBACK_HOME_DEFAULTS } from '@/lib/home-method'

const KEY = 'go-home'

export async function GET() {
  await connectDB()
  const doc = await Settings.findOne({ key: KEY }).lean() as { value: unknown } | null
  return NextResponse.json(doc?.value ?? FALLBACK_HOME_DEFAULTS)
}

export async function PUT(request: NextRequest) {
  await connectDB()
  const value = await request.json()
  await Settings.updateOne({ key: KEY }, { $set: { value } }, { upsert: true })
  return NextResponse.json(value)
}
