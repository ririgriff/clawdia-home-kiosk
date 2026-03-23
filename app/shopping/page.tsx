import NavBar from '@/components/NavBar'
import ShoppingView from '@/components/ShoppingView'

export default function ShoppingPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible" style={{ background: 'var(--parchment-2)' }}>
      <div className="print:hidden">
        <NavBar />
      </div>
      <div className="flex-1 overflow-y-auto print:overflow-visible">
        <ShoppingView />
      </div>
    </div>
  )
}
