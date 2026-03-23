'use client'

import { useState } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import {
  IScheduleEvent,
  EventType,
  Participant,
  EVENT_TYPES,
  PARTICIPANTS,
} from '@/lib/schedule-types'

interface Props {
  initial?: Partial<IScheduleEvent>
  onSave: (data: Omit<IScheduleEvent, '_id' | 'createdAt'>) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

const DAYS_OF_WEEK = [
  { label: 'Su', value: 0 },
  { label: 'Mo', value: 1 },
  { label: 'Tu', value: 2 },
  { label: 'We', value: 3 },
  { label: 'Th', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
]

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AddEventModal({ initial, onSave, onDelete, onClose }: Props) {
  const isEdit = !!initial?._id

  const [title, setTitle]           = useState(initial?.title ?? '')
  const [type, setType]             = useState<EventType>(initial?.type ?? 'activity')
  const [participants, setParticipants] = useState<Participant[]>(initial?.participants ?? [])
  const [startDate, setStartDate]   = useState(initial?.start?.slice(0, 10) ?? todayStr())
  const [startTime, setStartTime]   = useState(initial?.start?.slice(11) ?? '')
  const initEndDate = initial?.end?.slice(0, 10) ?? ''
  const [multiDay, setMultiDay]     = useState(!!initEndDate && initEndDate !== initial?.start?.slice(0, 10))
  const [endDate, setEndDate]       = useState(initEndDate)
  const [endTime, setEndTime]       = useState(initial?.end?.slice(11) ?? '')
  const [allDay, setAllDay]         = useState(initial?.all_day ?? true)
  const [location, setLocation]     = useState(initial?.location ?? '')
  const [notes, setNotes]           = useState(initial?.notes ?? '')
  const [origin, setOrigin]         = useState(initial?.origin ?? '')
  const [destination, setDestination] = useState(initial?.destination ?? '')
  const [travelType, setTravelType] = useState<'work' | 'family'>(initial?.travel_type ?? 'family')
  const [recurring, setRecurring]   = useState(!!initial?.recurrence)
  const [recDays, setRecDays]       = useState<number[]>(initial?.recurrence?.days ?? [])
  const [recUntil, setRecUntil]     = useState(initial?.recurrence?.until ?? '')
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isTravel   = type === 'travel'
  const canRecur   = type === 'class' || type === 'activity' || type === 'appointment'

  function toggleParticipant(p: Participant) {
    setParticipants(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function toggleRecDay(d: number) {
    setRecDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  async function handleSave() {
    if (!title.trim() || !startDate) return
    setSaving(true)

    const start = allDay ? startDate : `${startDate}T${startTime || '00:00'}`
    const resolvedEndDate = multiDay ? endDate : startDate
    const end = allDay
      ? (multiDay && endDate ? endDate : undefined)
      : `${resolvedEndDate}T${endTime || '00:00'}`

    const data: Omit<IScheduleEvent, '_id' | 'createdAt'> = {
      title: title.trim(),
      type,
      participants,
      start,
      end,
      all_day: allDay,
      location: location.trim() || undefined,
      notes:    notes.trim()    || undefined,
    }

    if (isTravel) {
      data.travel_type  = travelType
      data.origin       = origin.trim()      || undefined
      data.destination  = destination.trim() || undefined
    }

    if (canRecur && recurring && recDays.length > 0 && recUntil) {
      data.recurrence = { frequency: 'weekly', days: recDays, until: recUntil }
    }

    await onSave(data)
    setSaving(false)
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'var(--parchment)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
            {isEdit ? 'Edit Event' : 'Add Event'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors hover:opacity-70">
            <X size={18} style={{ color: 'var(--ink-3)' }} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ink-2)' }}>Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Event title"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ink-2)' }}>Type</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map(et => (
                <button key={et.value} onClick={() => setType(et.value)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-opacity"
                  style={type === et.value
                    ? { background: 'var(--ember)', color: '#fff' }
                    : { background: 'var(--parchment-3)', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
                  {et.label}
                </button>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ink-2)' }}>Participants</label>
            <div className="flex flex-wrap gap-2">
              {PARTICIPANTS.map(p => (
                <button key={p.value} onClick={() => toggleParticipant(p.value)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-opacity"
                  style={participants.includes(p.value)
                    ? { background: 'var(--ember)', color: '#fff' }
                    : { background: 'var(--parchment-3)', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* All Day toggle */}
          <div className="flex items-center gap-3">
            <button onClick={() => setAllDay(!allDay)}
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{ background: allDay ? 'var(--ember)' : 'var(--parchment-3)', border: '1px solid var(--border)' }}>
              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ left: allDay ? '18px' : '2px' }} />
            </button>
            <span className="text-sm" style={{ color: 'var(--ink-2)' }}>All day</span>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                {isTravel ? 'Departure' : 'Start'} date *
              </label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ minHeight: 44, background: 'var(--parchment-3)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
            </div>
            {!allDay && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>Start time</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ minHeight: 44, background: 'var(--parchment-3)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
              </div>
            )}
            {!allDay && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>End time</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ minHeight: 44, background: 'var(--parchment-3)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
              </div>
            )}
          </div>

          {/* Multi-day toggle */}
          <div className="flex items-center gap-3">
            <button onClick={() => setMultiDay(!multiDay)}
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{ background: multiDay ? 'var(--ember)' : 'var(--parchment-3)', border: '1px solid var(--border)' }}>
              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ left: multiDay ? '18px' : '2px' }} />
            </button>
            <span className="text-sm" style={{ color: 'var(--ink-2)' }}>
              {isTravel ? 'Return on different date' : 'Ends on different date'}
            </span>
          </div>

          {/* End date — only when multi-day */}
          {multiDay && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                {isTravel ? 'Return' : 'End'} date
              </label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                min={startDate}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ minHeight: 44, background: 'var(--parchment-3)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
            </div>
          )}

          {/* Travel fields */}
          {isTravel && (
            <div className="space-y-3 p-3 rounded-xl" style={{ background: 'var(--parchment-3)' }}>
              <div className="flex gap-2">
                {(['family', 'work'] as const).map(tt => (
                  <button key={tt} onClick={() => setTravelType(tt)}
                    className="px-3 py-1 rounded-full text-xs font-medium capitalize"
                    style={travelType === tt
                      ? { background: 'var(--ember)', color: '#fff' }
                      : { background: 'var(--parchment)', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
                    {tt}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>From</label>
                  <input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Origin"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'var(--parchment)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>To</label>
                  <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Destination"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'var(--parchment)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
                </div>
              </div>
            </div>
          )}

          {/* Location (non-travel) */}
          {!isTravel && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ink-2)' }}>Location</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Optional"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
            </div>
          )}

          {/* Recurrence */}
          {canRecur && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <button onClick={() => setRecurring(!recurring)}
                  className="relative w-10 h-5 rounded-full transition-colors"
                  style={{ background: recurring ? 'var(--ember)' : 'var(--parchment-3)', border: '1px solid var(--border)' }}>
                  <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                    style={{ left: recurring ? '18px' : '2px' }} />
                </button>
                <span className="text-sm" style={{ color: 'var(--ink-2)' }}>Recurring (weekly)</span>
              </div>
              {recurring && (
                <div className="space-y-3 p-3 rounded-xl" style={{ background: 'var(--parchment-3)' }}>
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: 'var(--ink-3)' }}>Repeat on</label>
                    <div className="flex gap-1">
                      {DAYS_OF_WEEK.map(d => (
                        <button key={d.value} onClick={() => toggleRecDay(d.value)}
                          className="w-9 h-9 rounded-full text-xs font-medium transition-colors"
                          style={recDays.includes(d.value)
                            ? { background: 'var(--ember)', color: '#fff' }
                            : { background: 'var(--parchment)', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>Until</label>
                    <input type="date" value={recUntil} onChange={e => setRecUntil(e.target.value)}
                      className="rounded-lg px-3 py-2 text-sm"
                      style={{ background: 'var(--parchment)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ink-2)' }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional"
              className="w-full rounded-lg px-3 py-2 text-sm resize-none"
              style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          {isEdit && onDelete && (
            confirmDelete ? (
              <>
                <span className="text-sm" style={{ color: 'var(--ink-3)' }}>Delete this event?</span>
                <button onClick={handleDelete} disabled={deleting}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ background: '#ef4444', color: '#fff' }}>
                  {deleting ? 'Deleting…' : 'Confirm'}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-sm" style={{ color: 'var(--ink-3)' }}>
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="text-sm transition-opacity hover:opacity-70"
                style={{ color: '#ef4444' }}>
                Delete
              </button>
            )
          )}
          <div className="ml-auto flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
              style={{ background: 'var(--parchment-3)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !title.trim()}
              className="px-5 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--ember)', color: '#fff', opacity: (!title.trim() || saving) ? 0.5 : 1 }}>
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Add Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
