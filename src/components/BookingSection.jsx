import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_LABELS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatTime(t) {
  return t.slice(0, 5)
}

function icsStamp(iso, t) {
  return `${iso.replace(/-/g, '')}T${t.slice(0, 5).replace(':', '')}00`
}

function downloadIcs(booking, specialtyName) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mulher Viva//Agendamento//PT',
    'BEGIN:VEVENT',
    `UID:${booking.token || booking.id}@mulherviva`,
    `DTSTART:${icsStamp(booking.date, booking.start_time)}`,
    `DTEND:${icsStamp(booking.date, booking.end_time)}`,
    `SUMMARY:Consulta — ${specialtyName}`,
    `DESCRIPTION:${booking.type === 'online' ? 'Online (videoconferência)' : 'Presencial'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'consulta.ics'
  a.click()
  URL.revokeObjectURL(url)
}

export default function BookingSection() {
  const [specialties, setSpecialties] = useState([])
  const [specialtyId, setSpecialtyId] = useState(null)
  const [days, setDays] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', type: 'presencial', reason: '', isFirstVisit: false, notes: '' })
  const [waitlist, setWaitlist] = useState({ name: '', email: '', phone: '', sent: false, sending: false, error: null })
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const [error, setError] = useState(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    api
      .get('/api/specialties')
      .then(setSpecialties)
      .catch(() => setUnavailable(true))
  }, [])

  const loadSlots = (id) => {
    setSpecialtyId(id)
    setDays(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    setError(null)
    setLoadingSlots(true)
    const from = new Date()
    const to = new Date()
    to.setDate(to.getDate() + 13)
    api
      .get(
        `/api/slots?specialty_id=${id}&date_from=${toIsoDate(from)}&date_to=${toIsoDate(to)}`,
      )
      .then((data) => setDays(data.days))
      .catch(() => setError('Não foi possível carregar os horários. Tente novamente.'))
      .finally(() => setLoadingSlots(false))
  }

  const selectedDay = useMemo(
    () => days?.find((d) => d.date === selectedDate) || null,
    [days, selectedDate],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const booking = await api.post('/api/bookings', {
        specialty_id: specialtyId,
        date: selectedDate,
        start: selectedSlot.start,
        type: form.type,
        client_name: form.name,
        client_email: form.email.trim(),
        client_phone: form.phone.trim(),
        reason: form.reason.trim() || null,
        is_first_visit: form.isFirstVisit,
        notes: form.notes || null,
      })
      setConfirmation(booking)
    } catch (err) {
      if (err.status === 409) {
        loadSlots(specialtyId)
        setError('Esse horário acabou de ser reservado. Escolha outro, por favor.')
      } else {
        setError(err.detail || 'Não foi possível concluir o agendamento. Tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleWaitlist = async (event) => {
    event.preventDefault()
    setWaitlist((w) => ({ ...w, sending: true, error: null }))
    try {
      await api.post('/api/waitlist', {
        specialty_id: specialtyId,
        client_name: waitlist.name,
        client_email: waitlist.email.trim(),
        client_phone: waitlist.phone.trim() || null,
      })
      setWaitlist((w) => ({ ...w, sent: true, sending: false }))
    } catch {
      setWaitlist((w) => ({
        ...w,
        sending: false,
        error: 'Não foi possível entrar na lista de espera. Tente novamente.',
      }))
    }
  }

  if (unavailable) return null

  const specialty = specialties.find((s) => s.id === specialtyId)
  const noSlots = days && days.every((d) => d.slots.length === 0)

  return (
    <section className="section alt booking-section" id="agendamento">
      <div className="container">
        <div className="section-header" data-reveal>
          <p className="eyebrow">Agendamento online</p>
          <h2>Escolha o melhor horário para você.</h2>
          <p>
            Selecione a especialidade, o dia e o horário. A consulta fica
            aguardando confirmação da nossa equipe.
          </p>
        </div>

        {confirmation ? (
          <div className="booking-confirmation" data-reveal>
            <h3>Solicitação enviada!</h3>
            <p>
              {`Sua consulta de ${specialty?.name || ''} foi solicitada para `}
              <strong>
                {parseIsoDate(confirmation.date).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                {` às ${formatTime(confirmation.start_time)}`}
              </strong>
              . Enviamos um e-mail de confirmação e entraremos em contato em
              breve.
            </p>
            <div className="booking-confirmation__actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => downloadIcs(confirmation, specialty?.name || '')}
              >
                Adicionar ao calendário
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => {
                  setConfirmation(null)
                  setSpecialtyId(null)
                  setSelectedSlot(null)
                  setForm({ name: '', email: '', phone: '', type: 'presencial', reason: '', isFirstVisit: false, notes: '' })
                }}
              >
                Fazer novo agendamento
              </button>
            </div>
          </div>
        ) : (
          <div className="booking-flow" data-reveal>
            <div className="booking-step">
              <span className="booking-step__label">1. Especialidade</span>
              <div className="booking-chips">
                {specialties.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`booking-chip${specialtyId === s.id ? ' is-selected' : ''}`}
                    onClick={() => loadSlots(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {specialtyId && (
              <div className="booking-step">
                <span className="booking-step__label">2. Dia</span>
                {loadingSlots && <p className="booking-hint">Carregando horários...</p>}
                {days && (
                  <div className="booking-chips">
                    {days.map((d) => {
                      const date = parseIsoDate(d.date)
                      const hasSlots = d.slots.length > 0
                      return (
                        <button
                          key={d.date}
                          type="button"
                          disabled={!hasSlots}
                          className={`booking-chip booking-chip--day${selectedDate === d.date ? ' is-selected' : ''}`}
                          onClick={() => {
                            setSelectedDate(d.date)
                            setSelectedSlot(null)
                          }}
                        >
                          <span className="booking-chip__weekday">
                            {WEEKDAY_LABELS[date.getDay()]}
                          </span>
                          <span className="booking-chip__date">
                            {date.getDate()} {MONTH_LABELS[date.getMonth()]}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {noSlots && (
                  waitlist.sent ? (
                    <div className="booking-waitlist booking-waitlist--done">
                      <strong>Você está na lista de espera!</strong>
                      <p>Assim que um horário abrir, avisamos por e-mail.</p>
                    </div>
                  ) : (
                    <form className="booking-waitlist" onSubmit={handleWaitlist}>
                      <p className="booking-hint">
                        Sem horários nos próximos 14 dias. Entre na lista de
                        espera e avisamos por e-mail quando um horário abrir.
                      </p>
                      <div className="booking-form__grid">
                        <label className="field" htmlFor="wl-name">
                          <span>Nome</span>
                          <input id="wl-name" type="text" value={waitlist.name} required minLength={2}
                            onChange={(e) => setWaitlist((w) => ({ ...w, name: e.target.value }))} />
                        </label>
                        <label className="field" htmlFor="wl-email">
                          <span>E-mail</span>
                          <input id="wl-email" type="email" value={waitlist.email} required
                            onChange={(e) => setWaitlist((w) => ({ ...w, email: e.target.value }))} />
                        </label>
                        <label className="field" htmlFor="wl-phone">
                          <span>Telefone (opcional)</span>
                          <input id="wl-phone" type="tel" value={waitlist.phone}
                            onChange={(e) => setWaitlist((w) => ({ ...w, phone: e.target.value }))} />
                        </label>
                      </div>
                      <button className="btn btn-primary" type="submit" disabled={waitlist.sending}>
                        {waitlist.sending ? 'Enviando...' : 'Entrar na lista de espera'}
                      </button>
                      {waitlist.error && <p className="booking-error">{waitlist.error}</p>}
                    </form>
                  )
                )}
              </div>
            )}

            {selectedDay && (
              <div className="booking-step">
                <span className="booking-step__label">3. Horário</span>
                <div className="booking-chips">
                  {selectedDay.slots.map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      className={`booking-chip${selectedSlot?.start === slot.start ? ' is-selected' : ''}`}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {formatTime(slot.start)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedSlot && (
              <form className="booking-form" onSubmit={handleSubmit}>
                <span className="booking-step__label">4. Seus dados</span>
                <div className="booking-form__grid">
                  <label className="field" htmlFor="booking-name">
                    <span>Nome</span>
                    <input
                      id="booking-name"
                      type="text"
                      placeholder="Seu nome completo"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                      minLength={2}
                    />
                  </label>
                  <label className="field" htmlFor="booking-email">
                    <span>E-mail</span>
                    <input
                      id="booking-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="field" htmlFor="booking-phone">
                    <span>Telefone / WhatsApp</span>
                    <input
                      id="booking-phone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      required
                      minLength={8}
                    />
                  </label>
                  <label className="field" htmlFor="booking-type">
                    <span>Modalidade</span>
                    <select
                      id="booking-type"
                      value={form.type}
                      onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    >
                      <option value="presencial">Presencial</option>
                      <option value="online">Online</option>
                    </select>
                  </label>
                  <label className="field" htmlFor="booking-reason">
                    <span>Motivo da consulta (opcional)</span>
                    <input
                      id="booking-reason"
                      type="text"
                      placeholder="Ex.: rotina, acompanhamento, sintoma específico"
                      value={form.reason}
                      onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    />
                  </label>
                  <label className="field" htmlFor="booking-notes">
                    <span>Mensagem (opcional)</span>
                    <input
                      id="booking-notes"
                      type="text"
                      placeholder="Conte um pouco sobre o que você precisa"
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </label>
                  <label className="booking-checkbox span-2" htmlFor="booking-first">
                    <input
                      id="booking-first"
                      type="checkbox"
                      checked={form.isFirstVisit}
                      onChange={(e) => setForm((f) => ({ ...f, isFirstVisit: e.target.checked }))}
                    />
                    <span>É a minha primeira consulta</span>
                  </label>
                </div>
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Enviando...' : 'Solicitar agendamento'}
                </button>
              </form>
            )}

            {error && <p className="booking-error">{error}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
