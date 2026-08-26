import { BookOpen, Film, Settings2, TimerReset } from 'lucide-react'
import type { ReactNode } from 'react'

import type { DashboardData } from '../server/curriculum'

export type AppView = 'session' | 'library' | 'palace'

const navigation: Array<{ id: AppView; label: string; icon: ReactNode }> = [
  { id: 'session', label: 'Занятие', icon: <TimerReset size={18} /> },
  { id: 'library', label: 'Библиотека', icon: <BookOpen size={18} /> },
  { id: 'palace', label: 'Дворец', icon: <Film size={18} /> },
]

export function AppSidebar({
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
  return (
    <aside className="sticky top-0 flex h-screen flex-col border-r border-line bg-[#f8faf8] px-4 py-5 max-[860px]:static max-[860px]:h-auto max-[860px]:flex-row max-[860px]:items-center max-[860px]:border-r-0 max-[860px]:border-b max-[860px]:px-3 max-[860px]:py-2.5">
      <button className="mb-8 flex items-center gap-2.5 border-0 bg-transparent px-2 text-left max-[860px]:mb-0 max-[860px]:px-1" type="button" onClick={() => onViewChange('session')}>
        <span className="font-hanzi text-[28px] font-semibold leading-none">弗</span>
        <strong className="text-[15px] tracking-[-.025em] max-[520px]:hidden">fluenc</strong>
      </button>

      <nav className="grid gap-1 max-[860px]:ml-auto max-[860px]:flex" aria-label="Основная навигация">
        {navigation.map((item) => (
          <SidebarButton key={item.id} active={view === item.id} icon={item.icon} label={item.label} onClick={() => onViewChange(item.id)} />
        ))}
      </nav>

      <div className="flex-1 max-[860px]:hidden" />

      <div className="border-t border-line pt-4 max-[860px]:ml-1 max-[860px]:border-0 max-[860px]:pt-0">
        <p className="mx-2 mt-0 mb-3 text-[10px] leading-[1.45] text-muted max-[860px]:hidden">
          <b className="block text-xs text-ink">{data.progress.introducedWords} / {data.curriculum.words}</b>
          частотных слов
        </p>
        <button className="flex w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 py-2 text-left text-muted hover:bg-mist hover:text-ink max-[860px]:size-9 max-[860px]:justify-center max-[860px]:p-0" type="button" onClick={onOpenSettings}>
          <Settings2 size={17} />
          <span className="text-xs max-[860px]:hidden">Настройки</span>
        </button>
      </div>
    </aside>
  )
}

function SidebarButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={`flex items-center gap-2.5 rounded-lg border-0 px-3 py-2.5 text-left text-xs font-semibold max-[860px]:px-2.5 ${active ? 'bg-ink text-white' : 'bg-transparent text-muted hover:bg-mist hover:text-ink'}`} type="button" onClick={onClick}>
      {icon}
      <span className="max-[520px]:hidden">{label}</span>
    </button>
  )
}
