import { expect, test } from 'bun:test'

import { getItemMeaning } from './meaning'

test('the "also" line is one short clean sense that adds something', () => {
  expect(getItemMeaning({ keyword: 'can', dictionaryMeanings: ['(prefix) can; may; able to; -able'] }).also).toBe('may')
  expect(getItemMeaning({ keyword: 'for', dictionaryMeanings: ['because of', 'for; to'] }).also).toBe('because of')
  expect(getItemMeaning({ meaning: 'why', dictionaryMeanings: ['why?'] }).also).toBe('why?')
  expect(getItemMeaning({ keyword: 'one', dictionaryMeanings: ['one', 'a very long dictionary gloss that goes on and on'] }).also).toBeNull()
})
