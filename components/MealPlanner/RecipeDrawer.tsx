'use client'

import { useState, useEffect } from 'react'
import { X, Plus, UtensilsCrossed, Pencil, Heart, ShoppingCart, CheckCircle2, XCircle, Check, Search } from 'lucide-react'
import { IDish, MealSlot } from '@/lib/types'
import { getMemberName, MEAL_MEMBERS } from '@/config/family'
import AddDishModal from './AddDishModal'
import FavoriteHearts from '@/components/FavoriteHearts'

interface TaxonomyItem { _id: string; type: 'category' | 'tag'; value: string; label: string; color: string }

export interface SelectedCell {
  date: string
  slot: MealSlot
  eaters: string[]
}

interface Props {
  isOpen: boolean
  selectedCell: SelectedCell | null
  dishes: IDish[]
  existingDishIds: string[]
  onClose: () => void
  onAssign: (dishId: string, cell: SelectedCell) => void
  onUnassign: (dishId: string, cell: SelectedCell) => void
  onDishCreated: (dish: IDish) => void
  onDishUpdated: (dish: IDish) => void
}

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
}

export default function RecipeDrawer({
  isOpen, selectedCell, dishes, existingDishIds, onClose, onAssign, onUnassign, onDishCreated, onDishUpdated,
}: Props) {
  const [search, setSearch] = useState('')
  const [slotFilter, setSlotFilter] = useState<MealSlot | ''>('')
  const [favoritesFilter, setFavoritesFilter] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingDish, setEditingDish] = useState<IDish | null>(null)
  const [taxonomyCategories, setTaxonomyCategories] = useState<TaxonomyItem[]>([])
  const [taxonomyTags, setTaxonomyTags] = useState<TaxonomyItem[]>([])
  const [addedIds, setAddedIds] = useState<string[]>([])

  // Reset filters each time the drawer opens; pre-select favorites for the current eaters
  useEffect(() => {
    if (isOpen) {
      setAddedIds(existingDishIds)
      setSlotFilter(selectedCell?.slot ?? '')
      setFavoritesFilter(
        (selectedCell?.eaters ?? []).filter(id => MEAL_MEMBERS.some(m => m.id === id))
      )
      setSelectedCategories([])
      setSelectedTags([])
    }
  }, [isOpen, selectedCell?.slot, selectedCell?.eaters]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/api/taxonomy')
      .then(r => r.json())
      .then((items: TaxonomyItem[]) => {
        setTaxonomyCategories(items.filter(i => i.type === 'category'))
        setTaxonomyTags(items.filter(i => i.type === 'tag'))
      })
  }, [])

  if (!isOpen) return null

  const filtered = dishes.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase())
    const matchSlot = !slotFilter || (d.typically_served ?? []).includes(slotFilter)
    const matchFav = favoritesFilter.length === 0 ||
      favoritesFilter.some(id => (d.favorites ?? []).includes(id))
    const matchCat = selectedCategories.length === 0 ||
      selectedCategories.some(c => ([] as string[]).concat(d.category as unknown as string).includes(c))
    const matchTag = selectedTags.length === 0 ||
      selectedTags.some(t => (d.tags ?? []).some(dt => dt.toLowerCase() === t.toLowerCase()))
    return matchSearch && matchSlot && matchFav && matchCat && matchTag
  })

  const whoLabel = selectedCell?.eaters?.map(id => getMemberName(id)).join(' & ') ?? 'Everyone'
  const contextLabel = selectedCell
    ? `${SLOT_LABELS[selectedCell.slot]} · ${whoLabel} · ${new Date(selectedCell.date + 'T12:00:00').toLocaleDateString('en-HK', { weekday: 'short', month: 'short', day: 'numeric' })}`
    : ''

  async function quickUpdate(dishId: string, patch: Partial<IDish>) {
    const res = await fetch(`/api/dishes/${dishId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) onDishUpdated(await res.json())
  }

  function toggleAvailable(e: React.MouseEvent, dish: IDish) {
    e.stopPropagation()
    const nowAvailable = dish.available === false
    quickUpdate(dish._id, { available: nowAvailable, requested: nowAvailable ? false : dish.requested })
  }

  function toggleRequested(e: React.MouseEvent, dish: IDish) {
    e.stopPropagation()
    quickUpdate(dish._id, { requested: !dish.requested })
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Drawer */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '80vh', background: 'var(--parchment-3)', borderTop: '1px solid var(--border-strong)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-dashed)' }} />
        </div>

        {/* Header */}
        <div className="px-6 py-3 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 className="font-display font-medium" style={{ color: 'var(--ink)' }}>Choose a Dish</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{contextLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-4 rounded-xl text-base font-medium transition-colors flex items-center gap-2"
              style={{ background: 'var(--parchment-5)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <Plus size={16} strokeWidth={2} /> New Dish
            </button>
            {addedIds.length > 0 ? (
              <button
                onClick={onClose}
                className="px-6 py-4 rounded-xl text-base font-medium transition-colors flex items-center gap-2"
                style={{ background: 'var(--ember)', color: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ember-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--ember)')}
              >
                <Check size={16} strokeWidth={2.5} /> Done ({addedIds.length})
              </button>
            ) : (
              <button
                onClick={onClose}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-colors"
                style={{ color: 'var(--ink-3)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--parchment-5)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>

        {/* Row 1 (sticky): Meal + Liked by + Search */}
        <div className="px-6 py-2 flex items-center gap-2 shrink-0 overflow-x-auto"
          style={{ background: 'var(--parchment-3)', borderBottom: '1px solid var(--border)' }}>
          <span className="text-xs font-medium shrink-0" style={{ color: 'var(--ink-4)' }}>Meal</span>
          <button
            onClick={() => setSlotFilter('')}
            className="px-3 rounded-full text-sm font-medium shrink-0 transition-colors"
            style={{
              height: 36,
              ...(!slotFilter
                ? { background: 'var(--ember)', color: '#fff' }
                : { background: 'var(--parchment-5)', color: 'var(--ink-3)', border: '1px solid var(--border)' }),
            }}
          >
            All
          </button>
          {(['breakfast', 'lunch', 'snack', 'dinner'] as MealSlot[]).map(s => (
            <button
              key={s}
              onClick={() => setSlotFilter(prev => prev === s ? '' : s)}
              className="px-3 rounded-full text-sm font-medium shrink-0 transition-colors"
              style={{
                height: 36,
                ...(slotFilter === s
                  ? { background: 'var(--ember)', color: '#fff' }
                  : { background: 'var(--parchment-5)', color: 'var(--ink-3)', border: '1px solid var(--border)' }),
              }}
            >
              {SLOT_LABELS[s]}
            </button>
          ))}
          {/* Divider */}
          <div className="shrink-0 self-stretch" style={{ width: 1, background: 'var(--border)', margin: '6px 4px' }} />
          <span className="text-xs font-medium shrink-0" style={{ color: 'var(--ink-4)' }}>Liked by</span>
          <button
            onClick={() => setFavoritesFilter([])}
            className="px-3 rounded-full text-sm font-medium shrink-0 transition-colors"
            style={{
              height: 36,
              ...(favoritesFilter.length === 0
                ? { background: 'var(--ember)', color: '#fff' }
                : { background: 'var(--parchment-5)', color: 'var(--ink-3)', border: '1px solid var(--border)' }),
            }}
          >
            All
          </button>
          {MEAL_MEMBERS.map(m => {
            const active = favoritesFilter.includes(m.id)
            return (
              <button
                key={m.id}
                onClick={() => setFavoritesFilter(prev =>
                  prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                )}
                className="flex items-center gap-1.5 px-3 rounded-full text-sm font-medium shrink-0 transition-colors"
                style={{
                  height: 36,
                  ...(active
                    ? { background: m.color.solid, color: '#fff' }
                    : { background: 'var(--parchment-5)', color: 'var(--ink-3)', border: '1px solid var(--border)' }),
                }}
              >
                <Heart size={12} strokeWidth={1.75} fill={active ? '#fff' : 'none'} style={{ color: active ? '#fff' : m.color.solid }} />
                {m.name}
              </button>
            )
          })}
          <div className="ml-auto shrink-0 relative">
            <Search size={14} strokeWidth={1.75}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--ink-4)' }} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 rounded-full text-sm outline-none w-36"
              style={{ height: 36, background: 'var(--parchment-5)', color: 'var(--ink)', border: '1px solid var(--border-strong)' }}
            />
          </div>
        </div>

        {/* Dish grid + Category/Tag rows (all scroll together) */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Row 2: Category pills */}
          {taxonomyCategories.length > 0 && (
            <div className="px-6 py-2 flex items-center gap-2 overflow-x-auto"
              style={{ background: 'var(--parchment-3)', borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-medium shrink-0" style={{ color: 'var(--ink-4)' }}>Category</span>
              <button
                onClick={() => setSelectedCategories([])}
                className="px-3 rounded-full text-sm font-medium shrink-0 transition-colors"
                style={{
                  height: 36,
                  ...(selectedCategories.length === 0
                    ? { background: 'var(--ember)', color: '#fff' }
                    : { background: 'var(--parchment-5)', color: 'var(--ink-3)', border: '1px solid var(--border)' }),
                }}
              >
                All
              </button>
              {taxonomyCategories.map(c => (
                <button
                  key={c.value}
                  onClick={() => setSelectedCategories(prev =>
                    prev.includes(c.value) ? prev.filter(v => v !== c.value) : [...prev, c.value]
                  )}
                  className="px-3 rounded-full text-sm font-medium shrink-0 transition-colors"
                  style={{
                    height: 36,
                    ...(selectedCategories.includes(c.value)
                      ? { background: 'var(--ember)', color: '#fff' }
                      : { background: 'var(--parchment-5)', color: 'var(--ink-3)', border: '1px solid var(--border)' }),
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Row 3: Tag pills */}
          {taxonomyTags.length > 0 && (
            <div className="px-6 py-2 flex items-center gap-2 overflow-x-auto"
              style={{ background: 'var(--parchment-3)', borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-medium shrink-0" style={{ color: 'var(--ink-4)' }}>Tags</span>
              <button
                onClick={() => setSelectedTags([])}
                className="px-3 rounded-full text-sm font-medium shrink-0 transition-colors"
                style={{
                  height: 36,
                  ...(selectedTags.length === 0
                    ? { background: 'var(--ember)', color: '#fff' }
                    : { background: 'var(--parchment-5)', color: 'var(--ink-3)', border: '1px solid var(--border)' }),
                }}
              >
                All
              </button>
              {taxonomyTags.map(t => (
                <button
                  key={t.value}
                  onClick={() => setSelectedTags(prev =>
                    prev.includes(t.label) ? prev.filter(v => v !== t.label) : [...prev, t.label]
                  )}
                  className="px-3 rounded-full text-sm font-medium shrink-0 transition-colors"
                  style={{
                    height: 36,
                    ...(selectedTags.includes(t.label)
                      ? { background: 'var(--ember)', color: '#fff' }
                      : { background: 'var(--parchment-5)', color: 'var(--ink-3)', border: '1px solid var(--border)' }),
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Dish grid */}
          <div className="px-6 py-4">
          {filtered.length === 0 ? (
            <p className="text-center py-12" style={{ color: 'var(--ink-4)' }}>No dishes found</p>
          ) : (
            <div className="grid grid-cols-3 gap-4 lg:grid-cols-4">
              {filtered.map(dish => {
                const isAvailable = dish.available !== false
                const isRequested = !!dish.requested
                const isAdded = addedIds.includes(dish._id)

                return (
                  <div
                    key={dish._id}
                    className="rounded-xl text-left flex flex-col overflow-hidden transition-opacity"
                    style={{
                      background: 'var(--parchment-4)',
                      border: '1px solid var(--border)',
                      opacity: isAvailable ? 1 : 0.55,
                    }}
                  >
                    {/* Image area — tap to assign */}
                    <div className="relative">
                      <button
                        className="w-full active:scale-95 transition-transform block"
                        onClick={() => {
                          if (!selectedCell) return
                          if (isAdded) {
                            onUnassign(dish._id, selectedCell)
                            setAddedIds(prev => prev.filter(id => id !== dish._id))
                          } else {
                            onAssign(dish._id, selectedCell)
                            setAddedIds(prev => [...prev, dish._id])
                          }
                        }}
                      >
                        {dish.image_url ? (
                          <img
                            src={dish.image_url}
                            alt={dish.name}
                            className="w-full aspect-square object-cover"
                          />
                        ) : (
                          <div className="w-full aspect-square flex items-center justify-center"
                            style={{ background: 'var(--parchment-5)' }}>
                            <UtensilsCrossed size={28} strokeWidth={1.25} style={{ color: 'var(--ink-4)' }} />
                          </div>
                        )}
                        {/* Added overlay — tap again to deselect */}
                        {isAdded && (
                          <div className="absolute inset-0 flex items-center justify-center"
                            style={{ background: 'rgba(74,124,111,0.55)' }}>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center"
                              style={{ background: 'rgba(255,255,255,0.95)' }}>
                              <X size={22} strokeWidth={2.5} style={{ color: 'var(--sage)' }} />
                            </div>
                          </div>
                        )}

                        {/* Not available overlay */}
                        {!isAvailable && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-t-none"
                            style={{ background: 'rgba(240,238,235,0.5)' }}>
                            <span className="text-sm font-medium px-3 py-1 rounded-lg"
                              style={{ background: 'var(--parchment-3)', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
                              Unavailable
                            </span>
                          </div>
                        )}
                      </button>

                      {/* Favorites hearts — top left */}
                      <div className="absolute top-2 left-2">
                        <FavoriteHearts
                          dish={dish}
                          variant="compact"
                          onUpdate={newFavs => onDishUpdated({ ...dish, favorites: newFavs })}
                        />
                      </div>

                      {/* Edit — top right */}
                      <button
                        onClick={e => { e.stopPropagation(); setEditingDish(dish) }}
                        className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-xl transition-colors"
                        style={{ background: 'rgba(255,255,255,0.85)', color: 'var(--ink-3)', border: '1px solid var(--border)' }}
                        title="Edit dish"
                      >
                        <Pencil size={16} strokeWidth={1.75} />
                      </button>
                    </div>

                    {/* Info + controls */}
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div>
                        <p className="text-base font-medium truncate" style={{ color: 'var(--ink)' }}>{dish.name}</p>
                        <p className="text-sm capitalize" style={{ color: 'var(--ink-3)' }}>
                          {([] as string[]).concat(dish.category as unknown as string).map(c => c.replace('-', ' ')).join(', ')}
                        </p>
                        {dish.critical_notes && (
                          <p className="text-xs mt-1 leading-snug" style={{ color: '#ef4444' }}>{dish.critical_notes}</p>
                        )}
                      </div>

                      {/* Bottom row: availability + request */}
                      <div className="flex items-center gap-2 mt-auto flex-wrap">
                        {/* Availability toggle */}
                        <button
                          onClick={e => toggleAvailable(e, dish)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center"
                          style={isAvailable
                            ? { background: 'var(--sage-bg)', color: 'var(--sage)', border: '1px solid rgba(74,124,111,0.2)' }
                            : { background: 'var(--parchment-5)', color: 'var(--ink-4)', border: '1px solid var(--border)' }
                          }
                        >
                          {isAvailable
                            ? <><CheckCircle2 size={14} strokeWidth={2} /> Available</>
                            : <><XCircle size={14} strokeWidth={2} /> Not Available</>
                          }
                        </button>

                        {/* Request button — only when unavailable */}
                        {!isAvailable && (
                          <button
                            onClick={e => toggleRequested(e, dish)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center"
                            style={isRequested
                              ? { background: 'rgba(234,88,12,0.12)', color: 'var(--ember)', border: '1px solid rgba(234,88,12,0.25)' }
                              : { background: 'var(--parchment-5)', color: 'var(--ink-3)', border: '1px solid var(--border)' }
                            }
                            title="Request for procurement"
                          >
                            <ShoppingCart size={14} strokeWidth={1.75} />
                            {isRequested ? 'Requested' : 'Request'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddDishModal
          onClose={() => setShowAddModal(false)}
          onCreated={dish => {
            onDishCreated(dish)
            setShowAddModal(false)
          }}
        />
      )}

      {editingDish && (
        <AddDishModal
          existingDish={editingDish}
          onClose={() => setEditingDish(null)}
          onCreated={dish => {
            onDishUpdated(dish)
            setEditingDish(null)
          }}
        />
      )}
    </>
  )
}
