import { useMemo } from 'react'
import { WEEKDAYS_SHORT, fmtTime, parseIso, startOfToday, toIso } from './utils'

const HEADER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
const MAX_CHIPS = 3

export default function MonthGrid({
  days,
  month,
  appointments,
  specialtiesById,
  onDayTap,
  onApptTap,
}) {
  const todayIso = toIso(startOfToday())

  const apptsByDay = useMemo(() => {
    const map = {}
    appointments.forEach((a) => {
      ;(map[a.date] ||= []).push(a)
    })
    Object.values(map).forEach((list) =>
      list.sort((a, b) => a.start_time.localeCompare(b.start_time)),
    )
    return map
  }, [appointments])

  const weeks = useMemo(() => {
    const out = []
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7))
    return out
  }, [days])

  return (
    <div className="ag-month">
      <div className="ag-month__head">
        {HEADER.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="ag-month__body">
        {weeks.map((week) => (
          <div key={week[0]} className="ag-month__week">
            {week.map((iso) => {
              const date = parseIso(iso)
              const outside = date.getMonth() !== month
              const appts = apptsByDay[iso] || []
              const extra = appts.length - MAX_CHIPS
              return (
                <div
                  key={iso}
                  role="button"
                  tabIndex={0}
                  className={`ag-month__day${outside ? ' is-outside' : ''}${iso === todayIso ? ' is-today' : ''}`}
                  onClick={() => onDayTap(date)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onDayTap(date)
                    }
                  }}
                  aria-label={`${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()}`}
                >
                  <span className="ag-month__num">{date.getDate()}</span>
                  <div className="ag-month__chips">
                    {appts.slice(0, MAX_CHIPS).map((appt) => (
                      <button
                        key={appt.id}
                        type="button"
                        className={`ag-month__chip ag-month__chip--${appt.status}`}
                        title={`${fmtTime(appt.start_time)} ${appt.client_name} — ${specialtiesById[appt.specialty_id]?.name || ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onApptTap(appt)
                        }}
                      >
                        <em>{fmtTime(appt.start_time)}</em> {appt.client_name}
                      </button>
                    ))}
                    {extra > 0 && <span className="ag-month__more">+{extra} mais</span>}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
