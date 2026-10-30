import type { RefresherCustomEvent } from "@ionic/core";
import {
  type ReactNode,
  type TouchEvent,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import { useSaving } from "../progress/saves";
import { reloadApp } from "../updates/use-app-update";
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
  const pending = useSaving();
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

  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    if (!pull.current.refresh) {
      return;
    }
    // Give the released spinner time to settle; it keeps spinning until the page reloads.
    refreshTimer.current = setTimeout(() => {
      pull.current.refresh = false;
      reloadApp().catch(() => refresher.current?.complete());
    }, 450);
  }, []);
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
    return <div className="h-full overflow-y-auto">{children}</div>;
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
        // A reload would lose a lesson's half-written Hanzi Movie.
        disabled={!standalone || pending || pathname.startsWith("/lessons")}
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
