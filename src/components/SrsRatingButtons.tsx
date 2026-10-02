import { Rating } from 'ts-fsrs'

const reviewRatings = [
  { value: Rating.Again, label: 'Again', description: 'Missed any part' },
  { value: Rating.Hard, label: 'Hard', description: 'Correct, with effort' },
  { value: Rating.Good, label: 'Good', description: 'Correct, slight pause' },
  { value: Rating.Easy, label: 'Easy', description: 'Immediate recall' },
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
