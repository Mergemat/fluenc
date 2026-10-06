// Every route sits in the pull-to-refresh scroller. Study routes (/lessons, /review) get a stage
// exactly the scroller's height, so they never scroll. Older pages use the shared colour tokens.
import { Link } from '@tanstack/react-router'
import { BookOpen, Brain, Clapperboard, GraduationCap, LibraryBig, Settings } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import type { DashboardData } from '../server/curriculum'
import { AppScroll } from './AppScroll'
import { DitherGradient } from './dither-kit/gradient'
import { BrandMark } from './ui/BrandMark'
import { PixelLoader, Rule } from './ui/Dither'
import { ToastProvider } from './ui/Toast'

const navigation = [
  { to: '/review', label: 'review', icon: Brain },
  { to: '/lessons', label: 'build', icon: GraduationCap },
  { to: '/reading', label: 'read', icon: BookOpen },
  { to: '/library', label: 'library', icon: LibraryBig },
  { to: '/palace', label: 'palace', icon: Clapperboard },
] as const

export function AppShell({ data, pathname, children }: { data: DashboardData; pathname: string; children: ReactNode }) {
  const due = data.reviewQueue.length
  const fixed = pathname.startsWith('/lessons') || pathname.startsWith('/review')
  // dither-kit paints its canvases in effects, so server HTML has none of them. Hold the shell
  // until hydration: children's effects (the canvas paints) run before this one flips it on.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  return <ToastProvider><div className="dx-shell" data-hydrated={hydrated}>
    {hydrated ? null : <span className="dx-boot"><PixelLoader label="Opening Fluenc" size={5} /></span>}
    <header className="dx-top">
      <Link to="/lessons" className="dx-brand" aria-label="Fluenc home">
        <BrandMark /><span>fluenc</span>
      </Link>
      <nav className="dx-nav" aria-label="Main">{navigation.map(item => <Link key={item.to} to={item.to} className="dx-nav-chip" activeProps={{ 'aria-current': 'page' }}>
        {({ isActive }) => <>
          {isActive ? <DitherGradient from="blue" direction="up" cell={2} opacity={.45} /> : null}
          <span>{item.label}{item.to === '/review' && due ? <b>{due}</b> : null}</span>
        </>}
      </Link>)}</nav>
      <Link to="/settings" className="dx-icon-button" aria-label="Settings" activeProps={{ 'aria-current': 'page' }}><Settings size={16} /></Link>
      <Rule className="dx-edge dx-edge-bottom" />
    </header>
    <main className="dx-main" data-fixed={fixed}><AppScroll pathname={pathname}>{fixed ? <div className="dx-stage">{children}</div> : children}</AppScroll></main>
    <nav className="dx-tabbar" aria-label="Main"><Rule className="dx-edge dx-edge-top" />{navigation.map(item => <Link key={item.to} to={item.to} activeProps={{ 'aria-current': 'page' }}>
      {({ isActive }) => <>
        {isActive ? <DitherGradient from="blue" direction="up" cell={2} opacity={.35} /> : null}
        <span className="dx-tab-icon"><item.icon size={17} strokeWidth={1.75} />{item.to === '/review' && due ? <b>{due}</b> : null}</span>
        <span className="dx-tab-label">{item.label}</span>
      </>}
    </Link>)}</nav>
  </div></ToastProvider>
}
