# Fluenc Hanzi

`fluenc-hanzi.woff2` is the shared Chinese font for lessons, reviews, reading, the library, and props. It contains all 1,085 characters and components referenced by the current curriculum, reviewed compositions, and reading sentences. The Latin interface keeps its existing font.

The 728 course glyphs use the stroke paths shipped in `public/hanzi`, matching the studio's interactive SVG. Other glyphs come from the pinned Make Me a Hanzi graphics source recorded in `src/data/character-strokes.source.json`. For 49 component symbols without standalone source glyphs, the generator extracts a single occurrence from a course character, scales it proportionally, and centers it in the em square.

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
