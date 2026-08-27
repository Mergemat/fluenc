import { Brain, BookOpen, Clapperboard, GraduationCap, LibraryBig, Settings2 } from 'lucide-react'
import type { ReactNode } from 'react'

import type { DashboardData } from '../server/curriculum'

export type AppView = 'review' | 'lessons' | 'reading' | 'library' | 'palace'

const navigation: Array<{ id: AppView; label: string; icon: ReactNode }> = [
  { id: 'review', label: 'Review', icon: <Brain size={18} /> },
  { id: 'lessons', label: 'Lessons', icon: <GraduationCap size={18} /> },
  { id: 'reading', label: 'Read', icon: <BookOpen size={18} /> },
  { id: 'library', label: 'Library', icon: <LibraryBig size={18} /> },
  { id: 'palace', label: 'Palace', icon: <Clapperboard size={18} /> },
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
      <div className="mx-auto flex h-13 w-full max-w-xl items-center gap-2 px-5">
        <button
          aria-label="Fluenc home"
          className="border-0 bg-transparent p-0 text-[15px] font-semibold tracking-tight"
          type="button"
          onClick={() => onViewChange('lessons')}
        >
          fluenc
        </button>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-5 md:flex">
          {navigation.map((item) => (
            <button
              aria-label={item.label}
              aria-current={view === item.id ? 'page' : undefined}
              className={`inline-flex h-10 items-center gap-1.5 border-0 bg-transparent text-sm font-medium ${
                view === item.id ? 'text-ink' : 'text-muted'
              }`}
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
            >
              {item.icon}
              {item.label}
              {item.id === 'review' && dueCount
                ? <span className="text-xs tabular-nums text-faint">{dueCount}</span>
                : null}
            </button>
          ))}
        </nav>

        <button
          aria-label="Settings"
          className="ml-auto grid size-10 place-items-center rounded-full text-muted hover:text-ink md:ml-5"
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
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-canvas/95 pb-[max(env(safe-area-inset-bottom),6px)] backdrop-blur-md md:hidden"
    >
      <div className="mx-auto flex w-full max-w-xl">
        {navigation.map((item) => (
          <button
            aria-current={view === item.id ? 'page' : undefined}
            aria-label={item.label}
            className={`relative flex flex-1 flex-col items-center gap-1 border-0 bg-transparent pb-1 pt-2.5 text-[10px] font-medium ${
              view === item.id ? 'text-ink' : 'text-faint'
            }`}
            key={item.id}
            type="button"
            onClick={() => onViewChange(item.id)}
          >
            {item.icon}
            {item.label}
            {item.id === 'review' && dueCount
              ? <span className="absolute top-1.5 ml-6 text-[9px] leading-none tabular-nums">{dueCount}</span>
              : null}
          </button>
        ))}
      </div>
    </nav>
  )
}
