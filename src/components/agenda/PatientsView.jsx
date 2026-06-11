import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { T, fieldStyle } from './theme'
import { IconSearch, IconChevronRight, IconVideo, IconPin } from './ui'
import { MONTHS, STATUS_LABELS, parseIsoDate, toIsoDate } from './utils'

function patientKey(a) {
  return (a.client_contact?.trim() || a.client_name.trim()).toLowerCase()
}

export default function PatientsView({ specialtyNames, onOpenAppointment, onApiError }) {
  const [appointments, setAppointments] = useState(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.get('/api/admin/appointments', { auth: true })
      .then(setAppointments)
      .catch(onApiError)
  }, [onApiError])

  const patients = useMemo(() => {
    if (!appointments) return []
    const map = new Map()
    for (const a of appointments) {
      const key = patientKey(a)
      if (!map.has(key)) map.set(key, { key, name: a.client_name, contact: a.client_contact || '', appts: [] })
      map.get(key).appts.push(a)
    }
    const todayIso = toIsoDate(new Date())
    const list = [...map.values()].map(p => {
      p.appts.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
      const active = p.appts.filter(a => a.status !== 'cancelled')
      p.last = [...active].reverse().find(a => a.date < todayIso) || null
      p.next = active.find(a => a.date >= todayIso) || null
      p.name = p.appts[p.appts.length - 1].client_name
      p.contact = p.appts[p.appts.length - 1].client_contact || p.contact
      return p
    })
    list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return list
  }, [appointments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return patients
    return patients.filter(p => p.name.toLowerCase().includes(q) || p.contact.toLowerCase().includes(q))
  }, [patients, search])

  const fmtDate = iso => {
    const d = parseIsoDate(iso)
    return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`
  }

  const statusDot = { confirmed: T.accent, pending: '#b09ea9', cancelled: '#c9b3be' }

  return (
    <div className="agenda-scroll" style={{ flex:1, overflowY:'auto', padding:'20px clamp(14px,4vw,28px)', fontFamily:T.sans }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, gap:16, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ fontFamily:T.serif, fontSize:22, fontWeight:600, color:T.textStrong, margin:0 }}>Pacientes</h2>
          <div style={{ fontSize:12, color:T.textMuted, marginTop:3 }}>
            {patients.length} paciente{patients.length !== 1 ? 's' : ''} com histórico de consultas
          </div>
        </div>
        <div style={{ position:'relative', width:280 }}>
          <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:T.textMuted, display:'flex' }}><IconSearch /></span>
          <input style={{ ...fieldStyle, paddingLeft:34 }} placeholder="Buscar por nome ou contato..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {appointments === null ? (
        <div style={{ padding:'40px 0', textAlign:'center', fontSize:13, color:T.textMuted }}>Carregando pacientes...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:'40px 0', textAlign:'center', fontSize:13, color:T.textMuted }}>
          {search ? 'Nenhum paciente encontrado para esta busca.' : 'Nenhuma consulta registrada ainda.'}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(p => {
            const isOpen = expanded === p.key
            const initials = p.name.split(' ').map(n => n[0]).slice(0, 2).join('')
            return (
              <div key={p.key} style={{ background:T.surface, border:`1px solid ${T.line}`, borderRadius:16, overflow:'hidden', transition:`all 200ms ${T.ease}` }}>
                <div onClick={() => setExpanded(isOpen ? null : p.key)} style={{ display:'flex', alignItems:'center', gap:13, padding:'13px 16px', cursor:'pointer' }}>
                  <div style={{ width:38, height:38, borderRadius:'50%', background:`linear-gradient(135deg, ${T.accent} 0%, ${T.accentStrong} 100%)`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:13, flexShrink:0, fontFamily:T.serif }}>
                    {initials}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:700, color:T.textStrong, fontFamily:T.serif, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize:11, color:T.textMuted, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.contact || 'Sem contato registrado'}</div>
                  </div>
                  <div style={{ display:'flex', gap:12, alignItems:'center', flexShrink:0 }}>
                    <div style={{ textAlign:'center', minWidth:36 }}>
                      <div style={{ fontSize:16, fontWeight:700, fontFamily:T.serif, color:T.accent, lineHeight:1 }}>{p.appts.length}</div>
                      <div style={{ fontSize:9, color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.08em', marginTop:2 }}>visitas</div>
                    </div>
                    <div style={{ minWidth:130, textAlign:'right', display:'block' }} className="patient-row-meta">
                      {p.next ? (
                        <>
                          <div style={{ fontSize:9, color:T.accent, textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:700 }}>Próxima</div>
                          <div style={{ fontSize:11, color:T.textSoft, marginTop:1 }}>{fmtDate(p.next.date)}, {p.next.start_time.slice(0,5)}</div>
                        </>
                      ) : p.last ? (
                        <>
                          <div style={{ fontSize:9, color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:700 }}>Última</div>
                          <div style={{ fontSize:11, color:T.textSoft, marginTop:1 }}>{fmtDate(p.last.date)}</div>
                        </>
                      ) : (
                        <div style={{ fontSize:11, color:T.textMuted }}>—</div>
                      )}
                    </div>
                    <span style={{ color:T.textMuted, display:'flex', transform: isOpen ? 'rotate(90deg)' : 'none', transition:'transform 200ms' }}><IconChevronRight /></span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop:`1px solid ${T.line}`, background:T.surfaceSoft, padding:'8px 16px 12px' }}>
                    {[...p.appts].reverse().map(a => (
                      <div key={a.id} onClick={() => onOpenAppointment(a)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 6px', borderBottom:'1px solid rgba(220,199,210,0.4)', cursor:'pointer', borderRadius:6 }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(122,62,106,0.05)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <span style={{ width:6, height:6, borderRadius:'50%', background: statusDot[a.status] || T.line, flexShrink:0 }} />
                        <span style={{ fontSize:11.5, color:T.textSoft, width:170, flexShrink:0 }}>{fmtDate(a.date)}</span>
                        <span style={{ fontSize:11.5, color:T.textMuted, width:90, flexShrink:0 }}>{a.start_time.slice(0,5)} – {a.end_time.slice(0,5)}</span>
                        <span style={{ fontSize:11.5, color:T.textSoft, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{specialtyNames[a.specialty_id] || ''}</span>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, color: a.type === 'online' ? T.accent : T.accentStrong, flexShrink:0 }}>
                          {a.type === 'online' ? <IconVideo /> : <IconPin />}
                        </span>
                        <span style={{ fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:T.textMuted, width:80, textAlign:'right', flexShrink:0 }}>{STATUS_LABELS[a.status]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
