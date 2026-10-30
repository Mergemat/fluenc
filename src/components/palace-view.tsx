// The memory palace as a lookup, under the profile: search your cast, sets, tone areas and props by code, name or
// meaning, then open a clue to see every character it appears in. Rows stay compact because
// the props list grows to hundreds over the course. Derived from the cached library and palace.
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Search, X } from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
} from "react";

import { buildPalaceBoard, type ClueKind } from "../lib/palace-board";
import { cn } from "../lib/utils";
import { useLibrary, usePalace } from "../progress/views";
import { ClueCode } from "./character-studio/clue-code";
import { DitherGradient } from "./dither-kit/gradient";
import {
  controls,
  filterBar,
  filterGroup,
  filterSet,
  searchBox,
  searchClear,
  searchInput,
} from "./library-view";
import { type ClueRow, clueRows, kindStyle } from "./palace-rows";
import { Chip, ChipCount } from "./ui/chip";
import {
  CrumbSlash,
  crumb,
  Page,
  PageHeader,
  SectionHead,
  Status,
  statusAction,
} from "./ui/layout";

const route = getRouteApi("/_app/profile_/palace");
const tabs: { id: ClueKind; label: string }[] = [
  { id: "cast", label: "cast" },
  { id: "sets", label: "sets" },
  { id: "areas", label: "tone areas" },
  { id: "props", label: "props" },
];

type Show = "all" | "named" | "open";

/** A palace row; every row after the first has a divider above it. */
const rowClass = (first: boolean) =>
  cn(
    "relative grid min-h-14 grid-cols-clue-row items-center gap-4 overflow-hidden py-1.5 pr-3.5 pl-2 text-muted-foreground transition-colors max-xs:grid-cols-clue-row-xs max-xs:gap-2",
    !first && "inset-shadow-hairline"
  );

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
  const library = useLibrary();
  const palace = usePalace();
  const input = useRef<HTMLInputElement>(null);
  const query = useDeferredValue(q.trim().toLowerCase());
  const rows = useMemo(
    () => clueRows(buildPalaceBoard(library, palace)),
    [library, palace]
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
  const results = () => {
    if (!shown.length) {
      return (
        <Status
          action={
            <button className={statusAction} onClick={clearAll} type="button">
              clear
            </button>
          }
          title={`nothing matches${q ? ` “${q}”` : ""}`}
        />
      );
    }
    return (
      <div className="grid overflow-hidden">
        {shown.map((entry, index) => (
          <div key={`${entry.kind}:${entry.key}`}>
            {entry.group && entry.group !== shown[index - 1]?.group ? (
              <SectionHead
                className={index ? "mt-12" : undefined}
                label={entry.group}
              />
            ) : null}
            <ClueLink first={index === 0} row={entry} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <Page
      head={
        <PageHeader
          meta={rows.length ? `${named}/${rows.length} named` : undefined}
          title={
            <>
              <Link className={crumb} to="/profile">
                <ArrowLeft size={14} />
                profile
              </Link>
              <CrumbSlash />
              palace
            </>
          }
        />
      }
    >
      <div className={controls}>
        <label className={searchBox}>
          <Search aria-hidden="true" size={16} />
          <input
            aria-label="Search your palace"
            autoComplete="off"
            className={searchInput}
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
              className={searchClear}
              onClick={clearQuery}
              type="button"
            >
              <X size={15} />
            </button>
          ) : null}
        </label>
        <div className={filterBar}>
          <div
            aria-label="Palace sections"
            className={filterSet}
            role="tablist"
          >
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
                <ChipCount>
                  {matching.filter((clue) => clue.kind === entry.id).length}
                </ChipCount>
              </Chip>
            ))}
          </div>
          <fieldset aria-label="Named" className={filterGroup}>
            {(["named", "open"] as const).map((entry) => (
              <Chip
                key={entry}
                onSelect={toggleShow}
                pressed={show === entry}
                value={entry}
              >
                {entry}
                <ChipCount>
                  {
                    inTab.filter((clue) =>
                      entry === "named" ? clue.name : !clue.name
                    ).length
                  }
                </ChipCount>
              </Chip>
            ))}
          </fieldset>
        </div>
      </div>

      {results()}
    </Page>
  );
}

function ClueLink({ row, first }: { row: ClueRow; first: boolean }) {
  const props = row.kind === "props";
  // Open clues read as gaps.
  const open = !row.name;
  return (
    <Link
      className={cn(
        rowClass(first),
        "follows-hover:inset-shadow-none hover:inset-shadow-none hover:rounded-lg hover:bg-popover"
      )}
      data-kind={row.kind}
      data-open={open}
      params={{ kind: row.kind, key: row.key }}
      style={kindStyle(row)}
      to="/profile/palace/$kind/$key"
    >
      <span
        className={cn(
          "type-code justify-self-center whitespace-nowrap text-kind",
          props && "font-hanzi-props font-normal text-3xl",
          open && "opacity-55"
        )}
        lang={props ? "zh-CN" : undefined}
      >
        <ClueCode clue={row.cue} toneClassName="h-5 w-7" />
      </span>
      <span className="grid min-w-0 gap-1">
        <span
          className={cn(
            "min-w-0 truncate",
            open
              ? "type-control text-faint-foreground"
              : "type-heading text-foreground"
          )}
        >
          {row.name || "open"}
        </span>
        {row.hint ? (
          <span className="type-label min-w-0 truncate text-muted-foreground">
            {row.hint}
          </span>
        ) : null}
      </span>
      <span className="type-control whitespace-nowrap text-foreground tabular-nums">
        {row.characters}
        <small className="text-muted-foreground text-xs max-xs:hidden">
          {row.started ? ` · ${row.started} started` : ""}
        </small>
      </span>
      <ChevronRight aria-hidden="true" size={15} />
      {row.started ? (
        // Under the code, clear of the divider below the row.
        <span
          className="absolute bottom-2 left-0 h-0.5 overflow-hidden"
          style={{ width: `${(row.started / row.characters) * 100}%` }}
        >
          <DitherGradient cell={2} direction="left" from="green" />
        </span>
      ) : null}
    </Link>
  );
}
