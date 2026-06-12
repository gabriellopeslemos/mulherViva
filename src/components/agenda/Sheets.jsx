import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  PY_WEEKDAY_LABELS,
  STATUS_LABELS,
  fmtFullDate,
  fmtMin,
  fmtTime,
  minToTime,
  timeToMin,
} from './utils'

/* ---------- generic shell ---------- */

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="ag-modal__backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className={`ag-modal${wide ? ' ag-modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 26, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <header className="ag-modal__head">
          <h3>{title}</h3>
          <button type="button" className="ag-iconbtn" onClick={onClose} aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
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
            {appt.type === 'online' ? 'Online' : 'Presencial'}
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
    type: initial.type || 'presencial',
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
    <Modal title={title} onClose={onClose}>
      <form className="ag-form" onSubmit={submit}>
        <label className="ag-field">
          <span>Nome da paciente</span>
          <input
            type="text"
            value={form.client_name}
            onChange={set('client_name')}
            required
            minLength={2}
            placeholder="Nome completo"
          />
        </label>
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
        <label className="ag-field">
          <span>Especialidade</span>
          <select value={form.specialty_id} onChange={set('specialty_id')}>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="ag-field-row">
          <label className="ag-field">
            <span>Data</span>
            <input type="date" value={form.date} onChange={set('date')} required />
          </label>
          <label className="ag-field">
            <span>Início</span>
            <input type="time" value={form.start} onChange={set('start')} required step={300} />
          </label>
          <label className="ag-field">
            <span>Fim</span>
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
          </label>
        </div>
        {invalidTime && (
          <p className="ag-form__error">O horário final deve ser depois do inicial.</p>
        )}
        <div className="ag-field-row">
          <fieldset className="ag-field">
            <legend>Modalidade</legend>
            <div className="ag-segment">
              {[
                ['presencial', 'Presencial'],
                ['online', 'Online'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={form.type === value ? 'is-selected' : ''}
                  onClick={() => set('type')(value)}
                >
                  {label}
                </button>
              ))}
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
        </div>
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
    type: 'presencial',
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
        type: isBlock ? null : form.type,
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
            <div className="ag-segment">
              {[
                ['presencial', 'Presencial'],
                ['online', 'Online'],
              ].map(([value, lbl]) => (
                <button
                  key={value}
                  type="button"
                  className={form.type === value ? 'is-selected' : ''}
                  onClick={() => setForm((f) => ({ ...f, type: value }))}
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

/* ---------- weekly work hours editor ---------- */

let tempId = -1

export function HoursEditor({ rules, specialties, onSave, onClose }) {
  const [rows, setRows] = useState(() =>
    rules
      .filter((r) => r.active)
      .map((r) => ({
        id: r.id,
        weekday: r.weekday,
        specialty_id: r.specialty_id,
        start: fmtTime(r.start_time),
        end: fmtTime(r.end_time),
        type: r.type || 'presencial',
      })),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const byDay = useMemo(() => {
    const map = Array.from({ length: 7 }, () => [])
    rows.forEach((row) => map[row.weekday].push(row))
    map.forEach((list) => list.sort((a, b) => timeToMin(a.start) - timeToMin(b.start)))
    return map
  }, [rows])

  const updateRow = (id, patch) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const addRow = (weekday) => {
    const last = byDay[weekday][byDay[weekday].length - 1]
    const start = last ? fmtMin(Math.min(timeToMin(last.end) + 60, 22 * 60)) : '08:00'
    const end = fmtMin(Math.min(timeToMin(start) + 240, 23 * 60))
    setRows((rs) => [
      ...rs,
      {
        id: tempId--,
        weekday,
        specialty_id: specialties[0]?.id,
        start,
        end,
        type: 'presencial',
      },
    ])
  }

  const removeRow = (id) => setRows((rs) => rs.filter((r) => r.id !== id))

  const hasInvalid = rows.some((r) => timeToMin(r.end) <= timeToMin(r.start))

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await onSave(rows)
    } catch (err) {
      setError(err.detail || 'Não foi possível salvar os horários. Tente novamente.')
      setBusy(false)
    }
  }

  return (
    <Modal title="Horários de atendimento" onClose={onClose} wide>
      <p className="ag-form__hint">
        Defina os horários padrão de cada dia da semana e escolha se cada período
        é <strong>presencial</strong> ou <strong>online</strong>. As pacientes só
        conseguem agendar dentro desses períodos (ou em horários extras que você
        abrir na agenda).
      </p>
      <div className="ag-hours">
        {PY_WEEKDAY_LABELS.map((label, weekday) => (
          <div key={label} className="ag-hours__day">
            <div className="ag-hours__dayhead">
              <strong>{label}</strong>
              {byDay[weekday].length === 0 && <span className="ag-hours__closed">Fechado</span>}
            </div>
            {byDay[weekday].map((row) => {
              const invalid = timeToMin(row.end) <= timeToMin(row.start)
              return (
                <div key={row.id} className={`ag-hours__row${invalid ? ' is-invalid' : ''}`}>
                  <select
                    value={row.specialty_id}
                    onChange={(e) => updateRow(row.id, { specialty_id: Number(e.target.value) })}
                    aria-label="Especialidade"
                  >
                    {specialties.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={row.start}
                    step={300}
                    onChange={(e) => updateRow(row.id, { start: e.target.value })}
                    aria-label="Início"
                  />
                  <span className="ag-hours__sep">às</span>
                  <input
                    type="time"
                    value={row.end}
                    step={300}
                    onChange={(e) => updateRow(row.id, { end: e.target.value })}
                    aria-label="Fim"
                  />
                  <select
                    className="ag-hours__type"
                    value={row.type}
                    onChange={(e) => updateRow(row.id, { type: e.target.value })}
                    aria-label="Modalidade"
                  >
                    <option value="presencial">Presencial</option>
                    <option value="online">Online</option>
                  </select>
                  <button
                    type="button"
                    className="ag-iconbtn ag-iconbtn--danger"
                    onClick={() => removeRow(row.id)}
                    aria-label={`Remover horário de ${label}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                      <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              )
            })}
            <button type="button" className="ag-hours__add" onClick={() => addRow(weekday)}>
              + Adicionar horário
            </button>
          </div>
        ))}
      </div>
      {hasInvalid && (
        <p className="ag-form__error">Há horários com fim antes do início — corrija para salvar.</p>
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
          type="button"
          className="ag-btn ag-btn--primary"
          disabled={busy || hasInvalid}
          onClick={save}
        >
          {busy ? 'Salvando…' : 'Salvar horários'}
        </button>
      </div>
    </Modal>
  )
}
