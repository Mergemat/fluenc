import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { TodayView } from "../components/today-view";
import { dashboardQueryOptions } from "../offline/queries";

export const Route = createFileRoute("/_app/today")({ component: Page });

function Page() {
  const { data } = useSuspenseQuery(dashboardQueryOptions);
  return <TodayView data={data} />;
}
