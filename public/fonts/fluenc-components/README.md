# Fluenc Components

`fluenc-components.woff2` is a 72 KiB (74,172 byte) WOFF2 subset of BabelStone Han for the component glyphs used by Fluenc.

Coverage is generated from every Unicode scalar in the `character` and `components` fields of `src/data/reviewed-compositions.json`, plus every component in `src/data/curriculum.generated.json`. The subset contains 539 required code points (540 glyphs including `.notdef`), including 32 non-BMP code points. The final cmap check reports zero missing code points.

The source font was downloaded on 2026-09-11 from:

- https://babelstone.co.uk/Fonts/Han.html
- https://babelstone.co.uk/Fonts/Download/BabelStoneHan.ttf

Source font SHA-256: `d8bb747b3fdccd84a60bd0aa56bb90937270d0bd15f1101cd8f2a5a3709dd0a3`

Subset font SHA-256: `52cd8fac4bb2d8f284983a3ec43aa863f371901ba5b710390313125e7db73cfb`

BabelStone Han is distributed under the original Arphic Public License. The unmodified license text is included in [LICENSE](./LICENSE). The modified font has renamed family, style, unique, full, PostScript, and typographic name fields using `Fluenc Components`; the source copyright and license attribution fields are preserved, with the required subset notice appended to the copyright field. No `BabelStone` string remains in the font name table. The BabelStone page permits modification and subsetting under that license and asks distributors of modified fonts to use a different font name.

## Recreate

Run from the repository root. These commands use Bun for glyph-set extraction and a temporary Python environment only for fontTools subsetting and WOFF2 encoding.

```sh
set -e
tmp="$(mktemp -d /tmp/fluenc-components-XXXXXX)"
python3 -m venv "$tmp/venv"
"$tmp/venv/bin/pip" install fonttools brotli
curl -L --fail --silent --show-error \
  https://babelstone.co.uk/Fonts/Download/BabelStoneHan.ttf \
  -o "$tmp/BabelStoneHan.ttf"

bun - <<'BUN' > "$tmp/codepoints.txt"
const reviewed = JSON.parse(await Bun.file('src/data/reviewed-compositions.json').text())
const curriculum = JSON.parse(await Bun.file('src/data/curriculum.generated.json').text())
const glyphs = new Set()
const add = (value) => { for (const glyph of Array.from(value ?? '')) glyphs.add(glyph) }
for (const entry of reviewed) {
  add(entry.character)
  for (const component of entry.components ?? []) add(component)
}
for (const entry of curriculum.characters ?? []) {
  for (const component of entry.components ?? []) add(component)
}
for (const glyph of [...glyphs].sort((a, b) => a.codePointAt(0) - b.codePointAt(0))) {
  console.log(glyph.codePointAt(0).toString(16))
}
BUN

"$tmp/venv/bin/pyftsubset" "$tmp/BabelStoneHan.ttf" \
  --unicodes-file="$tmp/codepoints.txt" \
  --output-file="$tmp/subset.woff2" \
  --flavor=woff2 \
  --no-hinting \
  --desubroutinize \
  --drop-tables=DSIG,GPOS,GSUB,STAT,meta,SVG \
  --layout-features='' \
  --name-IDs='' \
  --name-legacy \
  --name-languages='*'

"$tmp/venv/bin/python" - "$tmp/subset.woff2" "$tmp/BabelStoneHan.ttf" "$tmp/subset-renamed.woff2" <<'PY'
from fontTools.ttLib import TTFont
import sys

subset, source, output = sys.argv[1:]
original = TTFont(source)
font = TTFont(subset)
font.recalcTimestamp = False
font['name'].names = []
def source_name(name_id):
    for record in original['name'].names:
        if record.nameID == name_id and record.platformID == 3 and record.platEncID == 1 and record.langID == 0x409:
            return record.toUnicode()
    return None
names = {
    0: source_name(0) + ' Modified 2026-09-11 by Fluenc: glyph subset and WOFF2 conversion.',
    1: 'Fluenc Components',
    2: source_name(2),
    3: 'Fluenc Components:Version 16.0.3;Fluenc subset 2026-09-11',
    4: 'Fluenc Components',
    5: source_name(5),
    6: 'FluencComponents',
    13: source_name(13),
    14: source_name(14),
    16: 'Fluenc Components',
    17: 'Regular',
}
for platform, encoding, language in ((3, 1, 0x409), (1, 0, 0)):
    for name_id, value in names.items():
        if value is not None:
            font['name'].setName(value, name_id, platformID=platform, platEncID=encoding, langID=language)
font.save(output)
PY

mkdir -p public/fonts/fluenc-components
cp "$tmp/subset-renamed.woff2" public/fonts/fluenc-components/fluenc-components.woff2
```

The license file is the verbatim text from https://ftp.gnu.org/non-gnu/chinese-fonts-truetype/LICENSE.
