'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { MealSlot } from '@/lib/types'
import { MEAL_MEMBERS, MEAL_SHORTCUTS } from '@/config/family'

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
}

interface Props {
  slot: MealSlot
  date: string
  onSelect: (eaters: string[]) => void
  onClose: () => void
}

export default function WhoForPicker({ slot, date, onSelect, onClose }: Props) {
  const [selected, setSelected] = useState<string[]>([])

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-HK', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  function toggleMember(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function applyShortcut(members: string[]) {
    setSelected(members)
  }

  function confirm() {
    if (selected.length > 0) onSelect(selected)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
        <div
          className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: 'var(--parchment-3)', border: '1px solid var(--border-strong)' }}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-2 flex items-start justify-between">
            <div>
              <h3 className="font-display font-medium text-lg" style={{ color: 'var(--ink)' }}>
                Who is this meal for?
              </h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--ink-3)' }}>
                {SLOT_LABELS[slot]} · {dateLabel}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-12 h-12 flex items-center justify-center rounded-xl transition-colors shrink-0"
              style={{ color: 'var(--ink-3)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--parchment-5)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <X size={20} strokeWidth={1.75} />
            </button>
          </div>

          <div className="px-6 pb-6 pt-3 flex flex-col gap-4">
            {/* Individual member chips */}
            <div className="flex flex-wrap gap-2">
              {MEAL_MEMBERS.map(member => {
                const isSelected = selected.includes(member.id)
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                    style={{
                      minWidth: 44, minHeight: 44,
                      background: isSelected ? member.color.solid : member.color.bg,
                      color: isSelected ? '#fff' : member.color.text,
                      border: `1px solid ${isSelected ? member.color.solid : 'transparent'}`,
                    }}
                  >
                    {member.name}
                  </button>
                )
              })}
            </div>

            {/* Shortcuts */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--ink-4)' }}>
                Quick select
              </p>
              <div className="flex flex-wrap gap-2">
                {MEAL_SHORTCUTS.map(shortcut => {
                  const isActive = shortcut.members.length === selected.length &&
                    shortcut.members.every(m => selected.includes(m))
                  return (
                    <button
                      key={shortcut.label}
                      onClick={() => applyShortcut(shortcut.members)}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                      style={{
                        minWidth: 44, minHeight: 44,
                        background: isActive ? 'var(--ember)' : 'var(--ember-bg)',
                        color: isActive ? '#fff' : 'var(--ember)',
                        border: '1px solid rgba(234,88,12,0.2)',
                      }}
                    >
                      {shortcut.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Confirm button */}
            <button
              onClick={confirm}
              disabled={selected.length === 0}
              className="w-full py-4 rounded-xl text-base font-medium transition-colors"
              style={{
                background: selected.length > 0 ? 'var(--ember)' : 'var(--parchment-5)',
                color: selected.length > 0 ? '#fff' : 'var(--ink-4)',
              }}
            >
              {selected.length === 0 ? 'Select people above' : `Add for ${selected.map(id => MEAL_MEMBERS.find(m => m.id === id)?.name ?? id).join(' & ')}`}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
