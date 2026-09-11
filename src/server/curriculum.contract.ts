import { z } from 'zod'

export const reviewInput = z.object({
  eventId: z.uuid(),
  itemType: z.enum(['character', 'word', 'sentence', 'actor', 'set', 'tone']),
  itemId: z.string().min(1),
  rating: z.number().int().min(1).max(4),
  durationMs: z.number().int().min(0).max(3_600_000).default(0),
  reviewedAt: z.iso.datetime(),
})

export const enrollInput = z.object({
  itemType: z.enum(['character', 'word', 'sentence']),
  itemId: z.string().min(1),
  enrolledAt: z.iso.datetime(),
})

export const movieInput = z.object({
  characterId: z.string().min(1),
  actorKey: z.string().min(1),
  actorName: z.string().trim(),
  finalKey: z.string().min(1),
  setName: z.string().trim(),
  tone: z.number().int().min(1).max(5),
  roomName: z.string().trim(),
  props: z.array(
    z.object({
      component: z.string().min(1),
      propName: z.string().trim().min(1),
    }),
  ),
})

export const livingLinkInput = z.object({
  wordId: z.string().min(1),
  story: z.string().trim().min(4),
})

export type ReviewInput = z.infer<typeof reviewInput>
export type EnrollInput = z.infer<typeof enrollInput>
export type MovieInput = z.infer<typeof movieInput>
export type LivingLinkInput = z.infer<typeof livingLinkInput>
