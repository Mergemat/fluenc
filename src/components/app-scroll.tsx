import type { RefresherCustomEvent } from "@ionic/core";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  type TouchEvent,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  initializeScroll,
  useScrollReady,
} from "./ui/ionic-scroll";
import "@ionic/core/css/core.css";

const STANDALONE = "(display-mode: standalone)";
const isStandalone = () => window.matchMedia(STANDALONE).matches;
const subscribeToDisplayMode = (onChange: () => void) => {
  const query = window.matchMedia(STANDALONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

interface PullGesture {
  reload: boolean;
  touching: boolean;
}

export function AppScroll({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}) {
  const queryClient = useQueryClient();
  const pending = useIsMutating() > 0;
  const content = useRef<HTMLIonContentElement>(null);
  const refresher = useRef<HTMLIonRefresherElement>(null);
  // The pull gesture: whether a finger is down, and whether releasing it should reload.
  const pull = useRef<PullGesture>({ touching: false, reload: false });
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const shownPath = useRef(pathname);
  const ready = useScrollReady();
  const standalone = useSyncExternalStore(
    subscribeToDisplayMode,
    isStandalone,
    () => false
  );

  // Initialize after hydration: Ionic adds platform classes to the document.
  useEffect(() => {
    initializeScroll();
    return () => clearTimeout(reloadTimer.current);
  }, []);

  // A new page starts at the top.
  useEffect(() => {
    if (ready && shownPath.current !== pathname) {
      shownPath.current = pathname;
      content.current?.scrollToTop(0);
    }
  }, [ready, pathname]);

  const scheduleReload = useCallback(() => {
    clearTimeout(reloadTimer.current);
    if (!pull.current.reload) {
      return;
    }
    // Give the released spinner time to settle before replacing the document.
    reloadTimer.current = setTimeout(() => {
      pull.current.reload = false;
      if (queryClient.isMutating()) {
        refresher.current?.complete();
      } else {
        window.location.reload();
      }
    }, 450);
  }, [queryClient]);
  const refresh = useCallback(
    (event: RefresherCustomEvent) => {
      if (queryClient.isMutating()) {
        event.detail.complete();
        return;
      }
      // Native iOS reaches this state before release. Keep it refreshing until
      // navigation: complete() would play the shrinking/reversing exit animation.
      pull.current.reload = true;
      if (!pull.current.touching) {
        scheduleReload();
      }
    },
    [queryClient, scheduleReload]
  );
  const startTouch = useCallback(() => {
    pull.current.touching = true;
    clearTimeout(reloadTimer.current);
  }, []);
  const finishTouch = useCallback(
    (event: TouchEvent) => {
      pull.current.touching = event.touches.length > 0;
      if (!pull.current.touching) {
        scheduleReload();
      }
    },
    [scheduleReload]
  );
  const cancelTouch = useCallback(() => {
    clearTimeout(reloadTimer.current);
    if (pull.current.reload) {
      refresher.current?.complete();
    }
    pull.current = { touching: false, reload: false };
  }, []);

  if (!ready) {
    return (
      <div className="app-scroll-placeholder" style={{ overflowY: "auto" }}>
        {children}
      </div>
    );
  }

  return (
    <IonContent
      className="app-scroll"
      forceOverscroll
      onTouchCancelCapture={cancelTouch}
      onTouchEndCapture={finishTouch}
      onTouchStartCapture={startTouch}
      ref={content}
      // Every page can be pulled to refresh. Study stages fit the viewport exactly, so on them
      // the scroller only rubber-bands; it never scrolls.
      scrollY
    >
      <IonRefresher
        disabled={!standalone || pending}
        onIonRefresh={refresh}
        ref={refresher}
        slot="fixed"
      >
        <IonRefresherContent />
      </IonRefresher>
      {children}
    </IonContent>
  );
}
