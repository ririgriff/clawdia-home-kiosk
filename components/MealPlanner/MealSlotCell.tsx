import { useState } from 'react'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { Plus, Eye, Trash2, X } from 'lucide-react'
import { IMealPlanEntry, MealSlot } from '@/lib/types'
import { getMemberInitials, getMemberColor } from '@/config/family'
import DishViewSheet from './DishViewSheet'
import FavoriteHearts from '@/components/FavoriteHearts'

interface Props {
  date: string
  slot: MealSlot
  entries: IMealPlanEntry[]
  onTap: (date: string, slot: MealSlot) => void
  onRemove: (entryId: string) => void
  onUpdate: (entryId: string, updates: { eaters: string[]; note: string }) => void
  isToday: boolean
}

export default function MealSlotCell({ date, slot, entries, onTap, onRemove, onUpdate, isToday }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: `${date}|${slot}` })

  const isEmpty = entries.length === 0

  return (
    <div ref={setNodeRef} className="p-2 flex flex-col gap-2 transition-colors"
      style={{
        flex: '1 1 0',
        minWidth: 150,
        minHeight: 90,
        background: isOver ? 'rgba(234,88,12,0.12)' : isToday ? 'rgba(234,88,12,0.04)' : 'var(--parchment-2)',
        borderRight: '1px solid var(--border)',
      }}>

      {isEmpty ? (
        <button onClick={() => onTap(date, slot)}
          className="w-full flex-1 min-h-[72px] flex items-center justify-center rounded-xl transition-colors"
          style={{ border: '1px dashed var(--border-dashed)', color: 'var(--ink-4)' }}>
          <Plus size={18} strokeWidth={1.75} />
        </button>
      ) : (
        <>
          <div className="flex-1 flex flex-col gap-1.5 min-h-0">
            {entries.map(entry => (
              <DishCard key={entry._id} entry={entry} onRemove={onRemove} onUpdate={onUpdate} />
            ))}
          </div>

          {/* Add more */}
          <button onClick={() => onTap(date, slot)}
            className="w-full py-1.5 rounded-xl flex items-center justify-center transition-colors"
            style={{ color: 'var(--ink-4)', border: '1px dashed var(--border-dashed)' }}>
            <Plus size={14} strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  )
}

function DishCard({ entry, onRemove, onUpdate }: { entry: IMealPlanEntry; onRemove: (id: string) => void; onUpdate: (id: string, updates: { eaters: string[]; note: string }) => void }) {
  const dish = entry.dish
  const eaters = entry.eaters ?? []
  const [showActions, setShowActions] = useState(false)
  const [showView, setShowView] = useState(false)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry._id,
    data: { entryId: entry._id },
  })

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className="flex-1 flex items-stretch rounded-xl overflow-hidden relative min-h-0 cursor-pointer"
      style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)', opacity: isDragging ? 0.4 : 1 }}
      onClick={() => { if (!showView) setShowActions(true) }}>

      {/* Photo */}
      {dish?.image_url ? (
        <img src={dish.image_url} alt={dish?.name} className="w-12 object-cover shrink-0 self-stretch" />
      ) : (
        <div className="w-12 shrink-0 flex items-center justify-center text-lg self-stretch"
          style={{ background: 'var(--parchment-5)' }}>
          🍽
        </div>
      )}

      {/* Name + eaters */}
      <div className="flex-1 px-2 min-w-0 flex flex-col justify-center">
        <p className="text-xs font-medium leading-tight truncate" style={{ color: 'var(--ink)' }}>
          {dish?.name ?? '—'}
        </p>
        {dish?.name_zh && (
          <p className="text-xs leading-tight truncate" style={{ color: 'var(--ink-4)' }}>{dish.name_zh}</p>
        )}
        {dish?.critical_notes && (
          <p className="text-xs leading-tight truncate" style={{ color: '#ef4444' }}>{dish.critical_notes}</p>
        )}
        {entry.note && (
          <p className="text-xs leading-tight truncate" style={{ color: 'var(--ink-3)' }}>{entry.note}</p>
        )}
        {eaters.length > 0 && (
          <div className="flex gap-0.5 mt-0.5 flex-wrap">
            {eaters.map(id => {
              const c = getMemberColor(id)
              return (
                <span key={id} className="text-xs font-medium px-1 rounded"
                  style={{ paddingTop: 1, paddingBottom: 1,
                    background: c ? `color-mix(in srgb, ${c.solid} 15%, transparent)` : 'var(--parchment-5)',
                    color: c?.solid ?? 'var(--ink-3)' }}>
                  {getMemberInitials(id)}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Hearts — normal flow, vertically centered */}
      {dish && (
        <div className="shrink-0 self-center mr-1">
          <FavoriteHearts dish={dish} variant="compact" />
        </div>
      )}

      {/* Action overlay */}
      {showActions && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={e => { e.stopPropagation(); setShowActions(false) }}>
          <button
            onClick={e => { e.stopPropagation(); setShowActions(false) }}
            className="absolute top-1 right-1 flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.7)' }}>
            <X size={14} strokeWidth={2} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); setShowActions(false); setShowView(true) }}
            className="flex flex-col items-center justify-center gap-1 rounded-xl"
            style={{ width: 45, height: 45, background: 'var(--parchment-3)', color: 'var(--ink-2)' }}>
            <Eye size={14} strokeWidth={1.75} />
            <span style={{ fontSize: 9, fontWeight: 500 }}>View</span>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onRemove(entry._id) }}
            className="flex flex-col items-center justify-center gap-1 rounded-xl"
            style={{ width: 45, height: 45, background: '#ef4444', color: '#fff' }}>
            <Trash2 size={14} strokeWidth={1.75} />
            <span style={{ fontSize: 9, fontWeight: 500 }}>Remove</span>
          </button>
        </div>
      )}

      {showView && (
        <DishViewSheet
          entry={entry}
          onSave={onUpdate}
          onClose={() => { setShowView(false); setShowActions(false) }}
        />
      )}
    </div>
  )
}
