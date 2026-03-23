'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Zap, X, Check, ChevronDown, RefreshCw } from 'lucide-react'
import type { ITodoItem, TodoAssignee } from '@/lib/todo-types'
import { TODO_ASSIGNEES, ASSIGNEE_STYLE } from '@/lib/todo-types'
import { TIMEZONE } from '@/config/family'

// ── helpers ───────────────────────────────────────────────────────────────────

function hkToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

function formatDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-HK', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

// ── Row ───────────────────────────────────────────────────────────────────────

interface RowProps {
  todo:      ITodoItem
  onToggle:  (t: ITodoItem) => void
  onRemove:  (t: ITodoItem) => void
  onConvert: (t: ITodoItem) => void
  onEdit:    (t: ITodoItem, field: string, value: unknown) => void
}

function TodoRow({ todo, onToggle, onRemove, onConvert, onEdit }: RowProps) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(todo.title)
  const done = todo.done

  function commitEdit() {
    if (draft.trim() && draft.trim() !== todo.title) onEdit(todo, 'title', draft.trim())
    setEditing(false)
  }

  return (
    // items-stretch: child buttons fill full row height for large touch targets
    <div className="flex items-stretch rounded-xl overflow-hidden"
      style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)', minHeight: 56 }}>

      {/* Checkbox — full-height touch target */}
      <button onClick={() => onToggle(todo)}
        className="flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ minWidth: 52, paddingLeft: 14, paddingRight: 10 }}>
        <span className="w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors"
          style={done
            ? { background: 'var(--ember)', borderColor: 'var(--ember)' }
            : { borderColor: 'var(--ink-4)', background: '#fff' }}>
          {done && <Check size={13} strokeWidth={3} color="#fff" />}
        </span>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 py-3 pr-2">
        {editing
          ? (
            <input autoFocus value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
              className="w-full text-sm outline-none rounded px-1 -mx-1"
              style={{ color: 'var(--ink)', background: '#fff', border: '1px solid var(--ember)', minHeight: 36 }}
            />
          )
          : (
            <p className="text-sm leading-5 cursor-text"
              onClick={() => { if (!done) { setDraft(todo.title); setEditing(true) } }}
              style={{ color: done ? 'var(--ink-4)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none' }}>
              {todo.title}
            </p>
          )}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Assignee selector — min 36px tall (secondary action within row) */}
          <div className="flex gap-1.5">
            {TODO_ASSIGNEES.map(a => {
              const active = todo.assignee === a.value
              return (
                <button key={a.value}
                  onClick={() => onEdit(todo, 'assignee', active ? null : a.value)}
                  className="px-3 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    minHeight: 36,
                    ...(active
                      ? { background: ASSIGNEE_STYLE[a.value].bg, color: ASSIGNEE_STYLE[a.value].text, border: `1px solid ${ASSIGNEE_STYLE[a.value].text}` }
                      : { background: 'transparent', color: 'var(--ink-4)', border: '1px solid var(--border)' })
                  }}>
                  {a.label}
                </button>
              )
            })}
          </div>

          {/* Auto badge — min 36px tall */}
          {todo.source === 'auto' && (
            <button onClick={() => onConvert(todo)}
              title="Convert to manual item"
              className="px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-opacity"
              style={{ minHeight: 36, background: 'rgba(217,119,6,0.1)', color: '#b45309', border: '1px solid rgba(217,119,6,0.2)' }}>
              <Zap size={11} strokeWidth={2.5} />
              auto — tap to convert
            </button>
          )}
        </div>
      </div>

      {/* Delete — full-height touch target, always visible */}
      <button onClick={() => onRemove(todo)}
        className="flex items-center justify-center flex-shrink-0 transition-opacity"
        style={{ minWidth: 52, paddingLeft: 10, paddingRight: 14, color: 'var(--ink-4)', opacity: 0.4 }}>
        <X size={18} strokeWidth={2} />
      </button>
    </div>
  )
}

// ── Group ─────────────────────────────────────────────────────────────────────

interface GroupProps extends Omit<RowProps, 'todo'> {
  label:      string
  items:      ITodoItem[]
  alwaysShow?: boolean
}

function Group({ label, items, alwaysShow, ...handlers }: GroupProps) {
  if (!alwaysShow && items.length === 0) return null
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--ink-4)' }}>
        {label}
      </h3>
      {items.length === 0
        ? (
          <p className="text-sm px-4 py-3 rounded-xl"
            style={{ color: 'var(--ink-4)', background: 'var(--parchment-3)', border: '1px solid var(--border)' }}>
            Nothing here ✓
          </p>
        )
        : (
          <div className="flex flex-col gap-2">
            {items.map(todo => <TodoRow key={todo._id} todo={todo} {...handlers} />)}
          </div>
        )}
    </section>
  )
}

// ── Add form ──────────────────────────────────────────────────────────────────

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
    <div className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: 'var(--parchment-3)', border: '1px solid var(--ember)', boxShadow: '0 0 0 3px var(--ember-bg)' }}>
      {/* Title — min 44px */}
      <input autoFocus value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="What needs doing?"
        className="w-full px-4 rounded-xl text-sm outline-none"
        style={{ background: '#fff', border: '1px solid var(--border)', color: 'var(--ink)', minHeight: 44 }}
      />
      {/* Assignee + date — min 44px */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-2">
          {TODO_ASSIGNEES.map(a => (
            <button key={a.value}
              onClick={() => setAssignee(v => v === a.value ? '' : a.value)}
              className="px-4 rounded-xl text-sm font-medium transition-colors"
              style={{
                minHeight: 44,
                ...(assignee === a.value
                  ? { background: ASSIGNEE_STYLE[a.value].solid, color: '#fff' }
                  : { background: 'var(--parchment-4)', color: 'var(--ink-3)', border: '1px solid var(--border)' })
              }}>
              {a.label}
            </button>
          ))}
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="px-4 rounded-xl text-sm outline-none"
          style={{ background: 'var(--parchment-4)', border: '1px solid var(--border)', color: 'var(--ink-3)', minHeight: 44 }}
        />
      </div>
      {/* Action buttons — min 44px */}
      <div className="flex gap-3">
        <button onClick={submit}
          className="flex-1 rounded-xl text-sm font-medium"
          style={{ background: 'var(--ember)', color: '#fff', minHeight: 44 }}>
          Add item
        </button>
        <button onClick={onClose}
          className="px-6 rounded-xl text-sm font-medium"
          style={{ background: 'var(--parchment-4)', color: 'var(--ink-3)', border: '1px solid var(--border)', minHeight: 44 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type AssigneeFilter = TodoAssignee | 'all'

export default function TodoList() {
  const [todos,       setTodos]       = useState<ITodoItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [adding,      setAdding]      = useState(false)
  const [filter,      setFilter]      = useState<AssigneeFilter>('all')
  const [showDone,    setShowDone]    = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [genMessage,  setGenMessage]  = useState<string | null>(null)

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

  async function regenerate() {
    setGenerating(true)
    setGenMessage(null)
    try {
      const res = await fetch('/api/todos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      })
      const data = await res.json()
      setGenMessage(data.totalCreated > 0
        ? `Added ${data.totalCreated} new item${data.totalCreated !== 1 ? 's' : ''}`
        : 'Already up to date')
      await load()
    } finally {
      setGenerating(false)
      setTimeout(() => setGenMessage(null), 3000)
    }
  }

  const visible       = filter === 'all' ? todos : todos.filter(t => t.assignee === filter)
  const todayItems    = visible.filter(t => t.date === today && !t.done)
  const generalItems  = visible.filter(t => !t.date && !t.done)
  const doneItems     = visible.filter(t => t.done)

  const upcomingMap = new Map<string, ITodoItem[]>()
  visible.filter(t => t.date && t.date > today && !t.done).forEach(t => {
    const key = t.date!
    if (!upcomingMap.has(key)) upcomingMap.set(key, [])
    upcomingMap.get(key)!.push(t)
  })
  const upcomingDates = [...upcomingMap.keys()].sort()

  const handlers = { onToggle: toggle, onRemove: remove, onConvert: convert, onEdit: edit }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Toolbar — all buttons min 44px */}
      <div className="shrink-0 px-6 flex items-center gap-3 flex-wrap"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--parchment-3)', minHeight: 64 }}>
        <h1 className="font-display font-medium text-lg mr-2" style={{ color: 'var(--ink)' }}>To-Do</h1>

        {/* Assignee filter chips */}
        <div className="flex gap-1.5">
          {(['all', ...TODO_ASSIGNEES.map(a => a.value)] as AssigneeFilter[]).map(v => {
            const label = v === 'all' ? 'All' : TODO_ASSIGNEES.find(a => a.value === v)?.label ?? v
            const active = filter === v
            const style = active && v !== 'all'
              ? { background: ASSIGNEE_STYLE[v as TodoAssignee].bg, color: ASSIGNEE_STYLE[v as TodoAssignee].text, border: `1px solid ${ASSIGNEE_STYLE[v as TodoAssignee].text}` }
              : active
                ? { background: 'var(--ember-bg)', color: 'var(--ember)', border: '1px solid var(--ember)' }
                : { background: 'transparent', color: 'var(--ink-4)', border: '1px solid var(--border)' }
            return (
              <button key={v} onClick={() => setFilter(v)}
                className="px-4 rounded-xl text-sm font-medium transition-colors"
                style={{ minHeight: 44, ...style }}>
                {label}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {genMessage && (
            <span className="text-sm" style={{ color: 'var(--ink-3)' }}>{genMessage}</span>
          )}
          <button onClick={regenerate} disabled={generating}
            title="Regenerate auto items for the next 30 days"
            className="flex items-center gap-2 px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--parchment-4)', color: 'var(--ink-3)', border: '1px solid var(--border)', minHeight: 44 }}>
            <RefreshCw size={15} strokeWidth={2} className={generating ? 'animate-spin' : ''} />
            Regenerate
          </button>
          <button onClick={() => setAdding(a => !a)}
            className="flex items-center gap-2 px-4 rounded-xl text-sm font-medium transition-colors"
            style={{
              minHeight: 44,
              ...(adding
                ? { background: 'var(--ember-bg)', color: 'var(--ember)' }
                : { background: 'var(--ember)', color: '#fff' })
            }}>
            <Plus size={16} strokeWidth={2} />
            Add item
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 flex flex-col gap-6"
        style={{ background: 'var(--parchment-2)' }}>

        {loading && (
          <p className="text-sm text-center py-12" style={{ color: 'var(--ink-4)' }}>Loading…</p>
        )}

        {adding && <AddForm onAdd={addItem} onClose={() => setAdding(false)} />}

        {!loading && <Group label="Today" items={todayItems} alwaysShow {...handlers} />}
        {!loading && upcomingDates.map(d => (
          <Group key={d} label={formatDate(d)} items={upcomingMap.get(d)!} {...handlers} />
        ))}
        {!loading && <Group label="General" items={generalItems} {...handlers} />}

        {/* Completed — toggle button min 44px */}
        {!loading && doneItems.length > 0 && (
          <section>
            <button
              className="flex items-center gap-2 text-sm font-medium mb-3 rounded-lg px-2 -mx-2"
              style={{ color: 'var(--ink-4)', minHeight: 44 }}
              onClick={() => setShowDone(s => !s)}>
              <ChevronDown size={16} strokeWidth={2}
                style={{ transform: showDone ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }} />
              Completed ({doneItems.length})
            </button>
            {showDone && (
              <div className="flex flex-col gap-2">
                {doneItems.map(todo => <TodoRow key={todo._id} todo={todo} {...handlers} />)}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
