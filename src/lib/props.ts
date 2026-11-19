import curriculumJson from "../data/curriculum.generated.json";
import type { Curriculum, OwnProp } from "../data/types";

const { props } = curriculumJson as Curriculum;
// Props learners' own characters bring. They come from the stroke reference, so they read the
// same for every learner and only ever accumulate.
const ownProps = new Map<string, OwnProp>();

export function addOwnProps(parts: readonly OwnProp[]) {
  for (const part of parts) {
    if (!props[part.hanzi]) {
      ownProps.set(part.hanzi, part);
    }
  }
}
// A trailing note in brackets, like "(radical)".
const TRAILING_NOTE = /\s*\([^)]*\)$/u;

export const propStrokes = (component: string) =>
  props[component]?.strokes ?? ownProps.get(component)?.strokes;

/** A component's dictionary meaning, cut to its first sense: "city outskirts, suburbs; remote" → "city outskirts, suburbs". */
export function propMeaning(component: string) {
  const meaning = props[component]?.meaning ?? ownProps.get(component)?.meaning;
  if (!meaning) {
    return null;
  }
  return meaning.split(";")[0].replace(TRAILING_NOTE, "").trim();
}
