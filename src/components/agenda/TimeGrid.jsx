import { useEffect, useMemo, useRef, useState } from 'react'
import {
  WEEKDAYS_SHORT,
  MONTHS_SHORT,
  parseIso,
  toIso,
  timeToMin,
  fmtMin,
  fmtTime,
  snap,
  clamp,
  pyWeekday,
  layoutOverlaps,
  mergeIntervals,
  startOfToday,
  STATUS_LABELS,
} from './utils'

export const HOUR_H = 64
const SNAP_MIN = 15
const TOUCH_HOLD_MS = 280
const DRAG_START_PX = 5

function apptTop(startTime, gridStartMin) {
  return ((timeToMin(startTime) - gridStartMin) / 60) * HOUR_H
}

function durationPx(startTime, endTime) {
  return Math.max(((timeToMin(endTime) - timeToMin(startTime)) / 60) * HOUR_H - 2, 26)
}

export default function TimeGrid({
  days,
  startMin,
  endMin,
  appointments,
  overrides,
  rules,
  specialtiesById,
  onApptTap,
  onOverrideTap,
  onEmptyTap,
  onMove,
}) {
  const scrollRef = useRef(null)
  const colsRef = useRef(null)
  const dragRef = useRef(null)
  const suppressClickRef = useRef(false)
  const [drag, setDrag] = useState(null)
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })

  const totalH = ((endMin - startMin) / 60) * HOUR_H
  const todayIso = toIso(startOfToday())

  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date()
      setNowMin(n.getHours() * 60 + n.getMinutes())
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // Block page scroll while a drag is active (touch).
  useEffect(() => {
    const blocker = (e) => {
      if (dragRef.current?.active) e.preventDefault()
    }
    document.addEventListener('touchmove', blocker, { passive: false })
    return () => document.removeEventListener('touchmove', blocker)
  }, [])

  // Scroll to the first relevant hour on mount / day change: earliest
  // appointment, else the earliest work-hour start, else 07:00.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const firstAppt = appointments
      .filter((a) => days.includes(a.date))
      .reduce((min, a) => Math.min(min, timeToMin(a.start_time)), Infinity)
    const firstRule = days.reduce((min, iso) => {
      const wd = pyWeekday(parseIso(iso))
      rules
        .filter((r) => r.active && r.weekday === wd)
        .forEach((r) => {
          min = Math.min(min, timeToMin(r.start_time))
        })
      return min
    }, Infinity)
    const target = Number.isFinite(firstAppt)
      ? firstAppt
      : Number.isFinite(firstRule)
        ? firstRule
        : 7 * 60
    el.scrollTop = Math.max(((target - startMin) / 60) * HOUR_H - 24, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(',')])

  const apptsByDay = useMemo(() => {
    const map = {}
    days.forEach((d) => {
      map[d] = []
    })
    appointments.forEach((a) => {
      if (map[a.date]) map[a.date].push(a)
    })
    return map
  }, [appointments, days])

  const placements = useMemo(() => {
    const map = {}
    days.forEach((d) => {
      map[d] = layoutOverlaps(apptsByDay[d])
    })
    return map
  }, [apptsByDay, days])

  const workBandsByDay = useMemo(() => {
    const map = {}
    days.forEach((iso) => {
      const wd = pyWeekday(parseIso(iso))
      const intervals = rules
        .filter((r) => r.active && r.weekday === wd)
        .map((r) => [timeToMin(r.start_time), timeToMin(r.end_time)])
      map[iso] = mergeIntervals(intervals)
    })
    return map
  }, [days, rules])

  const overridesByDay = useMemo(() => {
    const map = {}
    days.forEach((d) => {
      map[d] = []
    })
    overrides.forEach((o) => {
      if (map[o.date]) map[o.date].push(o)
    })
    return map
  }, [overrides, days])

  const hours = []
  for (let m = startMin; m < endMin; m += 60) hours.push(m)

  function computeTarget(e) {
    const rect = colsRef.current.getBoundingClientRect()
    const colW = rect.width / days.length
    const dayIdx = clamp(Math.floor((e.clientX - rect.left) / colW), 0, days.length - 1)
    const d = dragRef.current
    const rawMin =
      ((e.clientY - rect.top) / HOUR_H) * 60 + startMin - d.grabOffsetMin
    const start = clamp(snap(rawMin, SNAP_MIN), startMin, endMin - d.durMin)
    return { dayIdx, start }
  }

  function autoScroll(e) {
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (e.clientY < rect.top + 48) el.scrollTop -= 14
    else if (e.clientY > rect.bottom - 48) el.scrollTop += 14
  }

  function endDrag() {
    const d = dragRef.current
    if (!d) return
    if (d.holdTimer) clearTimeout(d.holdTimer)
    d.cleanup?.()
    dragRef.current = null
    setDrag(null)
  }

  function handlePointerDown(e, appt) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (dragRef.current) return
    const d = {
      appt,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      grabOffsetMin:
        ((e.clientY - e.currentTarget.getBoundingClientRect().top) / HOUR_H) * 60,
      durMin: timeToMin(appt.end_time) - timeToMin(appt.start_time),
      active: false,
      holdTimer: null,
    }
    dragRef.current = d

    const activate = (ev) => {
      if (!dragRef.current || dragRef.current.active) return
      dragRef.current.active = true
      suppressClickRef.current = true
      if (navigator.vibrate) navigator.vibrate(8)
      const { dayIdx, start } = computeTarget(ev || e)
      setDrag({ id: appt.id, dayIdx, startMin: start, durMin: d.durMin })
    }

    const onPointerMove = (ev) => {
      const cur = dragRef.current
      if (!cur || ev.pointerId !== cur.pointerId) return
      const dist = Math.hypot(ev.clientX - cur.startX, ev.clientY - cur.startY)
      if (!cur.active) {
        if (cur.pointerType === 'mouse' || cur.pointerType === 'pen') {
          if (dist > DRAG_START_PX) activate(ev)
        } else if (dist > 10) {
          // Finger moved before the long-press completed: it is a scroll.
          endDrag()
        }
        return
      }
      ev.preventDefault()
      autoScroll(ev)
      const { dayIdx, start } = computeTarget(ev)
      setDrag((prev) =>
        prev && prev.dayIdx === dayIdx && prev.startMin === start
          ? prev
          : { id: appt.id, dayIdx, startMin: start, durMin: cur.durMin },
      )
    }

    const onPointerUp = (ev) => {
      const cur = dragRef.current
      if (!cur || ev.pointerId !== cur.pointerId) return
      const wasActive = cur.active
      let target = null
      if (wasActive && ev.type === 'pointerup') target = computeTarget(ev)
      endDrag()
      if (wasActive) {
        setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
        if (target) {
          const newDate = days[target.dayIdx]
          const changed =
            newDate !== appt.date || target.start !== timeToMin(appt.start_time)
          if (changed) onMove(appt, newDate, target.start)
        }
      }
    }

    d.cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    if (e.pointerType !== 'mouse') {
      d.holdTimer = setTimeout(() => activate(), TOUCH_HOLD_MS)
    }
  }

  function handleColumnClick(e, iso) {
    if (suppressClickRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const min = startMin + ((e.clientY - rect.top) / HOUR_H) * 60
    const snapped = clamp(Math.floor(min / 30) * 30, startMin, endMin - 30)
    onEmptyTap(iso, snapped)
  }

  const gridTemplate = { '--ag-cols': days.length }

  return (
    <div className="ag-grid" style={gridTemplate}>
      <div className="ag-grid__head">
        <div className="ag-grid__corner" aria-hidden="true" />
        {days.map((iso) => {
          const d = parseIso(iso)
          const isToday = iso === todayIso
          return (
            <div key={iso} className={`ag-grid__dayhead${isToday ? ' is-today' : ''}`}>
              <span className="ag-grid__dayname">{WEEKDAYS_SHORT[d.getDay()]}</span>
              <span className="ag-grid__daynum">{d.getDate()}</span>
              {days.length === 1 && (
                <span className="ag-grid__daymonth">{MONTHS_SHORT[d.getMonth()]}</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="ag-grid__scroll" ref={scrollRef}>
        <div className="ag-grid__body" style={{ height: totalH }}>
          <div className="ag-gutter" aria-hidden="true">
            {hours.map((m) => (
              <span key={m} className="ag-gutter__label" style={{ top: ((m - startMin) / 60) * HOUR_H }}>
                {fmtMin(m)}
              </span>
            ))}
          </div>

          <div className="ag-cols" ref={colsRef}>
            {days.map((iso, dayIdx) => {
              const isToday = iso === todayIso
              return (
                <div
                  key={iso}
                  className={`ag-col${isToday ? ' is-today' : ''}${drag && drag.dayIdx === dayIdx ? ' is-drop-target' : ''}`}
                  onClick={(e) => handleColumnClick(e, iso)}
                >
                  {workBandsByDay[iso].map(([s, e2]) => (
                    <div
                      key={`w-${s}`}
                      className="ag-band ag-band--work"
                      style={{
                        top: ((Math.max(s, startMin) - startMin) / 60) * HOUR_H,
                        height: ((Math.min(e2, endMin) - Math.max(s, startMin)) / 60) * HOUR_H,
                      }}
                      aria-hidden="true"
                    />
                  ))}

                  {overridesByDay[iso].map((ov) => {
                    const s = ov.start_time ? timeToMin(ov.start_time) : startMin
                    const e2 = ov.end_time ? timeToMin(ov.end_time) : endMin
                    const spec = ov.specialty_id ? specialtiesById[ov.specialty_id] : null
                    const label =
                      ov.kind === 'block'
                        ? ov.reason || 'Bloqueado'
                        : `Extra${spec ? ` · ${spec.name}` : ''}`
                    return (
                      <button
                        key={`ov-${ov.id}`}
                        type="button"
                        className={`ag-band ag-band--${ov.kind}`}
                        style={{
                          top: ((Math.max(s, startMin) - startMin) / 60) * HOUR_H,
                          height: ((Math.min(e2, endMin) - Math.max(s, startMin)) / 60) * HOUR_H,
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onOverrideTap(ov)
                        }}
                        title={
                          ov.kind === 'block'
                            ? `Bloqueado${ov.reason ? `: ${ov.reason}` : ''}`
                            : 'Horário extra aberto'
                        }
                      >
                        <span>{label}</span>
                      </button>
                    )
                  })}

                  {apptsByDay[iso].map((appt) => {
                    const place = placements[iso].get(appt.id) || { col: 0, cols: 1 }
                    const isDragSource = drag?.id === appt.id
                    const spec = specialtiesById[appt.specialty_id]
                    return (
                      <button
                        key={appt.id}
                        type="button"
                        className={[
                          'ag-appt',
                          `ag-appt--${appt.status}`,
                          isDragSource ? 'is-drag-source' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{
                          top: apptTop(appt.start_time, startMin),
                          height: durationPx(appt.start_time, appt.end_time),
                          left: `calc(${(place.col / place.cols) * 100}% + 2px)`,
                          width: `calc(${100 / place.cols}% - 5px)`,
                        }}
                        onPointerDown={(e) => handlePointerDown(e, appt)}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (suppressClickRef.current) return
                          onApptTap(appt)
                        }}
                        title={`${appt.client_name} · ${fmtTime(appt.start_time)}–${fmtTime(appt.end_time)} · ${STATUS_LABELS[appt.status]}`}
                      >
                        <span className="ag-appt__time">
                          {fmtTime(appt.start_time)} – {fmtTime(appt.end_time)}
                        </span>
                        <span className="ag-appt__name">{appt.client_name}</span>
                        {spec && <span className="ag-appt__spec">{spec.name}</span>}
                      </button>
                    )
                  })}

                  {drag && drag.dayIdx === dayIdx && (
                    <div
                      className="ag-appt ag-appt--ghost"
                      style={{
                        top: ((drag.startMin - startMin) / 60) * HOUR_H,
                        height: (drag.durMin / 60) * HOUR_H - 2,
                        left: 2,
                        right: 3,
                      }}
                      aria-hidden="true"
                    >
                      <span className="ag-appt__time">
                        {fmtMin(drag.startMin)} – {fmtMin(drag.startMin + drag.durMin)}
                      </span>
                    </div>
                  )}

                  {isToday && nowMin > startMin && nowMin < endMin && (
                    <div
                      className="ag-nowline"
                      style={{ top: ((nowMin - startMin) / 60) * HOUR_H }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
