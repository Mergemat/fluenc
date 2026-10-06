import { useReveal } from "../hooks/use-reveal";
import type { ReviewItem } from "../lib/learner-views";
import { MandarinAudioButton } from "./mandarin-audio-button";
import { RecallAnswer } from "./ui/recall-answer";
import { RecallFrame } from "./ui/recall-frame";

type SentenceItem = Extract<ReviewItem, { type: "sentence" }>;

export function SentenceReviewDeck({
  item,
  pending,
  onRate,
}: {
  item: SentenceItem;
  pending: boolean;
  onRate: (rating: number) => void;
}) {
  const { revealed, reveal } = useReveal({ pending, onRate });
  return (
    <RecallFrame
      onRate={onRate}
      pending={pending}
      reveal={reveal}
      revealed={revealed}
    >
      <div className="recall-target">
        <p className="study-label">Say it in Mandarin</p>
        <p className="sentence-prompt">{item.meaning}</p>
        <RecallAnswer
          hint="Say the whole sentence aloud, including the tones."
          revealed={revealed}
        >
          <section className="sentence-answer">
            <p className="font-hanzi" lang="zh-CN">
              {item.hanzi}
            </p>
            <strong>{item.pinyin}</strong>
            <MandarinAudioButton
              label="Listen"
              pinyin={item.pinyin}
              text={item.hanzi}
            />
          </section>
        </RecallAnswer>
      </div>
    </RecallFrame>
  );
}
