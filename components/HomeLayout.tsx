'use client'

import { useState, useEffect } from 'react'
import MealSummary from '@/components/MealSummary'
import ScheduleSummary from '@/components/ScheduleSummary'
import RemindersPanel from '@/components/RemindersPanel'

export default function HomeLayout() {
  const [isPortrait, setIsPortrait] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)

    const mq = window.matchMedia('(orientation: portrait)')
    setIsPortrait(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches)
    mq.addEventListener('change', handler)

    return () => {
      window.removeEventListener('resize', checkMobile)
      mq.removeEventListener('change', handler)
    }
  }, [])

  if (isMobile) {
    return (
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--parchment-2)' }}>
        <RemindersPanel compact />
        <ScheduleSummary compact />
        <MealSummary compact />
      </main>
    )
  }

  if (isPortrait) {
    return (
      <main className="flex-1 min-h-0 overflow-hidden flex">
        {/* Left: Meals stacked above Schedule */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden" style={{ borderBottom: '1px solid var(--border)' }}>
            <MealSummary />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScheduleSummary />
          </div>
        </div>
        {/* Right: Reminders — full height column */}
        <div className="shrink-0 overflow-hidden" style={{ width: 320, borderLeft: '1px solid var(--border)' }}>
          <RemindersPanel />
        </div>
      </main>
    )
  }

  // Landscape: 5/12 meals | 4/12 schedule | 3/12 reminders
  return (
    <main className="flex-1 min-h-0 overflow-hidden flex">
      <div className="w-5/12 overflow-hidden" style={{ borderRight: '1px solid var(--border)' }}>
        <MealSummary />
      </div>
      <div className="w-4/12 overflow-hidden" style={{ borderRight: '1px solid var(--border)' }}>
        <ScheduleSummary />
      </div>
      <div className="w-3/12 overflow-hidden">
        <RemindersPanel />
      </div>
    </main>
  )
}
