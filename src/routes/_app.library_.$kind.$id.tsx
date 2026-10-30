import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router";
import { useCallback } from "react";

import { LibraryEntryPage } from "../components/library-entry-page";
import { Page, Status, statusAction } from "../components/ui/layout";
import type { LibraryData } from "../lib/learner-views";
import type { LibraryEntry } from "../lib/library-search";
import { oneOf } from "../lib/search-params";
import { loadLearner, selectLibrary, useLibrary } from "../progress/views";

function findEntry(
  library: LibraryData,
  kind: string,
  id: string
): LibraryEntry | undefined {
  if (kind === "characters") {
    const found = library.characters.find((item) => item.id === id);
    return found && { ...found, kind };
  }
  if (kind === "words") {
    const found = library.words.find((item) => item.id === id);
    return found && { ...found, kind };
  }
  return undefined;
}

export const Route = createFileRoute("/_app/library_/$kind/$id")({
  validateSearch: (search: Record<string, unknown>): { from?: "palace" } => ({
    from: oneOf(search.from, ["palace"]),
  }),
  // The page reads the entry as it changes; the loader only checks that it exists.
  loader: async ({ params }) => {
    const entry = findEntry(
      selectLibrary(await loadLearner()),
      params.kind,
      params.id
    );
    if (!entry) {
      throw notFound();
    }
    return { hanzi: entry.hanzi, pinyin: entry.pinyin };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.hanzi} · ${loaderData.pinyin} | Fluenc`
          : "Fluenc",
      },
    ],
  }),
  pendingComponent: () => (
    <Page>
      <Status loading title="loading details" />
    </Page>
  ),
  errorComponent: DetailError,
  notFoundComponent: () => <Missing />,
  component: Detail,
});

function Missing() {
  return (
    <Page>
      <Status
        action={
          <Link className={statusAction} to="/library">
            back to library
          </Link>
        }
        title="this entry isn’t in the library"
      />
    </Page>
  );
}

function Detail() {
  const { kind, id } = Route.useParams();
  const { from } = Route.useSearch();
  const item = findEntry(useLibrary(), kind, id);
  return item ? <LibraryEntryPage from={from} item={item} /> : <Missing />;
}

function DetailError() {
  const router = useRouter();
  const retry = useCallback(() => {
    router.invalidate();
  }, [router]);
  return (
    <Page>
      <Status
        action={
          <button className={statusAction} onClick={retry} type="button">
            retry
          </button>
        }
        title="couldn’t load these details"
      />
    </Page>
  );
}
