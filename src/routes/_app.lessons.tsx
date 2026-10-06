import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { LessonsView } from "../components/lessons-view";
import { dashboardQueryOptions } from "../offline/queries";

export const Route = createFileRoute("/_app/lessons")({ component: Page });

function Page() {
  const { data } = useSuspenseQuery(dashboardQueryOptions);
  return <LessonsView data={data} />;
}
