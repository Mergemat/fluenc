# Fluenc Hanzi

`fluenc-hanzi.woff2` is the shared Chinese font for lessons, reviews, reading, and the library. It contains every course character and every component the course teaches as a prop. Reading sentences use only course characters. Props use Noto Sans CJK SC, described below. The Latin interface keeps its existing font.

Every glyph comes from the stroke paths vendored in `public/hanzi`, matching the studio's interactive SVG. A course character uses its own file. A component that isn't a course character is the strokes it draws in the course character with the fewest strokes that has it once, scaled proportionally and centered in the em square. Nothing is downloaded.

The font uses a 1,024-unit em. FontTools converts cubic curves to quadratic curves with a maximum error of 0.1 font units; the original quadratic stroke outlines are preserved. Overlapping stroke contours are marked explicitly. The encoded font is checked for complete Unicode coverage after writing.

The font is a modified derivative of the Arphic stroke graphics and is freely available under the [Arphic Public License](../licenses/ARPHICPL.TXT). Its name table records the source copyright and the 2026-09-11 conversion and component extraction. The font family is `Fluenc Hanzi`.

## Rebuild

Normal app builds use the committed font and do not need Python. After updating the curriculum or stroke files, regenerate with Bun. FontTools and Brotli are only required for this font-authoring step.

```sh
python3 -m venv /tmp/fluenc-font-env
/tmp/fluenc-font-env/bin/pip install 'fonttools==4.65.0' brotli
FLUENC_FONT_PYTHON=/tmp/fluenc-font-env/bin/python bun run data:font
```

`FLUENC_FONT_PYTHON` selects the font-authoring Python environment; otherwise the script uses `python3`. The Bun script gathers the app's characters and components from `public/hanzi` and passes their paths to the FontTools encoder. Temporary input files are removed after generation.

The font is preloaded by the root document and precached by the service worker. Unsupported characters outside the shipped curriculum use the platform's Chinese font.

## Modern prop font

`noto-sans-sc-props.woff2` is a locally hosted subset of Noto Sans CJK SC Regular, used for prop glyphs in the studio, clue form, library, and palace. It includes the course characters and components that Noto has. A component symbol absent from Noto uses the Fluenc Hanzi glyph so it stays readable.

The source is [Noto Sans CJK SC Regular](https://github.com/notofonts/noto-cjk/blob/165c01b46ea533872e002e0785ff17e44f6d97d8/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf), distributed under the [SIL Open Font License](../licenses/NotoSansSC-OFL.txt). The 301,392-byte WOFF2 subset retains its original outlines and is precached by the existing service worker font rule.

To rebuild, download the source OTF to `.cache/noto-sans-cjk-sc.otf`, then use the FontTools environment from the instructions above:

```sh
bun -e 'import curriculum from "./src/data/curriculum.generated.json"; await Bun.write(".cache/prop-glyphs.txt", [...new Set(curriculum.characters.flatMap(c => [c.hanzi, ...c.components]))].sort().join(""));'
/tmp/fluenc-font-env/bin/pyftsubset .cache/noto-sans-cjk-sc.otf --text-file=.cache/prop-glyphs.txt --flavor=woff2 --output-file=public/fonts/noto-sans-sc-props.woff2
```
