import { getRouteApi } from "@tanstack/react-router";
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useDeferredValue,
  useMemo,
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
import { useDashboard, useLibrary, usePalace } from "../progress/views";
import { Chip, ChipCount } from "./ui/chip";
import {
  headMeta,
  headRow,
  Page,
  PageHeader,
  Status,
  statusAction,
} from "./ui/layout";
import { SearchField, useSearchField } from "./ui/search-field";
import { SplitMeter } from "./ui/split-meter";
import { StatusDot, Tile, Wall } from "./ui/tile";

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

// The search field and filter chips over a list; the palace shares them.
/** Search field and filters, above the results. */
export const controls = "mb-6 grid gap-4";
/** Filter groups: chip sets on one line, wrapping, the last pushed to the end. */
// Groups that wrap sit further apart than chips that wrap inside one group.
export const filterBar = "flex flex-wrap justify-between gap-x-2 gap-y-3";
export const filterSet = "flex flex-wrap gap-x-4 gap-y-3";
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
  const library = useLibrary();
  const palace = usePalace();
  const dashboard = useDashboard();
  // The order lessons will teach new entries in: ready words, then characters, then locked words.
  const queue = useMemo(
    () =>
      new Map(
        [...dashboard.buildQueue, ...dashboard.lockedWords].map(
          (item, index) => [
            queueKey(item.type === "word" ? "words" : "characters", item.id),
            index,
          ]
        )
      ),
    [dashboard]
  );
  const commitQuery = useCallback(
    (value: string) => update({ q: value }),
    [update]
  );
  const field = useSearchField(q, commitQuery);
  const { draft } = field;
  const query = useDeferredValue(draft);
  const searching = query.trim() !== "";
  const search = useMemo(
    () => createLibrarySearch(library, palace),
    [library, palace]
  );
  const matches = useMemo(() => search(query), [search, query]);
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

  const clearAll = useCallback(
    () => update({ q: "", status: "all" }),
    [update]
  );
  const learned =
    library.characters.filter((item) => item.status === "review").length +
    library.words.filter((item) => item.status === "review").length;
  const total = library.characters.length + library.words.length;

  let results: ReactNode;
  if (items.length) {
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
        <PageHeader meta={`${learned} learned · ${total}`} title="library" />
      }
    >
      <div className={controls}>
        <SearchField
          field={field}
          label="Search the library"
          placeholder="hanzi, pinyin, meaning, or your clues"
        />
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
              // Text keys, the first on the gutter, like a crumb trail.
              "type-control h-8 shrink-0 px-2.5 tabular-nums transition-colors first:pl-0 hover:text-foreground",
              section.learned > 0 ? "text-foreground" : "text-muted-foreground"
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
      // The tiles above pad themselves, which makes up the rest of the section gap.
      className="flex scroll-mt-10 flex-col gap-2 pt-10 first-of-type:pt-6"
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
          <SplitMeter
            label={`${section.label} learned`}
            learned={section.learned}
            text={`${section.learned} of ${size} learned`}
            total={size}
          />
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
