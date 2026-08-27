type Rating = { value: number; label: string }

const reviewRatings: Rating[] = [
  { value: 1, label: 'Again' },
  { value: 2, label: 'Hard' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Easy' },
]

export function SrsRatingButtons({
  pending,
  onRate,
}: {
  pending: boolean
  onRate: (rating: number) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Rate your recall">
      {reviewRatings.map((rating) => (
        <button
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-line bg-paper text-xs font-semibold text-muted hover:not-disabled:border-ink hover:not-disabled:text-ink first:not-disabled:border-danger/40 first:not-disabled:text-danger first:not-disabled:hover:border-danger"
          key={rating.value}
          type="button"
          disabled={pending}
          onClick={() => onRate(rating.value)}
        >
          <kbd className="font-mono text-[10px] font-bold text-faint">{rating.value}</kbd>
          {rating.label}
        </button>
      ))}
    </div>
  )
}
