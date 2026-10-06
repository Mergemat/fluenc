import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createLibrarySearch, type LibraryEntry } from "../lib/library-search";
import { getItemMeaning } from "../lib/meaning";
import { libraryQueryOptions, palaceQueryOptions } from "../offline/queries";
import { DitherGradient } from "./dither-kit/gradient";
import { Button } from "./ui/button";
import { Chip } from "./ui/chip";
import { Page, PageHeader } from "./ui/layout";

const route = getRouteApi("/_app/library");
const PAGE = 120;
const kinds = [
  { id: "all", label: "all" },
  { id: "characters", label: "characters" },
  { id: "words", label: "words" },
] as const;
const statuses = [
  { id: "review", label: "learned" },
  { id: "learning", label: "learning" },
  { id: "new", label: "new" },
] as const;
const skeletonTiles = Array.from(
  { length: 24 },
  (_, index) => `skeleton-${index}`
);

type Kind = (typeof kinds)[number]["id"];
type Status = (typeof statuses)[number]["id"];

/** Results grow by a page as you scroll, starting over whenever the search or filters change. */
function usePagedResults(filters: string) {
  const [paging, setPaging] = useState({ filters, shown: PAGE });
  const shown = paging.filters === filters ? paging.shown : PAGE;
  // Recreated per filter set, so the sentinel's observer always grows the current results.
  const observeSentinel = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element || typeof IntersectionObserver === "undefined") {
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setPaging((previous) => ({
              filters,
              shown:
                (previous.filters === filters ? previous.shown : PAGE) + PAGE,
            }));
          }
        },
        { rootMargin: "600px" }
      );
      observer.observe(element);
      return () => observer.disconnect();
    },
    [filters]
  );
  return { shown, observeSentinel };
}

/** The course as a wall of tiles that light up as you learn them; search covers your own clues. */
export function LibraryView() {
  const { kind = "all", status = "all", q = "" } = route.useSearch();
  const navigate = route.useNavigate();
  const update = useCallback(
    (next: { kind?: Kind; status?: Status | "all"; q?: string }) => {
      navigate({
        search: (previous) => ({ ...previous, ...next }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate]
  );
  const library = useQuery(libraryQueryOptions);
  const palace = useQuery(palaceQueryOptions);
  const query = useDeferredValue(q);
  const search = useMemo(
    () =>
      library.data ? createLibrarySearch(library.data, palace.data) : null,
    [library.data, palace.data]
  );
  const matches = useMemo(() => search?.(query) ?? [], [search, query]);
  const byKind = matches.filter((item) => kind === "all" || item.kind === kind);
  const items = byKind.filter(
    (item) => status === "all" || item.status === status
  );
  const { shown, observeSentinel } = usePagedResults(
    `${query}\n${kind}\n${status}`
  );
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea")
      ) {
        return;
      }
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const typeQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => update({ q: event.target.value }),
    [update]
  );
  const clearQuery = useCallback(() => {
    update({ q: "" });
    input.current?.focus();
  }, [update]);
  const selectKind = useCallback(
    (next: Kind) => update({ kind: next }),
    [update]
  );
  const toggleStatus = useCallback(
    (next: Status) => update({ status: status === next ? "all" : next }),
    [status, update]
  );
  const clearAll = useCallback(
    () => update({ q: "", kind: "all", status: "all" }),
    [update]
  );
  const retry = useCallback(() => {
    library.refetch();
  }, [library]);

  const learned = library.data
    ? library.data.characters.filter((item) => item.status === "review")
        .length +
      library.data.words.filter((item) => item.status === "review").length
    : 0;
  const total = library.data
    ? library.data.characters.length + library.data.words.length
    : 0;

  const results = () => {
    if (library.isError) {
      return (
        <div className="dx-lib-empty">
          <p>the library is not available offline yet</p>
          <Button onClick={retry} type="button" variant="secondary">
            retry
          </Button>
        </div>
      );
    }
    if (!library.data) {
      return (
        <div aria-busy="true" className="dx-wall">
          {skeletonTiles.map((id) => (
            <span className="dx-tile dx-tile-skeleton" key={id}>
              <DitherGradient
                cell={2}
                direction="up"
                from="grey"
                opacity={0.5}
              />
            </span>
          ))}
        </div>
      );
    }
    if (!items.length) {
      return (
        <div className="dx-lib-empty">
          <p>nothing matches{q ? ` “${q}”` : ""}</p>
          <Button onClick={clearAll} type="button" variant="secondary">
            clear search &amp; filters
          </Button>
        </div>
      );
    }
    return (
      <>
        <div aria-busy={q !== query} className="dx-wall">
          {items.slice(0, shown).map((item) => (
            <Tile item={item} key={`${item.kind}:${item.id}`} />
          ))}
        </div>
        {items.length > shown ? (
          <div className="dx-lib-sentinel" ref={observeSentinel} />
        ) : null}
      </>
    );
  };

  return (
    <Page>
      <PageHeader
        meta={library.data ? `${learned} learned · ${total}` : undefined}
        title="Library"
      />
      <div className="dx-lib-controls">
        <label className="dx-search">
          <Search aria-hidden="true" size={16} />
          <input
            aria-label="Search the library"
            autoComplete="off"
            onChange={typeQuery}
            placeholder="hanzi, pinyin, meaning, or your clues"
            ref={input}
            spellCheck={false}
            type="search"
            value={q}
          />
          {q ? (
            <button
              aria-label="Clear search"
              onClick={clearQuery}
              type="button"
            >
              <X size={15} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </label>
        <div className="dx-lib-filters">
          <fieldset aria-label="Kind" className="dx-group">
            {kinds.map((entry) => (
              <Chip
                key={entry.id}
                onSelect={selectKind}
                pressed={kind === entry.id}
                value={entry.id}
              >
                {entry.label}
                <small>
                  {entry.id === "all"
                    ? matches.length
                    : matches.filter((item) => item.kind === entry.id).length}
                </small>
              </Chip>
            ))}
          </fieldset>
          <fieldset aria-label="Status" className="dx-group">
            {statuses.map((entry) => (
              <Chip
                data-status={entry.id}
                key={entry.id}
                onSelect={toggleStatus}
                pressed={status === entry.id}
                value={entry.id}
              >
                <i aria-hidden="true" />
                {entry.label}
                <small>
                  {byKind.filter((item) => item.status === entry.id).length}
                </small>
              </Chip>
            ))}
          </fieldset>
        </div>
      </div>

      {results()}

      <p className="dx-lib-credit">
        definitions adapted from{" "}
        <a href="https://www.mdbg.net/chinese/dictionary?page=cedict">
          CC-CEDICT
        </a>{" "}
        ·{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">
          CC BY-SA 4.0
        </a>
      </p>
    </Page>
  );
}

export function Tile({ item }: { item: LibraryEntry }) {
  const meaning = getItemMeaning(item);
  return (
    <Link
      aria-label={`${item.hanzi}, ${item.pinyin}: ${meaning.primary}`}
      className="dx-tile"
      data-kind={item.kind}
      data-status={item.status}
      params={{ kind: item.kind, id: item.id }}
      to="/library/$kind/$id"
    >
      <span className="dx-tile-hanzi font-hanzi" lang="zh-CN">
        {item.hanzi}
      </span>
      <span className="dx-tile-py">{item.pinyin}</span>
      <span className="dx-tile-en">{meaning.primary}</span>
      {item.approximate ? (
        <span className="dx-tile-approx" title="Similar match">
          ≈
        </span>
      ) : null}
    </Link>
  );
}
