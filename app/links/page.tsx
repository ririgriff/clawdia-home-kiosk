'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ExternalLink, X, Check } from 'lucide-react'
import NavBar from '@/components/NavBar'
import { ILink, LinkCategory, LINK_CATEGORIES } from '@/lib/types'

export default function LinksPage() {
  const [links, setLinks] = useState<ILink[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'add'; defaultCategory?: LinkCategory } | { mode: 'edit'; link: ILink } | null>(null)

  useEffect(() => {
    fetch('/api/links').then(r => r.json()).then(data => {
      setLinks(data)
      setLoading(false)
    })
  }, [])

  async function deleteLink(id: string) {
    setLinks(prev => prev.filter(l => l._id !== id))
    await fetch(`/api/links/${id}`, { method: 'DELETE' })
  }

  function handleSaved(link: ILink) {
    setLinks(prev => {
      const exists = prev.some(l => l._id === link._id)
      return exists
        ? prev.map(l => l._id === link._id ? link : l)
        : [...prev, link]
    })
    setModal(null)
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--parchment-2)' }}>
      <NavBar activePath="/links" />

      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <p style={{ color: 'var(--ink-4)' }}>Loading...</p>
          </div>
        ) : (
          <div className="px-8 py-6 flex flex-col gap-8 max-w-4xl">
            {LINK_CATEGORIES.map(cat => {
              const catLinks = links.filter(l => l.category === cat.value)
              return (
                <section key={cat.value}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display font-medium text-lg" style={{ color: 'var(--ink)' }}>
                      {cat.label}
                    </h2>
                    <button
                      onClick={() => setModal({ mode: 'add', defaultCategory: cat.value })}
                      className="flex items-center gap-1.5 px-4 rounded-xl text-sm font-medium transition-colors"
                      style={{ minHeight: 44, color: 'var(--ink-3)', border: '1px solid var(--border)' }}
                    >
                      <Plus size={14} strokeWidth={2} /> Add
                    </button>
                  </div>

                  {catLinks.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No links yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {catLinks.map(link => (
                        <LinkCard
                          key={link._id}
                          link={link}
                          onEdit={() => setModal({ mode: 'edit', link })}
                          onDelete={() => deleteLink(link._id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </main>

      {modal && (
        <LinkModal
          mode={modal.mode}
          link={modal.mode === 'edit' ? modal.link : undefined}
          defaultCategory={modal.mode === 'add' ? modal.defaultCategory : undefined}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function LinkCard({ link, onEdit, onDelete }: { link: ILink; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-stretch gap-0 rounded-2xl overflow-hidden"
      style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)' }}>

      {/* Main tap target — opens URL */}
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex items-center gap-4 px-5 py-4 transition-colors active:opacity-70"
        style={{ minHeight: 72, textDecoration: 'none' }}
      >
        <ExternalLink size={20} strokeWidth={1.75} className="shrink-0" style={{ color: 'var(--ember)' }} />
        <div className="min-w-0">
          <p className="text-base font-medium leading-snug" style={{ color: 'var(--ink)' }}>{link.title}</p>
          {link.notes && (
            <p className="text-sm mt-0.5 leading-snug" style={{ color: 'var(--ink-3)' }}>{link.notes}</p>
          )}
        </div>
      </a>

      {/* Actions */}
      <div className="flex items-stretch shrink-0" style={{ borderLeft: '1px solid var(--border)' }}>
        <button
          onClick={onEdit}
          className="flex items-center justify-center transition-colors"
          style={{ minWidth: 56, color: 'var(--ink-3)' }}
        >
          <Pencil size={16} strokeWidth={1.75} />
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center transition-colors"
          style={{ minWidth: 56, color: '#ef4444', borderLeft: '1px solid var(--border)' }}
        >
          <Trash2 size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}

interface ModalProps {
  mode: 'add' | 'edit'
  link?: ILink
  defaultCategory?: LinkCategory
  onClose: () => void
  onSaved: (link: ILink) => void
}

function LinkModal({ mode, link, defaultCategory, onClose, onSaved }: ModalProps) {
  const [category, setCategory] = useState<LinkCategory>(link?.category ?? defaultCategory ?? 'other')
  const [title, setTitle] = useState(link?.title ?? '')
  const [url, setUrl] = useState(link?.url ?? '')
  const [notes, setNotes] = useState(link?.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!title.trim() || !url.trim()) return
    setSaving(true)
    const body = { category, title: title.trim(), url: url.trim(), notes: notes.trim() }
    const res = mode === 'edit' && link
      ? await fetch(`/api/links/${link._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) onSaved(await res.json())
    setSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '85vh', background: 'var(--parchment-3)', borderTop: '1px solid var(--border-strong)' }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-dashed)' }} />
        </div>

        {/* Header */}
        <div className="px-6 py-3 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-display font-medium" style={{ color: 'var(--ink)' }}>
            {mode === 'add' ? 'Add Link' : 'Edit Link'}
          </h3>
          <button onClick={onClose}
            className="flex items-center justify-center rounded-xl"
            style={{ minWidth: 44, minHeight: 44, color: 'var(--ink-3)' }}>
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Category */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--ink-2)' }}>Category</label>
            <div className="flex gap-2 flex-wrap">
              {LINK_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className="px-4 rounded-xl text-sm font-medium transition-colors"
                  style={{
                    minHeight: 44,
                    ...(category === cat.value
                      ? { background: 'var(--ember)', color: '#fff' }
                      : { background: 'var(--parchment-5)', color: 'var(--ink-3)', border: '1px solid var(--border)' }),
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--ink-2)' }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. YMCA Booking"
              className="w-full px-4 rounded-xl text-base outline-none"
              style={{ minHeight: 48, background: 'var(--parchment-5)', color: 'var(--ink)', border: '1px solid var(--border-strong)' }}
            />
          </div>

          {/* URL */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--ink-2)' }}>URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 rounded-xl text-base outline-none"
              style={{ minHeight: 48, background: 'var(--parchment-5)', color: 'var(--ink)', border: '1px solid var(--border-strong)' }}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--ink-2)' }}>Notes <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What's this link for?"
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-base outline-none resize-none"
              style={{ background: 'var(--parchment-5)', color: 'var(--ink)', border: '1px solid var(--border-strong)' }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !url.trim() || saving}
            className="w-full rounded-xl text-base font-medium transition-colors flex items-center justify-center gap-2"
            style={{
              minHeight: 52,
              background: title.trim() && url.trim() ? 'var(--ember)' : 'var(--parchment-5)',
              color: title.trim() && url.trim() ? '#fff' : 'var(--ink-4)',
            }}
          >
            <Check size={18} strokeWidth={2.5} />
            {mode === 'add' ? 'Add Link' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}
