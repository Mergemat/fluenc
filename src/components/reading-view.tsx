import type { DashboardData } from "../lib/learner-views";
import { ReadingLesson } from "./reading-lesson";
import { Empty, PageHeader } from "./ui/layout";

export function ReadingView({ data }: { data: DashboardData }) {
  const [sentence] = data.getQueue;

  return (
    <section className="dx-deck-page">
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
