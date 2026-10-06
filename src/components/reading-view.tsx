import type { DashboardData } from "../lib/learner-views";
import { ReadingLesson } from "./reading-lesson";
import { Empty, Page, PageHeader } from "./ui/layout";

export function ReadingView({ data }: { data: DashboardData }) {
  const [sentence] = data.getQueue;

  return (
    <Page>
      <PageHeader
        meta={sentence ? `${data.getQueue.length} sentences` : "Nothing yet"}
        title="Read"
      />

      {sentence ? (
        <ReadingLesson item={sentence} key={sentence.id} />
      ) : (
        <Empty
          detail="New sentences unlock as you learn the characters and words they are built from."
          title="Nothing to read yet"
        />
      )}
    </Page>
  );
}
