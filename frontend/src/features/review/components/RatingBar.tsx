import { RATING_HINTS } from '../types'

type Props = {
  labels: string[]
  busy: boolean
  onRate: (rating: number) => void
}

export function RatingBar({ labels, busy, onRate }: Props) {
  return (
    <div className="review-actions">
      {labels.map((label, index) => (
        <button
          key={`${label}-${index}`}
          type="button"
          className={`review-rate rate-${index + 1}`}
          disabled={busy}
          onClick={() => onRate(index + 1)}
          title={`${RATING_HINTS[index + 1]} · 下次 ${label}`}
          aria-label={`${RATING_HINTS[index + 1]}，下次 ${label}`}
        >
          <span className="rate-label">{label}</span>
          <span className="rate-hint">{RATING_HINTS[index + 1]}</span>
          <span className="rate-key">{index + 1}</span>
        </button>
      ))}
    </div>
  )
}
