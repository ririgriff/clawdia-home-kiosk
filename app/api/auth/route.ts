import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { RateLimit } from '@/lib/models/RateLimit'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

async function computeToken(pin: string): Promise<string> {
  const salt = process.env.AUTH_SALT ?? 'kiosk-default-salt'
  const data = new TextEncoder().encode(pin + salt)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(request: NextRequest) {
  const { pin } = await request.json()
  const ip = getIP(request)

  await connectDB()

  // ── Check if currently locked out ────────────────────────────────────────
  const record = await RateLimit.findOne({ ip })
  if (record?.lockedUntil && record.lockedUntil > new Date()) {
    return NextResponse.json(
      { error: 'Too many attempts', lockedUntil: record.lockedUntil },
      { status: 429 }
    )
  }

  // ── Verify PIN ────────────────────────────────────────────────────────────
  if (!pin || pin !== process.env.KIOSK_PIN) {
    const attempts = (record?.attempts ?? 0) + 1
    const lockedUntil = attempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_MS)
      : undefined

    await RateLimit.findOneAndUpdate(
      { ip },
      { ip, attempts, lockedUntil },
      { upsert: true }
    )

    return NextResponse.json(
      lockedUntil
        ? { error: 'Too many attempts', lockedUntil }
        : { error: 'Incorrect PIN', attemptsLeft: MAX_ATTEMPTS - attempts },
      { status: 401 }
    )
  }

  // ── Success — clear rate limit and set cookie ─────────────────────────────
  await RateLimit.deleteOne({ ip })

  const token = await computeToken(pin)
  const response = NextResponse.json({ success: true })
  response.cookies.set('kiosk-auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return response
}
