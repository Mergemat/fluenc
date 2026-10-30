// The welcome reel: how a character becomes a movie. 好 opens alone with the idea; then hǎo
// appears and each slide lights one part and shows what it becomes: the initial an actor, the
// final a place, the tone a room, the parts props; then the actor acts out the meaning.
// Slides play on their own like stories; a tap, Enter or the button skips ahead.
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";

import { isShortcut, useWindowKeys } from "../hooks/use-window-keys";
import { defaultToneRooms } from "../lib/pinyin";
import { cn } from "../lib/utils";
import { brand, shell } from "./app-shell";
import { DitherGradient } from "./dither-kit/gradient";
import { BrandMark } from "./ui/brand-mark";
import { ActionButton } from "./ui/button";
import { glyphBox, HanziGlyph, ToneContour } from "./ui/hanzi";
import { chip, label, PageHeader } from "./ui/layout";
import { partColor } from "./ui/part-colors";

const SLIDE_MS = 8000;
const parts = ["女", "子"];
type Part = "actor" | "set" | "room";
type PartState = "todo" | "now" | "done";

/** Each part of the sound keeps one colour through the reel. */
const kindColors: Record<Part, string> = {
  actor: "text-blue",
  set: "text-purple",
  room: "text-green",
};

/** The part being explained glows, the ones shown keep their colour. */
const soundStates = (part: Part): Record<PartState, string> => ({
  todo: "text-faint-foreground",
  done: kindColors[part],
  now: cn(kindColors[part], "-translate-y-1 text-shadow-glow-lg"),
});

/** The small line under a code or a name. */
const note = "block type-label text-muted-foreground";

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
    <div className="flex min-h-0 flex-1 flex-col items-center gap-2">
      <div className={cn(glyphBox, "glyph-max-50")}>
        <HanziGlyph hanzi="好" parts={parts} xray={slide >= 4} />
      </div>
      {/* Hidden on the intro but keeps its line, so 好 doesn't move when it appears. */}
      <span
        aria-hidden={slide === 0}
        aria-label="hǎo"
        className={cn(
          "type-pinyin flex shrink-0 items-center justify-center text-3xl transition-opacity duration-300 ease-out",
          slide === 0 && "opacity-0"
        )}
        role="img"
      >
        {(
          [
            ["actor", "h"],
            ["set", "ǎo"],
            ["room", <ToneContour className="h-5 w-7" key="tone" tone={3} />],
          ] as const
        ).map(([part, text]) => (
          <span
            className={cn(
              "transition-glow duration-300 ease-out",
              part === "room" && "ml-3",
              soundStates(part)[partState(part, slide)]
            )}
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
    <span aria-hidden="true" className="flex min-w-10 flex-1 gap-1">
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
            className="relative h-1.5 flex-1 overflow-hidden rounded-xs bg-border"
            key={index === slide ? `now-${slide}` : index}
          >
            {state === "todo" ? null : (
              <span
                className={cn(
                  "absolute inset-0",
                  state === "now" && "animate-reel"
                )}
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
    <div className="grid grid-cols-2 gap-1.5">
      {actorKinds.map((kind) => (
        <span
          className={cn(
            "grid gap-1.5 rounded-lg border px-3 py-2.5",
            kind.lit ? "border-blue/50 bg-blue/10" : "border-border"
          )}
          key={kind.label}
        >
          <small className={cn(note, kind.lit && "text-foreground")}>
            {kind.label}
          </small>
          <b className="type-code whitespace-pre text-base text-blue">
            {kind.codes}
          </b>
        </span>
      ))}
    </div>
  );
}

function Place() {
  return (
    <div className="type-heading flex items-center gap-4 rounded-lg border border-purple/50 bg-purple/10 px-4 py-3.5">
      <b className="type-code text-purple text-xl">-ao</b>
      <span aria-hidden="true" className="text-faint-foreground">
        →
      </span>
      <span>
        <small className={cn(note, "mb-1")}>for example</small>
        your grandma’s house
      </span>
    </div>
  );
}

function Rooms() {
  return (
    <ul className="grid grid-cols-5 gap-1.5">
      {[1, 2, 3, 4, 5].map((tone) => (
        <li
          className={cn(
            "type-label grid justify-items-center gap-2 rounded-lg border px-0.5 pt-3 pb-2.5 text-center leading-wrap",
            tone === 3
              ? "border-green/50 bg-green/12 text-foreground"
              : "border-border text-muted-foreground"
          )}
          key={tone}
        >
          <ToneContour className="h-4 w-6 text-green" tone={tone} />
          <span>{defaultToneRooms[tone]}</span>
        </li>
      ))}
    </ul>
  );
}

/** One prop picked by meaning, one by look, left and right as their parts sit in 好. */
function Props() {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {[
        { code: "女", prop: "a woman", how: "by meaning" },
        { code: "子", prop: "a hook", how: "by look" },
      ].map((prop, index) => (
        <span
          className="type-heading flex items-center gap-3 rounded-lg border border-part/50 px-3 py-2.5"
          key={prop.code}
          style={{ "--part": partColor(index) } as CSSProperties}
        >
          <b
            className="font-hanzi-props font-normal text-3xl text-part"
            lang="zh-CN"
          >
            {prop.code}
          </b>
          <span>
            {prop.prop}
            <small className={note}>{prop.how}</small>
          </span>
        </span>
      ))}
    </div>
  );
}

const clue = "font-semibold";

function Script() {
  return (
    <p className="type-heading text-pretty text-muted-foreground leading-body">
      Your <b className={cn(clue, kindColors.actor)}>h- actor</b> is in the{" "}
      <b className={cn(clue, kindColors.room)}>bedroom</b> at your{" "}
      <b className={cn(clue, kindColors.set)}>-ao place</b>.{" "}
      <b className={clue} style={{ color: partColor(0) }}>
        A woman
      </b>{" "}
      on the left can’t reach her bag; he hands it over with{" "}
      <b className={clue} style={{ color: partColor(1) }}>
        a hook
      </b>{" "}
      on the right. She grins.{" "}
      <b className={cn(clue, "text-foreground")}>Good.</b>
    </p>
  );
}

/** A sound's code in a slide's title. */
const code = "inline-flex items-center font-bold font-mono";

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
        <b className={cn(code, kindColors.actor)}>h-</b> is an actor
      </>
    ),
    line: "Pick someone you can picture clearly, real or famous. Every h- sound stars them. Actors come in four kinds.",
    visual: <Actors />,
  },
  {
    kicker: "final",
    title: (
      <>
        <b className={cn(code, kindColors.set)}>-ao</b> is a place
      </>
    ),
    line: "Pick a building you know well enough to walk through in your head. Every -ao scene happens there.",
    visual: <Place />,
  },
  {
    kicker: "tone",
    title: (
      <>
        <b className={cn(code, kindColors.room)}>
          <ToneContour className="h-6 w-8" tone={3} />
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
  useWindowKeys((event) => {
    if (event.key === "Enter" && isShortcut(event, "button, a")) {
      event.preventDefault();
      next();
    }
  });

  const { kicker, title, line, visual } = slides[slide];
  return (
    <div className={shell}>
      <div className="flex h-14 shrink-0 items-center border-border border-b px-gutter">
        <span className={brand}>
          <BrandMark />
          fluenc
        </span>
      </div>
      <main className="mx-auto box-border flex min-h-0 w-full max-w-welcome flex-1 flex-col gap-4 px-gutter pt-page-top pb-6">
        <PageHeader
          meta={
            <button
              className="type-control text-muted-foreground hover:text-foreground"
              onClick={skip}
              type="button"
            >
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
          className="grid min-h-80 welcome-short:min-h-72 shrink-0 animate-rise content-start gap-2"
          key={slide}
          onClick={last ? undefined : next}
        >
          <p className={label}>{kicker}</p>
          <h1 className="type-display flex flex-wrap items-center gap-x-2 welcome-short:gap-x-1.5 text-2xl welcome-short:text-xl tracking-snug">
            {title}
          </h1>
          <p className="type-body text-pretty text-muted-foreground">{line}</p>
          {visual ? <div className="mt-2">{visual}</div> : null}
        </div>
        <footer className="flex shrink-0 gap-2">
          {slide > 0 ? (
            <button
              className={cn(chip, "h-12 rounded-lg px-4 short:max-studio:h-11")}
              onClick={back}
              type="button"
            >
              back
            </button>
          ) : null}
          <ActionButton
            className="short:max-studio:h-11"
            color="blue"
            hint="↵"
            onClick={next}
            variant="gradient"
          >
            {last ? "start learning" : "next"}
          </ActionButton>
        </footer>
      </main>
    </div>
  );
}
