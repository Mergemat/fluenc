// One library entry, built only from the cached library and palace (works offline).
// Characters show their glyph, scene and the words that use them; words show their gloss.
import { useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback, useState } from "react";
import { useGoBack } from "../hooks/use-go-back";
import type { LibraryData, PalaceData } from "../lib/learner-views";
import type {
  LibraryCharacter,
  LibraryEntry,
  LibraryWord,
} from "../lib/library-search";
import { getItemMeaning } from "../lib/meaning";
import { defaultToneRooms } from "../lib/pinyin";
import { cn } from "../lib/utils";
import { libraryQueryOptions, palaceQueryOptions } from "../offline/queries";
import { ClueCode } from "./character-studio/clue-code";
import {
  clueCode,
  clueCount,
  clueName,
  clueRole,
  clueRow,
  clueTone,
  kindStyle,
} from "./character-studio/clue-row";
import { type Clue, lessonClues } from "./character-studio/clues";
import type { CharacterItem } from "./character-studio/types";
import { DitherButton } from "./dither-kit/button";
import { WordGloss } from "./review-card";
import { tool } from "./ui/buttons";
import {
  AudioButton,
  glyphBox,
  HanziGlyph,
  MoviePinyin,
  meaningText,
  pinyinText,
  soundRow,
} from "./ui/hanzi";
import { CrumbSlash, crumb, Page, PageHeader, SectionHead } from "./ui/layout";
import { StatusDot, Tile, TileGlyph, tileClass, Wall } from "./ui/tile";

/** The character or gloss beside its definition; stacked and centred on phones. */
const hero =
  "grid justify-items-center gap-6 pb-6 text-center hero:grid-cols-entry hero:items-center hero:justify-items-start hero:gap-12 hero:text-left";
const definition = "grid justify-items-center gap-2 hero:justify-items-start";
const entryMeaning = cn(meaningText, "text-3xl");
const entrySound = cn(soundRow, "mt-0");
const section = "mt-12 grid gap-2";
const emptyNote = "type-control text-faint-foreground leading-wrap";

const statusLabel = {
  review: "learned",
  learning: "learning",
  new: "new",
} as const;

export function LibraryEntryPage({
  item,
  from,
}: {
  item: LibraryEntry;
  from?: "palace";
}) {
  const goBack = useGoBack();
  const canGoBack = useCanGoBack();
  const library = useQuery(libraryQueryOptions);
  const palace = useQuery(palaceQueryOptions);
  const back = from === "palace" ? "palace" : "library";

  return (
    <Page
      head={
        <PageHeader
          heading={false}
          meta={
            <span className="inline-flex items-center gap-2">
              <StatusDot status={item.status} />
              {statusLabel[item.status]}
            </span>
          }
          title={
            <>
              {canGoBack ? (
                <button className={crumb} onClick={goBack} type="button">
                  <ArrowLeft size={14} />
                  {back}
                </button>
              ) : (
                <Link
                  className={crumb}
                  to={from === "palace" ? "/profile/palace" : "/library"}
                >
                  <ArrowLeft size={14} />
                  {back}
                </Link>
              )}
              <CrumbSlash />
              <span className="font-hanzi" lang="zh-CN">
                {item.hanzi}
              </span>
            </>
          }
        />
      }
    >
      {item.kind === "characters" ? (
        <CharacterEntry
          item={item}
          library={library.data}
          palace={palace.data}
        />
      ) : (
        <WordEntry item={item} library={library.data} />
      )}
    </Page>
  );
}

/** Rebuild the lesson's movie for a library character from the learner's saved palace names. */
function characterMovie(
  item: LibraryCharacter,
  library?: LibraryData,
  palace?: PalaceData
): Pick<CharacterItem, "hanzi" | "movie"> {
  const characters = new Map(
    library?.characters.map((entry) => [entry.hanzi, entry])
  );
  return {
    hanzi: item.hanzi,
    movie: {
      ...item.movie,
      actorName:
        palace?.actors.find((actor) => actor.key === item.movie.actorKey)
          ?.name ?? "",
      setName:
        palace?.sets.find((set) => set.key === item.movie.finalKey)?.name ?? "",
      roomName:
        palace?.rooms.find((room) => room.tone === item.movie.tone)?.name ??
        defaultToneRooms[item.movie.tone] ??
        "",
      isPrimitive: item.structure === "atomic",
      componentNote: item.componentNote,
      configured: false,
      components: item.components.map((part) => {
        const character = characters.get(part.hanzi);
        return {
          ...part,
          propName:
            palace?.props.find((prop) => prop.key === part.hanzi)?.name ?? "",
          character: character
            ? { pinyin: character.pinyin, keyword: character.keyword }
            : null,
        };
      }),
    },
  };
}

function CharacterEntry({
  item,
  library,
  palace,
}: {
  item: LibraryCharacter;
  library?: LibraryData;
  palace?: PalaceData;
}) {
  const meaning = getItemMeaning(item);
  const movie = characterMovie(item, library, palace);
  const clues = lessonClues(movie);
  const props = clues.filter((clue) => clue.kind === "prop");
  const [xray, setXray] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const toggleXray = useCallback(() => setXray((value) => !value), []);
  const pinPart = useCallback(
    (code: string) => setHover((previous) => (previous === code ? null : code)),
    []
  );
  const words = (library?.words ?? [])
    .filter(
      (word) => word.hanzi !== item.hanzi && word.hanzi.includes(item.hanzi)
    )
    .sort((a, b) => a.rank - b.rank);

  return (
    <>
      <header className={hero}>
        <div className="h-entry-glyph w-full max-w-72">
          <div className={cn(glyphBox, "h-full")}>
            <HanziGlyph
              hanzi={item.hanzi}
              highlighted={hover}
              onHover={setHover}
              onSelect={pinPart}
              parts={props.map((prop) => prop.code)}
              xray={xray}
            />
          </div>
        </div>
        <div className={definition}>
          <h1 className={entryMeaning}>{meaning.primary}</h1>
          <div className={entrySound}>
            <MoviePinyin
              actorKey={item.movie.actorKey}
              finalKey={item.movie.finalKey}
              pinyin={item.pinyin}
              tone={item.movie.tone}
            />
            <AudioButton pinyin={item.pinyin} text={item.hanzi} />
          </div>
          <Senses meanings={meaning.alternatives} />
          <p className="type-control max-w-measure text-center text-faint-foreground">
            {item.strokes} strokes · radical{" "}
            <span className="font-hanzi" lang="zh-CN">
              {item.radical}
            </span>
            {item.readings.map((reading) => (
              <span key={reading.pinyin}>
                {" "}
                · also {reading.pinyin}, {reading.meanings[0]}
              </span>
            ))}
          </p>
          <DitherButton
            aria-pressed={xray}
            className={tool}
            color={xray ? "blue" : "grey"}
            onClick={toggleXray}
            variant={xray ? "gradient" : "dotted"}
          >
            <span>parts</span>
          </DitherButton>
        </div>
      </header>

      <section aria-label="Scene" className={section}>
        <SectionHead
          className="mb-0"
          label={props.length === clues.length ? "prop" : "scene"}
        />
        <div className="overflow-hidden">
          {clues.map((clue, index) => (
            <ClueRow
              clue={clue}
              key={clue.id}
              // The hairline under a row gives way when it or the row below is lit.
              lined={
                index < clues.length - 1 &&
                hover !== clue.code &&
                hover !== clues[index + 1]?.code
              }
              lit={hover === clue.code}
              onHover={setHover}
            />
          ))}
        </div>
        {item.componentNote ? (
          <p
            aria-label="How the parts fit"
            className="type-body text-muted-foreground"
            role="note"
          >
            {item.componentNote}
          </p>
        ) : null}
      </section>

      <section aria-label="Words" className={section}>
        <SectionHead className="mb-0" label="in words" meta={words.length} />
        {words.length ? (
          <Wall tight>
            {words.map((word) => (
              <Tile item={{ ...word, kind: "words" }} key={word.id} />
            ))}
          </Wall>
        ) : (
          <p className={emptyNote}>used on its own in this course</p>
        )}
      </section>
    </>
  );
}

function ClueRow({
  clue,
  lit,
  lined,
  onHover,
}: {
  clue: Clue;
  lit: boolean;
  lined: boolean;
  onHover: (code: string | null) => void;
}) {
  const empty = !clue.name.trim();
  return (
    <div
      className={clueRow({ lit, lined })}
      data-kind={clue.kind}
      onPointerEnter={
        clue.kind === "prop" ? () => onHover(clue.code) : undefined
      }
      onPointerLeave={clue.kind === "prop" ? () => onHover(null) : undefined}
      style={kindStyle(clue.kind, clue.partIndex)}
    >
      <span
        className={clueCode({ kind: clue.kind, lit })}
        lang={clue.kind === "prop" ? "zh-CN" : undefined}
      >
        <ClueCode clue={clue} toneClassName={clueTone} />
        {clue.count && clue.count > 1 ? (
          <sup className={clueCount}>×{clue.count}</sup>
        ) : null}
      </span>
      <span className={clueRole()}>
        {clue.kind === "prop"
          ? (clue.meaning ?? "prop")
          : clue.role.toLowerCase()}
      </span>
      <span className={clueName({ empty })}>
        {empty ? "not named yet" : clue.name}
      </span>
    </div>
  );
}

function WordEntry({
  item,
  library,
}: {
  item: LibraryWord;
  library?: LibraryData;
}) {
  const meaning = getItemMeaning(item);
  const syllables = item.syllables ?? null;
  // A word's characters are distinct, so each part's id is a stable key.
  const characters = item.characterParts.map((part) => ({
    part,
    character: library?.characters.find((entry) => entry.id === part.id),
  }));

  return (
    <>
      <header className={cn(hero, "hero:grid-cols-entry-word")}>
        <WordGloss
          glosses={item.characterParts.map((part) => part.meaning)}
          hanzi={item.hanzi}
          hanziClassName="text-gloss-entry"
          revealed
          syllables={syllables}
        />
        <div className={definition}>
          <h1 className={entryMeaning}>{meaning.primary}</h1>
          <div className={entrySound}>
            {syllables ? null : (
              <span className={cn(pinyinText, "text-foreground")}>
                {item.pinyin}
              </span>
            )}
            <AudioButton
              label="listen"
              pinyin={item.pinyin}
              text={item.hanzi}
            />
          </div>
          <Senses meanings={meaning.alternatives} />
        </div>
      </header>

      <section aria-label="Characters" className={section}>
        <SectionHead className="mb-0" label="characters" />
        <Wall tight>
          {characters.map(({ part, character }) =>
            character ? (
              <Tile
                item={{ ...character, kind: "characters" }}
                key={character.id}
              />
            ) : (
              <span
                className={tileClass("characters", "new")}
                data-character
                key={part.id}
              >
                <TileGlyph kind="characters">{part.hanzi}</TileGlyph>
              </span>
            )
          )}
        </Wall>
      </section>

      <section aria-label="Memory link" className={section}>
        <SectionHead className="mb-0" label="memory link" />
        {item.livingLink ? (
          <p className="type-body border-border border-b py-3 text-foreground">
            {item.livingLink}
          </p>
        ) : (
          <p className={emptyNote}>
            no memory link yet — add one in its lesson
          </p>
        )}
      </section>
    </>
  );
}

/** Dictionary senses: the first three, the rest one tap away. */
function Senses({ meanings }: { meanings: string[] }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  if (!meanings.length) {
    return null;
  }
  const hidden = meanings.length - 3;
  return (
    <ol className="type-body grid max-w-measure list-inside list-decimal gap-1 text-muted-foreground marker:text-faint-foreground">
      {(open ? meanings : meanings.slice(0, 3)).map((meaning) => (
        <li className="only:list-none" key={meaning}>
          {meaning}
        </li>
      ))}
      {hidden > 0 ? (
        <li className="list-none">
          <button
            aria-expanded={open}
            className="text-blue"
            onClick={toggle}
            type="button"
          >
            {open ? "fewer" : `+${hidden} more`}
          </button>
        </li>
      ) : null}
    </ol>
  );
}
