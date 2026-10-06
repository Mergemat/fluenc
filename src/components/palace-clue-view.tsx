// One palace clue and every character it appears in, as library tiles in course order.
import { useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { type CSSProperties, useMemo } from "react";
import { useGoBack } from "../hooks/use-go-back";
import { buildPalaceBoard, type ClueKind } from "../lib/palace-board";
import { getToneDetail } from "../lib/tones";
import { libraryQueryOptions, palaceQueryOptions } from "../offline/queries";
import { Tile } from "./library-view";
import { clueRows } from "./palace-rows";
import { Rule } from "./ui/dither";
import { Page, Status } from "./ui/layout";

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

export function PalaceClueView({
  kind,
  clueKey,
}: {
  kind: ClueKind;
  clueKey: string;
}) {
  const goBack = useGoBack();
  const canGoBack = useCanGoBack();
  const library = useQuery(libraryQueryOptions);
  const palace = useQuery(palaceQueryOptions);
  const row = useMemo(
    () =>
      library.data && palace.data
        ? clueRows(buildPalaceBoard(library.data, palace.data)).find(
            (entry) => entry.kind === kind && entry.key === clueKey
          )
        : undefined,
    [library.data, palace.data, kind, clueKey]
  );
  const characters = useMemo(() => {
    const byId = new Map(
      library.data?.characters.map((character) => [character.id, character])
    );
    return (row?.ids ?? []).flatMap((id) => byId.get(id) ?? []);
  }, [library.data, row]);

  if (!(library.data && palace.data)) {
    return (
      <Page>
        <Status
          title={
            library.isError || palace.isError
              ? "Your palace is not available offline yet"
              : "Loading…"
          }
        />
      </Page>
    );
  }
  if (!row) {
    return (
      <Page>
        <Status
          action={
            <Link className="dx-chip" to="/palace">
              back to palace
            </Link>
          }
          title="This clue is not in your palace"
        />
      </Page>
    );
  }

  const kindText = clueKindText(kind, row);

  return (
    <Page>
      <nav aria-label="Breadcrumb" className="dx-crumbs">
        {canGoBack ? (
          <button onClick={goBack} type="button">
            <ArrowLeft size={14} />
            palace
          </button>
        ) : (
          <Link search={{ tab: kind }} to="/palace">
            <ArrowLeft size={14} />
            palace
          </Link>
        )}
      </nav>
      <header
        className="dx-clue-hero"
        data-kind={kind}
        style={
          row.color ? ({ "--part": row.color } as CSSProperties) : undefined
        }
      >
        <span
          className={`dx-clue-code ${kind === "props" ? "font-hanzi-props" : ""}`}
          lang={kind === "props" ? "zh-CN" : undefined}
        >
          {row.code}
        </span>
        <div>
          <p className="dx-clue-kind">{kindText}</p>
          <h1 data-open={!row.name}>{row.name || "not named yet"}</h1>
          <p className="dx-clue-stats">
            {row.characters} characters · {row.started} started
          </p>
        </div>
      </header>
      {row.name ? null : (
        <p className="dx-entry-empty">
          it gets its name in the lesson of its first character
        </p>
      )}
      <section aria-label="Characters" className="dx-entry-section">
        <div className="dx-label">
          <span>in characters</span>
          <Rule />
          <span>{characters.length}</span>
        </div>
        <div className="dx-wall">
          {characters.map((character) => (
            <Tile
              item={{ ...character, kind: "characters" }}
              key={character.id}
            />
          ))}
        </div>
      </section>
    </Page>
  );
}
