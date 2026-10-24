import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import {
  type ChangeEvent,
  type CompositionEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

import {
  type LibraryGroup,
  type LibrarySection,
  librarySections,
  queueKey,
} from "../lib/library-index";
import { createLibrarySearch, type LibraryEntry } from "../lib/library-search";
import { cn } from "../lib/utils";
import {
  dashboardQueryOptions,
  libraryQueryOptions,
  palaceQueryOptions,
} from "../offline/queries";
import { DitherGradient } from "./dither-kit/gradient";
import { Chip, ChipCount } from "./ui/chip";
import {
  headMeta,
  headRow,
  Page,
  PageHeader,
  Status,
  statusAction,
} from "./ui/layout";
import { progressFill, progressTrack } from "./ui/split-meter";
import { StatusDot, Tile, tileSkeleton, Wall } from "./ui/tile";

const route = getRouteApi("/_app/library");
const PAGE = 120;
const kinds = [
  { id: "characters", label: "characters" },
  { id: "words", label: "words" },
] as const;
const groups = [
  { id: "course", label: "course" },
  { id: "sound", label: "sound" },
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

// The search field and filter chips over a list; the palace shares them.
/** Search field and filters, above the results. */
export const controls = "mb-6 grid gap-4";
export const searchBox =
  "flex h-14 items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 text-muted-foreground transition-colors focus-within:border-blue focus-within:text-foreground";
export const searchInput =
  "h-full min-w-0 flex-1 border-0 bg-transparent type-heading text-foreground outline-none search-cancel:hidden placeholder:type-control placeholder:text-faint-foreground";
export const searchClear =
  "grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-popover hover:text-foreground";
/** Filter groups: chip sets on one line, wrapping, the last pushed to the end. */
export const filterBar = "flex flex-wrap justify-between gap-2";
export const filterSet = "flex flex-wrap gap-x-4 gap-y-2";
/** A fieldset of chips, without the browser's border and padding. */
export const filterGroup = "flex min-w-0 flex-wrap gap-2";

type Kind = (typeof kinds)[number]["id"];
type StatusId = (typeof statuses)[number]["id"];

/** Results grow by a page as you scroll, starting over whenever the search or filters change. */
function usePagedResults(filters: string) {
  const [paging, setPaging] = useState({ filters, shown: PAGE });
  const shown = paging.filters === filters ? paging.shown : PAGE;
  const showAtLeast = useCallback(
    (count: number) => {
      setPaging((previous) => ({
        filters,
        shown: Math.max(
          previous.filters === filters ? previous.shown : PAGE,
          count
        ),
      }));
    },
    [filters]
  );
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
  return { shown, showAtLeast, observeSentinel };
}

const sectionId = (key: string) => `library-${key}`;

/**
 * The search field owns its text: echoing it through the URL lands a render late, and resetting
 * the value mid-composition breaks IME input (iOS pinyin). The URL follows once a word is
 * committed. "/" focuses the field from anywhere on the page.
 */
function useSearchField(q: string, commit: (value: string) => void) {
  // `sent` is what the field has sent to the URL and not yet seen land; navigations can skip
  // values. `q` is the URL value the field last saw.
  const [field, setField] = useState({ q, draft: q, sent: [] as string[] });
  if (field.q !== q) {
    const echo = field.sent.indexOf(q);
    // Changed from outside the field (the sidebar link, clearing): adopt it.
    setField(
      echo === -1
        ? { q, draft: q, sent: [] }
        : { q, draft: field.draft, sent: field.sent.slice(echo + 1) }
    );
  }
  const composing = useRef<boolean>(false);
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

  const type = useCallback(
    (value: string, send: boolean) => {
      setField((previous) => ({
        ...previous,
        draft: value,
        sent: send ? [...previous.sent, value] : previous.sent,
      }));
      if (send) {
        commit(value);
      }
    },
    [commit]
  );
  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      type(event.target.value, !composing.current);
    },
    [type]
  );
  const onCompositionStart = useCallback(() => {
    composing.current = true;
  }, []);
  const onCompositionEnd = useCallback(
    (event: CompositionEvent<HTMLInputElement>) => {
      composing.current = false;
      type(event.currentTarget.value, true);
    },
    [type]
  );
  return {
    draft: field.draft,
    input,
    handlers: { onChange, onCompositionStart, onCompositionEnd },
  };
}

type Section = LibrarySection & { shown: LibraryEntry[] };

/**
 * A lookup: search reaches every character and word; without a query the course is browsed in
 * sections, in learning order or by sound, with a strip to jump between them.
 */
export function LibraryView() {
  const {
    kind = "characters",
    group = "course",
    status = "all",
    q = "",
  } = route.useSearch();
  const navigate = route.useNavigate();
  const update = useCallback(
    (next: {
      kind?: Kind;
      group?: LibraryGroup;
      status?: StatusId | "all";
      q?: string;
    }) => {
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
  const dashboard = useQuery(dashboardQueryOptions);
  // The order lessons will teach new entries in: ready words, then characters, then locked words.
  const queue = useMemo(
    () =>
      new Map(
        [
          ...(dashboard.data?.buildQueue ?? []),
          ...(dashboard.data?.lockedWords ?? []),
        ].map((item, index) => [
          queueKey(item.type === "word" ? "words" : "characters", item.id),
          index,
        ])
      ),
    [dashboard.data]
  );
  const commitQuery = useCallback(
    (value: string) => update({ q: value }),
    [update]
  );
  const { draft, input, handlers } = useSearchField(q, commitQuery);
  const query = useDeferredValue(draft);
  const searching = query.trim() !== "";
  const search = useMemo(
    () =>
      library.data ? createLibrarySearch(library.data, palace.data) : null,
    [library.data, palace.data]
  );
  const matches = useMemo(() => search?.(query) ?? [], [search, query]);
  // Search spans both kinds; browsing shows one kind at a time.
  const pool = useMemo(
    () => (searching ? matches : matches.filter((item) => item.kind === kind)),
    [matches, searching, kind]
  );
  const sections = useMemo(
    () =>
      searching
        ? []
        : librarySections(pool, group, queue)
            .map((section) => ({
              ...section,
              shown: section.entries.filter(
                (item) => status === "all" || item.status === status
              ),
            }))
            .filter((section) => section.shown.length),
    [pool, searching, group, queue, status]
  );
  const items = searching
    ? pool.filter((item) => status === "all" || item.status === status)
    : sections.flatMap((section) => section.shown);

  const clearQuery = useCallback(() => {
    update({ q: "" });
    input.current?.focus();
  }, [update, input]);
  const clearAll = useCallback(
    () => update({ q: "", status: "all" }),
    [update]
  );
  const { refetch } = library;
  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  const learned = library.data
    ? library.data.characters.filter((item) => item.status === "review")
        .length +
      library.data.words.filter((item) => item.status === "review").length
    : 0;
  const total = library.data
    ? library.data.characters.length + library.data.words.length
    : 0;

  let results: ReactNode;
  if (library.isError) {
    results = (
      <Status
        action={
          <button className={statusAction} onClick={retry} type="button">
            retry
          </button>
        }
        title="the library isn’t available offline yet"
      />
    );
  } else if (!library.data) {
    results = (
      <Wall busy>
        {skeletonTiles.map((id) => (
          <span className={tileSkeleton} key={id}>
            <DitherGradient cell={2} direction="up" from="grey" opacity={0.5} />
          </span>
        ))}
      </Wall>
    );
  } else if (items.length) {
    results = (
      <LibraryResults
        filters={`${query}\n${kind}\n${group}\n${status}`}
        items={items}
        pending={draft !== query}
        progress={group === "sound"}
        searching={searching}
        sections={sections}
      />
    );
  } else {
    results = (
      <Status
        action={
          <button className={statusAction} onClick={clearAll} type="button">
            clear search &amp; filters
          </button>
        }
        title={`nothing matches${query ? ` “${query}”` : ""}`}
      />
    );
  }

  return (
    <Page
      head={
        <PageHeader
          meta={library.data ? `${learned} learned · ${total}` : undefined}
          title="library"
        />
      }
    >
      <div className={controls}>
        <label className={searchBox}>
          <Search aria-hidden="true" size={16} />
          <input
            aria-label="Search the library"
            autoComplete="off"
            className={searchInput}
            placeholder="hanzi, pinyin, meaning, or your clues"
            ref={input}
            spellCheck={false}
            type="search"
            value={draft}
            {...handlers}
          />
          {draft ? (
            <button
              aria-label="Clear search"
              className={searchClear}
              onClick={clearQuery}
              type="button"
            >
              <X size={15} />
            </button>
          ) : (
            <kbd className="rounded-sm border border-border-strong px-1.5 py-px">
              /
            </kbd>
          )}
        </label>
        <LibraryFilters
          group={group}
          kind={kind}
          matches={matches}
          pool={pool}
          searching={searching}
          status={status}
          update={update}
        />
      </div>

      {results}

      <p className="type-label mt-12 mb-0 text-center text-faint-foreground leading-wrap">
        definitions adapted from{" "}
        <a
          className="underline underline-offset-3"
          href="https://www.mdbg.net/chinese/dictionary?page=cedict"
        >
          CC-CEDICT
        </a>{" "}
        ·{" "}
        <a
          className="underline underline-offset-3"
          href="https://creativecommons.org/licenses/by-sa/4.0/"
        >
          CC BY-SA 4.0
        </a>
      </p>
    </Page>
  );
}

/** Kind and grouping while browsing, and status always, each chip with its count. */
function LibraryFilters({
  kind,
  group,
  status,
  searching,
  matches,
  pool,
  update,
}: {
  kind: Kind;
  group: LibraryGroup;
  status: StatusId | "all";
  searching: boolean;
  matches: LibraryEntry[];
  pool: LibraryEntry[];
  update: (next: {
    kind?: Kind;
    group?: LibraryGroup;
    status?: StatusId | "all";
  }) => void;
}) {
  const selectKind = useCallback(
    (next: Kind) => update({ kind: next }),
    [update]
  );
  const selectGroup = useCallback(
    (next: LibraryGroup) => update({ group: next }),
    [update]
  );
  const toggleStatus = useCallback(
    (next: StatusId) => update({ status: status === next ? "all" : next }),
    [status, update]
  );
  return (
    <div className={filterBar}>
      {searching ? null : (
        <div className={filterSet}>
          <fieldset aria-label="Kind" className={filterGroup}>
            {kinds.map((entry) => (
              <Chip
                key={entry.id}
                onSelect={selectKind}
                pressed={kind === entry.id}
                value={entry.id}
              >
                {entry.label}
                <ChipCount>
                  {matches.filter((item) => item.kind === entry.id).length}
                </ChipCount>
              </Chip>
            ))}
          </fieldset>
          <fieldset aria-label="Browse by" className={filterGroup}>
            {groups.map((entry) => (
              <Chip
                key={entry.id}
                onSelect={selectGroup}
                pressed={group === entry.id}
                value={entry.id}
              >
                {entry.label}
              </Chip>
            ))}
          </fieldset>
        </div>
      )}
      <fieldset aria-label="Status" className={filterGroup}>
        {statuses.map((entry) => (
          <Chip
            data-status={entry.id}
            key={entry.id}
            onSelect={toggleStatus}
            pressed={status === entry.id}
            value={entry.id}
          >
            <StatusDot status={entry.id} />
            {entry.label}
            <ChipCount>
              {pool.filter((item) => item.status === entry.id).length}
            </ChipCount>
          </Chip>
        ))}
      </fieldset>
    </div>
  );
}

/** Matching tiles a page at a time: one wall when searching, sections with a jump strip otherwise. */
function LibraryResults({
  items,
  sections,
  searching,
  pending,
  progress,
  filters,
}: {
  items: LibraryEntry[];
  sections: Section[];
  searching: boolean;
  /** The typed query hasn't been applied yet. */
  pending: boolean;
  /** Sections show how much of them is learned (browsing by sound). */
  progress: boolean;
  /** Changes whenever the search or filters do, so paging starts over. */
  filters: string;
}) {
  const { shown, showAtLeast, observeSentinel } = usePagedResults(filters);
  // Render every section up to the target, then bring it under the strip.
  const jumpTo = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const key = event.currentTarget.value;
      let end = 0;
      for (const section of sections) {
        end += section.shown.length;
        if (section.key === key) {
          break;
        }
      }
      flushSync(() => showAtLeast(end));
      document
        .getElementById(sectionId(key))
        ?.scrollIntoView({ block: "start" });
    },
    [sections, showAtLeast]
  );
  const more =
    items.length > shown ? (
      <div className="h-px" ref={observeSentinel} />
    ) : null;
  if (searching) {
    return (
      <>
        <Wall busy={pending}>
          {items.slice(0, shown).map((item) => (
            <Tile item={item} key={`${item.kind}:${item.id}`} />
          ))}
        </Wall>
        {more}
      </>
    );
  }
  let budget = shown;
  return (
    <>
      {/* Section keys stay pinned while browsing, so any part of the course is one tap away. */}
      <nav
        aria-label="Jump to section"
        className="scrollbar-none sticky top-0 z-2 mb-1.5 flex gap-1 overflow-x-auto bg-background py-2 shadow-hairline"
      >
        {sections.map((section) => (
          <button
            className={cn(
              "type-control h-8 min-w-9 shrink-0 rounded-md border border-transparent px-2.5 tabular-nums transition-colors hover:border-border-strong hover:text-foreground",
              section.learned > 0 ? "text-foreground" : "text-faint-foreground"
            )}
            key={section.key}
            onClick={jumpTo}
            type="button"
            value={section.key}
          >
            {section.label}
          </button>
        ))}
      </nav>
      {sections.map((section) => {
        if (budget <= 0) {
          return null;
        }
        const tiles = section.shown.slice(0, budget);
        budget -= tiles.length;
        return (
          <LibrarySectionBlock
            entries={tiles}
            key={section.key}
            progress={progress}
            section={section}
          />
        );
      })}
      {more}
    </>
  );
}

/** One section: a label, a count (with how much is learned, by sound) and its tiles. */
function LibrarySectionBlock({
  section,
  entries,
  progress,
}: {
  section: LibrarySection;
  entries: LibraryEntry[];
  progress: boolean;
}) {
  const id = sectionId(section.key);
  const size = section.entries.length;
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-10 flex-col gap-2 pt-12 first-of-type:pt-6"
      id={id}
    >
      {/* Reads like every section head: label, then its count after a dot. */}
      <header className={cn(headRow, "min-h-0 gap-2")}>
        <h2
          className="type-label m-0 min-w-3.5 shrink-0 whitespace-nowrap text-foreground"
          id={`${id}-title`}
        >
          {section.label}
        </h2>
        {progress ? (
          <div
            aria-label={`${section.label} learned`}
            aria-valuemax={size}
            aria-valuemin={0}
            aria-valuenow={section.learned}
            className={cn(progressTrack, "max-w-none")}
            role="progressbar"
          >
            <DitherGradient
              cell={2}
              direction="right"
              from="grey"
              opacity={0.5}
            />
            <span
              className={progressFill}
              style={{ width: `${(section.learned / size) * 100}%` }}
            >
              <DitherGradient cell={2} direction="left" from="green" />
            </span>
          </div>
        ) : null}
        <div
          className={cn(headMeta, progress ? "max-md:ml-auto" : "dot-before")}
        >
          {progress ? (
            <>
              <b className="font-medium text-foreground">{section.learned}</b> /{" "}
              {size}
            </>
          ) : (
            size
          )}
        </div>
      </header>
      <Wall>
        {entries.map((item) => (
          <Tile item={item} key={`${item.kind}:${item.id}`} />
        ))}
      </Wall>
    </section>
  );
}
