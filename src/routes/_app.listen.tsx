import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { ListenView } from "../components/listen-view";
import { dashboardQueryOptions } from "../offline/queries";

export const Route = createFileRoute("/_app/listen")({ component: Page });

function Page() {
  const { data } = useSuspenseQuery(dashboardQueryOptions);
  return <ListenView data={data} />;
}
