import { BookOpen, Brain, Clapperboard, GraduationCap, LibraryBig, Settings2 } from 'lucide-react'
import type { ReactNode } from 'react'

import type { DashboardData } from '../server/curriculum'

export type AppView = 'review' | 'lessons' | 'reading' | 'library' | 'palace'

const navigation: Array<{ id: AppView; label: string; icon: ReactNode }> = [
  { id: 'review', label: 'Review', icon: <Brain size={18} strokeWidth={2.2} /> },
  { id: 'lessons', label: 'Build', icon: <GraduationCap size={18} strokeWidth={2.2} /> },
  { id: 'reading', label: 'Read', icon: <BookOpen size={18} strokeWidth={2.2} /> },
  { id: 'library', label: 'Library', icon: <LibraryBig size={18} strokeWidth={2.2} /> },
  { id: 'palace', label: 'Palace', icon: <Clapperboard size={18} strokeWidth={2.2} /> },
]

export function AppHeader({ data, onOpenSettings, onViewChange, view }: { data: DashboardData; onOpenSettings: () => void; onViewChange: (view: AppView) => void; view: AppView }) {
  const dueCount = data.codebookQueue.length + data.reviewQueue.length
  return (
    <header className="sticky top-0 z-10 flex h-15 items-center border-b border-line bg-canvas/95 px-5 backdrop-blur md:h-dvh md:flex-col md:items-stretch md:border-b-0 md:border-r md:px-4 md:py-5">
      <button className="flex items-center gap-2 border-0 bg-transparent p-0 text-left" type="button" onClick={() => onViewChange('lessons')}>
        <span className="grid size-8 place-items-center rounded-lg bg-glaze text-sm font-black text-paper">F</span>
        <span className="text-[17px] font-black tracking-[-0.05em]">fluenc</span>
      </button>
      <div className="mt-8 hidden border-y border-line py-4 md:block">
        <p className="m-0 text-[10px] font-bold uppercase tracking-[.12em] text-faint">Today</p>
        <div className="mt-2 flex items-baseline gap-2"><strong className="text-3xl font-black tabular-nums">{dueCount}</strong><span className="text-xs text-muted">due</span></div>
      </div>
      <nav aria-label="Main" className="mt-5 hidden gap-1 md:grid">
        {navigation.map((item) => <NavItem key={item.id} {...item} active={view === item.id} count={item.id === 'review' ? dueCount : undefined} onClick={() => onViewChange(item.id)} />)}
      </nav>
      <button aria-label="Settings" className="ml-auto grid size-10 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink md:mt-auto md:ml-0 md:flex md:w-full md:justify-start md:gap-3 md:px-3" type="button" onClick={onOpenSettings}>
        <Settings2 size={18} /><span className="hidden text-sm font-bold md:inline">Settings</span>
      </button>
    </header>
  )
}

function NavItem({ active, count, icon, label, onClick }: { active: boolean; count?: number; icon: ReactNode; label: string; onClick: () => void }) {
  return <button aria-current={active ? 'page' : undefined} className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition ${active ? 'bg-ink text-paper' : 'text-muted hover:bg-paper hover:text-ink'}`} type="button" onClick={onClick}>{icon}<span>{label}</span>{count ? <span className={`ml-auto text-xs tabular-nums ${active ? 'text-paper/65' : 'text-faint'}`}>{count}</span> : null}</button>
}

export function AppTabBar({ data, onViewChange, view }: { data: DashboardData; onViewChange: (view: AppView) => void; view: AppView }) {
  const dueCount = data.codebookQueue.length + data.reviewQueue.length
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 pb-[max(env(safe-area-inset-bottom),6px)] backdrop-blur md:hidden">
      <div className="mx-auto flex w-full max-w-xl px-1">
        {navigation.map((item) => <button aria-current={view === item.id ? 'page' : undefined} aria-label={item.label} className={`relative flex flex-1 flex-col items-center gap-1 bg-transparent pb-1 pt-2.5 text-[10px] font-bold ${view === item.id ? 'text-glaze' : 'text-muted'}`} key={item.id} type="button" onClick={() => onViewChange(item.id)}>{item.icon}{item.label}{item.id === 'review' && dueCount ? <span className="absolute left-1/2 top-1 ml-2 grid min-w-4 place-items-center rounded-full bg-ink px-1 text-[9px] text-paper">{dueCount}</span> : null}</button>)}
      </div>
    </nav>
  )
}
