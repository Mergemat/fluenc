import type { DashboardData } from "../lib/learner-views";
import { ReadingLesson } from "./reading-lesson";
import { deckPage } from "./ui/deck";
import { Empty, PageHeader } from "./ui/layout";

export function ReadingView({ data }: { data: DashboardData }) {
  const [sentence] = data.getQueue;

  return (
    <section className={deckPage}>
      <PageHeader title="read" />
      {sentence ? (
        <ReadingLesson
          item={sentence}
          key={sentence.id}
          remaining={data.getQueue.length}
        />
      ) : (
        <Empty
          detail="sentences unlock as you learn the characters and words they’re built from"
          title="nothing to read yet"
        />
      )}
    </section>
  );
}
