import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import type { LibraryEntry } from '../lib/library-search'
import { getItemMeaning } from '../lib/meaning'
import { DictionaryMeanings } from './DictionaryMeanings'
import { LibraryDetails } from './LibraryDetails'
import { MandarinAudioButton } from './MandarinAudioButton'
import { NeutralToneBadge } from './NeutralToneHint'
import { Page, PageHeader } from './ui/Layout'

export function LibraryDetailPage({ item, from }: { item: LibraryEntry; from?: 'palace' }) {
  const meaning = getItemMeaning(item)
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const backLabel = from === 'palace' ? 'Back to palace' : 'Back to library'

  return <Page>
    <nav className="detail-navigation" aria-label="Back">
      {canGoBack ? <button type="button" onClick={() => router.history.back()}><ArrowLeft size={16} />{backLabel}</button>
        : <Link to={from === 'palace' ? '/palace' : '/library'}><ArrowLeft size={16} />{backLabel}</Link>}
    </nav>
    <PageHeader title={item.kind === 'characters' ? 'Character details' : 'Word details'} meta={<span className={`status-tag status-${item.status}`}>{item.status === 'review' ? 'Learned' : item.status === 'learning' ? 'Learning' : 'New'}</span>} />
    <header className="detail-hero">
      <p className={`detail-hanzi font-hanzi ${item.kind === 'words' ? 'detail-word' : ''}`} lang="zh-CN">{item.hanzi}</p>
      <div className="detail-definition">
        <div className="answer-sound"><strong>{item.pinyin}</strong><MandarinAudioButton text={item.hanzi} pinyin={item.pinyin} /></div>
        <NeutralToneBadge text={item.hanzi} pinyin={item.pinyin} />
        <h2>{meaning.primary}</h2>
        <DictionaryMeanings meanings={meaning.alternatives} />
      </div>
    </header>
    <LibraryDetails id={item.id} hanzi={item.hanzi} kind={item.kind} />
  </Page>
}
