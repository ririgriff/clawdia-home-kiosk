import NavBar from '@/components/NavBar'
import TodoList from '@/components/TodoList'

export default function TodoPage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--parchment-2)' }}>
      <NavBar />
      <main className="flex-1 min-h-0 overflow-hidden">
        <TodoList />
      </main>
    </div>
  )
}
