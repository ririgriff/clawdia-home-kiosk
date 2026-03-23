'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, UtensilsCrossed, Pencil, CheckCircle2, XCircle, Search, Check, Trash2, Bot, SquarePen, Heart } from 'lucide-react'
import NavBar from '@/components/NavBar'
import AddDishModal from '@/components/MealPlanner/AddDishModal'
import FavoriteHearts from '@/components/FavoriteHearts'
import { IDish, MealSlot } from '@/lib/types'
import { updateCategoryColors, getCategoryColor } from '@/lib/categoryColors'
import { MEAL_MEMBERS } from '@/config/family'

interface TaxonomyItem { _id: string; type: 'category' | 'tag'; value: string; label: string; color: string }

type Tab = 'dishes' | 'review'

export default function MealsPage() {
  return (
    <Suspense>
      <MealsPageInner />
    </Suspense>
  )
}

function MealsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>('dishes')
  const [dishes, setDishes] = useState<IDish[]>([])
  const [pending, setPending] = useState<IDish[]>([])
  const [search, setSearch] = useState('')
  const [slotFilter, setSlotFilter] = useState<MealSlot | ''>('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [favoritesFilter, setFavoritesFilter] = useState<string[]>([])
  const [taxonomyTags, setTaxonomyTags] = useState<TaxonomyItem[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingDish, setEditingDish] = useState<IDish | null>(null)
  const [editingPending, setEditingPending] = useState<IDish | null>(null)
  const [taxonomyCategories, setTaxonomyCategories] = useState<TaxonomyItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const [dishRes, pendingRes, taxRes] = await Promise.all([
      fetch('/api/dishes'),
      fetch('/api/dishes?status=pending'),
      fetch('/api/taxonomy'),
    ])
    const taxData: TaxonomyItem[] = await taxRes.json()
    const cats = taxData.filter(i => i.type === 'category')
    const tags = taxData.filter(i => i.type === 'tag')
    setTaxonomyCategories(cats)
    setTaxonomyTags(tags)
    updateCategoryColors(cats)
    setDishes(await dishRes.json())
    setPending(await pendingRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (loading) return
    const editId = searchParams.get('edit')
    if (!editId) return
    const dish = dishes.find(d => d._id === editId)
    if (dish) {
      setEditingDish(dish)
      router.replace('/meals')
    }
  }, [loading, dishes, searchParams, router])

  // ── Active dishes ────────────────────────────────────────────────────────

  function toggleAvailable(dish: IDish) {
    const nowAvailable = dish.available === false
    setDishes(prev => prev.map(d =>
      d._id === dish._id ? { ...d, available: nowAvailable, requested: nowAvailable ? false : d.requested } : d
    ))
    fetch(`/api/dishes/${dish._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: nowAvailable, requested: nowAvailable ? false : dish.requested }),
    }).then(async res => {
      if (res.ok) {
        const updated: IDish = await res.json()
        setDishes(prev => prev.map(d => d._id === updated._id ? updated : d))
      } else {
        setDishes(prev => prev.map(d => d._id === dish._id ? dish : d))
      }
    }).catch(() => {
      setDishes(prev => prev.map(d => d._id === dish._id ? dish : d))
    })
  }

  // ── Review actions ───────────────────────────────────────────────────────

  async function approveDish(dish: IDish) {
    const res = await fetch(`/api/dishes/${dish._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })
    if (res.ok) {
      const approved: IDish = await res.json()
      setPending(prev => prev.filter(d => d._id !== dish._id))
      setDishes(prev => [...prev, approved].sort((a, b) => a.name.localeCompare(b.name)))
    }
  }

  async function rejectDish(dishId: string) {
    await fetch(`/api/dishes/${dishId}`, { method: 'DELETE' })
    setPending(prev => prev.filter(d => d._id !== dishId))
  }

  async function deleteDish(dishId: string) {
    await fetch(`/api/dishes/${dishId}`, { method: 'DELETE' })
    setDishes(prev => prev.filter(d => d._id !== dishId))
  }

  // ── Filter ───────────────────────────────────────────────────────────────

  const filtered = dishes.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.name_zh ?? '').includes(search)
    const matchSlot = !slotFilter || (d.typically_served ?? []).includes(slotFilter)
    const matchCat = selectedCategories.length === 0 ||
      selectedCategories.some(c => ([] as string[]).concat(d.category as unknown as string).includes(c))
    const matchTag = selectedTags.length === 0 ||
      selectedTags.some(t => (d.tags ?? []).some(dt => dt.toLowerCase() === t.toLowerCase()))
    const matchFav = favoritesFilter.length === 0 ||
      favoritesFilter.some(id => (d.favorites ?? []).includes(id))
    return matchSearch && matchSlot && matchCat && matchTag && matchFav
  })

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--parchment-2)' }}>
      <NavBar activePath="/meals" />

      <main className="flex-1 flex flex-col overflow-hidden min-h-0">

        {/* Tab bar */}
        <div className="px-8 flex items-end gap-1 shrink-0"
          style={{ background: 'var(--parchment-3)', borderBottom: '1px solid var(--border)' }}>
          {([
            { key: 'dishes', label: 'Dishes', count: null },
            { key: 'review', label: 'Review', count: pending.length },
          ] as { key: Tab; label: string; count: number | null }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-6 py-4 text-base font-medium transition-colors flex items-center gap-2 border-b-2 -mb-px"
              style={tab === t.key
                ? { color: 'var(--ember)', borderColor: 'var(--ember)' }
                : { color: 'var(--ink-3)', borderColor: 'transparent' }
              }
            >
              {t.label}
              {t.count !== null && t.count > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--ember)', color: '#fff' }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'dishes' ? (
          <>
            {/* Row 1: Slot pills + Liked by + Search + Add Dish */}
            <div className="px-8 py-2 flex items-center gap-2 shrink-0 overflow-x-auto"
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
                  {s.charAt(0).toUpperCase() + s.slice(1)}
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
              <div className="ml-auto flex items-center gap-3 shrink-0">
                <div className="relative shrink-0">
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
                <span className="text-sm" style={{ color: 'var(--ink-4)' }}>
                  {filtered.length} dish{filtered.length !== 1 ? 'es' : ''}
                </span>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
                  style={{ height: 36, background: 'var(--ember)', color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--ember-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--ember)')}
                >
                  <Plus size={16} strokeWidth={2} /> Add Dish
                </button>
              </div>
            </div>

            {/* Row 2: Category pills */}
            {taxonomyCategories.length > 0 && (
              <div className="px-8 py-1.5 flex items-center gap-2 shrink-0 overflow-x-auto"
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
              <div className="px-8 py-1.5 flex items-center gap-2 shrink-0 overflow-x-auto"
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
                      prev.includes(t.value) ? prev.filter(v => v !== t.value) : [...prev, t.value]
                    )}
                    className="px-3 rounded-full text-sm font-medium shrink-0 transition-colors"
                    style={{
                      height: 36,
                      ...(selectedTags.includes(t.value)
                        ? { background: 'var(--ember)', color: '#fff' }
                        : { background: 'var(--parchment-5)', color: 'var(--ink-3)', border: '1px solid var(--border)' }),
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Dish list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <p style={{ color: 'var(--ink-4)' }}>Loading...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                  <p style={{ color: 'var(--ink-4)' }}>No dishes found</p>
                </div>
              ) : (
                <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {filtered.map(dish => {
                    const isAvailable = dish.available !== false
                    const ingredientPhotos = (dish.ingredients ?? []).map(i => i.photo_url).filter(Boolean) as string[]
                    return (
                      <div key={dish._id}
                        className="aspect-square rounded-2xl overflow-hidden flex flex-col"
                        style={{
                          background: 'var(--parchment-3)',
                          border: '1px solid var(--border)',
                          opacity: isAvailable ? 1 : 0.6,
                        }}
                      >
                        {/* Image — 62% of card height */}
                        <div className="relative shrink-0" style={{ height: '62%', background: 'var(--parchment-5)' }}>
                          {dish.image_url
                            ? <img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center">
                                <UtensilsCrossed size={28} strokeWidth={1.25} style={{ color: 'var(--ink-4)' }} />
                              </div>
                          }
                          {/* Ingredient sub-photos */}
                          {ingredientPhotos.length > 0 && (
                            <div className="absolute bottom-1.5 left-1.5 flex gap-1">
                              {ingredientPhotos.slice(0, 4).map((url, i) => (
                                <img key={i} src={url}
                                  className="w-7 h-7 rounded-md object-cover"
                                  style={{ border: '2px solid var(--parchment-3)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                              ))}
                            </div>
                          )}
                          {/* Favorites hearts row — top-right corner */}
                          <div className="absolute top-1.5 right-1.5 rounded-lg px-1 py-0.5 flex"
                            style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid var(--border)' }}>
                            <FavoriteHearts
                              dish={dish}
                              variant="row"
                              onUpdate={newFavs => setDishes(prev => prev.map(d => d._id === dish._id ? { ...d, favorites: newFavs } : d))}
                            />
                          </div>
                        </div>

                        {/* Info — remaining 38% */}
                        <div className="flex-1 min-h-0 px-2 pt-1.5 pb-2 flex flex-col overflow-hidden">
                          <div className="flex-1 min-h-0 overflow-hidden">
                            <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--ink)' }}>{dish.name}</p>
                            {dish.name_zh && (
                              <p className="text-xs leading-tight mt-0.5" style={{ color: 'var(--ink-3)' }}>{dish.name_zh}</p>
                            )}
                            {dish.critical_notes && (
                              <p className="text-xs leading-snug mt-1" style={{ color: '#ef4444' }}>{dish.critical_notes}</p>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="flex gap-1.5 shrink-0 mt-1">
                            <button
                              onClick={() => toggleAvailable(dish)}
                              className="flex-1 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-colors"
                              style={isAvailable
                                ? { background: 'var(--sage-bg)', color: 'var(--sage)', border: '1px solid rgba(74,124,111,0.2)', minHeight: 36 }
                                : { background: 'var(--parchment-5)', color: 'var(--ink-4)', border: '1px solid var(--border)', minHeight: 36 }
                              }
                            >
                              {isAvailable
                                ? <><CheckCircle2 size={12} strokeWidth={2} /> In stock</>
                                : <><XCircle size={12} strokeWidth={2} /> Out</>
                              }
                            </button>
                            <button
                              onClick={() => setEditingDish(dish)}
                              className="w-9 shrink-0 flex items-center justify-center rounded-lg transition-colors"
                              style={{ color: 'var(--ink-3)', background: 'var(--parchment-5)', border: '1px solid var(--border)', minHeight: 36 }}
                            >
                              <Pencil size={13} strokeWidth={1.75} />
                            </button>
                            <button
                              onClick={() => deleteDish(dish._id)}
                              className="w-9 shrink-0 flex items-center justify-center rounded-lg transition-colors"
                              style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', minHeight: 36 }}
                            >
                              <Trash2 size={13} strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* ── Review tab ─────────────────────────────────────────────── */
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <p style={{ color: 'var(--ink-4)' }}>Loading...</p>
              </div>
            ) : pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <Check size={32} strokeWidth={1.5} style={{ color: 'var(--sage)' }} />
                <p className="text-base" style={{ color: 'var(--ink-4)' }}>All caught up — no pending dishes</p>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl">
                <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                  {pending.length} dish{pending.length !== 1 ? 'es' : ''} suggested by your AI agent, waiting for review.
                </p>
                {pending.map(dish => {
                  const cats = ([] as string[]).concat(dish.category as unknown as string)
                  return (
                    <div key={dish._id}
                      className="rounded-2xl overflow-hidden flex gap-0"
                      style={{ background: 'var(--parchment-3)', border: '1px solid var(--border-strong)' }}
                    >
                      {/* Thumbnail */}
                      <div className="w-32 shrink-0" style={{ background: 'var(--parchment-5)' }}>
                        {dish.image_url
                          ? <img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center min-h-[120px]">
                              <UtensilsCrossed size={28} strokeWidth={1.25} style={{ color: 'var(--ink-4)' }} />
                            </div>
                        }
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-5 flex flex-col gap-3 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-base font-medium" style={{ color: 'var(--ink)' }}>{dish.name}</p>
                              {dish.name_zh && <p className="text-sm" style={{ color: 'var(--ink-3)' }}>{dish.name_zh}</p>}
                              <span className="text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1"
                                style={{ background: 'var(--ember-bg)', color: 'var(--ember)', border: '1px solid rgba(234,88,12,0.2)' }}>
                                <Bot size={11} strokeWidth={2} /> AI suggested
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {cats.map(cat => (
                                <span key={cat} className={`text-xs px-2 py-0.5 rounded-md font-medium capitalize ${getCategoryColor(cat)}`}>
                                  {cat.replace('-', ' ')}
                                </span>
                              ))}
                              {dish.tags?.map(tag => (
                                <span key={tag} className="text-xs px-2 py-0.5 rounded-md font-medium"
                                  style={{ background: 'var(--parchment-5)', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <p className="text-sm shrink-0" style={{ color: 'var(--ink-4)' }}>
                            {dish.who_for === 'both' ? 'Everyone' : dish.who_for === 'adult' ? 'Adults' : 'Child'}
                          </p>
                        </div>

                        {dish.recipe && (
                          <p className="text-sm line-clamp-2" style={{ color: 'var(--ink-3)' }}>
                            {dish.recipe}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 mt-auto pt-1">
                          <button
                            onClick={() => approveDish(dish)}
                            className="px-6 py-3 rounded-xl text-base font-medium transition-colors flex items-center gap-2"
                            style={{ background: 'var(--sage-bg)', color: 'var(--sage)', border: '1px solid rgba(74,124,111,0.25)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,124,111,0.18)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'var(--sage-bg)')}
                          >
                            <Check size={16} strokeWidth={2.5} /> Approve
                          </button>
                          <button
                            onClick={() => setEditingPending(dish)}
                            className="px-6 py-3 rounded-xl text-base font-medium transition-colors flex items-center gap-2"
                            style={{ background: 'var(--parchment-5)', color: 'var(--ink-2)', border: '1px solid var(--border-strong)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--parchment-4)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'var(--parchment-5)')}
                          >
                            <SquarePen size={16} strokeWidth={1.75} /> Edit & Approve
                          </button>
                          <button
                            onClick={() => rejectDish(dish._id)}
                            className="px-6 py-3 rounded-xl text-base font-medium transition-colors flex items-center gap-2"
                            style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.14)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                          >
                            <Trash2 size={16} strokeWidth={1.75} /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {showAddModal && (
        <AddDishModal
          onClose={() => setShowAddModal(false)}
          onCreated={dish => {
            setDishes(prev => [...prev, dish].sort((a, b) => a.name.localeCompare(b.name)))
            setShowAddModal(false)
          }}
        />
      )}
      {editingDish && (
        <AddDishModal
          existingDish={editingDish}
          onClose={() => setEditingDish(null)}
          onCreated={dish => {
            setDishes(prev => prev.map(d => d._id === dish._id ? dish : d))
            setEditingDish(null)
          }}
        />
      )}

      {editingPending && (
        <AddDishModal
          existingDish={editingPending}
          onClose={() => setEditingPending(null)}
          onCreated={async dish => {
            // Save is done — now approve (set active)
            await fetch(`/api/dishes/${dish._id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'active' }),
            })
            setPending(prev => prev.filter(d => d._id !== dish._id))
            setDishes(prev => [...prev, { ...dish, status: 'active' as const }].sort((a, b) => a.name.localeCompare(b.name)))
            setEditingPending(null)
          }}
        />
      )}
    </div>
  )
}
