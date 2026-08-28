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
          className={`flex h-13 items-center justify-center rounded-xl border bg-paper text-sm font-bold transition hover:border-ink ${
            rating.value === 1 ? 'border-danger/30 text-danger' : 'border-line text-ink'
          }`}
          key={rating.value}
          type="button"
          disabled={pending}
          onClick={() => onRate(rating.value)}
        >
          {rating.label}
        </button>
      ))}
    </div>
  )
}
