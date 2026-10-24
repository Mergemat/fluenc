// Practice files (pinyin audio and stroke data) live outside the service worker's precache, so
// the app installs in seconds. The page downloads them itself, and the worker serves them from
// these caches. The build writes the list, with a revision per file, to OFFLINE_FILES_URL.
//
// Each group also ships as one pack, so a device fills its cache in one request rather than one
// per file: the CDN bills every request. The files stay at their own URLs for anything the
// download hasn't reached.
export const OFFLINE_FILES_URL = "/offline-files.json";
export const OFFLINE_CACHES = {
  audio: "fluenc-audio",
  strokes: "fluenc-strokes",
} as const;
export const OFFLINE_CONTENT_TYPES = {
  audio: "audio/mpeg",
  strokes: "application/json",
} as const satisfies Record<keyof typeof OFFLINE_CACHES, string>;

export interface OfflineFile {
  /** Where the file's bytes sit in its group's pack. */
  length: number;
  offset: number;
  revision: string;
  url: string;
}
export interface OfflineGroup {
  files: OfflineFile[];
  /** Every file of the group, unchanged, in one download. */
  pack: string;
  /** The pack's length in bytes. */
  size: number;
}
export type OfflineFiles = Record<keyof typeof OFFLINE_CACHES, OfflineGroup>;

const encoder = new TextEncoder();

/**
 * Join files into one pack, recording where each one sits. A JSON pack is a JSON array of the
 * files, byte for byte, so it is served as JSON and the CDN compresses it.
 */
export function packFiles(
  files: { bytes: Uint8Array; revision: string; url: string }[],
  json: boolean
) {
  const parts: Uint8Array[] = [];
  let size = 0;
  const add = (bytes: Uint8Array) => {
    parts.push(bytes);
    size += bytes.length;
  };
  if (json) {
    add(encoder.encode("["));
  }
  const entries = files.map(({ bytes, revision, url }, index) => {
    if (json && index) {
      add(encoder.encode(","));
    }
    const entry: OfflineFile = {
      url,
      revision,
      offset: size,
      length: bytes.length,
    };
    add(bytes);
    return entry;
  });
  if (json) {
    add(encoder.encode("]"));
  }
  const pack = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    pack.set(part, at);
    at += part.length;
  }
  return { bytes: pack, files: entries };
}
