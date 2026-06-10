import { useState } from 'react'
import { T } from './theme'
import { IconCheck, IconX, IconVideo, IconPin } from './ui'
import { MONTHS, parseIsoDate } from './utils'

export default function InboxDropdown({ pending, onAction, onClose, onOpenAppt }) {
  const [busyId, setBusyId] = useState(null)

  const act = async (raw, status) => {
    setBusyId(raw.id)
    try {
      await onAction(raw, status)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:180 }} onClick={onClose} />
      <div style={{ position:'absolute', top:'calc(100% + 10px)', right:-8, width:340, maxHeight:420, overflowY:'auto', background:T.surface, border:`1px solid ${T.line}`, borderRadius:16, boxShadow:'0 20px 56px rgba(90,52,78,0.18)', zIndex:190, animation:'agendaSlideUp 200ms ease', fontFamily:T.sans }}>
        <div style={{ padding:'14px 16px 12px', borderBottom:`1px solid ${T.line}`, position:'sticky', top:0, background:T.surface, zIndex:5 }}>
          <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.18em', color:T.textMuted }}>
            Solicitações pendentes
          </span>
        </div>

        {pending.length === 0 ? (
          <div style={{ padding:'26px 16px', textAlign:'center', fontSize:12.5, color:T.textMuted }}>
            Nenhuma solicitação aguardando confirmação.
          </div>
        ) : (
          pending.map(p => {
            const date = parseIsoDate(p.date)
            const busy = busyId === p.id
            return (
              <div key={p.id} style={{ padding:'13px 16px', borderBottom:`1px solid rgba(220,199,210,0.4)` }}>
                <div onClick={() => onOpenAppt(p)} style={{ cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:T.textStrong, fontFamily:T.serif, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.client_name}</span>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9.5, fontWeight:700, color: p.type === 'online' ? T.accent : T.accentStrong }}>
                      {p.type === 'online' ? <IconVideo /> : <IconPin />}
                    </span>
                  </div>
                  <div style={{ fontSize:11.5, color:T.textSoft, marginBottom:2 }}>
                    {date.getDate()} de {MONTHS[date.getMonth()]} · {p.start_time.slice(0,5)} – {p.end_time.slice(0,5)}
                  </div>
                  {p.client_contact && (
                    <div style={{ fontSize:10.5, color:T.textMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.client_contact}</div>
                  )}
                </div>
                <div style={{ display:'flex', gap:7, marginTop:9 }}>
                  <button onClick={() => act(p, 'confirmed')} disabled={busy} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'6px 0', borderRadius:999, border:'none', background:T.accent, color:'white', fontFamily:T.sans, fontSize:11, fontWeight:700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                    <IconCheck /> Confirmar
                  </button>
                  <button onClick={() => act(p, 'cancelled')} disabled={busy} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'6px 0', borderRadius:999, border:'1px solid rgba(176,80,96,0.32)', background:'transparent', color:T.danger, fontFamily:T.sans, fontSize:11, fontWeight:700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                    <IconX /> Recusar
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
