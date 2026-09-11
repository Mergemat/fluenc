import { BookOpen, Brain, Clapperboard, GraduationCap, LibraryBig } from 'lucide-react'
import type { ReactNode } from 'react'

import type { DashboardData } from '../server/curriculum'

export type AppView = 'review' | 'lessons' | 'reading' | 'library' | 'palace'
const navigation: Array<{ id: AppView; label: string; icon: ReactNode }> = [
  { id: 'review', label: 'Review', icon: <Brain size={18} /> },
  { id: 'lessons', label: 'Build', icon: <GraduationCap size={18} /> },
  { id: 'reading', label: 'Read', icon: <BookOpen size={18} /> },
  { id: 'library', label: 'Library', icon: <LibraryBig size={18} /> },
  { id: 'palace', label: 'Palace', icon: <Clapperboard size={18} /> },
]

type NavigationProps = { data: DashboardData; view: AppView; onViewChange: (view: AppView) => void }

export function AppHeader({ data, onViewChange, view }: NavigationProps) {
  const dueCount = data.reviewQueue.length
  return <header className="app-header">
    <button className="app-brand" type="button" onClick={() => onViewChange('lessons')} aria-label="Fluenc home"><img src="/brand/logo.png" alt="" width={688} height={160} /></button>
    <div className="nav-day"><span>Your practice</span><p>{dueCount ? `${dueCount} cards to revisit` : 'A little, every day.'}</p></div>
    <nav aria-label="Main" className="desktop-nav">{navigation.map(item => <button key={item.id} type="button" className="nav-item" aria-current={view === item.id ? 'page' : undefined} onClick={() => onViewChange(item.id)}>{item.icon}<span>{item.label}</span>{item.id === 'review' && dueCount ? <small>{dueCount}</small> : null}</button>)}</nav>
  </header>
}

export function AppTabBar({ data, onViewChange, view }: NavigationProps) {
  const dueCount = data.reviewQueue.length
  return <nav aria-label="Main" className="mobile-nav">{navigation.map(item => <button key={item.id} type="button" aria-label={item.label} aria-current={view === item.id ? 'page' : undefined} onClick={() => onViewChange(item.id)}><span className="mobile-nav-icon">{item.icon}{item.id === 'review' && dueCount ? <small>{dueCount}</small> : null}</span>{item.label}</button>)}</nav>
}
