import { useEffect, useState } from 'react'
import { api } from '../lib/api'

function formatDate(iso) {
  if (!iso) return ''
  // Backend datetimes are naive; without a zone marker some browsers parse
  // them as UTC and shift the date by a day.
  const normalised = iso.includes('T') ? iso : `${iso}T00:00:00`
  const parsed = new Date(normalised)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Reads a full blog post. Manual posts have no external permalink, so without
 * this the "Ler post" affordance on those cards led nowhere.
 */
export default function BlogPostModal({ postId, onClose }) {
  const [post, setPost] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get(`/api/blog/${postId}`)
      .then((data) => {
        if (!cancelled) setPost(data)
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar este post.')
      })
    return () => {
      cancelled = true
    }
  }, [postId])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    // Stop the page behind the dialog from scrolling with it.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className="manage-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Post do blog"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="manage-card blog-modal">
        <button className="manage-close" type="button" onClick={onClose} aria-label="Fechar">
          ×
        </button>

        {error ? (
          <>
            <h2>Ops!</h2>
            <p>{error}</p>
          </>
        ) : !post ? (
          <p>Carregando...</p>
        ) : (
          <>
            {post.tag && <p className="eyebrow">{post.tag}</p>}
            <h2>{post.title}</h2>
            <p className="manage-detail">{formatDate(post.published_at)}</p>
            {post.image_url && (
              <img className="blog-modal__image" src={post.image_url} alt="" loading="lazy" />
            )}
            <div className="blog-modal__body">
              {post.body.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            {post.permalink && (
              <a
                className="card-link"
                href={post.permalink}
                target="_blank"
                rel="noreferrer noopener"
              >
                Ver no Instagram &rarr;
              </a>
            )}
          </>
        )}
      </div>
    </div>
  )
}
