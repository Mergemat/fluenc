// Library tiles: a character or word with its pinyin and meaning, on walls that fit as many as the
// room allows. The library, a library entry and a palace clue all list entries this way.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { LibraryEntry } from "../../lib/library-search";
import { getItemMeaning } from "../../lib/meaning";
import { cn } from "../../lib/utils";

type Status = LibraryEntry["status"];

const dotColors: Record<Status, string> = {
  review: "bg-green",
  learning: "bg-orange",
  new: "bg-faint-foreground",
};

/** A small square in the colour of a learning status. */
/** A status as a page header's meta: its dot, then what it means here. */
export function StatusMeta({
  status,
  children,
}: {
  status: Status;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <StatusDot status={status} />
      {children}
    </span>
  );
}

export function StatusDot({ status }: { status: Status }) {
  return (
    <i
      aria-hidden="true"
      className={cn("size-2 rounded-xs", dotColors[status])}
    />
  );
}

/** A wall of tiles. */
export function Wall({
  busy,
  children,
}: {
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-busy={busy}
      className={cn(
        // Words take two columns beside characters; on a wall of only words the columns double.
        "group/wall grid grid-flow-row-dense grid-cols-wall-words gap-2 has-data-character:grid-cols-wall",
        "max-xs:grid-cols-wall-words-xs max-xs:has-data-character:grid-cols-wall-xs"
      )}
    >
      {children}
    </div>
  );
}

const tileStatus: Record<Status, string> = {
  review: "after:bg-green",
  learning: "after:bg-orange",
  // Unlearned entries step down to muted rather than fading, so their text stays readable.
  new: "text-muted-foreground hover:text-foreground",
};

/** The frame of a tile; `TileGlyph` and the lines under it go inside. */
export function tileClass(kind: LibraryEntry["kind"], status: Status) {
  return cn(
    "relative grid min-h-28 content-start justify-items-center gap-1 overflow-hidden rounded-lg px-2 py-2.5 text-center transition hover:bg-card max-xs:min-h-24",
    "after:absolute after:top-2 after:right-2 after:size-1.5 after:rounded-xs",
    kind === "words" && "col-span-2 group-not-has-data-character/wall:col-auto",
    tileStatus[status]
  );
}

export function TileGlyph({
  kind,
  children,
}: {
  kind: LibraryEntry["kind"];
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap font-hanzi max-xs:text-3xl",
        kind === "words" ? "text-3xl" : "text-4xl",
        // After the size: tailwind-merge drops a leading that comes before one.
        "leading-tight"
      )}
      lang="zh-CN"
    >
      {children}
    </span>
  );
}

/** A placeholder while the library loads. */
export const tileSkeleton =
  "relative min-h-28 animate-pulse overflow-hidden rounded-lg max-xs:min-h-24";

export function Tile({ item }: { item: LibraryEntry }) {
  const meaning = getItemMeaning(item);
  return (
    <Link
      aria-label={`${item.hanzi}, ${item.pinyin}: ${meaning.primary}`}
      className={tileClass(item.kind, item.status)}
      data-character={item.kind === "characters" || undefined}
      data-kind={item.kind}
      data-status={item.status}
      params={{ kind: item.kind, id: item.id }}
      to="/library/$kind/$id"
    >
      <TileGlyph kind={item.kind}>{item.hanzi}</TileGlyph>
      <span className="type-label max-w-full truncate text-muted-foreground">
        {item.pinyin}
      </span>
      <span className="type-body line-clamp-2 max-w-full leading-wrap">
        {meaning.primary}
      </span>
      {item.approximate ? (
        <span
          className="type-label absolute top-1.5 left-2 text-faint-foreground"
          title="Similar match"
        >
          ≈
        </span>
      ) : null}
    </Link>
  );
}
