'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { IDish } from '@/lib/types'

export default function DishPrintPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [dish, setDish] = useState<IDish | null>(null)

  useEffect(() => {
    fetch(`/api/dishes/${id}`)
      .then(r => r.json())
      .then(setDish)
  }, [id])

  if (!dish) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm" style={{ color: '#888' }}>
        Loading…
      </div>
    )
  }

  return (
    <>
      {/* Back + Print buttons — hidden when printing */}
      <div className="print:hidden fixed top-4 left-4 z-10">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-5 rounded-xl text-sm font-medium"
          style={{ height: 48, background: 'var(--parchment-3, #f5f0e8)', color: 'var(--ink, #111)', border: '1px solid var(--border, #ddd)' }}
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
          Back
        </button>
      </div>
      <div className="print:hidden fixed top-4 right-4 z-10">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 rounded-xl text-sm font-medium"
          style={{ height: 48, background: '#111', color: '#fff' }}
        >
          <Printer size={16} strokeWidth={1.75} />
          Print
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-12 print:px-6 print:py-8">

        {/* Title */}
        <div className="flex items-start gap-4 mb-8">
          {dish.image_url && (
            <img src={dish.image_url} alt={dish.name}
              className="rounded-xl object-cover shrink-0 print:hidden"
              style={{ width: 80, height: 80 }} />
          )}
          <div>
            <h1 className="text-3xl font-bold leading-tight" style={{ color: '#111' }}>
              {dish.name}
            </h1>
            {dish.name_zh && (
              <p className="text-lg mt-1" style={{ color: '#666' }}>{dish.name_zh}</p>
            )}
          </div>
        </div>

        {/* Critical notes */}
        {dish.critical_notes && (
          <div className="mb-6 px-4 py-3 rounded-xl border-l-4" style={{ borderColor: '#ef4444', background: '#fef2f2' }}>
            <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>⚠ {dish.critical_notes}</p>
          </div>
        )}

        {/* Ingredients */}
        {dish.ingredients && dish.ingredients.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#999' }}>
              Ingredients
            </h2>
            <ul className="flex flex-col gap-2">
              {dish.ingredients.map((ing, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm" style={{ color: '#222' }}>
                  <span className="shrink-0" style={{ color: '#bbb' }}>·</span>
                  {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ')}
                  {ing.critical_notes && (
                    <span className="text-xs ml-1" style={{ color: '#ef4444' }}>{ing.critical_notes}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recipe */}
        {dish.recipe && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#999' }}>
              Recipe
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#333' }}>
              {dish.recipe}
            </p>
          </section>
        )}

        {/* Notes */}
        {dish.notes && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#999' }}>
              Notes
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#555' }}>{dish.notes}</p>
          </section>
        )}

        {/* Reference URL + QR code */}
        {dish.reference_url && (
          <div className="flex items-start gap-4 mt-8 pt-4 border-t" style={{ borderColor: '#eee' }}>
            <QRCodeSVG value={dish.reference_url} size={80} />
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: '#999' }}>Scan for original recipe</p>
              <p className="text-xs break-all" style={{ color: '#aaa' }}>{dish.reference_url}</p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
