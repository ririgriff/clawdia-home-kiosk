'use client'

import { useState } from 'react'
import { X, Plus, UtensilsCrossed, Eye } from 'lucide-react'
import { IMealPlanEntry, MealSlot } from '@/lib/types'
import { getCategoryColor } from '@/lib/categoryColors'
import { getMemberInitials, getMemberColor } from '@/config/family'
import DishViewSheet from './DishViewSheet'

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
}

interface Props {
  slot: MealSlot
  date: string
  entries: IMealPlanEntry[]
  onClose: () => void
  onRemove: (entryId: string) => void
  onUpdate: (entryId: string, updates: { eaters: string[]; note: string }) => void
  onAdd: () => void
}

export default function SlotDetailSheet({ slot, date, entries, onClose, onRemove, onUpdate, onAdd }: Props) {
  const [viewingEntry, setViewingEntry] = useState<IMealPlanEntry | null>(null)
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-HK', {
    weekday: 'long', month: 'short', day: 'numeric',
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '70vh', background: 'var(--parchment-3)', borderTop: '1px solid var(--border-strong)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-dashed)' }} />
        </div>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 className="font-display font-medium text-lg" style={{ color: 'var(--ink)' }}>
              {SLOT_LABELS[slot]}
            </h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ink-3)' }}>{dateLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="w-14 h-14 flex items-center justify-center rounded-xl transition-colors"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--parchment-5)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>

        {/* Dish list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {entries.map(entry => {
            const firstCat = entry.dish
              ? ([] as string[]).concat(entry.dish.category as unknown as string)[0]
              : undefined
            const colorClass = firstCat ? getCategoryColor(firstCat) : 'bg-gray-100 text-gray-700'
            const eaters = entry.eaters ?? []

            return (
              <div key={entry._id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'var(--parchment-4)', border: '1px solid var(--border)' }}
              >
                {entry.dish?.image_url ? (
                  <img src={entry.dish.image_url} alt={entry.dish.name}
                    className="w-12 h-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--parchment-5)' }}>
                    <UtensilsCrossed size={18} strokeWidth={1.25} style={{ color: 'var(--ink-4)' }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium truncate" style={{ color: 'var(--ink)' }}>
                    {entry.dish?.name ?? 'Unknown'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {eaters.map(id => {
                      const c = getMemberColor(id)
                      return (
                        <span key={id} className="text-xs font-medium px-1.5 rounded"
                          style={{ paddingTop: 2, paddingBottom: 2,
                            background: c ? `color-mix(in srgb, ${c.solid} 15%, transparent)` : 'var(--parchment-5)',
                            color: c?.solid ?? 'var(--ink-3)' }}>
                          {getMemberInitials(id)}
                        </span>
                      )
                    })}
                    {firstCat && (
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium capitalize ${colorClass}`}>
                        {firstCat.replace('-', ' ')}
                      </span>
                    )}
                  </div>
                  {entry.dish?.critical_notes && (
                    <p className="text-sm mt-1" style={{ color: '#ef4444' }}>{entry.dish.critical_notes}</p>
                  )}
                  {entry.note && (
                    <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--ink-3)' }}>{entry.note}</p>
                  )}
                </div>
                <button
                  onClick={() => setViewingEntry(entry)}
                  className="w-12 h-12 flex items-center justify-center rounded-xl transition-colors shrink-0"
                  style={{ color: 'var(--ink-4)', background: 'var(--parchment-5)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-4)')}
                >
                  <Eye size={16} strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => onRemove(entry._id)}
                  className="w-12 h-12 flex items-center justify-center rounded-xl transition-colors shrink-0"
                  style={{ color: 'var(--ink-4)', background: 'var(--parchment-5)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-4)')}
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onAdd}
            className="w-full py-5 rounded-xl text-base font-medium transition-colors flex items-center justify-center gap-2"
            style={{ background: 'var(--ember)', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ember-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--ember)')}
          >
            <Plus size={18} strokeWidth={2} /> Add a dish
          </button>
        </div>
      </div>

      {viewingEntry && (
        <DishViewSheet
          entry={viewingEntry}
          onSave={onUpdate}
          onClose={() => setViewingEntry(null)}
        />
      )}
    </>
  )
}
