// A character lesson reads in movie-method order: character → meaning → pinyin → clues
// (saved ones already written in) → imagine the scene → name only what is missing, inline.
// Enter drives the whole lesson; nothing scrolls and nothing shifts while it loads.
import { ChevronDown, Info, PenLine, X } from "lucide-react";
import {
  type ChangeEvent,
  type CSSProperties,
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

import { directCharacters } from "../lib/character-props";
import { getItemMeaning } from "../lib/meaning";
import { saveEnrollment, saveMovieOffline } from "../offline/progress";
import { useProgressMutation } from "../offline/use-progress-mutation";
import { ClueCode } from "./character-studio/clue-code";
import {
  type Clue,
  cluePrompt,
  clueRole,
  cueKey,
  lessonClues,
} from "./character-studio/clues";
import type { CharacterItem, Cue } from "./character-studio/types";
import { DitherButton } from "./dither-kit/button";
import { DitherGradient } from "./dither-kit/gradient";
import { Rule } from "./ui/dither";
import {
  AudioButton,
  HanziGlyph,
  MoviePinyin,
  UsageHanzi,
  useUsage,
} from "./ui/hanzi";
import { PageHeader } from "./ui/layout";
import { partColor } from "./ui/part-colors";
import { useToast } from "./ui/toast";
import { WritingModal } from "./writing-modal";

interface ClueRowEvents {
  /** Move on from a clue: to the next one still empty, or finish the lesson. */
  onAdvance: (clue: Clue, input: HTMLInputElement) => void;
  onDraft: (clue: Clue, name: string) => void;
  onFocusChange: (id: string, focused: boolean) => void;
  onHover: (code: string | null) => void;
  onRegister: (id: string, input: HTMLInputElement | null) => void;
}

/** One clue: its code, what it stands for, and the learner's name for it, edited inline. */
function ClueRow({
  clue,
  lit,
  invalid,
  disabled,
  othersMissing,
  events,
}: {
  clue: Clue;
  lit: boolean;
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
      className="dx-row"
      data-empty={empty}
      data-kind={clue.kind}
      data-lit={lit}
      data-new={clue.status === "new"}
      onPointerEnter={prop ? enter : undefined}
      onPointerLeave={prop ? leave : undefined}
      style={
        prop
          ? ({ "--part": partColor(clue.partIndex) } as CSSProperties)
          : undefined
      }
    >
      <span
        className={`dx-code ${prop ? "font-hanzi-props" : ""}`}
        lang={prop ? "zh-CN" : undefined}
      >
        <ClueCode clue={clue} />
        {clue.count && clue.count > 1 ? <sup>×{clue.count}</sup> : null}
      </span>
      <span className="dx-role">{clueRole(clue)}</span>
      <input
        aria-invalid={invalid && empty}
        aria-label={`${clue.role} ${clue.code}${clue.meaning ? `, ${clue.meaning}` : ""}`}
        autoCapitalize="none"
        autoComplete="off"
        className="dx-input"
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

/** The words list itself: loading, unavailable offline, or one word per line. */
function UsageList({ usage }: { usage: ReturnType<typeof useUsage> }) {
  if (usage.pending) {
    return (
      <span className="dx-usage-skeleton">
        <DitherGradient cell={2} direction="right" from="grey" opacity={0.6} />
      </span>
    );
  }
  if (usage.error) {
    return (
      <p className="dx-usage-empty">
        words unavailable offline ·{" "}
        <button onClick={usage.retry} type="button">
          retry
        </button>
      </p>
    );
  }
  return (
    <ul className="dx-words-list">
      {usage.data?.words.map((word) => (
        <li
          className="dx-words-item"
          key={word.id}
          title={
            word.unknown
              ? `${word.unknown} new character${word.unknown > 1 ? "s" : ""}`
              : undefined
          }
        >
          <UsageHanzi chars={word.chars} />
          <span className="dx-words-py">{word.pinyin}</span>
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

  const count = usage.data?.words.length;
  // A character used on its own has nothing to show.
  if (usage.data && !count) {
    return null;
  }
  return (
    <div className="dx-words" ref={root}>
      <button
        aria-controls={panel}
        aria-expanded={open}
        aria-label={`Words with ${hanzi}`}
        className="dx-words-toggle"
        onClick={toggle}
        type="button"
      >
        words
        {count ? <span className="dx-words-count">{count}</span> : null}
        <ChevronDown aria-hidden="true" size={12} />
      </button>
      {open ? (
        <section
          aria-busy={usage.pending}
          aria-label={`Words with ${hanzi}`}
          className="dx-words-panel"
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
  return useProgressMutation(async () => {
    const name = (kind: Cue["kind"]) =>
      clues.find((clue) => clue.kind === kind)?.name.trim() ?? "";
    await saveMovieOffline({
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
    <footer className="dx-actions">
      {/* Grey dotted until every clue is named, then the blue gradient with bloom. */}
      <DitherButton
        className="dx-action"
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
        className="dx-action-side"
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
  const toast = useToast();
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
  }, [firstMissing, focusClue, isPending, mutate, toast, item.hanzi]);

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

  const row = (clue: Clue) => (
    <ClueRow
      clue={clue}
      disabled={finish.isPending}
      events={rowEvents}
      invalid={finish.isError}
      key={clue.id}
      lit={clue.kind === "prop" && highlighted === clue.code}
      othersMissing={missing.some((entry) => entry.id !== clue.id)}
    />
  );

  return (
    <article
      className="dx-studio"
      data-dense={props.length > 3}
      data-leaving={finish.isPending}
    >
      <PageHeader
        heading={false}
        meta={
          <>
            {direct ? "new prop" : "new character"}
            {item.focus ? <b className="dx-head-source">{item.focus}</b> : null}
            <UsageWords hanzi={item.hanzi} usage={usage} />
          </>
        }
        title="learn"
      />
      <section aria-label="Character" className="dx-read dx-read-character">
        <div className="dx-read-layout">
          <div className="dx-glyph-box">
            <HanziGlyph
              hanzi={item.hanzi}
              highlighted={highlighted}
              onHover={setHover}
              onSelect={pickPart}
              parts={props.map((prop) => prop.code)}
              xray={xray}
            />
          </div>
          <div className="dx-ident">
            <h1 className="dx-meaning">{meaning.primary}</h1>
            <p className="dx-alt">
              {meaning.also ? `also ${meaning.also}` : " "}
            </p>
            <div className="dx-sound">
              <MoviePinyin
                actorKey={item.movie.actorKey}
                finalKey={item.movie.finalKey}
                pinyin={item.pinyin}
                tone={item.movie.tone}
              />
              <AudioButton pinyin={item.pinyin} text={item.hanzi} />
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Clues" className="dx-clues">
        <div className="dx-label">
          <span>{direct ? "prop" : "clues"}</span>
          <Rule />
          {item.movie.componentNote ? (
            <button
              aria-expanded={noteOpen}
              aria-label="How the parts fit"
              className="dx-note-toggle"
              onClick={toggleNote}
              type="button"
            >
              <Info size={12} /> shape
            </button>
          ) : null}
          <span data-tone={missing.length ? "todo" : "done"}>
            {missing.length ? `${missing.length} to name` : "ready"}
          </span>
        </div>
        <div className="dx-rows">
          {direct ? null : (
            <div className="dx-rows-sound">
              {clues.filter((clue) => clue.kind !== "prop").map(row)}
            </div>
          )}
          <div className="dx-rows-props">{props.map(row)}</div>
        </div>
        {noteOpen && item.movie.componentNote ? (
          <div
            aria-label="How the parts fit"
            className="dx-popover"
            role="note"
          >
            <p>{item.movie.componentNote}</p>
            <button
              aria-label="Close shape note"
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
