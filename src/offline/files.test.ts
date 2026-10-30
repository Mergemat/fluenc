import { expect, test } from "bun:test";

import { packFiles } from "./files";

const encode = (text: string) => new TextEncoder().encode(text);
const files = [
  { url: "/audio/v1/ai4.mp3", bytes: encode("ID3 one") },
  { url: "/audio/v1/an1.mp3", bytes: encode("ID3 second\n") },
];

test("each file can be cut back out of its pack unchanged", () => {
  const pack = packFiles(files);
  for (const [index, entry] of pack.files.entries()) {
    expect([
      ...pack.bytes.slice(entry.offset, entry.offset + entry.length),
    ]).toEqual([...(files[index]?.bytes ?? [])]);
  }
});
