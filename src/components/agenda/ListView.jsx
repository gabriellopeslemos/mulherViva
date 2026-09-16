import { useMemo, useState } from 'react'
import { fmtDayLabel } from './utils'

const STATUS_LABELS = {
  pending: 'Aguardando',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

const STATUS_FILTERS = [
  ['all', 'Todas'],
  ['confirmed', 'Confirmadas'],
  ['pending', 'Aguardando'],
  ['cancelled', 'Canceladas'],
]

export default function ListView({
  dateIso,
  appointments,
  specialtiesById,
  onOpen,
  onEdit,
  onCancel,
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')

  const dayAppts = useMemo(
    () =>
      appointments
        .filter((a) => a.date === dateIso)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [appointments, dateIso],
  )

  const active = dayAppts.filter((a) => a.status !== 'cancelled')
  const stats = [
    { label: 'Consultas no dia', value: active.length, tone: 'accent' },
    {
      label: 'Confirmadas',
      value: active.filter((a) => a.status === 'confirmed').length,
      tone: 'ok',
    },
    {
      label: 'Aguardando',
      value: active.filter((a) => a.status === 'pending').length,
      tone: 'warn',
    },
    {
      label: 'Online',
      value: active.filter((a) => a.type === 'online').length,
      tone: 'info',
    },
  ]

  const term = search.trim().toLowerCase()
  const filtered = dayAppts
    .filter((a) => statusFilter === 'all' || a.status === statusFilter)
    .filter((a) => typeFilter === 'all' || a.type === typeFilter)
    .filter(
      (a) =>
        !term ||
        a.client_name.toLowerCase().includes(term) ||
        (specialtiesById[a.specialty_id]?.name || '').toLowerCase().includes(term),
    )

  return (
    <div className="ag-list">
      <div className="ag-stats">
        {stats.map((s) => (
          <div key={s.label} className={`ag-stat ag-stat--${s.tone}`}>
            <span className="ag-stat__label">{s.label}</span>
            <strong className="ag-stat__value">{s.value}</strong>
          </div>
        ))}
      </div>

      <div className="ag-list__card">
        <div className="ag-list__toolbar">
          <div className="ag-list__title">
            <h3>Consultas do dia</h3>
            <span className="ag-details__when">{fmtDayLabel(dateIso)}</span>
          </div>
          <div className="ag-list__controls">
            <div className="ag-segment" role="radiogroup" aria-label="Modalidade">
              {[
                ['all', 'Todas'],
                ['presencial', 'Presencial'],
                ['online', 'Online'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={typeFilter === value}
                  className={typeFilter === value ? 'is-selected' : ''}
                  onClick={() => setTypeFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="ag-list__search"
              placeholder="Buscar paciente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar paciente"
            />
          </div>
        </div>

        <div className="ag-list__tabs" role="tablist" aria-label="Filtrar por status">
          {STATUS_FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={statusFilter === value}
              className={statusFilter === value ? 'is-active' : ''}
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="ag-list__empty">Nenhuma consulta encontrada.</p>
        ) : (
          <ul className="ag-list__rows">
            {filtered.map((a) => {
              const spec = specialtiesById[a.specialty_id]
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    className={`ag-list__row${a.status === 'cancelled' ? ' is-cancelled' : ''}`}
                    onClick={() => onOpen(a)}
                  >
                    <span className="ag-list__time">
                      {a.start_time.slice(0, 5)}
                      <em>{a.end_time.slice(0, 5)}</em>
                    </span>
                    <span className="ag-list__patient">
                      <strong>{a.client_name}</strong>
                      {spec && <small>{spec.name}</small>}
                    </span>
                    <span className={`ag-badge ag-badge--type`}>
                      {a.type === 'online' ? 'Online' : 'Presencial'}
                    </span>
                    <span className={`ag-badge ag-badge--${a.status}`}>
                      {STATUS_LABELS[a.status] || a.status}
                    </span>
                  </button>
                  <div className="ag-list__actions">
                    <button type="button" onClick={() => onEdit(a)}>
                      Editar
                    </button>
                    {a.status !== 'cancelled' && (
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => onCancel(a)}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
