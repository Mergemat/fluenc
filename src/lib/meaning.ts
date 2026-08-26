const primaryMeaningOverrides: Record<string, string> = {
  'this, that; single; measure word for individuals': 'individual',
  'clear; to finish; particle of completed action': 'completed-action particle',
  'other, another; he, she, it': 'he',
  'no, not, un-; negative prefix': 'not',
  'at, in, on; to exist; used to indicate the present progressive tense': 'located at',
  'to have, to own, to possess; to exist': 'have',
  'to be; indeed, right, yes; okay': 'to be',
  'final interrogative particle': 'question particle',
}

export function splitMeaning(value: string) {
  const meanings = value
    .split(/[;,]/)
    .map((meaning) => meaning.trim())
    .filter(Boolean)

  const primary = primaryMeaningOverrides[value] ?? meanings[0] ?? value
  const alternatives = primaryMeaningOverrides[value]
    ? meanings.filter((meaning) => meaning.toLocaleLowerCase() !== primary.toLocaleLowerCase())
    : meanings.slice(1)

  return { primary, alternatives }
}
