import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../lib/api'
import { RETENTION_NOTICE } from '../lib/privacy'

/**
 * "Quero reagendar": the patient types the e-mail used at booking and we
 * re-send the personal manage link(s) of their upcoming appointments.
 * The API always answers the same message, so we never reveal whether the
 * address is known.
 *
 * Rendered by BookingSection as a panel inside the booking card (the card
 * morphs into this form), so it takes the step's motion props and an
 * `onBack` that morphs it back into the calendar.
 */
export default function RecoverBooking({ onBack, backIcon, className = '', ...motionProps }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  // Focus the e-mail field on mount without the browser's scroll-into-view,
  // which would cut BookingSection's smooth scroll to the card short.
  const focusOnMount = useCallback((node) => node?.focus({ preventScroll: true }), [])

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

  return (
    <motion.form className={`bk-step bk-form ${className}`} onSubmit={handleSubmit} {...motionProps}>
      <div className="bk-form__head">
        <h3 className="bk-step__title">Reagendar ou cancelar uma consulta</h3>
        <p className="bk-step__lead">
          Informe o e-mail usado no agendamento. Enviamos o link pessoal da sua consulta, por onde
          você reagenda ou cancela sem precisar ligar.
        </p>
      </div>
      {message ? (
        <p className="bk-morph__done" role="status">
          {message}
        </p>
      ) : (
        <div className="bk-form__grid">
          <label className="bk-field bk-field--full" htmlFor="rc-email">
            <span>E-mail</span>
            <input
              id="rc-email"
              ref={focusOnMount}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
        </div>
      )}
      {!message && <p className="bk-privacy">{RETENTION_NOTICE}</p>}
      {error && (
        <p className="bk-error" role="alert">
          {error}
        </p>
      )}
      <div className="bk-form__actions">
        <button type="button" className="bk-btn bk-btn--ghost" onClick={onBack}>
          {backIcon}
          Voltar ao agendamento
        </button>
        {!message && (
          <button type="submit" className="bk-btn bk-btn--primary" disabled={submitting}>
            {submitting ? 'Enviando…' : 'Enviar link'}
          </button>
        )}
      </div>
    </motion.form>
  )
}
