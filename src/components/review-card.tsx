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
import { cn } from "../lib/utils";
import { saveReview } from "../offline/progress";
import { useProgressMutation } from "../offline/use-progress-mutation";
import { ClueCode } from "./character-studio/clue-code";
import { lessonClues } from "./character-studio/clues";
import { DitherButton } from "./dither-kit/button";
import type { DitherColor } from "./dither-kit/palette";
import { action, actionKey } from "./ui/buttons";
import {
  cardAnswer,
  cardMeaning,
  cardReading,
  cardSentence,
  DeckCard,
  DeckPile,
  DeckTable,
  deck,
  deckAction,
  deckActions,
  sentenceAnswer,
} from "./ui/deck";
import {
  AudioButton,
  altText,
  glyphBox,
  HanziGlyph,
  ident,
  MoviePinyin,
  pinyinText,
} from "./ui/hanzi";
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

// Quieter dots than an action's. The names hold one line across the row, even where a note wraps
// to two: the kit's content fills the button and starts at a fixed line.
const rateButton =
  "h-14 rounded-lg p-0 focus-visible:outline-solid *:first:opacity-45 *:last:absolute *:last:inset-0 *:last:grid *:last:content-start *:last:justify-center *:last:justify-items-center *:last:gap-1 *:last:pt-3.5";

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
    <div className="grid min-w-0 gap-2">
      <em className="type-micro text-center text-muted-foreground tabular-nums">
        {after}
      </em>
      <DitherButton
        className={rateButton}
        color={rating.color}
        onClick={rate}
        variant="dotted"
      >
        <span className="type-action">{rating.label}</span>
        <small className="type-micro text-balance px-1 text-center leading-tight opacity-80">
          {rating.note}
        </small>
        <kbd className="absolute top-1.5 right-2">{rating.value}</kbd>
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
      className="inline-flex h-full items-center gap-2"
      onClick={select}
      onPointerEnter={enter}
      onPointerLeave={leave}
      type="button"
    >
      <b className={cn(chipCode, chipHanzi, "text-part")}>
        <ClueCode clue={clue} />
      </b>
      {clue.name || "—"}
    </button>
  );
}

/** A row of chips along a card's bottom edge; smaller on a short card. */
const sceneChips = "m-0 flex list-none flex-wrap justify-center gap-2 p-0";
const sceneChip =
  "inline-flex h-8 items-center gap-2 rounded-md border border-border bg-deck pr-2.5 pl-2 type-body text-base card-short:h-7 card-short:text-sm";
/** A tone contour as a chip's code. */
const chipTone = "h-3.5 w-5 align-middle";
/** A chip's code, in its kind's colour. */
const chipCode = "type-code text-md";
/** A code that is a character. */
const chipHanzi = "font-hanzi-props text-xl font-normal";
const kindColors: Record<Clue["kind"], string> = {
  actor: "text-blue",
  set: "text-purple",
  room: "text-green",
  prop: "text-part",
};

/** The clues as chips; a prop's chip lights its part of the character. */
function SceneChips({ clues, parts }: { clues: Clue[]; parts: PartPointer }) {
  return (
    <ul className={sceneChips}>
      {clues.map((clue) => (
        <li
          className={cn(
            sceneChip,
            clue.kind === "prop" &&
              parts.highlighted === clue.code &&
              "border-part"
          )}
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
              <b className={cn(chipCode, kindColors[clue.kind])}>
                <ClueCode clue={clue} toneClassName={chipTone} />
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
      <div className={cn(glyphBox, "glyph-max-75 relative h-full")}>
        <HanziGlyph concealed hanzi={item.hanzi} parts={propCodes(clues)} />
      </div>
    );
  }
  if (item.type === "word") {
    return (
      <WordGloss
        className="relative"
        glosses={item.characterParts.map((part) => part.meaning)}
        hanzi={item.hanzi}
        hanziClassName="text-gloss-card"
        revealed={false}
        syllables={item.syllables ?? null}
      />
    );
  }
  return (
    <div className="relative grid justify-items-center gap-4 text-center">
      <p className="type-label m-0 text-muted-foreground">say it in mandarin</p>
      <p className="type-display m-0 text-balance">{item.meaning}</p>
    </div>
  );
}

// Pinyin set as a lesson sets it. Geist Mono centres its line box on capitals; pinyin is
// lowercase, so it rises by the gap to sit level with its play button.
const focusPinyin = "text-2xl studio:text-3xl -translate-y-[0.08em]";

/** Where an answer's corner, centre and edge sit: a card's inset, smaller on a short card. */
const answerIndex =
  "absolute top-6 left-6 card-short:top-4 card-short:left-4 card-short:size-11";
const answerEdge =
  "absolute right-6 bottom-6 left-6 border-deck-edge border-t pt-4 card-short:static card-short:mx-4 card-short:mt-auto card-short:mb-4 card-short:pt-2";

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
    <div
      className={cn(
        ident,
        "card-short:translate-none card-short:static absolute top-1/2 right-6 left-6 -translate-y-1/2 gap-2 card-short:px-16 card-short:pt-4"
      )}
    >
      <div className="inline-flex items-center gap-2">
        {item.type === "character" ? (
          <MoviePinyin
            actorKey={item.movie.actorKey}
            className={focusPinyin}
            finalKey={item.movie.finalKey}
            pinyin={item.pinyin}
            tone={item.movie.tone}
          />
        ) : (
          <span className={cn(pinyinText, focusPinyin, "text-foreground")}>
            {item.pinyin}
          </span>
        )}
        <AudioButton pinyin={item.pinyin} text={item.hanzi} />
      </div>
      <h2 className={cardMeaning}>{meaning.primary}</h2>
      <p
        // Below the side-by-side layout it may wrap to two lines; on a short phone it gives way.
        className={cn(
          altText,
          "max-studio:short:hidden max-studio:h-auto max-studio:max-h-10 max-studio:whitespace-normal"
        )}
      >
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
    <div className={cardAnswer} data-answer>
      {/* Every part in its colour, until one is pointed at. */}
      <div className={cn(glyphBox, answerIndex, "size-16")}>
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
      <div className={answerEdge}>
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
      <div className={sentenceAnswer} data-answer>
        <p className={cardSentence} lang="zh-CN">
          {item.hanzi}
        </p>
        <p className={cardReading}>{item.pinyin}</p>
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
    <div className={cardAnswer} data-answer>
      {/* A word in the corner, where a character's lit glyph sits. */}
      <span
        className={cn(answerIndex, "font-hanzi text-3xl leading-none")}
        lang="zh-CN"
      >
        {item.hanzi}
      </span>
      <Focus item={item} />
      <div className={answerEdge}>
        {item.livingLink ? (
          <p className="type-body m-0 text-center text-muted-foreground">
            {item.livingLink}
          </p>
        ) : null}
        <ul className={cn(sceneChips, item.livingLink && "mt-2")}>
          {made.map((part) => (
            <li className={sceneChip} key={part.position}>
              <b
                className={cn(chipCode, chipHanzi, "text-foreground")}
                lang="zh-CN"
              >
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
      className={deck}
      data-revealed={revealed}
      data-type={active?.type ?? "empty"}
    >
      <DeckTable
        caption={
          active ? (
            <>
              <b className="font-medium text-muted-foreground">
                {queue.length}
              </b>{" "}
              left
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

      <footer className={deckActions()}>
        <DitherButton
          aria-hidden={revealed || !active}
          className={cn(
            action,
            deckAction,
            "h-14",
            (revealed || !active) && "invisible"
          )}
          color="blue"
          inert={revealed || !active}
          onClick={reveal}
          variant="gradient"
        >
          <span>show answer</span>
          <kbd className={actionKey}>space</kbd>
        </DitherButton>
        <fieldset
          aria-hidden={!revealed}
          aria-label="How well did you recall it?"
          className={cn(
            deckAction,
            "grid min-w-0 grid-cols-4 gap-2",
            !revealed && "invisible"
          )}
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
        <p
          className="type-label m-0 text-center text-red leading-wrap"
          role="alert"
        >
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
  className,
  hanziClassName,
}: {
  hanzi: string;
  syllables: string[] | null;
  glosses: string[];
  revealed: boolean;
  className?: string;
  /** Sizes the characters where the gloss sits somewhere other than a lesson. */
  hanziClassName?: string;
}) {
  // A character can repeat (谢谢), so columns are keyed by their fixed position.
  const columns = Array.from(hanzi, (char, position) => ({
    char,
    position,
    syllable: syllables?.[position],
    gloss: glosses[position] ?? "",
  }));
  return (
    <div
      className={cn("flex shrink-0 justify-center gap-gloss", className)}
      lang="zh-CN"
    >
      {columns.map(({ char, position, syllable, gloss }) => (
        <div
          className="grid min-w-0 content-start justify-items-center gap-1"
          key={position}
        >
          {/* Syllables and keywords hold their space before the reveal. */}
          <span
            aria-hidden={!revealed}
            className={cn(
              "type-pinyin inline-flex h-7 items-center gap-1 whitespace-nowrap text-xl tracking-snug transition duration-200 ease-out",
              !revealed && "translate-y-1.5 opacity-0"
            )}
            lang="zh-Latn"
          >
            {syllable || " "}
          </span>
          <span
            // The leading comes after a size passed in, which would otherwise drop it.
            className={cn(
              "font-hanzi text-gloss",
              hanziClassName,
              "leading-none"
            )}
          >
            {char}
          </span>
          <span
            aria-hidden={!revealed}
            className={cn(
              "type-body line-clamp-2 min-h-5 max-w-32 text-center text-muted-foreground leading-tight transition duration-200 ease-out",
              !revealed && "-translate-y-1.5 opacity-0"
            )}
            lang="en"
          >
            {columns.length > 1 ? gloss : " "}
          </span>
        </div>
      ))}
    </div>
  );
}
