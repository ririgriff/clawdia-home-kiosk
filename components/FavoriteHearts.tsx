'use client'

import { useState, useRef, useEffect } from 'react'
import { Heart, X } from 'lucide-react'
import { MEAL_MEMBERS } from '@/config/family'
import type { IDish } from '@/lib/types'

interface Props {
  dish: IDish
  variant?: 'compact' | 'row'
  /** Called after a successful API update with the new favorites array. */
  onUpdate?: (newFavorites: string[]) => void
}

export default function FavoriteHearts({ dish, variant = 'compact', onUpdate }: Props) {
  const [favorites, setFavorites] = useState<string[]>(dish.favorites ?? [])
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    setFavorites(dish.favorites ?? [])
  }, [dish._id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(memberId: string) {
    const next = favorites.includes(memberId)
      ? favorites.filter(id => id !== memberId)
      : [...favorites, memberId]
    setFavorites(next)
    const res = await fetch(`/api/dishes/${dish._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorites: next }),
    })
    if (!res.ok) { setFavorites(favorites); return }
    onUpdate?.(next)
  }

  // ── Row variant — permanent per-member heart buttons ──────────────────────
  if (variant === 'row') {
    return (
      <div className="flex items-center" style={{ gap: 3 }}>
        {MEAL_MEMBERS.map(m => {
          const active = favorites.includes(m.id)
          return (
            <button
              key={m.id}
              onClick={e => { e.stopPropagation(); toggle(m.id) }}
              className="flex flex-col items-center justify-center shrink-0"
              style={{ gap: 1, width: 20 }}
            >
              <Heart
                size={12}
                strokeWidth={1.75}
                fill={active ? m.color.solid : 'none'}
                style={{ color: active ? m.color.solid : 'var(--ink-4)' }}
              />
              <span style={{ fontSize: 8, fontWeight: 600, lineHeight: 1, color: active ? m.color.solid : 'var(--ink-4)' }}>
                {m.initials}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  // ── Compact variant — stacked hearts + fixed-position popover ─────────────
  const favorited = MEAL_MEMBERS.filter(m => favorites.includes(m.id))

  function openPopover(e: React.MouseEvent) {
    e.stopPropagation()
    const rect = anchorRef.current?.getBoundingClientRect()
    if (rect) {
      setPos({ top: rect.bottom + 6, left: rect.left })
    }
    setOpen(v => !v)
  }

  return (
    <>
      <button
        ref={anchorRef}
        onClick={openPopover}
        className="flex items-center justify-center rounded-full shrink-0"
        style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.85)', border: '1px solid var(--border)' }}
      >
        {favorited.length === 0 ? (
          <Heart size={13} strokeWidth={1.75} fill="none" style={{ color: 'var(--ink-4)' }} />
        ) : (() => {
          const shown = favorited.slice(0, 3)
          const HEART = 14, GAP = 4
          return (
            <div style={{ position: 'relative', width: HEART, height: HEART + (shown.length - 1) * GAP }}>
              {shown.map((m, i) => (
                <Heart
                  key={m.id}
                  size={HEART}
                  strokeWidth={0}
                  fill={m.color.solid}
                  style={{ position: 'absolute', top: i * GAP, left: 0, zIndex: i, color: m.color.solid, filter: 'drop-shadow(0 0.4px 0 white) drop-shadow(0.4px 0 0 white) drop-shadow(0 -0.4px 0 white) drop-shadow(-0.4px 0 0 white)' }}
                />
              ))}
            </div>
          )
        })()}
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside tap */}
          <div
            className="fixed inset-0 z-40"
            onClick={e => { e.stopPropagation(); setOpen(false) }}
          />
          {/* Popover */}
          <div
            className="fixed z-50 rounded-xl shadow-lg flex flex-col"
            style={{
              top: pos.top,
              left: pos.left,
              background: 'var(--parchment-3)',
              border: '1px solid var(--border-strong)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pl-3 pr-1 pt-1 pb-0.5">
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>Who likes this?</span>
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-lg"
                style={{ width: 28, height: 28, color: 'var(--ink-4)' }}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
            {/* Member buttons */}
            <div className="flex items-center gap-1 px-2 pb-2">
              {MEAL_MEMBERS.map(m => {
                const active = favorites.includes(m.id)
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    className="flex flex-col items-center justify-center gap-0.5 rounded-lg px-2"
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      background: active ? `color-mix(in srgb, ${m.color.solid} 15%, transparent)` : 'transparent',
                    }}
                  >
                    <Heart
                      size={18}
                      strokeWidth={1.75}
                      fill={active ? m.color.solid : 'none'}
                      style={{ color: active ? m.color.solid : 'var(--ink-4)' }}
                    />
                    <span style={{ fontSize: 10, color: active ? m.color.solid : 'var(--ink-4)', fontWeight: 500 }}>
                      {m.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
