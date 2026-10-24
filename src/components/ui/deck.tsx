// Review and read are a deck of cards: the top card flips to its answer, a grade throws it away
// and the next one rises off the pile, which thins as the session runs down. The cards carry the
// dither; the page behind them stays plain.
import {
  type AnimationEvent,
  type CSSProperties,
  type ReactNode,
  useCallback,
} from "react";

import { DitherGradient } from "../dither-kit/gradient";
import type { DitherColor } from "../dither-kit/palette";

// A slight, fixed disorder so the pile reads as cards, not a box.
const TILTS = [-1.4, 1.1, -0.7, 0.5];

const suits = { character: "字", word: "词", sentence: "句" } as const;
export type CardSuit = keyof typeof suits;

/**
 * The card's own dither: a faint grain at the bottom edge, gone by the top. A review card paints
 * it while it still waits under the top card, so it is there before the card ever moves.
 */
export function CardGrain({ color = "grey" }: { color?: DitherColor }) {
  return (
    <DitherGradient
      cell={3}
      className="dx-deck-grain"
      direction="up"
      from={color}
      opacity={color === "grey" ? 0.12 : 0.18}
    />
  );
}

/** Corner marks, like a playing card's: what kind of card this is. */
function Suit({ suit }: { suit: CardSuit }) {
  return (
    <>
      <span aria-hidden="true" className="dx-deck-suit font-hanzi">
        {suits[suit]}
      </span>
      <span
        aria-hidden="true"
        className="dx-deck-suit dx-deck-suit-end font-hanzi"
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
      {TILTS.slice(0, layers).map((tilt, layer) => (
        <span
          aria-hidden="true"
          className="dx-deck-under"
          key={tilt}
          style={
            { "--layer": layer + 1, "--tilt": `${tilt}deg` } as CSSProperties
          }
        >
          <DitherGradient cell={3} density={0.1} from="grey" opacity={0.3} />
        </span>
      ))}
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
    <div className="dx-deck-table">
      {children}
      <div className="dx-deck-left">{caption ?? " "}</div>
    </div>
  );
}

/** A pile: `under` cards beneath whatever lies on top. Wide piles hold sentences. */
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
    <div className="dx-deck-pile" data-wide={wide}>
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
  return (
    <div
      aria-hidden={ghost || waiting || undefined}
      className="dx-deck-card"
      data-flipped={flipped}
      data-ghost={ghost || undefined}
      data-thrown={thrown ?? undefined}
      data-waiting={waiting || undefined}
      inert={ghost || waiting || undefined}
      onAnimationEnd={thrownEnd}
    >
      <button
        aria-label="Show answer"
        className="dx-deck-face dx-deck-front"
        disabled={flipped}
        onClick={onFlip}
        type="button"
      >
        <CardGrain />
        <Suit suit={suit} />
        {front}
      </button>
      {/* The answer side's grain is painted with the card; its content comes when it turns. */}
      <div className="dx-deck-face dx-deck-back">
        <CardGrain />
        {flipped ? back : null}
      </div>
    </div>
  );
}

/** A card lying on the table without a flip: face down with a timer, or the empty place. */
export function DeckSlot({
  state,
  children,
}: {
  state: "down" | "empty";
  children: ReactNode;
}) {
  return (
    <div className="dx-deck-face dx-deck-slot" data-state={state}>
      {state === "down" ? <CardGrain color="orange" /> : null}
      {children}
    </div>
  );
}
