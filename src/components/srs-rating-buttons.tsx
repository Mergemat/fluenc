import { useCallback } from "react";
import { Rating } from "ts-fsrs";

const reviewRatings = [
  { value: Rating.Again, label: "Again", description: "Missed any part" },
  { value: Rating.Hard, label: "Hard", description: "Correct, with effort" },
  { value: Rating.Good, label: "Good", description: "Correct, slight pause" },
  { value: Rating.Easy, label: "Easy", description: "Immediate recall" },
];

function RatingButton({
  rating,
  pending,
  onRate,
}: {
  rating: (typeof reviewRatings)[number];
  pending: boolean;
  onRate: (rating: number) => void;
}) {
  const rate = useCallback(() => onRate(rating.value), [onRate, rating.value]);
  return (
    <button
      className={`rating-button rating-${rating.value}`}
      disabled={pending}
      onClick={rate}
      type="button"
    >
      <span className="rating-label">
        {rating.label}
        <span aria-hidden="true" className="key-hint">
          {rating.value}
        </span>
      </span>
      <span className="rating-description">{rating.description}</span>
    </button>
  );
}

export function SrsRatingButtons({
  pending,
  onRate,
}: {
  pending: boolean;
  onRate: (rating: number) => void;
}) {
  return (
    <fieldset
      aria-label="Rate what you recalled before seeing the answer"
      className="rating-buttons dx-group"
    >
      {reviewRatings.map((rating) => (
        <RatingButton
          key={rating.value}
          onRate={onRate}
          pending={pending}
          rating={rating}
        />
      ))}
    </fieldset>
  );
}
