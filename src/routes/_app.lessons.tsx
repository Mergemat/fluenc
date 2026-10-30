import { createFileRoute } from "@tanstack/react-router";

import { LessonsView } from "../components/lessons-view";
import { useDashboard } from "../progress/views";

export const Route = createFileRoute("/_app/lessons")({ component: Page });

function Page() {
  const data = useDashboard();
  return <LessonsView data={data} />;
}
