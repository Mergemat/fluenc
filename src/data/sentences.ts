export type Sentence = {
  id: string
  hanzi: string
  pinyin: string
  meaning: string
  words: string[]
}

export const sentences: Sentence[] = [
  { id: 's01', hanzi: '你好。', pinyin: 'Nǐ hǎo.', meaning: 'Hi.', words: ['你', '好'] },
  { id: 's02', hanzi: '我是学生。', pinyin: 'Wǒ shì xuésheng.', meaning: 'I’m a student.', words: ['我', '是'] },
  { id: 's03', hanzi: '你是中国人吗？', pinyin: 'Nǐ shì Zhōngguó rén ma?', meaning: 'Are you Chinese?', words: ['你', '是', '人'] },
  { id: 's04', hanzi: '我不知道。', pinyin: 'Wǒ bù zhīdào.', meaning: 'I don’t know.', words: ['我', '不', '知道'] },
  { id: 's05', hanzi: '你想吃什么？', pinyin: 'Nǐ xiǎng chī shénme?', meaning: 'What do you want to eat?', words: ['你', '想', '吃', '什么'] },
  { id: 's06', hanzi: '我想喝水。', pinyin: 'Wǒ xiǎng hē shuǐ.', meaning: 'I want to drink water.', words: ['我', '想'] },
  { id: 's07', hanzi: '他已经来了。', pinyin: 'Tā yǐjīng lái le.', meaning: 'He is already here.', words: ['他', '已经', '来'] },
  { id: 's08', hanzi: '我们一起去。', pinyin: 'Wǒmen yìqǐ qù.', meaning: 'Let’s go together.', words: ['我们', '一起', '去'] },
  { id: 's09', hanzi: '你会说中文吗？', pinyin: 'Nǐ huì shuō Zhōngwén ma?', meaning: 'Do you speak Chinese?', words: ['你', '会', '说'] },
  { id: 's10', hanzi: '我很喜欢这里。', pinyin: 'Wǒ hěn xǐhuan zhèlǐ.', meaning: 'I really like it here.', words: ['我', '很', '喜欢', '这里'] },
]
