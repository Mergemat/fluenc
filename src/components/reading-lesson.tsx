// A new sentence, read for meaning on the same card as reviews: the sentence is the prompt, its
// sound and meaning wait in the answer slot. Then it is shadowed (heard and said aloud a few
// times) before it joins Review, where it is recalled from English.
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { useMandarinSpeech } from "../hooks/use-mandarin-speech";
import type { DashboardData } from "../lib/learner-views";
import { saveEnrollment } from "../offline/progress";
import { useProgressMutation } from "../offline/use-progress-mutation";
import { DitherButton } from "./dither-kit/button";
import { AnswerMask } from "./review-card";
import { AudioButton } from "./ui/hanzi";
import { ErrorNote } from "./ui/layout";

type ReadingItem = DashboardData["getQueue"][number];

// Mandarin Blueprint shadows each sentence 3–10 times, about 5 being the sweet spot.
export const SHADOW_TARGET = 5;
export const SHADOW_MINIMUM = 3;

function actionLabel(revealed: boolean, reps: number, playing: boolean) {
  if (!revealed) {
    return "check meaning";
  }
  if (playing) {
    return "say it with the audio";
  }
  return `listen & repeat · ${reps}/${SHADOW_TARGET}`;
}

export function ReadingLesson({ item }: { item: ReadingItem }) {
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
    <div className="dx-card" data-revealed={revealed} data-type="sentence">
      <div className="dx-card-stage">
        <div className="dx-sentence-prompt">
          <p className="dx-sentence-cue">
            {revealed
              ? "shadow it: listen, then say it aloud"
              : "read it for meaning"}
          </p>
          <p className="dx-sentence font-hanzi" lang="zh-CN">
            {item.hanzi}
          </p>
          <AudioButton label="listen" pinyin={item.pinyin} text={item.hanzi} />
        </div>
        <div className="dx-answer">
          <AnswerMask revealed={revealed}>
            <p className="dx-word-reading">{item.pinyin}</p>
            <h2 className="dx-meaning">{item.meaning}</h2>
            <ShadowPips reps={reps} />
          </AnswerMask>
        </div>
      </div>
      <footer className="dx-card-actions dx-shadow-actions">
        <DitherButton
          className="dx-action"
          color="blue"
          disabled={playing || isPending}
          onClick={revealed ? shadow : reveal}
          variant={revealed && shadowed ? "dotted" : "gradient"}
        >
          <span>{actionLabel(revealed, reps, playing)}</span>
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

const pipSlots = Array.from({ length: SHADOW_TARGET }, (_, slot) => slot);

export function ShadowPips({ reps }: { reps: number }) {
  return (
    <span
      aria-label={`Repeated ${reps} of ${SHADOW_TARGET} times`}
      className="dx-shadow-pips"
      role="img"
    >
      {pipSlots.map((slot) => (
        <i data-done={slot < reps} key={slot} />
      ))}
    </span>
  );
}
