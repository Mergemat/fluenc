import { expect, test } from "bun:test";

import { packFiles } from "./files";

const encode = (text: string) => new TextEncoder().encode(text);
const files = [
  { url: "/strokes/v1/一.json", bytes: encode('{"strokes":["M 1"]}') },
  { url: "/strokes/v1/二.json", bytes: encode('{"strokes":[]}\n') },
];

test("each file can be cut back out of its pack unchanged", () => {
  for (const json of [true, false]) {
    const pack = packFiles(files, json);
    for (const [index, entry] of pack.files.entries()) {
      expect([
        ...pack.bytes.slice(entry.offset, entry.offset + entry.length),
      ]).toEqual([...(files[index]?.bytes ?? [])]);
    }
  }
});

test("a JSON pack is a JSON array of its files, so the CDN serves it compressed", () => {
  const pack = packFiles(files, true);
  expect(JSON.parse(new TextDecoder().decode(pack.bytes))).toEqual([
    { strokes: ["M 1"] },
    { strokes: [] },
  ]);
});
