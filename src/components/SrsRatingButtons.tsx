type Rating = {
  value: number
  label: string
  detail: string
}

const reviewRatings: Rating[] = [
  { value: 1, label: 'Не вспомнил', detail: 'ошибка' },
  { value: 2, label: 'С усилием', detail: 'через фильм' },
  { value: 3, label: 'С паузой', detail: 'верно' },
  { value: 4, label: 'Сразу', detail: 'мгновенно' },
]

const codebookRatings: Rating[] = [
  { value: 1, label: 'Не вспомнил', detail: 'связь не пришла или была неверной' },
  { value: 2, label: 'С усилием', detail: 'пришлось долго искать связь' },
  { value: 3, label: 'С паузой', detail: 'верно после короткой паузы' },
  { value: 4, label: 'Сразу', detail: 'связь пришла мгновенно' },
]

const sentenceRatings: Rating[] = [
  { value: 1, label: 'Не сказал', detail: 'ошибка' },
  { value: 2, label: 'С трудом', detail: 'много пауз' },
  { value: 3, label: 'С паузой', detail: 'верно' },
  { value: 4, label: 'Сразу', detail: 'свободно' },
]

export function SrsRatingButtons({
  pending,
  onRate,
  kind = 'review',
}: {
  pending: boolean
  onRate: (rating: number) => void
  kind?: 'review' | 'codebook' | 'sentence'
}) {
  const ratings = kind === 'codebook' ? codebookRatings : kind === 'sentence' ? sentenceRatings : reviewRatings

  return (
    <div className="mt-5 grid grid-cols-4 divide-x divide-line border-y border-line max-[720px]:grid-cols-2 max-[720px]:divide-x-0" aria-label="Оценить воспоминание">
      {ratings.map((rating) => (
        <button className="flex min-h-[58px] items-center justify-center gap-2 border-0 bg-transparent px-2 text-center text-[#46524e] hover:not-disabled:bg-mist hover:not-disabled:text-ink first:hover:not-disabled:text-[#9f3528] max-[720px]:border-b max-[720px]:border-line" key={rating.value} type="button" disabled={pending} onClick={() => onRate(rating.value)}>
          <kbd className="font-mono text-[9px] font-bold text-[#6d7873]">{rating.value}</kbd>
          <span className="flex min-w-0 flex-col"><b className="text-[10px]">{rating.label}</b><small className="text-[8px] leading-[1.35] text-muted">{rating.detail}</small></span>
        </button>
      ))}
    </div>
  )
}
