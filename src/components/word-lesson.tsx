// A word lesson on the character lesson's skeleton: the word glossed character by character,
// its meaning and sound, one optional memory-link row, and "add to reviews". Enter saves.
import { Link2 } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { isShortcut, useWindowKeys } from "../hooks/use-window-keys";
import type { BuildItem } from "../lib/learner-views";
import { getItemMeaning } from "../lib/meaning";
import { cn } from "../lib/utils";
import { saveEnrollment, saveLivingLink, useSave } from "../progress/actions";
import {
  clueCode,
  clueName,
  clueRole,
  clueRow,
  kindStyle,
} from "./character-studio/clue-row";
import { finishLabel, toastAdded } from "./character-studio/finish";
import {
  studio,
  studioAction,
  studioActions,
  studioAlt,
  studioClues,
  studioMeaning,
  studioPinyin,
  studioRead,
} from "./character-studio/studio";
import { WordGloss } from "./review-card";
import { ActionButton } from "./ui/button";
import { AudioButton, ident, pinyinText, soundRow } from "./ui/hanzi";
import { PageHeader, SectionHead } from "./ui/layout";

type WordItem = Extract<BuildItem, { type: "word" }>;

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
  const finish = useSave(async () => {
    if (trimmed) {
      await saveLivingLink({ wordId: item.id, story: trimmed });
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
    mutate(undefined, { onSuccess: () => toastAdded(item.hanzi) });
  }, [tooShort, isPending, mutate, item.hanzi]);
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

  useWindowKeys((event) => {
    if (event.key === "Enter" && !event.defaultPrevented && isShortcut(event)) {
      event.preventDefault();
      primary();
    }
  });

  const prompt = single
    ? "what makes this reading stick?"
    : `why ${item.characterParts.map((part) => part.meaning).join(" + ")} means “${meaning.primary}”`;

  return (
    <article
      className={studio(false)}
      data-hanzi={item.hanzi}
      data-leaving={finish.isPending || undefined}
    >
      <PageHeader heading={false} title="learn" />
      <section
        aria-label="Word"
        className={cn(
          studioRead,
          "flex flex-col items-center justify-center gap-6 studio:gap-4"
        )}
      >
        <WordGloss
          glosses={item.characterParts.map((part) => part.meaning)}
          hanzi={item.hanzi}
          revealed
          syllables={syllables}
        />
        <div className={ident}>
          <h1 className={studioMeaning}>{meaning.primary}</h1>
          <p className={studioAlt}>
            {meaning.also ? `also ${meaning.also}` : " "}
          </p>
          <div className={soundRow}>
            {syllables ? null : (
              <span className={cn(pinyinText, "text-foreground", studioPinyin)}>
                {item.pinyin}
              </span>
            )}
            <AudioButton
              label="listen"
              pinyin={item.pinyin}
              text={item.hanzi}
            />
          </div>
        </div>
      </section>

      <section aria-label="Memory link" className={studioClues}>
        <SectionHead className="mb-0" label="memory link" meta="optional" />
        <div className="overflow-hidden">
          <label
            className={clueRow({
              editable: true,
              marker: trimmed ? null : "empty",
            })}
            data-kind="link"
            style={kindStyle("link")}
          >
            <span className={clueCode({ kind: "link", editable: true })}>
              <Link2 size={18} />
            </span>
            <span className={clueRole()}>{prompt}</span>
            <input
              aria-invalid={tooShort}
              aria-label="Memory link"
              autoComplete="off"
              className={clueName({ empty: !trimmed, editable: true })}
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

      <footer className={studioActions} data-actions>
        <ActionButton
          className={studioAction}
          color={tooShort ? "grey" : "blue"}
          disabled={finish.isPending}
          hint="↵"
          onClick={primary}
          variant={tooShort ? "dotted" : "gradient"}
        >
          {finishLabel(
            finish.isPending,
            finish.isError,
            tooShort ? "memory link needs 4+ characters" : null
          )}
        </ActionButton>
      </footer>
    </article>
  );
}
