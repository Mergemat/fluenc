"""Encode the studio's existing SVG outlines as a shared, static WOFF2 font."""
import json
import sys
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont

entries = json.loads(Path(sys.argv[1]).read_text())
font = FontBuilder(1024, isTTF=True)
names = {ord(entry['character']): f'uni{ord(entry["character"]):04X}' for entry in entries}
font.setupGlyphOrder(['.notdef', *names.values()])
font.setupCharacterMap(names)
glyphs = {'.notdef': TTGlyphPen(None).glyph()}
for entry in entries:
    path = ' '.join(entry['strokes'])
    pen = TTGlyphPen(None)
    target = Cu2QuPen(pen, max_err=0.1)
    if entry['normalize']:
        bounds = BoundsPen(None)
        parse_path(path, bounds)
        left, bottom, right, top = bounds.bounds
        scale = 800 / max(right - left, top - bottom)
        target = TransformPen(target, (scale, 0, 0, scale, 512 - scale * (left + right) / 2, 388 - scale * (bottom + top) / 2))
    parse_path(path, target)
    glyph = pen.glyph()
    if not glyph.numberOfContours:
        raise ValueError(f'Empty glyph: {entry["character"]}')
    # Stroke contours may overlap where the original character strokes meet.
    glyph.flags[0] |= 0x40
    glyphs[names[ord(entry['character'])]] = glyph
font.setupGlyf(glyphs)
font.setupHorizontalMetrics({name: (1024, glyph.xMin if glyph.numberOfContours else 0) for name, glyph in glyphs.items()})
font.setupHorizontalHeader(ascent=900, descent=-124)
font.setupNameTable({
    'familyName': 'Fluenc Hanzi',
    'styleName': 'Regular',
    'uniqueFontIdentifier': 'Fluenc Hanzi 1.0',
    'fullName': 'Fluenc Hanzi',
    'psName': 'FluencHanzi',
    'version': 'Version 1.0',
    'copyright': 'Copyright (C) 1999 Arphic Technology Co., Ltd. Modified by Fluenc, 2026-09-11: studio stroke outlines encoded as WOFF2; standalone components extracted and centered.',
    'licenseDescription': 'Arphic Public License. This modified font is freely available under the same license.',
    'licenseInfoURL': 'https://ftp.gnu.org/non-gnu/chinese-fonts-truetype/LICENSE',
})
font.setupOS2(sTypoAscender=900, sTypoDescender=-124, sTypoLineGap=0, usWinAscent=1024, usWinDescent=256)
font.setupPost()
font.setupMaxp()
font.font['head'].created = font.font['head'].modified = 3871929600
font.font.recalcTimestamp = False
font.font.flavor = 'woff2'
output = Path('public/fonts/fluenc-hanzi.woff2')
font.save(output)
encoded = TTFont(output)
if set(encoded.getBestCmap()) != set(names):
    raise ValueError('Font encoding lost required characters')
print(f'Built {output}: {len(names)} glyphs, {output.stat().st_size} bytes; {sum(entry["normalize"] for entry in entries)} component shapes extracted from lessons.')
