import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router";
import { useCallback } from "react";

import { LibraryEntryPage } from "../components/library-entry-page";
import { Button } from "../components/ui/button";
import { Page, Status } from "../components/ui/layout";
import type { LibraryEntry } from "../lib/library-search";
import { oneOf } from "../lib/search-params";
import { learnerQueryOptions, selectLibrary } from "../offline/queries";

export const Route = createFileRoute("/_app/library_/$kind/$id")({
  validateSearch: (search: Record<string, unknown>): { from?: "palace" } => ({
    from: oneOf(search.from, ["palace"]),
  }),
  loader: async ({ context, params }) => {
    if (params.kind !== "characters" && params.kind !== "words") {
      throw notFound();
    }
    const library = selectLibrary(
      await context.queryClient.ensureQueryData(learnerQueryOptions)
    );
    const entry: LibraryEntry | undefined =
      params.kind === "characters"
        ? (({ found }) => found && { ...found, kind: "characters" as const })({
            found: library.characters.find((item) => item.id === params.id),
          })
        : (({ found }) => found && { ...found, kind: "words" as const })({
            found: library.words.find((item) => item.id === params.id),
          });
    if (!entry) {
      throw notFound();
    }
    return entry;
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
      <Status title="Loading details…" />
    </Page>
  ),
  errorComponent: DetailError,
  notFoundComponent: () => (
    <Page>
      <Status
        action={
          <Link className="dx-chip" to="/library">
            back to library
          </Link>
        }
        title="This entry is not in the library"
      />
    </Page>
  ),
  component: Detail,
});

function Detail() {
  const item = Route.useLoaderData();
  const { from } = Route.useSearch();
  return <LibraryEntryPage from={from} item={item} />;
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
          <Button onClick={retry} type="button">
            Retry
          </Button>
        }
        title="Could not load these details"
      />
    </Page>
  );
}
