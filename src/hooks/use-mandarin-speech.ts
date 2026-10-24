import { useCallback, useEffect, useRef, useState } from "react";

import {
  getNeutralToneExample,
  getRecordedPinyinPath,
} from "../lib/pinyin-audio";
import { getPronunciationAudio } from "../server/audio";
import type { PronunciationInput } from "../server/audio.contract";

const audioSourceCache = new Map<string, string>();
const AUDIO_CACHE_VERSION = 8;
// Generated speech is kept on the device: which recording each text has, and the recording. A
// replay, even days later or offline, then needs neither a server call nor a download.
const SPEECH_URLS_KEY = `fluenc-speech-urls-v${AUDIO_CACHE_VERSION}`;
const SPEECH_CACHE = `fluenc-speech-v${AUDIO_CACHE_VERSION}`;

function readSpeechUrls(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SPEECH_URLS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

async function speechUrl(pronunciation: PronunciationInput) {
  const key = `${pronunciation.text}:${pronunciation.pinyin}`;
  const known = readSpeechUrls()[key];
  if (known) {
    return known;
  }
  const { audioUrl } = await getPronunciationAudio({ data: pronunciation });
  try {
    localStorage.setItem(
      SPEECH_URLS_KEY,
      JSON.stringify({ ...readSpeechUrls(), [key]: audioUrl })
    );
  } catch {
    // Storage is full or blocked: the next visit asks the server again.
  }
  return audioUrl;
}

/** A playable source for generated speech, from the device's copy when it has one. */
async function generatedSpeech(pronunciation: PronunciationInput) {
  const url = await speechUrl(pronunciation);
  if (!("caches" in window)) {
    return url;
  }
  try {
    const cache = await caches.open(SPEECH_CACHE);
    const cached = await cache.match(url);
    const response = cached ?? (await fetch(url));
    if (!response.ok) {
      return url;
    }
    if (!cached) {
      await cache.put(url, response.clone());
    }
    // Kept in `audioSourceCache` for replays this session, so it is never revoked.
    // react-doctor-disable-next-line react-doctor/no-create-object-url-without-revoke
    return URL.createObjectURL(await response.blob());
  } catch {
    return url;
  }
}

export function useMandarinSpeech() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef(0);
  const [status, setStatus] = useState<
    "idle" | "loading" | "speaking" | "error"
  >("idle");

  useEffect(
    () => () => {
      requestRef.current += 1;
      audioRef.current?.pause();
    },
    []
  );

  /** Resolves true once the audio plays to its end; false if it fails or another call cuts it off. */
  const speak = useCallback(async (text: string, pinyin: string) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    audioRef.current?.pause();
    setStatus("loading");

    try {
      const cacheKey = `${AUDIO_CACHE_VERSION}:${text}:${pinyin}`;
      let source = audioSourceCache.get(cacheKey);
      if (!source) {
        source =
          Array.from(text).length === 1
            ? (getRecordedPinyinPath(pinyin) ?? "")
            : "";
        if (!source) {
          source = await generatedSpeech(
            getNeutralToneExample(text, pinyin) ?? { text, pinyin }
          );
        }
        audioSourceCache.set(cacheKey, source);
      }
      if (requestRef.current !== requestId) {
        return false;
      }

      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = source;
      audioRef.current = audio;
      audio.onplaying = () => setStatus("speaking");
      const finished = new Promise<boolean>((resolve) => {
        audio.onended = () => {
          setStatus("idle");
          resolve(true);
        };
        audio.onerror = () => {
          setStatus("error");
          resolve(false);
        };
        audio.onpause = () => {
          if (!audio.ended) {
            resolve(false);
          }
        };
      });
      await audio.play();
      return await finished;
    } catch {
      if (requestRef.current === requestId) {
        setStatus("error");
      }
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    requestRef.current += 1;
    audioRef.current?.pause();
    setStatus("idle");
  }, []);

  return { speak, status, stop };
}
