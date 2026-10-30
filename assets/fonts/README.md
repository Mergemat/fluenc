# Fluenc Hanzi

The app ships cut-down copies of the full fonts in this folder, made by `scripts/build-fonts.ts` into `web/`:

- The Chinese fonts are split into chunks of 25 characters in teaching order, in `fluenc-hanzi/`, `fluenc-hanzi-parts/` and `noto-sans-sc-props/`. Each chunk is declared with its `unicode-range`, so a browser downloads only the chunks holding characters on screen.
- The Geist fonts in `geist/` keep Latin, pinyin's tone letters, punctuation and the interface's symbols.

The faces are written to `src/fonts.generated.css`. Rebuild them after changing a font here:

```sh
bun scripts/build-fonts.ts
```

`fluenc-hanzi.woff2` is the shared Chinese font for lessons, reviews, reading, and the library. It contains every course character and every component the course teaches as a prop. Reading sentences use only course characters. Props use Noto Sans CJK SC, described below. The Latin interface keeps its existing font.

Every glyph comes from the stroke outlines vendored in `assets/strokes.json`. A course character uses its own strokes. A component that isn't a course character is the strokes it draws in the course character with the fewest strokes that has it once, scaled proportionally and centered in the em square. Nothing is downloaded.

The font uses a 1,024-unit em. FontTools converts cubic curves to quadratic curves with a maximum error of 0.1 font units; the original quadratic stroke outlines are preserved. Overlapping stroke contours are marked explicitly. The encoded font is checked for complete Unicode coverage after writing.

The font is a modified derivative of the Arphic stroke graphics and is freely available under the [Arphic Public License](../licenses/ARPHICPL.TXT). Its name table records the source copyright and the 2026-09-11 conversion and component extraction. The font family is `Fluenc Hanzi`.

`fluenc-hanzi-parts.woff2` (`Fluenc Hanzi Parts`) draws each course character as a COLR colour font: at the character's own code point, one layer per part, each on the palette slot of the part's place in `src/lib/glyph-parts.ts`. The plain glyph is made of the same layers. The font's own palette gives every slot a distinct colour, so a canvas drawing tells the parts apart for hit-testing; the page draws with palettes of its own (`@font-palette-values`) to fade, clear or isolate a part. It comes from the same strokes, split by their `owners`, under the same license.

## Rebuild

App builds use the committed fonts. `bun run data:sync` rebuilds them itself whenever the course's characters, props, parts or teaching order change, so they can't fall behind the curriculum. To rebuild them by hand, for example after editing `assets/strokes.json`:

```sh
bun run data:font
```

The font scripts run FontTools through [uv](https://docs.astral.sh/uv/), which fetches the pinned version on first use (see `scripts/font-python.ts`); nothing else needs setting up. `data:font` writes `assets/fonts/fluenc-hanzi.woff2` and `assets/fonts/fluenc-hanzi-parts.woff2`, then the shipped chunks. The Bun script gathers the app's characters, components and parts from `assets/strokes.json` and passes their paths to the FontTools encoder. Temporary input files are removed after generation.

The chunks are precached by the service worker. Unsupported characters outside the shipped curriculum use the platform's Chinese font.

## Modern prop font

`noto-sans-sc-props.woff2` is a locally hosted subset of Noto Sans CJK SC Regular, used for prop glyphs in the studio, clue form, library, and palace. It includes the course characters and components that Noto has. A component symbol absent from Noto uses the Fluenc Hanzi glyph so it stays readable.

The source is [Noto Sans CJK SC Regular](https://github.com/notofonts/noto-cjk/blob/165c01b46ea533872e002e0785ff17e44f6d97d8/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf), distributed under the [SIL Open Font License](../licenses/NotoSansSC-OFL.txt). The WOFF2 subset retains its original outlines and is precached by the existing service worker font rule.

To rebuild, download the source OTF to `.cache/noto-sans-cjk-sc.otf`, then:

```sh
bun -e 'import curriculum from "./src/data/curriculum.generated.json"; await Bun.write(".cache/prop-glyphs.txt", [...new Set(curriculum.characters.flatMap(c => [c.hanzi, ...c.components]))].sort().join(""));'
uv run --no-project --with fonttools==4.65.0 --with brotli pyftsubset .cache/noto-sans-cjk-sc.otf --text-file=.cache/prop-glyphs.txt --flavor=woff2 --output-file=assets/fonts/noto-sans-sc-props.woff2
bun scripts/build-fonts.ts
```
