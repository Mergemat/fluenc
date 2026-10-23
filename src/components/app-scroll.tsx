import type { RefresherCustomEvent } from "@ionic/core";
import { useIsMutating } from "@tanstack/react-query";
import {
  type ReactNode,
  type TouchEvent,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import { syncNow } from "../offline/sync";
import { useAppUpdate } from "../updates/app-update-provider";
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
  refresh: boolean;
  touching: boolean;
}

export function AppScroll({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}) {
  const pending = useIsMutating() > 0;
  const update = useAppUpdate();
  const content = useRef<HTMLIonContentElement>(null);
  const refresher = useRef<HTMLIonRefresherElement>(null);
  // The pull gesture: whether a finger is down, and whether releasing it should refresh.
  const pull = useRef<PullGesture>({ touching: false, refresh: false });
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
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
    return () => clearTimeout(refreshTimer.current);
  }, []);

  // A new page starts at the top.
  useEffect(() => {
    if (ready && shownPath.current !== pathname) {
      shownPath.current = pathname;
      content.current?.scrollToTop(0);
    }
  }, [ready, pathname]);

  // Pulling syncs, or switches to a new version waiting to take over.
  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    if (!pull.current.refresh) {
      return;
    }
    // Give the released spinner time to settle before it reports back.
    refreshTimer.current = setTimeout(() => {
      pull.current.refresh = false;
      if (update.status === "ready") {
        update.apply();
        return;
      }
      syncNow()
        .catch(() => undefined)
        .finally(() => refresher.current?.complete());
    }, 450);
  }, [update]);
  const refresh = useCallback(
    (event: RefresherCustomEvent) => {
      if (pending) {
        event.detail.complete();
        return;
      }
      // Native iOS reaches this state before release; refresh once the finger lifts.
      pull.current.refresh = true;
      if (!pull.current.touching) {
        scheduleRefresh();
      }
    },
    [pending, scheduleRefresh]
  );
  const startTouch = useCallback(() => {
    pull.current.touching = true;
    clearTimeout(refreshTimer.current);
  }, []);
  const finishTouch = useCallback(
    (event: TouchEvent) => {
      pull.current.touching = event.touches.length > 0;
      if (!pull.current.touching) {
        scheduleRefresh();
      }
    },
    [scheduleRefresh]
  );
  const cancelTouch = useCallback(() => {
    clearTimeout(refreshTimer.current);
    if (pull.current.refresh) {
      refresher.current?.complete();
    }
    pull.current = { touching: false, refresh: false };
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
