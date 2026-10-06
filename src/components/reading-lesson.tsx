// A new sentence, read for meaning on the same card as reviews: the sentence is the prompt, its
// sound and meaning wait in the answer slot, and one button checks the meaning, then moves on.
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import type { DashboardData } from "../lib/learner-views";
import { saveEnrollment } from "../offline/progress";
import { useProgressMutation } from "../offline/use-progress-mutation";
import { DitherButton } from "./dither-kit/button";
import { AnswerGhost } from "./review-card";
import { AudioButton } from "./ui/hanzi";
import { ErrorNote } from "./ui/layout";

type ReadingItem = DashboardData["getQueue"][number];

function actionLabel(revealed: boolean, saving: boolean) {
  if (!revealed) {
    return "check meaning";
  }
  return saving ? "saving" : "next sentence";
}

export function ReadingLesson({ item }: { item: ReadingItem }) {
  const [revealed, setRevealed] = useState(false);
  const mutation = useProgressMutation(() =>
    saveEnrollment({ itemType: "sentence", itemId: item.id })
  );
  const { isPending, mutate } = mutation;
  const advance = useCallback(() => {
    if (!revealed) {
      setRevealed(true);
    } else if (!isPending) {
      mutate();
    }
  }, [revealed, isPending, mutate]);

  // Space or Enter checks the meaning, then moves to the next sentence.
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
    if (event.code === "Space" || event.key === "Enter") {
      event.preventDefault();
      advance();
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
          <p className="dx-sentence-cue">read it for meaning</p>
          <p className="dx-sentence font-hanzi" lang="zh-CN">
            {item.hanzi}
          </p>
          <AudioButton label="listen" pinyin={item.pinyin} text={item.hanzi} />
        </div>
        <div className="dx-answer">
          <AnswerGhost labels={["sound", "meaning"]} />
          <div
            aria-hidden={!revealed}
            className="dx-answer-real"
            inert={!revealed}
          >
            <p className="dx-word-reading">{item.pinyin}</p>
            <h2 className="dx-meaning">{item.meaning}</h2>
          </div>
        </div>
      </div>
      <footer className="dx-card-actions">
        <DitherButton
          className="dx-action"
          color="blue"
          disabled={isPending}
          onClick={advance}
          variant="gradient"
        >
          <span>{actionLabel(revealed, isPending)}</span>
          <kbd>{revealed ? "↵" : "space"}</kbd>
        </DitherButton>
      </footer>
      {mutation.isError ? (
        <ErrorNote>couldn’t save this sentence. try again</ErrorNote>
      ) : null}
    </div>
  );
}
