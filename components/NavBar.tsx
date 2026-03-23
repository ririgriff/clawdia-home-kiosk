'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Utensils, CalendarRange, ShoppingCart, RotateCw, CheckSquare, BookMarked } from 'lucide-react'
import { APP_NAME, MASCOT_FACE } from '@/config/family'

const MEALS_ROUTES = ['/plan', '/meals', '/shopping']

const topNav = [
  { icon: Home,        label: 'Home',     href: '/',         enabled: true  },
  { icon: Utensils,    label: 'Meals',    href: '/plan',     enabled: true  },
  { icon: CalendarDays, label: 'Schedule', href: '/schedule', enabled: true  },
  { icon: CheckSquare,  label: 'To-Do',    href: '/todo',     enabled: true  },
  { icon: BookMarked,   label: 'Links',    href: '/links',    enabled: true  },
]

const mealsSubNav = [
  { icon: CalendarRange, label: 'Plan Meals',      href: '/plan',     enabled: true  },
  { icon: Utensils,      label: 'Manage Dishes',   href: '/meals',    enabled: true  },
  { icon: ShoppingCart,  label: 'Preparation',      href: '/shopping', enabled: true  },
]

interface Props { activePath?: string }

export default function NavBar({ activePath }: Props) {
  const pathname = usePathname()
  const active = activePath ?? pathname
  const inMeals = MEALS_ROUTES.some(r => active.startsWith(r))

  return (
    <div className="shrink-0">
      {/* Primary nav */}
      <nav style={{ background: 'var(--parchment-3)', borderBottom: '1px solid var(--border)' }}
        className="h-16 sm:h-20 flex items-center px-3 sm:px-8 gap-1 sm:gap-2">
        <Link href="/" className="hidden sm:flex items-center gap-2 mr-6">
          <Image src={MASCOT_FACE} alt={APP_NAME} width={36} height={36} />
          <span className="font-display text-xl font-medium" style={{ color: 'var(--ink)' }}>{APP_NAME}</span>
        </Link>
        <div className="flex gap-1 sm:gap-2">
          {topNav.map(m => {
            const isActive = m.href === '/'
              ? active === '/'
              : inMeals
                ? m.label === 'Meals'
                : m.href ? active.startsWith(m.href) : false
            const content = (
              <>
                <m.icon size={18} strokeWidth={1.75} />
                <span className="hidden sm:inline">{m.label}</span>
              </>
            )
            if (!m.enabled || !m.href) {
              return (
                <button key={m.label} disabled
                  style={{ color: 'var(--ink-4)' }}
                  className="px-3 sm:px-6 py-3 sm:py-4 rounded-xl text-base font-medium flex items-center gap-2.5 cursor-not-allowed">
                  {content}
                </button>
              )
            }
            return (
              <Link key={m.label} href={m.href}
                className="px-3 sm:px-6 py-3 sm:py-4 rounded-xl text-base font-medium transition-colors flex items-center gap-2.5"
                style={isActive ? { background: 'var(--ember-bg)', color: 'var(--ember)' } : { color: 'var(--ink-2)' }}>
                {content}
              </Link>
            )
          })}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => window.location.reload()}
            className="flex items-center justify-center rounded-xl transition-colors"
            style={{ minWidth: 44, minHeight: 44, color: 'var(--ink-4)' }}>
            <RotateCw size={18} strokeWidth={1.75} />
          </button>
          <Clock />
        </div>
      </nav>

      {/* Meals sub-nav */}
      {inMeals && (
        <div className="flex items-center gap-1 px-3 sm:px-8 py-2"
          style={{ background: 'var(--parchment-4)', borderBottom: '1px solid var(--border)' }}>
          {mealsSubNav.map(m => {
            const isActive = active === m.href
            const content = (
              <>
                <m.icon size={15} strokeWidth={1.75} />
                {m.label}
              </>
            )
            if (!m.enabled || !m.href) {
              return (
                <button key={m.label} disabled
                  style={{ color: 'var(--ink-4)' }}
                  className="px-3 sm:px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 cursor-not-allowed">
                  {content}
                </button>
              )
            }
            return (
              <Link key={m.label} href={m.href}
                className="px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                style={isActive ? { background: 'var(--ember)', color: '#fff' } : { color: 'var(--ink-3)' }}>
                {content}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="text-sm tabular-nums text-right" style={{ color: 'var(--ink-3)' }}>
      <span className="hidden sm:inline">
        {time.toLocaleDateString('en-HK', { weekday: 'short', month: 'short', day: 'numeric' })}
        {' · '}
      </span>
      {time.toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}
