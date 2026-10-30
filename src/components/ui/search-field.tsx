import { Search, X } from "lucide-react";
import {
  type ChangeEvent,
  type CompositionEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { isShortcut, useWindowKeys } from "../../hooks/use-window-keys";

const searchBox =
  "flex h-14 items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 text-muted-foreground transition-colors focus-within:border-blue focus-within:text-foreground";
const searchInput =
  "h-full min-w-0 flex-1 border-0 bg-transparent type-heading text-foreground outline-none search-cancel:hidden placeholder:type-control placeholder:text-faint-foreground";
const searchClear =
  "grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-popover hover:text-foreground";

/**
 * A search kept in the URL as `q`. The field owns its text: echoing it through the URL lands a
 * render late, and resetting the value mid-composition breaks IME input (iOS pinyin). The URL
 * follows once a word is committed. "/" focuses the field from anywhere on the page.
 */
export function useSearchField(q: string, commit: (value: string) => void) {
  // `sent` is what the field has sent to the URL and not yet seen land; navigations can skip
  // values. `q` is the URL value the field last saw.
  const [field, setField] = useState({ q, draft: q, sent: [] as string[] });
  if (field.q !== q) {
    const echo = field.sent.indexOf(q);
    // Changed from outside the field (a link, clearing the filters): adopt it.
    setField(
      echo === -1
        ? { q, draft: q, sent: [] }
        : { q, draft: field.draft, sent: field.sent.slice(echo + 1) }
    );
  }
  const composing = useRef<boolean>(false);
  const input = useRef<HTMLInputElement>(null);
  useWindowKeys((event) => {
    if (event.key === "/" && isShortcut(event, "input, textarea")) {
      event.preventDefault();
      input.current?.focus();
    }
  });

  const type = useCallback(
    (value: string, send: boolean) => {
      setField((previous) => ({
        ...previous,
        draft: value,
        sent: send ? [...previous.sent, value] : previous.sent,
      }));
      if (send) {
        commit(value);
      }
    },
    [commit]
  );
  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      type(event.target.value, !composing.current);
    },
    [type]
  );
  const onCompositionStart = useCallback(() => {
    composing.current = true;
  }, []);
  const onCompositionEnd = useCallback(
    (event: CompositionEvent<HTMLInputElement>) => {
      composing.current = false;
      type(event.currentTarget.value, true);
    },
    [type]
  );
  const clear = useCallback(() => {
    type("", true);
    input.current?.focus();
  }, [type]);
  return {
    /** What the field shows now, ahead of the URL. */
    draft: field.draft,
    input,
    clear,
    handlers: { onChange, onCompositionStart, onCompositionEnd },
  };
}

export type SearchFieldState = ReturnType<typeof useSearchField>;

/** The search box: a clear button once something is typed, the "/" shortcut before. */
export function SearchField({
  field,
  label,
  placeholder,
}: {
  field: SearchFieldState;
  label: string;
  placeholder: string;
}) {
  return (
    <label className={searchBox}>
      <Search aria-hidden="true" size={16} />
      <input
        aria-label={label}
        autoComplete="off"
        className={searchInput}
        placeholder={placeholder}
        ref={field.input}
        spellCheck={false}
        type="search"
        value={field.draft}
        {...field.handlers}
      />
      {field.draft ? (
        <button
          aria-label="Clear search"
          className={searchClear}
          onClick={field.clear}
          type="button"
        >
          <X size={15} />
        </button>
      ) : (
        <kbd className="rounded-sm border border-border-strong px-1.5 py-px">
          /
        </kbd>
      )}
    </label>
  );
}
