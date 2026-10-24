// The welcome reel: how a character becomes a movie. 好 opens alone with the idea; then hǎo
// appears and each slide lights one part and shows what it becomes: the initial an actor, the
// final a place, the tone a room, the parts props; then the actor acts out the meaning.
// Slides play on their own like stories; a tap, Enter or the button skips ahead.
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import { defaultToneRooms } from "../lib/pinyin";
import { DitherButton } from "./dither-kit/button";
import { DitherGradient } from "./dither-kit/gradient";
import { BrandMark } from "./ui/brand-mark";
import { HanziGlyph, ToneContour } from "./ui/hanzi";
import { PageHeader } from "./ui/layout";
import { partColor } from "./ui/part-colors";

const SLIDE_MS = 8000;
const parts = ["女", "子"];
type Part = "actor" | "set" | "room";
type PartState = "todo" | "now" | "done";

/** A part of hǎo is lit on its own slide and keeps its colour after. Slide 0 is the intro. */
function partState(part: Part, slide: number): PartState {
  const index = ["actor", "set", "room"].indexOf(part) + 1;
  if (index === slide) {
    return "now";
  }
  return index < slide ? "done" : "todo";
}

function Subject({ slide }: { slide: number }) {
  return (
    <div className="dx-welcome-subject">
      <div className="dx-glyph-box">
        <HanziGlyph hanzi="好" parts={parts} xray={slide >= 4} />
      </div>
      {/* Hidden on the intro but keeps its line, so 好 doesn't move when it appears. */}
      <span
        aria-hidden={slide === 0}
        aria-label="hǎo"
        className="dx-welcome-py"
        data-shown={slide > 0}
        role="img"
      >
        {(
          [
            ["actor", "h"],
            ["set", "ǎo"],
            ["room", <ToneContour key="tone" tone={3} />],
          ] as const
        ).map(([part, text]) => (
          <span
            className="dx-welcome-sound"
            data-k={part}
            data-state={partState(part, slide)}
            key={part}
          >
            {text}
          </span>
        ))}
      </span>
    </div>
  );
}

/** Story segments: seen ones full, the current one filling over the slide's time. */
function Reel({ slide, total }: { slide: number; total: number }) {
  return (
    <span aria-hidden="true" className="dx-welcome-reel">
      {Array.from({ length: total }, (_, index) => {
        let state: PartState = "todo";
        if (index < slide) {
          state = "done";
        } else if (index === slide) {
          state = "now";
        }
        return (
          // Keyed by the current slide too, so its fill restarts when you go back.
          <i
            className="dx-welcome-seg"
            data-state={state}
            key={index === slide ? `now-${slide}` : index}
          >
            {state === "todo" ? null : (
              <span
                className="dx-welcome-seg-fill"
                style={{ "--ms": `${SLIDE_MS}ms` } as CSSProperties}
              >
                <DitherGradient cell={2} direction="up" from="blue" />
              </span>
            )}
          </i>
        );
      })}
    </span>
  );
}

const actorKinds = [
  { label: "men", codes: "b-  h-  zh-", lit: true },
  { label: "women", codes: "bi-  ji-  y-", lit: false },
  { label: "fictional", codes: "bu-  hu-  w-", lit: false },
  { label: "gods & leaders", codes: "ju-  xu-  lü-", lit: false },
];

function Actors() {
  return (
    <div className="dx-welcome-kinds">
      {actorKinds.map((kind) => (
        <span className="dx-welcome-kind" data-lit={kind.lit} key={kind.label}>
          <small className="dx-welcome-note">{kind.label}</small>
          <b className="dx-welcome-kind-codes">{kind.codes}</b>
        </span>
      ))}
    </div>
  );
}

function Place() {
  return (
    <div className="dx-welcome-place">
      <b className="dx-welcome-place-code">-ao</b>
      <span aria-hidden="true">→</span>
      <span>
        <small className="dx-welcome-note">for example</small>
        your grandma’s house
      </span>
    </div>
  );
}

function Rooms() {
  return (
    <ul className="dx-welcome-rooms">
      {[1, 2, 3, 4, 5].map((tone) => (
        <li data-lit={tone === 3} key={tone}>
          <ToneContour className="dx-welcome-room-tone" tone={tone} />
          <span>{defaultToneRooms[tone]}</span>
        </li>
      ))}
    </ul>
  );
}

/** One prop picked by meaning, one by look, left and right as their parts sit in 好. */
function Props() {
  return (
    <div className="dx-welcome-props">
      {[
        { code: "女", prop: "a woman", how: "by meaning" },
        { code: "子", prop: "a hook", how: "by look" },
      ].map((prop, index) => (
        <span
          className="dx-welcome-prop"
          key={prop.code}
          style={{ "--part": partColor(index) } as CSSProperties}
        >
          <b className="dx-welcome-prop-code font-hanzi-props" lang="zh-CN">
            {prop.code}
          </b>
          <span>
            {prop.prop}
            <small className="dx-welcome-note">{prop.how}</small>
          </span>
        </span>
      ))}
    </div>
  );
}

function Script() {
  return (
    <p className="dx-welcome-script">
      Your{" "}
      <b className="dx-welcome-clue" data-k="actor">
        h- actor
      </b>{" "}
      is in the{" "}
      <b className="dx-welcome-clue" data-k="room">
        bedroom
      </b>{" "}
      at your{" "}
      <b className="dx-welcome-clue" data-k="set">
        -ao place
      </b>
      .{" "}
      <b className="dx-welcome-clue" style={{ color: partColor(0) }}>
        A woman
      </b>{" "}
      on the left can’t reach her bag; he hands it over with{" "}
      <b className="dx-welcome-clue" style={{ color: partColor(1) }}>
        a hook
      </b>{" "}
      on the right. She grins. <b className="dx-welcome-clue">Good.</b>
    </p>
  );
}

// The explanations follow Mandarin Blueprint's own introduction to the method.
const slides: {
  kicker: string;
  title: ReactNode;
  line: string;
  visual?: ReactNode;
}[] = [
  {
    kicker: "好 · good",
    title: "Every character is a short movie",
    line: "Symbols are hard to remember. People, places and things are easy. So each character becomes a scene.",
  },
  {
    kicker: "initial",
    title: (
      <>
        <b className="dx-welcome-code" data-k="actor">
          h-
        </b>{" "}
        is an actor
      </>
    ),
    line: "Pick someone you can picture clearly, real or famous. Every h- sound stars them. Actors come in four kinds.",
    visual: <Actors />,
  },
  {
    kicker: "final",
    title: (
      <>
        <b className="dx-welcome-code" data-k="set">
          -ao
        </b>{" "}
        is a place
      </>
    ),
    line: "Pick a building you know well enough to walk through in your head. Every -ao scene happens there.",
    visual: <Place />,
  },
  {
    kicker: "tone",
    title: (
      <>
        <b className="dx-welcome-code" data-k="room">
          <ToneContour tone={3} />
        </b>{" "}
        is a room in that place
      </>
    ),
    line: "Every place has the same five rooms. hǎo dips, so it plays in the bedroom.",
    visual: <Rooms />,
  },
  {
    kicker: "props",
    title: "The parts are props",
    line: "Pick an object for each part, by how it looks or what it means. Put it where the part sits.",
    visual: <Props />,
  },
  {
    kicker: "script",
    title: "The actor acts out the meaning",
    line: "Props always do something, and the room is part of it.",
    visual: <Script />,
  },
];

/** `onDone` gets where to go: the first lesson after the reel, or today when skipped. */
export function WelcomeView({
  onDone,
}: {
  onDone: (to: "/lessons" | "/today") => void;
}) {
  const [slide, setSlide] = useState(0);
  const last = slide === slides.length - 1;
  const next = useCallback(() => {
    if (last) {
      onDone("/lessons");
    } else {
      setSlide((current) => current + 1);
    }
  }, [last, onDone]);
  const back = useCallback(() => setSlide((current) => current - 1), []);
  const skip = useCallback(() => onDone("/today"), [onDone]);

  useEffect(() => {
    if (last) {
      return;
    }
    const timer = setTimeout(() => setSlide(slide + 1), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [slide, last]);
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.key === "Enter" &&
      !(event.target instanceof Element && event.target.closest("button, a"))
    ) {
      event.preventDefault();
      next();
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { kicker, title, line, visual } = slides[slide];
  return (
    <div className="dx-shell dx-welcome">
      <div className="dx-welcome-top">
        <span className="dx-brand">
          <BrandMark />
          fluenc
        </span>
      </div>
      <main className="dx-welcome-frame">
        <PageHeader
          meta={
            <button className="dx-welcome-skip" onClick={skip} type="button">
              skip
            </button>
          }
          title="welcome"
        >
          <Reel slide={slide} total={slides.length} />
        </PageHeader>
        <Subject slide={slide} />
        {/* Tapping the slide skips ahead, as in stories; Enter and the button do the same. */}
        {/* biome-ignore lint/a11y: a pointer shortcut; the button and Enter are the accessible path */}
        <div
          className="dx-welcome-slide"
          key={slide}
          onClick={last ? undefined : next}
        >
          <p className="dx-label">{kicker}</p>
          <h1>{title}</h1>
          <p className="dx-welcome-line">{line}</p>
          {visual ? <div className="dx-welcome-visual">{visual}</div> : null}
        </div>
        <footer className="dx-welcome-actions">
          {slide > 0 ? (
            <button className="dx-chip" onClick={back} type="button">
              back
            </button>
          ) : null}
          <DitherButton
            className="dx-action"
            color="blue"
            onClick={next}
            variant="gradient"
          >
            <span>{last ? "start learning" : "next"}</span>
            <kbd>↵</kbd>
          </DitherButton>
        </footer>
      </main>
    </div>
  );
}
