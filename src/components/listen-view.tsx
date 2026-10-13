// Hands-free shadowing for the gaps in a day: sentences the learner has already read play one
// after another, each a few times with a pause after it to say it back. Nothing is graded.
import { Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { useMandarinSpeech } from "../hooks/use-mandarin-speech";
import type { DashboardData } from "../lib/learner-views";
import { DitherButton } from "./dither-kit/button";
import { SHADOW_TARGET, ShadowPips } from "./reading-lesson";
import { Empty, ErrorNote, Page, PageHeader } from "./ui/layout";

type ListenItem = DashboardData["listenQueue"][number];

/** The pause after each line: as long as the line took, a little more, never under a second. */
export const repeatPause = (spokenMs: number) => Math.max(1200, spokenMs * 1.2);

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other] as T, copy[index] as T];
  }
  return copy;
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export function ListenView({ data }: { data: DashboardData }) {
  const [order, setOrder] = useState<ListenItem[]>(data.listenQueue);
  const [position, setPosition] = useState({ index: 0, rep: 0 });
  const [phase, setPhase] = useState<"idle" | "listen" | "repeat">("idle");
  const [failed, setFailed] = useState(false);
  const { speak, stop } = useMandarinSpeech();
  const runRef = useRef(0);
  const current = order[position.index];

  const pause = useCallback(() => {
    runRef.current += 1;
    stop();
    setPhase("idle");
  }, [stop]);

  const run = useCallback(
    async (items: ListenItem[], from: { index: number; rep: number }) => {
      const token = runRef.current + 1;
      runRef.current = token;
      setFailed(false);
      let { index, rep } = from;
      while (runRef.current === token) {
        const item = items[index];
        if (!item) {
          return;
        }
        setPosition({ index, rep });
        setPhase("listen");
        const began = performance.now();
        // biome-ignore lint/performance/noAwaitInLoops: each line must finish before the pause.
        const finished = await speak(item.hanzi, item.pinyin);
        if (runRef.current !== token) {
          return;
        }
        if (!finished) {
          setFailed(true);
          setPhase("idle");
          return;
        }
        setPhase("repeat");
        await wait(repeatPause(performance.now() - began));
        if (runRef.current !== token) {
          return;
        }
        rep += 1;
        if (rep >= SHADOW_TARGET) {
          rep = 0;
          index = (index + 1) % items.length;
        }
      }
    },
    [speak]
  );

  const start = useCallback(() => {
    // Shuffle on the first play only, so the server and first paint agree on the order.
    if (phase === "idle" && position.index === 0 && position.rep === 0) {
      const shuffled = shuffle(data.listenQueue);
      setOrder(shuffled);
      run(shuffled, { index: 0, rep: 0 });
    } else {
      run(order, position);
    }
  }, [phase, position, order, data.listenQueue, run]);

  const skip = useCallback(() => {
    const next = { index: (position.index + 1) % order.length, rep: 0 };
    if (phase === "idle") {
      runRef.current += 1;
      setPosition(next);
    } else {
      stop();
      run(order, next);
    }
  }, [phase, position.index, order, run, stop]);

  useEffect(
    () => () => {
      runRef.current += 1;
    },
    []
  );

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (
      event.target instanceof Element &&
      event.target.closest("input, textarea, button, a, [role=dialog]")
    ) {
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      if (phase === "idle") {
        start();
      } else {
        pause();
      }
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      skip();
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const header = (
    <PageHeader
      meta={
        <Link className="dx-chip" to="/reading">
          read
        </Link>
      }
      title="listen"
    />
  );

  if (!current) {
    return (
      <Page>
        {header}
        <Empty
          detail="sentences you read and shadow land here, to play back hands-free"
          title="nothing to listen to yet"
        />
      </Page>
    );
  }

  return (
    <Page>
      {header}
      <div
        className="dx-card dx-listen"
        data-phase={phase}
        data-revealed="true"
      >
        <div className="dx-card-stage">
          <div className="dx-sentence-prompt">
            <p aria-live="polite" className="dx-sentence-cue">
              {phase === "repeat" ? "your turn: say it aloud" : "listen"}
            </p>
            <p className="dx-sentence font-hanzi" lang="zh-CN">
              {current.hanzi}
            </p>
            <p className="dx-word-reading">{current.pinyin}</p>
            <p className="dx-listen-meaning">{current.meaning}</p>
            <ShadowPips reps={position.rep} />
          </div>
          <p className="dx-listen-count">
            {position.index + 1} / {order.length}
          </p>
        </div>
        <footer className="dx-card-actions dx-shadow-actions">
          <DitherButton
            className="dx-action"
            color="blue"
            onClick={phase === "idle" ? start : pause}
            variant="gradient"
          >
            <span>{phase === "idle" ? "play" : "pause"}</span>
            <kbd>space</kbd>
          </DitherButton>
          <DitherButton
            className="dx-action"
            color="grey"
            disabled={order.length < 2}
            onClick={skip}
            variant="dotted"
          >
            <span>next sentence</span>
            <kbd>→</kbd>
          </DitherButton>
        </footer>
        {failed ? (
          <ErrorNote>couldn’t play this sentence. try again</ErrorNote>
        ) : null}
      </div>
    </Page>
  );
}
