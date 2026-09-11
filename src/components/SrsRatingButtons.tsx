type Rating = { value: number; label: string }

const reviewRatings: Rating[] = [
  { value: 1, label: 'Missed something' },
  { value: 2, label: 'With effort' },
  { value: 3, label: 'After a pause' },
  { value: 4, label: 'Instantly' },
]

export function SrsRatingButtons({
  pending,
  onRate,
}: {
  pending: boolean
  onRate: (rating: number) => void
}) {
  return (
    <div className="rating-buttons" role="group" aria-label="Rate what you recalled before seeing the answer">
      {reviewRatings.map((rating) => (
        <button
          className={`rating-button rating-${rating.value}`}
          key={rating.value}
          type="button"
          disabled={pending}
          onClick={() => onRate(rating.value)}
        >
          <span className="rating-label">{rating.label}<span className="key-hint" aria-hidden="true">{rating.value}</span></span>
        </button>
      ))}
    </div>
  )
}
