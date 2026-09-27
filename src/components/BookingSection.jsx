import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { api } from '../lib/api'
import { RETENTION_NOTICE } from '../lib/privacy'
import RecoverBooking from './RecoverBooking'
import '../styles/booking.css'

const WEEKDAY_HEAD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTHS_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]
const WEEKDAYS_LONG = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]
const MAX_MONTHS_AHEAD = 2

const STEPS = [
  { id: 1, label: 'Data e horário' },
  { id: 2, label: 'Dados pessoais' },
  { id: 3, label: 'Motivo da consulta' },
  { id: 4, label: 'Confirmação' },
]

// Quick-pick topics for step 3. Sent joined as the booking's `reason`, which
// the clinic sees in the new-booking email and the Google Calendar event.
const REASON_TAGS = [
  'Check-up preventivo',
  'Exames de rotina',
  'Saúde hormonal',
  'Menopausa',
  'Contracepção',
  'Gestação e pré-natal',
  'Fertilidade',
  'Suplementação',
  'Outros',
]

function toIso(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function monthPartOf(iso) {
  const d = parseIso(iso)
  return `${d.getFullYear()}-${d.getMonth()}`
}

function fmtTime(t) {
  return t.slice(0, 5)
}

function fmtLongDate(iso) {
  const d = parseIso(iso)
  const text = `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function fmtShortDate(iso) {
  const d = parseIso(iso)
  return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

// "Hoje", "Amanhã" or the weekday name, for the "next free slot" shortcut.
function relativeDayLabel(iso, today) {
  const diff = Math.round((parseIso(iso) - today) / 86_400_000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  return WEEKDAYS_LONG[parseIso(iso).getDay()]
}

function periodOf(start) {
  const h = Number(start.slice(0, 2))
  if (h < 12) return 'Manhã'
  if (h < 18) return 'Tarde'
  return 'Noite'
}

const PERIOD_ORDER = ['Manhã', 'Tarde', 'Noite']

const HOUSE_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5" />
  </svg>
)

const VIDEO_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="m16 10 5-3v10l-5-3" />
  </svg>
)

// Order here is the order of the segmented control.
const MODALITIES = [
  {
    id: 'online',
    label: 'Online',
    title: 'Telemedicina (Online)',
    description: 'Atendimento humanizado por vídeo',
    icon: VIDEO_ICON,
  },
  {
    id: 'presencial_rj',
    label: 'Rio de Janeiro',
    title: 'Presencial — Rio de Janeiro',
    description: 'Atendimento no consultório',
    icon: HOUSE_ICON,
  },
  {
    id: 'presencial_bsb',
    label: 'Brasília',
    title: 'Presencial — Brasília',
    description: 'Atendimento no consultório',
    icon: HOUSE_ICON,
  },
]

const MODALITY_BY_ID = Object.fromEntries(MODALITIES.map((m) => [m.id, m]))
const MODALITY_LABELS = Object.fromEntries(MODALITIES.map((m) => [m.id, m.title]))

function buildMonthMatrix(cursor) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  const weeks = []
  const probe = new Date(start)
  while (probe <= new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0) || weeks.length === 0) {
    const week = []
    for (let i = 0; i < 7; i += 1) {
      week.push(new Date(probe))
      probe.setDate(probe.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 12.5 10 18 19.5 7" />
    </svg>
  )
}

function ArrowIcon({ dir = 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === 'right' ? <path d="M5 12h14M13 6l6 6-6 6" /> : <path d="M19 12H5M11 6l-6 6 6 6" />}
    </svg>
  )
}

function ChevronIcon({ dir }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === 'left' ? <path d="m14.5 6-6 6 6 6" /> : <path d="m9.5 6 6 6-6 6" />}
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  )
}

function CalendarGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  )
}

// Motion curves for the review → confirmed morph. EASE_SHEET is the
// iOS sheet/spring-like curve (fast start, long soft landing); EASE_OUT is the
// one the ticket already enters with, so the two moments feel related.
const EASE_SHEET = [0.32, 0.72, 0, 1]
const EASE_OUT = [0.22, 1, 0.36, 1]

// Height-collapsing presence wrapper: animates real `height`, not a scale
// transform, so the content below reflows frame by frame instead of jumping.
// `overflow` is only hidden while animating so focus rings and shadows of the
// settled content are never clipped.
function Collapse({ show, reduced, delay = 0, children }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={reduced ? false : { height: 0, opacity: 0, overflow: 'hidden' }}
          animate={{
            height: 'auto',
            opacity: 1,
            transitionEnd: { overflow: 'visible' },
            transition: reduced
              ? { duration: 0 }
              : {
                  height: { duration: 0.55, ease: EASE_SHEET, delay },
                  opacity: { duration: 0.35, ease: 'easeOut', delay: delay + 0.1 },
                },
          }}
          exit={{
            height: 0,
            opacity: 0,
            overflow: 'hidden',
            transition: reduced
              ? { duration: 0 }
              : {
                  height: { duration: 0.5, ease: EASE_SHEET, delay: 0.04 },
                  opacity: { duration: 0.18, ease: 'easeIn' },
                },
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Wraps content whose height changes in place (e.g. a crossfade between two
// blocks of different size) and eases the container to the new height.
function AutoHeight({ reduced, children }) {
  const innerRef = useRef(null)
  const [height, setHeight] = useState('auto')

  useEffect(() => {
    const node = innerRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      className="bk-autoheight"
      initial={false}
      animate={{ height }}
      transition={reduced ? { duration: 0 } : { duration: 0.55, ease: EASE_SHEET }}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  )
}

// Blur-and-lift crossfade for two stacked blocks (see `.bk-swap`). Exits fast,
// enters late, so the two never read as overlapping text.
function swapMotion(reduced, enterDelay = 0) {
  if (reduced) return { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
  return {
    initial: { opacity: 0, y: 10, filter: 'blur(8px)' },
    animate: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.6, ease: EASE_OUT, delay: enterDelay },
      // Drop the settled transform/filter: a lingering `translateY(0px)` or
      // `blur(0px)` keeps the subtree on its own GPU layer (see motionProps).
      transitionEnd: { y: 0, filter: 'none' },
    },
    exit: {
      opacity: 0,
      y: -6,
      filter: 'blur(6px)',
      transition: { duration: 0.22, ease: 'easeIn' },
    },
  }
}

// Confirmation seal: the disc springs in, the check draws itself, and a
// single soft ring radiates out once.
function SuccessSeal({ reduced }) {
  return (
    <div className="bk-seal" aria-hidden="true">
      {!reduced && (
        <motion.span
          className="bk-seal__halo"
          initial={{ scale: 0.7, opacity: 0.5 }}
          animate={{ scale: 2.1, opacity: 0 }}
          transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.5 }}
        />
      )}
      <motion.span
        className="bk-seal__disc"
        initial={reduced ? false : { scale: 0.35, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22, mass: 0.9, delay: 0.22 }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <motion.path
            d="M4.5 12.5 10 18 19.5 7"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, ease: [0.65, 0, 0.35, 1], delay: 0.48 }}
          />
        </svg>
      </motion.span>
    </div>
  )
}

export default function BookingSection({ presetSpecialty } = {}) {
  const reducedMotion = useReducedMotion()
  const [specialties, setSpecialties] = useState([])
  const [unavailable, setUnavailable] = useState(false)
  const [specialtyId, setSpecialtyId] = useState(null)
  const [cursor, setCursor] = useState(() => {
    const t = startOfToday()
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })
  const [monthCache, setMonthCache] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    reasons: [],
    firstVisit: null,
  })
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const [error, setError] = useState(null)
  const confirmedTitleRef = useRef(null)
  // Single-select modality (online / presencial RJ / presencial BSB). The
  // calendar and the slot list only show slots of the chosen modality.
  const [modality, setModality] = useState(MODALITIES[0].id)

  // "Join the waitlist" mini-form, shown as an opt-in below the calendar.
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [waitlistSpecialtyId, setWaitlistSpecialtyId] = useState(null)
  const [waitlistForm, setWaitlistForm] = useState({
    name: '',
    email: '',
    phone: '',
  })
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
  const [waitlistError, setWaitlistError] = useState(null)
  const [waitlistDone, setWaitlistDone] = useState(false)

  // The section sits far below the fold, but the fetches it kicks off were
  // firing at mount time regardless — showing up as an early, slow leg of the
  // page's critical request chain. Deferring them until the section is about
  // to scroll into view removes them from that chain entirely.
  const sectionRef = useRef(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    const node = sectionRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Once the morph has mostly settled, hand focus to the new heading (the
  // "Confirmar" button that had it is gone) and, if the patient scrolled past
  // it, glide the heading back into view.
  useEffect(() => {
    if (!confirmation) return
    const timer = setTimeout(
      () => {
        const node = confirmedTitleRef.current
        if (!node) return
        node.focus({ preventScroll: true })
        const top = node.getBoundingClientRect().top
        if (top < 96) {
          window.scrollBy({ top: top - 140, behavior: reducedMotion ? 'auto' : 'smooth' })
        }
      },
      reducedMotion ? 0 : 520,
    )
    return () => clearTimeout(timer)
  }, [confirmation, reducedMotion])

  useEffect(() => {
    if (!shouldLoad) return
    api
      .get('/api/specialties')
      .then(setSpecialties)
      .catch(() => setUnavailable(true))
  }, [shouldLoad])

  const specialty = specialties.find((s) => s.id === specialtyId) || null
  const monthPart = `${cursor.getFullYear()}-${cursor.getMonth()}`

  // The calendar is specialty-agnostic: a day is bookable when ANY specialty
  // has an open slot. So we load every specialty's month and merge for the
  // calendar, then narrow to the chosen specialty once the patient picks one.
  useEffect(() => {
    if (specialties.length === 0) return
    const today = startOfToday()
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    // Navigation never goes before the current month, so `last >= today` always.
    const from = first < today ? today : first
    specialties.forEach((s) => {
      const key = `${s.id}:${monthPart}`
      if (monthCache[key]) return
      api
        .get(`/api/slots?specialty_id=${s.id}&date_from=${toIso(from)}&date_to=${toIso(last)}`)
        .then((data) => {
          const map = {}
          data.days.forEach((d) => {
            map[d.date] = d.slots
          })
          setMonthCache((c) => ({ ...c, [key]: map }))
        })
        .catch(() => setError('Não foi possível carregar a agenda. Tente novamente.'))
    })
  }, [specialties, monthPart, cursor, monthCache])

  const monthMaps = useMemo(
    () => specialties.map((s) => monthCache[`${s.id}:${monthPart}`]).filter(Boolean),
    [specialties, monthCache, monthPart],
  )
  const loadingMonth = specialties.length > 0 && monthMaps.length < specialties.length

  const matchesFilter = (slot) => slot.location === modality

  const monthHasSlots = monthMaps.some((m) => Object.values(m).some((s) => s.some(matchesFilter)))

  const dayHasAvailability = (iso) => monthMaps.some((m) => m[iso]?.some(matchesFilter) ?? false)

  const today = startOfToday()
  const todayIso = toIso(today)
  const minMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const maxMonth = new Date(today.getFullYear(), today.getMonth() + MAX_MONTHS_AHEAD, 1)
  const canPrevMonth = cursor > minMonth
  const canNextMonth = cursor < maxMonth

  // Specialties that actually have an open slot on the picked date.
  const dateSpecialties = useMemo(() => {
    if (!selectedDate) return []
    const part = monthPartOf(selectedDate)
    return specialties.filter(
      (s) => monthCache[`${s.id}:${part}`]?.[selectedDate]?.some(matchesFilter) ?? false,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialties, monthCache, selectedDate, modality])

  // Times are the same for every specialty, so we can show them right away —
  // using the chosen specialty, or the first available one as a stand-in.
  const slotSpecialtyId = specialtyId || dateSpecialties[0]?.id || null

  const daySlots = useMemo(() => {
    if (!selectedDate || !slotSpecialtyId) return []
    const key = `${slotSpecialtyId}:${monthPartOf(selectedDate)}`
    return (monthCache[key]?.[selectedDate] || []).filter(matchesFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCache, selectedDate, slotSpecialtyId, modality])

  const slotGroups = useMemo(() => {
    const groups = { Manhã: [], Tarde: [], Noite: [] }
    daySlots.forEach((slot) => groups[periodOf(slot.start)].push(slot))
    return PERIOD_ORDER.filter((p) => groups[p].length > 0).map((p) => ({
      label: p,
      slots: groups[p],
    }))
  }, [daySlots])

  // Specialties that offer exactly the chosen slot (same start + modality).
  // Slot grids differ per specialty duration, so this can be narrower than
  // `dateSpecialties`.
  const slotSpecialties = useMemo(() => {
    if (!selectedDate || !selectedSlot) return []
    const part = monthPartOf(selectedDate)
    return specialties.filter((s) =>
      (monthCache[`${s.id}:${part}`]?.[selectedDate] || []).some(
        (x) => x.start === selectedSlot.start && x.location === selectedSlot.location,
      ),
    )
  }, [specialties, monthCache, selectedDate, selectedSlot])

  // A specialty card's "Agendar Consulta" link sets this to its title; once
  // specialties load we resolve it to a real specialty id (names differ
  // slightly, e.g. card "Ginecologia" vs. seeded "Ginecologia Integrativa",
  // so match by substring).
  const presetSpecialtyId = useMemo(() => {
    if (!presetSpecialty) return null
    const needle = presetSpecialty.toLowerCase()
    return specialties.find((s) => s.name.toLowerCase().includes(needle))?.id ?? null
  }, [presetSpecialty, specialties])

  // Earliest open slot for the chosen modality across every month loaded so
  // far, optionally restricted to a set of specialties. Drives both the
  // "Próximo horário livre" shortcut and the initial auto-selection.
  const findNextFree = (targetSpecialties) => {
    let best = null
    targetSpecialties.forEach((s) => {
      Object.entries(monthCache).forEach(([key, map]) => {
        if (!key.startsWith(`${s.id}:`)) return
        Object.entries(map).forEach(([iso, slots]) => {
          if (iso < todayIso) return
          slots.filter(matchesFilter).forEach((slot) => {
            if (!best || iso < best.iso || (iso === best.iso && slot.start < best.slot.start)) {
              best = { iso, slot, specialtyId: s.id }
            }
          })
        })
      })
    })
    return best
  }

  const nextFree = useMemo(
    () => findNextFree(specialties),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthCache, specialties, modality, todayIso],
  )

  // Tracks which preset we're currently honouring so a repeat click on the
  // same card doesn't re-run the search, while a click on a *different* card
  // overrides whatever was already selected.
  const pendingPresetRef = useRef(null)
  useEffect(() => {
    if (presetSpecialty && pendingPresetRef.current !== presetSpecialty) {
      pendingPresetRef.current = presetSpecialty
      setSelectedDate(null)
      setSpecialtyId(null)
      setSelectedSlot(null)
      setStep(1)
      setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
    }
  }, [presetSpecialty, today])

  // Land the patient on a ready-to-confirm booking: pre-select the next open
  // date and its first time slot once the agenda finishes loading. Runs once
  // (or rolls forward a month when the current one has nothing open).
  // When a preset specialty is pending, only that specialty is searched.
  const autoPickedRef = useRef(false)
  useEffect(() => {
    if (selectedDate || loadingMonth) return
    if (specialties.length === 0) return
    if (!presetSpecialty && autoPickedRef.current) return

    const targetSpecialties = presetSpecialtyId
      ? specialties.filter((s) => s.id === presetSpecialtyId)
      : specialties
    const found = findNextFree(targetSpecialties)

    // Intentional one-shot sync of selection from asynchronously-loaded agenda
    // data; the ref guard keeps it from cascading.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (found) {
      autoPickedRef.current = true
      const d = parseIso(found.iso)
      setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
      setSelectedDate(found.iso)
      setSpecialtyId(found.specialtyId)
      setSelectedSlot(found.slot)
    } else if (canNextMonth) {
      setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
    } else {
      autoPickedRef.current = true
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loadingMonth,
    monthCache,
    specialties,
    cursor,
    selectedDate,
    canNextMonth,
    modality,
    presetSpecialty,
    presetSpecialtyId,
  ])

  // Switching modality re-runs the auto-pick so the soonest matching date and
  // time are surfaced right away.
  const changeModality = (id) => {
    if (id === modality) return
    setError(null)
    setModality(id)
    autoPickedRef.current = false
    setSelectedDate(null)
    setSpecialtyId(null)
    setSelectedSlot(null)
    setCursor(() => new Date(today.getFullYear(), today.getMonth(), 1))
  }

  const pickDate = (iso) => {
    // Keep the specialty if it still has slots on the new day, otherwise the
    // patient re-picks one among those available on that date.
    const keptSpecialty =
      specialtyId &&
      (monthCache[`${specialtyId}:${monthPartOf(iso)}`]?.[iso]?.some(matchesFilter) ?? false)
        ? specialtyId
        : null
    setSelectedDate(iso)
    setSpecialtyId(keptSpecialty)
    setSelectedSlot(null)
    setError(null)
  }

  const pickSlot = (slot) => {
    setSelectedSlot(slot)
    setError(null)
  }

  const pickNextFree = () => {
    if (!nextFree) return
    const d = parseIso(nextFree.iso)
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
    setSelectedDate(nextFree.iso)
    setSelectedSlot(nextFree.slot)
    setSpecialtyId((cur) =>
      cur &&
      monthCache[`${cur}:${monthPartOf(nextFree.iso)}`]?.[nextFree.iso]?.some(
        (x) => x.start === nextFree.slot.start && x.location === nextFree.slot.location,
      )
        ? cur
        : nextFree.specialtyId,
    )
    setError(null)
  }

  const goToStep = (target) => {
    setError(null)
    if (target === 3) {
      // Entering "Motivo da consulta": make sure the specialty on record can
      // actually be booked in the chosen slot, and pre-select when obvious.
      const valid = slotSpecialties.some((s) => s.id === specialtyId)
      if (!valid) {
        const preset = slotSpecialties.find((s) => s.id === presetSpecialtyId)
        setSpecialtyId(preset?.id ?? (slotSpecialties.length === 1 ? slotSpecialties[0].id : null))
      }
    }
    setStep(target)
  }

  const toggleReason = (tag) =>
    setForm((f) => ({
      ...f,
      reasons: f.reasons.includes(tag) ? f.reasons.filter((r) => r !== tag) : [...f.reasons, tag],
    }))

  // Arrow keys move through the specialty radios (roving tabindex), as a
  // native radio group would.
  const handleSpecialtyKeyDown = (event) => {
    const delta = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (!delta || slotSpecialties.length === 0) return
    event.preventDefault()
    const current = slotSpecialties.findIndex((s) => s.id === specialtyId)
    const n = slotSpecialties.length
    const next = current === -1 ? (delta > 0 ? 0 : n - 1) : (current + delta + n) % n
    setSpecialtyId(slotSpecialties[next].id)
    event.currentTarget.querySelectorAll('[role="radio"]')[next]?.focus()
  }

  const reset = () => {
    setConfirmation(null)
    setSpecialtyId(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    setForm({ name: '', phone: '', email: '', reasons: [], firstVisit: null })
    setMonthCache({})
    setError(null)
    autoPickedRef.current = false
    setStep(1)
  }

  const handleSubmit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const booking = await api.post('/api/bookings', {
        specialty_id: specialtyId,
        date: selectedDate,
        start: selectedSlot.start,
        type: selectedSlot.location,
        client_name: form.name.trim(),
        client_phone: form.phone.trim(),
        client_email: form.email.trim(),
        reason: form.reasons.join(', ') || null,
        is_first_visit: form.firstVisit === true,
      })
      setConfirmation(booking)
    } catch (err) {
      if (err.status === 409) {
        setMonthCache({})
        setSelectedSlot(null)
        setStep(1)
        setError('Esse horário acabou de ser reservado. Escolha outro, por favor.')
      } else {
        setError(err.detail || 'Não foi possível concluir o agendamento. Tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const openWaitlist = () => {
    setWaitlistOpen(true)
    setWaitlistDone(false)
    setWaitlistError(null)
    setWaitlistSpecialtyId(specialtyId || dateSpecialties[0]?.id || specialties[0]?.id || null)
  }

  const handleWaitlistSubmit = async (event) => {
    event.preventDefault()
    setWaitlistError(null)
    setWaitlistSubmitting(true)
    try {
      await api.post('/api/waitlist', {
        specialty_id: waitlistSpecialtyId,
        client_name: waitlistForm.name.trim(),
        client_email: waitlistForm.email.trim(),
        client_phone: waitlistForm.phone.trim() || null,
        preferred_date: selectedDate || null,
      })
      setWaitlistDone(true)
    } catch (err) {
      setWaitlistError(err.detail || 'Não foi possível entrar na lista de espera. Tente novamente.')
    } finally {
      setWaitlistSubmitting(false)
    }
  }

  if (unavailable) return null

  // Fade only — no `y` translate. Framer-motion leaves a lingering
  // `transform: translateY(0px)` after a y-animation settles, which promotes the
  // step subtree to a GPU layer rendered at a fractional pixel offset and bakes a
  // 1px rasterization seam into filled, rounded children (selected chips/slots).
  const firstName = form.name.trim().split(/\s+/)[0] || ''

  const motionProps = reducedMotion
    ? { initial: false, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.26, ease: 'easeOut' },
      }

  const activeModality = MODALITY_BY_ID[modality]

  return (
    <section className="section bk-section" id="agendamento" tabIndex={-1} ref={sectionRef}>
      <div className="container">
        <motion.div
          className="section-header bk-header"
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <p className="eyebrow">Agendamento online</p>
          <h2>Sua consulta, no seu tempo.</h2>
          <p>
            Escolha o dia, a especialidade e o horário em poucos toques. A confirmação chega na
            hora, no seu e-mail.
          </p>
        </motion.div>

        <Collapse show={!confirmation} reduced={reducedMotion}>
          <RecoverBooking />
        </Collapse>

        {/* The review step morphs into the confirmation in place: the card and
            the ticket persist, only the chrome around them (stepper, heading,
            actions) collapses or crossfades. */}
        <div className="bk-card bk-main">
          <Collapse show={!confirmation} reduced={reducedMotion}>
            <ol className="bk-stepper" aria-label="Etapas do agendamento">
              {STEPS.map((s) => {
                const state = s.id === step ? 'current' : s.id < step ? 'done' : 'upcoming'
                const clickable = state === 'done' && !submitting
                return (
                  <li
                    key={s.id}
                    className={`bk-stepper__item is-${state}`}
                    aria-current={state === 'current' ? 'step' : undefined}
                  >
                    <button
                      type="button"
                      className="bk-stepper__btn"
                      onClick={() => clickable && goToStep(s.id)}
                      disabled={!clickable}
                      aria-label={`Etapa ${s.id}: ${s.label}`}
                    >
                      <span className="bk-stepper__num" aria-hidden="true">
                        {state === 'done' ? <CheckIcon /> : s.id}
                      </span>
                      <span className="bk-stepper__label">{s.label}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
            <p className="bk-stepper__caption" aria-hidden="true">
              Etapa {step} de {STEPS.length} · <strong>{STEPS[step - 1].label}</strong>
            </p>
          </Collapse>

          <AnimatePresence mode="wait" initial={false}>
            {step === 1 && (
              <motion.div key="step1" className="bk-step bk-schedule" {...motionProps}>
                {/* ---- column 1: intro + modality ---- */}
                <div className="bk-schedule__intro">
                  <h3 className="bk-schedule__title">Quando você gostaria de ser atendida?</h3>
                  <p className="bk-schedule__lead">
                    Escolha a modalidade, data e o horário que melhor se encaixam na sua rotina.
                  </p>

                  <span className="bk-label" id="bk-modality-label">
                    Selecione o local / formato
                  </span>
                  <div
                    className="bk-segment"
                    role="radiogroup"
                    aria-labelledby="bk-modality-label"
                  >
                    {MODALITIES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={modality === m.id}
                        className={`bk-segment__btn${modality === m.id ? ' is-active' : ''}`}
                        onClick={() => changeModality(m.id)}
                      >
                        <span className="bk-segment__icon">{m.icon}</span>
                        <span className="bk-segment__text">{m.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="bk-info">
                    <span className="bk-info__icon">{activeModality.icon}</span>
                    <div>
                      <strong>{activeModality.title}</strong>
                      <span>{activeModality.description}</span>
                    </div>
                  </div>

                  <div className="bk-nextfree" aria-live="polite">
                    <span className="bk-nextfree__icon">
                      <BoltIcon />
                    </span>
                    <div>
                      <span className="bk-nextfree__label">Próximo horário livre:</span>
                      {nextFree ? (
                        <button
                          type="button"
                          className="bk-nextfree__link"
                          onClick={pickNextFree}
                        >
                          {relativeDayLabel(nextFree.iso, today)}, {fmtShortDate(nextFree.iso)} às{' '}
                          {fmtTime(nextFree.slot.start)}
                        </button>
                      ) : (
                        <span className="bk-nextfree__empty">
                          {loadingMonth ? 'Buscando…' : 'Nenhum nas próximas semanas'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ---- column 2: calendar ---- */}
                <div className="bk-panel bk-calendar" aria-busy={loadingMonth}>
                  <div className="bk-calendar__nav">
                    <button
                      type="button"
                      className="bk-iconbtn"
                      onClick={() =>
                        setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
                      }
                      disabled={!canPrevMonth}
                      aria-label="Mês anterior"
                    >
                      <ChevronIcon dir="left" />
                    </button>
                    <strong aria-live="polite">
                      {MONTHS_LONG[cursor.getMonth()]} {cursor.getFullYear()}
                    </strong>
                    <button
                      type="button"
                      className="bk-iconbtn"
                      onClick={() =>
                        setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
                      }
                      disabled={!canNextMonth}
                      aria-label="Próximo mês"
                    >
                      <ChevronIcon dir="right" />
                    </button>
                  </div>
                  <div className="bk-calendar__grid" role="group" aria-label="Dias do mês">
                    {WEEKDAY_HEAD.map((w, i) => (
                      <span key={`${w}-${i}`} className="bk-calendar__weekday" aria-hidden="true">
                        {w}
                      </span>
                    ))}
                    {buildMonthMatrix(cursor)
                      .flat()
                      .map((day) => {
                        const iso = toIso(day)
                        const inMonth = day.getMonth() === cursor.getMonth()
                        const enabled = inMonth && dayHasAvailability(iso)
                        const isToday = iso === todayIso
                        return (
                          <button
                            key={iso}
                            type="button"
                            className={[
                              'bk-calendar__day',
                              inMonth ? '' : 'is-outside',
                              enabled ? 'is-available' : '',
                              selectedDate === iso ? 'is-selected' : '',
                              isToday ? 'is-today' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            disabled={!enabled}
                            onClick={() => pickDate(iso)}
                            aria-pressed={selectedDate === iso}
                            aria-label={`${day.getDate()} de ${MONTHS_LONG[day.getMonth()]}${enabled ? ', com horários disponíveis' : ', indisponível'}`}
                          >
                            <span>{day.getDate()}</span>
                          </button>
                        )
                      })}
                  </div>
                  <div className="bk-calendar__foot">
                    {loadingMonth && !error ? (
                      <p className="bk-calendar__hint">Carregando agenda…</p>
                    ) : !monthHasSlots ? (
                      <p className="bk-calendar__hint">
                        Sem horários neste mês para esta modalidade.
                      </p>
                    ) : (
                      <ul className="bk-legend" aria-hidden="true">
                        <li className="bk-legend__available">Disponível</li>
                        <li className="bk-legend__selected">Selecionado</li>
                      </ul>
                    )}
                  </div>
                </div>

                {/* ---- column 3: time slots ---- */}
                <div className="bk-times-wrap">
                  <div className="bk-panel bk-times">
                    {!selectedDate ? (
                      <div className="bk-times__empty">
                        <CalendarGlyph />
                        <p>Selecione uma data no calendário para ver os horários disponíveis.</p>
                      </div>
                    ) : (
                      <>
                        <h4 className="bk-times__title">
                          Horários do dia <strong>{fmtShortDate(selectedDate)}</strong>
                        </h4>

                        {slotGroups.length === 0 ? (
                          <p className="bk-times__hint">
                            Os horários deste dia acabaram de ser preenchidos. Escolha outra data.
                          </p>
                        ) : (
                          <div
                            className={`bk-slotlist${daySlots.length > 5 ? ' is-scrollable' : ''}`}
                            role="radiogroup"
                            aria-label="Horários disponíveis"
                          >
                            {slotGroups.map((group) => (
                              <div key={group.label} className="bk-slotlist__group">
                                {slotGroups.length > 1 && (
                                  <span className="bk-slotlist__label">{group.label}</span>
                                )}
                                {group.slots.map((slot) => {
                                  const isSel =
                                    selectedSlot?.start === slot.start &&
                                    selectedSlot?.location === slot.location
                                  return (
                                    <button
                                      key={`${slot.start}-${slot.location}`}
                                      type="button"
                                      role="radio"
                                      aria-checked={isSel}
                                      className={`bk-slot${isSel ? ' is-selected' : ''}`}
                                      onClick={() => pickSlot(slot)}
                                    >
                                      <span className="bk-slot__time">{fmtTime(slot.start)}</span>
                                      {isSel && (
                                        <span className="bk-slot__check">
                                          <CheckIcon />
                                        </span>
                                      )}
                                    </button>
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          className="bk-btn bk-btn--primary bk-times__next"
                          onClick={() => goToStep(2)}
                          disabled={!selectedSlot}
                        >
                          Próximo passo
                          <ArrowIcon />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* ---- waitlist opt-in (spans all columns) ---- */}
                <div className="bk-waitlist">
                  {!waitlistOpen ? (
                    <button type="button" className="bk-waitlist__toggle" onClick={openWaitlist}>
                      Não achou o horário que queria? Entre na lista de espera para ser avisada
                      quando novos horários aparecerem.
                    </button>
                  ) : waitlistDone ? (
                    <p className="bk-waitlist__done">
                      <CheckIcon /> Pronto! Avisaremos <strong>{waitlistForm.email}</strong> assim
                      que um horário abrir.
                    </p>
                  ) : (
                    <form className="bk-waitlist__form" onSubmit={handleWaitlistSubmit}>
                      <h4 className="bk-waitlist__title">Entrar na lista de espera</h4>
                      <div className="bk-form__grid">
                        <label className="bk-field bk-field--full" htmlFor="wl-specialty">
                          <span>Especialidade</span>
                          <select
                            id="wl-specialty"
                            value={waitlistSpecialtyId || ''}
                            onChange={(e) => setWaitlistSpecialtyId(Number(e.target.value))}
                            required
                          >
                            <option value="" disabled>
                              Selecione…
                            </option>
                            {specialties.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="bk-field bk-field--full" htmlFor="wl-name">
                          <span>Nome completo</span>
                          <input
                            id="wl-name"
                            type="text"
                            autoComplete="name"
                            value={waitlistForm.name}
                            onChange={(e) =>
                              setWaitlistForm((f) => ({
                                ...f,
                                name: e.target.value,
                              }))
                            }
                            required
                            minLength={2}
                          />
                        </label>
                        <label className="bk-field" htmlFor="wl-email">
                          <span>E-mail</span>
                          <input
                            id="wl-email"
                            type="email"
                            autoComplete="email"
                            value={waitlistForm.email}
                            onChange={(e) =>
                              setWaitlistForm((f) => ({
                                ...f,
                                email: e.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                        <label className="bk-field" htmlFor="wl-phone">
                          <span>
                            Telefone <em>(opcional)</em>
                          </span>
                          <input
                            id="wl-phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            value={waitlistForm.phone}
                            onChange={(e) =>
                              setWaitlistForm((f) => ({
                                ...f,
                                phone: e.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>
                      <p className="bk-privacy">{RETENTION_NOTICE}</p>
                      {selectedDate && (
                        <p className="bk-hint bk-waitlist__hint">
                          Vamos priorizar horários em {fmtLongDate(selectedDate)}.
                        </p>
                      )}
                      {waitlistError && (
                        <p className="bk-error" role="alert">
                          {waitlistError}
                        </p>
                      )}
                      <div className="bk-waitlist__actions">
                        <button
                          type="button"
                          className="bk-btn bk-btn--ghost"
                          onClick={() => setWaitlistOpen(false)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="bk-btn bk-btn--primary"
                          disabled={waitlistSubmitting || !waitlistSpecialtyId}
                        >
                          {waitlistSubmitting ? 'Enviando…' : 'Entrar na lista'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.form
                key="step2"
                className="bk-step bk-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  goToStep(3)
                }}
                {...motionProps}
              >
                <div className="bk-form__head">
                  <h3 className="bk-step__title">Quase lá! Seus dados</h3>
                  <p className="bk-step__lead">
                    Usamos esses dados apenas para confirmar e lembrar você da consulta.
                  </p>
                </div>
                <div className="bk-form__grid">
                  <label className="bk-field bk-field--full" htmlFor="bk-name">
                    <span>Nome completo</span>
                    <input
                      id="bk-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Como devemos te chamar?"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                      minLength={2}
                      autoFocus
                    />
                  </label>
                  <label className="bk-field" htmlFor="bk-phone">
                    <span>Telefone / WhatsApp</span>
                    <input
                      id="bk-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(00) 00000-0000"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      required
                      minLength={8}
                    />
                  </label>
                  <label className="bk-field" htmlFor="bk-email">
                    <span>E-mail</span>
                    <input
                      id="bk-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="voce@email.com"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </label>
                </div>
                <p className="bk-privacy">{RETENTION_NOTICE}</p>
                <div className="bk-form__actions">
                  <button
                    type="button"
                    className="bk-btn bk-btn--ghost"
                    onClick={() => goToStep(1)}
                  >
                    <ArrowIcon dir="left" />
                    Voltar
                  </button>
                  <button className="bk-btn bk-btn--primary" type="submit">
                    Próximo passo
                    <ArrowIcon />
                  </button>
                </div>
              </motion.form>
            )}

            {step === 3 && (
              <motion.form
                key="step3"
                className="bk-step bk-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (specialtyId) goToStep(4)
                }}
                {...motionProps}
              >
                <div className="bk-form__head">
                  <h3 className="bk-step__title">Motivo da consulta</h3>
                  <p className="bk-step__lead">
                    Escolha a especialidade e, se quiser, marque os assuntos que deseja tratar.
                  </p>
                </div>

                {selectedDate && selectedSlot && (
                  <div className="bk-when">
                    <span className="bk-when__icon">
                      {MODALITY_BY_ID[selectedSlot.location]?.icon}
                    </span>
                    <span className="bk-when__text">
                      <strong>
                        {fmtLongDate(selectedDate)}, {fmtTime(selectedSlot.start)}
                      </strong>
                      <span>{MODALITY_LABELS[selectedSlot.location]}</span>
                    </span>
                    <button type="button" className="bk-when__edit" onClick={() => goToStep(1)}>
                      Alterar
                    </button>
                  </div>
                )}

                <fieldset className="bk-field bk-field--full bk-group">
                  <legend>
                    <span className="bk-group__num">1</span>
                    Especialidade
                  </legend>
                  {slotSpecialties.length === 0 ? (
                    <p className="bk-hint">
                      Nenhuma especialidade atende nesse horário. Volte e escolha outro.
                    </p>
                  ) : (
                    <div
                      className={`bk-chips${slotSpecialties.length === 1 ? ' bk-chips--single' : ''}`}
                      role="radiogroup"
                      aria-label="Especialidade"
                      onKeyDown={handleSpecialtyKeyDown}
                      // Column count that never leaves a lone card on the
                      // last row: 1–3 side by side, then rows of 3 or 2.
                      style={{
                        '--bk-chip-cols':
                          slotSpecialties.length <= 3
                            ? slotSpecialties.length
                            : slotSpecialties.length % 3 === 0
                              ? 3
                              : 2,
                      }}
                    >
                      {slotSpecialties.map((s, i) => {
                        const checked = specialtyId === s.id
                        const focusable = checked || (!specialtyId && i === 0)
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            tabIndex={focusable ? 0 : -1}
                            className={`bk-chip${checked ? ' is-selected' : ''}`}
                            onClick={() => setSpecialtyId(s.id)}
                          >
                            <span className="bk-chip__radio" aria-hidden="true">
                              <CheckIcon />
                            </span>
                            <span className="bk-chip__name">{s.name}</span>
                            <em>
                              <ClockIcon />
                              {s.slot_duration_min} min
                            </em>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </fieldset>

                <div className="bk-group bk-group--inline">
                  <span className="bk-group__label" id="bk-first-visit-label">
                    <span className="bk-group__num">2</span>
                    É sua primeira consulta?
                  </span>
                  <div
                    className="bk-toggle"
                    role="radiogroup"
                    aria-labelledby="bk-first-visit-label"
                  >
                    {[
                      { value: true, label: 'Sim' },
                      { value: false, label: 'Não' },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        role="radio"
                        aria-checked={form.firstVisit === opt.value}
                        className={`bk-toggle__opt${form.firstVisit === opt.value ? ' is-selected' : ''}`}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            firstVisit: f.firstVisit === opt.value ? null : opt.value,
                          }))
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <fieldset className="bk-field bk-field--full bk-group">
                  <legend>
                    <span className="bk-group__num">3</span>
                    Sobre o que você quer conversar?{' '}
                    <em>(opcional, marque quantos quiser)</em>
                  </legend>
                  <div className="bk-tags">
                    {REASON_TAGS.map((tag) => {
                      const on = form.reasons.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          aria-pressed={on}
                          className={`bk-tag${on ? ' is-selected' : ''}`}
                          onClick={() => toggleReason(tag)}
                        >
                          <span className="bk-tag__box" aria-hidden="true">
                            <CheckIcon />
                          </span>
                          {/* Non-breaking hyphen so "pré-natal" never splits. */}
                          {tag.replace('-', '‑')}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                <div className="bk-form__actions">
                  <button
                    type="button"
                    className="bk-btn bk-btn--ghost"
                    onClick={() => goToStep(2)}
                  >
                    <ArrowIcon dir="left" />
                    Voltar
                  </button>
                  <button
                    className="bk-btn bk-btn--primary"
                    type="submit"
                    disabled={!specialtyId}
                  >
                    Revisar agendamento
                    <ArrowIcon />
                  </button>
                </div>
              </motion.form>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                className={`bk-step bk-form bk-review${confirmation ? ' is-confirmed' : ''}`}
                {...motionProps}
              >
                <AutoHeight reduced={reducedMotion}>
                  <div className="bk-form__head bk-review__head bk-swap">
                    <AnimatePresence initial={false}>
                      {confirmation ? (
                        <motion.div
                          key="done"
                          className="bk-swap__item bk-review__done"
                          role="status"
                          {...swapMotion(reducedMotion, 0.34)}
                        >
                          <SuccessSeal reduced={reducedMotion} />
                          <h3 className="bk-step__title" ref={confirmedTitleRef} tabIndex={-1}>
                            {firstName ? (
                              <>
                                Consulta confirmada, <em>{firstName}</em>.
                              </>
                            ) : (
                              'Consulta confirmada!'
                            )}
                          </h3>
                          <p className="bk-step__lead">
                            Enviamos os detalhes e o link para gerenciar a consulta para{' '}
                            <strong>{confirmation.client_email}</strong>.
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="review"
                          className="bk-swap__item"
                          {...swapMotion(reducedMotion)}
                        >
                          <h3 className="bk-step__title">
                            {firstName ? (
                              <>
                                Quase lá, <em>{firstName}</em>.
                              </>
                            ) : (
                              'Quase lá.'
                            )}
                          </h3>
                          <p className="bk-step__lead">
                            Dê uma última olhada no seu horário. Se algo não estiver como você
                            imaginou, é só tocar no lápis para ajustar.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </AutoHeight>

                <motion.article
                  className="bk-ticket"
                  aria-label="Resumo da consulta"
                  {...(reducedMotion
                    ? {}
                    : {
                        initial: { opacity: 0, y: 14, rotate: -0.6 },
                        animate: { opacity: 1, y: 0, rotate: 0 },
                        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.08 },
                      })}
                >
                  {selectedDate && selectedSlot && (
                    <div className="bk-ticket__when">
                      <div className="bk-ticket__stamp" aria-hidden="true">
                        <span className="bk-ticket__month">
                          {MONTHS_LONG[parseIso(selectedDate).getMonth()].slice(0, 3)}
                        </span>
                        <span className="bk-ticket__day">{parseIso(selectedDate).getDate()}</span>
                        <span className="bk-ticket__weekday">
                          {WEEKDAY_HEAD[parseIso(selectedDate).getDay()]}
                        </span>
                        <AnimatePresence>
                          {confirmation && (
                            <motion.span
                              className="bk-ticket__verified"
                              initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{
                                type: 'spring',
                                stiffness: 520,
                                damping: 20,
                                delay: 0.95,
                              }}
                            >
                              <CheckIcon />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="bk-ticket__slot">
                        <span className="bk-ticket__date">{fmtLongDate(selectedDate)}</span>
                        <strong className="bk-ticket__time">
                          {fmtTime(selectedSlot.start)}
                          <span> às {fmtTime(selectedSlot.end)}</span>
                        </strong>
                        <span className="bk-ticket__place">
                          {MODALITY_BY_ID[selectedSlot.location]?.icon}
                          {MODALITY_LABELS[selectedSlot.location]}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="bk-ticket__edit"
                        onClick={() => goToStep(1)}
                        disabled={!!confirmation}
                        aria-label="Alterar data, horário ou modalidade"
                        title="Alterar"
                      >
                        <PencilIcon />
                      </button>
                    </div>
                  )}

                  <div className="bk-ticket__tear" aria-hidden="true" />

                  <div className="bk-ticket__body">
                    <section className="bk-ticket__row">
                      <div className="bk-ticket__text">
                        <span className="bk-ticket__kicker">Você vai ser atendida em</span>
                        <p className="bk-ticket__main">
                          {specialty?.name}
                          {form.firstVisit !== null && (
                            <span className="bk-ticket__badge">
                              {form.firstVisit ? 'Primeira consulta' : 'Retorno'}
                            </span>
                          )}
                        </p>
                        {form.reasons.length > 0 && (
                          <>
                            <span className="bk-ticket__kicker bk-ticket__kicker--sub">
                              e quer conversar sobre
                            </span>
                            <ul className="bk-ticket__topics">
                              {form.reasons.map((r) => (
                                <li key={r}>{r.replace('-', '‑')}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        className="bk-ticket__edit"
                        onClick={() => goToStep(3)}
                        disabled={!!confirmation}
                        aria-label="Alterar especialidade e motivo"
                        title="Alterar"
                      >
                        <PencilIcon />
                      </button>
                    </section>

                    <section className="bk-ticket__row">
                      <div className="bk-ticket__text">
                        <span className="bk-ticket__kicker">Vamos falar com você por aqui</span>
                        <p className="bk-ticket__main bk-ticket__main--sm">{form.name}</p>
                        <p className="bk-ticket__contact">
                          <span>{form.email}</span>
                          <span>{form.phone}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        className="bk-ticket__edit"
                        onClick={() => goToStep(2)}
                        disabled={!!confirmation}
                        aria-label="Alterar seus dados"
                        title="Alterar"
                      >
                        <PencilIcon />
                      </button>
                    </section>
                  </div>

                  {/* One light sweep across the ticket as it becomes "real" —
                      the Wallet-pass-added moment. */}
                  {confirmation && !reducedMotion && (
                    <span className="bk-ticket__sheen" aria-hidden="true">
                      <motion.span
                        initial={{ x: '-120%' }}
                        animate={{ x: '120%' }}
                        transition={{ duration: 1.25, ease: [0.45, 0, 0.2, 1], delay: 0.62 }}
                      />
                    </span>
                  )}
                </motion.article>

                <AutoHeight reduced={reducedMotion}>
                  <div className="bk-swap">
                    <AnimatePresence initial={false}>
                      {confirmation ? (
                        <motion.div
                          key="done"
                          className="bk-swap__item bk-review__after"
                          {...swapMotion(reducedMotion, 0.8)}
                        >
                          <button className="bk-btn bk-btn--ghost" type="button" onClick={reset}>
                            Fazer novo agendamento
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="review"
                          className="bk-swap__item"
                          {...swapMotion(reducedMotion)}
                        >
                          <div className="bk-form__actions">
                            <button
                              type="button"
                              className="bk-btn bk-btn--ghost"
                              onClick={() => goToStep(3)}
                              disabled={submitting}
                            >
                              <ArrowIcon dir="left" />
                              Voltar
                            </button>
                            <button
                              className={`bk-btn bk-btn--primary${submitting ? ' is-busy' : ''}`}
                              type="button"
                              onClick={handleSubmit}
                              disabled={submitting}
                            >
                              {submitting && <span className="bk-spinner" aria-hidden="true" />}
                              {submitting ? 'Confirmando…' : 'Confirmar agendamento'}
                            </button>
                          </div>
                          <p className="bk-form__note">
                            Sem pagamento agora. Você recebe os detalhes e o link para gerenciar
                            a consulta por e-mail.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </AutoHeight>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <p className="bk-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
