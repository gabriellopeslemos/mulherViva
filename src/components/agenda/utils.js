export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const WEEKDAYS_LONG = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado',
]
export const MONTHS_SHORT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]
export const MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// Backend weekday convention: 0=Monday .. 6=Sunday (Python).
// JS Date#getDay(): 0=Sunday .. 6=Saturday.
export function pyWeekday(date) {
  return (date.getDay() + 6) % 7
}

export const PY_WEEKDAY_LABELS = [
  'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo',
]

export function toIso(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/** Monday-first start of week. */
export function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return addDays(d, -pyWeekday(d))
}

/** '09:30:00' or '09:30' -> minutes since midnight. */
export function timeToMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** minutes -> 'HH:MM:00' (API format). */
export function minToTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}:00`
}

/** minutes -> 'HH:MM' (display / input[type=time] format). */
export function fmtMin(min) {
  return minToTime(min).slice(0, 5)
}

/** '09:30:00' -> '09:30'. */
export function fmtTime(t) {
  return t.slice(0, 5)
}

export function snap(min, step = 15) {
  return Math.round(min / step) * step
}

export function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value))
}

export function fmtDayLabel(iso) {
  const d = parseIso(iso)
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export function fmtFullDate(iso) {
  const d = parseIso(iso)
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`
}

export const STATUS_LABELS = {
  pending: 'Aguardando',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

export function mergeIntervals(intervals) {
  if (!intervals.length) return []
  const sorted = intervals.map((i) => i.slice()).sort((a, b) => a[0] - b[0])
  const out = [sorted[0]]
  for (const [s, e] of sorted.slice(1)) {
    const last = out[out.length - 1]
    if (s <= last[1]) last[1] = Math.max(last[1], e)
    else out.push([s, e])
  }
  return out
}

/**
 * Assign side-by-side columns to overlapping appointments of a single day.
 * Returns a Map: appointment id -> { col, cols }.
 */
export function layoutOverlaps(appts) {
  const sorted = [...appts].sort(
    (a, b) =>
      timeToMin(a.start_time) - timeToMin(b.start_time) ||
      timeToMin(b.end_time) - timeToMin(a.end_time),
  )
  const placement = new Map()
  let cluster = []
  let clusterEnd = -1

  const flush = () => {
    if (!cluster.length) return
    const colEnds = []
    const assigned = []
    cluster.forEach((appt) => {
      const start = timeToMin(appt.start_time)
      let col = colEnds.findIndex((end) => end <= start)
      if (col === -1) {
        col = colEnds.length
        colEnds.push(0)
      }
      colEnds[col] = timeToMin(appt.end_time)
      assigned.push([appt.id, col])
    })
    assigned.forEach(([id, col]) => {
      placement.set(id, { col, cols: colEnds.length })
    })
    cluster = []
  }

  sorted.forEach((appt) => {
    const start = timeToMin(appt.start_time)
    if (cluster.length && start >= clusterEnd) flush()
    cluster.push(appt)
    clusterEnd = Math.max(clusterEnd, timeToMin(appt.end_time))
  })
  flush()
  return placement
}
