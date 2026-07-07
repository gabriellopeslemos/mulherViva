import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FloatingNavbar from '../components/FloatingNavbar'
import { api, resolveMediaUrl } from '../lib/api'

const PAGE_SIZE = 9

function formatPostDate(isoDate) {
  const formatted = new Date(isoDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function fetchPage(offset) {
  return api.get(`/api/blog?limit=${PAGE_SIZE}&offset=${offset}`)
}

export default function BlogPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    window.scrollTo(0, 0)
    fetchPage(0)
      .then((data) => {
        setItems(data.items)
        setTotal(data.total)
        setError(null)
      })
      .catch(() => setError('Não foi possível carregar as publicações.'))
      .finally(() => setLoading(false))
  }, [retryTick])

  const loadMore = () => {
    setLoading(true)
    fetchPage(items.length)
      .then((data) => {
        setItems((prev) => [...prev, ...data.items])
        setTotal(data.total)
      })
      .catch(() => setError('Não foi possível carregar as publicações.'))
      .finally(() => setLoading(false))
  }

  return (
    <div className="page blog-page">
      <FloatingNavbar onOpenAgenda={() => navigate('/')} />
      <main>
        <section className="section" style={{ paddingTop: 'clamp(120px, 14vw, 160px)' }}>
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Blog</p>
              <h1>Conteúdo para apoiar a sua jornada.</h1>
              <p>
                Artigos, reflexões e orientações clínicas escritas com calma —
                para você ler no seu tempo.
              </p>
            </div>

            {error ? (
              <div className="blog-page__empty">
                <p>{error}</p>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setRetryTick((t) => t + 1)}
                >
                  Tentar novamente
                </button>
              </div>
            ) : items.length === 0 && !loading ? (
              <div className="blog-page__empty">
                <p>Nenhuma publicação disponível no momento.</p>
              </div>
            ) : (
              <>
                <div className="card-grid blog-grid">
                  {items.map((post, index) => (
                    <Link
                      key={post.id}
                      to={`/blog/${post.id}`}
                      className="blog-card"
                      data-reveal
                      style={{ '--delay': `${(index % PAGE_SIZE) * 60}ms` }}
                    >
                      {post.image_url && (
                        <div className="blog-card__thumb">
                          <img
                            src={resolveMediaUrl(post.image_url)}
                            alt={post.title}
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="blog-meta">
                        {post.pinned && <span className="blog-pin">Fixado</span>}
                        <span className="blog-tag">{post.tag || 'Blog'}</span>
                        <span className="blog-date">{formatPostDate(post.published_at)}</span>
                      </div>
                      <h3>{post.title}</h3>
                      <p>{post.excerpt}</p>
                      <span className="card-link">Ler post &rarr;</span>
                    </Link>
                  ))}
                </div>

                {total !== null && items.length < total && (
                  <div className="blog-page__more">
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={loading}
                      onClick={loadMore}
                    >
                      {loading ? 'Carregando…' : 'Carregar mais'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
