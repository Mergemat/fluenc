// A new sentence, read for meaning on a card like review's: the sentence is the front, its sound
// and meaning the back. Then it is shadowed (heard and said aloud a few times, each time laying
// down one small card) before it joins Review, where it is recalled from English.
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { useMandarinSpeech } from "../hooks/use-mandarin-speech";
import type { DashboardData } from "../lib/learner-views";
import { cn } from "../lib/utils";
import { saveEnrollment, useSave } from "../progress/actions";
import { DitherButton } from "./dither-kit/button";
import { DitherGradient } from "./dither-kit/gradient";
import { action, actionKey } from "./ui/buttons";
import {
  cardMeaning,
  cardReading,
  cardSentence,
  DeckCard,
  DeckPile,
  DeckTable,
  deck,
  deckActions,
  sentenceAnswer,
} from "./ui/deck";
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
  const mutation = useSave(() =>
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
    <div className={deck} data-revealed={revealed} data-type="sentence">
      <DeckTable
        caption={
          <ShadowTakes dimmed={!revealed} playing={playing} reps={reps} />
        }
      >
        <DeckPile under={remaining - 1} wide>
          <DeckCard
            back={
              <div className={sentenceAnswer}>
                <p
                  className="m-0 font-hanzi text-muted-foreground text-title"
                  lang="zh-CN"
                >
                  {item.hanzi}
                </p>
                <p className={cardReading}>{item.pinyin}</p>
                <h2 className={cardMeaning}>{item.meaning}</h2>
                <AudioButton
                  label="listen"
                  pinyin={item.pinyin}
                  text={item.hanzi}
                />
              </div>
            }
            flipped={revealed}
            front={
              <p className={cn(cardSentence, "relative")} lang="zh-CN">
                {item.hanzi}
              </p>
            }
            onFlip={reveal}
            suit="sentence"
          />
        </DeckPile>
      </DeckTable>
      <footer className={deckActions(true)}>
        <DitherButton
          className={cn(action, "h-14 self-end")}
          color="blue"
          disabled={playing || isPending}
          onClick={revealed ? shadow : reveal}
          variant={revealed && shadowed ? "dotted" : "gradient"}
        >
          <span>{actionLabel(revealed, playing)}</span>
          <kbd className={actionKey}>space</kbd>
        </DitherButton>
        {revealed && shadowed ? (
          <DitherButton
            className={cn(action, "h-14 self-end")}
            color="green"
            disabled={isPending}
            onClick={enroll}
            variant="gradient"
          >
            <span>{isPending ? "saving" : "add to review"}</span>
            <kbd className={actionKey}>↵</kbd>
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

/**
 * One small card per time the sentence was said aloud; the one being said fills blue. `dimmed`
 * quiets them until the meaning shows.
 */
export function ShadowTakes({
  reps,
  playing,
  dimmed = false,
}: {
  reps: number;
  playing: boolean;
  dimmed?: boolean;
}) {
  return (
    <span
      aria-label={`Repeated ${reps} of ${SHADOW_TARGET} times`}
      className={cn("inline-flex gap-2.5 align-middle", dimmed && "opacity-35")}
      role="img"
    >
      {takeSlots.map((slot) => {
        const live = playing && slot === reps;
        // A take fanned out at rest; laid down, it straightens and lifts.
        const laid = slot < reps || live;
        return (
          <i
            className={cn(
              "relative h-10 w-7 overflow-hidden rounded-sm border bg-deck transition-transform duration-360 ease-settle motion-reduce:transition-none",
              laid ? "border-transparent" : "border-deck-edge"
            )}
            key={slot}
            style={{
              transform: laid
                ? "rotate(0) translateY(-6px)"
                : `rotate(${(slot - 2) * 5}deg)`,
            }}
          >
            {laid ? (
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
