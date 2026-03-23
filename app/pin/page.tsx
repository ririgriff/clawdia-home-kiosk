'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Delete } from 'lucide-react'
import { APP_NAME, MASCOT_FULL } from '@/config/family'

const PIN_LENGTH = 6

function useCountdown(lockedUntil: Date | null): string | null {
  const [display, setDisplay] = useState<string | null>(null)

  useEffect(() => {
    if (!lockedUntil) { setDisplay(null); return }

    function update() {
      const secsLeft = Math.ceil((lockedUntil!.getTime() - Date.now()) / 1000)
      if (secsLeft <= 0) { setDisplay(null); return }
      const m = Math.floor(secsLeft / 60)
      const s = secsLeft % 60
      setDisplay(`${m}:${String(s).padStart(2, '0')}`)
    }

    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [lockedUntil])

  return display
}

export default function PinPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const countdown = useCountdown(lockedUntil)
  // Clear lockout once countdown expires
  useEffect(() => {
    if (lockedUntil && !countdown) {
      setLockedUntil(null)
      setError('')
      setAttemptsLeft(null)
    }
  }, [countdown, lockedUntil])

  useEffect(() => {
    if (pin.length === PIN_LENGTH) verify(pin)
  }, [pin])

  async function verify(currentPin: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: currentPin }),
      })

      if (res.ok) {
        router.push('/')
        router.refresh()
        return
      }

      let data: { lockedUntil?: string; attemptsLeft?: number } = {}
      try { data = await res.json() } catch { /* non-JSON error body */ }

      if (res.status === 429 || data.lockedUntil) {
        setLockedUntil(new Date(data.lockedUntil!))
        setError('Too many incorrect attempts.')
        setAttemptsLeft(null)
      } else {
        setAttemptsLeft(data.attemptsLeft ?? null)
        setError('Incorrect PIN')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
      setPin('')
    }
  }

  function handleDigit(d: string) {
    if (loading || !!lockedUntil) return
    if (d === 'DEL') { setPin(p => p.slice(0, -1)); setError(''); setAttemptsLeft(null) }
    else if (pin.length < PIN_LENGTH) setPin(p => p + d)
  }

  const isLocked = !!lockedUntil && !!countdown
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL']

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--parchment)' }}>
      <div className="rounded-3xl p-12 w-[420px] text-center"
        style={{ background: 'var(--parchment-3)', border: '1px solid var(--border-strong)' }}>

        <div className="flex justify-center mb-4">
          <img src={MASCOT_FULL} alt={APP_NAME} width={160} height={160} className="object-contain" />
        </div>
        <h1 className="font-display text-3xl font-medium mb-2" style={{ color: 'var(--ink)' }}>
          {APP_NAME}
        </h1>
        <p className="text-base mb-10" style={{ color: 'var(--ink-4)' }}>Enter PIN to continue</p>

        {/* PIN dots */}
        <div className="flex justify-center gap-4 mb-8">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div key={i} className="w-4 h-4 rounded-full transition-all duration-150"
              style={{
                background: i < pin.length ? 'var(--ember)' : 'var(--border-dashed)',
                transform: i < pin.length ? 'scale(1.25)' : 'scale(1)',
              }} />
          ))}
        </div>

        {/* Status messages */}
        <div className="mb-4 min-h-[48px] flex flex-col items-center justify-center gap-1">
          {isLocked ? (
            <>
              <p className="text-base font-medium" style={{ color: '#f87171' }}>{error}</p>
              <p className="text-base tabular-nums" style={{ color: 'var(--ink-3)' }}>
                Try again in <span className="font-semibold" style={{ color: 'var(--ink)' }}>{countdown}</span>
              </p>
            </>
          ) : error ? (
            <>
              <p className="text-base" style={{ color: '#f87171' }}>{error}</p>
              {attemptsLeft !== null && attemptsLeft <= 2 && (
                <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                  {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left before lockout
                </p>
              )}
            </>
          ) : null}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4">
          {digits.map((d, i) => (
            <button key={i}
              onClick={() => d && handleDigit(d)}
              disabled={loading || isLocked || !d}
              className={`h-24 rounded-2xl text-2xl font-medium transition-all active:scale-95 select-none flex items-center justify-center ${!d ? 'invisible' : 'cursor-pointer'}`}
              style={d ? {
                background: isLocked ? 'var(--parchment-5)' : 'var(--parchment-4)',
                color: isLocked ? 'var(--ink-4)' : 'var(--ink)',
                border: '1px solid var(--border)',
                opacity: isLocked ? 0.5 : 1,
              } : {}}
            >
              {d === 'DEL' ? <Delete size={24} strokeWidth={1.5} /> : d}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
