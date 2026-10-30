# Curriculum data

Fluenc keeps its own character database in `src/data/hanzi`. Nothing is downloaded at build time, and no dictionary or pinyin library ships with the app.

- `hanzi/characters.json`: every course character. Each entry has the reading the course teaches, other readings in modern use, one mnemonic keyword (unique across the course), its senses, an optional short `also` cue, stroke count, radical and the teaching decomposition: `structure` (`atomic` for a whole shape, `compound` for one built from props), `components` in writing order, and an optional learner `note` for an unusual assembly. `sources` lists the pages each entry was checked against.
- `hanzi/words.json`: every course word, keyed by a permanent `id` that learner progress refers to. A taught word has its pinyin, one syllable per character (erhua 儿 is `r`), a teaching `meaning`, its senses and an optional `also` cue. An excluded word keeps its id with the reason, such as a traditional spelling of a word the course already teaches. Ids follow the frequency rank the course started from; new words get the next free id.
- `hanzi/components.json`: one suggested prop for every component the course uses. A prop is a concrete object the learner can picture, reused in every movie with that part, and no two components share one. `variantOf` links a form such as 氵 to its full character 水.

The teaching decomposition is chosen for memory and reuse. It does not depend on how strokes are stored or drawn: `assets/strokes.json` holds each character's vendored stroke outlines, and its `owners` list says which prop draws each stroke. `bun run data:sync` reassigns owners after the props of a character change. A stroke keeps its prop when the character still has it, and the remaining strokes go, in writing order, to the props that have none yet, by each prop's stroke count. When that can't be decided it names the characters to set by hand.

`bun run data:sync` validates the database and writes `curriculum.generated.json`, `character-words.generated.json`, `sentences.generated.json` and the stroke owners, and rebuilds the hanzi fonts when the characters, their props or their order changed. It fails on a broken reference, a duplicate keyword, prop or word reading, a pinyin syllable that isn't standard Mandarin with standard tone-mark placement, or a word syllable its character is never read as (tones may change in words, so 一 and 不 keep their citation tones). `bun test src/lib/curriculum-data.test.ts` runs the same checks, and also checks the strokes against the listed stroke counts and props.

## Teaching order

Each character and word gets an `order`: the average of its place by frequency and its place by usage. Frequency is the word's rank, or for a character the rank of its most frequent word. Usage counts the reading sentences that contain it (all of `sentences.reviewed.json` and `sentences.authored.json`, not only those the course selects), plus for a character the number of course words it spells. A character the course leans on everywhere moves ahead of a slightly more frequent one that little else uses. Lessons still teach focus entries first, then characters a nearly unlocked word needs, and each prop the learner hasn't named yet sets a character back a few places.

## How entries were made

The database was rebuilt in October 2026 by AI agents. Each batch was written by one agent and then checked by a second, independent agent. Both looked up every entry on [Wiktionary](https://en.wiktionary.org), [MDBG](https://www.mdbg.net), the [Unihan database](https://www.unicode.org/charts/unihan.html) or [zdic](https://www.zdic.net). Stroke counts were then checked against the vendored strokes, and word readings against their characters' readings. This is careful editorial work, not a human linguist's certification. To change an entry, edit the JSON, cite the page you checked in `sources`, and run `bun run data:sync`.

Word order started from the [Adsonant list of the 1,000 most common Chinese words](https://adsonant.com/resources/chinese/1000-most-common-words), of which only the rank order is used.

## Sentences

- `sentences.authored.json`: sentences written for the course. They keep their hand-checked pinyin and meaning.
- `sentences.reviewed.json`: explicitly selected [Tatoeba](https://tatoeba.org) Mandarin–English examples. Each entry pins its original Chinese, reviewed pinyin and English, source sentence number, and inclusion reason. Rewritten Chinese belongs in the authored file under a new authored ID. These are AI-assisted editorial reviews, not a native-speaker certification.
- `sentences.generated.json`: materialized by `bun run data:sync` from the authored and reviewed files. Generation preserves their pinyin and English, checks source identities and curriculum coverage, and rejects exact duplicates or unresolved pronoun/quantity templates. An intentional teaching contrast needs an explicit, reasoned `allowSimilarTo` reference. Imported examples retain 4–16 hanzi, at least three curriculum words, and at most one uncovered stretch. Each sentence is anchored to its least frequent word.

Tatoeba sentences and translations are licensed under [Creative Commons Attribution 2.0 France](https://creativecommons.org/licenses/by/2.0/fr/). Attribution: Tatoeba contributors; each sentence links back as `https://tatoeba.org/sentences/show/<source>`.
