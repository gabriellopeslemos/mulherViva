import { useRef, useState } from 'react'
import { T } from './theme'
import { IconChevronLeft, IconChevronRight, IconVideo, IconPin } from './ui'
import {
  DAYS, MONTHS, START_HOUR, END_HOUR,
  timeToMinutes, minutesToTime, getApptPosition,
} from './utils'

const SNAP_MIN = 15

// ── Mini Calendar ─────────────────────────────────────────────────────────────
export function MiniCalendar({ selectedDate, onSelect, appointments }) {
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())

  const apptDays = new Set(
    (appointments || []).map(a => {
      const d = a.date
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    }),
  )

  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()
  const startOffset = (firstDow + 6) % 7

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
          const isToday = !cell.other && cell.month === today.getMonth() && cell.day === today.getDate() && cell.year === today.getFullYear()
          const key = `${cell.year}-${cell.month}-${cell.day}`
          const hasAppts = apptDays.has(key)
          const isSelected = selectedDate && !cell.other &&
            selectedDate.getDate() === cell.day && selectedDate.getMonth() === cell.month && selectedDate.getFullYear() === cell.year

          return (
            <div key={i} onClick={() => !cell.other && onSelect(new Date(cell.year, cell.month, cell.day))}
              style={{
                fontSize:11, textAlign:'center', padding:'5px 2px', borderRadius:'50%',
                cursor: cell.other ? 'default' : 'pointer',
                color: cell.other ? T.line : isToday ? 'white' : isSelected ? T.accent : T.textSoft,
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
function ApptBlock({ appt, hourHeight, onMouseDown, dimmed }) {
  const [hovered, setHovered] = useState(false)
  const pos = getApptPosition(appt.start, appt.end, hourHeight)
  const durationMins = timeToMinutes(appt.end) - timeToMinutes(appt.start)
  const isShort = durationMins <= 30
  const isCancelled = appt.status === 'cancelled'
  const isPending = appt.status === 'pending'

  const colors = {
    online:     { bg: 'rgba(122,62,106,0.09)', hoverBg: 'rgba(122,62,106,0.15)', border: T.accent },
    presencial: { bg: 'rgba(94,47,82,0.11)',   hoverBg: 'rgba(94,47,82,0.18)',   border: T.accentStrong },
  }
  const c = colors[appt.type] || colors.online

  return (
    <div
      onMouseDown={e => { if (e.button === 0) onMouseDown(appt, 'move', e) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:'absolute', top:pos.top, height:pos.height, left:5, right:5,
        borderRadius:10, padding: isShort ? '5px 8px' : '8px 10px',
        cursor:'grab', overflow:'hidden',
        background: isCancelled ? 'rgba(220,199,210,0.22)' : hovered ? c.hoverBg : c.bg,
        borderLeft: `3px ${isPending ? 'dashed' : 'solid'} ${isCancelled ? T.line : c.border}`,
        opacity: dimmed ? 0.3 : isCancelled ? 0.5 : isPending ? 0.76 : 1,
        transform: hovered && !dimmed ? 'translateX(2px) scale(1.005)' : 'none',
        boxShadow: hovered && !dimmed ? '0 6px 20px rgba(90,52,78,0.12)' : 'none',
        transition: `opacity 150ms, transform 200ms ${T.ease}, box-shadow 200ms`,
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
      <div
        onMouseDown={e => { e.stopPropagation(); if (e.button === 0) onMouseDown(appt, 'resize', e) }}
        style={{ position:'absolute', left:0, right:0, bottom:0, height:7, cursor:'ns-resize' }}
      />
    </div>
  )
}

// ── Block Overlay ─────────────────────────────────────────────────────────────
function BlockOverlay({ block, hourHeight, onClick }) {
  const pos = getApptPosition(block.start, block.end, hourHeight)
  return (
    <div
      onClick={() => onClick(block)}
      title={block.reason || 'Horário bloqueado — clique para remover'}
      style={{
        position:'absolute', top:pos.top, height:pos.height, left:2, right:2, borderRadius:8,
        background:'repeating-linear-gradient(45deg, rgba(91,69,82,0.06), rgba(91,69,82,0.06) 6px, rgba(91,69,82,0.13) 6px, rgba(91,69,82,0.13) 12px)',
        border:'1px dashed rgba(91,69,82,0.4)', zIndex:3, cursor:'pointer',
        display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:5, userSelect:'none',
      }}>
      <span style={{ fontSize:8.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:T.textMuted }}>Bloqueado</span>
    </div>
  )
}

// ── Time Grid (shared by week/day views, owns drag-and-drop) ─────────────────
function TimeGrid({
  days, hourHeight, appointments, blocks, availabilityByDay,
  selectedDayIdx, onSlotClick, onApptClick, onApptMove, onBlockClick,
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const gridRef = useRef(null)
  const dragRef = useRef(null)
  const [drag, setDrag] = useState(null)

  const beginDrag = (appt, mode, e) => {
    e.preventDefault()
    const init = {
      appt, mode,
      startY: e.clientY, startX: e.clientX,
      origStartMin: timeToMinutes(appt.start), origEndMin: timeToMinutes(appt.end), origDayIdx: appt.dayIdx,
      curStartMin: timeToMinutes(appt.start), curEndMin: timeToMinutes(appt.end), curDayIdx: appt.dayIdx,
      moved: false,
    }
    dragRef.current = init
    setDrag(init)

    const onMove = ev => {
      const d = dragRef.current
      if (!d) return
      const dy = ev.clientY - d.startY
      const deltaMin = Math.round(((dy / hourHeight) * 60) / SNAP_MIN) * SNAP_MIN
      const moved = d.moved || Math.abs(dy) > 4 || Math.abs(ev.clientX - d.startX) > 4
      let next
      if (d.mode === 'move') {
        let dayIdx = d.curDayIdx
        const rect = gridRef.current?.getBoundingClientRect()
        if (rect && days.length > 1) {
          const colW = (rect.width - 52) / days.length
          const col = Math.max(0, Math.min(days.length - 1, Math.floor((ev.clientX - rect.left - 52) / colW)))
          dayIdx = days[col].dayIdx
        }
        const dur = d.origEndMin - d.origStartMin
        let s = d.origStartMin + deltaMin
        s = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - dur, s))
        next = { ...d, curStartMin: s, curEndMin: s + dur, curDayIdx: dayIdx, moved }
      } else {
        let en = d.origEndMin + deltaMin
        en = Math.max(d.origStartMin + SNAP_MIN, Math.min(END_HOUR * 60, en))
        next = { ...d, curEndMin: en, moved }
      }
      dragRef.current = next
      setDrag(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!d) return
      if (!d.moved) {
        onApptClick(d.appt)
      } else if (
        d.curStartMin !== d.origStartMin ||
        d.curEndMin !== d.origEndMin ||
        d.curDayIdx !== d.origDayIdx
      ) {
        onApptMove(d.appt, d.curDayIdx, minutesToTime(d.curStartMin), minutesToTime(d.curEndMin))
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const dayStartMin = START_HOUR * 60
  const dayEndMin = END_HOUR * 60

  return (
    <div ref={gridRef} style={{ display:'grid', gridTemplateColumns:`52px repeat(${days.length}, 1fr)`, flex:1 }}>
      <div style={{ borderRight:`1px solid ${T.line}` }}>
        {hours.map(h => (
          <div key={h} style={{ height:hourHeight, borderBottom:'1px solid rgba(220,199,210,0.35)', position:'relative' }}>
            <span style={{ position:'absolute', top:-7, right:7, fontSize:9.5, color:T.textMuted, fontWeight:600, background:T.surface, padding:'0 2px', letterSpacing:'0.03em' }}>{String(h).padStart(2,'0')}h</span>
          </div>
        ))}
      </div>
      {days.map(({ dayIdx }) => (
        <div key={dayIdx} style={{ borderRight:`1px solid ${T.line}`, position:'relative', background: days.length > 1 && selectedDayIdx === dayIdx ? 'rgba(122,62,106,0.018)' : 'transparent' }}>
          {hours.map(h => (
            <div key={h} onClick={() => onSlotClick(dayIdx, h)} style={{ height:hourHeight, borderBottom:'1px solid rgba(220,199,210,0.35)', cursor:'pointer' }} />
          ))}
          {(availabilityByDay?.[dayIdx] || []).map(([s, e], i) => {
            const cs = Math.max(s, dayStartMin)
            const ce = Math.min(e, dayEndMin)
            if (ce <= cs) return null
            return (
              <div key={i} style={{
                position:'absolute', left:0, right:0, zIndex:1, pointerEvents:'none',
                top: ((cs - dayStartMin) / 60) * hourHeight,
                height: ((ce - cs) / 60) * hourHeight,
                background:'rgba(109,191,143,0.10)', borderLeft:'2px solid rgba(109,191,143,0.45)',
              }} />
            )
          })}
          {(blocks || []).filter(b => b.dayIdx === dayIdx).map(b => (
            <BlockOverlay key={b.id} block={b} hourHeight={hourHeight} onClick={onBlockClick} />
          ))}
          {appointments.filter(a => a.dayIdx === dayIdx).map(appt => (
            <ApptBlock
              key={appt.id}
              appt={appt}
              hourHeight={hourHeight}
              onMouseDown={beginDrag}
              dimmed={Boolean(drag?.moved && drag.appt.id === appt.id)}
            />
          ))}
          {drag?.moved && drag.curDayIdx === dayIdx && (
            <div style={{
              position:'absolute', left:5, right:5, zIndex:30, pointerEvents:'none',
              top: ((drag.curStartMin - dayStartMin) / 60) * hourHeight,
              height: Math.max(((drag.curEndMin - drag.curStartMin) / 60) * hourHeight - 4, 22),
              borderRadius:10, border:`1.5px dashed ${T.accent}`, background:'rgba(122,62,106,0.12)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <span style={{ fontSize:10, fontWeight:700, color:T.accent, fontFamily:T.sans }}>
                {minutesToTime(drag.curStartMin)} – {minutesToTime(drag.curEndMin)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────
export function WeekView({
  appointments, weekDates, selectedDayIdx, hourHeight,
  onSlotClick, onApptClick, onApptMove, onBlockClick, blocks, availabilityByDay,
}) {
  const apptsByDay = appointments.reduce((acc, a) => {
    if (!acc[a.dayIdx]) acc[a.dayIdx] = []
    acc[a.dayIdx].push(a)
    return acc
  }, {})

  return (
    <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', fontFamily:T.sans }}>
      <div style={{ display:'grid', gridTemplateColumns:'52px repeat(7, 1fr)', position:'sticky', top:0, zIndex:20, background:T.surface, borderBottom:`2px solid ${T.line}`, flexShrink:0 }}>
        <div style={{ borderRight:`1px solid ${T.line}` }} />
        {weekDates.map((date, i) => {
          const count = (apptsByDay[i] || []).length
          const isSelected = selectedDayIdx === i
          const isWeekend = i >= 5
          return (
            <div key={i} style={{ padding:'11px 8px', textAlign:'center', borderRight:`1px solid ${T.line}`, background: isSelected ? 'rgba(122,62,106,0.04)' : isWeekend ? 'rgba(220,199,210,0.12)' : 'transparent', transition:'background 200ms' }}>
              <div style={{ fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color: isSelected ? T.accent : T.textMuted, marginBottom:4 }}>{DAYS[i]}</div>
              <div style={{ fontSize:21, fontWeight:700, fontFamily:T.serif, color: isSelected ? T.accent : T.textStrong, lineHeight:1 }}>{date.getDate()}</div>
              {count > 0 && <div style={{ fontSize:9, color: isSelected ? T.accent : T.textMuted, marginTop:4 }}>{count} consulta{count !== 1 ? 's' : ''}</div>}
            </div>
          )
        })}
      </div>
      <TimeGrid
        days={weekDates.map((date, i) => ({ date, dayIdx: i }))}
        hourHeight={hourHeight}
        appointments={appointments}
        blocks={blocks}
        availabilityByDay={availabilityByDay}
        selectedDayIdx={selectedDayIdx}
        onSlotClick={onSlotClick}
        onApptClick={onApptClick}
        onApptMove={onApptMove}
        onBlockClick={onBlockClick}
      />
    </div>
  )
}

// ── Day View ──────────────────────────────────────────────────────────────────
export function DayView({
  dayIdx, appointments, weekDates, hourHeight,
  onSlotClick, onApptClick, onApptMove, onBlockClick, blocks, availabilityByDay,
}) {
  const dayAppts = appointments.filter(a => a.dayIdx === dayIdx)
  const date = weekDates[dayIdx]

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
      <TimeGrid
        days={[{ date, dayIdx }]}
        hourHeight={hourHeight}
        appointments={dayAppts}
        blocks={blocks}
        availabilityByDay={availabilityByDay}
        selectedDayIdx={dayIdx}
        onSlotClick={onSlotClick}
        onApptClick={onApptClick}
        onApptMove={onApptMove}
        onBlockClick={onBlockClick}
      />
    </div>
  )
}
