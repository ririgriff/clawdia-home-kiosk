import { Suspense } from 'react'
import NavBar from '@/components/NavBar'
import MealPlanner from '@/components/MealPlanner'

export default function PlanPage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--parchment-2)' }}>
      <NavBar />
      <main className="flex-1 min-h-0 overflow-hidden">
        <Suspense>
          <MealPlanner />
        </Suspense>
      </main>
    </div>
  )
}
