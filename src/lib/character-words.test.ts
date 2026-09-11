import { expect, test } from 'bun:test'

import curriculum from '../data/curriculum.generated.json'
import { characterForWord, characterIsWord, studyIdentity } from './character-words'
import { characterWordEquivalences } from './character-word-equivalence'

function wordId(hanzi: string) {
  const word = curriculum.words.find(word => word.hanzi === hanzi)
  if (!word) throw new Error(`Missing course word: ${hanzi}`)
  return String(word.id)
}

test('single characters share a memory across vocabulary meanings of the same pronunciation', () => {
  for (const hanzi of ['人', '是', '太', '信', '本', '天']) {
    expect(studyIdentity('word', wordId(hanzi))).toEqual({ itemType: 'character', itemId: hanzi })
    expect(characterIsWord(hanzi)).toBeTrue()
  }
})

test('another pronunciation remains a separate reading lesson', () => {
  for (const hanzi of ['干', '待', '长']) {
    const id = wordId(hanzi)
    expect(characterForWord(id)).toBeUndefined()
    expect(studyIdentity('word', id)).toEqual({ itemType: 'word', itemId: id })
  }
  expect(characterForWord(wordId('我们'))).toBeUndefined()
})

test('character equivalence depends on pronunciation, not the chosen English gloss', () => {
  const person = curriculum.characters.find(character => character.hanzi === '人')!
  const word = curriculum.words.find(word => word.hanzi === '人')!
  const reworded = { ...word, meaning: 'a person' }
  expect(characterWordEquivalences([person], [reworded])).toEqual({ [word.id]: person.id })
  expect(characterWordEquivalences([person], [{ ...word, pinyin: 'rěn' }])).toEqual({})
})
