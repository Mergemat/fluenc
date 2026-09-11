import { expect, test } from 'bun:test'

import curriculum from '../data/curriculum.generated.json'
import { characterForWord, characterIsWord, studyIdentity } from './character-words'
import { characterWordEquivalences } from './character-word-equivalence'

function wordId(hanzi: string) {
  const word = curriculum.words.find(word => word.hanzi === hanzi)
  if (!word) throw new Error(`Missing course word: ${hanzi}`)
  return String(word.id)
}

test('person and be use their character memory instead of a second word card', () => {
  for (const hanzi of ['人', '是']) {
    expect(studyIdentity('word', wordId(hanzi))).toEqual({ itemType: 'character', itemId: hanzi })
    expect(characterIsWord(hanzi)).toBeTrue()
  }
})

test('another reading or sense remains a word lesson even with one character', () => {
  for (const hanzi of ['干', '待', '长', '信', '本', '天']) {
    const id = wordId(hanzi)
    expect(characterForWord(id)).toBeUndefined()
    expect(studyIdentity('word', id)).toEqual({ itemType: 'word', itemId: id })
  }
  expect(characterForWord(wordId('我们'))).toBeUndefined()
})

test('a vocabulary definition change removes an earlier character equivalence', () => {
  const person = curriculum.characters.find(character => character.hanzi === '人')!
  const word = curriculum.words.find(word => word.hanzi === '人')!
  expect(characterWordEquivalences([person], [{ ...word, meaning: 'somebody else' }])).toEqual({})
  expect(characterWordEquivalences([person], [{ ...word, pinyin: 'rěn' }])).toEqual({})
})
