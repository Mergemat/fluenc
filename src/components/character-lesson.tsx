// A character lesson reads in movie-method order: character → meaning → pinyin → clues
// (saved ones already written in) → imagine the scene → name only what is missing, inline.
// Enter drives the whole lesson; nothing scrolls and nothing shifts while it loads.
import { ChevronDown, Info, PenLine, X } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { directCharacters } from "../lib/character-props";
import { getItemMeaning } from "../lib/meaning";
import { cn } from "../lib/utils";
import { saveEnrollment, saveMovie, useSave } from "../progress/actions";
import { ClueCode } from "./character-studio/clue-code";
import {
  clueCode,
  clueCount,
  clueName,
  clueRow,
  clueTone,
  kindStyle,
  clueRole as roleClass,
} from "./character-studio/clue-row";
import {
  type Clue,
  cluePrompt,
  clueRole,
  cueKey,
  lessonClues,
} from "./character-studio/clues";
import {
  studio,
  studioAction,
  studioActionSide,
  studioActions,
  studioAlt,
  studioClues,
  studioMeaning,
  studioPinyin,
  studioRead,
} from "./character-studio/studio";
import type { CharacterItem, Cue } from "./character-studio/types";
import { DitherButton } from "./dither-kit/button";
import {
  AudioButton,
  glyphBox,
  HanziGlyph,
  ident,
  MoviePinyin,
  soundRow,
  UsageHanzi,
  useUsage,
} from "./ui/hanzi";
import { PageHeader, SectionHead } from "./ui/layout";
import { WritingModal } from "./writing-modal";

interface ClueRowEvents {
  /** Move on from a clue: to the next one still empty, or finish the lesson. */
  onAdvance: (clue: Clue, input: HTMLInputElement) => void;
  onDraft: (clue: Clue, name: string) => void;
  onFocusChange: (id: string, focused: boolean) => void;
  onHover: (code: string | null) => void;
  onRegister: (id: string, input: HTMLInputElement | null) => void;
}

/** A row still to name glows; one named in this lesson keeps a quiet mark. */
function markerOf(empty: boolean, isNew: boolean) {
  if (empty) {
    return "empty";
  }
  return isNew ? "new" : null;
}

/** One clue: its code, what it stands for, and the learner's name for it, edited inline. */
function ClueRow({
  clue,
  lit,
  lined,
  dense,
  invalid,
  disabled,
  othersMissing,
  events,
}: {
  clue: Clue;
  lit: boolean;
  lined: boolean;
  dense: boolean;
  invalid: boolean;
  disabled: boolean;
  othersMissing: boolean;
  events: ClueRowEvents;
}) {
  const empty = !clue.name.trim();
  const prop = clue.kind === "prop";
  const { onAdvance, onDraft, onFocusChange, onHover, onRegister } = events;
  const enter = useCallback(
    (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        onHover(clue.code);
      }
    },
    [onHover, clue.code]
  );
  const leave = useCallback(() => onHover(null), [onHover]);
  const focus = useCallback(
    () => onFocusChange(clue.id, true),
    [onFocusChange, clue.id]
  );
  const blur = useCallback(
    () => onFocusChange(clue.id, false),
    [onFocusChange, clue.id]
  );
  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onDraft(clue, event.target.value),
    [onDraft, clue]
  );
  const keyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.currentTarget.blur();
        return;
      }
      if (event.key !== "Enter" || event.nativeEvent.isComposing) {
        return;
      }
      event.preventDefault();
      onAdvance(clue, event.currentTarget);
    },
    [onAdvance, clue]
  );
  const register = useCallback(
    (element: HTMLInputElement | null) => onRegister(clue.id, element),
    [onRegister, clue.id]
  );

  return (
    <label
      className={clueRow({
        lit,
        lined,
        dense,
        editable: true,
        marker: markerOf(empty, clue.status === "new"),
      })}
      data-kind={clue.kind}
      onPointerEnter={prop ? enter : undefined}
      onPointerLeave={prop ? leave : undefined}
      style={kindStyle(clue.kind, clue.partIndex)}
    >
      <span
        className={clueCode({ kind: clue.kind, lit, dense, editable: true })}
        lang={prop ? "zh-CN" : undefined}
      >
        <ClueCode clue={clue} toneClassName={clueTone} />
        {clue.count && clue.count > 1 ? (
          <sup className={clueCount}>×{clue.count}</sup>
        ) : null}
      </span>
      <span className={roleClass(dense)}>{clueRole(clue)}</span>
      <input
        aria-invalid={invalid && empty}
        aria-label={`${clue.role} ${clue.code}${clue.meaning ? `, ${clue.meaning}` : ""}`}
        autoCapitalize="none"
        autoComplete="off"
        className={clueName({ empty, dense, editable: true })}
        disabled={disabled}
        enterKeyHint={othersMissing ? "next" : "done"}
        onBlur={blur}
        onChange={change}
        onFocus={focus}
        onKeyDown={keyDown}
        placeholder={empty ? cluePrompt(clue) : undefined}
        ref={register}
        spellCheck={false}
        value={clue.name}
      />
    </label>
  );
}

/** The words list itself, one word per line. */
function UsageList({ usage }: { usage: ReturnType<typeof useUsage> }) {
  return (
    <ul className="grid list-none">
      {usage.words.map((word) => (
        <li
          className="type-body flex min-w-0 items-baseline gap-2 whitespace-nowrap text-muted-foreground leading-8"
          key={word.id}
          title={
            word.unknown
              ? `${word.unknown} new character${word.unknown > 1 ? "s" : ""}`
              : undefined
          }
        >
          <UsageHanzi chars={word.chars} />
          <span className="type-label text-faint-foreground">
            {word.pinyin}
          </span>
          <span>{word.meaning}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Words that use the character, behind a button in the lesson's corner so they take no room
 * until wanted. Escape or a tap anywhere else closes the list.
 */
function UsageWords({
  hanzi,
  usage,
}: {
  hanzi: string;
  usage: ReturnType<typeof useUsage>;
}) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnKey);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnKey);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);

  const count = usage.words.length;
  // A character used on its own has nothing to show.
  if (!count) {
    return null;
  }
  return (
    <div className="relative z-6 grid justify-items-end" ref={root}>
      <button
        aria-controls={panel}
        aria-expanded={open}
        aria-label={`Words with ${hanzi}`}
        className="type-label inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background pr-2.5 pl-2.5 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground aria-expanded:border-border-strong aria-expanded:text-foreground"
        onClick={toggle}
        type="button"
      >
        words
        <span className="text-foreground">{count}</span>
        <ChevronDown aria-hidden="true" size={12} />
      </button>
      {open ? (
        <section
          aria-label={`Words with ${hanzi}`}
          className="absolute top-full right-0 mt-1.5 box-border min-w-56 max-w-panel origin-top-right animate-enter rounded-lg border border-border-strong bg-popover px-3.5 py-2 shadow-popover"
          id={panel}
        >
          <UsageList usage={usage} />
        </section>
      ) : null}
    </div>
  );
}

function actionLabel(saving: boolean, missing: number, failed: boolean) {
  if (saving) {
    return "saving";
  }
  if (missing) {
    return `name ${missing} clue${missing > 1 ? "s" : ""}`;
  }
  return failed ? "could not save — try again" : "add to reviews";
}

interface LessonShortcuts {
  finish: () => void;
  toggleXray: () => void;
  write: () => void;
}

/** Enter finishes, x shows every part, w opens writing — unless typing or in a dialog. */
function useLessonShortcuts(shortcuts: LessonShortcuts) {
  const onKey = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return;
    }
    if (
      event.target instanceof Element &&
      event.target.closest("input, textarea, button, a, [role=dialog], dialog")
    ) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      shortcuts.finish();
    } else if (event.key === "x") {
      shortcuts.toggleXray();
    } else if (event.key === "w") {
      shortcuts.write();
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Save the scene's names, then put the character into reviews. */
function useSaveLesson(item: CharacterItem, clues: Clue[]) {
  return useSave(async () => {
    const name = (kind: Cue["kind"]) =>
      clues.find((clue) => clue.kind === kind)?.name.trim() ?? "";
    await saveMovie({
      characterId: item.id,
      actorKey: item.movie.actorKey,
      actorName: name("actor"),
      finalKey: item.movie.finalKey,
      setName: name("set"),
      tone: item.movie.tone,
      roomName: name("room"),
      props: clues
        .filter((clue) => clue.kind === "prop")
        .map((prop) => ({ component: prop.code, propName: prop.name.trim() })),
    });
    return saveEnrollment({ itemType: "character", itemId: item.id });
  });
}

function LessonActions({
  hanzi,
  missing,
  saving,
  failed,
  onFinish,
  onWrite,
}: {
  hanzi: string;
  missing: number;
  saving: boolean;
  failed: boolean;
  onFinish: () => void;
  onWrite: () => void;
}) {
  return (
    <footer className={studioActions} data-actions>
      {/* Grey dotted until every clue is named, then the blue gradient with bloom. */}
      <DitherButton
        className={studioAction}
        color={missing ? "grey" : "blue"}
        disabled={saving}
        onClick={onFinish}
        variant={missing ? "dotted" : "gradient"}
      >
        <span role={failed ? "alert" : undefined}>
          {actionLabel(saving, missing, failed)}
        </span>
        <kbd>↵</kbd>
      </DitherButton>
      <DitherButton
        aria-label={`Write ${hanzi}`}
        className={studioActionSide}
        color="grey"
        onClick={onWrite}
        title="write (w)"
        variant="dotted"
      >
        <PenLine size={17} />
      </DitherButton>
    </footer>
  );
}

export function CharacterLesson({ item }: { item: CharacterItem }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const clues = lessonClues(item, drafts);
  const props = clues.filter((clue) => clue.kind === "prop");
  const missing = clues.filter((clue) => !clue.name.trim());
  const direct = directCharacters.has(item.hanzi);
  const meaning = getItemMeaning(item);
  const usage = useUsage(item.hanzi);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const [active, setActive] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [xray, setXray] = useState(false);
  const [writing, setWriting] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const activeClue = clues.find((clue) => clue.id === active);
  const highlighted =
    hover ?? (activeClue?.kind === "prop" ? activeClue.code : null) ?? pinned;

  const finish = useSaveLesson(item, clues);
  const { isPending, mutate } = finish;

  const focusClue = useCallback((clue?: Clue) => {
    if (clue) {
      inputs.current.get(clue.id)?.focus();
    }
  }, []);
  const [firstMissing] = missing;
  const primary = useCallback(() => {
    if (firstMissing) {
      focusClue(firstMissing);
      return;
    }
    if (isPending) {
      return;
    }
    mutate(undefined, {
      onSuccess: () =>
        toast(
          <>
            <b className="font-hanzi">{item.hanzi}</b>
            <span>added to reviews</span>
          </>
        ),
    });
  }, [firstMissing, focusClue, isPending, mutate, item.hanzi]);

  useLessonShortcuts({
    finish: primary,
    toggleXray: () => setXray((value) => !value),
    write: () => setWriting(true),
  });

  const advance = useCallback(
    (clue: Clue, input: HTMLInputElement) => {
      const next = [...clues.slice(clues.indexOf(clue) + 1), ...clues].find(
        (entry) => entry.id !== clue.id && !entry.name.trim()
      );
      if (next) {
        focusClue(next);
      } else {
        input.blur();
        primary();
      }
    },
    [clues, focusClue, primary]
  );
  const draft = useCallback(
    (clue: Clue, name: string) =>
      setDrafts((previous) => ({ ...previous, [cueKey(clue)]: name })),
    []
  );
  const focusChange = useCallback((id: string, focused: boolean) => {
    setActive((previous) => {
      if (focused) {
        return id;
      }
      return previous === id ? null : previous;
    });
  }, []);
  const register = useCallback((id: string, input: HTMLInputElement | null) => {
    if (input) {
      inputs.current.set(id, input);
    } else {
      inputs.current.delete(id);
    }
  }, []);
  const rowEvents = useMemo<ClueRowEvents>(
    () => ({
      onAdvance: advance,
      onDraft: draft,
      onFocusChange: focusChange,
      onHover: setHover,
      onRegister: register,
    }),
    [advance, draft, focusChange, register]
  );

  const pickPart = useCallback(
    (code: string) => {
      setPinned((previous) => (previous === code ? null : code));
      focusClue(props.find((prop) => prop.code === code && !prop.name.trim()));
    },
    [props, focusClue]
  );
  const toggleNote = useCallback(() => setNoteOpen((open) => !open), []);
  const closeNote = useCallback(() => setNoteOpen(false), []);
  const openWriting = useCallback(() => setWriting(true), []);
  const closeWriting = useCallback(() => setWriting(false), []);

  const dense = props.length > 3;
  const lit = (clue: Clue) => clue.kind === "prop" && highlighted === clue.code;
  // The hairline under a row gives way when it or the row below is lit or being named.
  const shown = (clue: Clue | undefined) =>
    clue !== undefined && (lit(clue) || active === clue.id);
  const rows = (group: Clue[], groupDense: boolean) =>
    group.map((clue, index) => (
      <ClueRow
        clue={clue}
        dense={groupDense}
        disabled={finish.isPending}
        events={rowEvents}
        invalid={finish.isError}
        key={clue.id}
        lined={
          index < group.length - 1 && !shown(clue) && !shown(group[index + 1])
        }
        lit={lit(clue)}
        othersMissing={missing.some((entry) => entry.id !== clue.id)}
      />
    ));

  return (
    <article
      className={studio(true)}
      data-leaving={finish.isPending || undefined}
    >
      <PageHeader
        heading={false}
        meta={<UsageWords hanzi={item.hanzi} usage={usage} />}
        title="learn"
      />
      <section
        aria-label="Character"
        className={cn(studioRead, "@container-size/read")}
      >
        {/* Stacked when tall, side by side when wide for its height: whichever gives the bigger
            glyph. */}
        <div className="flex h-full read-wide:flex-row flex-col items-center justify-center gap-2 studio:gap-6 read-wide:max-studio:gap-4">
          <div
            className={cn(
              glyphBox,
              "read-wide:h-full read-wide:grow-0 studio:grow-0 studio:basis-glyph read-wide:max-studio:basis-32/50"
            )}
          >
            <HanziGlyph
              hanzi={item.hanzi}
              highlighted={highlighted}
              onHover={setHover}
              onSelect={pickPart}
              parts={props.map((prop) => prop.code)}
              xray={xray}
            />
          </div>
          <div
            className={cn(
              ident,
              "read-wide:min-w-0 read-wide:shrink read-wide:basis-9/25 read-wide:justify-items-start read-wide:text-left"
            )}
          >
            <h1 className={cn(studioMeaning, "read-wide:wrap-anywhere")}>
              {meaning.primary}
            </h1>
            <p className={studioAlt}>
              {meaning.also ? `also ${meaning.also}` : " "}
            </p>
            <div className={soundRow}>
              <MoviePinyin
                actorKey={item.movie.actorKey}
                className={studioPinyin}
                finalKey={item.movie.finalKey}
                pinyin={item.pinyin}
                tone={item.movie.tone}
              />
              <AudioButton pinyin={item.pinyin} text={item.hanzi} />
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Clues" className={studioClues}>
        <SectionHead
          className="mb-0"
          label={direct ? "prop" : "clues"}
          meta={missing.length ? `${missing.length} to name` : "ready"}
          tone={missing.length ? "todo" : "done"}
        >
          {item.movie.componentNote ? (
            <button
              aria-expanded={noteOpen}
              aria-label="How the parts fit"
              className="type-label inline-flex items-center gap-1 text-muted-foreground hover:text-foreground aria-expanded:text-foreground"
              onClick={toggleNote}
              type="button"
            >
              <Info size={12} /> shape
            </button>
          ) : null}
        </SectionHead>
        <div className="overflow-hidden">
          {direct ? null : (
            <div className="grid grid-cols-1">
              {rows(
                clues.filter((clue) => clue.kind !== "prop"),
                false
              )}
            </div>
          )}
          <div
            className={cn(
              "grid",
              dense ? "grid-cols-2" : "grid-cols-1",
              !direct && "border-border border-t"
            )}
          >
            {rows(props, dense)}
          </div>
        </div>
        {noteOpen && item.movie.componentNote ? (
          <div
            aria-label="How the parts fit"
            className="absolute inset-x-0 top-6 z-5 origin-top animate-enter rounded-lg border border-border-strong bg-popover py-3 pr-10 pl-3.5 shadow-popover"
            role="note"
          >
            <p className="type-body text-foreground">
              {item.movie.componentNote}
            </p>
            <button
              aria-label="Close shape note"
              className="absolute top-2.5 right-2.5 grid size-6 place-items-center text-muted-foreground"
              onClick={closeNote}
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}
      </section>

      <LessonActions
        failed={finish.isError}
        hanzi={item.hanzi}
        missing={missing.length}
        onFinish={primary}
        onWrite={openWriting}
        saving={finish.isPending}
      />

      {writing ? (
        <WritingModal
          hanzi={item.hanzi}
          onClose={closeWriting}
          parts={props.map((prop) => ({
            code: prop.code,
            label: prop.name.trim() || prop.meaning || "",
          }))}
        />
      ) : null}
    </article>
  );
}
