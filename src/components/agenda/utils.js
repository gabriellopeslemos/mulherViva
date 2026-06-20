export const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const START_HOUR = 8
export const END_HOUR = 19
export const STATUS_LABELS = { confirmed: 'Confirmado', pending: 'Aguardando', cancelled: 'Cancelado', completed: 'Realizada', no_show: 'Faltou' }

export function mondayOf(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

export function getApptPosition(start, end, hourHeight = 80) {
  const sMin = timeToMinutes(start)
  const eMin = timeToMinutes(end)
  const top = ((sMin - START_HOUR * 60) / 60) * hourHeight
  const height = Math.max(((eMin - sMin) / 60) * hourHeight - 4, 22)
  return { top: top + 'px', height: height + 'px' }
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

export function subtractIntervals(windows, blocks) {
  let result = windows.map((w) => w.slice())
  for (const [bs, be] of blocks) {
    const next = []
    for (const [ws, we] of result) {
      if (be <= ws || bs >= we) {
        next.push([ws, we])
        continue
      }
      if (ws < bs) next.push([ws, bs])
      if (be < we) next.push([be, we])
    }
    result = next
  }
  return result
}

export function formatDayLong(date) {
  return `${DAYS[(date.getDay() + 6) % 7]}, ${date.getDate()} de ${MONTHS[date.getMonth()]}`
}
