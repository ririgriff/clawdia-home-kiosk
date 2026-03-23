'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IDish, IMealPlanEntry, MealSlot } from '@/lib/types'
import { updateCategoryColors } from '@/lib/categoryColors'
import WeeklyGrid from './WeeklyGrid'
import RecipeDrawer from './RecipeDrawer'
import WhoForPicker from './WhoForPicker'
import SlotDetailSheet from './SlotDetailSheet'

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

function getWeekDates(weekStart: string): string[] {
  const [year, month, day] = weekStart.split('-').map(Number)
  const start = new Date(year, month - 1, day)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toDateString(d)
  })
}

export interface SelectedCell {
  date: string
  slot: MealSlot
  eaters: string[]
}

const VALID_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner']

export default function MealPlanner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [entries, setEntries] = useState<IMealPlanEntry[]>([])
  const [dishes, setDishes] = useState<IDish[]>([])
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  const [pendingCell, setPendingCell] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [detailCell, setDetailCell] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [draggingEntry, setDraggingEntry] = useState<IMealPlanEntry | null>(null)
  const [loading, setLoading] = useState(true)

  // Auto-open WhoForPicker when arriving from the meal summary + button
  useEffect(() => {
    const date = searchParams.get('date')
    const slot = searchParams.get('slot') as MealSlot | null
    if (date && slot && VALID_SLOTS.includes(slot)) {
      setWeekStart(getWeekStart(new Date(date + 'T12:00:00')))
      setPendingCell({ date, slot })
      router.replace('/plan')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const weekDates = getWeekDates(weekStart)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/meal-plan?weekStart=${weekStart}`)
      setEntries(await res.json())
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  // Dishes and taxonomy load once on mount
  useEffect(() => {
    Promise.all([fetch('/api/dishes'), fetch('/api/taxonomy')]).then(async ([dishRes, taxRes]) => {
      setDishes(await dishRes.json())
      const taxonomy = await taxRes.json()
      updateCategoryColors(taxonomy.filter((t: { type: string }) => t.type === 'category'))
    })
  }, [])

  // Meal plan refetches when week changes
  useEffect(() => { fetchPlan() }, [fetchPlan])

  async function assignDish(dishId: string, cell: SelectedCell) {
    const dish = dishes.find(d => d._id === dishId)
    const res = await fetch('/api/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: cell.date, slot: cell.slot, dish_id: dishId, eaters: cell.eaters }),
    })
    if (!res.ok) return
    const entry = await res.json()
    setEntries(prev => [...prev, { ...entry, dish }])
  }

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

  async function unassignDish(dishId: string, cell: SelectedCell) {
    const toRemove = entries.filter(e =>
      e.dish_id === dishId &&
      e.date === cell.date &&
      e.slot === cell.slot
    )
    await Promise.all(toRemove.map(e => fetch(`/api/meal-plan/${e._id}`, { method: 'DELETE' })))
    setEntries(prev => prev.filter(e => !toRemove.some(r => r._id === e._id)))
  }

  function handleDragStart(event: DragStartEvent) {
    const entry = entries.find(e => e._id === event.active.id)
    if (entry) setDraggingEntry(entry)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingEntry(null)
    const { active, over } = event
    if (!over || !active.data.current?.entryId) return

    const entryId = active.data.current.entryId as string
    const parts = (over.id as string).split('|')
    if (parts.length !== 2) return
    const [date, slot] = parts

    const entry = entries.find(e => e._id === entryId)
    if (!entry) return
    if (entry.date === date && entry.slot === slot) return

    await fetch(`/api/meal-plan/${entryId}`, { method: 'DELETE' })
    const res = await fetch('/api/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, slot, dish_id: entry.dish_id, eaters: entry.eaters ?? [] }),
    })
    const newEntry = await res.json()
    setEntries(prev => [
      ...prev.filter(e => e._id !== entryId),
      { ...newEntry, dish: entry.dish },
    ])
  }

  function prevWeek() {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    setWeekStart(toDateString(d))
  }

  function nextWeek() {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + 7)
    setWeekStart(toDateString(d))
  }

  const weekLabel = `${new Date(weekStart + 'T12:00:00').toLocaleDateString('en-HK', { month: 'short', day: 'numeric' })} – ${new Date(weekDates[6] + 'T12:00:00').toLocaleDateString('en-HK', { month: 'short', day: 'numeric' })}`

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--parchment-2)' }}>
        {/* Header */}
        <div className="flex items-center px-6 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--parchment-3)' }}>
          <h2 className="font-display font-medium text-base" style={{ color: 'var(--ink)' }}>Meal Planner</h2>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={prevWeek}
              className="w-14 h-14 flex items-center justify-center rounded-xl transition-colors hover:bg-gray-100"
              style={{ color: 'var(--ink-3)' }}
            >
              <ChevronLeft size={22} strokeWidth={1.75} />
            </button>
            <span className="text-base tabular-nums" style={{ color: 'var(--ink-3)' }}>{weekLabel}</span>
            <button
              onClick={nextWeek}
              className="w-14 h-14 flex items-center justify-center rounded-xl transition-colors hover:bg-gray-100"
              style={{ color: 'var(--ink-3)' }}
            >
              <ChevronRight size={22} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--ink-4)' }}>
              Loading...
            </div>
          ) : (
            <WeeklyGrid
              weekDates={weekDates}
              entries={entries}
              onCellTap={(date, slot) => setPendingCell({ date, slot })}
              onOpenDetail={(date, slot) => setDetailCell({ date, slot })}
              onRemoveEntry={removeEntry}
              onUpdateEntry={updateEntry}
            />
          )}
        </div>
      </div>

      {detailCell && (
        <SlotDetailSheet
          slot={detailCell.slot}
          date={detailCell.date}
          entries={entries.filter(e => e.date === detailCell.date && e.slot === detailCell.slot)}
          onClose={() => setDetailCell(null)}
          onRemove={removeEntry}
          onUpdate={updateEntry}
          onAdd={() => {
            setDetailCell(null)
            setPendingCell(detailCell)
          }}
        />
      )}

      {pendingCell && (
        <WhoForPicker
          slot={pendingCell.slot}
          date={pendingCell.date}
          onSelect={eaters => {
            setSelectedCell({ ...pendingCell, eaters })
            setPendingCell(null)
          }}
          onClose={() => setPendingCell(null)}
        />
      )}

      <RecipeDrawer
        isOpen={selectedCell !== null}
        selectedCell={selectedCell}
        dishes={dishes}
        existingDishIds={selectedCell ? entries
          .filter(e => e.date === selectedCell.date && e.slot === selectedCell.slot)
          .map(e => e.dish_id)
          : []}
        onClose={() => setSelectedCell(null)}
        onAssign={assignDish}
        onUnassign={unassignDish}
        onDishCreated={dish => setDishes(prev => [...prev, dish])}
        onDishUpdated={dish => setDishes(prev => prev.map(d => d._id === dish._id ? dish : d))}
      />

      <DragOverlay>
        {draggingEntry?.dish && (
          <div className="text-xs px-2 py-1 rounded shadow-lg pointer-events-none"
            style={{ background: 'var(--ember)', color: '#fff' }}>
            {draggingEntry.dish.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
