import { createFileRoute } from "@tanstack/react-router";

import { LibraryView } from "../components/library-view";
import { oneOf, optionalString } from "../lib/search-params";

interface LibrarySearch {
  kind?: "all" | "characters" | "words";
  q?: string;
  status?: "all" | "new" | "learning" | "review";
}

export const Route = createFileRoute("/_app/library")({
  validateSearch: (search: Record<string, unknown>): LibrarySearch => ({
    kind: oneOf(search.kind, ["all", "characters", "words"]),
    status: oneOf(search.status, ["all", "new", "learning", "review"]),
    q: optionalString(search.q),
  }),
  component: LibraryView,
});
