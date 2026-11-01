// The MCP endpoint coding agents call to manage one learner's focus. Agents sign in through
// OAuth (see auth.server.ts); every call acts only on the learner the token belongs to.
import { createMcpProtectedRequestHandler } from "@better-auth/mcp";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { isAllowed } from "./agents.server";
import { authIssuer, mcpResource } from "./auth.server";
import { lookupHanzi, propList } from "./community.server";
import {
  addFocus,
  FocusError,
  keepPreview,
  MAX_FOCUS_CHANGE,
  readFocus,
  removeFocus,
  savePreview,
} from "./focus.server";

const instructions = `fluenc teaches Mandarin with the Hanzi Movie Method: each character becomes a short scene the learner directs, starring its keyword and built from its props, the building blocks it is drawn with. Focus is the learner's list of words and sentences fluenc teaches next, oldest first, ahead of its own order.

To add what the learner is studying (a class lesson, a text, a word list):
1. Collect the words and sentences from the learner's material, in simplified characters, as written there. Done when each item comes from that material, each word on its own and each sentence whole.
2. Check them with check_hanzi. Done when you know, for every character, whether fluenc already has it.
3. Describe each new character in add_to_focus's characters, from what check_hanzi returns for it. Done when every new character has a description whose props' strokes add up to its stroke count.
4. Preview with add_to_focus, dryRun unset, and end your turn: show the learner the entries and each new character with its keyword and props, and ask to save.
5. When the learner says yes, call save_preview with the previewId. Done when nothing needs attention; for a skipped entry, fix what its reason names and add it again. If the learner asks for changes, preview again instead.

Reorder focus by removing the entries that should come later and adding them back in the new order.`;

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
});

const text = (value: string) => ({
  content: [{ type: "text" as const, text: value }],
});

type Added = Awaited<ReturnType<typeof addFocus>>;

/**
 * An add as the agent needs it: counts for the entries that went as planned, detail only for the
 * ones it has to act on. The CLI keeps the full result.
 */
function addedForAgent({
  results,
  characters,
  upNext,
  saved,
}: Pick<Added, "results" | "characters" | "upNext" | "saved">) {
  const count = (status: string) =>
    results.filter((result) => result.status === status).length;
  return {
    saved,
    queued: count("queued"),
    known: count("known"),
    attention: results
      .filter(
        (result) => !(result.status === "queued" || result.status === "known")
      )
      .map((result) =>
        "reason" in result
          ? `${result.hanzi}: ${result.status}, ${result.reason}`
          : `${result.hanzi}: ${result.status}`
      ),
    characters: characters.map(
      (item) =>
        `${item.hanzi} ${item.pinyin} ${item.keyword} (${item.components.join(" ")}) from ${item.from}`
    ),
    upNext: upNext.join(" "),
  };
}

const failure = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});

// What agents see: shapes and the guidance that steers them. Limits are checked on the server,
// which answers with a reason the agent can fix, so they cost no context here.
const entryInput = z.object({
  hanzi: z.string(),
  pinyin: z.string(),
  meaning: z.string(),
});
const lessonInput = z.object({
  label: z
    .string()
    .describe('Where the entries come from, like "HSK 1 · Lesson 3".'),
  words: z
    .array(entryInput)
    .optional()
    .describe(
      "One word per item: hanzi only, at most 4 characters, with dictionary pinyin (不 is bù) and its meaning."
    ),
  sentences: z
    .array(entryInput)
    .optional()
    .describe(
      "Whole sentences as written, with pinyin and an English translation."
    ),
  characters: z
    .array(
      z.object({
        hanzi: z.string(),
        pinyin: z
          .string()
          .describe("A reading check_hanzi lists, tone marked."),
        keyword: z
          .string()
          .describe(
            "What the learner pictures: a concrete thing or action in 1–3 plain English words, like fret for 忧. Unique across fluenc."
          ),
        meaning: z.string(),
        props: z
          .array(z.string())
          .describe(
            "In writing order, from check_hanzi's suggestions or list_props; their strokes add up to its stroke count, the largest prop that fits first. [the character] alone only for a shape with no props."
          ),
      })
    )
    .optional()
    .describe("One for each character check_hanzi calls new."),
  dryRun: z
    .boolean()
    .optional()
    .describe(
      "true previews, false saves; unset previews only when new characters would be shared."
    ),
});

/** Agent-fixable failures as tool errors; anything else is a server fault. */
async function attempt(run: () => Promise<ReturnType<typeof json>>) {
  try {
    return await run();
  } catch (error) {
    if (error instanceof FocusError) {
      return failure(error.message);
    }
    if (error instanceof z.ZodError) {
      return failure(
        error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")
      );
    }
    throw error;
  }
}

function focusServer(learnerId: string) {
  const server = new McpServer(
    { name: "fluenc", version: "1.0.0" },
    { instructions }
  );

  server.registerTool(
    "get_focus",
    {
      title: "Read focus",
      description:
        "The learner's focus entries, each with its status, and the next items the Learn tab teaches.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const { entries, upNext } = await readFocus(learnerId);
      return json({
        entries: entries.map(
          (entry) => `${entry.hanzi} ${entry.status} · ${entry.label}`
        ),
        upNext: upNext.join(" "),
      });
    }
  );

  server.registerTool(
    "check_hanzi",
    {
      title: "Check hanzi",
      description:
        "Look up words and sentences before adding them. Returns the characters fluenc already teaches, those another learner described (used as they are), simplified spellings for anything in traditional, and each new character to describe, with its strokes, parts, readings, gloss and the props that draw it.",
      inputSchema: z.object({
        texts: z
          .array(z.string())
          .describe("The words and sentences to look up."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ texts }) =>
      json(
        await lookupHanzi(
          texts.slice(0, MAX_FOCUS_CHANGE).map((item) => item.slice(0, 200))
        )
      )
  );

  server.registerTool(
    "list_props",
    {
      title: "List props",
      description:
        "Every prop fluenc draws characters with, one per line: prop, meaning, strokes. For a new character whose props check_hanzi doesn't suggest.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => text(propList())
  );

  server.registerTool(
    "add_to_focus",
    {
      title: "Add to focus",
      description:
        "Add words and sentences after the learner's focus, with a description of each new character. Previews instead of saving whenever new characters would be shared, returning a previewId for save_preview. Returns counts of queued and known entries, the ones needing attention with the reason, the characters used, and what Learn teaches next.",
      inputSchema: lessonInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ dryRun, ...lesson }) => {
      if (!(lesson.words?.length || lesson.sentences?.length)) {
        return failure("Pass at least one word or sentence.");
      }
      return attempt(async () => {
        const added = await addFocus(learnerId, lesson, { dryRun });
        if (!("previewed" in added && added.previewed)) {
          return json(addedForAgent(added));
        }
        const previewId = await keepPreview(learnerId, lesson);
        const asked = dryRun === undefined && added.sharing.length > 0;
        return json({
          ...addedForAgent(added),
          previewId,
          ...(asked
            ? {
                next: `Nothing saved. End your turn here: show the learner these entries and the new characters ${added.sharing.join(" ")} (keyword and props each), say every learner who adds them will share them, and ask whether to save. After their yes, call save_preview with ${previewId}.`,
              }
            : {}),
        });
      });
    }
  );

  server.registerTool(
    "save_preview",
    {
      title: "Save preview",
      description:
        "Save a lesson exactly as add_to_focus previewed it, once the learner has said yes.",
      inputSchema: z.object({
        previewId: z.string().describe("The previewId add_to_focus returned."),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    ({ previewId }) =>
      attempt(async () =>
        json(addedForAgent(await savePreview(learnerId, previewId)))
      )
  );

  server.registerTool(
    "remove_from_focus",
    {
      title: "Remove from focus",
      description:
        "Remove focus entries by their hanzi, words and sentences alike. Progress on items already learned is kept.",
      inputSchema: z.object({
        hanzi: z
          .array(z.string())
          .describe("Each entry's hanzi, exactly as get_focus lists it."),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ hanzi }) => json(await removeFocus(learnerId, hanzi))
  );

  return server;
}

const mcp = createMcpHandler(({ authInfo }) => {
  const learnerId = authInfo?.extra?.learnerId;
  if (typeof learnerId !== "string") {
    throw new Error("MCP request without a verified learner");
  }
  return focusServer(learnerId);
});

const unauthorized = () =>
  Response.json(
    {
      error:
        "This agent was disconnected from fluenc. Connect it again to manage focus.",
    },
    { status: 401 }
  );

export const handleMcp = createMcpProtectedRequestHandler(
  {
    issuer: authIssuer,
    audience: mcpResource,
    jwksUrl: `${authIssuer}/jwks`,
  },
  async (request, claims) => {
    const learnerId = claims.sub;
    const clientId = claims.azp;
    if (
      typeof learnerId !== "string" ||
      typeof clientId !== "string" ||
      !(await isAllowed(learnerId, clientId))
    ) {
      return unauthorized();
    }
    return mcp.fetch(request, {
      authInfo: {
        token: "",
        clientId,
        scopes: [],
        extra: { learnerId },
      },
    });
  }
);
