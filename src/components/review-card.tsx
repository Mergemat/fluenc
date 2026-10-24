// A review is the top card of a deck. The front asks; the back answers with its focus (big pinyin,
// the meaning, its other meanings) centred where the front's character stood, so the eye lands on
// the answer in the same place. A grade throws that same card off the pile while the next deals
// in, and saves in the background. The pile and the buttons stay put for the whole session, so a
// grade only builds the new top card. The reveal button and the grades share one slot, so
// revealing never moves anything.
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Grade, Rating } from "ts-fsrs";
import { toCard } from "../lib/learner-state";
import type { ReviewItem } from "../lib/learner-views";
import { getItemMeaning } from "../lib/meaning";
import { previewDue, waitLabel } from "../lib/review-schedule";
import { saveReview } from "../offline/progress";
import { useProgressMutation } from "../offline/use-progress-mutation";
import { ClueCode } from "./character-studio/clue-code";
import { lessonClues } from "./character-studio/clues";
import { DitherButton } from "./dither-kit/button";
import type { DitherColor } from "./dither-kit/palette";
import { DeckCard, DeckPile, DeckTable } from "./ui/deck";
import { AudioButton, HanziGlyph, MoviePinyin } from "./ui/hanzi";
import { partColor } from "./ui/part-colors";

const ratings: {
  value: Grade;
  label: string;
  note: string;
  color: DitherColor;
}[] = [
  { value: Rating.Again, label: "again", note: "missed", color: "red" },
  { value: Rating.Hard, label: "hard", note: "with effort", color: "orange" },
  { value: Rating.Good, label: "good", note: "small pause", color: "blue" },
  { value: Rating.Easy, label: "easy", note: "instant", color: "green" },
];

const RATING_KEY = /^[1-4]$/;

type CharacterReview = Extract<ReviewItem, { type: "character" }>;
type Clue = ReturnType<typeof lessonClues>[number];

/** Each grade's wait for a card, worked out when it comes to the top. */
function waitsFor(item: ReviewItem) {
  const now = new Date();
  const due = previewDue(toCard(item.card), now);
  return new Map(
    ratings.map(({ value }) => [value, waitLabel(now, due.get(value) ?? now)])
  );
}

function RatingButton({
  rating,
  after,
  onRate,
}: {
  rating: (typeof ratings)[number];
  after: string;
  onRate: (rating: Grade) => void;
}) {
  const rate = useCallback(() => onRate(rating.value), [onRate, rating.value]);
  // The wait sits above its button, so it reads as when the card returns, not as part of the name.
  return (
    <div className="dx-rate-slot">
      <em>{after}</em>
      <DitherButton
        className="dx-rate"
        color={rating.color}
        onClick={rate}
        variant="dotted"
      >
        <span>{rating.label}</span>
        <small>{rating.note}</small>
        <kbd>{rating.value}</kbd>
      </DitherButton>
    </div>
  );
}

interface PartPointer {
  highlighted: string | null;
  onHover: (code: string | null) => void;
  onSelect: (code: string) => void;
}

function PropChip({ clue, parts }: { clue: Clue; parts: PartPointer }) {
  const { onHover, onSelect } = parts;
  const enter = useCallback(() => onHover(clue.code), [onHover, clue.code]);
  const leave = useCallback(() => onHover(null), [onHover]);
  const select = useCallback(() => onSelect(clue.code), [onSelect, clue.code]);
  return (
    <button
      aria-pressed={parts.highlighted === clue.code}
      onClick={select}
      onPointerEnter={enter}
      onPointerLeave={leave}
      type="button"
    >
      <b className="font-hanzi-props">
        <ClueCode clue={clue} />
      </b>
      {clue.name || "—"}
    </button>
  );
}

/** The clues as chips; a prop's chip lights its part of the character. */
function SceneChips({ clues, parts }: { clues: Clue[]; parts: PartPointer }) {
  return (
    <ul className="dx-scene-chips">
      {clues.map((clue) => (
        <li
          data-kind={clue.kind}
          key={clue.id}
          style={
            clue.kind === "prop"
              ? ({ "--part": partColor(clue.partIndex) } as CSSProperties)
              : undefined
          }
        >
          {clue.kind === "prop" ? (
            <PropChip clue={clue} parts={parts} />
          ) : (
            <>
              <b>
                <ClueCode clue={clue} />
              </b>
              {clue.name || "—"}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

const propCodes = (clues: Clue[]) =>
  clues.filter((clue) => clue.kind === "prop").map((clue) => clue.code);

/** What is asked: the character, the word glossed, or the sentence's meaning. */
function CardFront({ item, clues }: { item: ReviewItem; clues: Clue[] }) {
  if (item.type === "character") {
    return (
      <div className="dx-glyph-box dx-deck-glyph">
        <HanziGlyph concealed hanzi={item.hanzi} parts={propCodes(clues)} />
      </div>
    );
  }
  if (item.type === "word") {
    return (
      <WordGloss
        glosses={item.characterParts.map((part) => part.meaning)}
        hanzi={item.hanzi}
        revealed={false}
        syllables={item.syllables ?? null}
      />
    );
  }
  return (
    <div className="dx-deck-prompt">
      <p className="dx-deck-cue">say it in mandarin</p>
      <p className="dx-deck-question">{item.meaning}</p>
    </div>
  );
}

/** Big pinyin, the meaning, then its other meanings, each said once. */
/**
 * A character's or word's identity, as in its lesson: pinyin with its play button, the meaning,
 * then its other meanings. Centred where the front showed the character or word.
 */
function Focus({ item }: { item: Exclude<ReviewItem, { type: "sentence" }> }) {
  const meaning = getItemMeaning(item);
  const others = [
    ...new Set([
      ...(meaning.also ? [meaning.also] : []),
      ...meaning.alternatives,
    ]),
  ].slice(0, 3);
  return (
    <div className="dx-ident dx-deck-focus">
      <div className="dx-sound">
        {item.type === "character" ? (
          <MoviePinyin
            actorKey={item.movie.actorKey}
            finalKey={item.movie.finalKey}
            pinyin={item.pinyin}
            tone={item.movie.tone}
          />
        ) : (
          <span className="dx-py dx-py-plain">{item.pinyin}</span>
        )}
        <AudioButton pinyin={item.pinyin} text={item.hanzi} />
      </div>
      <h2 className="dx-meaning">{meaning.primary}</h2>
      <p className="dx-alt">
        {others.length ? `also ${others.join(" · ")}` : " "}
      </p>
    </div>
  );
}

function CharacterAnswer({
  item,
  clues,
  parts,
}: {
  item: CharacterReview;
  clues: Clue[];
  parts: PartPointer;
}) {
  return (
    <div className="dx-deck-answer">
      {/* Every part in its colour, until one is pointed at. */}
      <div className="dx-glyph-box dx-deck-index">
        <HanziGlyph
          hanzi={item.hanzi}
          highlighted={parts.highlighted}
          onHover={parts.onHover}
          onSelect={parts.onSelect}
          parts={propCodes(clues)}
          xray={!parts.highlighted}
        />
      </div>
      <Focus item={item} />
      <div className="dx-deck-edge">
        <SceneChips clues={clues} parts={parts} />
      </div>
    </div>
  );
}

function CardAnswer({
  item,
  clues,
  parts,
}: {
  item: ReviewItem;
  clues: Clue[];
  parts: PartPointer;
}) {
  if (item.type === "character") {
    return <CharacterAnswer clues={clues} item={item} parts={parts} />;
  }
  if (item.type === "sentence") {
    return (
      <div className="dx-deck-answer dx-deck-answer-sentence">
        <p className="dx-deck-sentence font-hanzi" lang="zh-CN">
          {item.hanzi}
        </p>
        <p className="dx-deck-reading">{item.pinyin}</p>
        <AudioButton label="listen" pinyin={item.pinyin} text={item.hanzi} />
      </div>
    );
  }
  // A word answers like a character: itself in the corner, its identity centred, and the
  // characters it is made of along the bottom. A character can repeat (谢谢), so each is keyed by
  // its fixed position.
  const made = item.characterParts.map((part, position) => ({
    ...part,
    position,
  }));
  return (
    <div className="dx-deck-answer">
      <span
        className="dx-deck-index dx-deck-index-word font-hanzi"
        lang="zh-CN"
      >
        {item.hanzi}
      </span>
      <Focus item={item} />
      <div className="dx-deck-edge">
        {item.livingLink ? (
          <p className="dx-deck-link">{item.livingLink}</p>
        ) : null}
        <ul className="dx-scene-chips">
          {made.map((part) => (
            <li data-kind="character" key={part.position}>
              <b className="font-hanzi-props" lang="zh-CN">
                {part.hanzi}
              </b>
              {part.meaning}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export const cardKey = (item: ReviewItem) =>
  `${item.type}:${item.id}:${item.reps}`;

/** Which way a grade throws its card: misses to the left, recalls to the right. */
const throwSide = (rating: Grade) => (rating <= Rating.Hard ? "left" : "right");

// A thrown card goes when its throw ends; this only clears it where no animation runs.
const THROWN_FALLBACK_MS = 600;
// A save recomputes the whole dashboard, and the card after next paints its dither, so both wait
// until the throw and the rise (180ms) are over.
const SETTLE_MS = 200;

/** One card on the pile: the one being answered, the next one under it, or one flying off. */
function PileCard({
  item,
  revealed,
  side,
  waiting,
  onFlip,
  onGone,
}: {
  item: ReviewItem;
  revealed: boolean;
  side: "left" | "right" | null;
  /** The next card, built and painted under the top one. */
  waiting: boolean;
  onFlip: () => void;
  onGone: (key: string) => void;
}) {
  // A part lights while the pointer is on it or its chip; a tap keeps it lit.
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const select = useCallback(
    (code: string) =>
      setPinned((previous) => (previous === code ? null : code)),
    []
  );
  const parts: PartPointer = {
    highlighted: revealed ? (hover ?? pinned) : null,
    onHover: setHover,
    onSelect: select,
  };
  const key = cardKey(item);
  const gone = useCallback(() => onGone(key), [onGone, key]);
  const clues = useMemo(
    () => (item.type === "character" ? lessonClues(item) : []),
    [item]
  );
  return (
    <DeckCard
      back={<CardAnswer clues={clues} item={item} parts={parts} />}
      flipped={revealed}
      front={<CardFront clues={clues} item={item} />}
      ghost={side !== null}
      onFlip={onFlip}
      onThrown={gone}
      suit={item.type}
      thrown={side}
      waiting={waiting}
    />
  );
}

interface Leaving {
  item: ReviewItem;
  side: "left" | "right";
}

/**
 * Grading: a grade takes the card out of the queue at once and saves it once the throw is over; a
 * save that fails puts it back. The graded card stays on the pile, thrown, until its throw ends.
 */
function useGrading(onRestore: (item: ReviewItem) => void) {
  const { mutateAsync } = useProgressMutation(saveReview);
  const [graded, setGraded] = useState<ReadonlySet<string>>(() => new Set());
  const [leaving, setLeaving] = useState<Leaving[]>([]);
  const [failed, setFailed] = useState(false);
  // False while a throw and a rise are under way.
  const [settled, setSettled] = useState(true);
  const timers = useRef(new Set<number>());
  // Saves waiting for their throw to end; leaving the page runs them at once, so none is lost.
  const saves = useRef(new Map<number, () => void>());
  useEffect(() => {
    const pending = timers.current;
    const waiting = saves.current;
    return () => {
      for (const timer of pending) {
        window.clearTimeout(timer);
      }
      for (const [timer, save] of waiting) {
        window.clearTimeout(timer);
        save();
      }
    };
  }, []);
  const gone = useCallback(
    (key: string) =>
      setLeaving((previous) =>
        previous.filter((card) => cardKey(card.item) !== key)
      ),
    []
  );
  const grade = useCallback(
    (item: ReviewItem, rating: Grade, durationMs: number) => {
      const key = cardKey(item);
      setGraded((previous) => new Set(previous).add(key));
      setLeaving((previous) => [
        ...previous,
        { item, side: throwSide(rating) },
      ]);
      setFailed(false);
      setSettled(false);
      const timer = window.setTimeout(() => {
        timers.current.delete(timer);
        gone(key);
      }, THROWN_FALLBACK_MS);
      timers.current.add(timer);
      const settle = window.setTimeout(() => {
        timers.current.delete(settle);
        setSettled(true);
      }, SETTLE_MS);
      timers.current.add(settle);
      const save = () =>
        mutateAsync({
          itemType: item.type,
          itemId: item.id,
          rating,
          durationMs,
        }).catch(() => {
          gone(key);
          setGraded((previous) => {
            const next = new Set(previous);
            next.delete(key);
            return next;
          });
          setFailed(true);
          onRestore(item);
        });
      const saveTimer = window.setTimeout(() => {
        saves.current.delete(saveTimer);
        save();
      }, SETTLE_MS);
      saves.current.set(saveTimer, save);
    },
    [mutateAsync, gone, onRestore]
  );
  return { graded, leaving, failed, settled, grade, gone };
}

/**
 * The review deck. `done` shows once nothing is left to answer, saving or flying off.
 */
export function ReviewDeck({
  queue: due,
  done,
}: {
  queue: ReviewItem[];
  done: ReactNode;
}) {
  const [selected, setSelected] = useState(() => due[0]);
  // A card whose save failed comes back to the top, where its error is.
  const { graded, leaving, failed, settled, grade, gone } =
    useGrading(setSelected);
  // Graded cards wait for their save outside the queue.
  const queue = due.filter((item) => !graded.has(cardKey(item)));
  // A learning step becoming due must not replace the card being answered.
  const active =
    queue.find(
      (item) =>
        item.type === selected?.type &&
        item.id === selected.id &&
        item.reps === selected.reps
    ) ?? queue[0];
  if (
    active?.type !== selected?.type ||
    active?.id !== selected?.id ||
    active?.reps !== selected?.reps
  ) {
    setSelected(active);
  }
  const activeKey = active ? cardKey(active) : null;

  // Per top card: when it showed (for the review's duration), whether it is turned, its waits.
  const [shown, setShown] = useState(() => ({
    key: activeKey,
    at: Date.now(),
  }));
  if (shown.key !== activeKey) {
    setShown({ key: activeKey, at: Date.now() });
  }
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const revealed = activeKey !== null && revealedKey === activeKey;
  const waits = useMemo(() => (active ? waitsFor(active) : null), [active]);

  const reveal = useCallback(() => setRevealedKey(activeKey), [activeKey]);
  const rate = useCallback(
    (rating: Grade) => {
      if (!active) {
        return;
      }
      grade(
        active,
        rating,
        Math.min(3_600_000, Math.max(0, Date.now() - shown.at))
      );
    },
    [active, grade, shown.at]
  );

  // Space or Enter reveals; 1–4 rates once the answer shows.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (
      !active ||
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return;
    }
    if (
      event.target instanceof Element &&
      event.target.closest("input, textarea, button, a, [role=dialog]")
    ) {
      return;
    }
    if ((event.code === "Space" || event.key === "Enter") && !revealed) {
      event.preventDefault();
      reveal();
    } else if (revealed && RATING_KEY.test(event.key)) {
      rate(Number(event.key) as Grade);
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const saving = queue.length < due.length;
  if (!(active || saving || leaving.length)) {
    return done;
  }

  // The next card waits built under the top one, so it rises into place without being drawn; the
  // card after it is only built once the motion is over. Keys stay the same from waiting to top
  // to thrown, so every step moves the same card.
  const next = queue.find((item) => cardKey(item) !== activeKey);
  const waitingNext = settled && next ? next : null;
  const cards = [
    ...(waitingNext ? [{ item: waitingNext, side: null, waiting: true }] : []),
    ...(active ? [{ item: active, side: null, waiting: false }] : []),
    ...leaving.map((card) => ({ ...card, waiting: false })),
  ];
  return (
    <div
      className="dx-deck"
      data-revealed={revealed}
      data-type={active?.type ?? "empty"}
    >
      <DeckTable
        caption={
          active ? (
            <>
              <b>{queue.length}</b> left
            </>
          ) : null
        }
      >
        <DeckPile under={queue.length - 1}>
          {cards.map((card) => (
            <PileCard
              item={card.item}
              key={cardKey(card.item)}
              onFlip={reveal}
              onGone={gone}
              // A thrown card stays on its answer; the waiting one stays on its front, so it rises
              // without turning.
              revealed={card.side !== null || (!card.waiting && revealed)}
              side={card.side}
              waiting={card.waiting}
            />
          ))}
        </DeckPile>
      </DeckTable>

      <footer className="dx-deck-actions">
        <DitherButton
          aria-hidden={revealed || !active}
          className="dx-action"
          color="blue"
          inert={revealed || !active}
          onClick={reveal}
          variant="gradient"
        >
          <span>show answer</span>
          <kbd>space</kbd>
        </DitherButton>
        <fieldset
          aria-hidden={!revealed}
          aria-label="How well did you recall it?"
          className="dx-ratings dx-group"
          inert={!revealed}
        >
          {ratings.map((rating) => (
            <RatingButton
              after={waits?.get(rating.value) ?? ""}
              key={rating.value}
              onRate={rate}
              rating={rating}
            />
          ))}
        </fieldset>
      </footer>
      {failed ? (
        <p className="dx-deck-error" role="alert">
          could not save this review — try again
        </p>
      ) : null}
    </div>
  );
}

/** A word glossed interlinearly: each character with its syllable above and its keyword below. */
export function WordGloss({
  hanzi,
  syllables,
  glosses,
  revealed,
}: {
  hanzi: string;
  syllables: string[] | null;
  glosses: string[];
  revealed: boolean;
}) {
  // A character can repeat (谢谢), so columns are keyed by their fixed position.
  const columns = Array.from(hanzi, (char, position) => ({
    char,
    position,
    syllable: syllables?.[position],
    gloss: glosses[position] ?? "",
  }));
  return (
    <div className="dx-gloss" data-revealed={revealed} lang="zh-CN">
      {columns.map(({ char, position, syllable, gloss }) => (
        <div className="dx-gloss-col" key={position}>
          <span aria-hidden={!revealed} className="dx-gloss-py" lang="zh-Latn">
            {syllable || " "}
          </span>
          <span className="dx-gloss-hanzi font-hanzi">{char}</span>
          <span aria-hidden={!revealed} className="dx-gloss-en" lang="en">
            {columns.length > 1 ? gloss : " "}
          </span>
        </div>
      ))}
    </div>
  );
}
