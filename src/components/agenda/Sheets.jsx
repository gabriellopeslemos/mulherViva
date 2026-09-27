import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import {
  MONTHS_SHORT,
  PY_WEEKDAY_LABELS,
  STATUS_LABELS,
  compareSpecificity,
  fmtDayLabel,
  fmtFullDate,
  fmtMin,
  fmtTime,
  minToTime,
  parseIso,
  periodStatus,
  prefillSource,
  rangesOverlap,
  startOfToday,
  timeToMin,
  toIso,
  weekdayDatesInPeriod,
  winningPeriod,
} from './utils'

const MODALITY_LABELS = {
  online: 'Online',
  presencial_bsb: 'Presencial — Brasília',
  presencial_rj: 'Presencial — Rio de Janeiro',
}
const MODALITY_OPTIONS = Object.entries(MODALITY_LABELS)

// A programação takes bookings for its `location`, plus online when a
// presencial window has `also_online`. Never two presencial cities at once.
function ruleLocations({ location, also_online }) {
  return also_online && location !== 'online' ? ['online', location] : [location]
}

// Next selection after clicking `loc`: online toggles freely, a city replaces
// the other city. Returns null when the click would leave nothing selected.
function toggleLocation(current, loc) {
  let next
  if (current.includes(loc)) next = current.filter((l) => l !== loc)
  else if (loc === 'online') next = [...current, loc]
  else next = [...current.filter((l) => l === 'online'), loc]
  return next.length ? next : null
}

function locationPayload(locs) {
  const city = locs.find((l) => l !== 'online')
  return city
    ? { location: city, also_online: locs.includes('online') }
    : { location: 'online', also_online: false }
}

function locationsLabel(locs, labels = MODALITY_LABELS) {
  return locs.map((l) => labels[l] || l).join(' + ')
}

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 7h15M9.5 7V4.5h5V7M7 7l1 13h8l1-13M10.5 11v5M13.5 11v5" />
  </svg>
)

const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
)

const IconClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

const IconStethoscope = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 4v6a4 4 0 0 0 8 0V4" />
    <path d="M10 14v1.5a5 5 0 0 0 10 0v-2.3" />
    <circle cx="20" cy="9.7" r="1.7" />
    <path d="M6 4H4.5M14 4h1.5" />
  </svg>
)

const IconPin = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.4" />
  </svg>
)

const IconVideo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="6" width="12" height="12" rx="2.5" />
    <path d="M15 10.2 20 7.5v9l-5-2.7" />
  </svg>
)

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 13l4 4L19 7" />
  </svg>
)

const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 19.5a7.2 7.2 0 0 1 14.4 0" />
  </svg>
)

const MODALITY_CARD_META = {
  online: { icon: <IconVideo />, label: 'Online', desc: 'Consulta por vídeo' },
  presencial_bsb: { icon: <IconPin />, label: 'Presencial', desc: 'Brasília' },
  presencial_rj: { icon: <IconPin />, label: 'Presencial', desc: 'Rio de Janeiro' },
}

/* ---------- generic shell ---------- */

export function Modal({ title, subtitle, headIcon, summary, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fancy = Boolean(summary)
  const closeBtn = (
    <button type="button" className="ag-iconbtn" onClick={onClose} aria-label="Fechar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  )

  return (
    <div
      className="ag-modal__backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className={`ag-modal${wide ? ' ag-modal--wide' : ''}${fancy ? ' ag-modal--fancy' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 26, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {fancy ? (
          <header className="ag-modal__head ag-modal__head--fancy">
            <div className="ag-modal__head-info">
              {headIcon && <span className="ag-modal__head-icon">{headIcon}</span>}
              <div className="ag-modal__head-text">
                <h3>{title}</h3>
                {subtitle && <p>{subtitle}</p>}
              </div>
            </div>
            <div className="ag-modal__head-right">
              {summary}
              {closeBtn}
            </div>
          </header>
        ) : (
          <header className="ag-modal__head">
            <h3>{title}</h3>
            {closeBtn}
          </header>
        )}
        <div className="ag-modal__body">{children}</div>
      </motion.div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
  notifyCheckbox,
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="ag-confirm__msg">{message}</p>
      {notifyCheckbox && (
        <label className="ag-legend__toggle ag-confirm__notify">
          <input
            type="checkbox"
            checked={notifyCheckbox.checked}
            onChange={(e) => notifyCheckbox.onChange(e.target.checked)}
          />
          {notifyCheckbox.label}
        </label>
      )}
      <div className="ag-modal__actions">
        <button type="button" className="ag-btn ag-btn--ghost" onClick={onCancel}>
          Voltar
        </button>
        <button
          type="button"
          className={`ag-btn ${danger ? 'ag-btn--danger' : 'ag-btn--primary'}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Aguarde…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

/* ---------- appointment details ---------- */

function contactHref(contact) {
  if (contact.includes('@')) return `mailto:${contact}`
  const digits = contact.replace(/\D/g, '')
  return digits.length >= 8 ? `tel:+55${digits}` : null
}

export function ApptDetails({ appt, specialty, busy, onStatus, onCancelAppt, onEdit, onDelete, onClose }) {
  const href = appt.client_contact ? contactHref(appt.client_contact) : null
  return (
    <Modal title="Detalhes da consulta" onClose={onClose}>
      <div className="ag-details">
        <div className="ag-details__top">
          <span className={`ag-badge ag-badge--${appt.status}`}>
            {STATUS_LABELS[appt.status]}
          </span>
          <span className="ag-badge ag-badge--type">
            {MODALITY_LABELS[appt.type] || appt.type}
          </span>
        </div>
        <dl className="ag-details__list">
          <div>
            <dt>Paciente</dt>
            <dd>{appt.client_name}</dd>
          </div>
          {appt.client_contact && (
            <div>
              <dt>Telefone</dt>
              <dd>
                {href ? <a href={href}>{appt.client_contact}</a> : appt.client_contact}
              </dd>
            </div>
          )}
          {appt.client_email && (
            <div>
              <dt>E-mail</dt>
              <dd>
                <a href={`mailto:${appt.client_email}`}>{appt.client_email}</a>
              </dd>
            </div>
          )}
          <div>
            <dt>Especialidade</dt>
            <dd>{specialty?.name || '—'}</dd>
          </div>
          <div>
            <dt>Quando</dt>
            <dd className="ag-details__when">
              {fmtFullDate(appt.date)}
              <br />
              {fmtTime(appt.start_time)} – {fmtTime(appt.end_time)}
            </dd>
          </div>
          {appt.notes && (
            <div>
              <dt>Observações</dt>
              <dd>{appt.notes}</dd>
            </div>
          )}
        </dl>
        <p className="ag-details__tip">
          Dica: para reagendar, arraste o cartão na agenda (no celular, segure e
          arraste) — ou toque em Editar.
        </p>
        <div className="ag-modal__actions ag-modal__actions--stack">
          {appt.status === 'pending' && (
            <button
              type="button"
              className="ag-btn ag-btn--primary"
              disabled={busy}
              onClick={() => onStatus('confirmed')}
            >
              Confirmar consulta
            </button>
          )}
          <button type="button" className="ag-btn ag-btn--ghost" onClick={onEdit}>
            Editar
          </button>
          {appt.status !== 'cancelled' && (
            <button
              type="button"
              className="ag-btn ag-btn--ghost"
              disabled={busy}
              onClick={onCancelAppt}
            >
              Marcar como cancelada
            </button>
          )}
          <button type="button" className="ag-btn ag-btn--danger-ghost" onClick={onDelete}>
            Excluir consulta
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- appointment create / edit form ---------- */

export function ApptForm({ initial, specialties, onSubmit, onClose, title }) {
  const isEdit = Boolean(initial.id)
  const [form, setForm] = useState(() => ({
    client_name: initial.client_name || '',
    client_contact: initial.client_contact || '',
    client_email: initial.client_email || '',
    specialty_id: initial.specialty_id || specialties[0]?.id || '',
    date: initial.date,
    start: fmtTime(initial.start_time),
    end: fmtTime(initial.end_time),
    type: initial.type || 'online',
    status: initial.status || 'confirmed',
    notes: initial.notes || '',
  }))
  const [endTouched, setEndTouched] = useState(Boolean(initial.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [conflict, setConflict] = useState(false)
  const [notifyEmail, setNotifyEmail] = useState(true)

  const scheduleChanged =
    isEdit &&
    (form.date !== initial.date ||
      form.start !== fmtTime(initial.start_time) ||
      form.end !== fmtTime(initial.end_time))
  const statusChanged = isEdit && form.status !== initial.status
  const showNotifyCheckbox =
    isEdit &&
    Boolean(form.client_email) &&
    (scheduleChanged || (statusChanged && form.status === 'cancelled'))

  const set = (key) => (e) => {
    const value = e.target ? e.target.value : e
    setForm((f) => {
      const next = { ...f, [key]: value }
      if (!endTouched && (key === 'start' || key === 'specialty_id')) {
        const spec = specialties.find((s) => s.id === Number(next.specialty_id))
        if (spec && next.start) {
          next.end = fmtMin(Math.min(timeToMin(next.start) + spec.slot_duration_min, 23 * 60 + 59))
        }
      }
      return next
    })
    setConflict(false)
    setError(null)
  }

  const invalidTime =
    form.start && form.end && timeToMin(form.end) <= timeToMin(form.start)

  const submit = async (e, force = false) => {
    e?.preventDefault()
    if (invalidTime) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        client_name: form.client_name.trim(),
        client_contact: form.client_contact.trim(),
        client_email: form.client_email.trim() || null,
        specialty_id: Number(form.specialty_id),
        date: form.date,
        start_time: minToTime(timeToMin(form.start)),
        end_time: minToTime(timeToMin(form.end)),
        type: form.type,
        status: form.status,
        notes: form.notes.trim() || null,
        force,
        notify_email: showNotifyCheckbox ? notifyEmail : true,
      })
    } catch (err) {
      if (err.status === 409) setConflict(true)
      else setError(err.detail || 'Não foi possível salvar. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      subtitle="Confira o resumo e ajuste os detalhes."
      headIcon={<IconUser />}
      wide
      summary={
        <div className="ag-modal__summary">
          <div className="ag-modal__summary-row">
            <IconUser />
            <span>{form.client_name.trim() || 'Nova paciente'}</span>
          </div>
          <div className="ag-modal__summary-row">
            <IconCalendar />
            <span>
              {form.date ? fmtDayLabel(form.date) : '—'} · {form.start} – {form.end}
            </span>
          </div>
          <div className="ag-modal__summary-row">
            <IconPin />
            <span>{MODALITY_LABELS[form.type] || form.type}</span>
          </div>
        </div>
      }
      onClose={onClose}
    >
      <form className="ag-form" onSubmit={submit}>
        <label className="ag-field">
          <span>Nome da paciente</span>
          <span className="ag-input-icon">
            <IconUser />
            <input
              type="text"
              value={form.client_name}
              onChange={set('client_name')}
              required
              minLength={2}
              placeholder="Nome completo"
            />
          </span>
        </label>
        <div className="ag-field-row">
          <label className="ag-field">
            <span>
              Telefone <em>(opcional)</em>
            </span>
            <input
              type="tel"
              inputMode="tel"
              value={form.client_contact}
              onChange={set('client_contact')}
              placeholder="(00) 00000-0000"
            />
          </label>
          <label className="ag-field">
            <span>
              E-mail <em>(opcional)</em>
            </span>
            <input
              type="email"
              inputMode="email"
              value={form.client_email}
              onChange={set('client_email')}
              placeholder="voce@email.com"
            />
          </label>
        </div>
        <label className="ag-field">
          <span>Especialidade</span>
          <span className="ag-input-icon">
            <IconStethoscope />
            <select value={form.specialty_id} onChange={set('specialty_id')}>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </span>
        </label>
        <fieldset className="ag-field">
          <legend>Quando</legend>
          <div className="ag-field-row">
            <label className="ag-field">
              <span>Data</span>
              <span className="ag-input-icon">
                <IconCalendar />
                <input type="date" value={form.date} onChange={set('date')} required />
              </span>
            </label>
            <label className="ag-field">
              <span>Início</span>
              <span className="ag-input-icon">
                <IconClock />
                <input type="time" value={form.start} onChange={set('start')} required step={300} />
              </span>
            </label>
            <label className="ag-field">
              <span>Fim</span>
              <span className="ag-input-icon">
                <IconClock />
                <input
                  type="time"
                  value={form.end}
                  onChange={(e) => {
                    setEndTouched(true)
                    set('end')(e)
                  }}
                  required
                  step={300}
                />
              </span>
            </label>
          </div>
        </fieldset>
        {invalidTime && (
          <p className="ag-form__error">O horário final deve ser depois do inicial.</p>
        )}
        <fieldset className="ag-field">
          <legend>Modalidade</legend>
          <div className="ag-modality-cards">
            {MODALITY_OPTIONS.map(([value]) => {
              const meta = MODALITY_CARD_META[value]
              const selected = form.type === value
              return (
                <button
                  key={value}
                  type="button"
                  className={`ag-modality-card${selected ? ' is-selected' : ''}`}
                  onClick={() => set('type')(value)}
                >
                  <span className="ag-modality-card__icon">{meta.icon}</span>
                  <span className="ag-modality-card__text">
                    <strong>{meta.label}</strong>
                    <small>{meta.desc}</small>
                  </span>
                  {selected && (
                    <span className="ag-modality-card__check">
                      <IconCheck />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </fieldset>
        <label className="ag-field">
          <span>Situação</span>
          <select value={form.status} onChange={set('status')}>
            <option value="confirmed">Confirmada</option>
            <option value="pending">Aguardando</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </label>
        <label className="ag-field">
          <span>
            Observações <em>(opcional)</em>
          </span>
          <textarea rows={2} value={form.notes} onChange={set('notes')} />
        </label>

        {showNotifyCheckbox && (
          <label className="ag-legend__toggle">
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.checked)}
            />
            {form.status === 'cancelled'
              ? 'Avisar a paciente por e-mail sobre o cancelamento'
              : 'Avisar a paciente por e-mail sobre a remarcação'}
          </label>
        )}

        {conflict && (
          <div className="ag-form__conflict" role="alert">
            <p>Já existe uma consulta nesse horário.</p>
            <button
              type="button"
              className="ag-btn ag-btn--danger"
              disabled={busy}
              onClick={(e) => submit(e, true)}
            >
              Salvar mesmo assim
            </button>
          </div>
        )}
        {error && (
          <p className="ag-form__error" role="alert">
            {error}
          </p>
        )}

        <div className="ag-modal__actions">
          <button type="button" className="ag-btn ag-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="ag-btn ag-btn--primary" disabled={busy || invalidTime}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- empty-slot quick actions ---------- */

export function SlotActions({ dateIso, startMin, onCreate, onBlock, onOpen, onClose }) {
  return (
    <Modal title={`${fmtFullDate(dateIso)} · ${fmtMin(startMin)}`} onClose={onClose}>
      <div className="ag-slotactions">
        <button type="button" onClick={onCreate}>
          <span className="ag-slotactions__icon ag-slotactions__icon--appt">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span>
            <strong>Nova consulta</strong>
            <small>Agendar uma paciente neste horário</small>
          </span>
        </button>
        <button type="button" onClick={onBlock}>
          <span className="ag-slotactions__icon ag-slotactions__icon--block">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M6.5 6.5 17.5 17.5" />
            </svg>
          </span>
          <span>
            <strong>Bloquear horário</strong>
            <small>Impedir agendamentos (almoço, compromisso…)</small>
          </span>
        </button>
        <button type="button" onClick={onOpen}>
          <span className="ag-slotactions__icon ag-slotactions__icon--open">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 8v4l3 2" />
            </svg>
          </span>
          <span>
            <strong>Abrir horário extra</strong>
            <small>Atender fora do horário padrão</small>
          </span>
        </button>
      </div>
    </Modal>
  )
}

/* ---------- block / extra-open form ---------- */

export function OverrideForm({ kind, initial, specialties, onSubmit, onClose }) {
  const isBlock = kind === 'block'
  const [form, setForm] = useState(() => ({
    date: initial.date,
    allDay: false,
    start: fmtMin(initial.startMin),
    end: fmtMin(Math.min(initial.startMin + 60, 23 * 60 + 59)),
    reason: '',
    specialty_id: '',
    location: 'online',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const invalidTime =
    !form.allDay && form.start && form.end && timeToMin(form.end) <= timeToMin(form.start)

  const submit = async (e) => {
    e.preventDefault()
    if (invalidTime) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        kind,
        date: form.date,
        start_time: form.allDay ? null : minToTime(timeToMin(form.start)),
        end_time: form.allDay ? null : minToTime(timeToMin(form.end)),
        location: isBlock ? null : form.location,
        reason: isBlock ? form.reason.trim() || null : null,
        specialty_id: form.specialty_id ? Number(form.specialty_id) : null,
      })
    } catch (err) {
      setError(err.detail || 'Não foi possível salvar. Tente novamente.')
      setBusy(false)
    }
  }

  return (
    <Modal title={isBlock ? 'Bloquear horário' : 'Abrir horário extra'} onClose={onClose}>
      <form className="ag-form" onSubmit={submit}>
        <p className="ag-form__hint">
          {isBlock
            ? 'O período bloqueado some das opções de agendamento das pacientes.'
            : 'O período extra fica disponível para agendamento mesmo fora do horário padrão.'}
        </p>
        <label className="ag-field">
          <span>Data</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            required
          />
        </label>
        {isBlock && (
          <label className="ag-check">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
            />
            <span>Bloquear o dia inteiro</span>
          </label>
        )}
        {!form.allDay && (
          <div className="ag-field-row">
            <label className="ag-field">
              <span>Início</span>
              <input
                type="time"
                value={form.start}
                onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                required
                step={300}
              />
            </label>
            <label className="ag-field">
              <span>Fim</span>
              <input
                type="time"
                value={form.end}
                onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                required
                step={300}
              />
            </label>
          </div>
        )}
        {invalidTime && (
          <p className="ag-form__error">O horário final deve ser depois do inicial.</p>
        )}
        {!isBlock && (
          <fieldset className="ag-field">
            <legend>Modalidade</legend>
            <div className="ag-segment ag-segment--wrap">
              {MODALITY_OPTIONS.map(([value, lbl]) => (
                <button
                  key={value}
                  type="button"
                  className={form.location === value ? 'is-selected' : ''}
                  onClick={() => setForm((f) => ({ ...f, location: value }))}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {isBlock && (
          <label className="ag-field">
            <span>
              Motivo <em>(opcional, só você vê)</em>
            </span>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Ex.: almoço, congresso, consulta médica"
            />
          </label>
        )}
        <label className="ag-field">
          <span>Vale para</span>
          <select
            value={form.specialty_id}
            onChange={(e) => setForm((f) => ({ ...f, specialty_id: e.target.value }))}
          >
            <option value="">Todas as especialidades</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                Somente {s.name}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="ag-form__error" role="alert">
            {error}
          </p>
        )}
        <div className="ag-modal__actions">
          <button type="button" className="ag-btn ag-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className={`ag-btn ${isBlock ? 'ag-btn--danger' : 'ag-btn--primary'}`}
            disabled={busy || invalidTime}
          >
            {busy ? 'Salvando…' : isBlock ? 'Bloquear' : 'Abrir horário'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- override details (remove) ---------- */

export function OverrideDetails({ ov, specialty, busy, onDelete, onClose }) {
  const isBlock = ov.kind === 'block'
  return (
    <Modal title={isBlock ? 'Horário bloqueado' : 'Horário extra'} onClose={onClose}>
      <dl className="ag-details__list">
        <div>
          <dt>Data</dt>
          <dd>{fmtFullDate(ov.date)}</dd>
        </div>
        <div>
          <dt>Período</dt>
          <dd>
            {ov.start_time
              ? `${fmtTime(ov.start_time)} – ${fmtTime(ov.end_time)}`
              : 'Dia inteiro'}
          </dd>
        </div>
        {!isBlock && ov.location && (
          <div>
            <dt>Local</dt>
            <dd>{MODALITY_LABELS[ov.location] || ov.location}</dd>
          </div>
        )}
        {ov.reason && (
          <div>
            <dt>Motivo</dt>
            <dd>{ov.reason}</dd>
          </div>
        )}
        <div>
          <dt>Vale para</dt>
          <dd>{specialty ? specialty.name : 'Todas as especialidades'}</dd>
        </div>
      </dl>
      <div className="ag-modal__actions">
        <button type="button" className="ag-btn ag-btn--ghost" onClick={onClose}>
          Fechar
        </button>
        <button
          type="button"
          className="ag-btn ag-btn--danger"
          disabled={busy}
          onClick={onDelete}
        >
          {busy ? 'Removendo…' : isBlock ? 'Remover bloqueio' : 'Remover horário extra'}
        </button>
      </div>
    </Modal>
  )
}

/* ---------- schedules (programações) list ---------- */


// '15 out', with the year only when it isn't the current one.
function fmtPeriodDay(iso) {
  const d = parseIso(iso)
  const base = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`
}

function periodLabel(p) {
  if (!p.start_date && !p.end_date) return 'Sempre'
  if (!p.start_date) return `Até ${fmtPeriodDay(p.end_date)}`
  if (!p.end_date) return `${fmtPeriodDay(p.start_date)} +`
  return `${fmtPeriodDay(p.start_date)} – ${fmtPeriodDay(p.end_date)}`
}

function sortPeriods(periods) {
  return [...periods].sort(
    (a, b) =>
      (a.start_date || '').localeCompare(b.start_date || '') ||
      (a.end_date || '9999').localeCompare(b.end_date || '9999') ||
      a.id - b.id,
  )
}

// More specific periods that take over part of `period`'s range.
function periodsOverriding(period, periods) {
  return periods.filter(
    (p) =>
      p.id !== period.id &&
      rangesOverlap(p.start_date, p.end_date, period.start_date, period.end_date) &&
      compareSpecificity(p, period) < 0,
  )
}

const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const IconCopy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5" />
    <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
  </svg>
)

const IconChevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m7 10 5 5 5-5" />
  </svg>
)

// Selectable times in the inline pickers: every 30 minutes across the day.
const SCHEDULE_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => i * 30)

// Closes a popover on a pointerdown outside `ref` or on Escape. Escape is
// stopped here so it closes only the popover, not the whole Modal (which
// listens on window).
function useDismiss(ref, open, onDismiss) {
  useEffect(() => {
    if (!open) return undefined
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onDismiss()
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [ref, open, onDismiss])

  return (e) => {
    if (open && e.key === 'Escape') {
      e.stopPropagation()
      onDismiss()
    }
  }
}

// Arrow up/down moves focus between a listbox's options.
function moveOptionFocus(listEl, e) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  e.preventDefault()
  const items = [...listEl.querySelectorAll('[role="option"]')]
  const idx = items.indexOf(document.activeElement)
  const next = items[Math.min(items.length - 1, Math.max(0, idx + (e.key === 'ArrowDown' ? 1 : -1)))]
  next?.focus()
}

const popoverMotion = (reduce) => ({
  initial: reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 },
  transition: { duration: reduce ? 0.1 : 0.16, ease: [0.2, 0.8, 0.2, 1] },
})

const LOCATION_SHORT = {
  online: 'Online',
  presencial_bsb: 'Brasília',
  presencial_rj: 'Rio de Janeiro',
}

// Multi-select: online plus at most one city. Each click saves right away and
// the panel stays open so online + city can be picked in a row.
function LocationPicker({ value, label, open, onOpenChange, onSelect, reduce, disabled }) {
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  const onKeyDown = useDismiss(rootRef, open, close)

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true })
  }, [open])

  const city = value.find((l) => l !== 'online')
  const full = locationsLabel(value)

  return (
    <div className={`ag-tpick ag-tpick--loc${open ? ' is-open' : ''}`} ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="ag-tpick__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${full}`}
        title={full}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        <span className="ag-tpick__icon">{MODALITY_CARD_META[city || 'online'].icon}</span>
        <span>{locationsLabel(value, LOCATION_SHORT)}</span>
        <IconChevron />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            className="ag-tpick__panel ag-tpick__panel--loc"
            role="listbox"
            aria-label={label}
            aria-multiselectable="true"
            onKeyDown={(e) => moveOptionFocus(listRef.current, e)}
            {...popoverMotion(reduce)}
          >
            <li className="ag-tpick__note" aria-hidden="true">
              Online + uma cidade
            </li>
            {MODALITY_OPTIONS.map(([loc]) => {
              const m = MODALITY_CARD_META[loc]
              const selected = value.includes(loc)
              const next = toggleLocation(value, loc)
              return (
                <li key={loc}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={selected ? 'is-selected' : ''}
                    aria-disabled={!next}
                    title={!next ? 'Selecione ao menos um local' : undefined}
                    onClick={() => next && !disabled && onSelect(next)}
                  >
                    <span className="ag-tpick__opt">
                      <span className="ag-tpick__icon">{m.icon}</span>
                      <span>
                        <strong>{m.label}</strong>
                        <small>{m.desc}</small>
                      </span>
                    </span>
                    {selected && <IconCheck />}
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function TimePicker({ value, min, max, label, open, onOpenChange, onSelect, reduce, disabled }) {
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  const onKeyDown = useDismiss(rootRef, open, close)

  const options = useMemo(() => {
    const opts = SCHEDULE_TIME_OPTIONS.filter(
      (m) => (min == null || m > min) && (max == null || m < max),
    )
    if (!opts.includes(value)) opts.push(value)
    return opts.sort((a, b) => a - b)
  }, [value, min, max])

  // Opening scrolls the current time into view and focuses it, so the list is
  // keyboard-navigable straight away.
  useEffect(() => {
    if (!open) return
    const selected = listRef.current?.querySelector('[aria-selected="true"]')
    selected?.scrollIntoView({ block: 'center' })
    selected?.focus({ preventScroll: true })
  }, [open])

  const onListKey = (e) => moveOptionFocus(listRef.current, e)

  return (
    <div className={`ag-tpick${open ? ' is-open' : ''}`} ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="ag-tpick__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${fmtMin(value)}`}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        <span>{fmtMin(value)}</span>
        <IconChevron />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            className="ag-tpick__panel"
            role="listbox"
            aria-label={label}
            onKeyDown={onListKey}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: reduce ? 0.1 : 0.16, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {options.map((m) => (
              <li key={m}>
                <button
                  type="button"
                  role="option"
                  aria-selected={m === value}
                  className={m === value ? 'is-selected' : ''}
                  onClick={() => {
                    close()
                    if (m !== value) onSelect(m)
                  }}
                >
                  {fmtMin(m)}
                  {m === value && <IconCheck />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function CopyDayMenu({ weekday, open, onOpenChange, onApply, reduce, disabled }) {
  const rootRef = useRef(null)
  const [targets, setTargets] = useState([])
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  const onKeyDown = useDismiss(rootRef, open, close)

  const others = PY_WEEKDAY_LABELS.map((label, idx) => ({ label, idx })).filter(
    (d) => d.idx !== weekday,
  )
  const toggle = (idx) =>
    setTargets((t) => (t.includes(idx) ? t.filter((x) => x !== idx) : [...t, idx]))

  return (
    <div className="ag-sched__copy" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="ag-sched__iconbtn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Copiar horários de ${PY_WEEKDAY_LABELS[weekday].toLowerCase()} para outros dias`}
        title="Copiar para outros dias"
        disabled={disabled}
        onClick={() => {
          if (!open) setTargets([])
          onOpenChange(!open)
        }}
      >
        <IconCopy />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="ag-sched__copypanel"
            role="dialog"
            aria-label="Copiar horários"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: reduce ? 0.1 : 0.16, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <p>Copiar para</p>
            {others.map((d) => (
              <label key={d.idx} className="ag-sched__copyopt">
                <input
                  type="checkbox"
                  checked={targets.includes(d.idx)}
                  onChange={() => toggle(d.idx)}
                />
                <span>{d.label}</span>
              </label>
            ))}
            <button
              type="button"
              className="ag-btn ag-btn--primary ag-btn--sm"
              disabled={targets.length === 0}
              onClick={() => {
                close()
                onApply(targets.sort((a, b) => a - b))
              }}
            >
              Aplicar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// "Só em 16 out", "16 out e 23 out" — only worth saying for a handful of dates.
function occurrencesLabel(dates) {
  const labels = dates.map(fmtPeriodDay)
  if (labels.length === 1) return `Só em ${labels[0]}`
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`
}

function ScheduleDayRow({
  weekday,
  rules,
  occurrences,
  reduce,
  busy,
  elevated,
  openPanel,
  onPanelOpenChange,
  onAdd,
  onDelete,
  onUpdateRule,
  onCopy,
  onClearDay,
}) {
  const enabled = rules.length > 0
  const absent = occurrences?.length === 0
  const label = PY_WEEKDAY_LABELS[weekday]
  const panelProps = (id) => ({
    open: openPanel === id,
    onOpenChange: (open) => onPanelOpenChange(id, open),
  })
  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, height: 0 },
        animate: { opacity: 1, height: 'auto' },
        exit: { opacity: 0, height: 0 },
      }
  const addButton = (
    <button
      type="button"
      className="ag-sched__iconbtn"
      onClick={() => onAdd(weekday, rules)}
      aria-label={`Adicionar horário em ${label.toLowerCase()}`}
      title="Adicionar horário"
      disabled={busy}
    >
      <IconPlus />
    </button>
  )

  return (
    <motion.div
      layout={reduce ? false : 'position'}
      className={`ag-sched__day${elevated ? ' is-elevated' : ''}${enabled ? '' : ' is-off'}${absent ? ' is-absent' : ''}`}
    >
      <div className="ag-sched__dayhead">
        <label className="ag-sched__switch">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={() => (enabled ? onClearDay(weekday, rules) : onAdd(weekday, rules))}
          />
          <span className="ag-toggle__switch" aria-hidden="true" />
          <span className="ag-sched__dayname">{label}</span>
        </label>
        {occurrences && occurrences.length > 0 && occurrences.length <= 3 && (
          <small className="ag-sched__occ">{occurrencesLabel(occurrences)}</small>
        )}
        {absent && <small className="ag-sched__occ">Não ocorre nesta janela</small>}
      </div>

      <div className="ag-sched__ranges">
        <AnimatePresence initial={false} mode="popLayout">
          {!enabled && (
            <motion.p key="off" className="ag-sched__off" {...fade} transition={{ duration: 0.18 }}>
              Fechado
            </motion.p>
          )}
          {rules.map((r, i) => {
            const start = timeToMin(r.start_time)
            const end = timeToMin(r.end_time)
            return (
              <motion.div
                key={r.id}
                layout={reduce ? false : 'position'}
                className="ag-sched__range"
                {...fade}
                transition={{ duration: reduce ? 0.1 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <div className="ag-sched__times">
                  <TimePicker
                    label={`Início de ${label.toLowerCase()}`}
                    value={start}
                    max={end}
                    reduce={reduce}
                    disabled={busy}
                    onSelect={(m) =>
                      onUpdateRule(r, { start_time: minToTime(m), end_time: minToTime(end) })
                    }
                    {...panelProps(`${r.id}-start`)}
                  />
                  <span className="ag-sched__dash" aria-hidden="true">–</span>
                  <TimePicker
                    label={`Fim de ${label.toLowerCase()}`}
                    value={end}
                    min={start}
                    reduce={reduce}
                    disabled={busy}
                    onSelect={(m) =>
                      onUpdateRule(r, { start_time: minToTime(start), end_time: minToTime(m) })
                    }
                    {...panelProps(`${r.id}-end`)}
                  />
                  <LocationPicker
                    label={`Local de ${label.toLowerCase()}`}
                    value={ruleLocations(r)}
                    reduce={reduce}
                    disabled={busy}
                    onSelect={(locs) => onUpdateRule(r, locationPayload(locs))}
                    {...panelProps(`${r.id}-loc`)}
                  />
                </div>
                {/* Day-level actions (+, copiar) ride on the first range so the
                    order reads + · copiar · lixeira; later ranges keep blank
                    slots there so their trash stays aligned. */}
                <div className="ag-sched__dayactions">
                  {i === 0 ? (
                    <>
                      {addButton}
                      <CopyDayMenu
                        weekday={weekday}
                        reduce={reduce}
                        disabled={busy}
                        onApply={(targets) => onCopy(rules, targets)}
                        {...panelProps(`copy-${weekday}`)}
                      />
                    </>
                  ) : (
                    <>
                      <span className="ag-sched__iconslot" aria-hidden="true" />
                      <span className="ag-sched__iconslot" aria-hidden="true" />
                    </>
                  )}
                  <button
                    type="button"
                    className="ag-sched__iconbtn ag-sched__iconbtn--danger"
                    onClick={() => onDelete(r)}
                    disabled={busy}
                    aria-label={`Excluir horário de ${label.toLowerCase()}`}
                    title="Excluir horário"
                  >
                    <IconTrash />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {!enabled && <div className="ag-sched__dayactions">{addButton}</div>}
    </motion.div>
  )
}

function NewPeriodMenu({ periods, open, onOpenChange, onCreate, reduce, disabled, prominent }) {
  const rootRef = useRef(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [openEnded, setOpenEnded] = useState(false)
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  const onKeyDown = useDismiss(rootRef, open, close)

  const endIso = openEnded ? null : end || null
  const missingEnd = !openEnded && !end
  const backwards = Boolean(start && endIso && endIso < start)
  const valid = Boolean(start) && !missingEnd && !backwards

  // What the server will do on create: copy the rules of `source`, and win
  // over every broader period the range touches.
  const source = valid ? prefillSource(start, endIso, periods) : null
  const draft = { id: Infinity, start_date: start, end_date: endIso }
  const alsoReplaces = valid
    ? periods.filter(
        (p) =>
          p !== source &&
          rangesOverlap(start, endIso, p.start_date, p.end_date) &&
          compareSpecificity(draft, p) < 0,
      )
    : []

  return (
    <div className="ag-sched__copy ag-period-add" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        className={`ag-period-add__btn${prominent ? ' is-prominent' : ''}${open ? ' is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Criar janela de horário"
        title="Criar janela de horário"
        disabled={disabled}
        onClick={() => {
          if (!open) {
            setStart(toIso(startOfToday()))
            setEnd('')
            setOpenEnded(false)
          }
          onOpenChange(!open)
        }}
      >
        <IconPlus />
        <span className="ag-period-add__label">Criar</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="ag-sched__copypanel ag-period-new"
            role="dialog"
            aria-label="Nova janela de horário"
            {...popoverMotion(reduce)}
          >
            <p>Nova janela de horário</p>
            <div className="ag-period-new__dates">
              <label className="ag-field">
                <span>De</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="ag-field">
                <span>Até</span>
                <input
                  type="date"
                  value={openEnded ? '' : end}
                  min={start || undefined}
                  disabled={openEnded}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            <label className="ag-sched__copyopt">
              <input
                type="checkbox"
                checked={openEnded}
                onChange={(e) => setOpenEnded(e.target.checked)}
              />
              <span>Sem data de término</span>
            </label>
            {backwards && (
              <p className="ag-period-new__note is-error" role="alert">
                A data final deve ser depois da inicial.
              </p>
            )}
            {valid && (
              <div className="ag-period-new__note">
                {source ? (
                  <>
                    Começa com os horários de <strong>{periodLabel(source)}</strong>. Exclua o
                    que não deve valer nesse intervalo.
                  </>
                ) : (
                  'Começa sem horários.'
                )}
                {alsoReplaces.length > 0 && (
                  <>
                    {' '}
                    No intervalo, também passa a valer no lugar de{' '}
                    <strong>{alsoReplaces.map(periodLabel).join(', ')}</strong>.
                  </>
                )}
              </div>
            )}
            <button
              type="button"
              className="ag-btn ag-btn--primary ag-btn--sm"
              disabled={!valid}
              onClick={() => {
                close()
                onCreate({ start_date: start, end_date: endIso })
              }}
            >
              Criar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Dates of the selected vigência, edited in place. Mounted with a key per
// saved value so a save (or switching tabs) resets the draft.
function PeriodEditor({ period, periods, busy, onSave, onDelete, onSelect }) {
  const legacyOpenStart = !period.start_date
  const [start, setStart] = useState(period.start_date || '')
  const [end, setEnd] = useState(period.end_date || '')

  const dirty = start !== (period.start_date || '') || end !== (period.end_date || '')
  const backwards = Boolean(start && end && end < start)
  const overriding = periodsOverriding(period, periods)

  return (
    <div className="ag-period">
      <div className="ag-period__row">
        <IconCalendar />
        <label className="ag-period__date">
          <span>De</span>
          <input
            type="date"
            value={start}
            max={end || undefined}
            required={!legacyOpenStart}
            disabled={busy}
            onChange={(e) => setStart(e.target.value)}
            aria-label="Início da janela"
          />
          {legacyOpenStart && !start && <em>sempre</em>}
        </label>
        <label className="ag-period__date">
          <span>até</span>
          <input
            type="date"
            value={end}
            min={start || undefined}
            disabled={busy}
            onChange={(e) => setEnd(e.target.value)}
            aria-label="Fim da janela"
          />
          {!end && <em>sem término</em>}
        </label>
        {end && (
          <button
            type="button"
            className="ag-period__clear"
            disabled={busy}
            onClick={() => setEnd('')}
          >
            Sem término
          </button>
        )}
        <span className="ag-period__spacer" />
        {dirty ? (
          <>
            <button
              type="button"
              className="ag-btn ag-btn--ghost ag-btn--sm"
              disabled={busy}
              onClick={() => {
                setStart(period.start_date || '')
                setEnd(period.end_date || '')
              }}
            >
              Desfazer
            </button>
            <button
              type="button"
              className="ag-btn ag-btn--primary ag-btn--sm"
              disabled={busy || backwards || (!legacyOpenStart && !start)}
              onClick={() => onSave({ start_date: start || null, end_date: end || null })}
            >
              <IconCheck />
              Salvar datas
            </button>
          </>
        ) : (
          <button
            type="button"
            className="ag-sched__iconbtn ag-sched__iconbtn--danger"
            onClick={onDelete}
            disabled={busy}
            aria-label="Excluir janela de horário"
            title="Excluir janela de horário"
          >
            <IconTrash />
          </button>
        )}
      </div>
      {backwards && (
        <p className="ag-form__error" role="alert">
          A data final deve ser depois da inicial.
        </p>
      )}
      {overriding.length > 0 && (
        <p className="ag-period__note">
          Em parte desse intervalo vale outra janela, mais curta:{' '}
          {overriding.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <button type="button" className="ag-period__link" onClick={() => onSelect(p.id)}>
                {periodLabel(p)}
              </button>
            </span>
          ))}
          .
        </p>
      )}
    </div>
  )
}

export function ScheduleList({
  periods,
  rules,
  selectedId,
  onSelect,
  busy,
  onCreatePeriod,
  onUpdatePeriod,
  onDeletePeriod,
  onAdd,
  onDelete,
  onUpdateRule,
  onCopy,
  onClearDay,
  onClose,
}) {
  const reduce = useReducedMotion() ?? false
  const todayIso = toIso(startOfToday())
  const [showExpired, setShowExpired] = useState(false)
  // Only one popover (time list, copy menu, new vigência) is open at a time;
  // the row that opened it last stays elevated so its panel paints on top.
  const [openPanel, setOpenPanel] = useState(null)
  const [openDay, setOpenDay] = useState(null)

  const sorted = sortPeriods(periods)
  const todayWinner = winningPeriod(periods, todayIso)
  // Default tab: what governs today, else the next one to start, else the latest.
  const selected =
    periods.find((p) => p.id === selectedId) ||
    todayWinner ||
    sorted.find((p) => periodStatus(p, todayIso) === 'future') ||
    sorted[sorted.length - 1] ||
    null

  const expiredCount = sorted.filter((p) => periodStatus(p, todayIso) === 'expired').length
  const visible = sorted.filter(
    (p) => showExpired || p.id === selected?.id || periodStatus(p, todayIso) !== 'expired',
  )

  const byDay = PY_WEEKDAY_LABELS.map((_, weekday) =>
    rules
      .filter((r) => r.period_id === selected?.id && r.weekday === weekday)
      .sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time)),
  )

  // A panel whose rule vanished (deleted, other tab) can't report itself
  // closed — treat it as closed so it doesn't reopen if the rule comes back.
  const livePanels = new Set(['new-period'])
  byDay.forEach((list, day) => {
    if (list.length) livePanels.add(`copy-${day}`)
    for (const r of list) {
      livePanels.add(`${r.id}-start`)
      livePanels.add(`${r.id}-end`)
      livePanels.add(`${r.id}-loc`)
    }
  })
  const activePanel = livePanels.has(openPanel) ? openPanel : null

  const panelOpenChange = (day, id, open) => {
    setOpenPanel((current) => (open ? id : current === id ? null : current))
    if (open) setOpenDay(day)
  }

  return (
    <Modal title="Programações" onClose={onClose} wide>
      <p className="ag-form__hint">
        Cada janela de horário é um intervalo de datas com a sua semana de atendimento.
        Quando duas se sobrepõem, vale a mais curta — e nela, dia sem horário
        fica fechado.
      </p>
      <section className="ag-periods" aria-label="Janelas de horário">
        <div className="ag-periods__head">
          <span className="ag-periods__title">Janelas de horário</span>
          {expiredCount > 0 && (
            <label className="ag-sched__filter">
              <input
                type="checkbox"
                checked={showExpired}
                onChange={(e) => setShowExpired(e.target.checked)}
              />
              Mostrar expiradas ({expiredCount})
            </label>
          )}
        </div>

        <div className="ag-periods__bar">
          {selected ? (
            <div className="ag-period-tabs" role="tablist" aria-label="Janelas de horário">
              {visible.map((p) => {
                const isCurrent = p.id === todayWinner?.id
                const expired = periodStatus(p, todayIso) === 'expired'
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={p.id === selected.id}
                    className={`ag-period-tab${isCurrent ? ' is-current' : ''}${expired ? ' is-expired' : ''}${p.id === selected.id ? ' is-selected' : ''}`}
                    title={isCurrent ? 'Atual — vale hoje' : undefined}
                    onClick={() => onSelect(p.id)}
                  >
                    <span className="ag-period-tab__label">{periodLabel(p)}</span>
                    {isCurrent && (
                      <span className="ag-period-tab__live">
                        <span>(atual)</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="ag-periods__empty">
              Nenhuma janela de horário criada ainda. Crie a primeira para montar a semana
              de atendimento.
            </p>
          )}
          <NewPeriodMenu
            periods={periods}
            reduce={reduce}
            disabled={busy}
            prominent={!selected}
            onCreate={onCreatePeriod}
            open={activePanel === 'new-period'}
            onOpenChange={(open) => panelOpenChange(null, 'new-period', open)}
          />
        </div>

        {selected && (
          <PeriodEditor
            key={`${selected.id}:${selected.start_date}:${selected.end_date}`}
            period={selected}
            periods={periods}
            busy={busy}
            onSave={(patch) => onUpdatePeriod(selected, patch)}
            onDelete={() => onDeletePeriod(selected)}
            onSelect={onSelect}
          />
        )}
      </section>

      {selected && (
        <>
          <LayoutGroup id="ag-schedules">
            <div className="ag-sched" role="tabpanel">
              {byDay.map((dayRules, weekday) => (
                <ScheduleDayRow
                  key={weekday}
                  weekday={weekday}
                  rules={dayRules}
                  occurrences={weekdayDatesInPeriod(selected, weekday)}
                  reduce={reduce}
                  busy={busy}
                  elevated={openDay === weekday}
                  openPanel={activePanel}
                  onPanelOpenChange={(id, open) => panelOpenChange(weekday, id, open)}
                  onAdd={(wd, list) => onAdd(selected.id, wd, list)}
                  onDelete={onDelete}
                  onUpdateRule={onUpdateRule}
                  onCopy={onCopy}
                  onClearDay={onClearDay}
                />
              ))}
            </div>
          </LayoutGroup>
        </>
      )}
    </Modal>
  )
}
