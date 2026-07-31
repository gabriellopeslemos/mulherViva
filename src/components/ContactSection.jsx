import { useState } from 'react'
import { api } from '../lib/api'
import { clinic, fullAddress, specialtyOptions, whatsappUrl } from '../lib/siteConfig'

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  subject: specialtyOptions[0],
  preferredDate: '',
  message: '',
}

function IconWhatsapp() {
  return (
    <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
      <path
        d="M12 3.5a8.5 8.5 0 0 1 7.3 12.9L20 20l-3.8-1.3A8.5 8.5 0 1 1 12 3.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="3" fill="currentColor" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
      <path
        d="M6.4 5.6c.3-.4.8-.6 1.3-.4l3 1.2c.4.2.7.6.7 1.1v2c0 .4-.2.8-.6 1l-1.5.9c.8 1.6 2.1 2.9 3.7 3.7l.9-1.5c.2-.4.6-.6 1-.6h2c.5 0 .9.3 1.1.7l1.2 3c.2.5 0 1-.4 1.3-.9.7-2 1.1-3.2 1-2.8-.3-5.4-1.8-7.6-4-2.2-2.2-3.7-4.8-4-7.6-.1-1.2.3-2.3 1-3.2z"
        fill="currentColor"
      />
    </svg>
  )
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4 7l8 6 8-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The clinic's general contact form.
 *
 * Distinct from the booking flow in #agendamento: this is for questions that
 * do not map onto a bookable slot. It previously had no submit handler at all,
 * so the browser performed a native GET and reloaded the page with the
 * visitor's name and e-mail exposed in the URL — the message was never sent
 * anywhere.
 */
export default function ContactSection() {
  const [form, setForm] = useState(EMPTY)
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState(null)

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus('sending')
    setError(null)
    try {
      await api.post('/api/contact', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        subject: form.subject || null,
        preferred_date: form.preferredDate || null,
        message: form.message.trim(),
      })
      setStatus('sent')
      setForm(EMPTY)
    } catch (err) {
      setStatus('error')
      setError(
        err?.detail ||
          'Não foi possível enviar sua mensagem. Tente novamente ou fale conosco pelo WhatsApp.',
      )
    }
  }

  const sending = status === 'sending'

  return (
    <section className="section appointment-section" id="contato">
      <div className="container">
        <div className="appointment-card" data-reveal>
          <aside className="appointment-aside">
            <p className="appointment-label">Contato</p>
            <h2>Vamos conversar?</h2>
            <p className="appointment-copy">
              Ficou com alguma dúvida? Envie uma mensagem e nossa equipe
              responde em breve. Para marcar direto, use o{' '}
              <a className="appointment-inline-link" href="#agendamento">
                agendamento online
              </a>
              .
            </p>
            <div className="appointment-divider" aria-hidden="true" />
            <div className="appointment-contacts">
              <a
                className="appointment-contact"
                href={whatsappUrl()}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span className="appointment-icon">
                  <IconWhatsapp />
                </span>
                <div>
                  <strong>{clinic.whatsappDisplay}</strong>
                  <span>WhatsApp · {clinic.hours}</span>
                </div>
              </a>
              <a className="appointment-contact" href={`tel:${clinic.phoneE164}`}>
                <span className="appointment-icon">
                  <IconPhone />
                </span>
                <div>
                  <strong>{clinic.phoneDisplay}</strong>
                  <span>{fullAddress}</span>
                </div>
              </a>
              <a className="appointment-contact" href={`mailto:${clinic.email}`}>
                <span className="appointment-icon">
                  <IconMail />
                </span>
                <div>
                  <strong>{clinic.email}</strong>
                  <span>{clinic.responseTime}</span>
                </div>
              </a>
            </div>
          </aside>

          {status === 'sent' ? (
            <div className="appointment-form appointment-success" role="status">
              <h3>Mensagem enviada!</h3>
              <p>
                Obrigada por escrever. Nossa equipe responde em até 24h no
                e-mail informado.
              </p>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setStatus('idle')}
              >
                Enviar outra mensagem
              </button>
            </div>
          ) : (
            <form className="appointment-form" onSubmit={handleSubmit} noValidate={false}>
              <div className="appointment-grid">
                <label className="field" htmlFor="contato-nome">
                  <span>Nome</span>
                  <input
                    id="contato-nome"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Seu nome"
                    value={form.name}
                    onChange={update('name')}
                    required
                    minLength={2}
                    maxLength={150}
                  />
                </label>
                <label className="field" htmlFor="contato-telefone">
                  <span>Telefone</span>
                  <input
                    id="contato-telefone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="(00) 00000-0000"
                    value={form.phone}
                    onChange={update('phone')}
                    maxLength={40}
                  />
                </label>
                <label className="field span-2" htmlFor="contato-email">
                  <span>E-mail</span>
                  <input
                    id="contato-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="seu@email.com"
                    value={form.email}
                    onChange={update('email')}
                    required
                    maxLength={150}
                  />
                </label>
                <label className="field" htmlFor="contato-data">
                  <span>Data preferida (opcional)</span>
                  <input
                    id="contato-data"
                    name="preferredDate"
                    type="date"
                    value={form.preferredDate}
                    onChange={update('preferredDate')}
                  />
                </label>
                <label className="field" htmlFor="contato-assunto">
                  <span>Assunto</span>
                  <select
                    id="contato-assunto"
                    name="subject"
                    value={form.subject}
                    onChange={update('subject')}
                  >
                    {specialtyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field span-2" htmlFor="contato-mensagem">
                  <span>Mensagem</span>
                  <textarea
                    id="contato-mensagem"
                    name="message"
                    placeholder="Conte um pouco sobre o que você precisa"
                    value={form.message}
                    onChange={update('message')}
                    required
                    minLength={5}
                    maxLength={2000}
                    rows={4}
                  />
                </label>
              </div>
              {error && (
                <p className="booking-error" role="alert">
                  {error}
                </p>
              )}
              <div className="appointment-actions">
                <button className="appointment-submit" type="submit" disabled={sending}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 12l16-8-6 16-2.5-6.5L4 12z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {sending ? 'Enviando...' : 'Enviar mensagem'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
