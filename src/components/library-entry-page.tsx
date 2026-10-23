// One library entry, built only from the cached library and palace (works offline).
// Characters show their glyph, scene and the words that use them; words show their gloss.
import { useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { type CSSProperties, useCallback, useState } from "react";
import { useGoBack } from "../hooks/use-go-back";
import type { LibraryData, PalaceData } from "../lib/learner-views";
import type {
  LibraryCharacter,
  LibraryEntry,
  LibraryWord,
} from "../lib/library-search";
import { getItemMeaning } from "../lib/meaning";
import { defaultToneRooms } from "../lib/pinyin";
import { libraryQueryOptions, palaceQueryOptions } from "../offline/queries";
import { ClueCode } from "./character-studio/clue-code";
import { type Clue, lessonClues } from "./character-studio/clues";
import type { CharacterItem } from "./character-studio/types";
import { DitherButton } from "./dither-kit/button";
import { Tile } from "./library-view";
import { WordGloss } from "./review-card";
import { Rule } from "./ui/dither";
import { AudioButton, HanziGlyph, MoviePinyin } from "./ui/hanzi";
import { Page, PageHeader } from "./ui/layout";
import { partColor } from "./ui/part-colors";

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
    <Page>
      <PageHeader
        heading={false}
        meta={
          <span className="dx-entry-status" data-status={item.status}>
            <i aria-hidden="true" />
            {statusLabel[item.status]}
          </span>
        }
        title={
          <>
            {canGoBack ? (
              <button onClick={goBack} type="button">
                <ArrowLeft size={14} />
                {back}
              </button>
            ) : (
              <Link to={from === "palace" ? "/profile/palace" : "/library"}>
                <ArrowLeft size={14} />
                {back}
              </Link>
            )}
            <span aria-hidden="true">/</span>
            <span className="font-hanzi" lang="zh-CN">
              {item.hanzi}
            </span>
          </>
        }
      />
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
      <header className="dx-entry-hero">
        <div className="dx-entry-glyph">
          <div className="dx-glyph-box">
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
        <div className="dx-entry-def">
          <h1 className="dx-meaning">{meaning.primary}</h1>
          <div className="dx-sound">
            <MoviePinyin
              actorKey={item.movie.actorKey}
              finalKey={item.movie.finalKey}
              pinyin={item.pinyin}
              tone={item.movie.tone}
            />
            <AudioButton pinyin={item.pinyin} text={item.hanzi} />
          </div>
          <Senses meanings={meaning.alternatives} />
          <DitherButton
            aria-pressed={xray}
            className="dx-tool"
            color={xray ? "blue" : "grey"}
            onClick={toggleXray}
            variant={xray ? "gradient" : "dotted"}
          >
            <span>parts</span>
          </DitherButton>
        </div>
      </header>

      <section aria-label="Scene" className="dx-entry-section">
        <div className="dx-label">
          <span>{props.length === clues.length ? "prop" : "scene"}</span>
          <Rule />
        </div>
        <div className="dx-rows dx-rows-static">
          {clues.map((clue) => (
            <ClueRow
              clue={clue}
              key={clue.id}
              lit={hover === clue.code}
              onHover={setHover}
            />
          ))}
        </div>
        {item.componentNote ? (
          <p
            aria-label="How the parts fit"
            className="dx-entry-note"
            role="note"
          >
            {item.componentNote}
          </p>
        ) : null}
      </section>

      <section aria-label="Words" className="dx-entry-section">
        <div className="dx-label">
          <span>in words</span>
          <Rule />
          <span>{words.length}</span>
        </div>
        {words.length ? (
          <div className="dx-wall dx-wall-tight">
            {words.map((word) => (
              <Tile item={{ ...word, kind: "words" }} key={word.id} />
            ))}
          </div>
        ) : (
          <p className="dx-entry-empty">used on its own in this course</p>
        )}
      </section>
    </>
  );
}

function ClueRow({
  clue,
  lit,
  onHover,
}: {
  clue: Clue;
  lit: boolean;
  onHover: (code: string | null) => void;
}) {
  const empty = !clue.name.trim();
  return (
    <div
      className="dx-row"
      data-kind={clue.kind}
      data-lit={lit}
      onPointerEnter={
        clue.kind === "prop" ? () => onHover(clue.code) : undefined
      }
      onPointerLeave={clue.kind === "prop" ? () => onHover(null) : undefined}
      style={
        clue.kind === "prop"
          ? ({ "--part": partColor(clue.partIndex) } as CSSProperties)
          : undefined
      }
    >
      <span
        className={`dx-code ${clue.kind === "prop" ? "font-hanzi-props" : ""}`}
        lang={clue.kind === "prop" ? "zh-CN" : undefined}
      >
        <ClueCode clue={clue} />
        {clue.count && clue.count > 1 ? <sup>×{clue.count}</sup> : null}
      </span>
      <span className="dx-role">
        {clue.kind === "prop"
          ? (clue.meaning ?? "prop")
          : clue.role.toLowerCase()}
      </span>
      <span className="dx-input dx-static" data-empty={empty}>
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
      <header className="dx-entry-hero dx-entry-word">
        <WordGloss
          glosses={item.characterParts.map((part) => part.meaning)}
          hanzi={item.hanzi}
          revealed
          syllables={syllables}
        />
        <div className="dx-entry-def">
          <h1 className="dx-meaning">{meaning.primary}</h1>
          <div className="dx-sound">
            {syllables ? null : (
              <span className="dx-py dx-py-plain">{item.pinyin}</span>
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

      <section aria-label="Characters" className="dx-entry-section">
        <div className="dx-label">
          <span>characters</span>
          <Rule />
        </div>
        <div className="dx-wall dx-wall-tight">
          {characters.map(({ part, character }) =>
            character ? (
              <Tile
                item={{ ...character, kind: "characters" }}
                key={character.id}
              />
            ) : (
              <span className="dx-tile" data-status="new" key={part.id}>
                <span className="dx-tile-hanzi font-hanzi">{part.hanzi}</span>
              </span>
            )
          )}
        </div>
      </section>

      <section aria-label="Memory link" className="dx-entry-section">
        <div className="dx-label">
          <span>memory link</span>
          <Rule />
        </div>
        {item.livingLink ? (
          <p className="dx-entry-link">{item.livingLink}</p>
        ) : (
          <p className="dx-entry-empty">
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
    <ol className="dx-senses">
      {(open ? meanings : meanings.slice(0, 3)).map((meaning) => (
        <li key={meaning}>{meaning}</li>
      ))}
      {hidden > 0 ? (
        <li className="dx-senses-more">
          <button aria-expanded={open} onClick={toggle} type="button">
            {open ? "fewer" : `+${hidden} more`}
          </button>
        </li>
      ) : null}
    </ol>
  );
}
