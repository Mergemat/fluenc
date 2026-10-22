# Fluenc Hanzi

`fluenc-hanzi.woff2` is the shared Chinese font for lessons, reviews, reading, and the library. It contains all 1,117 characters and components referenced by the current curriculum, reviewed compositions, and reading sentences. Props use Noto Sans CJK SC, described below. The Latin interface keeps its existing font.

The 750 course glyphs use the stroke paths shipped in `public/hanzi`, matching the studio's interactive SVG. Other glyphs come from the pinned Make Me a Hanzi graphics source recorded in `src/data/character-strokes.source.json`. For 65 component symbols without standalone source glyphs, the generator extracts a single occurrence from a course character, scales it proportionally, and centers it in the em square.

The font uses a 1,024-unit em. FontTools converts cubic curves to quadratic curves with a maximum error of 0.1 font units; the original quadratic stroke outlines are preserved. Overlapping stroke contours are marked explicitly. The encoded font is checked for complete Unicode coverage after writing.

The font is a modified derivative of the Arphic stroke graphics and is freely available under the [Arphic Public License](../licenses/ARPHICPL.TXT). Its name table records the source copyright and the 2026-09-11 conversion and component extraction. The font family is `Fluenc Hanzi`.

## Rebuild

Normal app builds use the committed font and do not need Python. After updating the curriculum or stroke files, regenerate with Bun. FontTools and Brotli are only required for this font-authoring step.

```sh
python3 -m venv /tmp/fluenc-font-env
/tmp/fluenc-font-env/bin/pip install 'fonttools==4.65.0' brotli
FLUENC_FONT_PYTHON=/tmp/fluenc-font-env/bin/python bun run data:font
```

`FLUENC_FONT_PYTHON` selects the font-authoring Python environment; otherwise the script uses `python3`. The Bun script downloads the pinned glyph source, gathers the app's required characters, and passes the paths to the FontTools encoder. Temporary input files are removed after generation.

The font is preloaded by the root document and precached by the service worker. Unsupported characters outside the shipped curriculum use the platform's Chinese font.

## Modern prop font

`noto-sans-sc-props.woff2` is a locally hosted subset of Noto Sans CJK SC Regular, used for prop glyphs in the studio, clue form, library, and palace. It includes 1,088 of the 1,117 characters and components in the curriculum and reviewed compositions. The 29 rare component symbols absent from Noto use the existing Fluenc Hanzi glyphs so they remain readable.

The source is [Noto Sans CJK SC Regular](https://github.com/notofonts/noto-cjk/blob/165c01b46ea533872e002e0785ff17e44f6d97d8/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf), distributed under the [SIL Open Font License](../licenses/NotoSansSC-OFL.txt). The 301,392-byte WOFF2 subset retains its original outlines and is precached by the existing service worker font rule.

To rebuild, download the source OTF to `.cache/noto-sans-cjk-sc.otf`, then use the FontTools environment from the instructions above:

```sh
bun -e 'import curriculum from "./src/data/curriculum.generated.json"; import reviewed from "./src/data/reviewed-compositions.json"; await Bun.write(".cache/prop-glyphs.txt", [...new Set([...curriculum.characters.flatMap(c => [c.hanzi, ...c.components]), ...reviewed.flatMap(c => [c.character, ...c.components])])].sort().join(""));'
/tmp/fluenc-font-env/bin/pyftsubset .cache/noto-sans-cjk-sc.otf --text-file=.cache/prop-glyphs.txt --flavor=woff2 --output-file=public/fonts/noto-sans-sc-props.woff2
```
