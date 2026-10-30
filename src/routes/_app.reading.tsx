import { createFileRoute } from "@tanstack/react-router";

import { ReadingView } from "../components/reading-view";
import { useDashboard } from "../progress/views";

export const Route = createFileRoute("/_app/reading")({ component: Page });

function Page() {
  const data = useDashboard();
  return <ReadingView data={data} />;
}
