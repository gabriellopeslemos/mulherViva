import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import AvailabilityModal from './AvailabilityModal'
import { T } from './agenda/theme'
import { IconCalendar, IconPlus, IconChevronLeft, IconChevronRight, IconSearch, IconBell, IconNavPeople, IconNavChart, IconNavGear, IconMenu, IconX } from './agenda/ui'
import {
  DAYS, MONTHS, START_HOUR, END_HOUR,
  mondayOf, addDays, toIsoDate, parseIsoDate, timeToMinutes,
  mergeIntervals, subtractIntervals,
} from './agenda/utils'
import { MiniCalendar, WeekView, DayView } from './agenda/CalendarViews'
import { DetailPanel, NewApptModal, SlotActionModal, EditApptModal } from './agenda/Modals'
import InboxDropdown from './agenda/InboxDropdown'
import PatientsView from './agenda/PatientsView'
import ReportsView from './agenda/ReportsView'

export default function AgendaPanel({ onClose, onAuthExpired }) {
  const [appointments,  setAppointments]  = useState([])
  const [specialties,   setSpecialties]   = useState([])
  const [rules,         setRules]         = useState([])
  const [weekOverrides, setWeekOverrides] = useState([])
  const [pending,       setPending]       = useState([])
  const [weekStart,     setWeekStart]     = useState(() => mondayOf(new Date()))
  const [activeView,    setActiveView]    = useState('agenda')
  const [view,          setView]          = useState(() => window.innerWidth < 768 ? 'day' : 'week')
  const [selectedDay,   setSelectedDay]   = useState(() => window.innerWidth < 768 ? (new Date().getDay() + 6) % 7 : null)
  const [selectedAppt,  setSelectedAppt]  = useState(null)
  const [showModal,     setShowModal]     = useState(false)
  const [modalPrefill,  setModalPrefill]  = useState(null)
  const [slotAction,    setSlotAction]    = useState(null)
  const [confirmBlock,  setConfirmBlock]  = useState(null)
  const [showAvailability, setShowAvailability] = useState(false)
  const [showInbox,     setShowInbox]     = useState(false)
  const [editingAppt,   setEditingAppt]   = useState(null)
  const [miniDate,      setMiniDate]      = useState(null)
  const [hourHeight,    setHourHeight]    = useState(80)
  const [loadError,     setLoadError]     = useState(null)
  const [notice,        setNotice]        = useState(null)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth < 768)
  const [sidebarOpen,   setSidebarOpen]   = useState(false)
  const searchCache = useRef(null)
  const noticeTimer = useRef(null)

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const specialtyNames = useMemo(
    () => Object.fromEntries(specialties.map(s => [s.id, s.name])),
    [specialties],
  )

  const handleApiError = useCallback(err => {
    if (err?.status === 401) {
      onAuthExpired?.()
      return
    }
    setLoadError(err?.detail || 'Falha ao comunicar com o servidor.')
  }, [onAuthExpired])

  const showNotice = useCallback(msg => {
    setNotice(msg)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 5000)
  }, [])

  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const mapAppt = useCallback(a => {
    const date = parseIsoDate(a.date)
    return {
      id: a.id,
      date,
      dayIdx: (date.getDay() + 6) % 7,
      start: a.start_time.slice(0, 5),
      end: a.end_time.slice(0, 5),
      client: a.client_name,
      contact: a.client_contact,
      specialtyId: a.specialty_id,
      specialty: specialtyNames[a.specialty_id] || '',
      type: a.type,
      status: a.status,
      notes: a.notes,
      source: a.source,
    }
  }, [specialtyNames])

  const loadSpecialties = useCallback(() => {
    api.get('/api/specialties').then(setSpecialties).catch(handleApiError)
  }, [handleApiError])

  useEffect(() => { loadSpecialties() }, [loadSpecialties])

  const loadAppointments = useCallback(() => {
    const from = toIsoDate(weekDates[0])
    const to = toIsoDate(weekDates[6])
    searchCache.current = null
    api
      .get(`/api/admin/appointments?date_from=${from}&date_to=${to}`, { auth: true })
      .then(data => {
        setLoadError(null)
        setAppointments(data)
      })
      .catch(handleApiError)
  }, [weekDates, handleApiError])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  const loadOverrides = useCallback(() => {
    const from = toIsoDate(weekDates[0])
    const to = toIsoDate(weekDates[6])
    api
      .get(`/api/admin/availability/overrides?date_from=${from}&date_to=${to}`, { auth: true })
      .then(setWeekOverrides)
      .catch(handleApiError)
  }, [weekDates, handleApiError])

  useEffect(() => { loadOverrides() }, [loadOverrides])

  const loadRules = useCallback(() => {
    api.get('/api/admin/availability/rules', { auth: true })
      .then(setRules)
      .catch(handleApiError)
  }, [handleApiError])

  useEffect(() => { loadRules() }, [loadRules])

  const loadPending = useCallback(() => {
    api.get('/api/admin/appointments?status=pending', { auth: true })
      .then(setPending)
      .catch(handleApiError)
  }, [handleApiError])

  useEffect(() => { loadPending() }, [loadPending])

  const resolvedAppointments = useMemo(
    () => appointments.map(mapAppt),
    [appointments, mapAppt],
  )

  const weekBlocks = useMemo(
    () =>
      weekOverrides
        .filter(o => o.kind === 'block')
        .map(o => {
          const date = parseIsoDate(o.date)
          return {
            id: o.id,
            dayIdx: (date.getDay() + 6) % 7,
            start: o.start_time ? o.start_time.slice(0, 5) : '08:00',
            end: o.end_time ? o.end_time.slice(0, 5) : '19:00',
            reason: o.reason,
          }
        }),
    [weekOverrides],
  )

  const availabilityByDay = useMemo(() => {
    const out = {}
    weekDates.forEach((date, dayIdx) => {
      const iso = toIsoDate(date)
      const windows = rules
        .filter(r => r.active && r.weekday === dayIdx)
        .map(r => [timeToMinutes(r.start_time.slice(0, 5)), timeToMinutes(r.end_time.slice(0, 5))])
      weekOverrides
        .filter(o => o.kind === 'open' && o.date === iso && o.start_time)
        .forEach(o => windows.push([timeToMinutes(o.start_time.slice(0, 5)), timeToMinutes(o.end_time.slice(0, 5))]))
      const blocks = weekOverrides
        .filter(o => o.kind === 'block' && o.date === iso)
        .map(o =>
          o.start_time
            ? [timeToMinutes(o.start_time.slice(0, 5)), timeToMinutes(o.end_time.slice(0, 5))]
            : [START_HOUR * 60, END_HOUR * 60],
        )
      out[dayIdx] = subtractIntervals(mergeIntervals(windows), blocks)
    })
    return out
  }, [weekDates, rules, weekOverrides])

  const handleApptClick = useCallback(appt => {
    setSelectedAppt(appt)
    setSelectedDay(appt.dayIdx)
  }, [])

  const handleMiniSelect = useCallback(date => {
    setMiniDate(date)
    setWeekStart(mondayOf(date))
    setSelectedDay((date.getDay() + 6) % 7)
    setView('day')
    setActiveView('agenda')
  }, [])

  const shiftWeek = useCallback(delta => {
    setWeekStart(w => mondayOf(addDays(w, delta * 7)))
    setSelectedAppt(null)
  }, [])

  const goToday = useCallback(() => {
    setWeekStart(mondayOf(new Date()))
    setSelectedAppt(null)
    setView('week')
    setSelectedDay(null)
  }, [])

  const handleCreate = useCallback(async payload => {
    await api.post('/api/admin/appointments', payload, { auth: true })
    loadAppointments()
  }, [loadAppointments])

  const handleSlotClick = useCallback((dayIdx, hour) => {
    setSlotAction({ date: weekDates[dayIdx], hour })
  }, [weekDates])

  const handleBlockSlot = useCallback(async (date, start, end, reason) => {
    await api.post(
      '/api/admin/availability/overrides',
      { date: toIsoDate(date), start_time: start, end_time: end, kind: 'block', reason },
      { auth: true },
    )
    loadOverrides()
  }, [loadOverrides])

  const handleRemoveBlock = useCallback(async block => {
    try {
      await api.delete(`/api/admin/availability/overrides/${block.id}`, { auth: true })
      setWeekOverrides(list => list.filter(o => o.id !== block.id))
    } catch (err) {
      handleApiError(err)
    }
    setConfirmBlock(null)
  }, [handleApiError])

  const handleStatusChange = useCallback(async (appt, status) => {
    try {
      await api.patch(`/api/admin/appointments/${appt.id}`, { status }, { auth: true })
      setAppointments(list => list.map(a => (a.id === appt.id ? { ...a, status } : a)))
      setSelectedAppt(s => (s && s.id === appt.id ? { ...s, status } : s))
      loadPending()
    } catch (err) {
      handleApiError(err)
    }
  }, [handleApiError, loadPending])

  const handleApptMove = useCallback(async (appt, dayIdx, start, end) => {
    try {
      await api.patch(
        `/api/admin/appointments/${appt.id}`,
        { date: toIsoDate(weekDates[dayIdx]), start_time: start, end_time: end },
        { auth: true },
      )
      loadAppointments()
      setSelectedAppt(null)
    } catch (err) {
      loadAppointments()
      if (err?.status === 409) showNotice('Conflito: já existe uma consulta neste horário. A consulta não foi movida.')
      else handleApiError(err)
    }
  }, [weekDates, loadAppointments, handleApiError, showNotice])

  const handleInboxAction = useCallback(async (raw, status) => {
    try {
      await api.patch(`/api/admin/appointments/${raw.id}`, { status }, { auth: true })
      loadPending()
      loadAppointments()
    } catch (err) {
      handleApiError(err)
    }
  }, [loadPending, loadAppointments, handleApiError])

  const jumpToAppointment = useCallback(raw => {
    const mapped = mapAppt(raw)
    setActiveView('agenda')
    setWeekStart(mondayOf(mapped.date))
    setSelectedDay(mapped.dayIdx)
    setSelectedAppt(mapped)
    setShowInbox(false)
    setSearchQuery('')
    setSearchResults([])
  }, [mapAppt])

  const handleSearchChange = useCallback(async value => {
    setSearchQuery(value)
    const q = value.trim().toLowerCase()
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    if (!searchCache.current) {
      try {
        searchCache.current = await api.get('/api/admin/appointments', { auth: true })
      } catch (err) {
        handleApiError(err)
        return
      }
    }
    setSearchResults(
      searchCache.current
        .filter(a => a.client_name.toLowerCase().includes(q))
        .sort((a, b) => (b.date + b.start_time).localeCompare(a.date + a.start_time))
        .slice(0, 8),
    )
  }, [handleApiError])

  const afterEdit = useCallback(() => {
    loadAppointments()
    loadPending()
    setSelectedAppt(null)
  }, [loadAppointments, loadPending])

  const total     = resolvedAppointments.length
  const confirmed = resolvedAppointments.filter(a => a.status === 'confirmed').length
  const pendingWk = resolvedAppointments.filter(a => a.status === 'pending').length
  const online    = resolvedAppointments.filter(a => a.type === 'online').length

  const sameMonth = weekDates[0].getMonth() === weekDates[6].getMonth()
  const weekLabel = view === 'day' && selectedDay !== null
    ? `${DAYS[selectedDay]}, ${weekDates[selectedDay].getDate()} de ${MONTHS[weekDates[selectedDay].getMonth()]}`
    : sameMonth
      ? `${weekDates[0].getDate()} – ${weekDates[6].getDate()} de ${MONTHS[weekDates[0].getMonth()]}, ${weekDates[0].getFullYear()}`
      : `${weekDates[0].getDate()} de ${MONTHS[weekDates[0].getMonth()]} – ${weekDates[6].getDate()} de ${MONTHS[weekDates[6].getMonth()]}, ${weekDates[6].getFullYear()}`

  const navLinkStyle = (active = false) => ({
    display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, fontSize:13, fontWeight:600,
    color: active ? T.accent : T.textSoft, cursor:'pointer', border:'none', background: active ? 'rgba(122,62,106,0.09)' : 'none',
    width:'100%', fontFamily:T.sans, textAlign:'left', transition:'all 160ms', minHeight:44,
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
        .agenda-scroll { padding-bottom: 0; }
        @media (max-width: 767px) {
          .agenda-scroll { padding-bottom: 68px; }
          .patient-row-meta { display: none !important; }
        }
      `}</style>

      <div className="agenda-panel" style={{ position:'fixed', inset:0, zIndex:150, display:'flex', height:'100vh', overflow:'hidden', background:T.bg, fontFamily:T.sans, animation:'agendaPanelIn 300ms ease', WebkitFontSmoothing:'antialiased' }}>

        {/* ── SIDEBAR ─────────────────────────────────── */}
        {isMobile && sidebarOpen && (
          <div style={{ position:'absolute', inset:0, background:'rgba(31,17,25,0.35)', zIndex:155 }} onClick={() => setSidebarOpen(false)} />
        )}
        <aside style={{ width:252, minWidth:252, background:T.surface, borderRight:`1px solid ${T.line}`, display:'flex', flexDirection:'column', gap:22, padding:'18px 14px', overflowY:'auto', ...(isMobile ? { position:'absolute', top:0, bottom:0, left:0, zIndex:160, transform:sidebarOpen ? 'translateX(0)' : 'translateX(-252px)', transition:`transform 280ms ${T.ease}`, boxShadow:sidebarOpen ? '8px 0 40px rgba(31,17,25,0.18)' : 'none' } : {}) }}>

          {/* Logo + close */}
          <div style={{ display:'flex', alignItems:'center', gap:10, paddingBottom:16, borderBottom:`1px solid ${T.line}` }}>
            <div style={{ width:34, height:34, borderRadius:9, background:`linear-gradient(135deg, ${T.accent} 0%, ${T.accentStrong} 100%)`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontFamily:T.serif, fontSize:12, fontWeight:700, boxShadow:'0 4px 12px rgba(122,62,106,0.3)', flexShrink:0 }}>MV</div>
            <div>
              <div style={{ fontFamily:T.serif, fontSize:13, fontWeight:600, color:T.textStrong, lineHeight:1.2 }}>Mulher Viva</div>
              <div style={{ fontSize:10, color:T.textMuted, marginTop:1 }}>Dra. Luciana Lopes</div>
            </div>
            {isMobile ? (
              <button onClick={() => setSidebarOpen(false)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:T.textMuted, padding:6, display:'flex', borderRadius:8, minWidth:36, minHeight:36, alignItems:'center', justifyContent:'center' }} aria-label="Fechar menu">
                <IconX />
              </button>
            ) : (
              <div style={{ marginLeft:'auto', width:7, height:7, borderRadius:'50%', background:T.ok, boxShadow:'0 0 0 2px rgba(109,191,143,0.25)', flexShrink:0 }} title="Online" />
            )}
          </div>

          {/* New appt button */}
          <button onClick={() => setShowModal(true)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, width:'100%', padding:'10px 16px', border:'none', borderRadius:999, background:T.accent, color:'white', fontFamily:T.sans, fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 8px 22px rgba(122,62,106,0.28)', transition:`all 220ms ${T.ease}` }}>
            <IconPlus /> Nova consulta
          </button>

          {/* Nav */}
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.22em', color:T.textMuted, padding:'0 2px', marginBottom:6 }}>Menu</div>
            <button style={navLinkStyle(activeView === 'agenda')} onClick={() => { setActiveView('agenda'); if (isMobile) setSidebarOpen(false) }}>
              <IconCalendar />Agenda
              {activeView === 'agenda' && <span style={{ width:6, height:6, borderRadius:'50%', background:T.accent, marginLeft:'auto', flexShrink:0 }} />}
            </button>
            <button style={navLinkStyle(activeView === 'patients')} onClick={() => { setActiveView('patients'); if (isMobile) setSidebarOpen(false) }}><IconNavPeople />Pacientes</button>
            <button style={navLinkStyle(activeView === 'reports')} onClick={() => { setActiveView('reports'); if (isMobile) setSidebarOpen(false) }}><IconNavChart />Relatórios</button>
            <button style={navLinkStyle()} onClick={() => { setShowAvailability(true); if (isMobile) setSidebarOpen(false) }}><IconNavGear />Disponibilidade</button>
          </div>

          {/* Mini calendar */}
          <div style={{ borderTop:`1px solid ${T.line}`, paddingTop:18 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.22em', color:T.textMuted, padding:'0 2px', marginBottom:12 }}>Calendário</div>
            <MiniCalendar selectedDate={miniDate} onSelect={handleMiniSelect} appointments={resolvedAppointments} />
          </div>

          {/* Stats */}
          <div>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.22em', color:T.textMuted, padding:'0 2px', marginBottom:10 }}>Esta semana</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
              <div style={statPillStyle}><div><div style={{ fontSize:20, fontWeight:700, fontFamily:T.serif, color:T.textStrong, lineHeight:1 }}>{total}</div><div style={{ fontSize:11, color:T.textMuted, marginTop:3, lineHeight:1.3 }}>Total</div></div></div>
              <div style={statPillStyle}><div><div style={{ fontSize:20, fontWeight:700, fontFamily:T.serif, color:T.accent, lineHeight:1 }}>{confirmed}</div><div style={{ fontSize:11, color:T.textMuted, marginTop:3, lineHeight:1.3 }}>Confirmadas</div></div></div>
              <div style={statPillStyle}><div><div style={{ fontSize:20, fontWeight:700, fontFamily:T.serif, color:'#b09060', lineHeight:1 }}>{pendingWk}</div><div style={{ fontSize:11, color:T.textMuted, marginTop:3, lineHeight:1.3 }}>Aguardando</div></div></div>
              <div style={statPillStyle}><div><div style={{ fontSize:20, fontWeight:700, fontFamily:T.serif, color:T.textStrong, lineHeight:1 }}>{online}</div><div style={{ fontSize:11, color:T.textMuted, marginTop:3, lineHeight:1.3 }}>Online</div></div></div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ borderTop:`1px solid ${T.line}`, paddingTop:16 }}>
            <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.22em', color:T.textMuted, padding:'0 2px', marginBottom:10 }}>Legenda</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { bar: { background:'rgba(122,62,106,0.5)', borderLeft:'3px solid '+T.accent }, label:'Videoconferência' },
                { bar: { background:'rgba(94,47,82,0.5)',   borderLeft:'3px solid '+T.accentStrong }, label:'Presencial' },
                { bar: { background:'rgba(109,191,143,0.25)', borderLeft:'3px solid rgba(109,191,143,0.7)' }, label:'Disponível para agendamento' },
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
          <div style={{ height:56, flexShrink:0, borderBottom:`1px solid ${T.line}`, background:T.surface, display:'flex', alignItems:'center', padding:`0 ${isMobile ? 12 : 20}px`, gap:isMobile ? 6 : 14 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} style={{ background:'none', border:'none', cursor:'pointer', color:T.textSoft, display:'flex', padding:4, minWidth:44, minHeight:44, alignItems:'center', justifyContent:'center', flexShrink:0 }} aria-label="Abrir menu">
                <IconMenu />
              </button>
            )}
            {activeView === 'agenda' ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:isMobile ? 4 : 8, flex:1, minWidth:0 }}>
                  <button onClick={() => shiftWeek(-1)} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, border:`1px solid ${T.line}`, borderRadius:8, background:T.surfaceSoft, color:T.textMuted, cursor:'pointer', transition:'all 160ms', flexShrink:0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.accent; e.currentTarget.style.color = 'white' }}
                    onMouseLeave={e => { e.currentTarget.style.background = T.surfaceSoft; e.currentTarget.style.color = T.textMuted }}>
                    <IconChevronLeft />
                  </button>
                  <button onClick={() => shiftWeek(1)} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, border:`1px solid ${T.line}`, borderRadius:8, background:T.surfaceSoft, color:T.textMuted, cursor:'pointer', transition:'all 160ms', flexShrink:0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.accent; e.currentTarget.style.color = 'white' }}
                    onMouseLeave={e => { e.currentTarget.style.background = T.surfaceSoft; e.currentTarget.style.color = T.textMuted }}>
                    <IconChevronRight />
                  </button>
                  {!isMobile && <button onClick={goToday} style={{ padding:'5px 13px', borderRadius:999, border:`1px solid ${T.line}`, background:T.surfaceSoft, color:T.textMuted, fontFamily:T.sans, fontSize:11.5, fontWeight:700, cursor:'pointer', transition:'all 160ms', flexShrink:0 }}>Hoje</button>}
                  <span style={{ fontFamily:T.serif, fontSize:isMobile ? 13 : 15, fontWeight:600, color:T.textStrong, paddingLeft:isMobile ? 0 : 4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{weekLabel}</span>
                </div>

                {!isMobile && (
                  <>
                    <div style={{ display:'flex', background:T.surfaceSoft, borderRadius:9, padding:3, gap:2, flexShrink:0 }}>
                      {['week','day'].map(v => (
                        <button key={v} onClick={() => { setView(v); if (v === 'day' && selectedDay === null) setSelectedDay(0) }} style={{ padding:'5px 14px', borderRadius:7, border:'none', background: view === v ? T.surface : 'none', fontFamily:T.sans, fontSize:12, fontWeight:700, color: view === v ? T.accent : T.textMuted, cursor:'pointer', boxShadow: view === v ? '0 1px 4px rgba(90,52,78,0.1)' : 'none', transition:'all 160ms' }}>
                          {v === 'week' ? 'Semana' : 'Dia'}
                        </button>
                      ))}
                    </div>

                    <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                      <span style={{ fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:T.textMuted }}>Zoom</span>
                      {[60,80,100].map(h => (
                        <button key={h} onClick={() => setHourHeight(h)} title={h === 60 ? 'Compacto' : h === 80 ? 'Normal' : 'Expandido'} style={{ width:28, height:26, borderRadius:6, border:'1px solid', borderColor: hourHeight === h ? T.accent : T.line, background: hourHeight === h ? 'rgba(122,62,106,0.09)' : T.surfaceSoft, color: hourHeight === h ? T.accent : T.textMuted, fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:T.sans }}>
                          {h === 60 ? 'P' : h === 80 ? 'M' : 'G'}
                        </button>
                      ))}
                    </div>
                    <div style={{ width:1, height:22, background:T.line }} />
                  </>
                )}
              </>
            ) : (
              <div style={{ flex:1, fontFamily:T.serif, fontSize:15, fontWeight:600, color:T.textStrong }}>
                {activeView === 'patients' ? 'Pacientes' : 'Relatórios'}
              </div>
            )}

            <div style={{ display:'flex', alignItems:'center', gap:isMobile ? 4 : 10, justifyContent:'flex-end', flexShrink:0 }}>
              {/* Patient search — desktop only */}
              {!isMobile && (
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:T.textMuted, display:'flex' }}><IconSearch /></span>
                  <input
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder="Buscar paciente..."
                    style={{ width:190, padding:'7px 12px 7px 32px', borderRadius:999, border:`1px solid ${T.line}`, background:T.surfaceSoft, color:T.text, fontSize:12, fontFamily:T.sans, outline:'none' }}
                  />
                  {searchQuery.trim().length >= 2 && (
                    <>
                      <div style={{ position:'fixed', inset:0, zIndex:180 }} onClick={() => { setSearchQuery(''); setSearchResults([]) }} />
                      <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:300, maxHeight:320, overflowY:'auto', background:T.surface, border:`1px solid ${T.line}`, borderRadius:14, boxShadow:'0 18px 48px rgba(90,52,78,0.16)', zIndex:190, animation:'agendaSlideUp 180ms ease' }}>
                        {searchResults.length === 0 ? (
                          <div style={{ padding:'16px 14px', fontSize:12, color:T.textMuted, textAlign:'center' }}>Nenhuma consulta encontrada.</div>
                        ) : (
                          searchResults.map(r => {
                            const d = parseIsoDate(r.date)
                            return (
                              <div key={r.id} onClick={() => jumpToAppointment(r)} style={{ padding:'10px 14px', borderBottom:'1px solid rgba(220,199,210,0.4)', cursor:'pointer' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(122,62,106,0.05)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                                <div style={{ fontSize:12.5, fontWeight:700, color:T.textStrong, fontFamily:T.serif }}>{r.client_name}</div>
                                <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>
                                  {d.getDate()} de {MONTHS[d.getMonth()]} de {d.getFullYear()} · {r.start_time.slice(0,5)}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Inbox bell */}
              <div style={{ position:'relative' }}>
                <button onClick={() => setShowInbox(v => !v)} style={{ background:'none', border:'none', cursor:'pointer', color: showInbox ? T.accent : T.textMuted, display:'flex', position:'relative', padding:6, minWidth:44, minHeight:44, alignItems:'center', justifyContent:'center' }}>
                  <IconBell />
                  {pending.length > 0 && (
                    <span style={{ position:'absolute', top:2, right:2, minWidth:15, height:15, padding:'0 3px', borderRadius:999, background:T.accent, color:'white', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', border:`1.5px solid ${T.surface}`, boxSizing:'border-box' }}>
                      {pending.length}
                    </span>
                  )}
                </button>
                {showInbox && (
                  <InboxDropdown
                    pending={pending}
                    onAction={handleInboxAction}
                    onClose={() => setShowInbox(false)}
                    onOpenAppt={jumpToAppointment}
                  />
                )}
              </div>
              <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${T.accent},${T.accentStrong})`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:11, fontWeight:700, flexShrink:0, cursor:'pointer', boxShadow:'0 3px 10px rgba(122,62,106,0.3)' }}>LL</div>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>
            {activeView === 'agenda' && (
              <>
                <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', minWidth:0 }}>
                  {loadError && (
                    <div style={{ padding:'8px 20px', background:'rgba(176,80,96,0.08)', borderBottom:`1px solid ${T.line}`, color:T.danger, fontSize:12, fontWeight:600 }}>
                      {loadError}
                    </div>
                  )}
                  {notice && (
                    <div style={{ padding:'8px 20px', background:'rgba(176,80,96,0.08)', borderBottom:`1px solid ${T.line}`, color:T.danger, fontSize:12, fontWeight:600 }}>
                      {notice}
                    </div>
                  )}
                  {view === 'week'
                    ? <WeekView appointments={resolvedAppointments} weekDates={weekDates} selectedDayIdx={selectedDay} hourHeight={hourHeight} onSlotClick={handleSlotClick} onApptClick={handleApptClick} onApptMove={handleApptMove} onBlockClick={setConfirmBlock} blocks={weekBlocks} availabilityByDay={availabilityByDay} />
                    : <DayView  dayIdx={selectedDay ?? 0} appointments={resolvedAppointments} weekDates={weekDates} hourHeight={hourHeight} onSlotClick={handleSlotClick} onApptClick={handleApptClick} onApptMove={handleApptMove} onBlockClick={setConfirmBlock} blocks={weekBlocks} availabilityByDay={availabilityByDay} />
                  }
                </div>

                {/* Detail panel */}
                <div style={{
                  overflow:'hidden', background:T.surface,
                  ...(isMobile ? {
                    position:'absolute', inset:0, zIndex:120,
                    transform: selectedAppt ? 'translateX(0)' : 'translateX(100%)',
                    transition:`transform 300ms ${T.ease}`,
                  } : {
                    flexShrink:0, borderLeft:`1px solid ${T.line}`,
                    transition:`width 360ms ${T.ease}`,
                    width: selectedAppt ? 290 : 0,
                  }),
                }}>
                  <div style={{ width: isMobile ? '100%' : 290, height:'100%' }}>
                    {selectedAppt && (
                      <DetailPanel
                        appt={selectedAppt}
                        onClose={() => setSelectedAppt(null)}
                        onStatusChange={handleStatusChange}
                        onEdit={appt => setEditingAppt(appt)}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
            {activeView === 'patients' && (
              <PatientsView
                specialtyNames={specialtyNames}
                onOpenAppointment={jumpToAppointment}
                onApiError={handleApiError}
              />
            )}
            {activeView === 'reports' && (
              <ReportsView specialties={specialties} onApiError={handleApiError} />
            )}
          </div>
        </div>

        {showModal && (
          <NewApptModal
            onClose={() => { setShowModal(false); setModalPrefill(null) }}
            onCreate={handleCreate}
            specialties={specialties}
            defaultDate={modalPrefill?.date ?? toIsoDate(weekDates[0])}
            defaultStart={modalPrefill?.start}
            defaultEnd={modalPrefill?.end}
          />
        )}
        {slotAction && (
          <SlotActionModal
            date={slotAction.date}
            hour={slotAction.hour}
            onClose={() => setSlotAction(null)}
            onSchedule={(start, end) => {
              setModalPrefill({ date: toIsoDate(slotAction.date), start, end })
              setSlotAction(null)
              setShowModal(true)
            }}
            onBlock={(start, end, reason) => handleBlockSlot(slotAction.date, start, end, reason)}
          />
        )}
        {editingAppt && (
          <EditApptModal
            appt={editingAppt}
            specialties={specialties}
            onClose={() => setEditingAppt(null)}
            onSaved={afterEdit}
            onDeleted={afterEdit}
          />
        )}
        {confirmBlock && (
          <div style={{ position:'fixed', inset:0, background:'rgba(31,17,25,0.35)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:210, animation:'agendaFadeIn 200ms ease' }} onClick={e => e.target === e.currentTarget && setConfirmBlock(null)}>
            <div style={{ background:T.surface, borderRadius:22, padding:'clamp(18px,4vw,26px)', width:'min(320px,calc(100vw - 24px))', boxShadow:'0 28px 72px rgba(90,52,78,0.14)', animation:'agendaSlideUp 260ms ease', fontFamily:T.sans, textAlign:'center' }}>
              <h2 style={{ fontFamily:T.serif, fontSize:16, fontWeight:600, color:T.textStrong, margin:'0 0 8px' }}>Remover bloqueio?</h2>
              <p style={{ fontSize:12.5, color:T.textSoft, margin:'0 0 18px', lineHeight:1.5 }}>
                {confirmBlock.start} – {confirmBlock.end}
                {confirmBlock.reason ? ` — ${confirmBlock.reason}` : ''}
                <br />O horário voltará a ficar disponível para agendamento.
              </p>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setConfirmBlock(null)} style={{ flex:1, padding:'9px 0', borderRadius:999, border:`1px solid ${T.line}`, background:T.surfaceSoft, color:T.textSoft, fontFamily:T.sans, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>Cancelar</button>
                <button onClick={() => handleRemoveBlock(confirmBlock)} style={{ flex:1, padding:'9px 0', borderRadius:999, border:'none', background:T.danger, color:'white', fontFamily:T.sans, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>Remover</button>
              </div>
            </div>
          </div>
        )}
        {showAvailability && (
          <AvailabilityModal
            onClose={() => { setShowAvailability(false); loadSpecialties(); loadRules(); loadOverrides() }}
            onAuthExpired={onAuthExpired}
          />
        )}

        {/* Mobile bottom navigation */}
        {isMobile && (
          <div style={{ position:'fixed', bottom:0, left:0, right:0, height:60, background:T.surface, borderTop:`1px solid ${T.line}`, display:'flex', alignItems:'stretch', zIndex:140, boxShadow:'0 -2px 16px rgba(31,17,25,0.06)' }}>
            {[
              { id:'agenda',   icon:<IconCalendar />,  label:'Agenda' },
              { id:'patients', icon:<IconNavPeople />, label:'Pacientes' },
              { id:'reports',  icon:<IconNavChart />,  label:'Relatórios' },
              { id:'disponib', icon:<IconNavGear />,   label:'Horários' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'disponib') setShowAvailability(true)
                  else { setActiveView(item.id); setSelectedAppt(null) }
                }}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
                  flex:1, border:'none', background:'none',
                  color: item.id !== 'disponib' && activeView === item.id ? T.accent : T.textMuted,
                  fontFamily:T.sans, fontSize:10,
                  fontWeight: item.id !== 'disponib' && activeView === item.id ? 700 : 500,
                  cursor:'pointer',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
