import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { api, resolveMediaUrl } from '../lib/api'
import { ConfirmDialog, Modal } from './agenda/Sheets'
import '../styles/agenda.css'
import '../styles/admin.css'

const IconPin = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 4h6l-.6 6.2 2.6 2.8v2H7v-2l2.6-2.8L9 4z" />
    <path d="M12 15v6" />
  </svg>
)

const IconEdit = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 16 9.5-9.5a2.1 2.1 0 0 1 3 3L9 19l-4 1 1-4z" />
  </svg>
)

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 7h15M9.5 7V4.5h5V7M7 7l1 13h8l1-13M10.5 11v5M13.5 11v5" />
  </svg>
)

const IconMail = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="m4.5 7 7.5 6 7.5-6" />
  </svg>
)

const STATUS_LABELS = {
  draft: 'Rascunho',
  published: 'Publicado',
  archived: 'Arquivado',
}

function fmtPostDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function excerpt(body, limit = 160) {
  const text = body.split(/\s+/).join(' ').trim()
  return text.length <= limit ? text : `${text.slice(0, limit - 3)}...`
}

const markdownComponents = {
  a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
  img: ({ src, ...props }) => <img {...props} src={resolveMediaUrl(src)} loading="lazy" />,
}

function PostForm({ initial, onSubmit, onClose }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    tag: initial?.tag || '',
    body: initial?.body || '',
    image_url: initial?.image_url || '',
    pinned: initial?.pinned || false,
    status: initial?.status || 'draft',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingInline, setUploadingInline] = useState(false)
  const [mode, setMode] = useState('edit')
  const textareaRef = useRef(null)
  const coverFileRef = useRef(null)
  const inlineFileRef = useRef(null)

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
  }

  const wrapSelection = (before, after = before) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, selectionEnd, value } = textarea
    const selected = value.slice(selectionStart, selectionEnd)
    const next =
      value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd)
    setForm((f) => ({ ...f, body: next }))
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(
        selectionStart + before.length,
        selectionStart + before.length + selected.length,
      )
    })
  }

  const insertAtCursor = (text) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, selectionEnd, value } = textarea
    const next = value.slice(0, selectionStart) + text + value.slice(selectionEnd)
    setForm((f) => ({ ...f, body: next }))
    requestAnimationFrame(() => {
      textarea.focus()
      const pos = selectionStart + text.length
      textarea.setSelectionRange(pos, pos)
    })
  }

  const applyLink = () => {
    const url = window.prompt('URL do link:')
    if (!url) return
    const textarea = textareaRef.current
    const selected = textarea
      ? textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)
      : ''
    if (selected) {
      wrapSelection('[', `](${url})`)
    } else {
      insertAtCursor(`[texto](${url})`)
    }
  }

  const uploadFile = async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const result = await api.upload('/api/admin/uploads', fd, { auth: true })
    return result.url
  }

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingCover(true)
    try {
      const url = await uploadFile(file)
      setForm((f) => ({ ...f, image_url: url }))
    } catch (err) {
      setError(err.detail || 'Não foi possível enviar a imagem.')
    } finally {
      setUploadingCover(false)
    }
  }

  const handleInlineUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingInline(true)
    try {
      const url = await uploadFile(file)
      insertAtCursor(`![](${url})`)
    } catch (err) {
      setError(err.detail || 'Não foi possível enviar a imagem.')
    } finally {
      setUploadingInline(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await onSubmit({
        title: form.title.trim(),
        tag: form.tag.trim() || null,
        body: form.body.trim(),
        image_url: form.image_url.trim() || null,
        pinned: form.pinned,
        status: form.status,
      })
    } catch (err) {
      setError(err.detail || 'Não foi possível salvar a publicação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={initial ? 'Editar publicação' : 'Nova publicação'} onClose={onClose} wide>
      <form className="ag-form" onSubmit={submit}>
        <label className="ag-field">
          <span>Título</span>
          <input
            type="text"
            value={form.title}
            onChange={set('title')}
            required
            maxLength={200}
            placeholder="Título da publicação"
            autoFocus
          />
        </label>
        <div className="ag-field-row">
          <label className="ag-field">
            <span>
              Tag <em>(opcional)</em>
            </span>
            <input
              type="text"
              value={form.tag}
              onChange={set('tag')}
              maxLength={60}
              placeholder="Ex.: Saúde hormonal, Menopausa, Bem-estar"
            />
          </label>
          <label className="ag-field">
            <span>Status</span>
            <select value={form.status} onChange={set('status')}>
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
        </div>

        <div className="ag-field">
          <span>Texto</span>
          <div className="bp-editor-tabs">
            <button
              type="button"
              className={`bp-editor-tab${mode === 'edit' ? ' is-active' : ''}`}
              onClick={() => setMode('edit')}
            >
              Editar
            </button>
            <button
              type="button"
              className={`bp-editor-tab${mode === 'preview' ? ' is-active' : ''}`}
              onClick={() => setMode('preview')}
            >
              Pré-visualizar
            </button>
          </div>

          {mode === 'edit' ? (
            <>
              <div className="bp-toolbar">
                <button type="button" onClick={() => wrapSelection('**')} title="Negrito">
                  <strong>B</strong>
                </button>
                <button type="button" onClick={() => wrapSelection('_')} title="Itálico">
                  <em>I</em>
                </button>
                <button type="button" onClick={applyLink} title="Link">
                  Link
                </button>
                <button
                  type="button"
                  onClick={() => inlineFileRef.current?.click()}
                  disabled={uploadingInline}
                  title="Inserir imagem"
                >
                  {uploadingInline ? 'Enviando…' : 'Imagem'}
                </button>
                <input
                  ref={inlineFileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleInlineUpload}
                />
              </div>
              <textarea
                ref={textareaRef}
                value={form.body}
                onChange={set('body')}
                required
                rows={10}
                placeholder="Escreva o conteúdo da publicação em Markdown"
              />
            </>
          ) : (
            <div className="bp-preview post-body">
              <ReactMarkdown components={markdownComponents}>
                {form.body || '*Nada para pré-visualizar ainda.*'}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <label className="ag-field">
          <span>
            Imagem de capa <em>(opcional)</em>
          </span>
          <div className="bp-cover-row">
            <input
              type="url"
              value={form.image_url}
              onChange={set('image_url')}
              placeholder="https://..."
            />
            <button
              type="button"
              className="ag-btn ag-btn--ghost ag-btn--sm"
              onClick={() => coverFileRef.current?.click()}
              disabled={uploadingCover}
            >
              {uploadingCover ? 'Enviando…' : 'Enviar imagem'}
            </button>
            <input
              ref={coverFileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleCoverUpload}
            />
          </div>
          {form.image_url && (
            <img className="bp-cover-preview" src={resolveMediaUrl(form.image_url)} alt="" />
          )}
        </label>

        <label className="bp-form-check">
          <input type="checkbox" checked={form.pinned} onChange={set('pinned')} />
          <span>
            Fixar na página inicial
            <small>Publicações fixadas aparecem primeiro; as demais seguem da mais recente para a mais antiga.</small>
          </span>
        </label>
        {error && <p className="ag-form__error">{error}</p>}
        <div className="ag-modal__actions">
          <button type="button" className="ag-btn ag-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="ag-btn ag-btn--primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function parseRecipients(text) {
  return [...new Set(
    text
      .split(/[,;\n]/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )]
}

function SendEmailModal({ post, onSend, onClose }) {
  const [recipientsText, setRecipientsText] = useState('')
  const [subject, setSubject] = useState(post.title)
  const [loadingSuggestions, setLoadingSuggestions] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/api/admin/blog/recipients', { auth: true })
      .then((emails) => {
        if (!cancelled) setRecipientsText(emails.join('\n'))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingSuggestions(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const recipients = parseRecipients(recipientsText)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      const res = await onSend({ recipients, subject: subject.trim() || undefined })
      setResult(res)
    } catch (err) {
      setError(err.detail || 'Não foi possível enviar o e-mail.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title="Enviar por e-mail" subtitle={post.title} onClose={onClose} wide>
      {result ? (
        <div className="ag-form">
          <p>
            E-mail enviado para <strong>{result.sent}</strong> destinatário(s).
          </p>
          {result.failed.length > 0 && (
            <p className="ag-form__error">
              Falha ao enviar para: {result.failed.join(', ')}
            </p>
          )}
          <div className="ag-modal__actions">
            <button type="button" className="ag-btn ag-btn--primary" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      ) : (
        <form className="ag-form" onSubmit={submit}>
          <label className="ag-field">
            <span>Assunto</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              placeholder={post.title}
            />
          </label>
          <label className="ag-field">
            <span>
              Destinatários <em>(um por linha, ou separados por vírgula)</em>
            </span>
            <textarea
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              rows={8}
              required
              placeholder={
                loadingSuggestions
                  ? 'Carregando sugestões de pacientes…'
                  : 'nome@exemplo.com'
              }
            />
            <small>{recipients.length} destinatário(s)</small>
          </label>
          {error && <p className="ag-form__error">{error}</p>}
          <div className="ag-modal__actions">
            <button type="button" className="ag-btn ag-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="ag-btn ag-btn--primary"
              disabled={sending || recipients.length === 0}
            >
              {sending ? 'Enviando…' : `Enviar para ${recipients.length}`}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

export default function BlogPanel({ onClose, onAuthExpired, onChanged }) {
  const [posts, setPosts] = useState(null)
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const showToast = useCallback((message, kind = 'ok') => {
    setToast({ message, kind })
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  const guard = useCallback(
    (err) => {
      if (err?.status === 401) {
        onAuthExpired()
        return true
      }
      return false
    },
    [onAuthExpired],
  )

  const load = useCallback(() => {
    api
      .get('/api/admin/blog', { auth: true })
      .then((data) => {
        setPosts(data)
        setLoadError(null)
      })
      .catch((err) => {
        if (!guard(err)) setLoadError('Não foi possível carregar as publicações.')
      })
  }, [guard])

  useEffect(() => {
    load()
  }, [load])

  const sortPosts = (list) =>
    [...list].sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.published_at) - new Date(a.published_at),
    )

  const submitPost = async (payload, existingId) => {
    try {
      if (existingId) {
        const updated = await api.patch(`/api/admin/blog/${existingId}`, payload, { auth: true })
        setPosts((list) => sortPosts(list.map((p) => (p.id === existingId ? updated : p))))
        showToast('Publicação atualizada.')
      } else {
        const created = await api.post('/api/admin/blog', payload, { auth: true })
        setPosts((list) => sortPosts([created, ...list]))
        showToast('Publicação criada.')
      }
      setModal(null)
      onChanged?.()
    } catch (err) {
      if (guard(err)) return
      throw err
    }
  }

  const togglePin = async (post) => {
    try {
      const updated = await api.patch(
        `/api/admin/blog/${post.id}`,
        { pinned: !post.pinned },
        { auth: true },
      )
      setPosts((list) => sortPosts(list.map((p) => (p.id === post.id ? updated : p))))
      showToast(updated.pinned ? 'Publicação fixada na página inicial.' : 'Publicação desafixada.')
      onChanged?.()
    } catch (err) {
      if (!guard(err)) showToast(err.detail || 'Não foi possível atualizar.', 'error')
    }
  }

  const changeStatus = async (post, status) => {
    try {
      const updated = await api.patch(`/api/admin/blog/${post.id}`, { status }, { auth: true })
      setPosts((list) => sortPosts(list.map((p) => (p.id === post.id ? updated : p))))
      showToast(
        status === 'published' ? 'Publicação publicada.' : 'Publicação arquivada.',
      )
      onChanged?.()
    } catch (err) {
      if (!guard(err)) showToast(err.detail || 'Não foi possível atualizar.', 'error')
    }
  }

  const sendMarketingEmail = async (post, payload) => {
    try {
      return await api.post(`/api/admin/blog/${post.id}/send-email`, payload, { auth: true })
    } catch (err) {
      if (guard(err)) return { sent: 0, failed: [] }
      throw err
    }
  }

  const deletePost = async (post) => {
    setBusy(true)
    try {
      await api.delete(`/api/admin/blog/${post.id}`, { auth: true })
      setPosts((list) => list.filter((p) => p.id !== post.id))
      setModal(null)
      showToast('Publicação excluída.')
      onChanged?.()
    } catch (err) {
      if (!guard(err)) showToast(err.detail || 'Não foi possível excluir.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bp-root" role="dialog" aria-modal="true" aria-label="Publicações do blog">
      <header className="ag-topbar">
        <div className="ag-topbar__left">
          <button type="button" className="ag-iconbtn" onClick={onClose} aria-label="Voltar ao painel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m14.5 6-6 6 6 6" />
            </svg>
          </button>
          <div className="ag-topbar__title">
            <h2>Blog</h2>
            <span>{posts ? `${posts.length} publicação(ões)` : 'Carregando…'}</span>
          </div>
        </div>
        <div className="ag-topbar__right">
          <button
            type="button"
            className="ag-btn ag-btn--primary ag-btn--sm"
            onClick={() => setModal({ type: 'form' })}
          >
            + Nova publicação
          </button>
        </div>
      </header>

      <div className="bp-content">
        {loadError ? (
          <div className="bp-empty">
            <p>{loadError}</p>
            <button type="button" className="ag-btn ag-btn--primary" onClick={load}>
              Tentar novamente
            </button>
          </div>
        ) : posts && posts.length === 0 ? (
          <div className="bp-empty">
            <p>Nenhuma publicação ainda. Crie a primeira para aparecer na página inicial.</p>
            <button
              type="button"
              className="ag-btn ag-btn--primary"
              onClick={() => setModal({ type: 'form' })}
            >
              + Nova publicação
            </button>
          </div>
        ) : (
          <div className="bp-grid">
            {(posts || []).map((post) => (
              <article key={post.id} className={`bp-card${post.pinned ? ' is-pinned' : ''}`}>
                <div className="bp-card__meta">
                  {post.pinned && (
                    <span className="bp-badge bp-badge--pin">
                      <IconPin /> Fixado
                    </span>
                  )}
                  <span className={`bp-badge bp-badge--${post.status}`}>
                    {STATUS_LABELS[post.status] || post.status}
                  </span>
                  {post.tag && <span className="bp-badge">{post.tag}</span>}
                  {post.source === 'instagram' && (
                    <span className="bp-badge bp-badge--source">Instagram</span>
                  )}
                  <span className="bp-card__date">{fmtPostDate(post.published_at)}</span>
                </div>
                <h3>{post.title}</h3>
                <p className="bp-card__excerpt">{excerpt(post.body)}</p>
                <div className="bp-card__actions">
                  {post.status === 'published' ? (
                    <button
                      type="button"
                      className="ag-btn ag-btn--ghost ag-btn--sm"
                      onClick={() => changeStatus(post, 'archived')}
                    >
                      Arquivar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ag-btn ag-btn--ghost ag-btn--sm"
                      onClick={() => changeStatus(post, 'published')}
                    >
                      Publicar
                    </button>
                  )}
                  <button
                    type="button"
                    className={`ag-iconbtn${post.pinned ? ' is-active' : ''}`}
                    onClick={() => togglePin(post)}
                    aria-label={post.pinned ? 'Desafixar da página inicial' : 'Fixar na página inicial'}
                    title={post.pinned ? 'Desafixar da página inicial' : 'Fixar na página inicial'}
                  >
                    <IconPin />
                  </button>
                  {post.status === 'published' && (
                    <button
                      type="button"
                      className="ag-iconbtn"
                      onClick={() => setModal({ type: 'send-email', post })}
                      aria-label="Enviar por e-mail"
                      title="Enviar por e-mail"
                    >
                      <IconMail />
                    </button>
                  )}
                  <button
                    type="button"
                    className="ag-iconbtn"
                    onClick={() => setModal({ type: 'form', post })}
                    aria-label="Editar publicação"
                    title="Editar publicação"
                  >
                    <IconEdit />
                  </button>
                  <button
                    type="button"
                    className="ag-iconbtn ag-iconbtn--danger"
                    onClick={() => setModal({ type: 'confirm-delete', post })}
                    aria-label="Excluir publicação"
                    title="Excluir publicação"
                  >
                    <IconTrash />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {modal?.type === 'form' && (
        <PostForm
          initial={modal.post}
          onSubmit={(payload) => submitPost(payload, modal.post?.id)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'send-email' && (
        <SendEmailModal
          post={modal.post}
          onSend={(payload) => sendMarketingEmail(modal.post, payload)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'confirm-delete' && (
        <ConfirmDialog
          title="Excluir publicação"
          message={`Excluir definitivamente "${modal.post.title}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          danger
          busy={busy}
          onConfirm={() => deletePost(modal.post)}
          onCancel={() => setModal(null)}
        />
      )}

      {toast && (
        <div className={`ag-toast ag-toast--${toast.kind}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </div>
  )
}
