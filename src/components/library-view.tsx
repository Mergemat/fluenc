import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import {
  type ChangeEvent,
  type MouseEvent,
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
import { getItemMeaning } from "../lib/meaning";
import {
  dashboardQueryOptions,
  libraryQueryOptions,
  palaceQueryOptions,
} from "../offline/queries";
import { DitherGradient } from "./dither-kit/gradient";
import { Chip } from "./ui/chip";
import { Rule } from "./ui/dither";
import { Page, PageHeader, Status } from "./ui/layout";

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
  const query = useDeferredValue(q);
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
  const { shown, showAtLeast, observeSentinel } = usePagedResults(
    `${query}\n${kind}\n${group}\n${status}`
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
  const selectGroup = useCallback(
    (next: LibraryGroup) => update({ group: next }),
    [update]
  );
  const toggleStatus = useCallback(
    (next: StatusId) => update({ status: status === next ? "all" : next }),
    [status, update]
  );
  const clearAll = useCallback(
    () => update({ q: "", status: "all" }),
    [update]
  );
  const retry = useCallback(() => {
    library.refetch();
  }, [library]);
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
        <Status
          action={
            <button className="dx-chip" onClick={retry} type="button">
              retry
            </button>
          }
          title="the library isn’t available offline yet"
        />
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
        <Status
          action={
            <button className="dx-chip" onClick={clearAll} type="button">
              clear search &amp; filters
            </button>
          }
          title={`nothing matches${q ? ` “${q}”` : ""}`}
        />
      );
    }
    const more =
      items.length > shown ? (
        <div className="dx-lib-sentinel" ref={observeSentinel} />
      ) : null;
    if (searching) {
      return (
        <>
          <div aria-busy={q !== query} className="dx-wall">
            {items.slice(0, shown).map((item) => (
              <Tile item={item} key={`${item.kind}:${item.id}`} />
            ))}
          </div>
          {more}
        </>
      );
    }
    let budget = shown;
    return (
      <>
        <nav aria-label="Jump to section" className="dx-lib-index">
          {sections.map((section) => (
            <button
              data-learned={section.learned > 0}
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
              progress={group === "sound"}
              section={section}
            />
          );
        })}
        {more}
      </>
    );
  };

  return (
    <Page>
      <PageHeader
        meta={library.data ? `${learned} learned · ${total}` : undefined}
        title="library"
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
          {searching ? null : (
            <div>
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
                      {matches.filter((item) => item.kind === entry.id).length}
                    </small>
                  </Chip>
                ))}
              </fieldset>
              <fieldset aria-label="Browse by" className="dx-group">
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
                  {pool.filter((item) => item.status === entry.id).length}
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

/** One section: a pixel label, a count (with how much is learned, by sound) and its tiles. */
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
    <section aria-labelledby={`${id}-title`} className="dx-lib-section" id={id}>
      <header className="dx-head">
        <h2 className="dx-head-title" id={`${id}-title`}>
          {section.label}
        </h2>
        {progress ? (
          <div
            aria-label={`${section.label} learned`}
            aria-valuemax={size}
            aria-valuemin={0}
            aria-valuenow={section.learned}
            className="dx-progress"
            role="progressbar"
          >
            <DitherGradient
              cell={2}
              direction="right"
              from="grey"
              opacity={0.5}
            />
            <span
              className="dx-progress-fill"
              style={{ width: `${(section.learned / size) * 100}%` }}
            >
              <DitherGradient cell={2} direction="left" from="green" />
            </span>
          </div>
        ) : (
          <Rule />
        )}
        <div className="dx-head-meta">
          {progress ? (
            <>
              <b>{section.learned}</b> / {size}
            </>
          ) : (
            size
          )}
        </div>
      </header>
      <div className="dx-wall">
        {entries.map((item) => (
          <Tile item={item} key={`${item.kind}:${item.id}`} />
        ))}
      </div>
    </section>
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
