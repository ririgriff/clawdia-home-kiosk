'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Sparkles, Loader2, Plus, Trash2, Link, Check, ChevronDown, ChevronUp, Search, ExternalLink } from 'lucide-react'
import { IDish, Ingredient, MealSlot, MEAL_SLOTS } from '@/lib/types'
import { MEAL_MEMBERS } from '@/config/family'
import { updateCategoryColors } from '@/lib/categoryColors'

interface TaxonomyItem { _id: string; type: 'category' | 'tag'; value: string; label: string; color: string }

interface Props {
  existingDish?: IDish
  onClose: () => void
  onCreated: (dish: IDish) => void
}

const EMPTY_INGREDIENT: Ingredient = { name: '', quantity: '', unit: '', photo_url: '', critical_notes: '', purchase_link: '' }

function parseRating(snippet: string): { rating: string; count?: string } | null {
  const ratingMatch =
    snippet.match(/(\d(?:\.\d)?)\s*(?:\/\s*5|out of 5)/i) ||
    snippet.match(/(\d(?:\.\d)?)\s*★/) ||
    snippet.match(/★\s*(\d(?:\.\d)?)/) ||
    snippet.match(/(?:rated?|rating:?)\s+(\d(?:\.\d)?)/i) ||
    snippet.match(/(\d(?:\.\d)?)\s+stars?/i)
  if (!ratingMatch) return null
  const rating = ratingMatch[1]
  const countMatch = snippet.match(/([\d,]+)\s*(?:ratings?|reviews?|votes?)/i)
  return { rating, count: countMatch?.[1] }
}
const COMMON_UNITS = ['g', 'kg', 'ml', 'L', 'tsp', 'tbsp', 'cup', 'piece', 'clove', 'slice', 'bunch', '']

export default function AddDishModal({ existingDish, onClose, onCreated }: Props) {
  const isEdit = !!existingDish

  const [name, setName] = useState(existingDish?.name ?? '')
  const [nameZh, setNameZh] = useState(existingDish?.name_zh ?? '')
  const [categories, setCategories] = useState<string[]>(
    existingDish?.category
      ? ([] as string[]).concat(existingDish.category as unknown as string)
      : []
  )
  const [tags, setTags] = useState<string[]>(existingDish?.tags ?? [])
  const [typicallyServed, setTypicallyServed] = useState<MealSlot[]>(existingDish?.typically_served ?? [])
  const [notes, setNotes] = useState(existingDish?.notes ?? '')
  const [criticalNotes, setCriticalNotes] = useState(existingDish?.critical_notes ?? '')
  const [recipe, setRecipe] = useState(existingDish?.recipe ?? '')
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    existingDish?.ingredients?.length ? existingDish.ingredients : [{ ...EMPTY_INGREDIENT }]
  )
  const [referenceUrl, setReferenceUrl] = useState(existingDish?.reference_url ?? '')

  const [photoMode, setPhotoMode] = useState<'url' | 'upload'>('url')
  const [imageUrl, setImageUrl] = useState(existingDish?.image_url ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Taxonomy
  const [allCategories, setAllCategories] = useState<TaxonomyItem[]>([])
  const [allTags, setAllTags] = useState<TaxonomyItem[]>([])
  const [addingCategory, setAddingCategory] = useState(false)
  const [addingTag, setAddingTag] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [newTagLabel, setNewTagLabel] = useState('')

  const [expandedIngredients, setExpandedIngredients] = useState<Set<number>>(new Set())

  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<{ title: string; url: string; snippet: string; domain: string }[] | null>(null)
  const [proposedImageUrl, setProposedImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/taxonomy')
      .then(r => r.json())
      .then((items: TaxonomyItem[]) => {
        const cats = items.filter(i => i.type === 'category')
        const tags = items.filter(i => i.type === 'tag')
        setAllCategories(cats)
        setAllTags(tags)
        updateCategoryColors(cats)
      })
  }, [])

  // ── Ingredient helpers ──────────────────────────────────────────

  function updateIngredient(i: number, field: keyof Ingredient, value: string) {
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing))
  }
  function addIngredient() { setIngredients(prev => [...prev, { ...EMPTY_INGREDIENT }]) }
  function removeIngredient(i: number) {
    setIngredients(prev => prev.filter((_, idx) => idx !== i))
    setExpandedIngredients(prev => {
      const next = new Set<number>()
      prev.forEach(idx => { if (idx < i) next.add(idx); else if (idx > i) next.add(idx - 1) })
      return next
    })
  }
  function toggleIngredientExpanded(i: number) {
    setExpandedIngredients(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  async function handleParseIngredients() {
    if (!recipe.trim()) return
    setParsing(true)
    setError('')
    try {
      const res = await fetch('/api/parse-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe }),
      })
      if (!res.ok) throw new Error()
      const { ingredients: parsed } = await res.json()
      setIngredients(parsed.length > 0 ? parsed : [{ ...EMPTY_INGREDIENT }])
    } catch {
      setError('Could not parse ingredients. Check your recipe text and try again.')
    } finally {
      setParsing(false)
    }
  }

  async function handleFetchFromUrl(urlOverride?: string) {
    const url = (urlOverride ?? referenceUrl).trim()
    if (!url) return
    setFetching(true)
    setSearchResults(null)
    setError('')
    try {
      const res = await fetch('/api/fetch-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.name && !name && typeof data.name === 'string') setName(data.name)
      if (data.recipe && typeof data.recipe === 'string') setRecipe(data.recipe)
      if (data.image_url) {
        if (!imageUrl) setImageUrl(data.image_url)
        else setProposedImageUrl(data.image_url)
      }
      if (data.ingredients?.length) setIngredients(data.ingredients)
    } catch {
      setError('Could not fetch recipe from that URL. Try pasting the content manually.')
    } finally {
      setFetching(false)
    }
  }

  async function handleSearchByName(query: string) {
    if (!query.trim()) return
    setSearching(true)
    setSearchResults(null)
    setError('')
    try {
      const res = await fetch(`/api/search-recipes?q=${encodeURIComponent(query.trim())}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSearchResults(data.results ?? [])
    } catch {
      setError('Search failed. Try pasting a URL directly.')
    } finally {
      setSearching(false)
    }
  }

  async function handlePickResult(url: string) {
    setReferenceUrl(url)
    await handleFetchFromUrl(url)
  }

  // ── Photo helpers ───────────────────────────────────────────────

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function uploadImageFile(): Promise<string> {
    if (!imageFile) return ''
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', imageFile)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Photo upload failed')
      }
      const { url } = await res.json()
      return url
    } finally {
      setUploading(false)
    }
  }

  function toggleTag(tag: string) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  // ── Taxonomy helpers ────────────────────────────────────────────

  async function createCategory() {
    if (!newCategoryLabel.trim()) return
    const res = await fetch('/api/taxonomy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', label: newCategoryLabel.trim() }),
    })
    if (!res.ok) return
    const item: TaxonomyItem = await res.json()
    setAllCategories(prev => [...prev, item].sort((a, b) => a.label.localeCompare(b.label)))
    updateCategoryColors([item])
    setCategories(prev => [...prev, item.value])
    setNewCategoryLabel('')
    setAddingCategory(false)
  }

  async function createTag() {
    if (!newTagLabel.trim()) return
    const res = await fetch('/api/taxonomy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'tag', label: newTagLabel.trim() }),
    })
    if (!res.ok) return
    const item: TaxonomyItem = await res.json()
    setAllTags(prev => [...prev, item].sort((a, b) => a.label.localeCompare(b.label)))
    setTags(prev => [...prev, item.label])
    setNewTagLabel('')
    setAddingTag(false)
  }

  // ── Submit ──────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || categories.length === 0) {
      setError('Name and at least one category are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      let finalImageUrl = imageUrl
      if (photoMode === 'upload' && imageFile) {
        finalImageUrl = await uploadImageFile()
      }

      const body = {
        name: name.trim(),
        name_zh: nameZh.trim() || undefined,
        category: categories,
        tags,
        typically_served: typicallyServed,
        notes: notes.trim(),
        critical_notes: criticalNotes.trim() || undefined,
        recipe: recipe.trim(),
        ingredients: ingredients.filter(i => i.name.trim()),
        reference_url: referenceUrl.trim(),
        image_url: finalImageUrl,
        ...(!isEdit && { favorites: MEAL_MEMBERS.map(m => m.id) }),
      }

      const res = isEdit
        ? await fetch(`/api/dishes/${existingDish._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/dishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (!res.ok) throw new Error()
      onCreated(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const previewSrc = photoMode === 'url' ? imageUrl : imagePreview

  const inputStyle = {
    background: 'var(--parchment-5)',
    color: 'var(--ink)',
    border: '1px solid var(--border-strong)',
  }
  const inactiveBtnStyle = {
    background: 'var(--parchment-4)',
    color: 'var(--ink-3)',
    border: '1px solid var(--border)',
  }
  const activeBtnStyle = {
    background: 'var(--ember)',
    color: '#fff',
    border: '1px solid transparent',
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70" style={{ zIndex: 60 }} onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 rounded-t-2xl shadow-2xl overflow-y-auto"
        style={{ zIndex: 70, maxHeight: '92vh', background: 'var(--parchment-3)', borderTop: '1px solid var(--border-strong)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sticky top-0 z-10" style={{ background: 'var(--parchment-3)' }}>
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-dashed)' }} />
        </div>

        <div className="px-6 pb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-medium text-lg" style={{ color: 'var(--ink)' }}>
              {isEdit ? 'Edit Dish' : 'Add New Dish'}
            </h3>
            <button
              onClick={onClose}
              className="w-14 h-14 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--ink-3)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--parchment-5)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            ><X size={16} strokeWidth={1.75} /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Name ── */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-base block mb-2" style={{ color: 'var(--ink-3)' }}>Dish Name *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={e => { setName(e.target.value); setSearchResults(null) }}
                    placeholder="e.g. Braised pork belly"
                    className="flex-1 rounded-xl px-5 py-4 outline-none focus:ring-1 focus:ring-orange-400"
                    style={inputStyle}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSearchByName(name)}
                    disabled={!name.trim() || searching || fetching}
                    className="px-4 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    style={{ minHeight: 44, background: 'var(--ember-bg)', color: 'var(--ember)', border: '1px solid rgba(234,88,12,0.2)' }}
                    title="Search for recipes by dish name"
                  >
                    {searching
                      ? <Loader2 size={16} className="animate-spin" />
                      : <Search size={16} strokeWidth={1.75} />}
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-base block mb-2" style={{ color: 'var(--ink-3)' }}>Local name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nameZh}
                    onChange={e => { setNameZh(e.target.value); setSearchResults(null) }}
                    placeholder="e.g. 紅燒肉, すき焼き"
                    className="flex-1 rounded-xl px-5 py-4 outline-none focus:ring-1 focus:ring-orange-400"
                    style={inputStyle}
                    lang="zh"
                  />
                  <button
                    type="button"
                    onClick={() => handleSearchByName(nameZh)}
                    disabled={!nameZh.trim() || searching || fetching}
                    className="px-4 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    style={{ minHeight: 44, background: 'var(--ember-bg)', color: 'var(--ember)', border: '1px solid rgba(234,88,12,0.2)' }}
                    title="Search for recipes using local name"
                  >
                    {searching
                      ? <Loader2 size={16} className="animate-spin" />
                      : <Search size={16} strokeWidth={1.75} />}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Search results picker ── */}
            {searchResults !== null && (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--parchment-4)' }}>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--ink-3)' }}>
                    {searchResults.length > 0 ? `${searchResults.length} recipes found — tap one to fill the form` : 'No results found'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchResults(null)}
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 32, height: 32, color: 'var(--ink-4)' }}>
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
                {fetching && (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm" style={{ color: 'var(--ink-3)' }}>
                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--ember)' }} />
                    Fetching recipe…
                  </div>
                )}
                {!fetching && searchResults.map((r, i) => {
                  const rating = parseRating(r.snippet)
                  return (
                  <div
                    key={i}
                    className="flex items-stretch"
                    style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
                  >
                    <button
                      type="button"
                      onClick={() => handlePickResult(r.url)}
                      className="flex-1 text-left px-4 py-3 flex flex-col gap-0.5 transition-colors min-w-0"
                      style={{ minHeight: 44 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--parchment-5)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="text-sm font-medium leading-snug" style={{ color: 'var(--ink)' }}>{r.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--ember)' }}>{r.domain}</span>
                        {rating && (
                          <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                            ★ {rating.rating}{rating.count ? ` (${rating.count})` : ''}
                          </span>
                        )}
                      </div>
                      <span className="text-xs line-clamp-1" style={{ color: 'var(--ink-4)' }}>{r.snippet}</span>
                    </button>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center shrink-0 transition-colors"
                      style={{ width: 48, color: 'var(--ink-4)', borderLeft: '1px solid var(--border)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ember)'; (e.currentTarget as HTMLElement).style.background = 'var(--parchment-5)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-4)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      title="Open in new tab"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink size={14} strokeWidth={1.75} />
                    </a>
                  </div>
                  )
                })}
              </div>
            )}

            {/* ── Category ── */}
            <div>
              <label className="text-base block mb-2" style={{ color: 'var(--ink-3)' }}>Category *</label>
              <div className="flex flex-wrap gap-2">
                {allCategories.map(c => {
                  const active = categories.includes(c.value)
                  return (
                    <button key={c.value} type="button"
                      onClick={() => setCategories(prev =>
                        active ? prev.filter(v => v !== c.value) : [...prev, c.value]
                      )}
                      className="px-5 py-4 rounded-xl text-sm font-medium transition-colors"
                      style={active ? activeBtnStyle : inactiveBtnStyle}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      {c.label}
                    </button>
                  )
                })}
                {addingCategory ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCategoryLabel}
                      onChange={e => setNewCategoryLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createCategory() } if (e.key === 'Escape') { setAddingCategory(false); setNewCategoryLabel('') } }}
                      placeholder="Category name"
                      autoFocus
                      className="rounded-xl px-4 py-4 text-sm w-44 outline-none focus:ring-1 focus:ring-orange-400"
                      style={{ background: 'var(--parchment-5)', color: 'var(--ink)', border: '1px solid var(--ember)' }}
                    />
                    <button type="button" onClick={createCategory}
                      className="w-12 h-12 flex items-center justify-center rounded-xl transition-colors"
                      style={{ background: 'var(--ember)', color: '#fff' }}>
                      <Check size={16} strokeWidth={2} />
                    </button>
                    <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryLabel('') }}
                      className="w-12 h-12 flex items-center justify-center rounded-xl transition-colors"
                      style={inactiveBtnStyle}>
                      <X size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddingCategory(true)}
                    className="px-5 py-4 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5"
                    style={{ background: 'var(--parchment-4)', color: 'var(--ink-4)', border: '1px dashed var(--border-dashed)' }}>
                    <Plus size={14} strokeWidth={2} /> New
                  </button>
                )}
              </div>
            </div>

            {/* ── Typically served ── */}
            <div>
              <label className="text-base block mb-2" style={{ color: 'var(--ink-3)' }}>Typically served</label>
              <div className="flex gap-2">
                {MEAL_SLOTS.map(slot => {
                  const active = typicallyServed.includes(slot.value)
                  return (
                    <button key={slot.value} type="button"
                      onClick={() => setTypicallyServed(prev =>
                        active ? prev.filter(s => s !== slot.value) : [...prev, slot.value]
                      )}
                      className="px-5 py-4 rounded-xl text-sm font-medium transition-colors"
                      style={active ? activeBtnStyle : inactiveBtnStyle}
                    >
                      {slot.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Tags ── */}
            <div>
              <label className="text-base block mb-2" style={{ color: 'var(--ink-3)' }}>Tags</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(t => (
                  <button key={t.value} type="button" onClick={() => toggleTag(t.label)}
                    className="px-4 py-3 rounded-lg text-sm font-medium transition-colors"
                    style={tags.includes(t.label) ? activeBtnStyle : inactiveBtnStyle}
                  >
                    {t.label}
                  </button>
                ))}
                {addingTag ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newTagLabel}
                      onChange={e => setNewTagLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createTag() } if (e.key === 'Escape') { setAddingTag(false); setNewTagLabel('') } }}
                      placeholder="Tag name"
                      autoFocus
                      className="rounded-xl px-4 py-3 text-sm w-36 outline-none focus:ring-1 focus:ring-orange-400"
                      style={{ background: 'var(--parchment-5)', color: 'var(--ink)', border: '1px solid var(--ember)' }}
                    />
                    <button type="button" onClick={createTag}
                      className="w-12 h-12 flex items-center justify-center rounded-xl transition-colors"
                      style={{ background: 'var(--ember)', color: '#fff' }}>
                      <Check size={16} strokeWidth={2} />
                    </button>
                    <button type="button" onClick={() => { setAddingTag(false); setNewTagLabel('') }}
                      className="w-12 h-12 flex items-center justify-center rounded-xl transition-colors"
                      style={inactiveBtnStyle}>
                      <X size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddingTag(true)}
                    className="px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                    style={{ background: 'var(--parchment-4)', color: 'var(--ink-4)', border: '1px dashed var(--border-dashed)' }}>
                    <Plus size={14} strokeWidth={2} /> New
                  </button>
                )}
              </div>
            </div>

            {/* ── Photo ── */}
            <div>
              <label className="text-base block mb-2" style={{ color: 'var(--ink-3)' }}>Photo</label>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => setPhotoMode('url')}
                  className="px-5 py-4 rounded-xl text-sm font-medium transition-colors"
                  style={photoMode === 'url' ? activeBtnStyle : inactiveBtnStyle}>
                  Paste URL
                </button>
                <button type="button" onClick={() => setPhotoMode('upload')}
                  className="px-5 py-4 rounded-xl text-sm font-medium transition-colors"
                  style={photoMode === 'upload' ? activeBtnStyle : inactiveBtnStyle}>
                  Upload File
                </button>
              </div>

              {photoMode === 'url' ? (
                <input
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl px-5 py-4 outline-none focus:ring-1 focus:ring-orange-400"
                  style={inputStyle}
                />
              ) : (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-xl py-4 text-sm transition-colors"
                    style={{ background: 'var(--parchment-4)', color: 'var(--ink-3)', border: '2px dashed var(--border-dashed)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ink-4)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-dashed)')}
                  >
                    {imageFile ? imageFile.name : 'Tap to choose a photo'}
                  </button>
                </div>
              )}

              {previewSrc && !proposedImageUrl && (
                <div className="mt-3 relative w-32 h-32">
                  <img src={previewSrc} alt="Preview" className="w-32 h-32 object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => { setImageUrl(''); setImageFile(null); setImagePreview('') }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs flex items-center justify-center transition-colors"
                    style={{ background: 'var(--parchment-5)', color: 'var(--ink-2)', border: '1px solid var(--border-strong)' }}
                  >×</button>
                </div>
              )}

              {/* Image conflict picker — shown when a fetch returns a new image but one already exists */}
              {proposedImageUrl && (
                <div className="mt-3 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <p className="px-4 py-2 text-sm" style={{ background: 'var(--parchment-4)', color: 'var(--ink-3)', borderBottom: '1px solid var(--border)' }}>
                    A new image was found — keep your current one or switch?
                  </p>
                  <div className="flex divide-x" style={{ borderColor: 'var(--border)' }}>
                    {/* Current */}
                    <div className="flex-1 flex flex-col items-center gap-2 p-3">
                      <img src={previewSrc} alt="Current" className="w-24 h-24 object-cover rounded-xl" />
                      <button
                        type="button"
                        onClick={() => setProposedImageUrl('')}
                        className="w-full py-2 rounded-xl text-sm font-medium"
                        style={{ background: 'var(--ember)', color: '#fff' }}>
                        Keep current
                      </button>
                    </div>
                    {/* Proposed */}
                    <div className="flex-1 flex flex-col items-center gap-2 p-3">
                      <img src={proposedImageUrl} alt="New" className="w-24 h-24 object-cover rounded-xl" />
                      <button
                        type="button"
                        onClick={() => { setImageUrl(proposedImageUrl); setImageFile(null); setImagePreview(''); setProposedImageUrl('') }}
                        className="w-full py-2 rounded-xl text-sm font-medium"
                        style={{ background: 'var(--parchment-5)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
                        Use new
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Reference URL ── */}
            <div>
              <label className="text-base block mb-2" style={{ color: 'var(--ink-3)' }}>Reference Link</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={referenceUrl}
                  onChange={e => setReferenceUrl(e.target.value)}
                  placeholder="YouTube video or recipe source URL"
                  className="flex-1 rounded-xl px-5 py-4 outline-none focus:ring-1 focus:ring-orange-400"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => handleFetchFromUrl()}
                  disabled={!referenceUrl.trim() || fetching}
                  className="px-4 py-3 text-sm rounded-xl font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'var(--ember-bg)', color: 'var(--ember)', border: '1px solid rgba(234,88,12,0.2)' }}
                  onMouseEnter={e => { if (referenceUrl.trim() && !fetching) e.currentTarget.style.background = 'rgba(234,88,12,0.18)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--ember-bg)' }}
                >
                  {fetching
                    ? <><Loader2 size={14} className="animate-spin" /> Fetching...</>
                    : <><Link size={14} strokeWidth={1.75} /> Fetch</>}
                </button>
                {referenceUrl && (
                  <a
                    href={referenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 rounded-xl text-sm transition-colors"
                    style={{ background: 'var(--parchment-4)', color: 'var(--ink-3)', border: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
                  >Open ↗</a>
                )}
              </div>
            </div>

            {/* ── Recipe ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-base" style={{ color: 'var(--ink-3)' }}>Recipe / Method</label>
                <button
                  type="button"
                  onClick={handleParseIngredients}
                  disabled={!recipe.trim() || parsing}
                  className="text-sm px-4 py-3 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'var(--ember-bg)', color: 'var(--ember)', border: '1px solid rgba(234,88,12,0.2)' }}
                  onMouseEnter={e => { if (recipe.trim() && !parsing) e.currentTarget.style.background = 'rgba(234,88,12,0.18)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--ember-bg)' }}
                >
                  {parsing
                    ? <><Loader2 size={15} className="animate-spin" /> Parsing...</>
                    : <><Sparkles size={15} /> Parse Ingredients</>}
                </button>
              </div>
              <textarea
                value={recipe}
                onChange={e => setRecipe(e.target.value)}
                placeholder="Paste or type the recipe method here. Use 'Parse Ingredients' to auto-fill the ingredient list."
                rows={5}
                className="w-full rounded-xl px-5 py-4 outline-none focus:ring-1 focus:ring-orange-400 resize-none text-sm"
                style={inputStyle}
              />
            </div>

            {/* ── Ingredients ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-base" style={{ color: 'var(--ink-3)' }}>Ingredients</label>
                <button
                  type="button"
                  onClick={addIngredient}
                  className="text-sm px-4 py-3 rounded-lg transition-colors flex items-center gap-1"
                  style={inactiveBtnStyle}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <Plus size={14} strokeWidth={2} /> Add row
                </button>
              </div>
              <div className="space-y-2">
                {ingredients.map((ing, i) => {
                  const isExpanded = expandedIngredients.has(i)
                  const hasDetails = !!(ing.photo_url || ing.critical_notes || ing.purchase_link)
                  return (
                    <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                      {/* Main row */}
                      <div className="flex gap-2 items-center p-2">
                        <input
                          type="text"
                          value={ing.name}
                          onChange={e => updateIngredient(i, 'name', e.target.value)}
                          placeholder="Ingredient"
                          className="flex-1 rounded-lg px-4 py-4 text-sm outline-none focus:ring-1 focus:ring-orange-400 min-w-0"
                          style={inputStyle}
                        />
                        <input
                          type="text"
                          value={ing.quantity}
                          onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                          placeholder="Qty"
                          className="w-20 rounded-lg px-4 py-4 text-sm outline-none focus:ring-1 focus:ring-orange-400"
                          style={inputStyle}
                        />
                        <select
                          value={ing.unit}
                          onChange={e => updateIngredient(i, 'unit', e.target.value)}
                          className="w-24 rounded-lg px-2 py-4 text-sm outline-none cursor-pointer"
                          style={inputStyle}
                        >
                          {COMMON_UNITS.map(u => (
                            <option key={u} value={u}>{u || '—'}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => toggleIngredientExpanded(i)}
                          className="w-12 h-12 flex items-center justify-center flex-shrink-0 rounded-lg transition-colors"
                          style={isExpanded || hasDetails
                            ? { color: 'var(--ember)', background: 'var(--ember-bg)' }
                            : { color: 'var(--ink-4)', background: 'transparent' }}
                          title="Brand / source details"
                        >
                          {isExpanded ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeIngredient(i)}
                          disabled={ingredients.length === 1}
                          className="w-12 h-12 disabled:opacity-20 transition-colors flex items-center justify-center flex-shrink-0"
                          style={{ color: 'var(--ink-4)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-4)')}
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </button>
                      </div>

                      {/* Expandable details — brand/source specific */}
                      {isExpanded && (
                        <div className="px-3 pb-3 flex flex-col gap-2 border-t" style={{ borderColor: 'var(--border)', background: 'var(--parchment-2)' }}>
                          <p className="text-xs pt-2" style={{ color: 'var(--ink-4)' }}>Brand / source details (optional)</p>
                          <input
                            type="url"
                            value={ing.photo_url ?? ''}
                            onChange={e => updateIngredient(i, 'photo_url', e.target.value)}
                            placeholder="Photo URL"
                            className="w-full rounded-lg px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-orange-400"
                            style={inputStyle}
                          />
                          <input
                            type="text"
                            value={ing.critical_notes ?? ''}
                            onChange={e => updateIngredient(i, 'critical_notes', e.target.value)}
                            placeholder="Critical notes (e.g. must use XX brand)"
                            className="w-full rounded-lg px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-orange-400"
                            style={{ ...inputStyle, color: ing.critical_notes ? '#ef4444' : 'var(--ink)' }}
                          />
                          <input
                            type="url"
                            value={ing.purchase_link ?? ''}
                            onChange={e => updateIngredient(i, 'purchase_link', e.target.value)}
                            placeholder="Purchase link"
                            className="w-full rounded-lg px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-orange-400"
                            style={inputStyle}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Notes ── */}
            <div>
              <label className="text-base block mb-2" style={{ color: 'var(--ink-3)' }}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                className="w-full rounded-xl px-5 py-4 outline-none focus:ring-1 focus:ring-orange-400 resize-none"
                style={inputStyle}
              />
            </div>

            {/* ── Critical Notes ── */}
            <div>
              <label className="text-base block mb-2" style={{ color: '#ef4444' }}>Critical Notes</label>
              <textarea
                value={criticalNotes}
                onChange={e => setCriticalNotes(e.target.value)}
                placeholder="Allergy warnings, must-follow instructions, key substitutions..."
                rows={2}
                className="w-full rounded-xl px-5 py-4 outline-none focus:ring-1 focus:ring-red-400 resize-none"
                style={{ ...inputStyle, color: criticalNotes ? '#ef4444' : 'var(--ink)', borderColor: criticalNotes ? 'rgba(239,68,68,0.4)' : undefined }}
              />
            </div>

            {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

            {/* ── Buttons ── */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-5 rounded-xl font-medium transition-colors"
                style={inactiveBtnStyle}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >Cancel</button>
              <button type="submit" disabled={loading || uploading}
                className="flex-1 py-5 rounded-xl font-medium transition-colors disabled:opacity-50"
                style={activeBtnStyle}
                onMouseEnter={e => { if (!loading && !uploading) e.currentTarget.style.background = 'var(--ember-2)' }}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--ember)')}
              >
                {loading || uploading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Dish'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  )
}
