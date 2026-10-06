import { ArrowRight } from "lucide-react";
import { useCallback, useState } from "react";
import type { DashboardData } from "../lib/learner-views";
import { saveEnrollment } from "../offline/progress";
import { useProgressMutation } from "../offline/use-progress-mutation";
import { MandarinAudioButton } from "./mandarin-audio-button";
import { Button } from "./ui/button";
import { ErrorNote } from "./ui/layout";

type ReadingItem = DashboardData["getQueue"][number];

export function ReadingLesson({ item }: { item: ReadingItem }) {
  const [revealed, setRevealed] = useState(false);
  const mutation = useProgressMutation(() =>
    saveEnrollment({ itemType: "sentence", itemId: item.id })
  );
  const { mutate } = mutation;
  const next = useCallback(() => mutate(), [mutate]);
  const reveal = useCallback(() => setRevealed(true), []);

  return (
    <article className="reading-lesson">
      <div className="reading-content">
        <p className="study-label">Read for meaning</p>
        <p className="reading-hanzi font-hanzi" lang="zh-CN">
          {item.hanzi}
        </p>
        <MandarinAudioButton
          label="Play sentence"
          pinyin={item.pinyin}
          text={item.hanzi}
        />
        {revealed ? (
          <div className="reading-answer">
            <p>{item.pinyin}</p>
            <h2>{item.meaning}</h2>
          </div>
        ) : (
          <p className="recall-hint">Read the whole line, then listen.</p>
        )}
      </div>
      <footer className="lesson-footer">
        <p>{revealed ? "Take the sentence with you." : "What does it mean?"}</p>
        {revealed ? (
          <Button disabled={mutation.isPending} onClick={next} type="button">
            {mutation.isPending ? "Saving…" : "Next sentence"}{" "}
            <ArrowRight size={16} />
          </Button>
        ) : (
          <Button onClick={reveal} type="button">
            Check meaning <ArrowRight size={16} />
          </Button>
        )}
      </footer>
      {mutation.isError ? (
        <ErrorNote>Could not save this sentence. Try again.</ErrorNote>
      ) : null}
    </article>
  );
}
