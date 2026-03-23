'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Bus, Car, Pencil, Trash2, X, Plus } from 'lucide-react'
import { IScheduleEvent, EVENT_TYPE_COLORS } from '@/lib/schedule-types'
import { type HomeMethod, FALLBACK_HOME_DEFAULTS, computeHomeMethod } from '@/lib/home-method'
import { ENABLE_GO_HOME } from '@/config/family'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtTime(s: string) {
  if (s.length <= 10) return null
  const [h, m] = s.slice(11, 16).split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const hour   = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')}${period}`
}

type Day = { date: string; label: string; key: 'today' | 'tomorrow' }

const GO_HOME_CONFIG: Record<HomeMethod, { label: string; sub: string; icon: typeof Bus; color: string; border: string }> = {
  'bus-3pm': { label: 'Bus 3pm', sub: 'school bus',             icon: Bus, color: '#0f766e', border: 'rgba(15,118,110,0.35)'  },
  'bus-4pm': { label: 'Bus 4pm', sub: 'school bus',             icon: Bus, color: '#1d4ed8', border: 'rgba(29,78,216,0.35)'   },
  'pickup':  { label: 'Pickup',  sub: 'adult collection needed', icon: Car, color: '#c2410c', border: 'rgba(234,88,12,0.45)'   },
}

export default function ScheduleSummary() {
  const today    = toDateStr(new Date())
  const tomorrow = toDateStr(new Date(Date.now() + 86400000))

  const days: Day[] = [
    { date: today,    label: 'Today',    key: 'today' },
    { date: tomorrow, label: 'Tomorrow', key: 'tomorrow' },
  ]

  const [eventsByDate, setEventsByDate] = useState<Record<string, IScheduleEvent[]>>({})
  const [allEvents,    setAllEvents]    = useState<IScheduleEvent[]>([])
  const [homeDefaults, setHomeDefaults] = useState<Record<number, HomeMethod>>({ ...FALLBACK_HOME_DEFAULTS })
  const [loading,      setLoading]      = useState(true)
  const [activeDay,    setActiveDay]    = useState<'today' | 'tomorrow'>('today')

  useEffect(() => {
    Promise.all([
      fetch(`/api/schedule?from=${today}&to=${tomorrow}`).then(r => r.json()),
      fetch('/api/settings/go-home').then(r => r.json()),
    ]).then(([data, settings]: [IScheduleEvent[], Record<string, HomeMethod>]) => {
      const map: Record<string, IScheduleEvent[]> = { [today]: [], [tomorrow]: [] }
      for (const e of data) {
        const d = e.start.slice(0, 10)
        if (map[d]) map[d].push(e)
      }
      for (const d of Object.keys(map)) {
        map[d].sort((a, b) => {
          if (a.all_day && !b.all_day) return -1
          if (!a.all_day && b.all_day)  return 1
          return a.start.localeCompare(b.start)
        })
      }
      const parsedDefaults: Record<number, HomeMethod> = {}
      for (const [k, v] of Object.entries(settings)) parsedDefaults[Number(k)] = v

      setAllEvents(data)
      setEventsByDate(map)
      setHomeDefaults(parsedDefaults)
      setLoading(false)
    })
  }, [today, tomorrow])

  function removeEventFromState(instanceId: string, mode: 'single' | 'following' | 'all') {
    const parts = instanceId.split('_')
    const baseId = parts[0]
    const instanceDate = parts[1] // may be undefined for non-recurring

    setEventsByDate(prev => {
      const next = { ...prev }
      for (const date of Object.keys(next)) {
        next[date] = next[date].filter(e => {
          const eParts = e._id.split('_')
          const eBase = eParts[0]
          const eDate = eParts[1]
          if (eBase !== baseId) return true
          if (mode === 'all') return false
          if (mode === 'single') return eDate !== instanceDate
          if (mode === 'following') return instanceDate && eDate && eDate < instanceDate
          return true
        })
      }
      return next
    })
    setAllEvents(prev => {
      return prev.filter(e => {
        const eParts = e._id.split('_')
        const eBase = eParts[0]
        const eDate = eParts[1]
        if (eBase !== baseId) return true
        if (mode === 'all') return false
        if (mode === 'single') return eDate !== instanceDate
        if (mode === 'following') return instanceDate && eDate && eDate < instanceDate
        return true
      })
    })
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--parchment-3)', minHeight: 56 }}>

        <h2 className="font-display font-medium text-base" style={{ color: 'var(--ink)' }}>Schedule</h2>

        <Link href="/schedule" title="Full calendar"
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{ minWidth: 44, minHeight: 44, color: 'var(--ink-4)' }}>
          <ArrowUpRight size={18} strokeWidth={1.75} />
        </Link>
      </div>

      {/* Scrollable event content */}
      <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--ink-4)' }}>
            Loading…
          </div>
        ) : (
          <>
            {/* Desktop: 2-column grid */}
            <div className="hidden sm:grid grid-cols-2 gap-6">
              {days.map(d => (
                <DayColumn key={d.date} day={d} events={eventsByDate[d.date] ?? []} onRemove={removeEventFromState} />
              ))}
            </div>

            {/* Mobile: active day */}
            <div className="sm:hidden">
              {(() => {
                const d = days.find(x => x.key === activeDay)!
                return <DayColumn day={d} events={eventsByDate[d.date] ?? []} onRemove={removeEventFromState} />
              })()}
            </div>
          </>
        )}
      </div>

      {/* GoHome strip — persistent at bottom, outside scroll area */}
      {!loading && ENABLE_GO_HOME && (
        <div className="shrink-0 flex" style={{ background: '#fef08a', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
          {days.map((d, i) => {
            const method = computeHomeMethod(allEvents, d.date, homeDefaults)
            const cfg    = method ? GO_HOME_CONFIG[method] : null
            const Icon   = cfg?.icon
            return (
              <div key={d.key} className="flex-1 flex items-center gap-2.5 px-4 py-2.5"
                style={i > 0 ? { borderLeft: '1px solid rgba(0,0,0,0.1)' } : undefined}>
                <span className="text-xs font-medium shrink-0" style={{ color: 'rgba(0,0,0,0.45)' }}>
                  {d.label}
                </span>
                {cfg && Icon ? (
                  <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                    style={{ background: '#fff', border: `1px solid ${cfg.border}` }}>
                    <Icon size={13} strokeWidth={2} style={{ color: cfg.color }} />
                    <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                      {cfg.label}
                    </span>
                    <span className="text-xs hidden sm:inline" style={{ color: cfg.color, opacity: 0.6 }}>
                      · {cfg.sub}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>No school</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DayColumn({ day, events, onRemove }: { day: Day; events: IScheduleEvent[]; onRemove: (id: string, mode: 'single' | 'following' | 'all') => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="hidden sm:flex items-center justify-between shrink-0">
        <h3 className="font-display font-medium text-lg" style={{ color: 'var(--ink)' }}>
          {day.label}
          <span className="ml-2 text-sm font-sans font-normal" style={{ color: 'var(--ink-4)' }}>
            {new Date(day.date + 'T12:00:00').toLocaleDateString('en-HK', { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </h3>
        <Link href={`/schedule?add=${day.date}`}
          className="flex items-center justify-center rounded-lg"
          style={{ width: 32, height: 32, color: 'var(--ink-4)' }}>
          <Plus size={16} strokeWidth={2} />
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl px-4 py-6 text-sm text-center"
          style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)', color: 'var(--ink-4)' }}>
          Nothing scheduled
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map(e => <EventRow key={e._id} event={e} onRemove={onRemove} />)}
        </div>
      )}
    </div>
  )
}

function EventRow({ event, onRemove }: {
  event: IScheduleEvent
  onRemove: (id: string, mode: 'single' | 'following' | 'all') => void
}) {
  const router = useRouter()
  const colors  = EVENT_TYPE_COLORS[event.type]
  const timeStr = fmtTime(event.start)
  const endStr  = event.end ? fmtTime(event.end) : null

  const [showActions, setShowActions] = useState(false)
  const [showRecurringDialog, setShowRecurringDialog] = useState(false)

  const isRecurring = event._id.includes('_') // synthetic ID means it's a recurring instance
  const baseId = event._id.split('_')[0]
  const instanceDate = event._id.split('_')[1]

  async function handleRemove() {
    if (isRecurring) {
      setShowActions(false)
      setShowRecurringDialog(true)
    } else {
      setShowActions(false)
      await fetch(`/api/schedule/${baseId}`, { method: 'DELETE' })
      onRemove(event._id, 'all')
    }
  }

  async function handleRecurringDelete(mode: 'single' | 'following' | 'all') {
    setShowRecurringDialog(false)
    if (mode === 'single') {
      // Add this date to exceptions
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
      onRemove(event._id, 'single')
    } else if (mode === 'following') {
      // Set recurrence.until to day before instanceDate
      const d = new Date(instanceDate + 'T12:00:00')
      d.setDate(d.getDate() - 1)
      const until = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      await fetch(`/api/schedule/${baseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'recurrence.until': until }),
      })
      onRemove(event._id, 'following')
    } else {
      await fetch(`/api/schedule/${baseId}`, { method: 'DELETE' })
      onRemove(event._id, 'all')
    }
  }

  function handleEdit() {
    setShowActions(false)
    router.push(`/schedule?edit=${baseId}`)
  }

  return (
    <div className="relative">
      <div
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer"
        style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
        onClick={() => setShowActions(true)}
      >
        <div className="shrink-0 text-right" style={{ minWidth: 60 }}>
          {timeStr ? (
            <span className="text-xs font-medium tabular-nums leading-tight" style={{ color: colors.text }}>
              {timeStr}
              {endStr && <span className="block font-normal opacity-70">{endStr}</span>}
            </span>
          ) : (
            <span className="text-xs font-medium" style={{ color: colors.text }}>All day</span>
          )}
        </div>
        <div className="w-px self-stretch shrink-0" style={{ background: colors.border }} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium leading-snug block truncate" style={{ color: colors.text }}>
            {event.title}
          </span>
          {event.location && (
            <span className="text-xs truncate block opacity-70" style={{ color: colors.text }}>
              {event.location}
            </span>
          )}
        </div>
      </div>

      {/* Action overlay */}
      {showActions && (
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={e => { e.stopPropagation(); setShowActions(false) }}
        >
          <button
            onClick={e => { e.stopPropagation(); setShowActions(false) }}
            className="absolute top-1 right-1 flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.7)' }}>
            <X size={14} strokeWidth={2} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); handleEdit() }}
            className="flex flex-col items-center justify-center gap-1 rounded-xl"
            style={{ width: 45, height: 45, background: 'var(--parchment-3)', color: 'var(--ink-2)' }}>
            <Pencil size={14} strokeWidth={1.75} />
            <span style={{ fontSize: 9, fontWeight: 500 }}>Edit</span>
          </button>
          <button
            onClick={e => { e.stopPropagation(); handleRemove() }}
            className="flex flex-col items-center justify-center gap-1 rounded-xl"
            style={{ width: 45, height: 45, background: '#ef4444', color: '#fff' }}>
            <Trash2 size={14} strokeWidth={1.75} />
            <span style={{ fontSize: 9, fontWeight: 500 }}>Remove</span>
          </button>
        </div>
      )}

      {/* Recurring delete dialog */}
      {showRecurringDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowRecurringDialog(false)}
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
                &ldquo;{event.title}&rdquo; repeats. What would you like to remove?
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleRecurringDelete('single')}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium text-left transition-colors"
                style={{ background: 'var(--parchment-4)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
                This event only
              </button>
              <button
                onClick={() => handleRecurringDelete('following')}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium text-left transition-colors"
                style={{ background: 'var(--parchment-4)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
                This and all following events
              </button>
              <button
                onClick={() => handleRecurringDelete('all')}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium text-left transition-colors"
                style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                All events in this series
              </button>
            </div>
            <button
              onClick={() => setShowRecurringDialog(false)}
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
