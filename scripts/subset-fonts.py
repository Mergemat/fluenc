"""Cut fonts into WOFF2 subsets in one process: [{source, output, unicodes}] as JSON in argv[1].

Each source is unpacked from WOFF2 once, its tables kept as they were rather than recompiled, so
the output matches `fonttools subset`'s byte for byte. Every subset starts from a fresh parse,
since subsetting changes the font it works on."""
import io
import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import woff2

jobs = json.loads(Path(sys.argv[1]).read_text())
decoded = {}
for job in jobs:
    source = job['source']
    if source not in decoded:
        unpacked = io.BytesIO()
        woff2.decompress(io.BytesIO(Path(source).read_bytes()), unpacked)
        decoded[source] = unpacked.getvalue()
    options = subset.Options()
    # Every feature stays: the interface uses tabular numbers, and pinyin needs its marks placed.
    options.layout_features = ['*']
    options.flavor = 'woff2'
    # load_font, as the CLI does: a plain TTFont stamps a new modified time into every subset.
    font = subset.load_font(io.BytesIO(decoded[source]), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=subset.parse_unicodes(job['unicodes']))
    subsetter.subset(font)
    subset.save_font(font, job['output'], options)
