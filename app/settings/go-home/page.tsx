import { notFound } from 'next/navigation'
import NavBar from '@/components/NavBar'
import GoHomeSettings from '@/components/GoHomeSettings'
import { ENABLE_GO_HOME } from '@/config/family'

export default function GoHomeSettingsPage() {
  if (!ENABLE_GO_HOME) notFound()
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--parchment-2)' }}>
      <NavBar />
      <main className="flex-1 overflow-auto p-6 sm:p-10">
        <GoHomeSettings />
      </main>
    </div>
  )
}
