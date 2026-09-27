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

export function fmtShortDate(iso) {
  const d = parseIso(iso)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export const STATUS_LABELS = {
  pending: 'Aguardando',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

/* ---------- vigências (schedule periods) ----------
 * Mirrors backend/app/services/slots.py: on any date the most specific period
 * covering it (shortest range, then later start, then newer) wins outright. */

const DAY_MS = 24 * 60 * 60 * 1000

function isoDays(iso) {
  return Math.round(parseIso(iso).getTime() / DAY_MS)
}

export function periodActiveOn(p, iso) {
  if (p.start_date && iso < p.start_date) return false
  if (p.end_date && iso > p.end_date) return false
  return true
}

function specificity(p) {
  const span = p.start_date && p.end_date ? isoDays(p.end_date) - isoDays(p.start_date) : Infinity
  return [span, p.start_date ? -isoDays(p.start_date) : 0, -p.id]
}

/** < 0 when `a` is more specific than `b` (it wins where both apply). */
export function compareSpecificity(a, b) {
  const ka = specificity(a)
  const kb = specificity(b)
  for (let i = 0; i < ka.length; i += 1) {
    if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1
  }
  return 0
}

export function winningPeriod(periods, iso) {
  const covering = periods.filter((p) => periodActiveOn(p, iso))
  return covering.sort(compareSpecificity)[0] || null
}

/** Active rules that apply on `iso` — only the winning period's. */
export function rulesForDate(iso, periods, rules) {
  const p = winningPeriod(periods, iso)
  if (!p) return []
  const wd = pyWeekday(parseIso(iso))
  return rules.filter((r) => r.period_id === p.id && r.weekday === wd && r.active)
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  if (aEnd && bStart && aEnd < bStart) return false
  if (bEnd && aStart && bEnd < aStart) return false
  return true
}

/** Period a new vigência copies its rules from (see slots.py::prefill_source). */
export function prefillSource(startIso, endIso, periods) {
  const overlapping = periods.filter((p) =>
    rangesOverlap(startIso, endIso, p.start_date, p.end_date),
  )
  if (!overlapping.length) return null
  const earliest = overlapping.map((p) => p.start_date || startIso).sort()[0]
  const firstDay = earliest > startIso ? earliest : startIso
  return winningPeriod(overlapping, firstDay)
}

/** 'active' | 'future' | 'expired' relative to `todayIso`. */
export function periodStatus(p, todayIso) {
  if (p.start_date && p.start_date > todayIso) return 'future'
  if (p.end_date && p.end_date < todayIso) return 'expired'
  return 'active'
}

/** Dates (ISO) of `weekday` inside a bounded period, or null if unbounded. */
export function weekdayDatesInPeriod(p, weekday) {
  if (!p.start_date || !p.end_date) return null
  const out = []
  const end = parseIso(p.end_date)
  let d = parseIso(p.start_date)
  d = addDays(d, (weekday - pyWeekday(d) + 7) % 7)
  for (; d <= end; d = addDays(d, 7)) out.push(toIso(d))
  return out
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
