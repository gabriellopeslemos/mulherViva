import { useState } from 'react'

// Renders the real image but swaps to the placeholder on load failure,
// so placeholders only ever show when the real file is actually missing.
function FallbackImage({ src, fallback, ...props }) {
  const [resolvedSrc, setResolvedSrc] = useState(src)

  return (
    <img
      {...props}
      src={resolvedSrc}
      onError={() => setResolvedSrc(fallback)}
    />
  )
}

export default FallbackImage
