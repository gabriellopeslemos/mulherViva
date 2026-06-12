import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import TimeGrid from './agenda/TimeGrid'
import {
  ApptDetails,
  ApptForm,
  ConfirmDialog,
  HoursEditor,
  OverrideDetails,
  OverrideForm,
  SlotActions,
} from './agenda/Sheets'
import {
  MONTHS_LONG,
  MONTHS_SHORT,
  addDays,
  fmtDayLabel,
  fmtMin,
  minToTime,
  parseIso,
  snap,
  startOfToday,
  startOfWeek,
  timeToMin,
  toIso,
} from './agenda/utils'
import '../styles/agenda.css'

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export default function AgendaPanel({ onClose, onAuthExpired }) {
  const isMobile = useMediaQuery('(max-width: 760px)')
  const [viewChoice, setView] = useState(() =>
    window.matchMedia('(max-width: 760px)').matches ? 'day' : 'week',
  )
  const view = isMobile ? 'day' : viewChoice
  const [anchor, setAnchor] = useState(startOfToday)
  const [appointments, setAppointments] = useState([])
  const [overrides, setOverrides] = useState([])
  const [rules, setRules] = useState([])
  const [specialties, setSpecialties] = useState([])
  const [showCancelled, setShowCancelled] = useState(false)
  const [modal, setModal] = useState(null)
  const [conflictMove, setConflictMove] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)

  const days = useMemo(() => {
    if (view === 'day') return [toIso(anchor)]
    const monday = startOfWeek(anchor)
    return Array.from({ length: 7 }, (_, i) => toIso(addDays(monday, i)))
  }, [anchor, view])

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

  // Static data: specialties + weekly rules.
  useEffect(() => {
    Promise.all([
      api.get('/api/admin/specialties', { auth: true }),
      api.get('/api/admin/availability/rules', { auth: true }),
    ])
      .then(([specs, ruleList]) => {
        setSpecialties(specs.filter((s) => s.active))
        setRules(ruleList)
      })
      .catch((err) => {
        if (!guard(err)) setLoadError('Não foi possível carregar a agenda.')
      })
  }, [guard])

  // Range data: appointments + overrides for the visible days.
  const rangeKey = `${days[0]}:${days[days.length - 1]}`
  useEffect(() => {
    let alive = true
    const [from, to] = [days[0], days[days.length - 1]]
    Promise.all([
      api.get(`/api/admin/appointments?date_from=${from}&date_to=${to}`, { auth: true }),
      api.get(`/api/admin/availability/overrides?date_from=${from}&date_to=${to}`, {
        auth: true,
      }),
    ])
      .then(([appts, ovs]) => {
        if (!alive) return
        setAppointments(appts)
        setOverrides(ovs)
        setLoadError(null)
      })
      .catch((err) => {
        if (alive && !guard(err)) setLoadError('Não foi possível carregar a agenda.')
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, guard, reloadTick])

  const refresh = useCallback(() => setReloadTick((t) => t + 1), [])

  const specialtiesById = useMemo(
    () => Object.fromEntries(specialties.map((s) => [s.id, s])),
    [specialties],
  )

  const visibleAppointments = useMemo(
    () => appointments.filter((a) => showCancelled || a.status !== 'cancelled'),
    [appointments, showCancelled],
  )

  const pendingCount = useMemo(
    () => appointments.filter((a) => a.status === 'pending').length,
    [appointments],
  )

  // Full 00:00–24:00 day; the grid scrolls vertically.
  const gridStart = 0
  const gridEnd = 24 * 60

  /* ---------- actions ---------- */

  const moveAppointment = useCallback(
    async (appt, newDate, newStartMin, force = false) => {
      const dur = timeToMin(appt.end_time) - timeToMin(appt.start_time)
      const payload = {
        date: newDate,
        start_time: minToTime(newStartMin),
        end_time: minToTime(newStartMin + dur),
        force,
      }
      const prev = appointments
      setAppointments((list) =>
        list.map((a) => (a.id === appt.id ? { ...a, ...payload } : a)),
      )
      try {
        const updated = await api.patch(`/api/admin/appointments/${appt.id}`, payload, {
          auth: true,
        })
        setAppointments((list) => list.map((a) => (a.id === appt.id ? updated : a)))
        showToast(
          `Consulta de ${appt.client_name} movida para ${fmtDayLabel(newDate)}, ${fmtMin(newStartMin)}.`,
        )
      } catch (err) {
        setAppointments(prev)
        if (guard(err)) return
        if (err.status === 409 && !force) {
          setConflictMove({ appt, newDate, newStartMin })
        } else {
          showToast(err.detail || 'Não foi possível mover a consulta.', 'error')
        }
      }
    },
    [appointments, guard, showToast],
  )

  const setApptStatus = async (appt, status) => {
    setBusy(true)
    try {
      const updated = await api.patch(
        `/api/admin/appointments/${appt.id}`,
        { status },
        { auth: true },
      )
      setAppointments((list) => list.map((a) => (a.id === appt.id ? updated : a)))
      setModal(null)
      showToast(
        status === 'confirmed' ? 'Consulta confirmada.' : 'Consulta marcada como cancelada.',
      )
    } catch (err) {
      if (!guard(err)) showToast(err.detail || 'Não foi possível atualizar.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const deleteAppt = async (appt) => {
    setBusy(true)
    try {
      await api.delete(`/api/admin/appointments/${appt.id}`, { auth: true })
      setAppointments((list) => list.filter((a) => a.id !== appt.id))
      setModal(null)
      showToast('Consulta excluída.')
    } catch (err) {
      if (!guard(err)) showToast(err.detail || 'Não foi possível excluir.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const submitAppt = async (payload, existingId) => {
    try {
      if (existingId) {
        const updated = await api.patch(
          `/api/admin/appointments/${existingId}`,
          payload,
          { auth: true },
        )
        setAppointments((list) => list.map((a) => (a.id === existingId ? updated : a)))
        showToast('Consulta atualizada.')
      } else {
        const created = await api.post('/api/admin/appointments', payload, { auth: true })
        if (days.includes(created.date)) setAppointments((list) => [...list, created])
        showToast('Consulta criada.')
      }
      setModal(null)
      refresh()
    } catch (err) {
      if (guard(err)) return
      throw err
    }
  }

  const submitOverride = async (payload) => {
    try {
      const created = await api.post('/api/admin/availability/overrides', payload, {
        auth: true,
      })
      if (days.includes(created.date)) setOverrides((list) => [...list, created])
      setModal(null)
      showToast(payload.kind === 'block' ? 'Horário bloqueado.' : 'Horário extra aberto.')
      refresh()
    } catch (err) {
      if (guard(err)) return
      throw err
    }
  }

  const deleteOverride = async (ov) => {
    setBusy(true)
    try {
      await api.delete(`/api/admin/availability/overrides/${ov.id}`, { auth: true })
      setOverrides((list) => list.filter((o) => o.id !== ov.id))
      setModal(null)
      showToast(ov.kind === 'block' ? 'Bloqueio removido.' : 'Horário extra removido.')
    } catch (err) {
      if (!guard(err)) showToast(err.detail || 'Não foi possível remover.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveHours = async (rows) => {
    const prevById = Object.fromEntries(rules.map((r) => [r.id, r]))
    const keptIds = new Set(rows.filter((r) => r.id > 0).map((r) => r.id))
    const calls = []
    rules.forEach((r) => {
      if (!keptIds.has(r.id)) {
        calls.push(api.delete(`/api/admin/availability/rules/${r.id}`, { auth: true }))
      }
    })
    rows.forEach((row) => {
      const payload = {
        specialty_id: row.specialty_id,
        weekday: row.weekday,
        start_time: minToTime(timeToMin(row.start)),
        end_time: minToTime(timeToMin(row.end)),
        type: row.type,
        active: true,
      }
      if (row.id > 0) {
        const prev = prevById[row.id]
        const changed =
          prev.specialty_id !== payload.specialty_id ||
          prev.weekday !== payload.weekday ||
          timeToMin(prev.start_time) !== timeToMin(payload.start_time) ||
          timeToMin(prev.end_time) !== timeToMin(payload.end_time) ||
          prev.type !== payload.type ||
          !prev.active
        if (changed) {
          calls.push(
            api.patch(`/api/admin/availability/rules/${row.id}`, payload, { auth: true }),
          )
        }
      } else {
        calls.push(api.post('/api/admin/availability/rules', payload, { auth: true }))
      }
    })
    try {
      await Promise.all(calls)
    } catch (err) {
      if (guard(err)) return
      throw err
    }
    const fresh = await api.get('/api/admin/availability/rules', { auth: true })
    setRules(fresh)
    setModal(null)
    showToast('Horários de atendimento salvos.')
  }

  /* ---------- header labels & navigation ---------- */

  const navStep = view === 'day' ? 1 : 7
  const goToday = () => setAnchor(startOfToday())

  const rangeLabel = useMemo(() => {
    if (view === 'day') {
      const d = anchor
      return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`
    }
    const first = parseIso(days[0])
    const last = parseIso(days[6])
    if (first.getMonth() === last.getMonth()) {
      return `${first.getDate()} – ${last.getDate()} de ${MONTHS_LONG[first.getMonth()]} ${last.getFullYear()}`
    }
    return `${first.getDate()} ${MONTHS_SHORT[first.getMonth()]} – ${last.getDate()} ${MONTHS_SHORT[last.getMonth()]} ${last.getFullYear()}`
  }, [anchor, days, view])

  const dayStrip = useMemo(() => {
    if (!isMobile) return []
    const base = addDays(startOfToday(), -1)
    return Array.from({ length: 21 }, (_, i) => addDays(base, i))
  }, [isMobile])

  /* ---------- modal helpers ---------- */

  const defaultNewApptInitial = (dateIso, startMin) => {
    const spec = specialties[0]
    const dur = spec?.slot_duration_min || 60
    return {
      date: dateIso,
      start_time: minToTime(startMin),
      end_time: minToTime(Math.min(startMin + dur, 23 * 60 + 59)),
    }
  }

  const openNewAppt = () => {
    const now = new Date()
    const startMin = snap(now.getHours() * 60 + now.getMinutes() + 60, 30)
    setModal({
      type: 'appt-form',
      initial: defaultNewApptInitial(toIso(anchor), Math.min(startMin, 22 * 60)),
    })
  }

  return (
    <div className="ag-root" role="dialog" aria-modal="true" aria-label="Agenda da clínica">
      <header className="ag-topbar">
        <div className="ag-topbar__left">
          <button type="button" className="ag-iconbtn" onClick={onClose} aria-label="Fechar agenda">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <div className="ag-topbar__title">
            <h2>Agenda</h2>
            <span>{rangeLabel}</span>
          </div>
        </div>

        <div className="ag-topbar__nav">
          <button
            type="button"
            className="ag-iconbtn"
            onClick={() => setAnchor((d) => addDays(d, -navStep))}
            aria-label={view === 'day' ? 'Dia anterior' : 'Semana anterior'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m14.5 6-6 6 6 6" />
            </svg>
          </button>
          <button type="button" className="ag-btn ag-btn--ghost ag-btn--sm" onClick={goToday}>
            Hoje
          </button>
          <button
            type="button"
            className="ag-iconbtn"
            onClick={() => setAnchor((d) => addDays(d, navStep))}
            aria-label={view === 'day' ? 'Próximo dia' : 'Próxima semana'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9.5 6 6 6-6 6" />
            </svg>
          </button>
        </div>

        <div className="ag-topbar__right">
          {!isMobile && (
            <div className="ag-segment ag-segment--views" role="radiogroup" aria-label="Visualização">
              {[
                ['day', 'Dia'],
                ['week', 'Semana'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={view === value}
                  className={view === value ? 'is-selected' : ''}
                  onClick={() => setView(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="ag-btn ag-btn--ghost ag-btn--sm"
            onClick={() => setModal({ type: 'hours' })}
            aria-label="Horários de atendimento"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </svg>
            <span className="ag-hide-mobile">Horários de atendimento</span>
          </button>
          {!isMobile && (
            <button type="button" className="ag-btn ag-btn--primary ag-btn--sm" onClick={openNewAppt}>
              + Nova consulta
            </button>
          )}
        </div>
      </header>

      {isMobile && (
        <div className="ag-daystrip" role="tablist" aria-label="Escolher dia">
          {dayStrip.map((d) => {
            const iso = toIso(d)
            const isActive = iso === toIso(anchor)
            const isToday = iso === toIso(startOfToday())
            return (
              <button
                key={iso}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`ag-daystrip__day${isActive ? ' is-active' : ''}${isToday ? ' is-today' : ''}`}
                onClick={() => setAnchor(d)}
              >
                <span>{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()]}</span>
                <strong>{d.getDate()}</strong>
              </button>
            )
          })}
        </div>
      )}

      <div className="ag-legend">
        <span className="ag-legend__item">
          <i className="ag-legend__dot ag-legend__dot--confirmed" /> Confirmada
        </span>
        <span className="ag-legend__item">
          <i className="ag-legend__dot ag-legend__dot--pending" /> Aguardando
          {pendingCount > 0 && <em className="ag-legend__count">{pendingCount}</em>}
        </span>
        <span className="ag-legend__item">
          <i className="ag-legend__dot ag-legend__dot--block" /> Bloqueado
        </span>
        <span className="ag-legend__item">
          <i className="ag-legend__dot ag-legend__dot--open" /> Extra
        </span>
        <label className="ag-legend__toggle">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
          />
          Mostrar canceladas
        </label>
      </div>

      {loadError ? (
        <div className="ag-empty">
          <p>{loadError}</p>
          <button type="button" className="ag-btn ag-btn--primary" onClick={refresh}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <TimeGrid
          days={days}
          startMin={gridStart}
          endMin={gridEnd}
          appointments={visibleAppointments}
          overrides={overrides}
          rules={rules}
          specialtiesById={specialtiesById}
          onApptTap={(appt) => setModal({ type: 'appt-details', appt })}
          onOverrideTap={(ov) => setModal({ type: 'override-details', ov })}
          onEmptyTap={(dateIso, startMin) =>
            setModal({ type: 'slot-actions', dateIso, startMin })
          }
          onMove={moveAppointment}
        />
      )}

      {isMobile && (
        <button type="button" className="ag-fab" onClick={openNewAppt} aria-label="Nova consulta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {/* ---------- modals ---------- */}

      {modal?.type === 'appt-details' && (
        <ApptDetails
          appt={appointments.find((a) => a.id === modal.appt.id) || modal.appt}
          specialty={specialtiesById[modal.appt.specialty_id]}
          busy={busy}
          onStatus={(status) => setApptStatus(modal.appt, status)}
          onEdit={() =>
            setModal({ type: 'appt-form', initial: modal.appt, editId: modal.appt.id })
          }
          onDelete={() => setModal({ type: 'confirm-delete', appt: modal.appt })}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'appt-form' && (
        <ApptForm
          title={modal.editId ? 'Editar consulta' : 'Nova consulta'}
          initial={modal.initial}
          specialties={specialties}
          onSubmit={(payload) => submitAppt(payload, modal.editId)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'slot-actions' && (
        <SlotActions
          dateIso={modal.dateIso}
          startMin={modal.startMin}
          onCreate={() =>
            setModal({
              type: 'appt-form',
              initial: defaultNewApptInitial(modal.dateIso, modal.startMin),
            })
          }
          onBlock={() =>
            setModal({
              type: 'override-form',
              kind: 'block',
              initial: { date: modal.dateIso, startMin: modal.startMin },
            })
          }
          onOpen={() =>
            setModal({
              type: 'override-form',
              kind: 'open',
              initial: { date: modal.dateIso, startMin: modal.startMin },
            })
          }
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'override-form' && (
        <OverrideForm
          kind={modal.kind}
          initial={modal.initial}
          specialties={specialties}
          onSubmit={submitOverride}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'override-details' && (
        <OverrideDetails
          ov={modal.ov}
          specialty={modal.ov.specialty_id ? specialtiesById[modal.ov.specialty_id] : null}
          busy={busy}
          onDelete={() => deleteOverride(modal.ov)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'confirm-delete' && (
        <ConfirmDialog
          title="Excluir consulta"
          message={`Excluir definitivamente a consulta de ${modal.appt.client_name} em ${fmtDayLabel(modal.appt.date)}? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          danger
          busy={busy}
          onConfirm={() => deleteAppt(modal.appt)}
          onCancel={() => setModal({ type: 'appt-details', appt: modal.appt })}
        />
      )}

      {modal?.type === 'hours' && (
        <HoursEditor
          rules={rules}
          specialties={specialties}
          onSave={saveHours}
          onClose={() => setModal(null)}
        />
      )}

      {conflictMove && (
        <ConfirmDialog
          title="Horário ocupado"
          message={`Já existe uma consulta nesse horário. Mover a consulta de ${conflictMove.appt.client_name} mesmo assim?`}
          confirmLabel="Mover mesmo assim"
          danger
          onConfirm={() => {
            const { appt, newDate, newStartMin } = conflictMove
            setConflictMove(null)
            moveAppointment(appt, newDate, newStartMin, true)
          }}
          onCancel={() => setConflictMove(null)}
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
