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

/** The card's own dither: a faint grain at the bottom edge, gone by the top. */
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

/**
 * A pile: `under` cards beneath whatever lies on top, and `over` it the cards still flying off.
 * Wide piles hold sentences.
 */
export function DeckPile({
  under,
  wide = false,
  over = null,
  children,
}: {
  under: number;
  wide?: boolean;
  over?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="dx-deck-pile" data-wide={wide}>
      <Under count={under} />
      {children}
      {over}
    </div>
  );
}

/**
 * The top card: a prompt face and an answer face. The prompt face is the button that flips it;
 * `thrown` sends the card off the pile to that side. A `ghost` is a copy only to be seen leaving.
 */
export function DeckCard({
  suit,
  flipped,
  thrown = null,
  tint = null,
  ghost = false,
  onFlip,
  onThrown,
  front,
  back,
}: {
  suit: CardSuit;
  flipped: boolean;
  thrown?: "left" | "right" | null;
  tint?: DitherColor | null;
  ghost?: boolean;
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
      aria-hidden={ghost || undefined}
      className="dx-deck-card"
      data-flipped={flipped}
      data-ghost={ghost || undefined}
      data-thrown={thrown ?? undefined}
      inert={ghost || undefined}
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
      <div className="dx-deck-face dx-deck-back">
        <CardGrain color={tint ?? "grey"} />
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
