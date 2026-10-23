# Third-party material

Fluenc's source code is MIT licensed. The data, fonts and recordings below keep their own licenses. Keep their attribution and license when you redistribute them.

| Material | Where | Source | License |
| --- | --- | --- | --- |
| Dictionary senses and readings | `src/data/dictionary.source.json`, generated curriculum | [CC-CEDICT](https://cc-cedict.org), distributed by [MDBG](https://www.mdbg.net/chinese/dictionary?page=cedict) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Example sentences and translations | `src/data/sentences.reviewed.json`, `src/data/sentences.generated.json` | [Tatoeba](https://tatoeba.org) contributors | [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) |
| Character decompositions | generated curriculum | [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) `dictionary.txt` | LGPL 3.0 or later, see `public/licenses/hanzi-COPYING.txt` |
| Stroke graphics | `public/hanzi/`, `public/fonts/fluenc-hanzi.woff2` | Make Me a Hanzi `graphics.txt`, from Arphic PL fonts | [Arphic Public License](public/licenses/ARPHICPL.TXT) |
| Prop font | `public/fonts/noto-sans-sc-props.woff2` | [Noto Sans CJK SC](https://github.com/notofonts/noto-cjk) | [SIL OFL 1.1](public/licenses/NotoSansSC-OFL.txt) |
| Interface fonts | `public/fonts/geist/` | [Geist](https://github.com/vercel/geist-font) by Vercel and basement.studio | [SIL OFL 1.1](public/fonts/geist/LICENSE.txt) |
| Syllable recordings | `public/audio/pinyin/` | [AllSet Learning Chinese Pronunciation Wiki](https://resources.allsetlearning.com/chinese/pronunciation/Pinyin_chart) | [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/), non-commercial only. See `public/audio/pinyin/NOTICE.md` |
| `nü3` and `lü4` recordings | `public/audio/pinyin/` | [davinfifield/mp3-chinese-pinyin-sound](https://github.com/davinfifield/mp3-chinese-pinyin-sound) | The Unlicense |
| Word frequency order | generated curriculum | [Adsonant 1,000 most common Chinese words](https://adsonant.com/resources/chinese/1000-most-common-words) | No license published. Fluenc uses only the rank order |

`src/data/README.md` explains how each data file is built and reviewed. `public/fonts/README.md` explains how the fonts are built.

The recordings are the one part that blocks commercial use. To use Fluenc commercially, replace `public/audio/pinyin/` with recordings you are allowed to use that way.
