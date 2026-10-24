// A review is the top card of a deck. The front asks; the back answers with its focus (big pinyin,
// the meaning, its other meanings) centred where the front's character stood, so the eye lands on
// the answer in the same place. A grade throws the card off the pile, then saves it. The reveal
// button and the grades share one slot, so revealing never moves anything.
import {
  type CSSProperties,
  type PointerEvent,
  useCallback,
  useEffect,
  useEffectEvent,
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
// Long enough to see the card leave, short enough not to wait on it; the save follows it.
// Matches the throw animation in dither.css.
const THROW_MS = 160;

type CharacterReview = Extract<ReviewItem, { type: "character" }>;
type Clue = ReturnType<typeof lessonClues>[number];

/** Each grade's wait, worked out once when the card appears. */
function useWaits(item: ReviewItem) {
  const [waits] = useState(() => {
    const now = new Date();
    const due = previewDue(toCard(item.card), now);
    return new Map(
      ratings.map(({ value }) => [value, waitLabel(now, due.get(value) ?? now)])
    );
  });
  return waits;
}

function RatingButton({
  rating,
  after,
  picked,
  pending,
  onRate,
  onTint,
}: {
  rating: (typeof ratings)[number];
  after: string;
  picked: boolean;
  pending: boolean;
  onRate: (rating: Grade) => void;
  onTint: (color: DitherColor | null) => void;
}) {
  const rate = useCallback(() => onRate(rating.value), [onRate, rating.value]);
  // Only a mouse tints the card: on touch the tap that grades would flash it as it is thrown.
  const tint = useCallback(
    (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        onTint(rating.color);
      }
    },
    [onTint, rating.color]
  );
  const untint = useCallback(() => onTint(null), [onTint]);
  // The wait sits above its button, so it reads as when the card returns, not as part of the name.
  return (
    <div className="dx-rate-slot">
      <em>{after}</em>
      <DitherButton
        bloom={picked ? "high" : "off"}
        className="dx-rate"
        color={rating.color}
        data-picked={picked}
        disabled={pending && !picked}
        onClick={rate}
        onPointerEnter={tint}
        onPointerLeave={untint}
        variant={picked ? "solid" : "dotted"}
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
/** A character's identity, as in its lesson: pinyin with its play button, the meaning, then its
 * other meanings. */
function CharacterFocus({ item }: { item: CharacterReview }) {
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
        <MoviePinyin
          actorKey={item.movie.actorKey}
          finalKey={item.movie.finalKey}
          pinyin={item.pinyin}
          tone={item.movie.tone}
        />
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
      <CharacterFocus item={item} />
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
  // A word answers as its lesson shows it: glossed where the front showed it, then its meaning.
  const meaning = getItemMeaning(item);
  return (
    <div className="dx-deck-answer dx-deck-answer-word">
      <WordGloss
        glosses={item.characterParts.map((part) => part.meaning)}
        hanzi={item.hanzi}
        revealed
        syllables={item.syllables ?? null}
      />
      <div className="dx-ident">
        <h2 className="dx-meaning">{meaning.primary}</h2>
        <p className="dx-alt">{meaning.also ? `also ${meaning.also}` : " "}</p>
        <div className="dx-sound">
          {item.syllables ? null : (
            <span className="dx-py dx-py-plain">{item.pinyin}</span>
          )}
          <AudioButton label="listen" pinyin={item.pinyin} text={item.hanzi} />
        </div>
      </div>
      {item.livingLink ? (
        <div className="dx-deck-edge">
          <p className="dx-deck-link">{item.livingLink}</p>
        </div>
      ) : null}
    </div>
  );
}

export function ReviewCard({
  item,
  remaining,
}: {
  item: ReviewItem;
  /** Cards left in the session, this one included. */
  remaining: number;
}) {
  const [startedAt] = useState(Date.now);
  const [revealed, setRevealed] = useState(false);
  const [thrown, setThrown] = useState<Grade | null>(null);
  const [tint, setTint] = useState<DitherColor | null>(null);
  const waits = useWaits(item);
  const mutation = useProgressMutation(saveReview);
  const { isPending, mutate } = mutation;
  // A failed save puts the card back so the grade can be tried again.
  const leaving = thrown !== null && !mutation.isError;
  const throwTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(throwTimer.current), []);
  const rate = useCallback(
    (rating: Grade) => {
      if (leaving || isPending) {
        return;
      }
      const durationMs = Math.min(
        3_600_000,
        Math.max(0, Date.now() - startedAt)
      );
      setThrown(rating);
      setTint(null);
      throwTimer.current = window.setTimeout(
        () =>
          mutate({ itemType: item.type, itemId: item.id, rating, durationMs }),
        THROW_MS
      );
    },
    [leaving, isPending, mutate, item.type, item.id, startedAt]
  );
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
  const reveal = useCallback(() => setRevealed(true), []);

  // Space or Enter reveals; 1–4 rates once the answer shows.
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
    if ((event.code === "Space" || event.key === "Enter") && !revealed) {
      event.preventDefault();
      setRevealed(true);
    } else if (revealed && RATING_KEY.test(event.key)) {
      rate(Number(event.key) as Grade);
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const clues = item.type === "character" ? lessonClues(item) : [];
  let thrownTo: "left" | "right" | null = null;
  if (thrown !== null && leaving) {
    thrownTo = thrown <= Rating.Hard ? "left" : "right";
  }

  return (
    <div className="dx-deck" data-revealed={revealed} data-type={item.type}>
      <DeckTable
        caption={
          <>
            <b>{remaining}</b> left
          </>
        }
      >
        <DeckPile under={remaining - 1}>
          <DeckCard
            back={<CardAnswer clues={clues} item={item} parts={parts} />}
            flipped={revealed}
            front={<CardFront clues={clues} item={item} />}
            onFlip={reveal}
            suit={item.type}
            thrown={thrownTo}
            tint={tint}
          />
        </DeckPile>
      </DeckTable>

      <footer className="dx-deck-actions">
        <DitherButton
          aria-hidden={revealed}
          className="dx-action"
          color="blue"
          inert={revealed}
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
              after={waits.get(rating.value) ?? ""}
              key={rating.value}
              onRate={rate}
              onTint={setTint}
              pending={leaving || isPending}
              picked={leaving && thrown === rating.value}
              rating={rating}
            />
          ))}
        </fieldset>
      </footer>
      {mutation.isError ? (
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
