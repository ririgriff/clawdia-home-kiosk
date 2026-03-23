'use client'

import { useState, useEffect } from 'react'
import { Bus, Car, Check, ExternalLink } from 'lucide-react'
import { type HomeMethod, FALLBACK_HOME_DEFAULTS } from '@/lib/home-method'
import { SCHOOL_CHILD, SCHOOL_NAME, SCHOOL_PORTAL_URL, getMemberName } from '@/config/family'

const DAYS: { label: string; dow: number }[] = [
  { label: 'Monday',    dow: 1 },
  { label: 'Tuesday',   dow: 2 },
  { label: 'Wednesday', dow: 3 },
  { label: 'Thursday',  dow: 4 },
  { label: 'Friday',    dow: 5 },
]

const METHODS: { value: HomeMethod; label: string; sub: string }[] = [
  { value: 'bus-3pm', label: 'Bus 3pm', sub: 'School bus, 3 pm departure' },
  { value: 'bus-4pm', label: 'Bus 4pm', sub: 'School bus, 4 pm departure' },
  { value: 'pickup',  label: 'Pickup',  sub: 'Adult collection required'  },
]

const METHOD_STYLE: Record<HomeMethod, { active: string; icon: typeof Bus }> = {
  'bus-3pm': { active: 'rgba(13,148,136,1)',  icon: Bus },
  'bus-4pm': { active: 'rgba(37,99,235,1)',   icon: Bus },
  'pickup':  { active: 'rgba(234,88,12,1)',   icon: Car },
}

export default function GoHomeSettings() {
  const [defaults, setDefaults] = useState<Record<number, HomeMethod>>({ ...FALLBACK_HOME_DEFAULTS })
  const [saved,    setSaved]    = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    fetch('/api/settings/go-home')
      .then(r => r.json())
      .then((data: Record<string, HomeMethod>) => {
        // API returns string keys; convert to number keys
        const parsed: Record<number, HomeMethod> = {}
        for (const [k, v] of Object.entries(data)) parsed[Number(k)] = v
        setDefaults(parsed)
        setLoading(false)
      })
  }, [])

  function set(dow: number, method: HomeMethod) {
    setDefaults(prev => ({ ...prev, [dow]: method }))
    setSaved(false)
  }

  async function save() {
    await fetch('/api/settings/go-home', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(defaults),
    })
    setSaved(true)
  }

  if (loading) {
    return (
      <div className="text-sm" style={{ color: 'var(--ink-4)' }}>Loading…</div>
    )
  }

  return (
    <div className="max-w-xl flex flex-col gap-8">
      <div>
        <h1 className="font-display font-medium text-2xl mb-1" style={{ color: 'var(--ink)' }}>
          GoHome defaults
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          Default home method per weekday. The dashboard overrides this automatically
          when {getMemberName(SCHOOL_CHILD)} has a class or activity that changes the timing.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {DAYS.map(({ label, dow }) => {
          const current = defaults[dow] ?? 'bus-3pm'
          return (
            <div key={dow} className="flex flex-col gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>{label}</span>
              <div className="flex gap-2 flex-wrap">
                {METHODS.map(m => {
                  const isActive = current === m.value
                  const style    = METHOD_STYLE[m.value]
                  const Icon     = style.icon
                  return (
                    <button key={m.value}
                      onClick={() => set(dow, m.value)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={isActive
                        ? { background: style.active, color: '#fff',               border: `1px solid ${style.active}` }
                        : { background: 'var(--parchment-3)', color: 'var(--ink-3)', border: '1px solid var(--border)' }
                      }>
                      <Icon size={14} strokeWidth={2} />
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium"
          style={{ background: 'var(--ember)', color: '#fff' }}>
          {saved ? <Check size={15} strokeWidth={2.5} /> : null}
          {saved ? 'Saved' : 'Save changes'}
        </button>
      </div>

      {/* School portal link */}
      <div className="rounded-2xl p-4 flex flex-col gap-2"
        style={{ background: 'var(--parchment-3)', border: '1px solid var(--border)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
          Change {getMemberName(SCHOOL_CHILD)}&apos;s transport on the {SCHOOL_NAME} portal
        </p>
        <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
          Use the school&apos;s GoHome system to notify {SCHOOL_NAME} of any changes to bus or pickup on specific days.
        </p>
        <a href={SCHOOL_PORTAL_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium mt-1"
          style={{ color: 'var(--ember)' }}>
          Open {SCHOOL_NAME} Parent Portal
          <ExternalLink size={12} strokeWidth={2} />
        </a>
      </div>
    </div>
  )
}
