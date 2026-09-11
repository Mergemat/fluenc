type Rating = { value: number; label: string; description: string }

const reviewRatings: Rating[] = [
  { value: 1, label: 'Missed something', description: 'Forgot or got part wrong' },
  { value: 2, label: 'With effort', description: 'Correct, but took a long time' },
  { value: 3, label: 'After a pause', description: 'Correct, after a little thought' },
  { value: 4, label: 'Instantly', description: 'Correct, without hesitation' },
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
          <span className="rating-description">{rating.description}</span>
        </button>
      ))}
    </div>
  )
}
