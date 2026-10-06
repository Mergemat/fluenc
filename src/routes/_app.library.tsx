import { createFileRoute } from "@tanstack/react-router";

import { LibraryView } from "../components/library-view";
import { oneOf, optionalString } from "../lib/search-params";

interface LibrarySearch {
  group?: "course" | "sound";
  kind?: "characters" | "words";
  q?: string;
  status?: "all" | "new" | "learning" | "review";
}

export const Route = createFileRoute("/_app/library")({
  validateSearch: (search: Record<string, unknown>): LibrarySearch => ({
    kind: oneOf(search.kind, ["characters", "words"]),
    group: oneOf(search.group, ["course", "sound"]),
    status: oneOf(search.status, ["all", "new", "learning", "review"]),
    q: optionalString(search.q),
  }),
  component: LibraryView,
});
