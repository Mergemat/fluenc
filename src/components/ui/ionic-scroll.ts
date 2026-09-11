import { initialize } from '@ionic/core/components'
import { IonContent as Content, defineCustomElement as defineContent } from '@ionic/core/components/ion-content.js'
import { IonRefresher as Refresher, defineCustomElement as defineRefresher } from '@ionic/core/components/ion-refresher.js'
import { IonRefresherContent as RefresherContent, defineCustomElement as defineRefresherContent } from '@ionic/core/components/ion-refresher-content.js'
import type { RefresherCustomEvent } from '@ionic/core'
import { createComponent, type EventName } from '@lit/react'
import * as React from 'react'

// Register only the scrolling components, after React has hydrated the document.
export function initializeScroll() {
  initialize({ mode: 'ios' })
  defineContent()
  defineRefresher()
  defineRefresherContent()
}

export const IonContent = createComponent({ react: React, tagName: 'ion-content', elementClass: Content })
export const IonRefresherContent = createComponent({ react: React, tagName: 'ion-refresher-content', elementClass: RefresherContent })
export const IonRefresher = createComponent({
  react: React,
  tagName: 'ion-refresher',
  elementClass: Refresher,
  events: {
    onIonRefresh: 'ionRefresh' as EventName<RefresherCustomEvent>,
  },
})
