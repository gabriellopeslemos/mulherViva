import { useState } from 'react'
import { api } from '../lib/api'
import { RETENTION_NOTICE } from '../lib/privacy'

/**
 * "Quero reagendar": the patient types the e-mail used at booking and we
 * re-send the personal manage link(s) of their upcoming appointments.
 * The API always answers the same message, so we never reveal whether the
 * address is known.
 */
export default function RecoverBooking() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await api.post('/api/bookings/recover', { email: email.trim() })
      setMessage(res.message)
    } catch (err) {
      setError(err.detail || 'Não foi possível enviar agora. Tente novamente em instantes.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <div className="bk-recover">
        <button type="button" className="bk-recover__toggle" onClick={() => setOpen(true)}>
          Já tem consulta marcada? <strong>Quero reagendar</strong>
        </button>
      </div>
    )
  }

  return (
    <div className="bk-recover bk-recover--open">
      {message ? (
        <p className="bk-recover__done" role="status">
          {message}
        </p>
      ) : (
        <form className="bk-recover__form" onSubmit={handleSubmit}>
          <p className="bk-recover__title">Reagendar ou cancelar uma consulta</p>
          <p className="bk-recover__lead">
            Informe o e-mail usado no agendamento. Enviamos o link pessoal da sua consulta, por onde
            você reagenda ou cancela sem precisar ligar.
          </p>
          <div className="bk-recover__row">
            <label className="bk-field bk-field--full" htmlFor="rc-email">
              <span>E-mail</span>
              <input
                id="rc-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="bk-btn bk-btn--primary" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Enviar link'}
            </button>
          </div>
          <p className="bk-privacy">{RETENTION_NOTICE}</p>
          {error && (
            <p className="bk-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
      <button type="button" className="bk-recover__close" onClick={() => setOpen(false)}>
        Fechar
      </button>
    </div>
  )
}
