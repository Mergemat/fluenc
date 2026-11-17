import { createFileRoute } from "@tanstack/react-router";

// The stroke outlines of a character the course doesn't ship, so a learner's own characters draw
// part by part like the course's. hanzi-writer-data is Make Me a Hanzi's graphics.txt split per
// character: the same Arphic outlines as assets/strokes.json. Pinned, so a response never changes.
const SOURCE = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1";
const ONE_CHARACTER = /^\p{Script=Han}$/u;
const FOREVER = "public, max-age=31536000, s-maxage=31536000, immutable";

export const Route = createFileRoute("/api/strokes/$hanzi")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { hanzi } = params;
        if (!ONE_CHARACTER.test(hanzi)) {
          return new Response("One Chinese character", { status: 400 });
        }
        const upstream = await fetch(
          `${SOURCE}/${encodeURIComponent(hanzi)}.json`
        );
        if (upstream.status === 404) {
          return new Response(null, {
            status: 404,
            headers: { "Cache-Control": FOREVER },
          });
        }
        if (!upstream.ok) {
          return new Response(null, { status: 502 });
        }
        const { strokes } = (await upstream.json()) as { strokes: string[] };
        return Response.json(
          { strokes },
          { headers: { "Cache-Control": FOREVER } }
        );
      },
    },
  },
});
