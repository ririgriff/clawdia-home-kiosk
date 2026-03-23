'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, Bus, Car, Check, Settings } from 'lucide-react'
import Link from 'next/link'
import { IScheduleEvent, EVENT_TYPE_COLORS } from '@/lib/schedule-types'
import { type HomeMethod, FALLBACK_HOME_DEFAULTS, computeHomeMethod } from '@/lib/home-method'
import { ENABLE_GO_HOME } from '@/config/family'
import type { ITodoItem, TodoAssignee } from '@/lib/todo-types'
import { ASSIGNEE_STYLE, TODO_ASSIGNEES } from '@/lib/todo-types'
import EventChip from './EventChip'
import AddEventModal from './AddEventModal'

// ─── time grid constants ──────────────────────────────────────────────────────
const HOUR_START = 6
const HOUR_END   = 22
const HOURS      = HOUR_END - HOUR_START
const HOUR_PX    = 64
const GRID_H     = HOURS * HOUR_PX
const TIME_COL_W = 48

type View = 'week' | 'month' | 'year'
type ModalState = { mode: 'add'; prefillDate?: string } | { mode: 'edit'; event: IScheduleEvent } | null

// ─── helpers ─────────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d); c.setDate(c.getDate() + n); return c
}
function getMondayOf(d: Date): Date {
  const c = new Date(d)
  const dow = c.getDay()
  c.setDate(c.getDate() + (dow === 0 ? -6 : 1 - dow))
  c.setHours(0, 0, 0, 0)
  return c
}
function getMonthStart(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function getMonthEnd(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }

function getMonthGrid(d: Date): Date[] {
  const first = getMonthStart(d)
  const last  = getMonthEnd(d)
  const start = getMondayOf(first)
  const lastDow = last.getDay()
  const end = addDays(last, lastDow === 0 ? 0 : 7 - lastDow)
  const grid: Date[] = []
  let cur = new Date(start)
  while (cur <= end) { grid.push(new Date(cur)); cur = addDays(cur, 1) }
  return grid
}

function minutesFromMidnight(s: string) {
  const [h, m] = s.slice(11, 16).split(':').map(Number)
  return h * 60 + m
}
function eventLayout(e: IScheduleEvent) {
  if (e.all_day || e.start.length <= 10) return null
  const startMin = minutesFromMidnight(e.start)
  const endMin   = e.end && e.end.length > 10 ? minutesFromMidnight(e.end) : startMin + 60
  return {
    top:    ((startMin - HOUR_START * 60) / 60) * HOUR_PX,
    height: Math.max(((endMin - startMin) / 60) * HOUR_PX, 22),
  }
}

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKEND_BG = 'rgba(0,0,0,0.04)'
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const WEEK_GO_HOME: Record<HomeMethod, { label: string; icon: typeof Bus; color: string; bg: string; border: string }> = {
  'bus-3pm': { label: 'Bus 3pm', icon: Bus, color: '#0f766e', bg: 'rgba(13,148,136,0.12)', border: 'rgba(15,118,110,0.25)' },
  'bus-4pm': { label: 'Bus 4pm', icon: Bus, color: '#1d4ed8', bg: 'rgba(37,99,235,0.12)',  border: 'rgba(29,78,216,0.25)'  },
  'pickup':  { label: 'Pickup',  icon: Car,  color: '#c2410c', bg: 'rgba(234,88,12,0.12)',  border: 'rgba(234,88,12,0.3)'   },
}

// ─── column layout for overlapping timed events ───────────────────────────────
function layoutTimedEvents(events: IScheduleEvent[]) {
  const timed = events
    .map(e => { const l = eventLayout(e); return l ? { event: e, ...l } : null })
    .filter(Boolean) as { event: IScheduleEvent; top: number; height: number }[]

  if (timed.length === 0) return []
  timed.sort((a, b) => a.event.start.localeCompare(b.event.start))

  // Cluster events that overlap (directly or transitively)
  const visited = new Set<number>()
  const clusters: number[][] = []
  for (let i = 0; i < timed.length; i++) {
    if (visited.has(i)) continue
    const cluster: number[] = []
    const queue = [i]
    while (queue.length) {
      const idx = queue.shift()!
      if (visited.has(idx)) continue
      visited.add(idx)
      cluster.push(idx)
      const a = timed[idx]
      for (let j = 0; j < timed.length; j++) {
        if (!visited.has(j)) {
          const b = timed[j]
          if (a.top < b.top + b.height && b.top < a.top + a.height) queue.push(j)
        }
      }
    }
    clusters.push(cluster)
  }

  // Greedy column assignment within each cluster
  const result: { event: IScheduleEvent; top: number; height: number; col: number; totalCols: number }[] = []
  for (const cluster of clusters) {
    const items = cluster.map(i => timed[i]).sort((a, b) => a.event.start.localeCompare(b.event.start))
    const colEnds: number[] = []
    const cols: number[] = []
    for (const item of items) {
      const end = item.top + item.height
      let c = colEnds.findIndex(e => item.top >= e)
      if (c === -1) { c = colEnds.length; colEnds.push(end) } else { colEnds[c] = end }
      cols.push(c)
    }
    const totalCols = colEnds.length
    items.forEach((item, i) => result.push({ ...item, col: cols[i], totalCols }))
  }
  return result
}

// ─── component ───────────────────────────────────────────────────────────────
export default function ScheduleView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const todayStr = toDateStr(new Date())
  const [view,   setView]   = useState<View>('week')
  const [anchor, setAnchor] = useState<Date>(new Date())
  const [events, setEvents] = useState<IScheduleEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [modal,  setModal]  = useState<ModalState>(null)
  const [recurringDeleteEvent, setRecurringDeleteEvent] = useState<IScheduleEvent | null>(null)
  const [homeDefaults, setHomeDefaults] = useState<Record<number, HomeMethod>>({ ...FALLBACK_HOME_DEFAULTS })
  const [todos, setTodos] = useState<ITodoItem[]>([])
  const [editingTodo,  setEditingTodo]  = useState<ITodoItem | null>(null)
  const [editTitle,    setEditTitle]    = useState('')
  const [editAssignee, setEditAssignee] = useState<TodoAssignee | ''>('')
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/settings/go-home')
      .then(r => r.json())
      .then((data: Record<string, HomeMethod>) => {
        const parsed: Record<number, HomeMethod> = {}
        for (const [k, v] of Object.entries(data)) parsed[Number(k)] = v
        setHomeDefaults(parsed)
      })
  }, [])

  useEffect(() => {
    fetch('/api/todos').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTodos(data)
    })
  }, [])

  // Auto-open modal when arriving with ?edit=<id> or ?add=YYYY-MM-DD
  useEffect(() => {
    const editId  = searchParams.get('edit')
    const addDate = searchParams.get('add')
    if (editId) {
      router.replace('/schedule')
      fetch(`/api/schedule/${editId}`)
        .then(r => r.ok ? r.json() : null)
        .then((event: IScheduleEvent | null) => {
          if (event) setModal({ mode: 'edit', event })
        })
    } else if (addDate) {
      router.replace('/schedule')
      setModal({ mode: 'add', prefillDate: addDate })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function openEditTodo(todo: ITodoItem) {
    setEditingTodo(todo)
    setEditTitle(todo.title)
    setEditAssignee(todo.assignee ?? '')
  }

  async function saveEditTodo() {
    if (!editingTodo) return
    const updates: Record<string, unknown> = {}
    if (editTitle.trim() && editTitle.trim() !== editingTodo.title) updates.title = editTitle.trim()
    const currentAssignee = editingTodo.assignee ?? ''
    if (editAssignee !== currentAssignee) updates.assignee = editAssignee || null
    if (Object.keys(updates).length > 0) {
      setTodos(ts => ts.map(t => t._id === editingTodo._id ? { ...t, ...updates } : t))
      await fetch(`/api/todos/${editingTodo._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    }
    setEditingTodo(null)
  }

  async function deleteEditTodo() {
    if (!editingTodo) return
    setTodos(ts => ts.filter(t => t._id !== editingTodo._id))
    await fetch(`/api/todos/${editingTodo._id}`, { method: 'DELETE' })
    setEditingTodo(null)
  }

  async function toggleTodo(todo: ITodoItem) {
    const next = !todo.done
    setTodos(ts => ts.map(t => t._id === todo._id
      ? { ...t, done: next, doneAt: next ? new Date().toISOString() : undefined }
      : t))
    await fetch(`/api/todos/${todo._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: next }),
    })
  }

  const todosByDate = useMemo(() => {
    const map = new Map<string, ITodoItem[]>()
    for (const t of todos) {
      if (!t.date) continue
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date)!.push(t)
    }
    return map
  }, [todos])

  // ── fetch range ──
  const { fromStr, toStr } = useMemo(() => {
    if (view === 'week') {
      const ws = getMondayOf(anchor)
      return { fromStr: toDateStr(ws), toStr: toDateStr(addDays(ws, 6)) }
    }
    if (view === 'month') {
      return { fromStr: toDateStr(getMonthStart(anchor)), toStr: toDateStr(getMonthEnd(anchor)) }
    }
    // year
    const y = anchor.getFullYear()
    return { fromStr: `${y}-01-01`, toStr: `${y}-12-31` }
  }, [view, anchor])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/schedule?from=${fromStr}&to=${toStr}`)
    const data = await res.json()
    setEvents(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [fromStr, toStr])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  useEffect(() => {
    if (view === 'week' && gridRef.current) {
      gridRef.current.scrollTop = (8 - HOUR_START) * HOUR_PX
    }
  }, [view])

  // ── navigation ──
  function prev() {
    if (view === 'week')  setAnchor(a => addDays(a, -7))
    if (view === 'month') setAnchor(a => new Date(a.getFullYear(), a.getMonth() - 1, 1))
    if (view === 'year')  setAnchor(a => new Date(a.getFullYear() - 1, 0, 1))
  }
  function next() {
    if (view === 'week')  setAnchor(a => addDays(a, 7))
    if (view === 'month') setAnchor(a => new Date(a.getFullYear(), a.getMonth() + 1, 1))
    if (view === 'year')  setAnchor(a => new Date(a.getFullYear() + 1, 0, 1))
  }
  function goToday() { setAnchor(new Date()) }

  // ── event lookup ──
  const eventsByDate = useMemo(() => {
    const map = new Map<string, IScheduleEvent[]>()
    for (const e of events) {
      const start = e.start.slice(0, 10)
      const end   = e.end?.slice(0, 10) ?? start
      let cur = new Date(start + 'T12:00:00')
      const endD = new Date(end + 'T12:00:00')
      while (cur <= endD) {
        const ds = toDateStr(cur)
        if (!map.has(ds)) map.set(ds, [])
        map.get(ds)!.push(e)
        cur = addDays(cur, 1)
      }
    }
    return map
  }, [events])

  // ── save/delete ──
  async function handleSave(data: Omit<IScheduleEvent, '_id' | 'createdAt'>) {
    if (modal?.mode === 'edit') {
      const baseId = modal.event._id.includes('_') ? modal.event._id.split('_')[0] : modal.event._id
      await fetch(`/api/schedule/${baseId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
    } else {
      await fetch('/api/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
    }
    setModal(null)
    fetchEvents()
  }
  async function handleDelete() {
    if (modal?.mode !== 'edit') return
    if (modal.event.recurrence) {
      // Show 3-choice dialog instead of deleting immediately
      setRecurringDeleteEvent(modal.event)
      setModal(null)
      return
    }
    const baseId = modal.event._id
    await fetch(`/api/schedule/${baseId}`, { method: 'DELETE' })
    setModal(null)
    fetchEvents()
  }

  async function handleRecurringDelete(mode: 'single' | 'following' | 'all') {
    if (!recurringDeleteEvent) return
    const event = recurringDeleteEvent
    setRecurringDeleteEvent(null)
    const baseId = event._id.includes('_') ? event._id.split('_')[0] : event._id
    const instanceDate = event._id.includes('_') ? event._id.split('_')[1] : event.start.slice(0, 10)

    if (mode === 'single') {
      const res = await fetch(`/api/schedule/${baseId}`)
      if (res.ok) {
        const existing = await res.json()
        const exceptions = [...(existing.exceptions ?? []), instanceDate]
        await fetch(`/api/schedule/${baseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exceptions }),
        })
      }
    } else if (mode === 'following') {
      const d = new Date(instanceDate + 'T12:00:00')
      d.setDate(d.getDate() - 1)
      const until = toDateStr(d)
      await fetch(`/api/schedule/${baseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'recurrence.until': until }),
      })
    } else {
      await fetch(`/api/schedule/${baseId}`, { method: 'DELETE' })
    }
    fetchEvents()
  }

  // ── toolbar label ──
  const label = useMemo(() => {
    if (view === 'year') return String(anchor.getFullYear())
    if (view === 'month') return anchor.toLocaleDateString('en-HK', { month: 'long', year: 'numeric' })
    const ws = getMondayOf(anchor)
    const we = addDays(ws, 6)
    const sm = ws.toLocaleDateString('en-HK', { month: 'long', year: 'numeric' })
    const em = we.toLocaleDateString('en-HK', { month: 'long', year: 'numeric' })
    return sm === em ? sm : (ws.toLocaleDateString('en-HK', { month: 'short' }) + ' – ' + we.toLocaleDateString('en-HK', { month: 'short', year: 'numeric' }))
  }, [view, anchor])

  const isNow = useMemo(() => {
    const now = new Date()
    if (view === 'week')  return toDateStr(getMondayOf(anchor)) === toDateStr(getMondayOf(now))
    if (view === 'month') return anchor.getFullYear() === now.getFullYear() && anchor.getMonth() === now.getMonth()
    return anchor.getFullYear() === now.getFullYear()
  }, [view, anchor])

  // ── week helpers ──
  const weekDays = useMemo(() => {
    const ws = getMondayOf(anchor)
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  }, [anchor])

  function allDayFor(ds: string) {
    return events.filter(e => {
      if (!e.all_day && e.start.length > 10) return false
      return e.start.slice(0, 10) <= ds && (e.end?.slice(0, 10) ?? e.start.slice(0, 10)) >= ds
    })
  }
  function timedFor(ds: string) {
    return events.filter(e => !e.all_day && e.start.length > 10 && e.start.slice(0, 10) === ds)
  }

  return (
    <div className="flex flex-col h-full" style={{ color: 'var(--ink)' }}>

      {/* ── toolbar ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--parchment)' }}>
        <div className="flex items-center gap-1">
          <button onClick={prev} className="p-2 rounded-lg hover:opacity-70"
            style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)' }}>
            <ChevronLeft size={16} style={{ color: 'var(--ink-2)' }} />
          </button>
          <button onClick={next} className="p-2 rounded-lg hover:opacity-70"
            style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)' }}>
            <ChevronRight size={16} style={{ color: 'var(--ink-2)' }} />
          </button>
        </div>

        <span className="font-semibold text-base" style={{ color: 'var(--ink)' }}>{label}</span>

        {!isNow && (
          <button onClick={goToday} className="px-3 py-1 rounded-lg text-xs font-medium hover:opacity-80"
            style={{ background: 'var(--parchment-3)', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
            Today
          </button>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {(['week', 'month', 'year'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize"
              style={view === v
                ? { background: 'var(--ember)', color: '#fff' }
                : { background: 'var(--parchment-3)', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
              {v}
            </button>
          ))}
        </div>

        <button onClick={() => setModal({ mode: 'add' })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium hover:opacity-80"
          style={{ background: 'var(--ember)', color: '#fff' }}>
          <Plus size={15} strokeWidth={2} />
          <span className="hidden sm:inline">Add Event</span>
        </button>
      </div>

      {/* ── views ── */}
      <div className="flex-1 min-h-0 overflow-hidden">

        {/* ══ WEEK VIEW ══ */}
        {view === 'week' && (
          <div className="flex flex-col h-full overflow-x-auto">
            <div style={{ minWidth: TIME_COL_W + 7 * 120 }} className="flex flex-col h-full">

              {/* day headers */}
              <div className="flex shrink-0" style={{ background: 'var(--parchment)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: TIME_COL_W, flexShrink: 0 }} />
                {weekDays.map(day => {
                  const ds = toDateStr(day)
                  const isToday = ds === todayStr
                  return (
                    <div key={ds} className="flex-1 text-center py-2"
                      style={{
                        borderLeft: '1px solid var(--border)',
                        borderBottom: isToday ? '2px solid var(--ember)' : undefined,
                        background: isToday ? 'var(--ember-bg)' : (day.getDay() === 0 || day.getDay() === 6) ? WEEKEND_BG : undefined,
                      }}>
                      <span className="text-xs font-medium block" style={{ color: isToday ? 'var(--ember)' : 'var(--ink-3)' }}>
                        {day.toLocaleDateString('en-HK', { weekday: 'short' })}
                      </span>
                      <span className="text-lg font-semibold leading-tight block"
                        style={{ color: isToday ? 'var(--ember)' : 'var(--ink)' }}>
                        {day.getDate()}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* all-day strip */}
              <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--parchment-4)' }}>
                <div style={{ width: TIME_COL_W, flexShrink: 0 }} className="text-right pr-2 py-2">
                  <span className="text-xs" style={{ color: 'var(--ink-4)' }}>all‑day</span>
                </div>
                {weekDays.map(day => {
                  const ds = toDateStr(day)
                  const isToday = ds === todayStr
                  return (
                    <div key={ds} className="flex-1 p-1 min-h-[32px] space-y-0.5"
                      style={{ borderLeft: '1px solid var(--border)', background: isToday ? 'var(--ember-bg)' : (day.getDay() === 0 || day.getDay() === 6) ? WEEKEND_BG : undefined }}>
                      {allDayFor(ds).map(e => (
                        <EventChip key={e._id} event={e} compact onClick={() => setModal({ mode: 'edit', event: e })} />
                      ))}
                    </div>
                  )
                })}
              </div>

              {/* time grid */}
              <div ref={gridRef} className="overflow-y-auto flex-1 min-h-0">
                <div className="flex" style={{ minHeight: GRID_H }}>
                  <div style={{ width: TIME_COL_W, flexShrink: 0, position: 'relative' }}>
                    {Array.from({ length: HOURS }, (_, i) => (
                      <div key={i} style={{ position: 'absolute', top: i * HOUR_PX, right: 8 }}>
                        <span className="text-xs tabular-nums" style={{ color: 'var(--ink-4)' }}>
                          {String(HOUR_START + i).padStart(2, '0')}:00
                        </span>
                      </div>
                    ))}
                  </div>
                  {weekDays.map(day => {
                    const ds = toDateStr(day)
                    const isToday = ds === todayStr
                    return (
                      <div key={ds} className="flex-1 relative"
                        style={{ borderLeft: '1px solid var(--border)', background: isToday ? 'var(--ember-bg)' : (day.getDay() === 0 || day.getDay() === 6) ? WEEKEND_BG : undefined }}
                        onClick={e => {
                          if ((e.target as HTMLElement).closest('[data-event]')) return
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          const y = e.clientY - rect.top
                          const hr = Math.floor(y / HOUR_PX) + HOUR_START
                          const mn = Math.round(((y % HOUR_PX) / HOUR_PX) * 60 / 15) * 15
                          setModal({ mode: 'add', prefillDate: `${ds}T${String(hr).padStart(2,'0')}:${String(mn).padStart(2,'0')}` })
                        }}>
                        {Array.from({ length: HOURS }, (_, i) => (
                          <div key={i} style={{ position: 'absolute', top: i * HOUR_PX, left: 0, right: 0, borderTop: '1px solid var(--border)' }} />
                        ))}
                        {Array.from({ length: HOURS }, (_, i) => (
                          <div key={`h${i}`} style={{ position: 'absolute', top: i * HOUR_PX + HOUR_PX / 2, left: 0, right: 0, borderTop: '1px dashed var(--border)', opacity: 0.5 }} />
                        ))}
                        {layoutTimedEvents(timedFor(ds)).map(({ event: e, top, height, col, totalCols }) => {
                          const colW = 1 / totalCols
                          return (
                            <div key={e._id} data-event="1"
                              style={{
                                position: 'absolute',
                                top: top + 1,
                                height: height - 2,
                                left:  `calc(${col * colW * 100}% + 2px)`,
                                width: `calc(${colW * 100}% - 4px)`,
                                zIndex: 1,
                              }}>
                              <EventChip event={e} compact={height < 36}
                                onClick={() => setModal({ mode: 'edit', event: e })} style={{ height: '100%' }} />
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>

                {/* GoHome strip */}
                {ENABLE_GO_HOME && <div className="flex shrink-0" style={{ borderTop: '1px solid var(--border)', background: '#fef08a' }}>
                <div style={{ width: TIME_COL_W, flexShrink: 0 }} className="flex flex-col items-center justify-center gap-1 py-2">
                  <span className="text-xs" style={{ color: 'var(--ink-4)' }}>go home</span>
                  <Link href="/settings/go-home"
                    className="flex items-center justify-center rounded-lg"
                    style={{ minWidth: 28, minHeight: 28, color: 'var(--ink-4)' }}>
                    <Settings size={13} strokeWidth={1.75} />
                  </Link>
                </div>
                {weekDays.map(day => {
                  const ds      = toDateStr(day)
                  const isToday = ds === todayStr
                  const method  = computeHomeMethod(events, ds, homeDefaults)
                  const cfg     = method ? WEEK_GO_HOME[method] : null
                  const Icon    = cfg?.icon
                  return (
                    <div key={ds} className="flex-1 p-1.5 flex items-center"
                      style={{ borderLeft: '1px solid var(--border)', minHeight: 44, background: isToday ? 'var(--ember-bg)' : (day.getDay() === 0 || day.getDay() === 6) ? WEEKEND_BG : undefined }}>
                      {cfg && Icon && (
                        <div className="flex items-center gap-1 rounded-md px-1.5 py-1 w-full overflow-hidden"
                          style={{ background: '#fff', border: `1px solid ${cfg.border}` }}>
                          <Icon size={12} strokeWidth={2} style={{ color: cfg.color, flexShrink: 0 }} />
                          <span className="truncate" style={{ color: cfg.color, fontSize: 12, fontWeight: 500 }}>
                            {cfg.label}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>}

              {/* To-do strip */}
              <div className="flex shrink-0" style={{ borderTop: '1px solid var(--border)', background: 'var(--parchment-4)' }}>
                <div style={{ width: TIME_COL_W, flexShrink: 0 }} className="text-right pr-2 py-1.5 flex items-start justify-end pt-2">
                  <span className="text-xs" style={{ color: 'var(--ink-4)' }}>to-do</span>
                </div>
                {weekDays.map(day => {
                  const ds       = toDateStr(day)
                  const isToday  = ds === todayStr
                  const dayTodos = todosByDate.get(ds) ?? []
                  const active   = dayTodos.filter(t => !t.done)
                  const done     = dayTodos.filter(t => t.done)
                  const visible  = [...active, ...done].slice(0, 4)
                  const more     = dayTodos.length - visible.length
                  return (
                    <div key={ds} className="flex-1 flex flex-col min-w-0 overflow-hidden"
                      style={{ borderLeft: '1px solid var(--border)', background: isToday ? 'var(--ember-bg)' : (day.getDay() === 0 || day.getDay() === 6) ? WEEKEND_BG : undefined, minHeight: 28 }}>
                      {visible.map(todo => {
                        const aStyle = todo.assignee ? ASSIGNEE_STYLE[todo.assignee] : null
                        const aLabel = todo.assignee ? TODO_ASSIGNEES.find(a => a.value === todo.assignee)?.label : null
                        return (
                          // Two-part row: checkbox toggles done, text area opens edit sheet
                          <div key={todo._id} className="flex items-stretch w-full min-w-0"
                            style={{ minHeight: 40, background: todo.done ? 'transparent' : 'var(--parchment-3)', borderBottom: '1px solid var(--border)' }}>
                            {/* Checkbox — toggle done */}
                            <button onClick={() => toggleTodo(todo)}
                              className="flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity"
                              style={{ minWidth: 36, paddingLeft: 6, paddingRight: 4 }}>
                              <span className="shrink-0 w-4 h-4 rounded flex items-center justify-center border"
                                style={todo.done
                                  ? { background: 'var(--ember)', borderColor: 'var(--ember)' }
                                  : { borderColor: 'var(--ink-4)', background: '#fff' }}>
                                {todo.done && <Check size={9} strokeWidth={3} color="#fff" />}
                              </span>
                            </button>
                            {/* Title + assignee name — tap to edit */}
                            <button onClick={() => openEditTodo(todo)}
                              className="flex items-center gap-1.5 flex-1 min-w-0 text-left pr-1.5 active:opacity-60 transition-opacity">
                              <span className="text-xs flex-1"
                                style={{ color: todo.done ? 'var(--ink-4)' : 'var(--ink)', textDecoration: todo.done ? 'line-through' : 'none' }}>
                                {todo.title}
                              </span>
                              {aStyle && aLabel && (
                                <span className="shrink-0 rounded px-1 font-medium"
                                  style={{ background: aStyle.bg, color: aStyle.text, fontSize: 10, whiteSpace: 'nowrap' }}>
                                  {aLabel}
                                </span>
                              )}
                            </button>
                          </div>
                        )
                      })}
                      {more > 0 && (
                        <span className="text-xs px-1" style={{ color: 'var(--ink-4)' }}>+{more} more</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* empty space at bottom */}
              <div className="flex-1" />

              </div>{/* end gridRef */}
            </div>
          </div>
        )}

        {/* ══ MONTH VIEW ══ */}
        {view === 'month' && (
          <div className="flex flex-col h-full overflow-auto">
            {/* DOW header */}
            <div className="grid shrink-0" style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)', background: 'var(--parchment)' }}>
              {DOW_LABELS.map(d => (
                <div key={d} className="text-center py-2 text-xs font-medium" style={{ color: 'var(--ink-3)' }}>{d}</div>
              ))}
            </div>

            {/* day cells */}
            {(() => {
              const grid = getMonthGrid(anchor)
              const curMonth = anchor.getMonth()
              const rows = grid.length / 7
              return (
                <div className="grid flex-1" style={{
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                }}>
                  {grid.map(day => {
                    const ds = toDateStr(day)
                    const isToday    = ds === todayStr
                    const isThisMonth = day.getMonth() === curMonth
                    const dayEvents  = eventsByDate.get(ds) ?? []

                    return (
                      <div key={ds}
                        className="flex flex-col p-1 cursor-pointer hover:opacity-90"
                        style={{
                          borderRight: '1px solid var(--border)',
                          borderBottom: '1px solid var(--border)',
                          background: isToday ? 'var(--ember-bg)' : undefined,
                          opacity: isThisMonth ? 1 : 0.35,
                          minHeight: 80,
                        }}
                        onClick={() => setModal({ mode: 'add', prefillDate: ds })}>

                        {/* day number */}
                        <span className="text-sm font-semibold mb-0.5 self-start w-7 h-7 flex items-center justify-center rounded-full"
                          style={isToday
                            ? { background: 'var(--ember)', color: '#fff' }
                            : { color: isThisMonth ? 'var(--ink)' : 'var(--ink-4)' }}>
                          {day.getDate()}
                        </span>

                        {/* events */}
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          {dayEvents.slice(0, 3).map(e => (
                            <div key={e._id} onClick={ev => ev.stopPropagation()}>
                              <EventChip event={e} compact onClick={() => setModal({ mode: 'edit', event: e })} />
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-xs pl-1" style={{ color: 'var(--ink-4)' }}>
                              +{dayEvents.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

        {/* ══ YEAR VIEW ══ */}
        {view === 'year' && (
          <div className="overflow-auto h-full p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {Array.from({ length: 12 }, (_, mi) => {
                const monthDate = new Date(anchor.getFullYear(), mi, 1)
                const grid      = getMonthGrid(monthDate)
                const curMonth  = mi

                return (
                  <div key={mi} className="rounded-xl p-3"
                    style={{ background: 'var(--parchment)', border: '1px solid var(--border)' }}>

                    {/* month name — click to switch to month view */}
                    <button className="text-sm font-semibold mb-2 w-full text-left hover:opacity-70"
                      style={{ color: 'var(--ink)' }}
                      onClick={() => { setAnchor(monthDate); setView('month') }}>
                      {MONTH_NAMES[mi]} {anchor.getFullYear()}
                    </button>

                    {/* dow labels */}
                    <div className="grid mb-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                      {DOW_LABELS.map(d => (
                        <span key={d} className="text-center" style={{ fontSize: 9, color: 'var(--ink-4)' }}>{d[0]}</span>
                      ))}
                    </div>

                    {/* day cells */}
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                      {grid.map(day => {
                        const ds          = toDateStr(day)
                        const isToday     = ds === todayStr
                        const isThisMonth = day.getMonth() === curMonth
                        const dayEvents   = eventsByDate.get(ds) ?? []
                        // up to 3 dot colors
                        const dotTypes = [...new Set(dayEvents.map(e => e.type))].slice(0, 3)

                        return (
                          <button key={ds}
                            className="flex flex-col items-center py-0.5 rounded hover:opacity-70"
                            style={{ opacity: isThisMonth ? 1 : 0.25 }}
                            onClick={() => { setAnchor(day); setView('week') }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: isToday ? 700 : 400,
                              color: isToday ? '#fff' : 'var(--ink)',
                              background: isToday ? 'var(--ember)' : undefined,
                              borderRadius: '50%',
                              width: 18, height: 18,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {day.getDate()}
                            </span>
                            {dotTypes.length > 0 && (
                              <div className="flex gap-px mt-0.5">
                                {dotTypes.map(t => (
                                  <span key={t} style={{
                                    width: 4, height: 4, borderRadius: '50%',
                                    background: EVENT_TYPE_COLORS[t].text,
                                    flexShrink: 0,
                                  }} />
                                ))}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── todo edit sheet ── */}
      {editingTodo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setEditingTodo(null)}>
          <div className="w-full max-w-lg p-4 flex flex-col gap-3"
            style={{ background: 'var(--parchment-3)', borderTop: '1px solid var(--border)', borderRadius: '16px 16px 0 0' }}
            onClick={e => e.stopPropagation()}>
            <p className="text-xs font-medium" style={{ color: 'var(--ink-4)' }}>Edit To-Do</p>
            <input autoFocus value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEditTodo() }}
              className="w-full px-3 rounded-lg text-sm outline-none"
              style={{ background: '#fff', border: '1px solid var(--border)', color: 'var(--ink)', minHeight: 44 }}
            />
            <div className="flex gap-2">
              {TODO_ASSIGNEES.map(a => (
                <button key={a.value}
                  onClick={() => setEditAssignee(v => v === a.value ? '' : a.value)}
                  className="flex-1 rounded-lg text-sm font-medium"
                  style={{
                    minHeight: 44,
                    ...(editAssignee === a.value
                      ? { background: ASSIGNEE_STYLE[a.value].solid, color: '#fff' }
                      : { background: 'var(--parchment-4)', color: 'var(--ink-3)', border: '1px solid var(--border)' })
                  }}>
                  {a.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={saveEditTodo}
                className="flex-1 rounded-lg text-sm font-medium"
                style={{ background: 'var(--ember)', color: '#fff', minHeight: 44 }}>
                Save
              </button>
              <button onClick={deleteEditTodo}
                className="px-4 rounded-lg text-sm font-medium"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)', minHeight: 44 }}>
                Delete
              </button>
              <button onClick={() => setEditingTodo(null)}
                className="px-4 rounded-lg text-sm font-medium"
                style={{ background: 'var(--parchment-4)', color: 'var(--ink-3)', border: '1px solid var(--border)', minHeight: 44 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── modal ── */}
      {modal && (
        <AddEventModal
          initial={modal.mode === 'edit' ? modal.event : (
            modal.prefillDate ? {
              start:   modal.prefillDate,
              all_day: !modal.prefillDate.includes('T'),
            } : undefined
          )}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── recurring delete dialog ── */}
      {recurringDeleteEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setRecurringDeleteEvent(null)}
        >
          <div
            className="rounded-2xl p-6 flex flex-col gap-4 mx-4"
            style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)', minWidth: 280, maxWidth: 360 }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="font-display font-medium text-base" style={{ color: 'var(--ink)' }}>
                Remove recurring event
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>
                &ldquo;{recurringDeleteEvent.title}&rdquo; repeats. What would you like to remove?
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleRecurringDelete('single')}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium text-left"
                style={{ background: 'var(--parchment-4)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
                This event only
              </button>
              <button
                onClick={() => handleRecurringDelete('following')}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium text-left"
                style={{ background: 'var(--parchment-4)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
                This and all following events
              </button>
              <button
                onClick={() => handleRecurringDelete('all')}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium text-left"
                style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                All events in this series
              </button>
            </div>
            <button
              onClick={() => setRecurringDeleteEvent(null)}
              className="text-sm font-medium"
              style={{ color: 'var(--ink-4)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
