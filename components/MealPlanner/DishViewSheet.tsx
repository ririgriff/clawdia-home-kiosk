'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, ExternalLink, ChefHat, Printer } from 'lucide-react'
import { IMealPlanEntry, IDish, MealSlot } from '@/lib/types'
import { MEAL_MEMBERS, MEAL_SHORTCUTS } from '@/config/family'

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
}

interface Props {
  entry: IMealPlanEntry
  onSave: (entryId: string, updates: { eaters: string[]; note: string }) => void
  onClose: () => void
}

export default function DishViewSheet({ entry, onSave, onClose }: Props) {
  const router = useRouter()
  const dish = entry.dish
  const [eaters, setEaters] = useState<string[]>(entry.eaters ?? [])
  const [note, setNote] = useState(entry.note ?? '')
  const [savedEaters, setSavedEaters] = useState<string[]>(entry.eaters ?? [])
  const [savedNote, setSavedNote] = useState(entry.note ?? '')
  const [fullDish, setFullDish] = useState<IDish | null>(null)
  const [loading, setLoading] = useState(true)

  const dateLabel = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-HK', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  useEffect(() => {
    if (!dish?._id) { setLoading(false); return }
    fetch(`/api/dishes/${dish._id}`)
      .then(r => r.json())
      .then(data => { setFullDish(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [dish?._id])

  function toggleMember(id: string) {
    setEaters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSave() {
    onSave(entry._id, { eaters, note })
    setSavedEaters(eaters)
    setSavedNote(note)
  }

  function handleEditRecipe() {
    onClose()
    router.push(`/meals?edit=${dish?._id}`)
  }

  const hasChanges =
    [...eaters].sort().join(',') !== [...savedEaters].sort().join(',') ||
    note !== savedNote

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={e => { e.stopPropagation(); onClose() }} />
      <div
        className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '88vh', background: 'var(--parchment-3)', borderTop: '1px solid var(--border-strong)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-dashed)' }} />
        </div>

        {/* Header */}
        <div className="px-6 py-4 flex items-start justify-between gap-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          {dish?.image_url && (
            <img src={dish.image_url} alt={dish.name}
              className="rounded-xl object-cover shrink-0"
              style={{ width: 64, height: 64 }} />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-medium text-xl leading-tight" style={{ color: 'var(--ink)' }}>
              {dish?.name ?? 'Dish'}
            </h3>
            {dish?.name_zh && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--ink-4)' }}>{dish.name_zh}</p>
            )}
            <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>
              {SLOT_LABELS[entry.slot]} · {dateLabel}
            </p>
          </div>
          <button onClick={onClose}
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{ width: 44, height: 44, color: 'var(--ink-3)' }}>
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          <div className="px-6 py-6 flex flex-col gap-6">
            {/* Critical notes */}
            {dish?.critical_notes && (
              <p className="text-sm font-medium px-4 py-3 rounded-xl"
                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
                ⚠ {dish.critical_notes}
              </p>
            )}

            {/* Who's eating */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                Who's eating?
              </p>
              <div className="flex flex-wrap gap-2">
                {MEAL_MEMBERS.map(member => {
                  const isSelected = eaters.includes(member.id)
                  return (
                    <button key={member.id} onClick={() => toggleMember(member.id)}
                      className="px-4 py-2 rounded-xl text-sm font-medium"
                      style={{
                        minWidth: 44, minHeight: 44,
                        background: isSelected ? member.color.solid : member.color.bg,
                        color: isSelected ? '#fff' : member.color.text,
                        border: `1px solid ${isSelected ? member.color.solid : 'transparent'}`,
                      }}>
                      {member.name}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {MEAL_SHORTCUTS.map(shortcut => {
                  const isActive = shortcut.members.length === eaters.length &&
                    shortcut.members.every(m => eaters.includes(m))
                  return (
                    <button key={shortcut.label} onClick={() => setEaters(shortcut.members)}
                      className="px-4 py-2 rounded-xl text-sm font-medium"
                      style={{
                        minWidth: 44, minHeight: 44,
                        background: isActive ? 'var(--ember)' : 'var(--ember-bg)',
                        color: isActive ? '#fff' : 'var(--ember)',
                        border: '1px solid rgba(234,88,12,0.2)',
                      }}>
                      {shortcut.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Note */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                Note (this time only)
              </p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. Make 5 portions, less spicy for the kids…"
                rows={2}
                className="w-full rounded-xl px-4 py-3 text-sm resize-none"
                style={{
                  background: 'var(--parchment-5)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                  minHeight: 72,
                  outline: 'none',
                }}
              />
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={eaters.length === 0 || !hasChanges}
              className="w-full py-4 rounded-xl text-base font-medium"
              style={{
                background: eaters.length > 0 && hasChanges ? 'var(--ember)' : 'var(--parchment-5)',
                color: eaters.length > 0 && hasChanges ? '#fff' : 'var(--ink-4)',
              }}>
              Save changes
            </button>

            {/* Divider */}
            <div style={{ borderTop: '2px solid var(--border)' }} />

            {/* Recipe section */}
            {loading ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--ink-4)' }}>Loading recipe…</p>
            ) : (
              <div className="flex flex-col gap-6">
                {fullDish?.ingredients && fullDish.ingredients.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                      Ingredients
                    </p>
                    <ul className="flex flex-col gap-2">
                      {fullDish.ingredients.map((ing, i) => (
                        <li key={i}>
                          <span className="text-sm" style={{ color: 'var(--ink)' }}>
                            {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ')}
                          </span>
                          {ing.critical_notes && (
                            <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>{ing.critical_notes}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {fullDish?.recipe && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                      Recipe
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink-2)' }}>
                      {fullDish.recipe}
                    </p>
                  </div>
                )}

                {fullDish?.notes && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                      Notes
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                      {fullDish.notes}
                    </p>
                  </div>
                )}

                {!fullDish?.ingredients?.length && !fullDish?.recipe && !fullDish?.notes && (
                  <div className="flex flex-col items-center gap-2 py-6" style={{ color: 'var(--ink-4)' }}>
                    <ChefHat size={28} strokeWidth={1.25} />
                    <p className="text-sm">No recipe added yet.</p>
                  </div>
                )}

                <div className="flex gap-3">
                  {fullDish?.reference_url && (
                    <a href={fullDish.reference_url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl text-sm font-medium"
                      style={{ minHeight: 52, background: 'var(--ember)', color: '#fff' }}>
                      <ExternalLink size={16} strokeWidth={1.75} />
                      View original
                    </a>
                  )}
                  {dish && (
                    <a href={`/dishes/${dish._id}/print`}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl text-sm font-medium"
                      style={{ minHeight: 52, background: 'var(--parchment-5)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
                      <Printer size={16} strokeWidth={1.75} />
                      Print
                    </a>
                  )}
                </div>

                {dish && (
                  <button onClick={handleEditRecipe}
                    className="flex items-center gap-2 text-sm font-medium pb-2"
                    style={{ color: 'var(--ink-3)', minHeight: 44 }}>
                    <ExternalLink size={15} strokeWidth={1.75} />
                    Edit recipe in Dish Manager
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
