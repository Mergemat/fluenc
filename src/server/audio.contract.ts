import { z } from "zod";

export const pronunciationInput = z.object({
  text: z.string().trim().min(1).max(80),
  pinyin: z.string().trim().min(1).max(160),
});

export type PronunciationInput = z.infer<typeof pronunciationInput>;
