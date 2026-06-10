import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { T } from './theme'
import { IconChevronLeft, IconChevronRight } from './ui'
import { MONTHS, timeToMinutes, toIsoDate, mergeIntervals } from './utils'

export default function ReportsView({ specialties, onApiError }) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [appointments, setAppointments] = useState(null)
  const [rules, setRules] = useState([])

  const monthEnd = useMemo(
    () => new Date(month.getFullYear(), month.getMonth() + 1, 0),
    [month],
  )

  useEffect(() => {
    const from = toIsoDate(month)
    const to = toIsoDate(monthEnd)
    api.get(`/api/admin/appointments?date_from=${from}&date_to=${to}`, { auth: true })
      .then(setAppointments)
      .catch(onApiError)
  }, [month, monthEnd, onApiError])

  useEffect(() => {
    api.get('/api/admin/availability/rules', { auth: true })
      .then(setRules)
      .catch(onApiError)
  }, [onApiError])

  const stats = useMemo(() => {
    if (!appointments) return null
    const total = appointments.length
    const confirmed = appointments.filter(a => a.status === 'confirmed').length
    const pending = appointments.filter(a => a.status === 'pending').length
    const cancelled = appointments.filter(a => a.status === 'cancelled').length
    const active = appointments.filter(a => a.status !== 'cancelled')
    const online = active.filter(a => a.type === 'online').length
    const presencial = active.filter(a => a.type === 'presencial').length

    const bookedMin = active.reduce(
      (sum, a) => sum + (timeToMinutes(a.end_time.slice(0, 5)) - timeToMinutes(a.start_time.slice(0, 5))),
      0,
    )

    // approximate capacity: weekly rules expanded over the month, ignoring overrides
    const activeRules = rules.filter(r => r.active)
    let availMin = 0
    for (let d = 1; d <= monthEnd.getDate(); d++) {
      const weekday = (new Date(month.getFullYear(), month.getMonth(), d).getDay() + 6) % 7
      const dayIntervals = activeRules
        .filter(r => r.weekday === weekday)
        .map(r => [timeToMinutes(r.start_time.slice(0, 5)), timeToMinutes(r.end_time.slice(0, 5))])
      availMin += mergeIntervals(dayIntervals).reduce((s, [a, b]) => s + (b - a), 0)
    }

    const occupancy = availMin > 0 ? Math.min(Math.round((bookedMin / availMin) * 100), 100) : null
    const cancelRate = total > 0 ? Math.round((cancelled / total) * 100) : 0

    const bySpecialty = specialties.map(s => ({
      id: s.id,
      name: s.name,
      count: active.filter(a => a.specialty_id === s.id).length,
    }))
    const maxCount = Math.max(1, ...bySpecialty.map(b => b.count))

    return { total, confirmed, pending, cancelled, online, presencial, bookedMin, availMin, occupancy, cancelRate, bySpecialty, maxCount }
  }, [appointments, rules, specialties, month, monthEnd])

  const shiftMonth = delta => {
    setAppointments(null)
    setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }

  const fmtHours = min => {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
  }

  const cardStyle = { background:T.surface, border:`1px solid ${T.line}`, borderRadius:16, padding:'16px 18px' }
  const navBtnStyle = { display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, border:`1px solid ${T.line}`, borderRadius:8, background:T.surfaceSoft, color:T.textMuted, cursor:'pointer' }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'24px 28px', fontFamily:T.sans }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, gap:16, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ fontFamily:T.serif, fontSize:22, fontWeight:600, color:T.textStrong, margin:0 }}>Relatórios</h2>
          <div style={{ fontSize:12, color:T.textMuted, marginTop:3 }}>Resumo mensal da agenda</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => shiftMonth(-1)} style={navBtnStyle}><IconChevronLeft /></button>
          <span style={{ fontFamily:T.serif, fontSize:15, fontWeight:600, color:T.textStrong, textTransform:'capitalize', minWidth:150, textAlign:'center' }}>
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </span>
          <button onClick={() => shiftMonth(1)} style={navBtnStyle}><IconChevronRight /></button>
        </div>
      </div>

      {!stats ? (
        <div style={{ padding:'40px 0', textAlign:'center', fontSize:13, color:T.textMuted }}>Carregando dados...</div>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:12, marginBottom:18 }}>
            <div style={cardStyle}>
              <div style={{ fontSize:28, fontWeight:700, fontFamily:T.serif, color:T.textStrong, lineHeight:1 }}>{stats.total}</div>
              <div style={{ fontSize:11, color:T.textMuted, marginTop:6 }}>Consultas no mês</div>
              <div style={{ fontSize:10.5, color:T.textSoft, marginTop:4 }}>
                {stats.confirmed} confirmadas · {stats.pending} aguardando
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize:28, fontWeight:700, fontFamily:T.serif, color: stats.occupancy === null ? T.textMuted : T.accent, lineHeight:1 }}>
                {stats.occupancy === null ? '—' : `${stats.occupancy}%`}
              </div>
              <div style={{ fontSize:11, color:T.textMuted, marginTop:6 }}>Taxa de ocupação (aproximada)</div>
              <div style={{ fontSize:10.5, color:T.textSoft, marginTop:4 }}>
                {stats.occupancy === null
                  ? 'Sem horários semanais cadastrados'
                  : `${fmtHours(stats.bookedMin)} de ${fmtHours(stats.availMin)} disponíveis`}
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize:28, fontWeight:700, fontFamily:T.serif, color:T.textStrong, lineHeight:1 }}>
                {stats.online}<span style={{ fontSize:15, color:T.textMuted, fontWeight:400 }}> / {stats.presencial}</span>
              </div>
              <div style={{ fontSize:11, color:T.textMuted, marginTop:6 }}>Online / Presencial</div>
              <div style={{ marginTop:8, height:6, borderRadius:999, background:'rgba(94,47,82,0.18)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${stats.online + stats.presencial > 0 ? (stats.online / (stats.online + stats.presencial)) * 100 : 0}%`, background:T.accent, borderRadius:999 }} />
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize:28, fontWeight:700, fontFamily:T.serif, color: stats.cancelRate > 20 ? T.danger : T.textStrong, lineHeight:1 }}>{stats.cancelRate}%</div>
              <div style={{ fontSize:11, color:T.textMuted, marginTop:6 }}>Taxa de cancelamento</div>
              <div style={{ fontSize:10.5, color:T.textSoft, marginTop:4 }}>{stats.cancelled} cancelada{stats.cancelled !== 1 ? 's' : ''}</div>
            </div>
          </div>

          <div style={{ ...cardStyle, padding:'18px 20px' }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.16em', color:T.textMuted, marginBottom:14 }}>
              Consultas por especialidade
            </div>
            {stats.bySpecialty.every(b => b.count === 0) ? (
              <div style={{ fontSize:12.5, color:T.textMuted, padding:'8px 0' }}>Nenhuma consulta ativa neste mês.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {stats.bySpecialty.map(b => (
                  <div key={b.id}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, color:T.textSoft, fontWeight:600 }}>{b.name}</span>
                      <span style={{ fontSize:12, color:T.accent, fontWeight:700, fontFamily:T.serif }}>{b.count}</span>
                    </div>
                    <div style={{ height:8, borderRadius:999, background:T.surfaceSoft, border:`1px solid ${T.line}`, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${(b.count / stats.maxCount) * 100}%`, background:`linear-gradient(90deg, ${T.accent}, ${T.accentStrong})`, borderRadius:999, transition:`width 400ms ${T.ease}` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
