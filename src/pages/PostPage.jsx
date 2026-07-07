import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import FloatingNavbar from '../components/FloatingNavbar'
import { api, resolveMediaUrl } from '../lib/api'

function formatPostDate(isoDate) {
  const formatted = new Date(isoDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

const markdownComponents = {
  a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
  img: ({ src, ...props }) => <img {...props} src={resolveMediaUrl(src)} loading="lazy" />,
}

export default function PostPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    api
      .get(`/api/blog/${id}`)
      .then(setPost)
      .catch(() => setNotFound(true))
  }, [id])

  return (
    <div className="page post-page">
      <FloatingNavbar onOpenAgenda={() => navigate('/')} />
      <main>
        <section className="section" style={{ paddingTop: 'clamp(120px, 14vw, 160px)' }}>
          <div className="container post-body-container">
            {notFound ? (
              <div className="blog-page__empty">
                <p>Publicação não encontrada.</p>
                <Link className="btn btn-outline" to="/blog">
                  Voltar ao blog
                </Link>
              </div>
            ) : !post ? (
              <p>Carregando…</p>
            ) : (
              <article>
                {post.image_url && (
                  <div className="post-cover">
                    <img src={resolveMediaUrl(post.image_url)} alt={post.title} />
                  </div>
                )}
                <div className="blog-meta">
                  <span className="blog-tag">{post.tag || 'Blog'}</span>
                  <span className="blog-date">{formatPostDate(post.published_at)}</span>
                </div>
                <h1>{post.title}</h1>
                <div className="post-body">
                  <ReactMarkdown components={markdownComponents}>{post.body}</ReactMarkdown>
                </div>
                {post.source === 'instagram' && post.permalink && (
                  <a
                    className="card-link"
                    href={post.permalink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver no Instagram &rarr;
                  </a>
                )}
                <p>
                  <Link className="card-link" to="/blog">
                    &larr; Voltar ao blog
                  </Link>
                </p>
              </article>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
