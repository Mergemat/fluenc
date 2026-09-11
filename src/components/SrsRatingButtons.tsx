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
    <div className="rating-buttons" aria-label="Rate your recall">
      {reviewRatings.map((rating) => (
        <button
          className={`rating-button rating-${rating.value}`}
          key={rating.value}
          type="button"
          disabled={pending}
          onClick={() => onRate(rating.value)}
        >
          {rating.label}<span className="key-hint">{rating.value}</span>
        </button>
      ))}
    </div>
  )
}
