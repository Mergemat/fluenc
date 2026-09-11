import { Link } from '@tanstack/react-router'
import { BookOpen, Brain, Clapperboard, GraduationCap, LibraryBig, Settings } from 'lucide-react'

import type { DashboardData } from '../server/curriculum'

const navigation = [
  { to: '/review', label: 'Review', icon: <Brain size={18} /> },
  { to: '/lessons', label: 'Build', icon: <GraduationCap size={18} /> },
  { to: '/reading', label: 'Read', icon: <BookOpen size={18} /> },
  { to: '/library', label: 'Library', icon: <LibraryBig size={18} /> },
  { to: '/palace', label: 'Palace', icon: <Clapperboard size={18} /> },
] as const

export function AppHeader({ data }: { data: DashboardData }) {
  const dueCount = data.reviewQueue.length
  return <header className="app-header">
    <Link className="app-brand" to="/lessons" aria-label="Fluenc home"><img src="/brand/logo.png" alt="" width={688} height={160} /></Link>
    <div className="nav-day"><span>Your practice</span><p>{dueCount ? `${dueCount} cards to revisit` : 'A little, every day.'}</p></div>
    <nav aria-label="Main" className="desktop-nav">{navigation.map(item => <Link key={item.to} to={item.to} className="nav-item" activeProps={{ 'aria-current': 'page' }}>{item.icon}<span>{item.label}</span>{item.to === '/review' && dueCount ? <small>{dueCount}</small> : null}</Link>)}</nav>
    <Link className="settings-nav" to="/settings" aria-label="Settings" activeProps={{ 'aria-current': 'page' }}><Settings size={19} /><span>Settings</span></Link>
  </header>
}

export function AppTabBar({ data }: { data: DashboardData }) {
  const dueCount = data.reviewQueue.length
  return <nav aria-label="Main" className="mobile-nav">{navigation.map(item => <Link key={item.to} to={item.to} aria-label={item.label} activeProps={{ 'aria-current': 'page' }}><span className="mobile-nav-icon">{item.icon}{item.to === '/review' && dueCount ? <small>{dueCount}</small> : null}</span>{item.label}</Link>)}</nav>
}
