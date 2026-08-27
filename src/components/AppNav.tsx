import { Brain, BookOpen, Clapperboard, GraduationCap, LibraryBig, Settings2 } from 'lucide-react'
import type { ReactNode } from 'react'

import type { DashboardData } from '../server/curriculum'

export type AppView = 'review' | 'lessons' | 'reading' | 'library' | 'palace'

const navigation: Array<{ id: AppView; label: string; icon: ReactNode }> = [
  { id: 'review', label: 'Review', icon: <Brain size={19} /> },
  { id: 'lessons', label: 'Lessons', icon: <GraduationCap size={19} /> },
  { id: 'reading', label: 'Read', icon: <BookOpen size={19} /> },
  { id: 'library', label: 'Library', icon: <LibraryBig size={19} /> },
  { id: 'palace', label: 'Palace', icon: <Clapperboard size={19} /> },
]

export function AppHeader({
  data,
  onOpenSettings,
  onViewChange,
  view,
}: {
  data: DashboardData
  onOpenSettings: () => void
  onViewChange: (view: AppView) => void
  view: AppView
}) {
  const dueCount = data.codebookQueue.length + data.reviewQueue.length

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-2 px-4">
        <button
          aria-label="Fluenc home"
          className="flex items-center gap-2 border-0 bg-transparent p-0"
          type="button"
          onClick={() => onViewChange('lessons')}
        >
          <span className="font-hanzi text-xl leading-none">弗</span>
          <strong className="text-[15px] font-semibold tracking-tight">fluenc</strong>
        </button>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
          {navigation.map((item) => (
            <button
              aria-label={item.label}
              aria-current={view === item.id ? 'page' : undefined}
              className={`relative inline-flex h-9 items-center gap-1.5 rounded-lg border-0 px-3 text-xs font-semibold ${
                view === item.id ? 'bg-ink text-white' : 'bg-transparent text-muted hover:bg-black/5 hover:text-ink'
              }`}
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
            >
              {item.icon}
              {item.label}
              {item.id === 'review' && dueCount ? <Badge count={dueCount} active={view === item.id} /> : null}
            </button>
          ))}
        </nav>

        <button
          aria-label="Settings"
          className="ml-auto grid size-9 place-items-center rounded-lg border-0 bg-transparent text-muted hover:bg-black/5 hover:text-ink md:ml-1"
          type="button"
          onClick={onOpenSettings}
        >
          <Settings2 size={18} />
        </button>
      </div>
    </header>
  )
}

export function AppTabBar({
  data,
  onViewChange,
  view,
}: {
  data: DashboardData
  onViewChange: (view: AppView) => void
  view: AppView
}) {
  const dueCount = data.codebookQueue.length + data.reviewQueue.length

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 pb-[max(env(safe-area-inset-bottom),6px)] backdrop-blur-md md:hidden"
    >
      <div className="mx-auto flex w-full max-w-2xl">
        {navigation.map((item) => (
          <button
            aria-current={view === item.id ? 'page' : undefined}
            aria-label={item.label}
            className={`relative flex flex-1 flex-col items-center gap-0.5 border-0 bg-transparent py-2 text-[10px] font-semibold ${
              view === item.id ? 'text-ink' : 'text-faint'
            }`}
            key={item.id}
            type="button"
            onClick={() => onViewChange(item.id)}
          >
            {item.icon}
            {item.label}
            {item.id === 'review' && dueCount ? <Badge count={dueCount} active={view === item.id} /> : null}
          </button>
        ))}
      </div>
    </nav>
  )
}

function Badge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={`absolute -top-1 right-0 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold tabular-nums md:-right-1.5 ${
        active ? 'bg-white/25 text-white' : 'bg-accent text-white'
      }`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
