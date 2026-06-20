import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const STATUS_LABELS = {
  pending: 'Aguardando confirmação',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Realizada',
  no_show: 'Não compareceu',
}

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

function formatLongDate(iso) {
  return parseIsoDate(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function ManageBooking({ token, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('view') // view | reschedule | done
  const [days, setDays] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [resultMsg, setResultMsg] = useState(null)

  useEffect(() => {
    api
      .get(`/api/bookings/manage/${token}`)
      .then(setData)
      .catch((err) =>
        setError(err.status === 404 ? 'Agendamento não encontrado.' : 'Não foi possível carregar o agendamento.'),
      )
  }, [token])

  const loadSlots = () => {
    setMode('reschedule')
    setDays(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    setActionError(null)
    const from = new Date()
    const to = new Date()
    to.setDate(to.getDate() + 13)
    api
      .get(`/api/bookings/manage/${token}/slots?date_from=${toIsoDate(from)}&date_to=${toIsoDate(to)}`)
      .then((d) => setDays(d.days))
      .catch(() => setActionError('Não foi possível carregar os horários.'))
  }

  const selectedDay = useMemo(() => days?.find((d) => d.date === selectedDate) || null, [days, selectedDate])

  const handleCancel = async () => {
    setBusy(true)
    setActionError(null)
    try {
      const updated = await api.post(`/api/bookings/manage/${token}/cancel`)
      setData(updated)
      setResultMsg('Sua consulta foi cancelada. Enviamos um e-mail de confirmação.')
      setMode('done')
    } catch (err) {
      setActionError(err.detail || 'Não foi possível cancelar.')
    } finally {
      setBusy(false)
    }
  }

  const handleReschedule = async () => {
    if (!selectedSlot) return
    setBusy(true)
    setActionError(null)
    try {
      const updated = await api.post(`/api/bookings/manage/${token}/reschedule`, {
        date: selectedDate,
        start: selectedSlot.start,
      })
      setData(updated)
      setResultMsg('Sua consulta foi reagendada com sucesso.')
      setMode('done')
    } catch (err) {
      if (err.status === 409) {
        setActionError('Esse horário acabou de ser reservado. Escolha outro.')
        loadSlots()
      } else {
        setActionError(err.detail || 'Não foi possível reagendar.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="manage-overlay">
      <div className="manage-card">
        <button className="manage-close" type="button" onClick={onClose} aria-label="Fechar">
          ×
        </button>

        {error ? (
          <>
            <h2>Ops!</h2>
            <p>{error}</p>
          </>
        ) : !data ? (
          <p>Carregando...</p>
        ) : mode === 'done' ? (
          <>
            <h2>Pronto!</h2>
            <p>{resultMsg}</p>
            {data.status !== 'cancelled' && (
              <p className="manage-detail">
                {`${formatLongDate(data.date)} às ${data.start_time.slice(0, 5)}`}
              </p>
            )}
            <button className="btn btn-outline" type="button" onClick={onClose}>
              Voltar ao site
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow">Gerenciar agendamento</p>
            <h2>{data.specialty_name}</h2>
            <p className="manage-detail">
              {`${formatLongDate(data.date)} às ${data.start_time.slice(0, 5)} · `}
              <strong>{STATUS_LABELS[data.status] || data.status}</strong>
            </p>

            {!data.can_modify ? (
              <p className="manage-note">
                Este agendamento não pode mais ser alterado online (prazo de {data.cancellation_window_hours}h antes da
                consulta). Entre em contato conosco para qualquer mudança.
              </p>
            ) : mode === 'view' ? (
              <div className="manage-actions">
                <button className="btn btn-primary" type="button" onClick={loadSlots}>
                  Reagendar
                </button>
                <button className="btn btn-outline manage-danger" type="button" onClick={handleCancel} disabled={busy}>
                  {busy ? 'Cancelando...' : 'Cancelar consulta'}
                </button>
              </div>
            ) : (
              <div className="manage-reschedule">
                <span className="booking-step__label">Escolha um novo horário</span>
                {!days && <p className="booking-hint">Carregando horários...</p>}
                {days && days.every((d) => d.slots.length === 0) && (
                  <p className="booking-hint">Sem horários disponíveis nos próximos 14 dias.</p>
                )}
                {days && (
                  <div className="booking-chips">
                    {days.map((d) => {
                      const date = parseIsoDate(d.date)
                      return (
                        <button
                          key={d.date}
                          type="button"
                          disabled={!d.slots.length}
                          className={`booking-chip booking-chip--day${selectedDate === d.date ? ' is-selected' : ''}`}
                          onClick={() => {
                            setSelectedDate(d.date)
                            setSelectedSlot(null)
                          }}
                        >
                          <span className="booking-chip__weekday">{WEEKDAY_LABELS[date.getDay()]}</span>
                          <span className="booking-chip__date">
                            {date.getDate()} {MONTH_LABELS[date.getMonth()]}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {selectedDay && (
                  <div className="booking-chips">
                    {selectedDay.slots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        className={`booking-chip${selectedSlot?.start === slot.start ? ' is-selected' : ''}`}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {slot.start.slice(0, 5)}
                      </button>
                    ))}
                  </div>
                )}
                <div className="manage-actions">
                  <button className="btn btn-primary" type="button" onClick={handleReschedule} disabled={!selectedSlot || busy}>
                    {busy ? 'Salvando...' : 'Confirmar novo horário'}
                  </button>
                  <button className="btn btn-outline" type="button" onClick={() => setMode('view')}>
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {actionError && <p className="booking-error">{actionError}</p>}
          </>
        )}
      </div>
    </div>
  )
}
