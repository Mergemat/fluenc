// Review and read are a deck of cards: the top card flips to its answer, a grade throws it away
// and the next one rises off the pile, which thins as the session runs down. The cards carry the
// dither; the page behind them stays plain.
import { type AnimationEvent, type ReactNode, useCallback } from "react";

import { cn } from "../../lib/utils";
import { DitherGradient } from "../dither-kit/gradient";
import type { DitherColor } from "../dither-kit/palette";
import { meaningText } from "./hanzi";

// A slight, fixed disorder so the pile reads as cards, not a box.
const TILTS = [-1.4, 1.1, -0.7, 0.5];

const suits = { character: "字", word: "词", sentence: "句" } as const;
export type CardSuit = keyof typeof suits;

/** The page: a header, then a deck that fills the rest without scrolling. */
export const deckPage =
  "mx-auto flex h-full w-full max-w-frame flex-col gap-4 px-gutter pt-page-top pb-6";

/** A deck: the table with its pile, then the actions under it. */
export const deck = "flex min-h-0 flex-1 flex-col gap-4";

/**
 * The button and the grades share one place, tall enough for a wait line over the grades. Each
 * child stacks into it with `deckAction`; a pair sits side by side instead.
 */
export function deckActions(pair = false) {
  return cn(
    "mx-auto grid min-h-20 w-full max-w-deck shrink-0",
    pair && "auto-cols-fr grid-flow-col gap-2"
  );
}
export const deckAction = "col-start-1 row-start-1 self-end";

/** How a card moves: thrown aside, waiting still under the top card, or dealt in. */
function cardMotion(thrown: "left" | "right" | null, waiting: boolean) {
  if (thrown) {
    return thrown === "left" ? "animate-throw-left" : "animate-throw-right";
  }
  return waiting ? "animate-none" : "animate-deal";
}

/** The answer side's content, laid over the card's grain. */
export const cardAnswer =
  "absolute inset-0 flex flex-col animate-answer @container-size motion-reduce:animate-none";
/** A sentence's answer, stacked on the centre. */
export const sentenceAnswer = cn(
  cardAnswer,
  "items-center justify-center gap-4 p-6 text-center"
);
/** A sentence on a card's face, as large as the card allows. */
export const cardSentence =
  "m-0 text-balance text-center font-hanzi text-sentence leading-tight";
/** A sentence's pinyin, as review always set it. */
export const cardReading = "m-0 type-pinyin text-xl";
/** The meaning on an answer, set as a lesson sets it. */
export const cardMeaning = cn(meaningText, "studio:text-3xl text-3xl");

/** A card's face: the front, the back, or a card lying on the table. */
const face =
  "absolute inset-0 z-5 flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-deck-edge bg-deck px-6 py-7 shadow-deck backface-hidden @container-size";

/**
 * The card's own dither: a faint grain at the bottom edge, gone by the top. A review card paints
 * it while it still waits under the top card, so it is there before the card ever moves.
 */
export function CardGrain({ color = "grey" }: { color?: DitherColor }) {
  return (
    <DitherGradient
      cell={3}
      direction="up"
      from={color}
      opacity={color === "grey" ? 0.12 : 0.18}
    />
  );
}

const suitMark =
  "absolute font-hanzi text-lg text-faint-foreground leading-none";

/** Corner marks, like a playing card's: what kind of card this is. */
function Suit({ suit }: { suit: CardSuit }) {
  return (
    <>
      <span aria-hidden="true" className={cn(suitMark, "top-3.5 left-4")}>
        {suits[suit]}
      </span>
      <span
        aria-hidden="true"
        className={cn(suitMark, "right-4 bottom-3.5 rotate-180")}
      >
        {suits[suit]}
      </span>
    </>
  );
}

/** The cards under the top one: up to four edges, fewer as the deck runs down. */
function Under({ count }: { count: number }) {
  const layers = count > 0 ? Math.min(4, 1 + Math.floor(count / 8)) : 0;
  return (
    <>
      {TILTS.slice(0, layers).map((tilt, index) => {
        // Each card lower is further down, further back and fainter.
        const layer = index + 1;
        return (
          <span
            aria-hidden="true"
            className="absolute inset-0 origin-bottom overflow-hidden rounded-2xl border border-deck-edge bg-deck-under shadow-deck-under"
            key={tilt}
            style={{
              zIndex: 4 - layer,
              opacity: 1 - layer * 0.16,
              transform: `translateY(${layer * 6}px) rotate(${tilt}deg)`,
            }}
          >
            <DitherGradient cell={3} density={0.1} from="grey" opacity={0.3} />
          </span>
        );
      })}
    </>
  );
}

/** Sizes the pile to real card proportions, as large as the room allows, with a caption under it. */
export function DeckTable({
  caption,
  children,
}: {
  caption?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="@container-size flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
      {children}
      <div className="type-label m-0 min-h-lh text-faint-foreground">
        {caption ?? " "}
      </div>
    </div>
  );
}

/**
 * A pile: `under` cards beneath whatever lies on top. Wide piles hold sentences. A playing card's
 * proportions where there is room; on a short screen it keeps its width and gets shorter. The
 * margin clears the pile's edges (four cards 6px apart) above the caption.
 */
export function DeckPile({
  under,
  wide = false,
  children,
}: {
  under: number;
  wide?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "perspective-deck relative mb-6 w-full flex-none",
        wide
          ? "aspect-7/5 max-h-pile-wide max-w-xl"
          : "aspect-5/7 max-h-pile max-w-96"
      )}
    >
      <Under count={under} />
      {children}
    </div>
  );
}

/**
 * A card on the pile: a prompt face and an answer face. The prompt face is the button that flips
 * it; `thrown` sends it off the pile to that side, and a thrown card (`ghost`) takes no input.
 * `waiting` holds the next card just under the top one, built and painted, so it can rise into
 * place without anything being drawn while it moves.
 */
export function DeckCard({
  suit,
  flipped,
  thrown = null,
  ghost = false,
  waiting = false,
  onFlip,
  onThrown,
  front,
  back,
}: {
  suit: CardSuit;
  flipped: boolean;
  thrown?: "left" | "right" | null;
  ghost?: boolean;
  waiting?: boolean;
  onFlip: () => void;
  /** Called once a throw has carried the card off. */
  onThrown?: () => void;
  front: ReactNode;
  back: ReactNode;
}) {
  const thrownEnd = useCallback(
    (event: AnimationEvent<HTMLDivElement>) => {
      // The faces' own fades bubble up here too; only the card's throw counts.
      if (event.target === event.currentTarget && thrown) {
        onThrown?.();
      }
    },
    [thrown, onThrown]
  );
  // A throw fades the faces, not the card: opacity on the card would flatten the flip and show the
  // front through the back.
  const fade = thrown && "animate-fade-out";
  return (
    <div
      aria-hidden={ghost || waiting || undefined}
      className={cn(
        "transform-3d absolute inset-0 z-5 transition-card motion-reduce:animate-none motion-reduce:transition-none",
        cardMotion(thrown, waiting),
        flipped ? "rotate-y-180" : "hover:-translate-y-1",
        // A thrown copy flies over the card dealt in under it and takes no input.
        ghost && "pointer-events-none z-6",
        // The next card, built and painted but unseen under the top one, so nothing shows through
        // while the top card turns; it appears as it rises. The pile's plain edges stand in for it.
        waiting && "invisible z-4 translate-y-1.5"
      )}
      data-flipped={flipped}
      data-ghost={ghost || undefined}
      data-waiting={waiting || undefined}
      inert={ghost || waiting || undefined}
      onAnimationEnd={thrownEnd}
      // Waiting, it lies like the card under it.
      style={waiting ? { rotate: `${TILTS[0]}deg` } : undefined}
    >
      <button
        aria-label="Show answer"
        className={cn(
          face,
          "focus-visible:border-blue focus-visible:outline-none",
          fade
        )}
        disabled={flipped}
        onClick={onFlip}
        type="button"
      >
        <CardGrain />
        <Suit suit={suit} />
        {front}
      </button>
      {/* The answer side's grain is painted with the card; its content comes when it turns. */}
      <div className={cn(face, "rotate-y-180", fade)}>
        <CardGrain />
        {flipped ? back : null}
      </div>
    </div>
  );
}

/** A card lying on the table's line under its figure. */
export const slotNote = "relative type-label text-muted-foreground";

/** A card lying on the table without a flip: face down with a timer, or the empty place. */
export function DeckSlot({
  state,
  children,
}: {
  state: "down" | "empty";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        face,
        "gap-2",
        state === "down"
          ? "bg-card before:pointer-events-none before:absolute before:inset-3 before:rounded-xl before:border before:border-foreground/8"
          : "border-border-strong border-dashed bg-transparent shadow-none"
      )}
    >
      {state === "down" ? <CardGrain color="orange" /> : null}
      {children}
    </div>
  );
}
