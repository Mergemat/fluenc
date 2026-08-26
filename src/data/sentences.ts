export type Sentence = {
  id: string
  hanzi: string
  pinyin: string
  meaningRu: string
  words: string[]
}

export const sentences: Sentence[] = [
  { id: 's01', hanzi: '你好。', pinyin: 'Nǐ hǎo.', meaningRu: 'Привет.', words: ['你', '好'] },
  { id: 's02', hanzi: '我是学生。', pinyin: 'Wǒ shì xuésheng.', meaningRu: 'Я студент.', words: ['我', '是'] },
  { id: 's03', hanzi: '你是中国人吗？', pinyin: 'Nǐ shì Zhōngguó rén ma?', meaningRu: 'Ты китаец?', words: ['你', '是', '人'] },
  { id: 's04', hanzi: '我不知道。', pinyin: 'Wǒ bù zhīdào.', meaningRu: 'Я не знаю.', words: ['我', '不', '知道'] },
  { id: 's05', hanzi: '你想吃什么？', pinyin: 'Nǐ xiǎng chī shénme?', meaningRu: 'Что ты хочешь поесть?', words: ['你', '想', '吃', '什么'] },
  { id: 's06', hanzi: '我想喝水。', pinyin: 'Wǒ xiǎng hē shuǐ.', meaningRu: 'Я хочу воды.', words: ['我', '想'] },
  { id: 's07', hanzi: '他已经来了。', pinyin: 'Tā yǐjīng lái le.', meaningRu: 'Он уже пришёл.', words: ['他', '已经', '来'] },
  { id: 's08', hanzi: '我们一起去。', pinyin: 'Wǒmen yìqǐ qù.', meaningRu: 'Мы пойдём вместе.', words: ['我们', '一起', '去'] },
  { id: 's09', hanzi: '你会说中文吗？', pinyin: 'Nǐ huì shuō Zhōngwén ma?', meaningRu: 'Ты говоришь по-китайски?', words: ['你', '会', '说'] },
  { id: 's10', hanzi: '我很喜欢这里。', pinyin: 'Wǒ hěn xǐhuan zhèlǐ.', meaningRu: 'Мне здесь очень нравится.', words: ['我', '很', '喜欢', '这里'] },
  { id: 's11', hanzi: '这是什么？', pinyin: 'Zhè shì shénme?', meaningRu: 'Что это?', words: ['这', '是', '什么'] },
  { id: 's12', hanzi: '你为什么这么说？', pinyin: 'Nǐ wèishénme zhème shuō?', meaningRu: 'Почему ты так говоришь?', words: ['你', '为什么', '这么', '说'] },
  { id: 's13', hanzi: '我没有时间。', pinyin: 'Wǒ méiyǒu shíjiān.', meaningRu: 'У меня нет времени.', words: ['我', '没有'] },
  { id: 's14', hanzi: '请再说一次。', pinyin: 'Qǐng zài shuō yí cì.', meaningRu: 'Повторите ещё раз.', words: ['请', '再', '说'] },
  { id: 's15', hanzi: '我觉得很好。', pinyin: 'Wǒ juéde hěn hǎo.', meaningRu: 'Мне кажется, это хорошо.', words: ['我', '觉得', '很', '好'] },
  { id: 's16', hanzi: '你可以帮我吗？', pinyin: 'Nǐ kěyǐ bāng wǒ ma?', meaningRu: 'Ты можешь мне помочь?', words: ['你', '我', '帮'] },
]
