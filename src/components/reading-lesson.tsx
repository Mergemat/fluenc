// A new sentence, read for meaning on a card like review's: the sentence is the front, its sound
// and meaning the back. Then it is shadowed (heard and said aloud a few times, each time laying
// down one small card) before it joins Review, where it is recalled from English.
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { useMandarinSpeech } from "../hooks/use-mandarin-speech";
import type { DashboardData } from "../lib/learner-views";
import { saveEnrollment } from "../offline/progress";
import { useProgressMutation } from "../offline/use-progress-mutation";
import { DitherButton } from "./dither-kit/button";
import { DitherGradient } from "./dither-kit/gradient";
import { DeckCard, DeckPile, DeckTable } from "./ui/deck";
import { AudioButton } from "./ui/hanzi";
import { ErrorNote } from "./ui/layout";

type ReadingItem = DashboardData["getQueue"][number];

// Shadow each sentence 3–10 times; about 5 is the sweet spot.
export const SHADOW_TARGET = 5;
export const SHADOW_MINIMUM = 3;

function actionLabel(revealed: boolean, playing: boolean) {
  if (!revealed) {
    return "show meaning";
  }
  return playing ? "say it with the audio" : "listen & repeat";
}

export function ReadingLesson({
  item,
  remaining = 1,
}: {
  item: ReadingItem;
  /** Sentences left to read, this one included. */
  remaining?: number;
}) {
  const [revealed, setRevealed] = useState(false);
  const [reps, setReps] = useState(0);
  const { speak, status } = useMandarinSpeech();
  const playing = status === "loading" || status === "speaking";
  const mutation = useProgressMutation(() =>
    saveEnrollment({ itemType: "sentence", itemId: item.id })
  );
  const { isPending, mutate } = mutation;
  const shadowed = reps >= SHADOW_MINIMUM;

  const reveal = useCallback(() => setRevealed(true), []);
  const enroll = useCallback(() => mutate(), [mutate]);
  const shadow = useCallback(async () => {
    if (await speak(item.hanzi, item.pinyin)) {
      setReps((count) => count + 1);
    }
  }, [speak, item.hanzi, item.pinyin]);

  // Space checks the meaning, then plays the line to repeat; Enter adds it once it's shadowed.
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
    if (event.code !== "Space" && event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (!revealed) {
      setRevealed(true);
    } else if (event.key === "Enter" && shadowed) {
      if (!isPending) {
        mutate();
      }
    } else if (!playing) {
      shadow();
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="dx-deck" data-revealed={revealed} data-type="sentence">
      <DeckTable caption={<ShadowTakes playing={playing} reps={reps} />}>
        <DeckPile under={remaining - 1} wide>
          <DeckCard
            back={
              <div className="dx-deck-answer dx-deck-answer-sentence">
                <p className="dx-deck-sentence-small font-hanzi" lang="zh-CN">
                  {item.hanzi}
                </p>
                <div className="dx-sound">
                  <span className="dx-deck-reading">{item.pinyin}</span>
                  <AudioButton pinyin={item.pinyin} text={item.hanzi} />
                </div>
                <h2 className="dx-deck-meaning">{item.meaning}</h2>
              </div>
            }
            flipped={revealed}
            front={
              <p className="dx-deck-sentence font-hanzi" lang="zh-CN">
                {item.hanzi}
              </p>
            }
            onFlip={reveal}
            suit="sentence"
          />
        </DeckPile>
      </DeckTable>
      <footer className="dx-deck-actions dx-deck-actions-pair">
        <DitherButton
          className="dx-action"
          color="blue"
          disabled={playing || isPending}
          onClick={revealed ? shadow : reveal}
          variant={revealed && shadowed ? "dotted" : "gradient"}
        >
          <span>{actionLabel(revealed, playing)}</span>
          <kbd>space</kbd>
        </DitherButton>
        {revealed && shadowed ? (
          <DitherButton
            className="dx-action"
            color="green"
            disabled={isPending}
            onClick={enroll}
            variant="gradient"
          >
            <span>{isPending ? "saving" : "add to review"}</span>
            <kbd>↵</kbd>
          </DitherButton>
        ) : null}
      </footer>
      {mutation.isError ? (
        <ErrorNote>couldn’t save this sentence. try again</ErrorNote>
      ) : null}
    </div>
  );
}

const takeSlots = Array.from({ length: SHADOW_TARGET }, (_, slot) => slot);

/** One small card per time the sentence was said aloud; the one being said fills blue. */
export function ShadowTakes({
  reps,
  playing,
}: {
  reps: number;
  playing: boolean;
}) {
  return (
    <span
      aria-label={`Repeated ${reps} of ${SHADOW_TARGET} times`}
      className="dx-takes"
      role="img"
    >
      {takeSlots.map((slot) => {
        const live = playing && slot === reps;
        return (
          <i
            data-done={slot < reps}
            data-live={live}
            key={slot}
            style={{ "--i": slot - 2 } as CSSProperties}
          >
            {slot < reps || live ? (
              <DitherGradient
                cell={2}
                direction="up"
                from={live ? "blue" : "green"}
              />
            ) : null}
          </i>
        );
      })}
    </span>
  );
}
