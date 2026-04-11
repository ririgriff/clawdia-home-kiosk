'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, Trash2, X, Plus, ArrowUpRight } from 'lucide-react'
import { IMealPlanEntry, MealSlot, MEAL_SLOTS } from '@/lib/types'
import { getMemberInitials, getMemberColor } from '@/config/family'
import DishViewSheet from '@/components/MealPlanner/DishViewSheet'
import FavoriteHearts from '@/components/FavoriteHearts'

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekStart(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return toDateString(d)
}

export default function MealSummary({ compact }: { compact?: boolean }) {
  const [entries, setEntries] = useState<IMealPlanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDay, setActiveDay] = useState<'today' | 'tomorrow'>('today')

  async function removeEntry(entryId: string) {
    await fetch(`/api/meal-plan/${entryId}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e._id !== entryId))
  }

  async function updateEntry(entryId: string, updates: { eaters: string[]; note: string }) {
    await fetch(`/api/meal-plan/${entryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setEntries(prev => prev.map(e => e._id === entryId ? { ...e, ...updates } : e))
  }

  const today = toDateString(new Date())
  const tomorrow = toDateString(new Date(Date.now() + 86400000))

  useEffect(() => {
    const todayWeekStart = getWeekStart(new Date())
    const tomorrowDate = new Date(Date.now() + 86400000)
    const tomorrowWeekStart = getWeekStart(tomorrowDate)

    const fetches = [fetch(`/api/meal-plan?weekStart=${todayWeekStart}`).then(r => r.json())]
    if (tomorrowWeekStart !== todayWeekStart) {
      fetches.push(fetch(`/api/meal-plan?weekStart=${tomorrowWeekStart}`).then(r => r.json()))
    }

    Promise.all(fetches).then(results => {
      const all: IMealPlanEntry[] = results.flat()
      setEntries(all.filter((e: IMealPlanEntry) => e.date === today || e.date === tomorrow))
      setLoading(false)
    })
  }, [today, tomorrow])

  const days = [
    { date: today,    label: "Today's Meals",    key: 'today' as const },
    { date: tomorrow, label: "Tomorrow's Meals", key: 'tomorrow' as const },
  ]

  if (compact) {
    return (
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="px-4 flex items-center justify-between"
          style={{ background: 'var(--parchment-3)', borderBottom: '1px solid var(--border)', minHeight: 56 }}>
          <h2 className="font-display font-medium text-base" style={{ color: 'var(--ink)' }}>Today's Meals</h2>
          <Link href="/plan"
            className="flex items-center justify-center rounded-lg"
            style={{ minWidth: 44, minHeight: 44, color: 'var(--ink-4)' }}>
            <ArrowUpRight size={18} strokeWidth={1.75} />
          </Link>
        </div>
        {loading ? (
          <div className="px-4 py-3 text-sm" style={{ color: 'var(--ink-4)' }}>Loading...</div>
        ) : (
          <div>
            {MEAL_SLOTS.map(slot => {
              const slotEntries = entries.filter(e => e.date === today && e.slot === slot.value)
              return (
                <div key={slot.value} className="flex items-center gap-3 px-4"
                  style={{ borderBottom: '1px solid var(--border)', minHeight: 48 }}>
                  <span className="text-xs font-medium uppercase tracking-wide shrink-0"
                    style={{ width: 68, color: 'var(--ink-4)' }}>
                    {slot.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    {slotEntries.length === 0
                      ? <span className="text-sm" style={{ color: 'var(--ink-4)' }}>—</span>
                      : <span className="text-sm" style={{ color: 'var(--ink)' }}>
                          {slotEntries.map(e => e.dish?.name).filter(Boolean).join(', ')}
                        </span>
                    }
                  </div>
                  <Link href={`/plan?date=${today}&slot=${slot.value}`}
                    className="flex items-center justify-center rounded-lg shrink-0"
                    style={{ minWidth: 44, minHeight: 44, color: 'var(--ink-4)' }}>
                    <Plus size={14} strokeWidth={2} />
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--ink-4)' }}>
        Loading...
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Mobile tab switcher */}
      <div className="flex sm:hidden gap-1 p-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--parchment-3)' }}>
        {days.map(d => (
          <button key={d.key} onClick={() => setActiveDay(d.key)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={activeDay === d.key
              ? { background: 'var(--ember)', color: '#fff' }
              : { color: 'var(--ink-3)' }
            }>
            {d.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0 p-4 sm:p-6">

        {/* Desktop: 2-column grid */}
        <div className="hidden sm:grid grid-cols-2 gap-6 h-full">
          {days.map(({ date, label }) => (
            <DayColumn key={date} date={date} label={label} entries={entries} onRemove={removeEntry} onUpdate={updateEntry} />
          ))}
        </div>

        {/* Mobile: single active day */}
        <div className="sm:hidden flex flex-col gap-3">
          {(() => {
            const active = days.find(d => d.key === activeDay)!
            return <DayColumn date={active.date} label={active.label} entries={entries} onRemove={removeEntry} onUpdate={updateEntry} />
          })()}
        </div>
      </div>
    </div>
  )
}

function DayColumn({ date, label, entries, onRemove, onUpdate }: { date: string; label: string; entries: IMealPlanEntry[]; onRemove: (id: string) => void; onUpdate: (id: string, updates: { eaters: string[]; note: string }) => void }) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4 min-h-0">
      <h3 className="hidden sm:block font-display font-medium text-lg shrink-0" style={{ color: 'var(--ink)' }}>
        {label}
        <span className="ml-2 text-sm font-sans font-normal" style={{ color: 'var(--ink-4)' }}>
          {new Date(date + 'T12:00:00').toLocaleDateString('en-HK', { weekday: 'long', month: 'short', day: 'numeric' })}
        </span>
      </h3>
      <div className="flex flex-col gap-3">
        {MEAL_SLOTS.map(slot => {
          const slotEntries = entries.filter(e => e.date === date && e.slot === slot.value)
          return (
            <SlotRow key={slot.value} slot={slot.value} label={slot.label} date={date} entries={slotEntries} onRemove={onRemove} onUpdate={onUpdate} />
          )
        })}
      </div>
    </div>
  )
}

function SlotRow({ slot, label, date, entries, onRemove, onUpdate }: { slot: MealSlot; label: string; date: string; entries: IMealPlanEntry[]; onRemove: (id: string) => void; onUpdate: (id: string, updates: { eaters: string[]; note: string }) => void }) {
  const isEmpty = entries.length === 0

  return (
    <div className="rounded-2xl overflow-hidden shrink-0"
      style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)' }}>
      <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: isEmpty ? undefined : '1px solid var(--border)' }}>
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ink-4)' }}>
          {label}
        </span>
        <Link href={`/plan?date=${date}&slot=${slot}`}
          className="flex items-center justify-center rounded-lg"
          style={{ width: 28, height: 28, color: 'var(--ink-4)' }}>
          <Plus size={14} strokeWidth={2} />
        </Link>
      </div>
      {isEmpty ? (
        <div className="px-4 py-3 text-sm" style={{ color: 'var(--ink-4)' }}>—</div>
      ) : (
        <div className="p-3 flex flex-wrap gap-2">
          {entries.map(entry => (
            <DishCard key={entry._id} entry={entry} onRemove={onRemove} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}

function DishCard({ entry, onRemove, onUpdate }: { entry: IMealPlanEntry; onRemove: (id: string) => void; onUpdate: (id: string, updates: { eaters: string[]; note: string }) => void }) {
  const [showActions, setShowActions] = useState(false)
  const [showView, setShowView] = useState(false)
  const dish = entry.dish
  if (!dish) return null

  return (
    <div className="flex items-stretch rounded-xl overflow-hidden cursor-pointer relative"
      style={{ background: 'var(--parchment-4)', border: '1px solid var(--border)' }}
      onClick={() => setShowActions(true)}>
      {dish.image_url ? (
        <img src={dish.image_url} alt={dish.name} className="w-16 object-cover shrink-0 self-stretch" />
      ) : (
        <div className="w-16 shrink-0 flex items-center justify-center text-xl self-stretch"
          style={{ background: 'var(--parchment-5)' }}>
          🍽
        </div>
      )}
      <div className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center">
        <span className="text-sm font-medium leading-tight" style={{ color: 'var(--ink)' }}>
          {dish.name}
        </span>
        {dish.name_zh && (
          <span className="block text-xs font-normal" style={{ color: 'var(--ink-4)' }}>{dish.name_zh}</span>
        )}
        {dish.critical_notes && (
          <span className="block text-xs" style={{ color: '#ef4444' }}>{dish.critical_notes}</span>
        )}
        {entry.note && (
          <span className="block text-xs truncate" style={{ color: 'var(--ink-3)' }}>{entry.note}</span>
        )}
        {(entry.eaters ?? []).length > 0 && (
          <div className="flex gap-1 mt-0.5 mb-1.5 flex-wrap">
            {(entry.eaters ?? []).map(id => {
              const c = getMemberColor(id)
              return (
                <span key={id} className="text-xs font-medium px-1.5 rounded"
                  style={{ paddingTop: 1, paddingBottom: 1,
                    background: c ? `color-mix(in srgb, ${c.solid} 15%, transparent)` : 'var(--parchment-5)',
                    color: c?.solid ?? 'var(--ink-3)' }}>
                  {getMemberInitials(id)}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Favorites hearts */}
      <div className="shrink-0 self-center mr-2">
        <FavoriteHearts dish={dish} variant="compact" />
      </div>

      {showActions && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={e => { e.stopPropagation(); setShowActions(false) }}>
          {/* Dismiss button — top-right corner */}
          <button
            onClick={e => { e.stopPropagation(); setShowActions(false) }}
            className="absolute top-1 right-1 flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.7)' }}>
            <X size={14} strokeWidth={2} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); setShowActions(false); setShowView(true) }}
            className="flex flex-col items-center justify-center gap-1 rounded-xl"
            style={{ width: 45, height: 45, background: 'var(--parchment-3)', color: 'var(--ink-2)' }}>
            <Eye size={14} strokeWidth={1.75} />
            <span style={{ fontSize: 9, fontWeight: 500 }}>View</span>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onRemove(entry._id) }}
            className="flex flex-col items-center justify-center gap-1 rounded-xl"
            style={{ width: 45, height: 45, background: '#ef4444', color: '#fff' }}>
            <Trash2 size={14} strokeWidth={1.75} />
            <span style={{ fontSize: 9, fontWeight: 500 }}>Remove</span>
          </button>
        </div>
      )}

      {showView && (
        <DishViewSheet
          entry={entry}
          onSave={onUpdate}
          onClose={() => setShowView(false)}
        />
      )}
    </div>
  )
}
