import { useEffect, useState } from 'react'

export function useReveal({ pending, onRate }: { pending: boolean; onRate: (rating: number) => void }) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !revealed) {
        event.preventDefault()
        setRevealed(true)
        return
      }
      const rating = Number(event.key)
      if (revealed && !pending && rating >= 1 && rating <= 4) onRate(rating)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onRate, pending, revealed])

  return { revealed, reveal: () => setRevealed(true) }
}
