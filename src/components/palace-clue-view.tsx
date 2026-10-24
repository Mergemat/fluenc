// One palace clue and every character it appears in, as library tiles in course order.
import { useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { type CSSProperties, type ReactNode, useMemo } from "react";
import { useGoBack } from "../hooks/use-go-back";
import { buildPalaceBoard, type ClueKind } from "../lib/palace-board";
import { getToneDetail } from "../lib/tones";
import { libraryQueryOptions, palaceQueryOptions } from "../offline/queries";
import { Tile } from "./library-view";
import { clueRows } from "./palace-rows";
import { Page, PageHeader, SectionHead, Status } from "./ui/layout";

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
  code,
  named,
}: {
  kind: ClueKind;
  code: ReactNode;
  named: boolean;
}) {
  const goBack = useGoBack();
  const canGoBack = useCanGoBack();
  const props = kind === "props";
  return (
    <PageHeader
      heading={false}
      meta={
        <span
          className="dx-entry-status"
          data-status={named ? "review" : "new"}
        >
          <i aria-hidden="true" />
          {named ? "named" : "open"}
        </span>
      }
      title={
        <>
          {canGoBack ? (
            <button onClick={goBack} type="button">
              <ArrowLeft size={14} />
              palace
            </button>
          ) : (
            <Link search={{ tab: kind }} to="/profile/palace">
              <ArrowLeft size={14} />
              palace
            </Link>
          )}
          <span aria-hidden="true">/</span>
          <span
            className={props ? "font-hanzi-props" : undefined}
            lang={props ? "zh-CN" : undefined}
          >
            {code}
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
          loading={!(library.isError || palace.isError)}
          title={
            library.isError || palace.isError
              ? "your palace isn’t available offline yet"
              : "loading your palace"
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
            <Link className="dx-chip" to="/profile/palace">
              back to palace
            </Link>
          }
          title="this clue isn’t in your palace"
        />
      </Page>
    );
  }

  const kindText = clueKindText(kind, row);

  return (
    <Page
      head={
        <ClueHeader code={row.code} kind={kind} named={Boolean(row.name)} />
      }
    >
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
        <SectionHead label="in characters" meta={characters.length} />
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
