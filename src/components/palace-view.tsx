// The memory palace as a lookup: search your cast, sets, tone areas and props by code, name or
// meaning, then open a clue to see every character it appears in. Rows stay compact because
// the props list grows to hundreds over the course. Derived from the cached library and palace.
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ChevronRight, Search, X } from "lucide-react";
import {
  type ChangeEvent,
  type CSSProperties,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
} from "react";

import { buildPalaceBoard, type ClueKind } from "../lib/palace-board";
import { libraryQueryOptions, palaceQueryOptions } from "../offline/queries";
import { DitherGradient } from "./dither-kit/gradient";
import { type ClueRow, clueRows } from "./palace-rows";
import { Button } from "./ui/button";
import { Chip } from "./ui/chip";

import { Page, PageHeader } from "./ui/layout";

const route = getRouteApi("/_app/palace");
const tabs: { id: ClueKind; label: string }[] = [
  { id: "cast", label: "cast" },
  { id: "sets", label: "sets" },
  { id: "areas", label: "tone areas" },
  { id: "props", label: "props" },
];

const skeletonRows = Array.from(
  { length: 8 },
  (_, index) => `skeleton-${index}`
);
type Show = "all" | "named" | "open";

export function PalaceView() {
  const { tab = "cast", q = "", show = "all" } = route.useSearch();
  const navigate = route.useNavigate();
  const update = useCallback(
    (next: { tab?: ClueKind; q?: string; show?: Show }) => {
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
  const input = useRef<HTMLInputElement>(null);
  const query = useDeferredValue(q.trim().toLowerCase());
  const rows = useMemo(
    () =>
      library.data && palace.data
        ? clueRows(buildPalaceBoard(library.data, palace.data))
        : [],
    [library.data, palace.data]
  );
  const matching = rows.filter(
    (row) =>
      !query ||
      [row.text, row.name, row.hint ?? ""].some((value) =>
        value.toLowerCase().includes(query)
      )
  );
  const inTab = matching.filter((row) => row.kind === tab);
  const shown = inTab.filter(
    (row) => show === "all" || (show === "named" ? row.name : !row.name)
  );
  const named = rows.filter((row) => row.name).length;

  const typeQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => update({ q: event.target.value }),
    [update]
  );
  const clearQuery = useCallback(() => {
    update({ q: "" });
    input.current?.focus();
  }, [update]);
  const selectTab = useCallback(
    (next: ClueKind) => update({ tab: next }),
    [update]
  );
  const toggleShow = useCallback(
    (next: "named" | "open") => update({ show: show === next ? "all" : next }),
    [show, update]
  );
  const clearAll = useCallback(() => update({ q: "", show: "all" }), [update]);
  const { refetch: refetchLibrary } = library;
  const { refetch: refetchPalace } = palace;
  const retry = useCallback(() => {
    refetchLibrary();
    refetchPalace();
  }, [refetchLibrary, refetchPalace]);

  const results = () => {
    if (!(library.data && palace.data)) {
      return library.isError || palace.isError ? (
        <div className="dx-lib-empty">
          <p>your palace is not available offline yet</p>
          <Button onClick={retry} type="button" variant="secondary">
            retry
          </Button>
        </div>
      ) : (
        <div aria-busy="true" className="dx-pal-list">
          {skeletonRows.map((id) => (
            <span className="dx-pal-row dx-pal-skeleton" key={id}>
              <DitherGradient
                cell={2}
                direction="right"
                from="grey"
                opacity={0.4}
              />
            </span>
          ))}
        </div>
      );
    }
    if (!shown.length) {
      return (
        <div className="dx-lib-empty">
          <p>nothing matches{q ? ` “${q}”` : ""}</p>
          <Button onClick={clearAll} type="button" variant="secondary">
            clear
          </Button>
        </div>
      );
    }
    return (
      <div className="dx-pal-list">
        {shown.map((row, index) => (
          <div className="dx-pal-group" key={`${row.kind}:${row.key}`}>
            {row.group && row.group !== shown[index - 1]?.group ? (
              <h3>{row.group}</h3>
            ) : null}
            <ClueLink row={row} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <Page>
      <PageHeader
        meta={rows.length ? `${named}/${rows.length} named` : undefined}
        title="Palace"
      />
      <div className="dx-lib-controls">
        <label className="dx-search">
          <Search aria-hidden="true" size={16} />
          <input
            aria-label="Search your palace"
            autoComplete="off"
            onChange={typeQuery}
            placeholder="code, your name, or meaning"
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
          ) : null}
        </label>
        <div className="dx-lib-filters">
          <div aria-label="Palace sections" role="tablist">
            {tabs.map((entry) => (
              <Chip
                aria-selected={tab === entry.id}
                key={entry.id}
                onSelect={selectTab}
                pressed={tab === entry.id}
                role="tab"
                value={entry.id}
              >
                {entry.label}
                <small>
                  {matching.filter((row) => row.kind === entry.id).length}
                </small>
              </Chip>
            ))}
          </div>
          <fieldset aria-label="Named" className="dx-group">
            {(["named", "open"] as const).map((entry) => (
              <Chip
                key={entry}
                onSelect={toggleShow}
                pressed={show === entry}
                value={entry}
              >
                {entry}
                <small>
                  {
                    inTab.filter((row) =>
                      entry === "named" ? row.name : !row.name
                    ).length
                  }
                </small>
              </Chip>
            ))}
          </fieldset>
        </div>
      </div>

      {results()}
    </Page>
  );
}

function ClueLink({ row }: { row: ClueRow }) {
  return (
    <Link
      className="dx-pal-row"
      data-kind={row.kind}
      data-open={!row.name}
      params={{ kind: row.kind, key: row.key }}
      style={row.color ? ({ "--part": row.color } as CSSProperties) : undefined}
      to="/palace/$kind/$key"
    >
      <span
        className={`dx-pal-code ${row.kind === "props" ? "font-hanzi-props" : ""}`}
        lang={row.kind === "props" ? "zh-CN" : undefined}
      >
        {row.code}
      </span>
      <span className="dx-pal-text">
        <span className="dx-pal-name">{row.name || "open"}</span>
        {row.hint ? <span className="dx-pal-use">{row.hint}</span> : null}
      </span>
      <span className="dx-pal-count">
        {row.characters}
        <small>{row.started ? ` · ${row.started} started` : ""}</small>
      </span>
      <ChevronRight aria-hidden="true" size={15} />
      {row.started ? (
        <span
          className="dx-pal-bar"
          style={{ width: `${(row.started / row.characters) * 100}%` }}
        >
          <DitherGradient cell={2} direction="left" from="green" />
        </span>
      ) : null}
    </Link>
  );
}
