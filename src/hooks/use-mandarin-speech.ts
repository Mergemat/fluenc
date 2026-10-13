import { useCallback, useEffect, useRef, useState } from "react";

import {
  getNeutralToneExample,
  getRecordedPinyinPath,
} from "../lib/pinyin-audio";
import { getPronunciationAudio } from "../server/audio";

const audioSourceCache = new Map<string, string>();
const AUDIO_CACHE_VERSION = 8;

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
          const pronunciation = getNeutralToneExample(text, pinyin) ?? {
            text,
            pinyin,
          };
          const result = await getPronunciationAudio({ data: pronunciation });
          source = result.audioUrl;
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
