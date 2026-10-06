// Prompt and answer share one fixed footprint (the answer replaces placeholder bars of the same
// height), and the reveal button and ratings share one slot, so revealing never moves anything.
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { Rating } from "ts-fsrs";
import type { ReviewItem } from "../lib/learner-views";
import { getItemMeaning } from "../lib/meaning";
import { getMovieCoordinates } from "../lib/pinyin";
import { saveReview } from "../offline/progress";
import { useProgressMutation } from "../offline/use-progress-mutation";
import { ClueCode } from "./character-studio/clue-code";
import { lessonClues } from "./character-studio/clues";
import { DitherButton } from "./dither-kit/button";
import { DitherGradient } from "./dither-kit/gradient";
import type { DitherColor } from "./dither-kit/palette";
import { AudioButton, HanziGlyph, MoviePinyin, ToneContour } from "./ui/hanzi";
import { partColor } from "./ui/part-colors";

const ratings: {
  value: number;
  label: string;
  note: string;
  color: DitherColor;
}[] = [
  { value: Rating.Again, label: "again", note: "missed a part", color: "red" },
  { value: Rating.Hard, label: "hard", note: "with effort", color: "orange" },
  { value: Rating.Good, label: "good", note: "small pause", color: "blue" },
  { value: Rating.Easy, label: "easy", note: "instant", color: "green" },
];

const RATING_KEY = /^[1-4]$/;

const ghostLabels: Record<ReviewItem["type"], string[]> = {
  character: ["meaning", "sound", "scene"],
  word: ["meaning", "use"],
  sentence: ["hanzi", "sound"],
};

type CharacterReview = Extract<ReviewItem, { type: "character" }>;
type WordReview = Extract<ReviewItem, { type: "word" }>;
type Clue = ReturnType<typeof lessonClues>[number];

function RatingButton({
  rating,
  picked,
  pending,
  onRate,
}: {
  rating: (typeof ratings)[number];
  picked: boolean;
  pending: boolean;
  onRate: (rating: number) => void;
}) {
  const rate = useCallback(() => onRate(rating.value), [onRate, rating.value]);
  return (
    <DitherButton
      bloom={picked ? "high" : "off"}
      className="dx-rate"
      color={rating.color}
      data-picked={picked}
      disabled={pending && !picked}
      onClick={rate}
      variant={picked ? "solid" : "dotted"}
    >
      <span>{rating.label}</span>
      <small>{rating.note}</small>
      <kbd>{rating.value}</kbd>
    </DitherButton>
  );
}

/** Placeholder bars, one per part of the answer, holding its place until it shows. */
export function AnswerGhost({ labels }: { labels: string[] }) {
  return (
    <div aria-hidden="true" className="dx-answer-ghost">
      {labels.map((label) => (
        <div key={label}>
          <span>{label}</span>
          <i>
            <DitherGradient
              cell={2}
              direction="right"
              from="grey"
              opacity={0.7}
            />
          </i>
        </div>
      ))}
    </div>
  );
}

function SceneChips({ clues }: { clues: Clue[] }) {
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
          <b className={clue.kind === "prop" ? "font-hanzi-props" : ""}>
            <ClueCode clue={clue} />
          </b>
          {clue.name || "—"}
        </li>
      ))}
    </ul>
  );
}

function CharacterAnswer({
  item,
  also,
  clues,
}: {
  item: CharacterReview;
  also: string | null;
  clues: Clue[];
}) {
  return (
    <>
      {also ? <p className="dx-alt">also {also}</p> : null}
      <div className="dx-sound">
        <MoviePinyin
          actorKey={item.movie.actorKey}
          finalKey={item.movie.finalKey}
          pinyin={item.pinyin}
          tone={item.movie.tone}
        />
        <AudioButton pinyin={item.pinyin} text={item.hanzi} />
      </div>
      <SceneChips clues={clues} />
    </>
  );
}

function WordAnswer({ item, also }: { item: WordReview; also: string | null }) {
  return (
    <>
      {item.livingLink ? (
        <p className="dx-link">{item.livingLink}</p>
      ) : (
        <p className="dx-alt">{also ?? " "}</p>
      )}
      {item.syllables ? null : <p className="dx-word-reading">{item.pinyin}</p>}
      <AudioButton label="listen" pinyin={item.pinyin} text={item.hanzi} />
    </>
  );
}

/** What is asked: the character, the word glossed, or the sentence's meaning. */
function ReviewPrompt({
  item,
  clues,
  revealed,
}: {
  item: ReviewItem;
  clues: Clue[];
  revealed: boolean;
}) {
  if (item.type === "character") {
    return (
      <div className="dx-glyph-box">
        <HanziGlyph
          concealed={!revealed}
          hanzi={item.hanzi}
          parts={clues.map((prop) => prop.code)}
          xray={revealed}
        />
      </div>
    );
  }
  if (item.type === "word") {
    return (
      <WordGloss
        glosses={item.characterParts.map((part) => part.meaning)}
        hanzi={item.hanzi}
        revealed={revealed}
        syllables={item.syllables ?? null}
      />
    );
  }
  return (
    <div className="dx-sentence-prompt">
      <p className="dx-sentence-cue">say it in mandarin</p>
      <p className="dx-sentence-meaning">{item.meaning}</p>
    </div>
  );
}

function ReviewAnswer({ item, clues }: { item: ReviewItem; clues: Clue[] }) {
  if (item.type === "sentence") {
    return (
      <>
        <p className="dx-sentence font-hanzi" lang="zh-CN">
          {item.hanzi}
        </p>
        <p className="dx-word-reading">{item.pinyin}</p>
        <AudioButton label="listen" pinyin={item.pinyin} text={item.hanzi} />
      </>
    );
  }
  const meaning = getItemMeaning(item);
  return (
    <>
      <h2 className="dx-meaning">{meaning.primary}</h2>
      {item.type === "character" ? (
        <CharacterAnswer also={meaning.also} clues={clues} item={item} />
      ) : (
        <WordAnswer also={meaning.also} item={item} />
      )}
    </>
  );
}

export function ReviewCard({ item }: { item: ReviewItem }) {
  const [startedAt] = useState(Date.now);
  const [revealed, setRevealed] = useState(false);
  const mutation = useProgressMutation(saveReview);
  const { isPending, mutate } = mutation;
  const rate = useCallback(
    (rating: number) => {
      if (isPending) {
        return;
      }
      mutate({
        itemType: item.type,
        itemId: item.id,
        rating,
        durationMs: Math.min(3_600_000, Math.max(0, Date.now() - startedAt)),
      });
    },
    [isPending, mutate, item.type, item.id, startedAt]
  );
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
      rate(Number(event.key));
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const error = mutation.isError ? (
    <p className="dx-review-error" role="alert">
      could not save this review — try again
    </p>
  ) : null;
  const character = item.type === "character" ? item : null;
  const clues = character ? lessonClues(character) : [];
  const props = clues.filter((clue) => clue.kind === "prop");

  // Prompt and answer are one centred block; the answer slot is a fixed height.
  return (
    <div className="dx-card" data-revealed={revealed} data-type={item.type}>
      <div className="dx-card-stage">
        <ReviewPrompt clues={props} item={item} revealed={revealed} />

        <div className="dx-answer">
          <AnswerGhost labels={ghostLabels[item.type]} />
          <div
            aria-hidden={!revealed}
            className="dx-answer-real"
            inert={!revealed}
          >
            <ReviewAnswer clues={clues} item={item} />
          </div>
        </div>
      </div>

      <footer className="dx-card-actions">
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
              key={rating.value}
              onRate={rate}
              pending={mutation.isPending}
              picked={
                mutation.isPending &&
                mutation.variables?.rating === rating.value
              }
              rating={rating}
            />
          ))}
        </fieldset>
      </footer>
      {error}
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
            {syllable ? (
              <>
                {syllable}
                <ToneContour tone={getMovieCoordinates(syllable).tone} />
              </>
            ) : (
              " "
            )}
          </span>
          <span className="dx-gloss-hanzi font-hanzi">{char}</span>
          <span aria-hidden={!revealed} className="dx-gloss-en" lang="en">
            {columns.length > 1 ? gloss : " "}
          </span>
        </div>
      ))}
    </div>
  );
}
