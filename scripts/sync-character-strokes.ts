import { mkdir } from "node:fs/promises";
import overrideJson from "../src/data/character-strokes.overrides.json";
import source from "../src/data/character-strokes.source.json";
import curriculum from "../src/data/curriculum.generated.json";
import { directCharacters } from "../src/lib/character-props";

interface DictionaryEntry {
  character: string;
  decomposition: string;
  matches: (number[] | null)[];
}
type Decomposition = string | Decomposition[];
const overrides = overrideJson as Record<string, string[]>;

const UNENCODED_MARK = /^〾/;
// Ideographic description operators and how many parts each one combines.
const OPERATOR_ARITY = new Map<string, number>([
  ...Array.from("⿲⿳", (operator) => [operator, 3] as const),
  ...Array.from("⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻", (operator) => [operator, 2] as const),
]);

async function readSource(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }
  return response;
}

function ownerAt(tree: Decomposition, path: number[]) {
  let node: Decomposition | undefined = tree;
  for (const index of path) {
    node = Array.isArray(node) ? node[index] : undefined;
  }
  return typeof node === "string" ? node : undefined;
}

function strokeOwners(entry: DictionaryEntry): (string | undefined)[] {
  const tokens = Array.from(entry.decomposition.replace(UNENCODED_MARK, ""));
  let position = 0;
  function parse(): Decomposition {
    const token = tokens[position] ?? "";
    position += 1;
    const arity = OPERATOR_ARITY.get(token) ?? 0;
    return arity ? Array.from({ length: arity }, parse) : token;
  }
  const tree = parse();
  return entry.matches.map((path) => (path ? ownerAt(tree, path) : undefined));
}

const entries = (await (await readSource(source.dictionary)).text())
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as DictionaryEntry);
const dictionary = new Map(entries.map((entry) => [entry.character, entry]));
await mkdir("public/hanzi", { recursive: true });

async function syncCharacter(
  character: (typeof curriculum.characters)[number]
) {
  const entry = dictionary.get(character.hanzi);
  if (!entry) {
    throw new Error(`Missing dictionary entry: ${character.hanzi}`);
  }
  const owners = overrides[character.hanzi] ?? strokeOwners(entry);
  const components = directCharacters.has(character.hanzi)
    ? [character.hanzi]
    : character.components;
  const data = (await (
    await readSource(
      `${source.graphics}/${encodeURIComponent(character.hanzi)}.json`
    )
  ).json()) as { strokes: string[]; medians: number[][][] };
  if (
    owners.length !== data.strokes.length ||
    owners.some((owner) => !(owner && components.includes(owner))) ||
    components.some((component) => !owners.includes(component))
  ) {
    throw new Error(
      `Incomplete stroke ownership: ${character.hanzi}. Review the source and add an explicit override.`
    );
  }
  await Bun.write(
    `public/hanzi/${character.hanzi}.json`,
    `${JSON.stringify({
      _notice:
        "Fluenc, 2026-09-11: added component owners; stroke paths and medians unchanged. Graphics copyright Arphic Technology Co., Ltd.; Arphic Public License, /licenses/ARPHICPL.TXT.",
      strokes: data.strokes,
      medians: data.medians,
      owners,
    })}\n`
  );
}

// Eight workers take the next character until none are left.
const queue = [...curriculum.characters];
async function work(): Promise<void> {
  const character = queue.shift();
  if (!character) {
    return;
  }
  await syncCharacter(character);
  return work();
}
await Promise.all(Array.from({ length: 8 }, work));
console.info(
  `Synced stroke paths and prop ownership for ${curriculum.characters.length} characters.`
);
