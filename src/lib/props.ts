import curriculumJson from "../data/curriculum.generated.json";
import type { Curriculum } from "../data/types";

const { props } = curriculumJson as Curriculum;

/** The database's suggested prop for a component: one reusable object for every movie with it. */
export function suggestedProp(component: string) {
  return props[component]?.prop ?? null;
}
