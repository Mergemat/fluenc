// Writing practice as a sheet over the lesson; strokes load from the local precached data.
import type HanziWriterType from "hanzi-writer";
import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { DitherButton } from "./dither-kit/button";
import { DitherGradient } from "./dither-kit/gradient";
import { PixelLoader } from "./ui/dither";
import { ditherColor } from "./ui/part-colors";

type SheetState = "loading" | "writing" | "done" | "error";

interface WriterEvents {
  isActive: () => boolean;
  onError: () => void;
  onReady: (writer: HanziWriterType) => void;
}

async function loadStrokes(character: string) {
  const response = await fetch(`/hanzi/${character}.json`);
  if (!response.ok) {
    throw new Error(`Strokes unavailable for ${character}`);
  }
  return response.json();
}

const pageSize = () =>
  typeof window === "undefined"
    ? 280
    : Math.min(320, window.innerWidth - 64, window.innerHeight - 260);

function sheetStatus(state: SheetState, misses: number) {
  if (state === "loading") {
    return "loading strokes";
  }
  if (state === "error") {
    return "strokes unavailable";
  }
  if (state !== "done") {
    return "trace each stroke · hints after 2 misses";
  }
  if (!misses) {
    return "done · clean";
  }
  return `done · ${misses} miss${misses > 1 ? "es" : ""}`;
}

async function createWriter(
  target: HTMLDivElement,
  hanzi: string,
  size: number,
  events: WriterEvents
) {
  const { default: HanziWriter } = await import("hanzi-writer");
  if (!events.isActive()) {
    return null;
  }
  const styles = getComputedStyle(target);
  const ink = styles.getPropertyValue("--dx-fg").trim() || "#ededed";
  // hanzi-writer only parses hex and comma rgb(a), so take the accent from the kit palette.
  const accent = ditherColor("blue");
  target.replaceChildren();
  const writer = HanziWriter.create(target, hanzi, {
    width: size,
    height: size,
    padding: 12,
    showCharacter: false,
    showOutline: true,
    outlineColor: styles.getPropertyValue("--dx-line").trim() || "#2a2a30",
    strokeColor: ink,
    drawingColor: accent,
    highlightColor: accent,
    drawingWidth: 22,
    charDataLoader: (character, onLoad, onError) => {
      loadStrokes(character).then(onLoad, onError);
    },
    onLoadCharDataSuccess: () => {
      if (events.isActive()) {
        events.onReady(writer);
      }
    },
    onLoadCharDataError: () => {
      if (events.isActive()) {
        events.onError();
      }
    },
  });
  return writer;
}

export function WriteSheet({
  hanzi,
  onClose,
}: {
  hanzi: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const target = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriterType | null>(null);
  const [state, setState] = useState<SheetState>("loading");
  const [misses, setMisses] = useState(0);
  // Fixed when the sheet opens, so a later render never rebuilds the pad mid-quiz.
  const [size] = useState(pageSize);

  const quiz = useCallback(() => {
    writer.current?.quiz({
      showHintAfterMisses: 2,
      onMistake: () => setMisses((value) => value + 1),
      onComplete: () => setState("done"),
    });
  }, []);

  // A modal dialog: Escape and a tap on the backdrop close it.
  const closed = useEffectEvent(() => onClose());
  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    const closeOnBackdrop = (event: MouseEvent) => {
      if (event.target === element) {
        element.close();
      }
    };
    element.addEventListener("close", closed);
    element.addEventListener("mousedown", closeOnBackdrop);
    if (!element.open) {
      element.showModal();
    }
    return () => {
      element.removeEventListener("close", closed);
      element.removeEventListener("mousedown", closeOnBackdrop);
    };
  }, []);

  useEffect(() => {
    const element = target.current;
    if (!element) {
      return;
    }
    let active = true;
    createWriter(element, hanzi, size, {
      isActive: () => active,
      onReady: (created) => {
        writer.current = created;
        setState("writing");
        quiz();
      },
      onError: () => setState("error"),
    }).catch(() => {
      if (active) {
        setState("error");
      }
    });
    return () => {
      active = false;
      writer.current?.cancelQuiz();
    };
  }, [hanzi, size, quiz]);

  const close = useCallback(() => dialog.current?.close(), []);
  const showStrokes = useCallback(() => {
    writer.current?.animateCharacter();
  }, []);
  const restart = useCallback(() => {
    setMisses(0);
    setState("writing");
    quiz();
  }, [quiz]);

  return (
    <dialog
      aria-label={`Write ${hanzi}`}
      className="dx-sheet-dialog"
      ref={dialog}
    >
      <section className="dx-sheet">
        <DitherGradient
          className="dx-wash"
          direction="up"
          from="blue"
          opacity={0.3}
        />
        <header>
          <span className="dx-label-text">write · {hanzi}</span>
          <button
            aria-label="Close"
            className="dx-icon-button"
            onClick={close}
            type="button"
          >
            <X size={16} />
          </button>
        </header>
        <div className="dx-pad" style={{ width: size, height: size }}>
          <div
            aria-label={`Writing pad for ${hanzi}`}
            ref={target}
            role="img"
          />
          {state === "loading" ? (
            <span className="dx-pad-loader">
              <PixelLoader label="Loading strokes" size={5} />
            </span>
          ) : null}
        </div>
        <p aria-live="polite" className="dx-sheet-status">
          {sheetStatus(state, misses)}
        </p>
        <footer>
          <DitherButton
            color="grey"
            disabled={state === "loading" || state === "error"}
            onClick={showStrokes}
            variant="dotted"
          >
            show strokes
          </DitherButton>
          <DitherButton
            color={state === "done" ? "green" : "blue"}
            disabled={state === "loading" || state === "error"}
            onClick={restart}
            variant="gradient"
          >
            {state === "done" ? "again" : "restart"}
          </DitherButton>
        </footer>
      </section>
    </dialog>
  );
}
