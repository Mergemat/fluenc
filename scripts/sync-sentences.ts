import curriculumJson from "../src/data/curriculum.generated.json";
import authoredSentences from "../src/data/sentences.authored.json";
import type { Curriculum } from "../src/data/types";
import { selectSentences } from "./sentence-selection";

const reviewedPath = new URL(
  "../src/data/sentences.reviewed.json",
  import.meta.url
);
const reviewedFile = Bun.file(reviewedPath);
if (!(await reviewedFile.exists())) {
  throw new Error(
    "Missing src/data/sentences.reviewed.json. Review and pin imported sentences before generating the corpus."
  );
}
const sentences = selectSentences(
  curriculumJson as Curriculum,
  authoredSentences,
  await reviewedFile.json()
);
await Bun.write(
  new URL("../src/data/sentences.generated.json", import.meta.url),
  `${JSON.stringify({
    version: "reviewed-v1",
    sources: {
      sentences:
        "https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2",
      translations:
        "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2",
      links:
        "https://downloads.tatoeba.org/exports/per_language/cmn/cmn-eng_links.tsv.bz2",
      license: "https://creativecommons.org/licenses/by/2.0/fr/",
      attribution: "Tatoeba contributors",
      reviewed: "src/data/sentences.reviewed.json",
    },
    sentences,
  })}\n`
);
console.log(
  `Generated ${sentences.length} reviewed sentences (${authoredSentences.length} authored), anchored to ${new Set(sentences.map((sentence) => sentence.anchor)).size} curriculum words.`
);
