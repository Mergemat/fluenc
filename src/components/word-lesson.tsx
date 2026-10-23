// A word lesson on the character lesson's skeleton: the word glossed character by character,
// its meaning and sound, one optional memory-link row, and "add to reviews". Enter saves.
import { Link2 } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import type { BuildItem } from "../lib/learner-views";
import { getItemMeaning } from "../lib/meaning";
import { saveEnrollment, saveLivingLinkOffline } from "../offline/progress";
import { useProgressMutation } from "../offline/use-progress-mutation";
import { DitherButton } from "./dither-kit/button";
import { WordGloss } from "./review-card";
import { AudioButton } from "./ui/hanzi";
import { PageHeader, SectionHead } from "./ui/layout";
import { useToast } from "./ui/toast";

type WordItem = Extract<BuildItem, { type: "word" }>;

function actionLabel(saving: boolean, tooShort: boolean, failed: boolean) {
  if (saving) {
    return "saving";
  }
  if (tooShort) {
    return "memory link needs 4+ characters";
  }
  return failed ? "could not save — try again" : "add to reviews";
}

export function WordLesson({ item }: { item: WordItem }) {
  const meaning = getItemMeaning(item);
  const syllables = item.syllables ?? null;
  const single = Array.from(item.hanzi).length === 1;
  // What the learner typed, or null to show the saved link (which a sync may still update).
  const [draft, setDraft] = useState<string | null>(null);
  const story = draft ?? item.livingLink;
  const trimmed = story.trim();
  // The server keeps links of four or more characters; anything shorter is a typo, not a link.
  const tooShort = trimmed.length > 0 && trimmed.length < 4;
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const finish = useProgressMutation(async () => {
    if (trimmed) {
      await saveLivingLinkOffline({ wordId: item.id, story: trimmed });
    }
    return saveEnrollment({ itemType: "word", itemId: item.id });
  });

  const { isPending, mutate } = finish;
  const primary = useCallback(() => {
    if (tooShort) {
      input.current?.focus();
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
  }, [tooShort, isPending, mutate, toast, item.hanzi]);
  const onEnter = useEffectEvent(primary);
  const editStory = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
    []
  );
  const storyKey = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.currentTarget.blur();
        return;
      }
      if (event.key !== "Enter" || event.nativeEvent.isComposing) {
        return;
      }
      event.preventDefault();
      primary();
    },
    [primary]
  );

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, button, a, [role=dialog]")
      ) {
        return;
      }
      event.preventDefault();
      onEnter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const prompt = single
    ? "what makes this reading stick?"
    : `why ${item.characterParts.map((part) => part.meaning).join(" + ")} means “${meaning.primary}”`;

  return (
    <article
      className="dx-studio dx-word-lesson"
      data-hanzi={item.hanzi}
      data-leaving={finish.isPending}
    >
      <PageHeader heading={false} title="learn" />
      <section aria-label="Word" className="dx-read dx-word-read">
        <WordGloss
          glosses={item.characterParts.map((part) => part.meaning)}
          hanzi={item.hanzi}
          revealed
          syllables={syllables}
        />
        <div className="dx-ident">
          <h1 className="dx-meaning">{meaning.primary}</h1>
          <p className="dx-alt">
            {meaning.also ? `also ${meaning.also}` : " "}
          </p>
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
        </div>
      </section>

      <section aria-label="Memory link" className="dx-clues">
        <SectionHead label="memory link" meta="optional" />
        <div className="dx-rows">
          <label className="dx-row" data-empty={!trimmed} data-kind="link">
            <span className="dx-code">
              <Link2 size={18} />
            </span>
            <span className="dx-role">{prompt}</span>
            <input
              aria-invalid={tooShort}
              aria-label="Memory link"
              autoComplete="off"
              className="dx-input"
              disabled={finish.isPending}
              enterKeyHint="done"
              onChange={editStory}
              onKeyDown={storyKey}
              placeholder={
                single
                  ? "a picture, a pun, a phrase"
                  : "a picture that joins the parts"
              }
              ref={input}
              spellCheck={false}
              value={story}
            />
          </label>
        </div>
      </section>

      <footer className="dx-actions">
        <DitherButton
          className="dx-action"
          color={tooShort ? "grey" : "blue"}
          disabled={finish.isPending}
          onClick={primary}
          variant={tooShort ? "dotted" : "gradient"}
        >
          <span role={finish.isError ? "alert" : undefined}>
            {actionLabel(finish.isPending, tooShort, finish.isError)}
          </span>
          <kbd>↵</kbd>
        </DitherButton>
      </footer>
    </article>
  );
}
