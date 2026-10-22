import { z } from "zod";
import { directCharacters } from "./character-props";
import { type HanziComposition, isHanziCharacter } from "./hanzi";

const componentNoteSchema = z.object({
  character: z.string().refine(isHanziCharacter),
  components: z.array(z.string().refine(isHanziCharacter)).min(1),
  note: z.string().trim().min(1),
});

/** Learner copy is authored separately from source reviews and tied to the taught parts. */
export function resolveComponentNotes(
  compositions: ReadonlyMap<
    string,
    Pick<HanziComposition, "components" | "structure"> | null
  >,
  authored: unknown
) {
  const notes = new Map<string, string>();
  for (const entry of z.array(componentNoteSchema).parse(authored)) {
    if (notes.has(entry.character)) {
      throw new Error(`Duplicate component note: ${entry.character}`);
    }
    const composition = compositions.get(entry.character);
    if (!composition) {
      throw new Error(
        `Missing composition for component note: ${entry.character}`
      );
    }
    if (
      composition.structure === "atomic" ||
      directCharacters.has(entry.character)
    ) {
      throw new Error(
        `Whole-shape lessons do not need component notes: ${entry.character}`
      );
    }
    if (composition.components.join("") !== entry.components.join("")) {
      throw new Error(
        `Component note no longer matches the parts: ${entry.character}`
      );
    }
    notes.set(entry.character, entry.note);
  }
  return notes;
}
