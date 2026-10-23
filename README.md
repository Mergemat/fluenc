# fluenc

A Mandarin study app for reading Chinese characters, built on the Hanzi Movie Method by Mandarin Blueprint. Fluenc is an independent project and is not affiliated with or endorsed by Mandarin Blueprint.

![Fluenc's today, review, learn and library screens](.github/screenshot.png)

It covers about 1,000 of the most common spoken words and the 750 characters they use. Each part is its own activity, done whenever you like:

- **Lessons** teach the next character or word whose parts you already know. You build a Hanzi Movie for each character from your actors, sets and props.
- **Review** shows everything due, scheduled with [FSRS](https://github.com/open-spaced-repetition/ts-fsrs).
- **Reading** shows sentences made almost entirely from words you know. You shadow each one aloud before it joins Review.
- **Focus** puts words from a class you're taking at the front of the queue.

Progress is stored on the device first and syncs to your account when you're online, so the app works offline once installed. A daily push notification can remind you to review.

## Stack

TanStack Start with React 19, Drizzle on Turso (libSQL), Better Auth with email and password, Tailwind 4, Workbox for offline use, and Bun for everything else. It deploys to Vercel.

## Run it locally

You need [Bun](https://bun.sh) 1.3 or later.

```sh
bun install
cp .env.example .env
```

In `.env`, set at least:

```sh
TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=local                       # any value works for a local file
BETTER_AUTH_SECRET=$(openssl rand -base64 32) # paste the output
BETTER_AUTH_URL=http://localhost:3000
```

Then create the tables and start the app:

```sh
bun run db:migrate
bun run dev
```

Open http://localhost:3000 and sign up.

The other variables in `.env.example` are optional:

- `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` turn on spoken audio for words and sentences. Single characters always play from the recordings in `public/audio/pinyin`. Only signed-in users can request generated audio.
- `BLOB_READ_WRITE_TOKEN` stores generated audio in Vercel Blob, so each text is generated once. On Vercel the token is injected for you.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `CRON_SECRET` turn on daily reminders. See [Reminders](#reminders).
- `FLUENC_EMAIL` sets the account that `bun run focus` and `bun run claim` use.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Start the dev server |
| `bun run build` | Build the app and its service worker |
| `bun run preview` | Serve the production build |
| `bun test` | Run the tests |
| `bun run check` / `bun run fix` | Lint and format with Ultracite (Biome) |
| `bun run typecheck` | Type-check. Run a build or `dev` first, since it generates the route tree |
| `bun run db:generate` / `db:migrate` | Create and apply Drizzle migrations |
| `bun run focus` | Add, list or remove focus words and sentences for an account |
| `bun run claim` | Move progress saved before accounts existed onto an account |
| `bun run data:sync` | Rebuild the curriculum from the reviewed data in `src/data` |
| `bun run data:sentences` | Rebuild the reading sentences |
| `bun run data:strokes` / `data:font` | Rebuild stroke data and the hanzi font |

`src/data/README.md` explains where the curriculum comes from and how to change it.

### Focus

`bun run focus add lesson.json` takes a file like this:

```json
{
  "label": "HSK 1 · L3",
  "words": [{ "hanzi": "学生", "pinyin": "xuésheng", "meaning": "student" }],
  "sentences": [{ "hanzi": "他是学生。", "pinyin": "Tā shì xuésheng.", "meaning": "He is a student." }]
}
```

Lessons teach focus words first, starting with the characters they still need. Add `--dry-run` to see what would change.

## Deploy

The app deploys to Vercel as is. `vercel.json` sets the region and the reminder cron job.

1. Create a Turso database and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
2. Set `BETTER_AUTH_SECRET` and set `BETTER_AUTH_URL` to your public URL.
3. Run `bun run db:migrate` against that database.
4. Deploy with `bunx vercel deploy --prod`.

### Reminders

1. Generate one key pair with `bunx web-push generate-vapid-keys --json` and set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Keep the same pair across deploys, because changing it makes every device subscribe again.
2. Set `VAPID_SUBJECT` to a public HTTPS URL or a `mailto:` address.
3. Set `CRON_SECRET`. Vercel sends it with the cron request to `/api/review-reminder`, which runs daily at 06:00 UTC.
4. In the installed app, open Settings, then Review reminders, and enable notifications. On iPhone this needs iOS 16.4 or later and the app added to the Home Screen.

On the Vercel Hobby plan the job can run any time within that hour, and Vercel doesn't retry failed cron runs.

## License

The code is [MIT](LICENSE). The dictionary data, sentences, stroke graphics, fonts and syllable recordings have their own licenses, listed in [THIRD_PARTY.md](THIRD_PARTY.md). The syllable recordings are licensed for non-commercial use only.
