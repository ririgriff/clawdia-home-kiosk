import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { X } from 'lucide-react'
import { IMealPlanEntry } from '@/lib/types'
import { getCategoryColor } from '@/lib/categoryColors'
import { getMemberInitials, getMemberColor } from '@/config/family'

interface Props {
  entry: IMealPlanEntry
  onRemove: (entryId: string) => void
  compact?: boolean
}

export default function DishChip({ entry, onRemove, compact }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry._id,
    data: { entryId: entry._id },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  }

  const firstCat = entry.dish ? ([] as string[]).concat(entry.dish.category as unknown as string)[0] : undefined
  const colorClass = firstCat ? getCategoryColor(firstCat) : 'bg-gray-100 text-gray-700'

  const eaters = entry.eaters ?? []
  const firstEaterColor = eaters.length > 0 ? getMemberColor(eaters[0]) : null
  const dotColor = firstEaterColor?.solid ?? 'var(--border)'

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, borderLeft: `3px solid ${dotColor}` }}
        {...listeners}
        {...attributes}
        className={`inline-flex items-center gap-1 pl-1.5 pr-0.5 py-0.5 rounded-md text-xs font-medium cursor-grab active:cursor-grabbing select-none ${colorClass}`}
      >
        <span className="truncate max-w-[64px]">{entry.dish?.name ?? '?'}</span>
        <button
          onClick={e => { e.stopPropagation(); onRemove(entry._id) }}
          onPointerDown={e => e.stopPropagation()}
          className="w-5 h-5 flex items-center justify-center rounded shrink-0 opacity-60"
          title="Remove"
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      </div>
    )
  }

  const whoLabel = eaters.map(id => getMemberInitials(id)).join('·')
  const whoStyle = firstEaterColor
    ? { background: `color-mix(in srgb, ${firstEaterColor.solid} 18%, transparent)`, color: firstEaterColor.solid }
    : { background: 'var(--parchment-5)', color: 'var(--ink-3)' }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`inline-flex items-center gap-1 pl-1.5 pr-1 py-1 rounded-lg text-sm font-medium cursor-grab active:cursor-grabbing select-none ${colorClass}`}
    >
      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md shrink-0" style={whoStyle}>
        {whoLabel}
      </span>
      <span className="truncate max-w-[90px]">{entry.dish?.name ?? 'Unknown'}</span>
      <button
        onClick={e => { e.stopPropagation(); onRemove(entry._id) }}
        onPointerDown={e => e.stopPropagation()}
        className="w-7 h-7 flex items-center justify-center rounded-md opacity-60 hover:opacity-100 transition-opacity shrink-0"
        title="Remove"
      >
        <X size={13} strokeWidth={2.5} />
      </button>
    </div>
  )
}
