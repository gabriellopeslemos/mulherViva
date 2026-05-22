import { useCallback, useEffect, useRef, useState } from 'react'

// ── Design tokens (scoped to agenda panel) ──────────────────────────────────
const T = {
  bg: '#f7eef3',
  surface: '#fffafb',
  surfaceSoft: '#f6edf2',
  textStrong: '#1f1119',
  text: '#2a1a24',
  textSoft: '#4a3541',
  textMuted: '#5b4552',
  accent: '#7a3e6a',
  accentStrong: '#5e2f52',
  line: '#dcc7d2',
  serif: '"Lora","Palatino Linotype",Georgia,serif',
  sans: '"Mulish","Gill Sans",system-ui,sans-serif',
  ease: 'cubic-bezier(0.22,1,0.36,1)',
}

// ── Data ─────────────────────────────────────────────────────────────────────
const DAYS   = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho',
                'julho','agosto','setembro','outubro','novembro','dezembro']
const WEEK_DATES = [
  new Date(2026, 4, 11), new Date(2026, 4, 12), new Date(2026, 4, 13),
  new Date(2026, 4, 14), new Date(2026, 4, 15),
]
const TODAY = new Date(2026, 4, 17)
const START_HOUR = 8
const END_HOUR = 19
const STATUS_LABELS = { confirmed: 'Confirmado', pending: 'Aguardando', cancelled: 'Cancelado' }

const INITIAL_APPOINTMENTS = [
  { id: 1,  dayIdx: 0, start: '08:30', end: '09:30', client: 'Maria Santos',      specialty: 'Ginecologia Integrativa',  type: 'online',     status: 'confirmed', notes: 'Primeira consulta. Queixa de irregularidade menstrual e cólicas intensas.' },
  { id: 2,  dayIdx: 0, start: '10:00', end: '11:00', client: 'Ana Paula Ferreira', specialty: 'Obstetrícia Humanizada',   type: 'presencial', location: 'Centro Médico Lúcio Costa', status: 'confirmed', notes: 'Pré-natal — 20ª semana. Exames em dia.' },
  { id: 3,  dayIdx: 0, start: '11:30', end: '12:30', client: 'Fernanda Lima',      specialty: 'Homeopatia Clínica',       type: 'online',     status: 'pending',   notes: 'Acompanhamento. Ansiedade e distúrbios de sono.' },
  { id: 4,  dayIdx: 0, start: '14:00', end: '15:00', client: 'Carolina Alves',     specialty: 'Ginecologia Integrativa',  type: 'presencial', location: 'Centro Médico Lúcio Costa', status: 'confirmed' },
  { id: 5,  dayIdx: 0, start: '16:30', end: '17:30', client: 'Juliana Costa',      specialty: 'Obstetrícia Humanizada',   type: 'online',     status: 'confirmed' },
  { id: 6,  dayIdx: 1, start: '09:00', end: '10:00', client: 'Beatriz Souza',      specialty: 'Ginecologia Integrativa',  type: 'presencial', location: 'Centro Médico Lúcio Costa', status: 'confirmed' },
  { id: 7,  dayIdx: 1, start: '10:30', end: '11:30', client: 'Renata Oliveira',    specialty: 'Homeopatia Clínica',       type: 'online',     status: 'pending' },
  { id: 8,  dayIdx: 1, start: '14:00', end: '15:00', client: 'Camila Rodrigues',   specialty: 'Obstetrícia Humanizada',   type: 'presencial', location: 'Centro Médico Lúcio Costa', status: 'confirmed' },
  { id: 9,  dayIdx: 1, start: '16:00', end: '16:30', client: 'Patrícia Mendes',    specialty: 'Ginecologia Integrativa',  type: 'online',     status: 'confirmed', notes: 'Retorno — aguardando resultado de exames laboratoriais.' },
  { id: 10, dayIdx: 2, start: '08:00', end: '09:30', client: 'Amanda Pereira',     specialty: 'Obstetrícia Humanizada',   type: 'presencial', location: 'Centro Médico Lúcio Costa', status: 'confirmed', notes: 'Pré-natal — 32ª semana. Consulta longa programada. Trazer cardiotocografia.' },
  { id: 11, dayIdx: 2, start: '11:00', end: '12:00', client: 'Isabela Nunes',      specialty: 'Ginecologia Integrativa',  type: 'online',     status: 'confirmed' },
  { id: 12, dayIdx: 2, start: '15:00', end: '16:00', client: 'Luciana Carvalho',   specialty: 'Homeopatia Clínica',       type: 'presencial', location: 'Centro Médico Lúcio Costa', status: 'pending' },
  { id: 13, dayIdx: 2, start: '17:00', end: '18:00', client: 'Mariana Santos',     specialty: 'Ginecologia Integrativa',  type: 'online',     status: 'cancelled' },
  { id: 14, dayIdx: 3, start: '09:30', end: '10:30', client: 'Thaís Gomes',        specialty: 'Ginecologia Integrativa',  type: 'presencial', location: 'Centro Médico Lúcio Costa', status: 'confirmed' },
  { id: 15, dayIdx: 3, start: '11:00', end: '12:00', client: 'Brenda Macedo',      specialty: 'Obstetrícia Humanizada',   type: 'online',     status: 'confirmed' },
  { id: 16, dayIdx: 3, start: '14:30', end: '15:30', client: 'Viviane Torres',     specialty: 'Homeopatia Clínica',       type: 'presencial', location: 'Centro Médico Lúcio Costa', status: 'pending' },
  { id: 17, dayIdx: 4, start: '08:00', end: '09:00', client: 'Gabriela Lima',      specialty: 'Ginecologia Integrativa',  type: 'online',     status: 'confirmed' },
  { id: 18, dayIdx: 4, start: '10:00', end: '11:30', client: 'Daniela Freitas',    specialty: 'Obstetrícia Humanizada',   type: 'presencial', location: 'Centro Médico Lúcio Costa', status: 'confirmed', notes: 'Pré-natal — 28ª semana. Trazer USG morfológico e hemograma.' },
  { id: 19, dayIdx: 4, start: '13:00', end: '14:00', client: 'Karina Barbosa',     specialty: 'Ginecologia Integrativa',  type: 'online',     status: 'pending' },
  { id: 20, dayIdx: 4, start: '15:30', end: '16:30', client: 'Mônica Pires',       specialty: 'Homeopatia Clínica',       type: 'presencial', location: 'Centro Médico Lúcio Costa', status: 'confirmed' },
]

// ── Utilities ─────────────────────────────────────────────────────────────────
function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function getApptPosition(start, end, hourHeight = 80) {
  const sMin = timeToMinutes(start)
  const eMin = timeToMinutes(end)
  const top    = ((sMin - START_HOUR * 60) / 60) * hourHeight
  const height = Math.max(((eMin - sMin) / 60) * hourHeight - 4, 22)
  return { top: top + 'px', height: height + 'px' }
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2.5"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
  </svg>
)
const IconVideo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23,7 16,12 23,17 23,7"/><rect x="1" y="5" width="15" height="14" rx="2.5"/>
  </svg>
)
const IconPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
)
const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
)
const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IconX = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconChevronLeft = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15,18 9,12 15,6"/>
  </svg>
)
const IconChevronRight = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9,18 15,12 9,6"/>
  </svg>
)
const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconNote = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
  </svg>
)
const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)
const IconBell = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)
const IconNavPeople = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IconNavChart = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)
const IconNavGear = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

// ── Mini Calendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ selectedDate, onSelect, appointments }) {
  const [viewMonth, setViewMonth] = useState(4)
  const [viewYear, setViewYear]   = useState(2026)

  const apptDays = new Set(
    (appointments || []).map(a => {
      const d = WEEK_DATES[a.dayIdx]
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  )

  const firstDow     = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()
  const startOffset  = (firstDow + 6) % 7

  const cells = []
  for (let i = startOffset - 1; i >= 0; i--)
    cells.push({ day: prevMonthDays - i, month: viewMonth - 1, year: viewYear, other: true })
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, month: viewMonth, year: viewYear, other: false })
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++)
    cells.push({ day: d, month: viewMonth + 1, year: viewYear, other: true })

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <button onClick={prevMonth} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, padding:'4px 6px', borderRadius:6, display:'flex', alignItems:'center' }}>
          <IconChevronLeft />
        </button>
        <span style={{ fontSize:12, fontWeight:700, color:T.textStrong, textTransform:'capitalize', fontFamily:T.serif }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, padding:'4px 6px', borderRadius:6, display:'flex', alignItems:'center' }}>
          <IconChevronRight />
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2 }}>
        {['S','T','Q','Q','S','S','D'].map((d, i) => (
          <div key={i} style={{ fontSize:9, fontWeight:700, textAlign:'center', padding:'4px 0', color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.06em' }}>{d}</div>
        ))}
        {cells.map((cell, i) => {
          const isToday    = !cell.other && cell.month === TODAY.getMonth() && cell.day === TODAY.getDate() && cell.year === TODAY.getFullYear()
          const key        = `${cell.year}-${cell.month}-${cell.day}`
          const hasAppts   = apptDays.has(key)
          const isSelected = selectedDate && !cell.other &&
            selectedDate.getDate() === cell.day && selectedDate.getMonth() === cell.month && selectedDate.getFullYear() === cell.year

          return (
            <div key={i} onClick={() => !cell.other && onSelect(new Date(cell.year, cell.month, cell.day))}
              style={{
                fontSize:11, textAlign:'center', padding:'5px 2px', borderRadius:'50%',
                cursor: cell.other ? 'default' : 'pointer',
                color:  cell.other ? T.line : isToday ? 'white' : isSelected ? T.accent : T.textSoft,
                background: isToday ? T.accent : isSelected ? T.surfaceSoft : 'transparent',
                fontWeight: (isToday || isSelected) ? 700 : 400,
                outline: isSelected && !isToday ? `1.5px solid ${T.accent}` : 'none',
                transition: 'all 150ms', position:'relative', lineHeight:1,
                aspectRatio:'1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              }}>
              {cell.day}
              {hasAppts && !isToday && !cell.other && (
                <span style={{ display:'block', width:3, height:3, borderRadius:'50%', background:T.accent, position:'absolute', bottom:1, left:'50%', transform:'translateX(-50%)' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Appointment Block ─────────────────────────────────────────────────────────
function ApptBlock({ appt, onClick, hourHeight }) {
  const [hovered, setHovered] = useState(false)
  const pos = getApptPosition(appt.start, appt.end, hourHeight)
  const durationMins = timeToMinutes(appt.end) - timeToMinutes(appt.start)
  const isShort      = durationMins <= 30
  const isCancelled  = appt.status === 'cancelled'
  const isPending    = appt.status === 'pending'

  const colors = {
    online:     { bg: 'rgba(122,62,106,0.09)',  hoverBg: 'rgba(122,62,106,0.15)', border: T.accent },
    presencial: { bg: 'rgba(94,47,82,0.11)',    hoverBg: 'rgba(94,47,82,0.18)',   border: T.accentStrong },
  }
  const c = colors[appt.type] || colors.online

  return (
    <div onClick={() => onClick(appt)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:'absolute', top:pos.top, height:pos.height, left:5, right:5,
        borderRadius:10, padding: isShort ? '5px 8px' : '8px 10px',
        cursor:'pointer', overflow:'hidden',
        background: isCancelled ? 'rgba(220,199,210,0.22)' : hovered ? c.hoverBg : c.bg,
        borderLeft: `3px ${isPending ? 'dashed' : 'solid'} ${isCancelled ? T.line : c.border}`,
        opacity: isCancelled ? 0.5 : isPending ? 0.76 : 1,
        transform: hovered ? 'translateX(2px) scale(1.005)' : 'none',
        boxShadow: hovered ? '0 6px 20px rgba(90,52,78,0.12)' : 'none',
        transition: `all 200ms ${T.ease}`,
        zIndex: hovered ? 10 : 5, userSelect:'none',
      }}>
      <div style={{ fontSize:11, fontWeight:700, color: isCancelled ? T.textMuted : T.textStrong, lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textDecoration: isCancelled ? 'line-through' : 'none', fontFamily:T.sans }}>
        {appt.client}
      </div>
      {!isShort && (
        <>
          <div style={{ fontSize:9.5, color:T.textMuted, marginTop:2, lineHeight:1, fontFamily:T.sans }}>{appt.start} – {appt.end}</div>
          {durationMins >= 60 && (
            <div style={{ fontSize:9.5, color:T.textSoft, marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:T.sans }}>{appt.specialty}</div>
          )}
          {durationMins >= 60 && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:3, marginTop:4, padding:'2px 6px', borderRadius:999, fontSize:8.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', background: appt.type === 'online' ? 'rgba(122,62,106,0.13)' : 'rgba(94,47,82,0.13)', color: appt.type === 'online' ? T.accent : T.accentStrong, fontFamily:T.sans }}>
              {appt.type === 'online' ? <IconVideo /> : <IconPin />}
              {appt.type === 'online' ? 'Online' : 'Presencial'}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Info Row ──────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display:'flex', gap:11, alignItems:'flex-start' }}>
      <div style={{ width:30, height:30, borderRadius:8, background:T.surfaceSoft, border:`1px solid ${T.line}`, display:'flex', alignItems:'center', justifyContent:'center', color:T.accent, flexShrink:0 }}>
        {icon}
      </div>
      <div style={{ paddingTop:2 }}>
        <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:T.textMuted, marginBottom:2, fontFamily:T.sans }}>{label}</div>
        <div style={{ fontSize:13, color:T.textSoft, lineHeight:1.5, fontFamily:T.sans }}>{value}</div>
      </div>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
function DetailPanel({ appt, onClose }) {
  const [localStatus, setLocalStatus] = useState(appt.status)
  useEffect(() => { setLocalStatus(appt.status) }, [appt.id])

  const dayDate  = WEEK_DATES[appt.dayIdx]
  const initials = appt.client.split(' ').map(n => n[0]).slice(0, 2).join('')

  const statusColors = {
    confirmed: { bg: 'rgba(122,62,106,0.1)', color: T.accent,    dot: T.accent },
    pending:   { bg: 'rgba(220,199,210,0.5)', color: T.textMuted, dot: '#b09ea9' },
    cancelled: { bg: 'rgba(210,180,195,0.3)', color: T.textMuted, dot: '#c9b3be' },
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflowY:'auto', fontFamily:T.sans }}>
      <div style={{ padding:'18px 20px 16px', borderBottom:`1px solid ${T.line}`, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:T.surface, zIndex:10 }}>
        <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.2em', color:T.textMuted }}>Consulta</span>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, display:'flex', padding:5, borderRadius:7, transition:'all 150ms' }}>
          <IconX />
        </button>
      </div>
      <div style={{ padding:20, display:'flex', flexDirection:'column', gap:18, flex:1 }}>
        <div style={{ background:T.surfaceSoft, borderRadius:14, padding:16, border:`1px solid ${T.line}` }}>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ width:44, height:44, borderRadius:'50%', background:`linear-gradient(135deg, ${T.accent} 0%, ${T.accentStrong} 100%)`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:15, flexShrink:0, fontFamily:T.serif, boxShadow:'0 4px 12px rgba(122,62,106,0.25)' }}>
              {initials}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:14, color:T.textStrong, fontFamily:T.serif, lineHeight:1.3, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{appt.client}</div>
              <div style={{ fontSize:11, color:T.textMuted, lineHeight:1.3 }}>{appt.specialty}</div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:T.textMuted, marginBottom:8 }}>Status</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['confirmed','pending','cancelled'].map(s => {
              const sc = statusColors[s]
              const isActive = localStatus === s
              return (
                <button key={s} onClick={() => setLocalStatus(s)} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:999, border: isActive ? `1.5px solid ${T.accent}` : '1.5px solid transparent', background: isActive ? sc.bg : T.surfaceSoft, color: isActive ? sc.color : T.textMuted, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', cursor:'pointer', fontFamily:T.sans, transition:'all 180ms', opacity: isActive ? 1 : 0.6 }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background:sc.dot, display:'inline-block', flexShrink:0 }} />
                  {STATUS_LABELS[s]}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <InfoRow icon={<IconCalendar />} label="Data"      value={`${DAYS[appt.dayIdx]}., ${dayDate.getDate()} de ${MONTHS[dayDate.getMonth()]} de ${dayDate.getFullYear()}`} />
          <InfoRow icon={<IconClock />}    label="Horário"   value={`${appt.start} – ${appt.end}`} />
          <InfoRow icon={appt.type === 'online' ? <IconVideo /> : <IconPin />} label="Modalidade" value={appt.type === 'online' ? 'Videoconferência' : `Presencial — ${appt.location || 'Centro Médico Lúcio Costa'}`} />
        </div>

        {appt.notes && (
          <div style={{ background:'rgba(122,62,106,0.055)', borderRadius:12, padding:'12px 14px', borderLeft:'3px solid rgba(122,62,106,0.35)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
              <IconNote />
              <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:T.textMuted }}>Observações</span>
            </div>
            <div style={{ fontSize:12.5, color:T.textSoft, lineHeight:1.65, fontStyle:'italic', fontFamily:T.serif }}>{appt.notes}</div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:'auto', paddingTop:8 }}>
          {localStatus === 'pending' && (
            <button onClick={() => setLocalStatus('confirmed')} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, background:T.accent, color:'white', border:'none', borderRadius:999, padding:'10px 18px', fontFamily:T.sans, fontSize:12.5, fontWeight:700, cursor:'pointer', boxShadow:'0 8px 22px rgba(122,62,106,0.28)', transition:`all 200ms ${T.ease}` }}>
              <IconCheck /> Confirmar consulta
            </button>
          )}
          <button style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, background:T.surfaceSoft, color:T.textSoft, border:`1px solid ${T.line}`, borderRadius:999, padding:'9px 18px', fontFamily:T.sans, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 180ms' }}>
            <IconRefresh /> Reagendar
          </button>
          {localStatus !== 'cancelled' && (
            <button onClick={() => setLocalStatus('cancelled')} style={{ background:'transparent', color:'#b05060', border:'1px solid rgba(176,80,96,0.28)', borderRadius:999, padding:'9px 18px', fontFamily:T.sans, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 180ms' }}>
              Cancelar consulta
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────
function WeekView({ appointments, onApptClick, selectedDayIdx, hourHeight }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const apptsByDay = appointments.reduce((acc, a) => {
    if (!acc[a.dayIdx]) acc[a.dayIdx] = []
    acc[a.dayIdx].push(a)
    return acc
  }, {})

  return (
    <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', fontFamily:T.sans }}>
      <div style={{ display:'grid', gridTemplateColumns:'52px repeat(5, 1fr)', position:'sticky', top:0, zIndex:20, background:T.surface, borderBottom:`2px solid ${T.line}`, flexShrink:0 }}>
        <div style={{ borderRight:`1px solid ${T.line}` }} />
        {WEEK_DATES.map((date, i) => {
          const count = (apptsByDay[i] || []).length
          const isSelected = selectedDayIdx === i
          return (
            <div key={i} style={{ padding:'11px 8px', textAlign:'center', borderRight:`1px solid ${T.line}`, background: isSelected ? 'rgba(122,62,106,0.04)' : 'transparent', transition:'background 200ms' }}>
              <div style={{ fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color: isSelected ? T.accent : T.textMuted, marginBottom:4 }}>{DAYS[i]}</div>
              <div style={{ fontSize:21, fontWeight:700, fontFamily:T.serif, color: isSelected ? T.accent : T.textStrong, lineHeight:1 }}>{date.getDate()}</div>
              {count > 0 && <div style={{ fontSize:9, color: isSelected ? T.accent : T.textMuted, marginTop:4 }}>{count} consulta{count !== 1 ? 's' : ''}</div>}
            </div>
          )
        })}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'52px repeat(5, 1fr)', flex:1 }}>
        <div style={{ borderRight:`1px solid ${T.line}` }}>
          {hours.map(h => (
            <div key={h} style={{ height:hourHeight, borderBottom:'1px solid rgba(220,199,210,0.35)', position:'relative' }}>
              <span style={{ position:'absolute', top:-7, right:7, fontSize:9.5, color:T.textMuted, fontWeight:600, background:T.surface, padding:'0 2px', letterSpacing:'0.03em' }}>{String(h).padStart(2,'0')}h</span>
            </div>
          ))}
        </div>
        {WEEK_DATES.map((_, dayIdx) => (
          <div key={dayIdx} style={{ borderRight:`1px solid ${T.line}`, position:'relative', background: selectedDayIdx === dayIdx ? 'rgba(122,62,106,0.018)' : 'transparent' }}>
            {hours.map(h => <div key={h} style={{ height:hourHeight, borderBottom:'1px solid rgba(220,199,210,0.35)' }} />)}
            {(apptsByDay[dayIdx] || []).map(appt => (
              <ApptBlock key={appt.id} appt={appt} onClick={onApptClick} hourHeight={hourHeight} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Day View ──────────────────────────────────────────────────────────────────
function DayView({ dayIdx, appointments, onApptClick, hourHeight }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const dayAppts = appointments.filter(a => a.dayIdx === dayIdx)
  const date = WEEK_DATES[dayIdx]

  const statusCounts = dayAppts.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', fontFamily:T.sans }}>
      <div style={{ position:'sticky', top:0, zIndex:20, background:T.surface, borderBottom:`2px solid ${T.line}`, padding:'14px 24px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.2em', color:T.accent, marginBottom:3 }}>{DAYS[dayIdx]}</div>
          <div style={{ fontFamily:T.serif, fontSize:22, fontWeight:600, color:T.textStrong, lineHeight:1 }}>{date.getDate()} de {MONTHS[date.getMonth()]}, {date.getFullYear()}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {statusCounts.confirmed > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:999, background:'rgba(122,62,106,0.09)', fontSize:11, fontWeight:600, color:T.accent }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:T.accent, display:'inline-block' }} />
              {statusCounts.confirmed} confirmada{statusCounts.confirmed !== 1 ? 's' : ''}
            </div>
          )}
          {statusCounts.pending > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:999, background:'rgba(220,199,210,0.35)', fontSize:11, fontWeight:600, color:T.textMuted }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:T.textMuted, display:'inline-block' }} />
              {statusCounts.pending} aguardando
            </div>
          )}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'52px 1fr', flex:1 }}>
        <div style={{ borderRight:`1px solid ${T.line}` }}>
          {hours.map(h => (
            <div key={h} style={{ height:hourHeight, borderBottom:'1px solid rgba(220,199,210,0.35)', position:'relative' }}>
              <span style={{ position:'absolute', top:-7, right:7, fontSize:9.5, color:T.textMuted, fontWeight:600, background:T.surface, padding:'0 2px' }}>{String(h).padStart(2,'0')}h</span>
            </div>
          ))}
        </div>
        <div style={{ position:'relative' }}>
          {hours.map(h => <div key={h} style={{ height:hourHeight, borderBottom:'1px solid rgba(220,199,210,0.35)' }} />)}
          {dayAppts.map(appt => <ApptBlock key={appt.id} appt={appt} onClick={onApptClick} hourHeight={hourHeight} />)}
        </div>
      </div>
    </div>
  )
}

// ── New Appointment Modal ─────────────────────────────────────────────────────
function NewApptModal({ onClose }) {
  const [form, setForm] = useState({ client:'', specialty:'Ginecologia Integrativa', type:'online', date:'2026-05-11', start:'09:00', end:'10:00', notes:'' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const fieldStyle = { width:'100%', padding:'10px 14px', borderRadius:999, border:`1.5px solid ${T.line}`, background:T.surfaceSoft, fontFamily:T.sans, fontSize:13, color:T.text, outline:'none' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(31,17,25,0.35)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, animation:'agendaFadeIn 200ms ease' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:T.surface, borderRadius:22, padding:28, width:400, boxShadow:'0 28px 72px rgba(90,52,78,0.14)', animation:'agendaSlideUp 260ms ease', fontFamily:T.sans }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
          <h2 style={{ fontFamily:T.serif, fontSize:18, fontWeight:600, color:T.textStrong, margin:0 }}>Nova consulta</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, padding:4, display:'flex' }}><IconX /></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:T.textMuted, display:'block', marginBottom:5 }}>Paciente</label>
            <input style={fieldStyle} placeholder="Nome completo" value={form.client} onChange={e => set('client', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:T.textMuted, display:'block', marginBottom:5 }}>Especialidade</label>
            <select style={{ ...fieldStyle, appearance:'none', cursor:'pointer' }} value={form.specialty} onChange={e => set('specialty', e.target.value)}>
              <option>Ginecologia Integrativa</option>
              <option>Obstetrícia Humanizada</option>
              <option>Homeopatia Clínica</option>
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:T.textMuted, display:'block', marginBottom:5 }}>Modalidade</label>
              <select style={{ ...fieldStyle, appearance:'none', cursor:'pointer' }} value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="online">Videoconferência</option>
                <option value="presencial">Presencial</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:T.textMuted, display:'block', marginBottom:5 }}>Data</label>
              <input style={fieldStyle} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:T.textMuted, display:'block', marginBottom:5 }}>Início</label>
              <input style={fieldStyle} type="time" value={form.start} onChange={e => set('start', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:T.textMuted, display:'block', marginBottom:5 }}>Término</label>
              <input style={fieldStyle} type="time" value={form.end} onChange={e => set('end', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:T.textMuted, display:'block', marginBottom:5 }}>Observações</label>
            <textarea style={{ ...fieldStyle, borderRadius:14, resize:'none' }} rows={2} placeholder="Notas sobre a consulta..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button onClick={onClose} style={{ flex:1, padding:'9px 0', borderRadius:999, border:`1px solid ${T.line}`, background:T.surfaceSoft, color:T.textSoft, fontFamily:T.sans, fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancelar</button>
            <button onClick={onClose} style={{ flex:1, padding:'9px 0', borderRadius:999, border:'none', background:T.accent, color:'white', fontFamily:T.sans, fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 18px rgba(122,62,106,0.28)' }}>Agendar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Agenda Panel (main export) ────────────────────────────────────────────────
export default function AgendaPanel({ onClose }) {
  const [appointments]  = useState(INITIAL_APPOINTMENTS)
  const [view,          setView]         = useState('week')
  const [selectedDay,   setSelectedDay]  = useState(null)
  const [selectedAppt,  setSelectedAppt] = useState(null)
  const [showModal,     setShowModal]    = useState(false)
  const [miniDate,      setMiniDate]     = useState(null)
  const [hourHeight,    setHourHeight]   = useState(80)

  const handleApptClick = useCallback(appt => {
    setSelectedAppt(appt)
    setSelectedDay(appt.dayIdx)
  }, [])

  const handleMiniSelect = useCallback(date => {
    setMiniDate(date)
    const idx = WEEK_DATES.findIndex(d => d.getDate() === date.getDate() && d.getMonth() === date.getMonth())
    if (idx !== -1) { setSelectedDay(idx); setView('day') }
  }, [])

  const total     = appointments.length
  const confirmed = appointments.filter(a => a.status === 'confirmed').length
  const pending   = appointments.filter(a => a.status === 'pending').length
  const online    = appointments.filter(a => a.type === 'online').length

  const weekLabel = view === 'day' && selectedDay !== null
    ? `${DAYS[selectedDay]}, ${WEEK_DATES[selectedDay].getDate()} de ${MONTHS[WEEK_DATES[selectedDay].getMonth()]}`
    : '11 – 15 de maio, 2026'

  const navLinkStyle = (active = false) => ({
    display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:9, fontSize:13, fontWeight:600,
    color: active ? T.accent : T.textSoft, cursor:'pointer', border:'none', background: active ? 'rgba(122,62,106,0.09)' : 'none',
    width:'100%', fontFamily:T.sans, textAlign:'left', transition:'all 160ms',
  })

  const statPillStyle = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', borderRadius:13, background:T.surfaceSoft, border:'1px solid transparent' }

  return (
    <>
      <style>{`
        @keyframes agendaFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes agendaSlideUp { from { transform: translateY(14px); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes agendaPanelIn { from { opacity: 0; transform: scale(0.98) } to { opacity: 1; transform: scale(1) } }
        .agenda-panel ::-webkit-scrollbar { width: 4px; height: 4px; }
        .agenda-panel ::-webkit-scrollbar-track { background: transparent; }
        .agenda-panel ::-webkit-scrollbar-thumb { background: ${T.line}; border-radius: 999px; }
      `}</style>

      <div className="agenda-panel" style={{ position:'fixed', inset:0, zIndex:150, display:'flex', height:'100vh', overflow:'hidden', background:T.bg, fontFamily:T.sans, animation:'agendaPanelIn 300ms ease', WebkitFontSmoothing:'antialiased' }}>

        {/* ── SIDEBAR ─────────────────────────────────── */}
        <aside style={{ width:252, minWidth:252, background:T.surface, borderRight:`1px solid ${T.line}`, display:'flex', flexDirection:'column', gap:22, padding:'18px 14px', overflowY:'auto' }}>

          {/* Logo + close */}
          <div style={{ display:'flex', alignItems:'center', gap:10, paddingBottom:16, borderBottom:`1px solid ${T.line}` }}>
            <div style={{ width:34, height:34, borderRadius:9, background:`linear-gradient(135deg, ${T.accent} 0%, ${T.accentStrong} 100%)`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontFamily:T.serif, fontSize:12, fontWeight:700, boxShadow:'0 4px 12px rgba(122,62,106,0.3)', flexShrink:0 }}>MV</div>
            <div>
              <div style={{ fontFamily:T.serif, fontSize:13, fontWeight:600, color:T.textStrong, lineHeight:1.2 }}>Mulher Viva</div>
              <div style={{ fontSize:10, color:T.textMuted, marginTop:1 }}>Dra. Luciana Lopes</div>
            </div>
            <div style={{ marginLeft:'auto', width:7, height:7, borderRadius:'50%', background:'#6dbf8f', boxShadow:'0 0 0 2px rgba(109,191,143,0.25)', flexShrink:0 }} title="Online" />
          </div>

          {/* New appt button */}
          <button onClick={() => setShowModal(true)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, width:'100%', padding:'10px 16px', border:'none', borderRadius:999, background:T.accent, color:'white', fontFamily:T.sans, fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 8px 22px rgba(122,62,106,0.28)', transition:`all 220ms ${T.ease}` }}>
            <IconPlus /> Nova consulta
          </button>

          {/* Nav */}
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.22em', color:T.textMuted, padding:'0 2px', marginBottom:6 }}>Menu</div>
            <button style={navLinkStyle(true)}><IconCalendar />Agenda<span style={{ width:6, height:6, borderRadius:'50%', background:T.accent, marginLeft:'auto', flexShrink:0 }} /></button>
            <button style={navLinkStyle()}><IconNavPeople />Pacientes</button>
            <button style={navLinkStyle()}><IconNavChart />Relatórios</button>
            <button style={navLinkStyle()}><IconNavGear />Configurações</button>
          </div>

          {/* Mini calendar */}
          <div style={{ borderTop:`1px solid ${T.line}`, paddingTop:18 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.22em', color:T.textMuted, padding:'0 2px', marginBottom:12 }}>Calendário</div>
            <MiniCalendar selectedDate={miniDate} onSelect={handleMiniSelect} appointments={appointments} />
          </div>

          {/* Stats */}
          <div>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.22em', color:T.textMuted, padding:'0 2px', marginBottom:10 }}>Esta semana</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
              <div style={statPillStyle}><div><div style={{ fontSize:20, fontWeight:700, fontFamily:T.serif, color:T.textStrong, lineHeight:1 }}>{total}</div><div style={{ fontSize:10, color:T.textMuted, marginTop:2, lineHeight:1.3 }}>Total</div></div></div>
              <div style={statPillStyle}><div><div style={{ fontSize:20, fontWeight:700, fontFamily:T.serif, color:T.accent, lineHeight:1 }}>{confirmed}</div><div style={{ fontSize:10, color:T.textMuted, marginTop:2, lineHeight:1.3 }}>Confirmadas</div></div></div>
              <div style={statPillStyle}><div><div style={{ fontSize:20, fontWeight:700, fontFamily:T.serif, color:'#b09060', lineHeight:1 }}>{pending}</div><div style={{ fontSize:10, color:T.textMuted, marginTop:2, lineHeight:1.3 }}>Aguardando</div></div></div>
              <div style={statPillStyle}><div><div style={{ fontSize:20, fontWeight:700, fontFamily:T.serif, color:T.textStrong, lineHeight:1 }}>{online}</div><div style={{ fontSize:10, color:T.textMuted, marginTop:2, lineHeight:1.3 }}>Online</div></div></div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ borderTop:`1px solid ${T.line}`, paddingTop:16 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.22em', color:T.textMuted, padding:'0 2px', marginBottom:10 }}>Legenda</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { bar: { background:'rgba(122,62,106,0.5)', borderLeft:'3px solid '+T.accent }, label:'Videoconferência' },
                { bar: { background:'rgba(94,47,82,0.5)',   borderLeft:'3px solid '+T.accentStrong }, label:'Presencial' },
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:7, fontSize:11, color:T.textSoft }}>
                  <div style={{ width:18, height:10, borderRadius:3, flexShrink:0, ...item.bar }} />
                  <span>{item.label}</span>
                </div>
              ))}
              <div style={{ height:1, background:T.line, margin:'3px 0' }} />
              {[
                { border:`1.5px solid ${T.accent}`, background:`rgba(122,62,106,0.1)`, label:'Confirmado' },
                { border:`1.5px dashed ${T.accent}`, opacity:0.7, label:'Aguardando' },
                { border:`1.5px solid ${T.line}`, background:'rgba(220,199,210,0.4)', label:'Cancelado' },
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:7, fontSize:11, color:T.textSoft }}>
                  <div style={{ width:18, height:10, borderRadius:3, flexShrink:0, ...item }} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Back to site */}
          <div style={{ marginTop:'auto', borderTop:`1px solid ${T.line}`, paddingTop:14 }}>
            <button onClick={onClose} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', borderRadius:9, fontSize:12, fontWeight:600, color:T.textMuted, border:'none', background:'none', cursor:'pointer', fontFamily:T.sans, transition:'all 160ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = T.surfaceSoft; e.currentTarget.style.color = T.accent }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = T.textMuted }}>
              <IconChevronLeft /> Voltar ao site
            </button>
          </div>
        </aside>

        {/* ── MAIN ────────────────────────────────────── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

          {/* Topbar */}
          <div style={{ height:56, flexShrink:0, borderBottom:`1px solid ${T.line}`, background:T.surface, display:'flex', alignItems:'center', padding:'0 20px', gap:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
              <button style={{ display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, border:`1px solid ${T.line}`, borderRadius:8, background:T.surfaceSoft, color:T.textMuted, cursor:'pointer', transition:'all 160ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = T.accent; e.currentTarget.style.color = 'white' }}
                onMouseLeave={e => { e.currentTarget.style.background = T.surfaceSoft; e.currentTarget.style.color = T.textMuted }}>
                <IconChevronLeft />
              </button>
              <button style={{ display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, border:`1px solid ${T.line}`, borderRadius:8, background:T.surfaceSoft, color:T.textMuted, cursor:'pointer', transition:'all 160ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = T.accent; e.currentTarget.style.color = 'white' }}
                onMouseLeave={e => { e.currentTarget.style.background = T.surfaceSoft; e.currentTarget.style.color = T.textMuted }}>
                <IconChevronRight />
              </button>
              <button style={{ padding:'5px 13px', borderRadius:999, border:`1px solid ${T.line}`, background:T.surfaceSoft, color:T.textMuted, fontFamily:T.sans, fontSize:11.5, fontWeight:700, cursor:'pointer', transition:'all 160ms' }}>Hoje</button>
              <span style={{ fontFamily:T.serif, fontSize:15, fontWeight:600, color:T.textStrong, paddingLeft:4, whiteSpace:'nowrap' }}>{weekLabel}</span>
            </div>

            <div style={{ display:'flex', background:T.surfaceSoft, borderRadius:9, padding:3, gap:2 }}>
              {['week','day'].map(v => (
                <button key={v} onClick={() => { setView(v); if (v === 'day' && selectedDay === null) setSelectedDay(0) }} style={{ padding:'5px 14px', borderRadius:7, border:'none', background: view === v ? T.surface : 'none', fontFamily:T.sans, fontSize:12, fontWeight:700, color: view === v ? T.accent : T.textMuted, cursor:'pointer', boxShadow: view === v ? '0 1px 4px rgba(90,52,78,0.1)' : 'none', transition:'all 160ms' }}>
                  {v === 'week' ? 'Semana' : 'Dia'}
                </button>
              ))}
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, justifyContent:'flex-end' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:T.textMuted }}>Altura</span>
                {[60,80,100].map(h => (
                  <button key={h} onClick={() => setHourHeight(h)} style={{ width:26, height:22, borderRadius:6, border:'1px solid', borderColor: hourHeight === h ? T.accent : T.line, background: hourHeight === h ? 'rgba(122,62,106,0.09)' : T.surfaceSoft, color: hourHeight === h ? T.accent : T.textMuted, fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:T.sans }}>
                    {h === 60 ? 'P' : h === 80 ? 'M' : 'G'}
                  </button>
                ))}
              </div>
              <div style={{ width:1, height:22, background:T.line }} />
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 14px', borderRadius:999, border:`1px solid ${T.line}`, background:T.surfaceSoft, color:T.textMuted, fontSize:12 }}>
                <IconSearch /><span>Buscar paciente...</span>
              </div>
              <button style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, display:'flex', position:'relative', padding:4 }}>
                <IconBell />
                <span style={{ position:'absolute', top:2, right:2, width:7, height:7, borderRadius:'50%', background:T.accent, border:`1.5px solid ${T.surface}` }} />
              </button>
              <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${T.accent},${T.accentStrong})`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:11, fontWeight:700, flexShrink:0, cursor:'pointer', boxShadow:'0 3px 10px rgba(122,62,106,0.3)' }}>LL</div>
            </div>
          </div>

          {/* Calendar + detail */}
          <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
            <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', minWidth:0 }}>
              {view === 'week'
                ? <WeekView appointments={appointments} onApptClick={handleApptClick} selectedDayIdx={selectedDay} hourHeight={hourHeight} />
                : <DayView  dayIdx={selectedDay ?? 0} appointments={appointments} onApptClick={handleApptClick} hourHeight={hourHeight} />
              }
            </div>

            {/* Detail panel */}
            <div style={{ overflow:'hidden', flexShrink:0, borderLeft:`1px solid ${T.line}`, background:T.surface, transition:`width 360ms ${T.ease}`, width: selectedAppt ? 290 : 0 }}>
              <div style={{ width:290, height:'100%' }}>
                {selectedAppt && <DetailPanel appt={selectedAppt} onClose={() => setSelectedAppt(null)} />}
              </div>
            </div>
          </div>
        </div>

        {showModal && <NewApptModal onClose={() => setShowModal(false)} />}
      </div>
    </>
  )
}
