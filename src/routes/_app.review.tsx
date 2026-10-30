import { createFileRoute } from "@tanstack/react-router";

import { ReviewView } from "../components/review-view";
import { useDashboard } from "../progress/views";

export const Route = createFileRoute("/_app/review")({ component: Page });

function Page() {
  const data = useDashboard();
  return <ReviewView data={data} />;
}
