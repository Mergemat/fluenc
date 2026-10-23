import { createFileRoute } from "@tanstack/react-router";

import { PalaceView } from "../components/palace-view";
import { oneOf, optionalString } from "../lib/search-params";

interface PalaceSearch {
  q?: string;
  show?: "all" | "named" | "open";
  tab?: "cast" | "sets" | "areas" | "props";
}

export const Route = createFileRoute("/_app/profile_/palace")({
  validateSearch: (search: Record<string, unknown>): PalaceSearch => ({
    tab: oneOf(search.tab, ["cast", "sets", "areas", "props"]),
    q: optionalString(search.q),
    show: oneOf(search.show, ["all", "named", "open"]),
  }),
  component: PalaceView,
});
