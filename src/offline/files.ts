// Practice files (pinyin audio) live outside the service worker's precache, so
// the app installs in seconds. The page downloads them itself, and the worker serves them from
// these caches. The build writes the list to OFFLINE_FILES_URL. Each file's URL is named by the
// content of its folder (see vite.config.ts), so a cached file is current for as long as it is
// listed.
//
// Each group also ships as one pack, so a device fills its cache in one request rather than one
// per file: the CDN bills every request. The files stay at their own URLs for anything the
// download hasn't reached.
export const OFFLINE_FILES_URL = "/offline-files.json";
export const OFFLINE_CACHES = {
  audio: "fluenc-audio",
} as const;
export const OFFLINE_CONTENT_TYPES = {
  audio: "audio/mpeg",
} as const satisfies Record<keyof typeof OFFLINE_CACHES, string>;
/** Caches of files the app no longer uses, which a device drops. */
export const RETIRED_CACHES = ["fluenc-strokes"];

export interface OfflineFile {
  /** Where the file's bytes sit in its group's pack. */
  length: number;
  offset: number;
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

/** Join files into one pack, recording where each one sits. */
export function packFiles(files: { bytes: Uint8Array; url: string }[]) {
  const pack = new Uint8Array(
    files.reduce((size, file) => size + file.bytes.length, 0)
  );
  let offset = 0;
  const entries = files.map(({ bytes, url }) => {
    const entry: OfflineFile = { url, offset, length: bytes.length };
    pack.set(bytes, offset);
    offset += bytes.length;
    return entry;
  });
  return { bytes: pack, files: entries };
}
