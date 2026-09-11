import type { RefresherCustomEvent, RefresherPullEndCustomEvent } from '@ionic/core'
import { useIsMutating, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { IonContent, IonRefresher, IonRefresherContent, initializeScroll } from './ui/ionic-scroll'
import '@ionic/core/css/core.css'

export function AppScroll({ children, view }: { children: ReactNode; view: string }) {
  const queryClient = useQueryClient()
  const pending = useIsMutating() > 0
  const content = useRef<HTMLIonContentElement>(null)
  const reloadAfterPull = useRef(false)
  const [ready, setReady] = useState(false)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    // Initialize after hydration: Ionic adds platform classes to the document.
    initializeScroll()
    setStandalone(window.matchMedia('(display-mode: standalone)').matches)
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) void content.current?.scrollToTop(0)
  }, [ready, view])

  const refresh = (event: RefresherCustomEvent) => {
    reloadAfterPull.current = queryClient.isMutating() === 0
    // Native iOS can fire ionRefresh with the finger still down. Ionic waits for
    // release before completing, so reload only after that lifecycle finishes.
    event.detail.complete()
  }
  const finishPull = (event: RefresherPullEndCustomEvent) => {
    const reload = reloadAfterPull.current && event.detail.reason === 'complete'
    reloadAfterPull.current = false
    if (reload && !queryClient.isMutating()) window.location.reload()
  }

  if (!ready) return <div className="app-scroll-placeholder">{children}</div>

  return (
    <IonContent ref={content} className="app-scroll" forceOverscroll>
      <IonRefresher slot="fixed" disabled={!standalone || pending} onIonRefresh={refresh} onIonPullEnd={finishPull}>
        <IonRefresherContent />
      </IonRefresher>
      {children}
    </IonContent>
  )
}
