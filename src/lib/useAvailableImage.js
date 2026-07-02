import { useEffect, useState } from 'react'

// Optimistically resolves to the real image; swaps to the placeholder only
// if the real file actually fails to load (e.g. images/ is gitignored and
// absent in this checkout).
export function useAvailableImage(src, fallback) {
  const [resolved, setResolved] = useState(src)
  const [lastSrc, setLastSrc] = useState(src)

  if (lastSrc !== src) {
    setLastSrc(src)
    setResolved(src)
  }

  useEffect(() => {
    if (!src) return undefined
    const img = new Image()
    img.onerror = () => setResolved(fallback)
    img.src = src
    return () => {
      img.onerror = null
    }
  }, [src, fallback])

  return resolved
}
