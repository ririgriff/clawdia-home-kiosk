import { Suspense } from 'react'
import NavBar from '@/components/NavBar'
import ScheduleView from '@/components/Schedule'

export default function SchedulePage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--parchment-2)' }}>
      <NavBar />
      <main className="flex-1 min-h-0 overflow-hidden">
        <Suspense>
          <ScheduleView />
        </Suspense>
      </main>
    </div>
  )
}
