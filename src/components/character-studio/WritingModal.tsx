import { X } from 'lucide-react'
import { WritingPad } from '../WritingPad'
import { Button } from '../ui/Button'

export function WritingModal({ character, onClose }: { character: string; onClose: () => void }) {
  return <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/55 p-5 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="w-full max-w-sm rounded-2xl border border-line bg-paper p-5" role="dialog" aria-modal="true" aria-label={`Write ${character}`}><div className="mb-4 flex items-center justify-between"><div><span className="study-label block">Writing drill</span><strong className="font-hanzi text-2xl text-glaze" lang="zh-CN">{character}</strong></div><Button variant="icon" type="button" onClick={onClose} aria-label="Close"><X size={17} /></Button></div><WritingPad character={character} /></section></div>
}
