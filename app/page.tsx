import NavBar from '@/components/NavBar'
import HomeLayout from '@/components/HomeLayout'

export default function Home() {
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--parchment-2)' }}>
      <NavBar />
      <HomeLayout />
    </div>
  )
}
