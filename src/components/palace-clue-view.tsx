// One palace clue and every character it appears in, as library tiles in course order.
import { Link, useCanGoBack } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { useGoBack } from "../hooks/use-go-back";
import type { ClueKind } from "../lib/palace-board";
import { getToneDetail } from "../lib/tones";
import { cn } from "../lib/utils";
import { useLibrary, usePalaceBoard } from "../progress/views";
import { ClueCode } from "./character-studio/clue-code";
import { type ClueRow, clueRows, kindStyle } from "./palace-rows";
import {
  CrumbSlash,
  crumb,
  Page,
  PageHeader,
  SectionHead,
  Status,
  statusAction,
} from "./ui/layout";
import { StatusDot, Tile, Wall } from "./ui/tile";

const kindLabel: Record<ClueKind, string> = {
  cast: "actor",
  sets: "set",
  areas: "tone area",
  props: "prop",
};

const PLURAL = /s$/;

/** What kind of clue this is, with its hint: "female actor · ...", "tone area · first tone". */
function clueKindText(
  kind: ClueKind,
  row: { group?: string; hint: string | null; key: string }
) {
  if (row.group) {
    return row.group
      .replace(PLURAL, "")
      .replace("gods & world leader", "god or world leader");
  }
  if (kind === "areas") {
    return `tone area · ${getToneDetail(Number(row.key))?.label.toLowerCase()} tone`;
  }
  if (!row.hint) {
    return kindLabel[kind];
  }
  return kind === "props"
    ? `prop · ${row.hint}`
    : `${kindLabel[kind]} · ${row.hint}`;
}

/** Back to the palace, the clue's code, and whether it has a name yet. */
function ClueHeader({
  kind,
  cue,
  named,
}: {
  kind: ClueKind;
  cue: ClueRow["cue"];
  named: boolean;
}) {
  const goBack = useGoBack();
  const canGoBack = useCanGoBack();
  const props = kind === "props";
  return (
    <PageHeader
      heading={false}
      meta={
        <span className="inline-flex items-center gap-2">
          <StatusDot status={named ? "review" : "new"} />
          {named ? "named" : "open"}
        </span>
      }
      title={
        <>
          {canGoBack ? (
            <button className={crumb} onClick={goBack} type="button">
              <ArrowLeft size={14} />
              palace
            </button>
          ) : (
            <Link className={crumb} search={{ tab: kind }} to="/profile/palace">
              <ArrowLeft size={14} />
              palace
            </Link>
          )}
          <CrumbSlash />
          <span
            className={props ? "font-hanzi-props" : undefined}
            lang={props ? "zh-CN" : undefined}
          >
            <ClueCode clue={cue} />
          </span>
        </>
      }
    />
  );
}

export function PalaceClueView({
  kind,
  clueKey,
}: {
  kind: ClueKind;
  clueKey: string;
}) {
  const library = useLibrary();
  const board = usePalaceBoard();
  const row = useMemo(
    () =>
      clueRows(board).find(
        (entry) => entry.kind === kind && entry.key === clueKey
      ),
    [board, kind, clueKey]
  );
  const characters = useMemo(() => {
    const byId = new Map(
      library.characters.map((character) => [character.id, character])
    );
    return (row?.ids ?? []).flatMap((id) => byId.get(id) ?? []);
  }, [library, row]);

  if (!row) {
    return (
      <Page>
        <Status
          action={
            <Link className={statusAction} to="/profile/palace">
              back to palace
            </Link>
          }
          title="this clue isn’t in your palace"
        />
      </Page>
    );
  }

  const kindText = clueKindText(kind, row);
  const props = kind === "props";

  return (
    <Page
      head={<ClueHeader cue={row.cue} kind={kind} named={Boolean(row.name)} />}
    >
      <header
        className="flex items-center gap-6 py-2"
        data-kind={kind}
        style={kindStyle(row)}
      >
        <span
          className={cn(
            "type-code grid h-24 min-w-24 shrink-0 place-items-center rounded-2xl border border-kind/45 px-3 text-4xl text-kind max-xs:h-20 max-xs:min-w-20 max-xs:text-2xl",
            props && "font-hanzi-props font-normal text-6xl max-xs:text-5xl"
          )}
          lang={props ? "zh-CN" : undefined}
        >
          <ClueCode clue={row.cue} toneClassName="h-9 w-12" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-control m-0 text-muted-foreground">{kindText}</p>
          <h1
            className={cn(
              "wrap-anywhere my-1 tracking-tight",
              row.name
                ? "type-display"
                : "type-control text-faint-foreground text-xl"
            )}
          >
            {row.name || "not named yet"}
          </h1>
          <p className="type-control m-0 text-muted-foreground">
            {row.characters} characters · {row.started} started
          </p>
        </div>
      </header>
      {row.name ? null : (
        <p className="type-control m-0 text-faint-foreground leading-wrap">
          it gets its name in the lesson of its first character
        </p>
      )}
      <section aria-label="Characters" className="mt-12 grid gap-2">
        <SectionHead
          className="mb-0"
          label="in characters"
          meta={characters.length}
        />
        <Wall>
          {characters.map((character) => (
            <Tile
              item={{ ...character, kind: "characters" }}
              key={character.id}
            />
          ))}
        </Wall>
      </section>
    </Page>
  );
}
