import type { RefresherCustomEvent } from '@ionic/core'
import { useIsMutating, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'

import { IonContent, IonRefresher, IonRefresherContent, initializeScroll } from './ui/ionic-scroll'
import '@ionic/core/css/core.css'

export function AppScroll({ children, pathname }: { children: ReactNode; pathname: string }) {
  const queryClient = useQueryClient()
  const pending = useIsMutating() > 0
  const content = useRef<HTMLIonContentElement>(null)
  const refresher = useRef<HTMLIonRefresherElement>(null)
  const touching = useRef(false)
  const reloadAfterPull = useRef(false)
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [ready, setReady] = useState(false)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    // Initialize after hydration: Ionic adds platform classes to the document.
    initializeScroll()
    setStandalone(window.matchMedia('(display-mode: standalone)').matches)
    setReady(true)
    return () => clearTimeout(reloadTimer.current)
  }, [])

  useEffect(() => {
    if (ready) void content.current?.scrollToTop(0)
  }, [ready, pathname])

  const scheduleReload = () => {
    clearTimeout(reloadTimer.current)
    if (!reloadAfterPull.current) return
    // Give the released spinner time to settle before replacing the document.
    reloadTimer.current = setTimeout(() => {
      reloadAfterPull.current = false
      if (queryClient.isMutating()) void refresher.current?.complete()
      else window.location.reload()
    }, 450)
  }
  const refresh = (event: RefresherCustomEvent) => {
    if (queryClient.isMutating()) {
      event.detail.complete()
      return
    }
    // Native iOS reaches this state before release. Keep it refreshing until
    // navigation: complete() would play the shrinking/reversing exit animation.
    reloadAfterPull.current = true
    if (!touching.current) scheduleReload()
  }
  const finishTouch = (event: TouchEvent) => {
    touching.current = event.touches.length > 0
    if (!touching.current) scheduleReload()
  }
  const cancelTouch = () => {
    touching.current = false
    clearTimeout(reloadTimer.current)
    if (reloadAfterPull.current) void refresher.current?.complete()
    reloadAfterPull.current = false
  }

  if (!ready) return <div className="app-scroll-placeholder" style={{ overflowY: 'auto' }}>{children}</div>

  return (
    <IonContent
      ref={content}
      className="app-scroll"
      // Every page can be pulled to refresh. Study stages fit the viewport exactly, so on them
      // the scroller only rubber-bands; it never scrolls.
      scrollY
      forceOverscroll
      onTouchStartCapture={() => { touching.current = true; clearTimeout(reloadTimer.current) }}
      onTouchEndCapture={finishTouch}
      onTouchCancelCapture={cancelTouch}
    >
      <IonRefresher ref={refresher} slot="fixed" disabled={!standalone || pending} onIonRefresh={refresh}>
        <IonRefresherContent />
      </IonRefresher>
      {children}
    </IonContent>
  )
}
