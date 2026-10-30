"""Encode stroke outlines as a static WOFF2 font: one glyph per code point in the input.

An input glyph with `layers` becomes a colour glyph: one layer per part, on the palette slot of its
place, and a plain glyph made of the same layers for renderers without colour."""
import json
import sys
from pathlib import Path

from fontTools.colorLib.builder import buildCOLR, buildCPAL
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont

request = json.loads(Path(sys.argv[1]).read_text())
entries = request['glyphs']
family = request['family']
font = FontBuilder(1024, isTTF=True)
names = {entry['codePoint']: f'u{entry["codePoint"]:04X}' for entry in entries}
layerNames = {}
for entry in entries:
    if 'layers' in entry:
        name = names[entry['codePoint']]
        layerNames[name] = [f'{name}.{slot}' for slot in range(len(entry['layers']))]
font.setupGlyphOrder(['.notdef', *names.values(), *(layer for layers in layerNames.values() for layer in layers)])
font.setupCharacterMap(names)
glyphs = {'.notdef': TTGlyphPen(None).glyph()}


def outline(path, normalize, label):
    pen = TTGlyphPen(None)
    target = Cu2QuPen(pen, max_err=0.1)
    if normalize:
        bounds = BoundsPen(None)
        parse_path(path, bounds)
        left, bottom, right, top = bounds.bounds
        scale = 800 / max(right - left, top - bottom)
        target = TransformPen(target, (scale, 0, 0, scale, 512 - scale * (left + right) / 2, 388 - scale * (bottom + top) / 2))
    parse_path(path, target)
    glyph = pen.glyph()
    if not glyph.numberOfContours:
        raise ValueError(f'Empty glyph: {label}')
    # Stroke contours may overlap where the original character strokes meet.
    glyph.flags[0] |= 0x40
    return glyph


colorLayers = {}
for entry in entries:
    name = names[entry['codePoint']]
    if name not in layerNames:
        glyphs[name] = outline(' '.join(entry['strokes']), entry['normalize'], name)
        continue
    plain = TTGlyphPen(glyphs)
    for layer, strokes in zip(layerNames[name], entry['layers']):
        glyphs[layer] = outline(' '.join(strokes), False, layer)
        # The plain glyph reuses the layers' outlines rather than storing them twice.
        plain.addComponent(layer, (1, 0, 0, 1, 0, 0))
    glyphs[name] = plain.glyph()
    # Parts may touch where their strokes meet.
    glyphs[name].components[0].flags |= 0x400
    colorLayers[name] = [(layer, slot) for slot, layer in enumerate(layerNames[name])]
font.setupGlyf(glyphs)
glyf = font.font['glyf']
for glyph in glyf.glyphs.values():
    glyph.recalcBounds(glyf)
font.setupHorizontalMetrics({name: (1024, glyph.xMin if glyph.numberOfContours else 0) for name, glyph in glyf.glyphs.items()})
if colorLayers:
    font.font['COLR'] = buildCOLR(colorLayers, version=0)
    font.font['CPAL'] = buildCPAL([[(red / 255, green / 255, blue / 255, 1.0) for red, green, blue in request['palette']]])
font.setupHorizontalHeader(ascent=900, descent=-124)
font.setupNameTable({
    'familyName': family,
    'styleName': 'Regular',
    'uniqueFontIdentifier': f'{family} 1.0',
    'fullName': family,
    'psName': family.replace(' ', ''),
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
output = Path(request['output'])
font.save(output)
encoded = TTFont(output)
if set(encoded.getBestCmap()) != set(names):
    raise ValueError('Font encoding lost required characters')
print(f'Built {output}: {len(names)} glyphs, {output.stat().st_size} bytes.')
