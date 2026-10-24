import curriculumJson from "../data/curriculum.generated.json";
import type { Curriculum } from "../data/types";

const { props } = curriculumJson as Curriculum;
// A trailing note in brackets, like "(radical)".
const TRAILING_NOTE = /\s*\([^)]*\)$/;

/** A component's dictionary meaning, cut to its first sense: "city outskirts, suburbs; remote" → "city outskirts, suburbs". */
export function propMeaning(component: string) {
  const meaning = props[component]?.meaning;
  if (!meaning) {
    return null;
  }
  return meaning.split(";")[0].replace(TRAILING_NOTE, "").trim();
}
