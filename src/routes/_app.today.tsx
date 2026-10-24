import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { TodayView } from "../components/today-view";
import { needsWelcome, welcomeSeen } from "../lib/welcome";
import { dashboardQueryOptions, loadLearner } from "../offline/queries";

export const Route = createFileRoute("/_app/today")({
  // Someone opening fluenc for the first time watches the welcome reel before Today.
  loader: async ({ context }) => {
    const { state } = await loadLearner(context.queryClient);
    if (needsWelcome(state, welcomeSeen())) {
      throw redirect({ to: "/welcome", replace: true });
    }
  },
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(dashboardQueryOptions);
  return <TodayView data={data} />;
}
