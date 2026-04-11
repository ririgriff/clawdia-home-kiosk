import React, { useState, useEffect } from 'react'
import { Plus, Eye, Trash2, UtensilsCrossed } from 'lucide-react'
import { IMealPlanEntry, MEAL_SLOTS, MealSlot } from '@/lib/types'
import { getMemberInitials, getMemberColor } from '@/config/family'
import MealSlotCell from './MealSlotCell'
import DishViewSheet from './DishViewSheet'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Landscape constants (slots = rows, days = columns)
const SLOT_COL_W    = 72
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
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    weekDates.includes(today) ? today : weekDates[0]
  )

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    setIsPortrait(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    setIsSmallScreen(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsSmallScreen(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // When the week changes (prev/next nav), reset selected date to today or Monday
  useEffect(() => {
    setSelectedDate(weekDates.includes(today) ? today : weekDates[0])
  }, [weekDates[0]]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Small screen: day-picker layout ────────────────────────────────────────
  if (isSmallScreen) {
    return (
      <div className="h-full flex flex-col overflow-hidden">

        {/* Day selector strip */}
        <div className="shrink-0 flex gap-2 px-4 py-3 overflow-x-auto"
          style={{ background: 'var(--parchment-3)', borderBottom: '1px solid var(--border)' }}>
          {weekDates.map((date, i) => {
            const isSelected = date === selectedDate
            const isToday = date === today
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className="flex flex-col items-center px-3 py-2 rounded-xl shrink-0 transition-colors"
                style={{
                  minWidth: 48, minHeight: 56,
                  ...(isSelected
                    ? { background: 'var(--ember)', color: '#fff' }
                    : isToday
                    ? { background: 'var(--ember-bg)', color: 'var(--ember)', border: '1px solid rgba(234,88,12,0.3)' }
                    : { background: 'var(--parchment-5)', color: 'var(--ink-3)', border: '1px solid var(--border)' }),
                }}
              >
                <span className="text-xs font-medium uppercase tracking-wide">{DAY_LABELS[i]}</span>
                <span className="font-display text-lg leading-none mt-0.5">
                  {new Date(date + 'T12:00:00').getDate()}
                </span>
              </button>
            )
          })}
        </div>

        {/* Slot sections — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {MEAL_SLOTS.map(({ value: slot, label }) => {
            const slotEntries = entries.filter(e => e.date === selectedDate && e.slot === slot)
            return (
              <div key={slot} style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <span className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--ink-4)' }}>{label}</span>
                  <button
                    onClick={() => onCellTap(selectedDate, slot)}
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 44, height: 44, color: 'var(--ink-4)', background: 'var(--parchment-5)', border: '1px solid var(--border)' }}
                  >
                    <Plus size={16} strokeWidth={2} />
                  </button>
                </div>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  {slotEntries.length === 0 ? (
                    <button
                      onClick={() => onCellTap(selectedDate, slot)}
                      className="w-full flex items-center justify-center rounded-xl"
                      style={{ minHeight: 52, border: '1px dashed var(--border-dashed)', color: 'var(--ink-4)' }}
                    >
                      <Plus size={18} strokeWidth={1.75} />
                    </button>
                  ) : (
                    slotEntries.map(entry => (
                      <SmallDishRow
                        key={entry._id}
                        entry={entry}
                        onRemove={onRemoveEntry}
                        onUpdate={onUpdateEntry}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── Portrait: days as rows, slots as columns ────────────────────────────────
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

function SmallDishRow({ entry, onRemove, onUpdate }: {
  entry: IMealPlanEntry
  onRemove: (id: string) => void
  onUpdate: (id: string, updates: { eaters: string[]; note: string }) => void
}) {
  const dish = entry.dish
  const eaters = entry.eaters ?? []
  const [showView, setShowView] = useState(false)

  return (
    <>
      <div
        className="flex items-stretch rounded-xl overflow-hidden"
        style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)', minHeight: 64 }}
      >
        {/* Thumbnail */}
        {dish?.image_url ? (
          <img src={dish.image_url} alt={dish.name} className="w-16 object-cover shrink-0" />
        ) : (
          <div className="w-16 shrink-0 flex items-center justify-center"
            style={{ background: 'var(--parchment-5)' }}>
            <UtensilsCrossed size={18} strokeWidth={1.25} style={{ color: 'var(--ink-4)' }} />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 px-3 py-2 flex flex-col justify-center min-w-0">
          <p className="text-sm font-medium leading-tight truncate" style={{ color: 'var(--ink)' }}>
            {dish?.name ?? '—'}
          </p>
          {dish?.name_zh && (
            <p className="text-xs leading-tight truncate mt-0.5" style={{ color: 'var(--ink-3)' }}>
              {dish.name_zh}
            </p>
          )}
          {eaters.length > 0 && (
            <div className="flex gap-0.5 mt-1 flex-wrap">
              {eaters.map(id => {
                const c = getMemberColor(id)
                return (
                  <span key={id} className="text-xs font-medium px-1.5 rounded"
                    style={{
                      paddingTop: 2, paddingBottom: 2,
                      background: c ? `color-mix(in srgb, ${c.solid} 15%, transparent)` : 'var(--parchment-5)',
                      color: c?.solid ?? 'var(--ink-3)',
                    }}>
                    {getMemberInitials(id)}
                  </span>
                )
              })}
            </div>
          )}
          {entry.note && (
            <p className="text-xs leading-tight truncate mt-0.5" style={{ color: 'var(--ink-3)' }}>
              {entry.note}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-stretch shrink-0">
          <button
            onClick={() => setShowView(true)}
            className="flex items-center justify-center"
            style={{ width: 48, color: 'var(--ink-4)', borderLeft: '1px solid var(--border)' }}
          >
            <Eye size={16} strokeWidth={1.75} />
          </button>
          <button
            onClick={() => onRemove(entry._id)}
            className="flex items-center justify-center"
            style={{ width: 48, color: '#ef4444', borderLeft: '1px solid var(--border)' }}
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {showView && (
        <DishViewSheet
          entry={entry}
          onSave={onUpdate}
          onClose={() => setShowView(false)}
        />
      )}
    </>
  )
}
