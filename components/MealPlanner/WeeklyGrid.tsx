import React, { useState, useEffect } from 'react'
import { IMealPlanEntry, MEAL_SLOTS, MealSlot } from '@/lib/types'
import MealSlotCell from './MealSlotCell'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Landscape constants (slots = rows, days = columns)
const SLOT_COL_W   = 72
const MIN_DAY_COL_W = 150

// Portrait constants (days = rows, slots = columns)
const DAY_LABEL_W    = 68
const MIN_SLOT_COL_W = 80

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  weekDates: string[]
  entries: IMealPlanEntry[]
  onCellTap: (date: string, slot: MealSlot) => void
  onOpenDetail: (date: string, slot: MealSlot) => void
  onRemoveEntry: (entryId: string) => void
  onUpdateEntry: (entryId: string, updates: { eaters: string[]; note: string }) => void
}

export default function WeeklyGrid({ weekDates, entries, onCellTap, onRemoveEntry, onUpdateEntry }: Props) {
  const today = todayString()

  const [isPortrait, setIsPortrait] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    setIsPortrait(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ─── Portrait: days as rows, slots as columns ───────────────────────────────
  if (isPortrait) {
    return (
      <div className="overflow-auto h-full w-full">
        <div className="flex flex-col min-h-full" style={{ minWidth: DAY_LABEL_W + MIN_SLOT_COL_W * MEAL_SLOTS.length }}>

          {/* Header row: slot names */}
          <div className="flex sticky top-0 z-10"
            style={{ background: 'var(--parchment-3)', borderBottom: '1px solid var(--border)' }}>
            {/* Corner */}
            <div className="shrink-0 sticky left-0 z-20"
              style={{ width: DAY_LABEL_W, background: 'var(--parchment-3)', borderRight: '1px solid var(--border)' }} />
            {MEAL_SLOTS.map(({ value: slot, label }) => (
              <div key={slot} className="flex-1 text-center py-3"
                style={{ minWidth: MIN_SLOT_COL_W, borderRight: '1px solid var(--border)' }}>
                <span className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--ink-4)' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Day rows */}
          {weekDates.map((date, i) => {
            const isToday = date === today
            return (
              <div key={date} className="flex flex-1" style={{ borderBottom: '1px solid var(--border)' }}>
                {/* Day label — sticky left */}
                <div className="shrink-0 sticky left-0 z-10 flex flex-col items-center justify-center self-stretch py-2 gap-0.5"
                  style={{
                    width: DAY_LABEL_W,
                    background: isToday ? 'var(--ember-bg)' : 'var(--parchment-3)',
                    borderRight: isToday ? '2px solid var(--ember)' : '1px solid var(--border)',
                  }}>
                  <span className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: isToday ? 'var(--ember)' : 'var(--ink-4)' }}>
                    {DAY_LABELS[i]}
                  </span>
                  <span className="font-display text-xl leading-none"
                    style={{ color: isToday ? 'var(--ember)' : 'var(--ink)' }}>
                    {new Date(date + 'T12:00:00').getDate()}
                  </span>
                </div>

                {/* Slot cells */}
                {MEAL_SLOTS.map(({ value: slot }) => (
                  <MealSlotCell
                    key={`${date}-${slot}`}
                    date={date}
                    slot={slot}
                    entries={entries.filter(e => e.date === date && e.slot === slot)}
                    onTap={onCellTap}
                    onRemove={onRemoveEntry}
                    onUpdate={onUpdateEntry}
                    isToday={isToday}
                  />
                ))}
              </div>
            )
          })}

        </div>
      </div>
    )
  }

  // ─── Landscape: slots as rows, days as columns ──────────────────────────────
  return (
    <div className="overflow-auto h-full w-full">
      <div className="flex flex-col min-h-full" style={{ minWidth: SLOT_COL_W + MIN_DAY_COL_W * 7 }}>

        {/* Header row: day names */}
        <div className="flex sticky top-0 z-10"
          style={{ background: 'var(--parchment-3)', borderBottom: '1px solid var(--border)' }}>
          {/* Corner */}
          <div className="shrink-0 sticky left-0 z-20"
            style={{ width: SLOT_COL_W, background: 'var(--parchment-3)', borderRight: '1px solid var(--border)' }} />

          {weekDates.map((date, i) => {
            const isToday = date === today
            return (
              <div key={date} className="text-center py-3"
                style={{
                  flex: '1 1 0', minWidth: MIN_DAY_COL_W,
                  background: isToday ? 'var(--ember-bg)' : 'var(--parchment-3)',
                  borderRight: '1px solid var(--border)',
                  borderBottom: isToday ? '2px solid var(--ember)' : undefined,
                }}>
                <div className="text-xs font-medium uppercase tracking-wider mb-0.5"
                  style={{ color: isToday ? 'var(--ember)' : 'var(--ink-4)' }}>
                  {DAY_LABELS[i]}
                </div>
                <div className="font-display text-xl leading-none"
                  style={{ color: isToday ? 'var(--ember)' : 'var(--ink)' }}>
                  {new Date(date + 'T12:00:00').getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Slot rows */}
        {MEAL_SLOTS.map(({ value: slot, label }) => (
          <div key={slot} className="flex flex-1" style={{ borderBottom: '1px solid var(--border)' }}>
            {/* Slot label — sticky left */}
            <div className="shrink-0 sticky left-0 z-10 flex items-center justify-center self-stretch"
              style={{
                width: SLOT_COL_W,
                background: 'var(--parchment-3)',
                borderRight: '1px solid var(--border)',
              }}>
              <span className="text-xs font-medium text-center leading-tight px-1"
                style={{ color: 'var(--ink-3)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                {label}
              </span>
            </div>

            {/* Day cells */}
            {weekDates.map(date => (
              <MealSlotCell
                key={`${date}-${slot}`}
                date={date}
                slot={slot}
                entries={entries.filter(e => e.date === date && e.slot === slot)}
                onTap={onCellTap}
                onRemove={onRemoveEntry}
                onUpdate={onUpdateEntry}
                isToday={date === today}
              />
            ))}
          </div>
        ))}

      </div>
    </div>
  )
}
