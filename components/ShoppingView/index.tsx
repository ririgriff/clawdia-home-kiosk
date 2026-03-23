'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, UtensilsCrossed, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { IMealPlanEntry, MEAL_SLOTS } from '@/lib/types'
import { TIMEZONE, getMemberInitials, getMemberColor } from '@/config/family'
import DishViewSheet from '@/components/MealPlanner/DishViewSheet'

function toDateString(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export default function ShoppingView() {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()))
  const [entries, setEntries] = useState<IMealPlanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingEntry, setViewingEntry] = useState<IMealPlanEntry | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekStartStr = toDateString(weekStart)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/meal-plan?weekStart=${weekStartStr}&full=true`)
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false) })
  }, [weekStartStr])

  async function updateEntry(entryId: string, updates: { eaters: string[]; note: string }) {
    await fetch(`/api/meal-plan/${entryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setEntries(prev => prev.map(e => e._id === entryId ? { ...e, ...updates } : e))
  }

  // Build ingredient list: one entry per unique dish (deduped by dish_id), sorted by ingredient name
  const ingredientRows = useMemo(() => {
    const seenDishIds = new Set<string>()
    const rows: { key: string; quantity: string; unit: string; name: string; dishName: string; critical_notes?: string }[] = []

    entries.forEach(entry => {
      if (!entry.dish?._id || seenDishIds.has(entry.dish._id)) return
      seenDishIds.add(entry.dish._id)
      const ingredients = entry.dish?.ingredients ?? []
      ingredients.forEach((ing, i) => {
        rows.push({
          key: `${entry.dish!._id}-${i}`,
          quantity: ing.quantity ?? '',
          unit: ing.unit ?? '',
          name: ing.name,
          dishName: entry.dish!.name,
          critical_notes: ing.critical_notes,
        })
      })
    })

    return rows.sort((a, b) => a.name.localeCompare(b.name))
  }, [entries])

  const weekLabel = weekStart.toLocaleDateString('en-HK', { month: 'short', day: 'numeric' }) +
    ' – ' + addDays(weekStart, 6).toLocaleDateString('en-HK', { month: 'short', day: 'numeric' })

  return (
    <div className="flex flex-col min-h-0 pb-24">
      {/* Week navigator */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--parchment-3)' }}>
        <button onClick={() => setWeekStart(w => addDays(w, -7))}
          className="print:hidden flex items-center justify-center rounded-xl"
          style={{ width: 44, height: 44, color: 'var(--ink-3)' }}>
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="text-base font-medium" style={{ color: 'var(--ink)' }}>
          Week of {weekLabel}
        </span>
        <div className="print:hidden flex items-center gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl text-sm font-medium px-4"
            style={{ height: 44, background: 'var(--parchment-5)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
            <Printer size={16} strokeWidth={1.75} />
            Print
          </button>
          <button onClick={() => setWeekStart(w => addDays(w, 7))}
            className="flex items-center justify-center rounded-xl"
            style={{ width: 44, height: 44, color: 'var(--ink-3)' }}>
            <ChevronRight size={20} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--ink-4)' }}>
          Loading…
        </div>
      ) : (
        <div className="flex flex-col gap-8 px-4 sm:px-8 py-6">

          {/* This week's meals */}
          <section>
            <h2 className="font-display font-medium text-lg mb-4" style={{ color: 'var(--ink)' }}>
              This week's meals
            </h2>
            <div className="flex flex-col gap-3">
              {weekDates.map(date => {
                const dateStr = toDateString(date)
                const dayEntries = entries.filter(e => e.date === dateStr)
                if (dayEntries.length === 0) return null
                const dayLabel = date.toLocaleDateString('en-HK', { weekday: 'long', month: 'short', day: 'numeric' })

                return (
                  <div key={dateStr} className="rounded-2xl overflow-hidden"
                    style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)' }}>
                    <div className="px-4 py-3"
                      style={{ borderBottom: '1px solid var(--border)', background: 'var(--parchment-4)' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{dayLabel}</p>
                    </div>
                    {MEAL_SLOTS.map(slot => {
                      const slotEntries = dayEntries.filter(e => e.slot === slot.value)
                      if (slotEntries.length === 0) return null
                      return (
                        <div key={slot.value}>
                          {slotEntries.map((entry, idx) => (
                            <button key={entry._id}
                              onClick={() => setViewingEntry(entry)}
                              className="w-full flex items-center gap-3 px-4 text-left print:pointer-events-none"
                              style={{
                                minHeight: 56,
                                borderTop: idx === 0 ? undefined : '1px solid var(--border)',
                              }}>
                              {entry.dish?.image_url ? (
                                <img src={entry.dish.image_url} alt={entry.dish.name}
                                  className="w-10 h-10 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                  style={{ background: 'var(--parchment-5)' }}>
                                  <UtensilsCrossed size={16} strokeWidth={1.25} style={{ color: 'var(--ink-4)' }} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                                  {entry.dish?.name ?? '—'}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-xs" style={{ color: 'var(--ink-4)' }}>{slot.label}</span>
                                  {(entry.eaters ?? []).map(id => {
                                    const c = getMemberColor(id)
                                    return (
                                      <span key={id} className="text-xs font-medium px-1.5 rounded"
                                        style={{
                                          paddingTop: 1, paddingBottom: 1,
                                          background: c ? `color-mix(in srgb, ${c.solid} 15%, transparent)` : 'var(--parchment-5)',
                                          color: c?.solid ?? 'var(--ink-3)',
                                        }}>
                                        {getMemberInitials(id)}
                                      </span>
                                    )
                                  })}
                                </div>
                                {entry.dish?.critical_notes && (
                                  <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>
                                    {entry.dish.critical_notes}
                                  </p>
                                )}
                              </div>
                              {entry.dish?.reference_url && (
                                <div className="hidden print:block shrink-0 ml-2">
                                  <QRCodeSVG value={entry.dish.reference_url} size={56} />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              {entries.length === 0 && (
                <p className="text-sm py-6 text-center" style={{ color: 'var(--ink-4)' }}>
                  No meals planned for this week.
                </p>
              )}
            </div>
          </section>

          {/* Shopping list */}
          {ingredientRows.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-medium text-lg" style={{ color: 'var(--ink)' }}>
                  Shopping list
                </h2>
                {checked.size > 0 && (
                  <button onClick={() => setChecked(new Set())}
                    className="print:hidden text-sm px-3 py-2 rounded-lg"
                    style={{ color: 'var(--ink-4)', minHeight: 44 }}>
                    Clear
                  </button>
                )}
              </div>
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)' }}>
                {ingredientRows.map((row, idx) => {
                  const isChecked = checked.has(row.key)
                  return (
                    <button key={row.key}
                      onClick={() => setChecked(prev => {
                        const next = new Set(prev)
                        isChecked ? next.delete(row.key) : next.add(row.key)
                        return next
                      })}
                      className="w-full flex items-center gap-3 px-4 text-left"
                      style={{
                        minHeight: 52,
                        borderTop: idx === 0 ? undefined : '1px solid var(--border)',
                        opacity: isChecked ? 0.45 : 1,
                      }}>
                      {/* Checkbox */}
                      <div className="shrink-0 flex items-center justify-center rounded"
                        style={{
                          width: 22, height: 22,
                          border: `2px solid ${isChecked ? 'var(--ember)' : 'var(--border)'}`,
                          background: isChecked ? 'var(--ember)' : 'transparent',
                        }}>
                        {isChecked && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm" style={{
                          color: 'var(--ink)',
                          textDecoration: isChecked ? 'line-through' : 'none',
                        }}>
                          {[row.quantity, row.unit, row.name].filter(Boolean).join(' ')}
                        </span>
                        {row.critical_notes && (
                          <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>{row.critical_notes}</p>
                        )}
                      </div>
                      <span className="text-xs shrink-0" style={{ color: 'var(--ink-4)' }}>
                        {row.dishName}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {viewingEntry && (
        <DishViewSheet
          entry={viewingEntry}
          onSave={updateEntry}
          onClose={() => setViewingEntry(null)}
        />
      )}
    </div>
  )
}
