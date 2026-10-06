import { useState } from "react";

import type { DashboardData } from "../lib/learner-views";
import { CharacterLesson } from "./character-lesson";
import { Empty, Page, PageHeader } from "./ui/layout";
import { WordLesson } from "./word-lesson";

export function LessonsView({ data }: { data: DashboardData }) {
  const [selected, setSelected] = useState(() => data.buildQueue[0]);
  // Sync can unlock words and reorder characters while a lesson is open.
  // Advance only when the selected lesson has left the build queue.
  const lesson =
    data.buildQueue.find(
      (item) => item.type === selected?.type && item.id === selected.id
    ) ?? data.buildQueue[0];
  if (lesson?.type !== selected?.type || lesson?.id !== selected?.id) {
    setSelected(lesson);
  }

  if (lesson?.type === "character") {
    return <CharacterLesson item={lesson} key={`character:${lesson.id}`} />;
  }
  if (lesson?.type === "word") {
    return <WordLesson item={lesson} key={`word:${lesson.id}`} />;
  }

  return (
    <div className="dx-lesson-page">
      <Page>
        <PageHeader meta="Nothing new" title="Learn" />

        <Empty
          detail="You’ve worked through the available characters and words. Keep practicing with reviews and reading."
          title="All lessons complete"
        />
      </Page>
    </div>
  );
}
