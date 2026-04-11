'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Zap, X, ArrowUpRight, Check } from 'lucide-react'
import type { ITodoItem, TodoAssignee } from '@/lib/todo-types'
import { TODO_ASSIGNEES, ASSIGNEE_STYLE } from '@/lib/todo-types'
import { TIMEZONE } from '@/config/family'

// ── helpers ──────────────────────────────────────────────────────────────────

function hkToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

function formatShortDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-HK', {
    month: 'short', day: 'numeric',
  })
}

// ── sub-components ────────────────────────────────────────────────────────────

interface RowProps {
  todo:       ITodoItem
  onToggle:   (t: ITodoItem) => void
  onRemove:   (t: ITodoItem) => void
  onConvert:  (t: ITodoItem) => void
  onEdit:     (t: ITodoItem, field: string, value: unknown) => void
  showDate?:  boolean
}

function TodoRow({ todo, onToggle, onRemove, onConvert, onEdit, showDate }: RowProps) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(todo.title)
  const done = todo.done

  function commitEdit() {
    if (draft.trim() && draft.trim() !== todo.title) onEdit(todo, 'title', draft.trim())
    setEditing(false)
  }

  return (
    // items-stretch so child buttons fill the full row height → large touch targets
    <div className="flex items-stretch rounded-xl overflow-hidden"
      style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)', minHeight: 52 }}>

      {/* Checkbox — full-height touch target, min 44px wide */}
      <button onClick={() => onToggle(todo)}
        className="flex items-center justify-center flex-shrink-0"
        style={{ minWidth: 44, paddingLeft: 10, paddingRight: 8 }}>
        <span className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
          style={done
            ? { background: 'var(--ember)', borderColor: 'var(--ember)' }
            : { borderColor: 'var(--ink-4)', background: '#fff' }}>
          {done && <Check size={11} strokeWidth={3} color="#fff" />}
        </span>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 py-2.5 pr-1">
        {editing
          ? (
            <input autoFocus value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
              className="w-full text-sm outline-none rounded px-1 -mx-1"
              style={{ color: 'var(--ink)', background: '#fff', border: '1px solid var(--ember)', minHeight: 32 }}
            />
          )
          : (
            <p className="text-sm leading-5 cursor-text break-words"
              onClick={() => { if (!done) { setDraft(todo.title); setEditing(true) } }}
              style={{ color: done ? 'var(--ink-4)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none' }}>
              {todo.title}
            </p>
          )}

        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {/* Overdue date badge */}
          {showDate && todo.date && (
            <span className="text-xs px-2 py-0.5 rounded-md font-medium"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
              {formatShortDate(todo.date)}
            </span>
          )}

          {/* Assignee selector */}
          <div className="flex gap-1">
            {TODO_ASSIGNEES.map(a => {
              const active = todo.assignee === a.value
              return (
                <button key={a.value}
                  onClick={() => onEdit(todo, 'assignee', active ? null : a.value)}
                  className="px-2 rounded-md text-xs font-medium transition-colors"
                  style={{
                    minHeight: 28,
                    ...(active
                      ? { background: ASSIGNEE_STYLE[a.value].bg, color: ASSIGNEE_STYLE[a.value].text }
                      : { background: 'transparent', color: 'var(--ink-4)', border: '1px solid var(--border)' })
                  }}>
                  {a.label}
                </button>
              )
            })}
          </div>

          {/* Auto badge */}
          {todo.source === 'auto' && (
            <button onClick={() => onConvert(todo)}
              title="Convert to manual item (detach from auto-gen)"
              className="text-xs px-2 py-0.5 rounded-md flex items-center gap-1"
              style={{ minHeight: 28, background: 'rgba(217,119,6,0.1)', color: '#b45309' }}>
              <Zap size={10} strokeWidth={2.5} />
              auto
            </button>
          )}
        </div>
      </div>

      {/* Delete — full-height touch target, always visible, min 44px wide */}
      <button onClick={() => onRemove(todo)}
        className="flex items-center justify-center flex-shrink-0"
        style={{ minWidth: 44, paddingLeft: 8, paddingRight: 10, color: 'var(--ink-4)', opacity: 0.4 }}>
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  )
}

interface SectionProps extends Omit<RowProps, 'todo'> {
  title:      string
  items:      ITodoItem[]
  alwaysShow?: boolean
}

function Section({ title, items, alwaysShow, ...handlers }: SectionProps) {
  if (!alwaysShow && items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--ink-3)' }}>{title}</p>
      {items.length === 0
        ? (
          <p className="text-sm px-4 py-3 rounded-xl"
            style={{ color: 'var(--ink-4)', background: 'var(--parchment-3)', border: '1px solid var(--border)' }}>
            All clear ✓
          </p>
        )
        : (
          <div className="flex flex-col gap-2">
            {items.map(todo => <TodoRow key={todo._id} todo={todo} {...handlers} />)}
          </div>
        )}
    </div>
  )
}

// ── Add form ─────────────────────────────────────────────────────────────────

interface AddFormProps {
  onAdd:   (title: string, assignee: TodoAssignee | '', date: string) => Promise<void>
  onClose: () => void
}

function AddForm({ onAdd, onClose }: AddFormProps) {
  const [title,    setTitle]    = useState('')
  const [assignee, setAssignee] = useState<TodoAssignee | ''>('')
  const [date,     setDate]     = useState(hkToday())

  async function submit() {
    if (!title.trim()) return
    await onAdd(title, assignee, date)
  }

  return (
    <div className="shrink-0 p-3 flex flex-col gap-3"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--parchment-4)' }}>
      {/* Title input — min 44px tall */}
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="What needs doing?"
        className="w-full px-3 rounded-lg text-sm outline-none"
        style={{ background: '#fff', border: '1px solid var(--border)', color: 'var(--ink)', minHeight: 44 }}
      />
      {/* Assignee + date row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {TODO_ASSIGNEES.map(a => (
            <button key={a.value}
              onClick={() => setAssignee(v => v === a.value ? '' : a.value)}
              className="px-3 rounded-lg text-sm font-medium transition-colors"
              style={{
                minHeight: 44,
                ...(assignee === a.value
                  ? { background: ASSIGNEE_STYLE[a.value].solid, color: '#fff' }
                  : { background: 'var(--parchment-3)', color: 'var(--ink-3)', border: '1px solid var(--border)' })
              }}>
              {a.label}
            </button>
          ))}
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="flex-1 px-3 rounded-lg text-sm outline-none"
          style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)', color: 'var(--ink-3)', minHeight: 44 }}
        />
      </div>
      {/* Action buttons — min 44px tall */}
      <div className="flex gap-2">
        <button onClick={submit}
          className="flex-1 rounded-lg text-sm font-medium"
          style={{ background: 'var(--ember)', color: '#fff', minHeight: 44 }}>
          Add
        </button>
        <button onClick={onClose}
          className="flex-1 rounded-lg text-sm font-medium"
          style={{ background: 'var(--parchment-3)', color: 'var(--ink-3)', border: '1px solid var(--border)', minHeight: 44 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RemindersPanel({ compact }: { compact?: boolean }) {
  const [todos,   setTodos]   = useState<ITodoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding,  setAdding]  = useState(false)

  const today = hkToday()

  const load = useCallback(async () => {
    const res = await fetch('/api/todos')
    if (res.ok) setTodos(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(todo: ITodoItem) {
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

  async function edit(todo: ITodoItem, field: string, value: unknown) {
    setTodos(ts => ts.map(t => t._id === todo._id ? { ...t, [field]: value } : t))
    await fetch(`/api/todos/${todo._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }

  async function convert(todo: ITodoItem) {
    setTodos(ts => ts.map(t => t._id === todo._id ? { ...t, source: 'manual' } : t))
    await fetch(`/api/todos/${todo._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'manual' }),
    })
  }

  async function remove(todo: ITodoItem) {
    setTodos(ts => ts.filter(t => t._id !== todo._id))
    await fetch(`/api/todos/${todo._id}`, { method: 'DELETE' })
  }

  async function addItem(title: string, assignee: TodoAssignee | '', date: string) {
    const body = { title, date: date || undefined, assignee: assignee || undefined }
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const created = await res.json()
      setTodos(ts => [...ts, created])
    }
    setAdding(false)
  }

  // Overdue: past-due, undone only (shown at top with date)
  const overdue = todos
    .filter(t => t.date && t.date < today && !t.done)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1))

  // General (no date): undone first, done last
  const generalItems = todos
    .filter(t => !t.date)
    .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0))

  const next7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
  })

  function dayLabel(dateStr: string, i: number): string {
    if (i === 0) return 'Today'
    if (i === 1) return 'Tomorrow'
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-HK', { weekday: 'long', month: 'short', day: 'numeric' })
  }

  const handlers = { onToggle: toggle, onRemove: remove, onConvert: convert, onEdit: edit }

  if (compact) {
    const todayItems = todos
      .filter(t => t.date === today)
      .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0))

    return (
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="px-4 shrink-0 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--parchment-3)', minHeight: 56 }}>
          <h2 className="font-display font-medium text-base" style={{ color: 'var(--ink)' }}>To-Do</h2>
          <div className="flex items-center">
            <Link href="/todo"
              className="flex items-center justify-center rounded-lg"
              style={{ minWidth: 44, minHeight: 44, color: 'var(--ink-4)' }}>
              <ArrowUpRight size={18} strokeWidth={1.75} />
            </Link>
            <button onClick={() => setAdding(a => !a)}
              className="flex items-center justify-center rounded-lg"
              style={{
                minWidth: 44, minHeight: 44,
                ...(adding
                  ? { background: 'var(--ember-bg)', color: 'var(--ember)' }
                  : { color: 'var(--ink-3)' })
              }}>
              <Plus size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
        {adding && <AddForm onAdd={addItem} onClose={() => setAdding(false)} />}
        <div className="p-3 flex flex-col gap-4" style={{ background: 'var(--parchment-2)' }}>
          {loading && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--ink-4)' }}>Loading…</p>
          )}
          {!loading && overdue.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: '#dc2626' }}>Overdue</p>
              <div className="flex flex-col gap-2">
                {overdue.map(todo => <TodoRow key={todo._id} todo={todo} showDate {...handlers} />)}
              </div>
            </div>
          )}
          {!loading && <Section title="Today" items={todayItems} alwaysShow {...handlers} />}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header — 44px min height icon buttons */}
      <div className="px-4 shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--parchment-3)', minHeight: 56 }}>
        <h2 className="font-display font-medium text-base" style={{ color: 'var(--ink)' }}>To-Do</h2>
        <div className="flex items-center">
          <Link href="/todo" title="Full to-do list"
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ minWidth: 44, minHeight: 44, color: 'var(--ink-4)' }}>
            <ArrowUpRight size={18} strokeWidth={1.75} />
          </Link>
          <button onClick={() => setAdding(a => !a)}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{
              minWidth: 44, minHeight: 44,
              ...(adding
                ? { background: 'var(--ember-bg)', color: 'var(--ember)' }
                : { color: 'var(--ink-3)' })
            }}>
            <Plus size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding && <AddForm onAdd={addItem} onClose={() => setAdding(false)} />}

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 flex flex-col gap-4"
        style={{ background: 'var(--parchment-2)' }}>

        {loading && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--ink-4)' }}>Loading…</p>
        )}

        {/* Overdue — past-due undone tasks with date badge */}
        {!loading && overdue.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: '#dc2626' }}>Overdue</p>
            <div className="flex flex-col gap-2">
              {overdue.map(todo => <TodoRow key={todo._id} todo={todo} showDate {...handlers} />)}
            </div>
          </div>
        )}

        {!loading && next7.map((dateStr, i) => {
          // Show all items for this date (done and undone), done sorted to bottom
          const items = todos
            .filter(t => t.date === dateStr)
            .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0))
          if (i > 0 && items.length === 0) return null
          return (
            <Section key={dateStr} title={dayLabel(dateStr, i)} items={items} alwaysShow={i === 0} {...handlers} />
          )
        })}

        {!loading && generalItems.length > 0 && (
          <Section title="General" items={generalItems} {...handlers} />
        )}
      </div>
    </div>
  )
}
