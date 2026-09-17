import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  PY_WEEKDAY_LABELS,
  STATUS_LABELS,
  fmtDayLabel,
  fmtFullDate,
  fmtMin,
  fmtShortDate,
  fmtTime,
  minToTime,
  startOfToday,
  timeToMin,
  toIso,
} from './utils'

const MODALITY_LABELS = {
  online: 'Online',
  presencial_bsb: 'Presencial — Brasília',
  presencial_rj: 'Presencial — Rio de Janeiro',
}
const MODALITY_OPTIONS = Object.entries(MODALITY_LABELS)

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

const IconInfinity = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
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

function ToggleField({ icon, label, checked, onChange }) {
  return (
    <label className="ag-toggle">
      <span className="ag-toggle__label">
        {icon}
        {label}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="ag-toggle__switch" aria-hidden="true" />
    </label>
  )
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
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="ag-confirm__msg">{message}</p>
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

export function ApptDetails({ appt, specialty, busy, onStatus, onEdit, onDelete, onClose }) {
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
              onClick={() => onStatus('cancelled')}
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

function scheduleStatus(rule, todayIso) {
  if (rule.start_date && rule.start_date > todayIso) return 'future'
  if (rule.end_date && rule.end_date < todayIso) return 'expired'
  return 'active'
}

const SCHEDULE_STATUS_LABELS = {
  active: 'Ativa agora',
  future: 'Futura',
  expired: 'Expirada',
}

function scheduleVigencyLabel(rule) {
  const from = rule.start_date ? fmtShortDate(rule.start_date) : 'sempre'
  const to = rule.end_date ? fmtShortDate(rule.end_date) : 'sem data de término'
  return `${from} – ${to}`
}

export function ScheduleList({ rules, specialtiesById, onAdd, onEdit, onDelete, onClose }) {
  const todayIso = toIso(startOfToday())
  const sorted = useMemo(
    () =>
      [...rules].sort(
        (a, b) =>
          (a.start_date || '').localeCompare(b.start_date || '') ||
          a.weekday - b.weekday ||
          timeToMin(a.start_time) - timeToMin(b.start_time),
      ),
    [rules],
  )

  return (
    <Modal title="Programações" onClose={onClose} wide>
      <p className="ag-form__hint">
        Cada programação define especialidade, dia da semana, horário, local e
        uma faixa de vigência. Cadastre programações futuras com antecedência
        sem afetar a que está ativa hoje.
      </p>
      <div className="ag-schedules__toolbar">
        <button type="button" className="ag-btn ag-btn--primary ag-btn--sm" onClick={onAdd}>
          + Nova programação
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="ag-list__empty">Nenhuma programação cadastrada.</p>
      ) : (
        <ul className="ag-list__rows">
          {sorted.map((r) => {
            const status = scheduleStatus(r, todayIso)
            const specialty = specialtiesById[r.specialty_id]
            return (
              <li key={r.id}>
                <div className="ag-list__row ag-list__row--static">
                  <span className="ag-list__time">
                    {PY_WEEKDAY_LABELS[r.weekday].slice(0, 3)}
                    <em>
                      {fmtTime(r.start_time)}–{fmtTime(r.end_time)}
                    </em>
                  </span>
                  <span className="ag-list__patient">
                    <strong>{specialty ? specialty.name : '—'}</strong>
                    <small>
                      {MODALITY_LABELS[r.location] || r.location} · {scheduleVigencyLabel(r)}
                    </small>
                  </span>
                  <span className={`ag-badge ag-badge--${status}`}>
                    {SCHEDULE_STATUS_LABELS[status]}
                  </span>
                </div>
                <div className="ag-list__actions">
                  <button
                    type="button"
                    className="ag-iconbtn"
                    onClick={() => onEdit(r)}
                    aria-label="Editar programação"
                    title="Editar programação"
                  >
                    <IconEdit />
                  </button>
                  <button
                    type="button"
                    className="ag-iconbtn ag-iconbtn--danger"
                    onClick={() => onDelete(r)}
                    aria-label="Excluir programação"
                    title="Excluir programação"
                  >
                    <IconTrash />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

/* ---------- schedule (programação) create/edit form ---------- */

export function ScheduleForm({ initial, specialties, onSubmit, onClose, title }) {
  const [form, setForm] = useState(() => ({
    specialty_id: initial.specialty_id || specialties[0]?.id || '',
    weekday: initial.weekday ?? 0,
    start: initial.start_time ? fmtTime(initial.start_time) : '08:00',
    end: initial.end_time ? fmtTime(initial.end_time) : '12:00',
    location: initial.location || 'presencial_bsb',
    // Editing a rule with a null start_date means "valid since always" — keep
    // that accurately reflected instead of silently defaulting to today (which
    // would narrow the vigência on save). New schedules default to today.
    openStart: initial.id ? !initial.start_date : false,
    start_date: initial.start_date || (initial.id ? '' : toIso(startOfToday())),
    openEnded: !initial.end_date,
    end_date: initial.end_date || '',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [orphanWarning, setOrphanWarning] = useState(null)

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [key]: value }))
    setOrphanWarning(null)
    setError(null)
  }

  const invalidTime =
    form.start && form.end && timeToMin(form.end) <= timeToMin(form.start)
  const invalidDates =
    !form.openStart &&
    !form.openEnded &&
    form.start_date &&
    form.end_date &&
    form.end_date < form.start_date

  const submit = async (e, force = false) => {
    e?.preventDefault()
    if (invalidTime || invalidDates) return
    setBusy(true)
    if (!force) setError(null)
    try {
      await onSubmit({
        specialty_id: Number(form.specialty_id),
        weekday: Number(form.weekday),
        start_time: minToTime(timeToMin(form.start)),
        end_time: minToTime(timeToMin(form.end)),
        location: form.location,
        start_date: form.openStart ? null : form.start_date || null,
        end_date: form.openEnded ? null : form.end_date || null,
        active: true,
        force,
      })
      setOrphanWarning(null)
    } catch (err) {
      if (err.status === 409 && err.payload && typeof err.payload === 'object') {
        setOrphanWarning(err.payload)
      } else {
        setOrphanWarning(null)
        setError(err.detail || 'Não foi possível salvar. Tente novamente.')
      }
    } finally {
      setBusy(false)
    }
  }

  const weekdayFull = `${PY_WEEKDAY_LABELS[Number(form.weekday)]}-feira`

  return (
    <Modal
      title={title}
      subtitle="Confira o resumo e ajuste os detalhes."
      headIcon={<IconCalendar />}
      wide
      summary={
        <div className="ag-modal__summary">
          <div className="ag-modal__summary-row">
            <IconCalendar />
            <span>
              {weekdayFull} · {form.start} – {form.end}
            </span>
          </div>
          <div className="ag-modal__summary-row">
            <IconPin />
            <span>{MODALITY_LABELS[form.location] || form.location}</span>
          </div>
        </div>
      }
      onClose={onClose}
    >
      <form className="ag-form" onSubmit={submit}>
        <div className="ag-field-row">
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
          <label className="ag-field">
            <span>Dia da semana</span>
            <span className="ag-input-icon">
              <IconCalendar />
              <select value={form.weekday} onChange={set('weekday')}>
                {PY_WEEKDAY_LABELS.map((label, idx) => (
                  <option key={label} value={idx}>
                    {label}-feira
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>
        <fieldset className="ag-field">
          <legend>Horário</legend>
          <div className="ag-field-row">
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
                <input type="time" value={form.end} onChange={set('end')} required step={300} />
              </span>
            </label>
          </div>
        </fieldset>
        {invalidTime && (
          <p className="ag-form__error">O horário final deve ser depois do inicial.</p>
        )}
        <fieldset className="ag-field">
          <legend>Local</legend>
          <div className="ag-modality-cards">
            {MODALITY_OPTIONS.map(([value]) => {
              const meta = MODALITY_CARD_META[value]
              const selected = form.location === value
              return (
                <button
                  key={value}
                  type="button"
                  className={`ag-modality-card${selected ? ' is-selected' : ''}`}
                  onClick={() => set('location')(value)}
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
        <div className="ag-field-row">
          <label className="ag-field">
            <span>Vigência a partir de</span>
            <span className="ag-input-icon">
              <IconCalendar />
              <input
                type="date"
                value={form.start_date}
                disabled={form.openStart}
                onChange={set('start_date')}
              />
            </span>
          </label>
          <label className="ag-field">
            <span>Até</span>
            <span className="ag-input-icon">
              <IconCalendar />
              <input
                type="date"
                value={form.end_date}
                disabled={form.openEnded}
                onChange={set('end_date')}
              />
            </span>
          </label>
        </div>
        <div className="ag-field-row">
          <ToggleField
            icon={<IconInfinity />}
            label="Vale desde sempre"
            checked={form.openStart}
            onChange={(e) =>
              setForm((f) => ({ ...f, openStart: e.target.checked, start_date: '' }))
            }
          />
          <ToggleField
            icon={<IconCalendar />}
            label="Sem data de término"
            checked={form.openEnded}
            onChange={(e) =>
              setForm((f) => ({ ...f, openEnded: e.target.checked, end_date: '' }))
            }
          />
        </div>
        {invalidDates && (
          <p className="ag-form__error">A data final deve ser depois da inicial.</p>
        )}

        {orphanWarning && (
          <div className="ag-form__conflict" role="alert">
            <p>{orphanWarning.message}</p>
            <ul className="ag-form__orphans">
              {orphanWarning.appointments.map((a) => (
                <li key={a.id}>
                  {fmtDayLabel(a.date)} · {a.start_time} · {a.client_name}
                </li>
              ))}
            </ul>
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
          <button
            type="submit"
            className="ag-btn ag-btn--primary"
            disabled={busy || invalidTime || invalidDates}
          >
            {busy ? (
              'Salvando…'
            ) : (
              <>
                <IconCheck />
                Salvar
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
