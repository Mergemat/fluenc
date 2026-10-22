import { expect, test } from "bun:test";
import notes from "../data/component-notes.authored.json";
import indexJson from "../data/hanzi-index.generated.json";
import reviewsJson from "../data/reviewed-compositions.json";
import { resolveComponentNotes } from "./component-notes";
import {
  findHanziComposition,
  type HanziComposition,
  type HanziIndex,
  type ReviewedComposition,
} from "./hanzi";

test("source editorial notes and variation flags do not become learner copy", () => {
  const composition: HanziComposition = {
    components: ["丶", "水"],
    decomposition: "〾⿱丶水",
    glyphVariation: true,
    note: "Replaces an upstream placeholder; BabelStone selected IDS.",
    radical: "水",
    structure: "compound",
  };
  const compositions = new Map([["永", composition]]);
  expect(resolveComponentNotes(compositions, []).get("永")).toBeUndefined();
  const authored = [
    {
      character: "永",
      components: ["丶", "水"],
      note: "The dot sits above a modified 水 shape.",
    },
  ];
  expect(resolveComponentNotes(compositions, authored).get("永")).toBe(
    "The dot sits above a modified 水 shape."
  );
});

test.each([
  { components: ["一", "丨", "㇕"] },
  { components: ["一", "㇕", "丨", "一"] },
  { components: ["五"] },
])(
  "rejects assembly copy after the taught parts change to %j",
  ({ components }) => {
    const compositions = new Map([
      ["五", { components: [...components], structure: "compound" as const }],
    ]);
    expect(() =>
      resolveComponentNotes(
        compositions,
        notes.filter((entry) => entry.character === "五")
      )
    ).toThrow("Component note no longer matches the parts: 五");
  }
);

test("rejects notes for direct lessons, whole shapes, and absent characters", () => {
  const authored = (character: string, components: string[]) => [
    { character, components, note: "An unnecessary assembly explanation." },
  ];
  const compositions = new Map([
    ["二", { components: ["一", "一"], structure: "compound" as const }],
    ["己", { components: ["己"], structure: "atomic" as const }],
  ]);
  expect(() =>
    resolveComponentNotes(compositions, authored("二", ["一", "一"]))
  ).toThrow("Whole-shape lessons do not need component notes: 二");
  expect(() =>
    resolveComponentNotes(compositions, authored("己", ["己"]))
  ).toThrow("Whole-shape lessons do not need component notes: 己");
  expect(() =>
    resolveComponentNotes(compositions, authored("林", ["木", "木"]))
  ).toThrow("Missing composition for component note: 林");
});

test("rejects duplicate notes instead of silently overwriting copy", () => {
  const entry = notes.find((note) => note.character === "永");
  expect(() =>
    resolveComponentNotes(
      new Map([["永", { components: ["丶", "水"], structure: "compound" }]]),
      [entry, entry]
    )
  ).toThrow("Duplicate component note: 永");
});

test("authored assembly guidance matches the actual reviewed course shapes", () => {
  const index = indexJson as unknown as HanziIndex;
  const reviews = reviewsJson as ReviewedComposition[];
  const compositions = new Map(
    notes.map(({ character }) => [
      character,
      findHanziComposition(
        index,
        character,
        reviews.find((entry) => entry.character === character)
      ),
    ])
  );
  expect(() => resolveComponentNotes(compositions, notes)).not.toThrow();
});
