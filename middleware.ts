import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/pin', '/api/auth', '/api/agent', '/api/cron', '/api/ical', '/_next/image']

async function computeExpectedToken(): Promise<string> {
  const pin = process.env.KIOSK_PIN ?? ''
  const salt = process.env.AUTH_SALT ?? 'kiosk-default-salt'
  const data = new TextEncoder().encode(pin + salt)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Pass through static assets (images, fonts, etc.)
  if (/\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/.test(pathname)) {
    return NextResponse.next()
  }

  const authCookie = request.cookies.get('kiosk-auth')?.value
  const expected = await computeExpectedToken()

  if (authCookie !== expected) {
    return NextResponse.redirect(new URL('/pin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
