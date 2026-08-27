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
    <div className="grid grid-cols-4 gap-2" aria-label="Rate your recall">
      {reviewRatings.map((rating) => (
        <button
          className={`flex h-14 items-center justify-center rounded-2xl border-0 bg-paper/70 text-sm font-medium shadow-[0_2px_8px_rgb(43_58_66/0.08)] transition active:scale-[0.97] ${
            rating.value === 1 ? 'text-danger' : 'text-ink'
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
