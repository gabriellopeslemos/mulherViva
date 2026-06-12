import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { api } from '../lib/api'
import '../styles/booking.css'

const WEEKDAY_HEAD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const MONTHS_SHORT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]
const WEEKDAYS_LONG = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado',
]
const MAX_MONTHS_AHEAD = 2

function toIso(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function monthPartOf(iso) {
  const d = parseIso(iso)
  return `${d.getFullYear()}-${d.getMonth()}`
}

function fmtTime(t) {
  return t.slice(0, 5)
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function periodOf(start) {
  const h = Number(start.slice(0, 2))
  if (h < 12) return 'Manhã'
  if (h < 18) return 'Tarde'
  return 'Noite'
}

const PERIOD_ORDER = ['Manhã', 'Tarde', 'Noite']

const MODALITY_LABELS = { presencial: 'Presencial', online: 'Online' }

const MODALITY_ICONS = {
  presencial: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5" />
    </svg>
  ),
  online: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="12" rx="1.5" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
}

const PERIOD_ICONS = {
  Manhã: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3v2M4.2 6.2l1.4 1.4M3 13h2M19 13h2M18.4 6.2 17 7.6M6 17a6 6 0 0 1 12 0" />
      <path d="M3 21h18" />
    </svg>
  ),
  Tarde: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" />
    </svg>
  ),
  Noite: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  ),
}

function buildMonthMatrix(cursor) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  const weeks = []
  const probe = new Date(start)
  while (probe <= new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0) || weeks.length === 0) {
    const week = []
    for (let i = 0; i < 7; i += 1) {
      week.push(new Date(probe))
      probe.setDate(probe.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12.5 10 18 19.5 7" />
    </svg>
  )
}

function CalendarGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  )
}

export default function BookingSection() {
  const reducedMotion = useReducedMotion()
  const [specialties, setSpecialties] = useState([])
  const [unavailable, setUnavailable] = useState(false)
  const [specialtyId, setSpecialtyId] = useState(null)
  const [cursor, setCursor] = useState(() => {
    const t = startOfToday()
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })
  const [monthCache, setMonthCache] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', contact: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get('/api/specialties')
      .then(setSpecialties)
      .catch(() => setUnavailable(true))
  }, [])

  const specialty = specialties.find((s) => s.id === specialtyId) || null
  const monthPart = `${cursor.getFullYear()}-${cursor.getMonth()}`

  // The calendar is specialty-agnostic: a day is bookable when ANY specialty
  // has an open slot. So we load every specialty's month and merge for the
  // calendar, then narrow to the chosen specialty once the patient picks one.
  useEffect(() => {
    if (specialties.length === 0) return
    const today = startOfToday()
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    // Navigation never goes before the current month, so `last >= today` always.
    const from = first < today ? today : first
    specialties.forEach((s) => {
      const key = `${s.id}:${monthPart}`
      if (monthCache[key]) return
      api
        .get(`/api/slots?specialty_id=${s.id}&date_from=${toIso(from)}&date_to=${toIso(last)}`)
        .then((data) => {
          const map = {}
          data.days.forEach((d) => {
            map[d.date] = d.slots
          })
          setMonthCache((c) => ({ ...c, [key]: map }))
        })
        .catch(() => setError('Não foi possível carregar a agenda. Tente novamente.'))
    })
  }, [specialties, monthPart, cursor, monthCache])

  const monthMaps = useMemo(
    () =>
      specialties
        .map((s) => monthCache[`${s.id}:${monthPart}`])
        .filter(Boolean),
    [specialties, monthCache, monthPart],
  )
  const loadingMonth = specialties.length > 0 && monthMaps.length < specialties.length
  const monthHasSlots = monthMaps.some((m) =>
    Object.values(m).some((s) => s.length > 0),
  )

  const dayHasAvailability = (iso) =>
    monthMaps.some((m) => (m[iso]?.length ?? 0) > 0)

  // Specialties that actually have an open slot on the picked date.
  const dateSpecialties = useMemo(() => {
    if (!selectedDate) return []
    const part = monthPartOf(selectedDate)
    return specialties.filter(
      (s) => (monthCache[`${s.id}:${part}`]?.[selectedDate]?.length ?? 0) > 0,
    )
  }, [specialties, monthCache, selectedDate])

  // Times are the same for every specialty, so we can show them right away —
  // using the chosen specialty, or the first available one as a stand-in.
  const slotSpecialtyId = specialtyId || dateSpecialties[0]?.id || null

  const daySlots = useMemo(() => {
    if (!selectedDate || !slotSpecialtyId) return []
    const key = `${slotSpecialtyId}:${monthPartOf(selectedDate)}`
    return monthCache[key]?.[selectedDate] || []
  }, [monthCache, selectedDate, slotSpecialtyId])

  const slotGroups = useMemo(() => {
    const groups = { Manhã: [], Tarde: [], Noite: [] }
    daySlots.forEach((slot) => groups[periodOf(slot.start)].push(slot))
    return PERIOD_ORDER.filter((p) => groups[p].length > 0).map((p) => ({
      label: p,
      slots: groups[p],
    }))
  }, [daySlots])

  const today = startOfToday()
  const minMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const maxMonth = new Date(today.getFullYear(), today.getMonth() + MAX_MONTHS_AHEAD, 1)
  const canPrevMonth = cursor > minMonth
  const canNextMonth = cursor < maxMonth

  const pickDate = (iso) => {
    // Keep the specialty if it still has slots on the new day, otherwise the
    // patient re-picks one among those available on that date.
    const keptSpecialty =
      specialtyId &&
      (monthCache[`${specialtyId}:${monthPartOf(iso)}`]?.[iso]?.length ?? 0) > 0
        ? specialtyId
        : null
    setSelectedDate(iso)
    setSpecialtyId(keptSpecialty)
    setSelectedSlot(null)
    setError(null)
    setStep(2)
  }

  const pickSpecialty = (id) => {
    setSpecialtyId(id)
    setError(null)
    // Drop the chosen time only if it no longer exists for this specialty.
    if (selectedSlot) {
      const slots =
        monthCache[`${id}:${monthPartOf(selectedDate)}`]?.[selectedDate] || []
      const stillValid = slots.some(
        (s) => s.start === selectedSlot.start && s.type === selectedSlot.type,
      )
      if (!stillValid) setSelectedSlot(null)
    }
  }

  const pickSlot = (slot) => {
    setSelectedSlot(slot)
    setError(null)
  }

  const goToForm = () => {
    if (specialtyId && selectedSlot) setStep(3)
  }

  const goTo = (target) => {
    if (target >= step) return
    setError(null)
    setStep(target)
  }

  const reset = () => {
    setConfirmation(null)
    setSpecialtyId(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    setForm({ name: '', contact: '', notes: '' })
    setMonthCache({})
    setError(null)
    setStep(1)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const booking = await api.post('/api/bookings', {
        specialty_id: specialtyId,
        date: selectedDate,
        start: selectedSlot.start,
        type: selectedSlot.type,
        client_name: form.name.trim(),
        client_contact: form.contact.trim(),
        notes: form.notes.trim() || null,
      })
      setConfirmation(booking)
    } catch (err) {
      if (err.status === 409) {
        setMonthCache({})
        setSelectedSlot(null)
        setStep(2)
        setError('Esse horário acabou de ser reservado. Escolha outro, por favor.')
      } else {
        setError(err.detail || 'Não foi possível concluir o agendamento. Tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (unavailable) return null

  const stepsMeta = [
    {
      n: 1,
      label: 'Data',
      value: selectedDate
        ? `${parseIso(selectedDate).getDate()} ${MONTHS_SHORT[parseIso(selectedDate).getMonth()]}`
        : null,
    },
    {
      n: 2,
      label: 'Especialidade e horário',
      value:
        specialty && selectedSlot
          ? `${specialty.name} · ${fmtTime(selectedSlot.start)}`
          : null,
    },
    { n: 3, label: 'Seus dados', value: null },
  ]

  const motionProps = reducedMotion
    ? { initial: false, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
        transition: { duration: 0.26, ease: 'easeOut' },
      }

  const selectedDateObj = selectedDate ? parseIso(selectedDate) : null

  return (
    <section className="section bk-section" id="agendamento">
      <div className="container">
        <motion.div
          className="section-header bk-header"
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <p className="eyebrow">Agendamento online</p>
          <h2>Sua consulta, no seu tempo.</h2>
          <p>
            Escolha o dia, a especialidade e o horário em poucos toques. Nossa
            equipe confirma com você em seguida.
          </p>
        </motion.div>

        {confirmation ? (
          <motion.div
            className="bk-card bk-success"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            role="status"
          >
            <div className="bk-success__badge">
              <CheckIcon />
            </div>
            <h3>Solicitação enviada!</h3>
            <p className="bk-success__lead">
              Recebemos seu pedido de consulta. Entraremos em contato para
              confirmar — fique de olho no seu telefone ou e-mail.
            </p>
            <dl className="bk-success__details">
              <div>
                <dt>Especialidade</dt>
                <dd>{specialty?.name}</dd>
              </div>
              <div>
                <dt>Data</dt>
                <dd>
                  {WEEKDAYS_LONG[parseIso(confirmation.date).getDay()]},{' '}
                  {parseIso(confirmation.date).getDate()} de{' '}
                  {MONTHS_LONG[parseIso(confirmation.date).getMonth()]}
                </dd>
              </div>
              <div>
                <dt>Horário</dt>
                <dd>
                  {fmtTime(confirmation.start_time)} – {fmtTime(confirmation.end_time)}
                </dd>
              </div>
              <div>
                <dt>Modalidade</dt>
                <dd>{confirmation.type === 'online' ? 'Online' : 'Presencial'}</dd>
              </div>
            </dl>
            <button className="bk-btn bk-btn--ghost" type="button" onClick={reset}>
              Fazer novo agendamento
            </button>
          </motion.div>
        ) : (
          <div className="bk-shell">
            <div className="bk-card bk-main">
              <ol className="bk-steps" aria-label="Etapas do agendamento">
                {stepsMeta.map((s) => {
                  const state =
                    s.n === step ? 'current' : s.n < step ? 'done' : 'todo'
                  return (
                    <li key={s.n} className={`bk-steps__item is-${state}`}>
                      <button
                        type="button"
                        onClick={() => goTo(s.n)}
                        disabled={s.n >= step}
                        aria-current={s.n === step ? 'step' : undefined}
                      >
                        <span className="bk-steps__dot">
                          {state === 'done' ? <CheckIcon /> : s.n}
                        </span>
                        <span className="bk-steps__text">
                          <span className="bk-steps__label">{s.label}</span>
                          {s.value && state === 'done' && (
                            <span className="bk-steps__value">{s.value}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>

              <AnimatePresence mode="wait" initial={false}>
                {step <= 2 && (
                  <motion.div key="schedule" className="bk-step bk-schedule" {...motionProps}>
                    <div className="bk-schedule__cal">
                      <h3 className="bk-step__title">Escolha o melhor dia</h3>
                      <div className="bk-calendar" aria-busy={loadingMonth}>
                        <div className="bk-calendar__nav">
                          <button
                            type="button"
                            className="bk-iconbtn"
                            onClick={() =>
                              setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
                            }
                            disabled={!canPrevMonth}
                            aria-label="Mês anterior"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="m14.5 6-6 6 6 6" />
                            </svg>
                          </button>
                          <strong>
                            {MONTHS_LONG[cursor.getMonth()]} {cursor.getFullYear()}
                          </strong>
                          <button
                            type="button"
                            className="bk-iconbtn"
                            onClick={() =>
                              setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
                            }
                            disabled={!canNextMonth}
                            aria-label="Próximo mês"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="m9.5 6 6 6-6 6" />
                            </svg>
                          </button>
                        </div>
                        <div className="bk-calendar__grid" role="grid">
                          {WEEKDAY_HEAD.map((w, i) => (
                            <span key={`${w}-${i}`} className="bk-calendar__weekday" aria-hidden="true">
                              {w}
                            </span>
                          ))}
                          {buildMonthMatrix(cursor)
                            .flat()
                            .map((day) => {
                              const iso = toIso(day)
                              const inMonth = day.getMonth() === cursor.getMonth()
                              const enabled = inMonth && dayHasAvailability(iso)
                              const isToday = iso === toIso(today)
                              return (
                                <button
                                  key={iso}
                                  type="button"
                                  className={[
                                    'bk-calendar__day',
                                    inMonth ? '' : 'is-outside',
                                    enabled ? 'is-available' : '',
                                    selectedDate === iso ? 'is-selected' : '',
                                    isToday ? 'is-today' : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                  disabled={!enabled}
                                  onClick={() => pickDate(iso)}
                                  aria-label={`${day.getDate()} de ${MONTHS_LONG[day.getMonth()]}${enabled ? ', com horários disponíveis' : ', indisponível'}`}
                                >
                                  <span>{day.getDate()}</span>
                                  {enabled && <i className="bk-calendar__dot" aria-hidden="true" />}
                                </button>
                              )
                            })}
                        </div>
                        {loadingMonth && !error && <p className="bk-hint">Carregando agenda…</p>}
                        {!loadingMonth && !monthHasSlots && (
                          <p className="bk-hint">
                            Sem horários neste mês. Tente o próximo ou fale conosco
                            pelo formulário de contato.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="bk-schedule__side">
                      {!selectedDateObj ? (
                        <div className="bk-side-empty">
                          <CalendarGlyph />
                          <p>
                            Selecione uma data no calendário para ver as
                            especialidades e horários disponíveis.
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="bk-side-date">
                            {WEEKDAYS_LONG[selectedDateObj.getDay()]},{' '}
                            {selectedDateObj.getDate()} de{' '}
                            {MONTHS_LONG[selectedDateObj.getMonth()]}
                          </p>

                          <div className="bk-side-block">
                            <span className="bk-side-block__label">Especialidade</span>
                            {dateSpecialties.length === 0 ? (
                              <p className="bk-hint">
                                Nenhuma especialidade com horário nesta data. Escolha
                                outro dia.
                              </p>
                            ) : (
                              <div className="bk-chips" role="list">
                                {dateSpecialties.map((s) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    role="listitem"
                                    className={`bk-chip${specialtyId === s.id ? ' is-selected' : ''}`}
                                    onClick={() => pickSpecialty(s.id)}
                                  >
                                    {s.name}
                                    <em>{s.slot_duration_min} min</em>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {dateSpecialties.length > 0 && (
                            <div className="bk-side-block">
                              <span className="bk-side-block__label">Horário</span>
                              {slotGroups.map((group) => (
                                <div key={group.label} className="bk-slot-group">
                                  <span className="bk-slot-group__label">
                                    {PERIOD_ICONS[group.label]}
                                    {group.label}
                                  </span>
                                  <div className="bk-slots">
                                    {group.slots.map((slot) => {
                                      const isSel =
                                        selectedSlot?.start === slot.start &&
                                        selectedSlot?.type === slot.type
                                      return (
                                        <button
                                          key={`${slot.start}-${slot.type}`}
                                          type="button"
                                          className={`bk-slot${isSel ? ' is-selected' : ''}`}
                                          onClick={() => pickSlot(slot)}
                                        >
                                          <span className="bk-slot__time">{fmtTime(slot.start)}</span>
                                          <span className={`bk-slot__mode bk-slot__mode--${slot.type}`}>
                                            {MODALITY_ICONS[slot.type]}
                                            {MODALITY_LABELS[slot.type]}
                                          </span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                              {slotGroups.length === 0 && (
                                <p className="bk-hint">
                                  Os horários deste dia acabaram de ser preenchidos.
                                  Escolha outra data.
                                </p>
                              )}
                            </div>
                          )}

                          {dateSpecialties.length > 0 && (
                            <button
                              type="button"
                              className="bk-btn bk-btn--primary bk-schedule__next"
                              onClick={goToForm}
                              disabled={!specialtyId || !selectedSlot}
                            >
                              Continuar
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.form
                    key="step3"
                    className="bk-step bk-form"
                    onSubmit={handleSubmit}
                    {...motionProps}
                  >
                    <h3 className="bk-step__title">Quase lá! Seus dados</h3>
                    <div className="bk-form__grid">
                      <label className="bk-field" htmlFor="bk-name">
                        <span>Nome completo</span>
                        <input
                          id="bk-name"
                          type="text"
                          autoComplete="name"
                          placeholder="Como devemos te chamar?"
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          required
                          minLength={2}
                        />
                      </label>
                      <label className="bk-field" htmlFor="bk-contact">
                        <span>Telefone ou e-mail</span>
                        <input
                          id="bk-contact"
                          type="text"
                          inputMode="email"
                          autoComplete="tel"
                          placeholder="(00) 00000-0000"
                          value={form.contact}
                          onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                          required
                          minLength={5}
                        />
                      </label>
                      {selectedSlot && (
                        <div className="bk-field bk-field--full">
                          <span>Modalidade</span>
                          <p className={`bk-modality-note bk-modality-note--${selectedSlot.type}`}>
                            {MODALITY_ICONS[selectedSlot.type]}
                            Este horário é{' '}
                            <strong>{MODALITY_LABELS[selectedSlot.type].toLowerCase()}</strong>.
                          </p>
                        </div>
                      )}
                      <label className="bk-field bk-field--full" htmlFor="bk-notes">
                        <span>
                          Mensagem <em>(opcional)</em>
                        </span>
                        <textarea
                          id="bk-notes"
                          rows={3}
                          placeholder="Conte um pouco sobre o que você precisa"
                          value={form.notes}
                          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        />
                      </label>
                    </div>
                    <button className="bk-btn bk-btn--primary" type="submit" disabled={submitting}>
                      {submitting ? 'Enviando…' : 'Solicitar agendamento'}
                    </button>
                    <p className="bk-form__note">
                      Sem pagamento agora — a consulta só é confirmada após nosso
                      contato.
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>

              {error && (
                <p className="bk-error" role="alert">
                  {error}
                </p>
              )}
            </div>

            <aside className="bk-card bk-summary" aria-label="Resumo da consulta">
              <h4>Resumo da consulta</h4>
              <ul>
                <li className={selectedDateObj ? 'is-filled' : ''}>
                  <span className="bk-summary__label">Data</span>
                  <span className="bk-summary__value">
                    {selectedDateObj
                      ? `${WEEKDAYS_LONG[selectedDateObj.getDay()]}, ${selectedDateObj.getDate()} de ${MONTHS_LONG[selectedDateObj.getMonth()]}`
                      : '—'}
                  </span>
                </li>
                <li className={specialty ? 'is-filled' : ''}>
                  <span className="bk-summary__label">Especialidade</span>
                  <span className="bk-summary__value">{specialty?.name || '—'}</span>
                </li>
                <li className={selectedSlot ? 'is-filled' : ''}>
                  <span className="bk-summary__label">Horário</span>
                  <span className="bk-summary__value">
                    {selectedSlot
                      ? `${fmtTime(selectedSlot.start)} – ${fmtTime(selectedSlot.end)}`
                      : '—'}
                  </span>
                </li>
                <li className={selectedSlot ? 'is-filled' : ''}>
                  <span className="bk-summary__label">Modalidade</span>
                  <span className="bk-summary__value">
                    {selectedSlot ? MODALITY_LABELS[selectedSlot.type] : '—'}
                  </span>
                </li>
              </ul>
              <p className="bk-summary__note">
                Após enviar, nossa equipe entra em contato para confirmar o
                horário com você.
              </p>
            </aside>
          </div>
        )}
      </div>
    </section>
  )
}
