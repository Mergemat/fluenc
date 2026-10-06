import { LoaderCircle } from "lucide-react";
import { useCallback } from "react";

import { useMandarinSpeech } from "../hooks/use-mandarin-speech";
import { getNeutralToneExample } from "../lib/pinyin-audio";

interface Props {
  className?: string;
  label?: string;
  pinyin: string;
  text: string;
}

const statusClass: Partial<Record<string, string>> = {
  speaking: "text-glaze",
  error: "text-danger",
};

export function MandarinAudioButton({
  text,
  pinyin,
  label,
  className = "",
}: Props) {
  const speech = useMandarinSpeech();
  const neutralExample = getNeutralToneExample(text, pinyin);
  const speak = useCallback(() => {
    speech.speak(text, pinyin);
  }, [speech.speak, text, pinyin]);
  const loading = speech.status === "loading";
  const caption = loading ? "Loading…" : (label ?? "");
  const stateClass = statusClass[speech.status] ?? "";
  let ariaLabel = `Pronounce ${text}`;
  let title: string | undefined;
  if (label) {
    ariaLabel = `${label}: ${text}, ${pinyin}`;
  } else if (neutralExample) {
    ariaLabel = `Neutral tone, as in ${neutralExample.text}`;
  }
  if (speech.status === "error") {
    title = "Could not get pronunciation";
  } else if (neutralExample) {
    title = `Neutral tone, as in ${neutralExample.text} · ${neutralExample.pinyin}`;
  }

  return (
    <button
      aria-label={ariaLabel}
      className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-transparent p-0 text-muted hover:border-line hover:bg-paper hover:text-ink ${
        label ? "px-2 font-medium text-sm" : "size-10 shrink-0"
      } ${stateClass} ${className}`.trim()}
      disabled={loading}
      onClick={speak}
      title={title}
      type="button"
    >
      {loading ? (
        <LoaderCircle
          className="animate-spin motion-reduce:animate-none"
          size={17}
        />
      ) : (
        <AudioGlyph />
      )}
      {label ? <span>{caption}</span> : null}
    </button>
  );
}

function AudioGlyph() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="17"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="17"
    >
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}
