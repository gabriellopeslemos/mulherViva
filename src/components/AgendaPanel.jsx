import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import TimeGrid from './agenda/TimeGrid'
import ListView from './agenda/ListView'
import MonthGrid from './agenda/MonthGrid'
import {
  ApptDetails,
  ApptForm,
  ConfirmDialog,
  OverrideDetails,
  OverrideForm,
  ScheduleList,
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
  const [viewChoice, setView] = useState('week')
  const view = isMobile && viewChoice === 'week' ? 'day' : viewChoice
  const [anchor, setAnchor] = useState(startOfToday)
  const [appointments, setAppointments] = useState([])
  const [overrides, setOverrides] = useState([])
  const [rules, setRules] = useState([])
  const [periods, setPeriods] = useState([])
  // Vigência shown in the scheduler; lives here so it survives the confirm
  // dialogs that temporarily replace the scheduler modal.
  const [schedulePeriodId, setSchedulePeriodId] = useState(null)
  const [specialties, setSpecialties] = useState([])
  const [showCancelled, setShowCancelled] = useState(false)
  const [modal, setModal] = useState(null)
  const [conflictMove, setConflictMove] = useState(null)
  const [notifyOnCancel, setNotifyOnCancel] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [gcal, setGcal] = useState(null)

  const days = useMemo(() => {
    if (view === 'month') {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
      const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
      const start = startOfWeek(first)
      const end = addDays(startOfWeek(last), 6)
      const out = []
      for (let d = start; d <= end; d = addDays(d, 1)) out.push(toIso(d))
      return out
    }
    if (view !== 'week') return [toIso(anchor)]
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

  // Static data: specialties + vigências and their weekly rules.
  useEffect(() => {
    Promise.all([
      api.get('/api/admin/specialties', { auth: true }),
      api.get('/api/admin/availability/periods', { auth: true }),
      api.get('/api/admin/availability/rules', { auth: true }),
    ])
      .then(([specs, periodList, ruleList]) => {
        setSpecialties(specs.filter((s) => s.active))
        setPeriods(periodList)
        setRules(ruleList)
      })
      .catch((err) => {
        if (!guard(err)) setLoadError('Não foi possível carregar a agenda.')
      })
  }, [guard])

  const refreshGcalStatus = useCallback(() => {
    api
      .get('/api/admin/google-calendar/status', { auth: true })
      .then(setGcal)
      .catch((err) => guard(err))
  }, [guard])

  useEffect(() => {
    refreshGcalStatus()
    window.addEventListener('focus', refreshGcalStatus)
    return () => window.removeEventListener('focus', refreshGcalStatus)
  }, [refreshGcalStatus])

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
        notify_email: false,
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

  const setApptStatus = async (appt, status, notifyEmail = true) => {
    setBusy(true)
    try {
      const updated = await api.patch(
        `/api/admin/appointments/${appt.id}`,
        { status, notify_email: notifyEmail },
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
        const { notify_email: _notifyEmail, ...createPayload } = payload
        const created = await api.post('/api/admin/appointments', createPayload, { auth: true })
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

  // A 409 with a structured payload means confirmed appointments would fall
  // outside the effective schedule — ask, then `retry` with force; any other
  // error is reported as a toast.
  const handleScheduleError = (err, retry, fallback) => {
    if (guard(err)) return
    if (err.status === 409 && err.payload && typeof err.payload === 'object') {
      setModal({ type: 'confirm-schedule-orphans', warning: err.payload, retry })
    } else {
      showToast(err.detail || fallback, 'error')
    }
  }

  const reloadSchedule = async () => {
    const [periodList, ruleList] = await Promise.all([
      api.get('/api/admin/availability/periods', { auth: true }),
      api.get('/api/admin/availability/rules', { auth: true }),
    ])
    setPeriods(periodList)
    setRules(ruleList)
  }

  // The server copies the rules of the vigência it overlaps into the new one.
  const createPeriod = async (payload, force = false) => {
    setBusy(true)
    try {
      const created = await api.post(
        '/api/admin/availability/periods',
        { ...payload, force },
        { auth: true },
      )
      await reloadSchedule()
      setSchedulePeriodId(created.id)
      setModal({ type: 'schedules' })
      showToast('Janela de horário criada.')
    } catch (err) {
      handleScheduleError(
        err,
        () => createPeriod(payload, true),
        'Não foi possível criar a janela de horário.',
      )
    } finally {
      setBusy(false)
    }
  }

  const updatePeriod = async (period, patch, force = false) => {
    setBusy(true)
    try {
      const updated = await api.patch(
        `/api/admin/availability/periods/${period.id}`,
        { ...patch, force },
        { auth: true },
      )
      setPeriods((list) => list.map((p) => (p.id === period.id ? updated : p)))
      setModal({ type: 'schedules' })
      showToast('Janela de horário atualizada.')
    } catch (err) {
      handleScheduleError(
        err,
        () => updatePeriod(period, patch, true),
        'Não foi possível atualizar a janela de horário.',
      )
    } finally {
      setBusy(false)
    }
  }

  const deletePeriod = async (period) => {
    setBusy(true)
    try {
      await api.delete(`/api/admin/availability/periods/${period.id}`, { auth: true })
      setPeriods((list) => list.filter((p) => p.id !== period.id))
      setRules((list) => list.filter((r) => r.period_id !== period.id))
      setSchedulePeriodId(null)
      showToast('Janela de horário excluída.')
    } catch (err) {
      if (!guard(err)) showToast(err.detail || 'Não foi possível excluir.', 'error')
    } finally {
      setModal({ type: 'schedules' })
      setBusy(false)
    }
  }

  // New range on a day: the first free gap from 08:00 (up to 4h long), with
  // the local of the day's last range — tweak it inline afterwards.
  const addScheduleRule = async (periodId, weekday, dayRules) => {
    const taken = dayRules
      .map((r) => [timeToMin(r.start_time), timeToMin(r.end_time)])
      .sort((a, b) => a[0] - b[0])
    const lastMin = 23 * 60 + 30
    let start = 8 * 60
    let end = null
    for (const [s, e] of taken) {
      if (start + 60 <= s) {
        end = Math.min(start + 240, s)
        break
      }
      start = Math.max(start, e)
    }
    if (end === null && start + 60 <= lastMin) end = Math.min(start + 240, lastMin)
    if (end === null) {
      showToast('Não há espaço livre nesse dia para outro horário.', 'error')
      return
    }
    const periodRules = rules.filter((r) => r.period_id === periodId)
    const model = dayRules[dayRules.length - 1] || periodRules[periodRules.length - 1]
    setBusy(true)
    try {
      const created = await api.post(
        '/api/admin/availability/rules',
        {
          period_id: periodId,
          weekday,
          start_time: minToTime(start),
          end_time: minToTime(end),
          location: model?.location || 'presencial_bsb',
          also_online: model?.also_online || false,
          active: true,
        },
        { auth: true },
      )
      setRules((list) => [...list, created])
    } catch (err) {
      if (!guard(err)) showToast(err.detail || 'Não foi possível adicionar o horário.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const deleteSchedule = async (rule) => {
    setBusy(true)
    try {
      await api.delete(`/api/admin/availability/rules/${rule.id}`, { auth: true })
      setRules((list) => list.filter((r) => r.id !== rule.id))
      setModal({ type: 'schedules' })
      showToast('Programação excluída.')
    } catch (err) {
      if (!guard(err)) showToast(err.detail || 'Não foi possível excluir.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Inline edit (times or local) from the weekly scheduler.
  const updateScheduleRule = async (rule, patch, force = false) => {
    setBusy(true)
    try {
      const updated = await api.patch(
        `/api/admin/availability/rules/${rule.id}`,
        { ...patch, force },
        { auth: true },
      )
      setRules((list) => list.map((r) => (r.id === rule.id ? updated : r)))
      setModal({ type: 'schedules' })
      showToast('location' in patch ? 'Local atualizado.' : 'Horário atualizado.')
    } catch (err) {
      handleScheduleError(
        err,
        () => updateScheduleRule(rule, patch, true),
        'Não foi possível atualizar a programação.',
      )
    } finally {
      setBusy(false)
    }
  }

  // Copies each source rule (same vigência, specialty and local) onto the
  // target weekdays. Additive: rules that overlap an existing one on the
  // target day are rejected by the API and reported, never replaced.
  const copySchedules = async (sourceRules, targets) => {
    setBusy(true)
    const created = []
    let failed = 0
    try {
      for (const weekday of targets) {
        for (const r of sourceRules) {
          try {
            created.push(
              await api.post(
                '/api/admin/availability/rules',
                {
                  period_id: r.period_id,
                  weekday,
                  start_time: r.start_time,
                  end_time: r.end_time,
                  location: r.location,
                  also_online: r.also_online,
                  active: true,
                },
                { auth: true },
              ),
            )
          } catch (err) {
            if (guard(err)) return
            failed += 1
          }
        }
      }
    } finally {
      if (created.length) setRules((list) => [...list, ...created])
      setBusy(false)
    }
    if (failed === 0) {
      showToast(`${created.length} horário(s) copiado(s).`)
    } else {
      showToast(
        `${created.length} copiado(s), ${failed} ignorado(s) por conflito com horários existentes.`,
        created.length ? 'ok' : 'error',
      )
    }
  }

  const clearScheduleDay = async (dayRules) => {
    setBusy(true)
    let removed = 0
    try {
      for (const r of dayRules) {
        await api.delete(`/api/admin/availability/rules/${r.id}`, { auth: true })
        removed += 1
        setRules((list) => list.filter((x) => x.id !== r.id))
      }
      showToast('Dia desativado.')
    } catch (err) {
      if (!guard(err)) {
        showToast(
          err.detail || `Não foi possível remover tudo (${removed} de ${dayRules.length}).`,
          'error',
        )
      }
    } finally {
      setModal({ type: 'schedules' })
      setBusy(false)
    }
  }

  /* ---------- header labels & navigation ---------- */

  const navStep = view === 'week' ? 7 : 1
  const goToday = () => setAnchor(startOfToday())
  const navigate = (dir) =>
    setAnchor((d) =>
      view === 'month'
        ? new Date(d.getFullYear(), d.getMonth() + dir, 1)
        : addDays(d, dir * navStep),
    )

  const rangeLabel = useMemo(() => {
    if (view === 'month') {
      return `${MONTHS_LONG[anchor.getMonth()]} de ${anchor.getFullYear()}`
    }
    if (view !== 'week') {
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

  const connectGoogleCalendar = async () => {
    try {
      const { auth_url } = await api.post('/api/admin/google-calendar/connect', null, {
        auth: true,
      })
      window.open(auth_url, '_blank', 'noopener')
      showToast('Conclua a autorização na nova aba.')
    } catch (err) {
      if (!guard(err)) showToast(err.detail || 'Não foi possível conectar.', 'error')
    }
  }

  const disconnectGoogleCalendar = async () => {
    setBusy(true)
    try {
      await api.delete('/api/admin/google-calendar/connection', { auth: true })
      setModal(null)
      refreshGcalStatus()
      showToast('Google Agenda desconectada.')
    } catch (err) {
      if (!guard(err)) showToast(err.detail || 'Não foi possível desconectar.', 'error')
    } finally {
      setBusy(false)
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

        {view !== 'list' && (
        <div className="ag-topbar__nav">
          <button
            type="button"
            className="ag-iconbtn"
            onClick={() => navigate(-1)}
            aria-label={
              view === 'month' ? 'Mês anterior' : view === 'week' ? 'Semana anterior' : 'Dia anterior'
            }
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m14.5 6-6 6 6 6" />
            </svg>
          </button>
          <div className="ag-segment" role="radiogroup" aria-label="Período">
            {[
              ['week', isMobile ? 'Dia' : 'Semana'],
              ['month', 'Mês'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={value === 'month' ? view === 'month' : view !== 'month'}
                className={
                  (value === 'month' ? view === 'month' : view !== 'month') ? 'is-selected' : ''
                }
                onClick={() => setView(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ag-iconbtn"
            onClick={() => navigate(1)}
            aria-label={
              view === 'month' ? 'Próximo mês' : view === 'week' ? 'Próxima semana' : 'Próximo dia'
            }
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9.5 6 6 6-6 6" />
            </svg>
          </button>
        </div>
        )}

        <div className="ag-topbar__right">
          <div className="ag-segment ag-segment--views" role="radiogroup" aria-label="Visualização">
              {[
                ['list', 'Consultas'],
                ['week', 'Calendário'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={value === 'list' ? view === 'list' : view !== 'list'}
                  className={
                    (value === 'list' ? view === 'list' : view !== 'list') ? 'is-selected' : ''
                  }
                  onClick={() => setView(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          <button
            type="button"
            className="ag-btn ag-btn--ghost ag-btn--sm"
            onClick={() => setModal({ type: 'schedules' })}
            aria-label="Programações"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </svg>
            <span className="ag-hide-mobile">Programações</span>
          </button>
          {gcal?.configured && (
            <button
              type="button"
              className="ag-btn ag-btn--ghost ag-btn--sm"
              onClick={() =>
                gcal.connected
                  ? setModal({ type: 'gcal-disconnect' })
                  : connectGoogleCalendar()
              }
            >
              {gcal.connected ? 'Google Agenda conectada' : 'Conectar Google Agenda'}
            </button>
          )}
          {!isMobile && (
            <button type="button" className="ag-btn ag-btn--primary ag-btn--sm" onClick={openNewAppt}>
              + Nova consulta
            </button>
          )}
        </div>
      </header>

      {isMobile && view === 'day' && (
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

      {view !== 'list' && (
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
        <div className="ag-legend__right">
          <button type="button" className="ag-legend__today" onClick={goToday}>
            Ir para data de hoje
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9.5 6 15.5 12 9.5 18" />
            </svg>
          </button>
          <label className="ag-legend__toggle">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
            />
            Mostrar canceladas
          </label>
        </div>
      </div>
      )}

      {loadError ? (
        <div className="ag-empty">
          <p>{loadError}</p>
          <button type="button" className="ag-btn ag-btn--primary" onClick={refresh}>
            Tentar novamente
          </button>
        </div>
      ) : view === 'list' ? (
        <ListView
          dateIso={toIso(anchor)}
          appointments={appointments}
          specialtiesById={specialtiesById}
          onOpen={(appt) => setModal({ type: 'appt-details', appt })}
          onEdit={(appt) => setModal({ type: 'appt-form', initial: appt, editId: appt.id })}
          onCancel={(appt) => {
            setNotifyOnCancel(true)
            setModal({ type: 'confirm-cancel', appt })
          }}
        />
      ) : view === 'month' ? (
        <MonthGrid
          days={days}
          month={anchor.getMonth()}
          appointments={visibleAppointments}
          specialtiesById={specialtiesById}
          onDayTap={(date) => {
            setAnchor(date)
            setView('week')
          }}
          onApptTap={(appt) => setModal({ type: 'appt-details', appt })}
        />
      ) : (
        <TimeGrid
          days={days}
          startMin={gridStart}
          endMin={gridEnd}
          appointments={visibleAppointments}
          overrides={overrides}
          periods={periods}
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
          onCancelAppt={() => {
            setNotifyOnCancel(true)
            setModal({ type: 'confirm-cancel', appt: modal.appt })
          }}
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

      {modal?.type === 'confirm-cancel' && (
        <ConfirmDialog
          title="Cancelar consulta"
          message={`Marcar a consulta de ${modal.appt.client_name} em ${fmtDayLabel(modal.appt.date)} como cancelada?`}
          confirmLabel="Marcar como cancelada"
          danger
          busy={busy}
          onConfirm={() => setApptStatus(modal.appt, 'cancelled', notifyOnCancel)}
          onCancel={() => setModal({ type: 'appt-details', appt: modal.appt })}
          notifyCheckbox={
            modal.appt.client_email
              ? {
                  checked: notifyOnCancel,
                  onChange: setNotifyOnCancel,
                  label: 'Avisar a paciente por e-mail',
                }
              : null
          }
        />
      )}

      {modal?.type === 'gcal-disconnect' && (
        <ConfirmDialog
          title="Google Agenda"
          message={`Conectado como ${gcal?.email}. Desconectar? Novas consultas deixarão de ser criadas na agenda até reconectar.`}
          confirmLabel="Desconectar"
          danger
          busy={busy}
          onConfirm={disconnectGoogleCalendar}
          onCancel={() => setModal(null)}
        />
      )}

      {modal?.type === 'schedules' && (
        <ScheduleList
          periods={periods}
          rules={rules}
          selectedId={schedulePeriodId}
          onSelect={setSchedulePeriodId}
          busy={busy}
          onCreatePeriod={createPeriod}
          onUpdatePeriod={updatePeriod}
          onDeletePeriod={(period) => setModal({ type: 'confirm-delete-period', period })}
          onAdd={addScheduleRule}
          onDelete={deleteSchedule}
          onUpdateRule={updateScheduleRule}
          onCopy={copySchedules}
          onClearDay={(_weekday, dayRules) => clearScheduleDay(dayRules)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'confirm-schedule-orphans' && (
        <ConfirmDialog
          title="Consultas fora do novo horário"
          message={`${modal.warning.message} (${modal.warning.appointments?.length ?? 0} consulta(s) afetada(s)). Salvar mesmo assim?`}
          confirmLabel="Salvar mesmo assim"
          danger
          busy={busy}
          onConfirm={modal.retry}
          onCancel={() => setModal({ type: 'schedules' })}
        />
      )}

      {modal?.type === 'confirm-delete-period' && (
        <ConfirmDialog
          title="Excluir janela de horário"
          message="Excluir essa janela de horário e todos os horários dela? Nas datas que ela cobria, volta a valer a janela mais ampla (se houver). Consultas já marcadas não são canceladas."
          confirmLabel="Excluir janela"
          danger
          busy={busy}
          onConfirm={() => deletePeriod(modal.period)}
          onCancel={() => setModal({ type: 'schedules' })}
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
