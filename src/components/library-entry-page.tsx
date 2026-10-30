import {
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useState,
} from "react";
import { toast } from "sonner";
import type { LibraryData, PalaceData } from "../lib/learner-views";
import type {
  LibraryCharacter,
  LibraryEntry,
  LibraryWord,
} from "../lib/library-search";
import { getItemMeaning } from "../lib/meaning";
import { defaultToneRooms } from "../lib/pinyin";
import { cn } from "../lib/utils";
import { saveLivingLink, saveMovie, useSave } from "../progress/actions";
import { useLibrary, usePalace } from "../progress/views";
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
import {
  type Clue,
  cluePrompt,
  lessonClues,
  clueRole as roleText,
} from "./character-studio/clues";
import type { CharacterItem } from "./character-studio/types";
import { WordGloss } from "./review-card";
import { Chip } from "./ui/chip";
import {
  AudioButton,
  glyphBox,
  HanziGlyph,
  MoviePinyin,
  meaningText,
  pinyinText,
  soundRow,
} from "./ui/hanzi";
import {
  BackCrumb,
  CrumbSlash,
  Page,
  PageHeader,
  SectionHead,
} from "./ui/layout";
import { StatusMeta, Tile, TileGlyph, tileClass, Wall } from "./ui/tile";

/** The character or gloss beside its definition; stacked and centred on phones. */
const hero =
  "grid justify-items-center gap-6 text-center hero:grid-cols-entry hero:items-center hero:justify-items-start hero:gap-12 hero:text-left";
const definition = "grid justify-items-center gap-2 hero:justify-items-start";
const entryMeaning = cn(meaningText, "text-3xl");
const entrySound = cn(soundRow, "mt-0");
const section = "mt-12 grid gap-2";
const emptyNote = "type-control text-muted-foreground leading-wrap";
/** The memory link as a line of text, typed over in place. */
const linkInput =
  "type-body w-full border-border border-b bg-transparent py-3 text-foreground outline-none transition-colors placeholder:type-control placeholder:text-faint-foreground focus:border-blue";

/** Enter keeps what was typed, Escape puts the saved text back; either way the field lets go. */
function commitKeys(saved: string) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.currentTarget.value = saved;
      event.currentTarget.blur();
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };
}

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
  const library = useLibrary();
  const palace = usePalace();
  const back = from === "palace" ? "palace" : "library";

  return (
    <Page
      head={
        <PageHeader
          heading={false}
          meta={
            <StatusMeta status={item.status}>
              {statusLabel[item.status]}
            </StatusMeta>
          }
          title={
            <>
              <BackCrumb
                link={{
                  to: from === "palace" ? "/profile/palace" : "/library",
                }}
              >
                {back}
              </BackCrumb>
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
        <CharacterEntry item={item} library={library} palace={palace} />
      ) : (
        <WordEntry item={item} library={library} />
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
  const rename = useRename(item);
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
          <p className="type-control max-w-measure hero:text-left text-center text-muted-foreground">
            {item.strokes} {item.strokes === 1 ? "stroke" : "strokes"} · radical{" "}
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
          <Chip onClick={toggleXray} pressed={xray}>
            parts
          </Chip>
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
              // A new saved name, here or from a sync, replaces whatever the field holds.
              key={`${clue.id}:${clue.name}`}
              // The hairline under a row gives way when it or the row below is lit.
              lined={
                index < clues.length - 1 &&
                hover !== clue.code &&
                hover !== clues[index + 1]?.code
              }
              lit={hover === clue.code}
              onHover={setHover}
              onRename={rename}
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
          <Wall>
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

/**
 * Save one renamed clue. A name belongs to its code, not this character, so it changes in every
 * scene that uses it. The movie save leaves out the names it gets empty.
 */
function useRename(item: LibraryCharacter) {
  const { mutate } = useSave((clue: Pick<Clue, "kind" | "code" | "name">) =>
    saveMovie({
      characterId: item.id,
      actorKey: item.movie.actorKey,
      actorName: clue.kind === "actor" ? clue.name : "",
      finalKey: item.movie.finalKey,
      setName: clue.kind === "set" ? clue.name : "",
      tone: item.movie.tone,
      roomName: clue.kind === "room" ? clue.name : "",
      props:
        clue.kind === "prop"
          ? [{ component: clue.code, propName: clue.name }]
          : [],
    })
  );
  return useCallback(
    (clue: Clue, name: string) =>
      mutate(
        { ...clue, name },
        { onError: () => toast(`couldn’t save “${name}” — try again`) }
      ),
    [mutate]
  );
}

function ClueRow({
  clue,
  lit,
  lined,
  onHover,
  onRename,
}: {
  clue: Clue;
  lit: boolean;
  lined: boolean;
  onHover: (code: string | null) => void;
  onRename: (clue: Clue, name: string) => void;
}) {
  const empty = !clue.name.trim();
  const prop = clue.kind === "prop";
  const enter = useCallback(
    (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        onHover(clue.code);
      }
    },
    [onHover, clue.code]
  );
  const leave = useCallback(() => onHover(null), [onHover]);
  // Names can change but not be cleared: an emptied field goes back to the saved name.
  const commit = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const name = event.currentTarget.value.trim();
      if (!name) {
        event.currentTarget.value = clue.name;
      } else if (name !== clue.name.trim()) {
        onRename(clue, name);
      }
    },
    [onRename, clue]
  );
  return (
    <label
      className={clueRow({ lit, lined, editable: true })}
      data-kind={clue.kind}
      onPointerEnter={prop ? enter : undefined}
      onPointerLeave={prop ? leave : undefined}
      style={kindStyle(clue.kind, clue.partIndex)}
    >
      <span
        className={clueCode({ kind: clue.kind, lit, editable: true })}
        lang={prop ? "zh-CN" : undefined}
      >
        <ClueCode clue={clue} toneClassName={clueTone} />
        {clue.count && clue.count > 1 ? (
          <sup className={clueCount}>×{clue.count}</sup>
        ) : null}
      </span>
      <span className={clueRole()}>{roleText(clue)}</span>
      <input
        aria-label={`${clue.role} ${clue.code}${clue.meaning ? `, ${clue.meaning}` : ""}`}
        autoCapitalize="none"
        autoComplete="off"
        className={clueName({ empty, editable: true })}
        defaultValue={clue.name}
        enterKeyHint="done"
        onBlur={commit}
        onKeyDown={commitKeys(clue.name)}
        placeholder={empty ? cluePrompt(clue) : undefined}
        spellCheck={false}
      />
    </label>
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
  const livingLink =
    library?.words.find((word) => word.id === item.id)?.livingLink ??
    item.livingLink;
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
        <Wall>
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
        <MemoryLink
          // The loader's word is fixed; the cached library has the link as saved since.
          key={livingLink}
          saved={livingLink}
          wordId={item.id}
        />
      </section>
    </>
  );
}

function MemoryLink({ saved, wordId }: { saved: string; wordId: string }) {
  const { mutate } = useSave(saveLivingLink);
  // The server keeps links of four or more characters; a shorter one goes back to the saved link.
  const commit = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const story = event.currentTarget.value.trim();
      if (story.length < 4) {
        event.currentTarget.value = saved;
      } else if (story !== saved) {
        mutate(
          { wordId, story },
          { onError: () => toast("couldn’t save the memory link — try again") }
        );
      }
    },
    [mutate, saved, wordId]
  );
  return (
    <input
      aria-label="Memory link"
      autoComplete="off"
      className={linkInput}
      defaultValue={saved}
      enterKeyHint="done"
      onBlur={commit}
      onKeyDown={commitKeys(saved)}
      placeholder="no memory link yet — type one"
    />
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
