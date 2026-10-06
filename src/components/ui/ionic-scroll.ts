import type { RefresherCustomEvent } from "@ionic/core";
import { initialize } from "@ionic/core/components";
import {
  IonContent as Content,
  defineCustomElement as defineContent,
} from "@ionic/core/components/ion-content.js";
import {
  defineCustomElement as defineRefresher,
  IonRefresher as Refresher,
} from "@ionic/core/components/ion-refresher.js";
import {
  defineCustomElement as defineRefresherContent,
  IonRefresherContent as RefresherContent,
} from "@ionic/core/components/ion-refresher-content.js";
import { createComponent, type EventName } from "@lit/react";
import React, { useSyncExternalStore } from "react";

let registered = false;
const listeners = new Set<() => void>();

// Register only the scrolling components, after React has hydrated the document.
export function initializeScroll() {
  if (registered) {
    return;
  }
  initialize({ mode: "ios" });
  defineContent();
  defineRefresher();
  defineRefresherContent();
  registered = true;
  for (const notify of listeners) {
    notify();
  }
}

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

/** True once the scrolling components are registered, so they never render undefined. */
export function useScrollReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => registered,
    () => false
  );
}

export const IonContent = createComponent({
  react: React,
  tagName: "ion-content",
  elementClass: Content,
});
export const IonRefresherContent = createComponent({
  react: React,
  tagName: "ion-refresher-content",
  elementClass: RefresherContent,
});
export const IonRefresher = createComponent({
  react: React,
  tagName: "ion-refresher",
  elementClass: Refresher,
  events: {
    onIonRefresh: "ionRefresh" as EventName<RefresherCustomEvent>,
  },
});
