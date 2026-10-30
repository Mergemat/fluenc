import { createFileRoute, redirect } from "@tanstack/react-router";

import { TodayView } from "../components/today-view";
import { needsWelcome, welcomeSeen } from "../lib/welcome";
import { loadLearner, useDashboard } from "../progress/views";

export const Route = createFileRoute("/_app/today")({
  // Someone opening fluenc for the first time watches the welcome reel before Today.
  loader: async () => {
    const { state } = await loadLearner();
    if (needsWelcome(state, welcomeSeen())) {
      throw redirect({ to: "/welcome", replace: true });
    }
  },
  component: Page,
});

function Page() {
  const data = useDashboard();
  return <TodayView data={data} />;
}
