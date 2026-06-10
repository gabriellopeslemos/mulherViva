import { useState } from 'react'
import { api } from '../../lib/api'
import { T, fieldStyle, labelStyle } from './theme'
import { IconCalendar, IconClock, IconVideo, IconPin, IconCheck, IconPlus, IconX, IconNote, IconRefresh, IconTrash } from './ui'
import { DAYS, MONTHS, STATUS_LABELS, toIsoDate } from './utils'

// ── Info Row ──────────────────────────────────────────────────────────────────
export function InfoRow({ icon, label, value }) {
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
export function DetailPanel({ appt, onClose, onStatusChange, onEdit }) {
  const localStatus = appt.status
  const setLocalStatus = (s) => onStatusChange(appt, s)

  const dayDate  = appt.date
  const dayIdx   = (dayDate.getDay() + 6) % 7
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
              {appt.contact && <div style={{ fontSize:10.5, color:T.textMuted, lineHeight:1.3, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{appt.contact}</div>}
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
          <InfoRow icon={<IconCalendar />} label="Data"      value={`${DAYS[dayIdx] || ''}., ${dayDate.getDate()} de ${MONTHS[dayDate.getMonth()]} de ${dayDate.getFullYear()}`} />
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
          <button onClick={() => onEdit(appt)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, background:T.surfaceSoft, color:T.textSoft, border:`1px solid ${T.line}`, borderRadius:999, padding:'9px 18px', fontFamily:T.sans, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 180ms' }}>
            <IconRefresh /> Editar / Reagendar
          </button>
          {localStatus !== 'cancelled' && (
            <button onClick={() => setLocalStatus('cancelled')} style={{ background:'transparent', color:T.danger, border:'1px solid rgba(176,80,96,0.28)', borderRadius:999, padding:'9px 18px', fontFamily:T.sans, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 180ms' }}>
              Cancelar consulta
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Slot Action Modal ─────────────────────────────────────────────────────────
export function SlotActionModal({ date, hour, onClose, onSchedule, onBlock }) {
  const [start, setStart] = useState(`${String(hour).padStart(2, '0')}:00`)
  const [end, setEnd]     = useState(`${String(Math.min(hour + 1, 23)).padStart(2, '0')}:00`)
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const dayIdx = (date.getDay() + 6) % 7

  const handleBlock = async () => {
    if (!start || !end || end <= start) {
      setError('Informe um intervalo válido.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onBlock(start, end, reason.trim() || null)
      onClose()
    } catch (err) {
      setError(err?.detail || 'Não foi possível bloquear o horário.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(31,17,25,0.35)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, animation:'agendaFadeIn 200ms ease' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:T.surface, borderRadius:22, padding:26, width:340, boxShadow:'0 28px 72px rgba(90,52,78,0.14)', animation:'agendaSlideUp 260ms ease', fontFamily:T.sans }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <h2 style={{ fontFamily:T.serif, fontSize:16, fontWeight:600, color:T.textStrong, margin:0 }}>
            {DAYS[dayIdx]}, {date.getDate()} de {MONTHS[date.getMonth()]}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, padding:4, display:'flex' }}><IconX /></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={labelStyle}>Início</label>
              <input style={fieldStyle} type="time" value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Término</label>
              <input style={fieldStyle} type="time" value={end} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Motivo do bloqueio (opcional)</label>
            <input style={fieldStyle} placeholder="Almoço, compromisso..." value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          {error && <div style={{ fontSize:12, color:T.danger, textAlign:'center' }}>{error}</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
            <button onClick={() => onSchedule(start, end)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px 0', borderRadius:999, border:'none', background:T.accent, color:'white', fontFamily:T.sans, fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 18px rgba(122,62,106,0.28)' }}>
              <IconPlus /> Agendar consulta
            </button>
            <button onClick={handleBlock} disabled={saving} style={{ padding:'10px 0', borderRadius:999, border:'1px solid rgba(176,80,96,0.35)', background:'transparent', color:T.danger, fontFamily:T.sans, fontSize:13, fontWeight:700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Bloqueando...' : 'Bloquear horário'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── New Appointment Modal ─────────────────────────────────────────────────────
export function NewApptModal({ onClose, onCreate, specialties, defaultDate, defaultStart = '09:00', defaultEnd = '10:00' }) {
  const [form, setForm] = useState({
    client: '',
    contact: '',
    specialtyId: specialties[0]?.id ?? '',
    type: 'online',
    date: defaultDate,
    start: defaultStart,
    end: defaultEnd,
    notes: '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.client.trim() || !form.specialtyId || !form.date || !form.start || !form.end) {
      setError('Preencha paciente, especialidade, data e horários.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onCreate({
        specialty_id: Number(form.specialtyId),
        date: form.date,
        start_time: form.start,
        end_time: form.end,
        client_name: form.client.trim(),
        client_contact: form.contact.trim(),
        type: form.type,
        status: 'confirmed',
        notes: form.notes.trim() || null,
      })
      onClose()
    } catch (err) {
      setError(
        err?.status === 409
          ? 'Conflito: já existe uma consulta neste horário.'
          : err?.detail || 'Não foi possível criar a consulta.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(31,17,25,0.35)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, animation:'agendaFadeIn 200ms ease' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:T.surface, borderRadius:22, padding:28, width:400, boxShadow:'0 28px 72px rgba(90,52,78,0.14)', animation:'agendaSlideUp 260ms ease', fontFamily:T.sans }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
          <h2 style={{ fontFamily:T.serif, fontSize:18, fontWeight:600, color:T.textStrong, margin:0 }}>Nova consulta</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, padding:4, display:'flex' }}><IconX /></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={labelStyle}>Paciente</label>
            <input style={fieldStyle} placeholder="Nome completo" value={form.client} onChange={e => set('client', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Contato (telefone ou e-mail)</label>
            <input style={fieldStyle} placeholder="(61) 99999-0000" value={form.contact} onChange={e => set('contact', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Especialidade</label>
            <select style={{ ...fieldStyle, appearance:'none', cursor:'pointer' }} value={form.specialtyId} onChange={e => set('specialtyId', e.target.value)}>
              {specialties.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={labelStyle}>Modalidade</label>
              <select style={{ ...fieldStyle, appearance:'none', cursor:'pointer' }} value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="online">Videoconferência</option>
                <option value="presencial">Presencial</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Data</label>
              <input style={fieldStyle} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={labelStyle}>Início</label>
              <input style={fieldStyle} type="time" value={form.start} onChange={e => set('start', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Término</label>
              <input style={fieldStyle} type="time" value={form.end} onChange={e => set('end', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea style={{ ...fieldStyle, borderRadius:14, resize:'none' }} rows={2} placeholder="Notas sobre a consulta..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          {error && (
            <div style={{ fontSize:12, color:T.danger, textAlign:'center' }}>{error}</div>
          )}
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button onClick={onClose} style={{ flex:1, padding:'9px 0', borderRadius:999, border:`1px solid ${T.line}`, background:T.surfaceSoft, color:T.textSoft, fontFamily:T.sans, fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:'9px 0', borderRadius:999, border:'none', background:T.accent, color:'white', fontFamily:T.sans, fontSize:13, fontWeight:700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow:'0 6px 18px rgba(122,62,106,0.28)' }}>{saving ? 'Salvando...' : 'Agendar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Edit Appointment Modal ────────────────────────────────────────────────────
export function EditApptModal({ appt, specialties, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState({
    client: appt.client,
    contact: appt.contact || '',
    specialtyId: appt.specialtyId,
    type: appt.type,
    status: appt.status,
    date: toIsoDate(appt.date),
    start: appt.start,
    end: appt.end,
    notes: appt.notes || '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async (force = false) => {
    if (!form.client.trim() || !form.date || !form.start || !form.end) {
      setError('Preencha paciente, data e horários.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await api.patch(
        `/api/admin/appointments/${appt.id}`,
        {
          specialty_id: Number(form.specialtyId),
          date: form.date,
          start_time: form.start,
          end_time: form.end,
          client_name: form.client.trim(),
          client_contact: form.contact.trim(),
          type: form.type,
          status: form.status,
          notes: form.notes.trim() || null,
          force,
        },
        { auth: true },
      )
      onSaved()
      onClose()
    } catch (err) {
      if (err?.status === 409) {
        setConflict(true)
        setError('Conflito: já existe uma consulta neste horário.')
      } else {
        setError(err?.detail || 'Não foi possível salvar as alterações.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/api/admin/appointments/${appt.id}`, { auth: true })
      onDeleted()
      onClose()
    } catch (err) {
      setError(err?.detail || 'Não foi possível excluir a consulta.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(31,17,25,0.35)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, animation:'agendaFadeIn 200ms ease' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:T.surface, borderRadius:22, padding:28, width:420, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 28px 72px rgba(90,52,78,0.14)', animation:'agendaSlideUp 260ms ease', fontFamily:T.sans }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
          <h2 style={{ fontFamily:T.serif, fontSize:18, fontWeight:600, color:T.textStrong, margin:0 }}>Editar consulta</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, padding:4, display:'flex' }}><IconX /></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={labelStyle}>Paciente</label>
            <input style={fieldStyle} value={form.client} onChange={e => set('client', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Contato</label>
            <input style={fieldStyle} placeholder="Telefone ou e-mail" value={form.contact} onChange={e => set('contact', e.target.value)} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={labelStyle}>Especialidade</label>
              <select style={{ ...fieldStyle, appearance:'none', cursor:'pointer' }} value={form.specialtyId} onChange={e => set('specialtyId', e.target.value)}>
                {specialties.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Modalidade</label>
              <select style={{ ...fieldStyle, appearance:'none', cursor:'pointer' }} value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="online">Videoconferência</option>
                <option value="presencial">Presencial</option>
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={labelStyle}>Data</label>
              <input style={fieldStyle} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={{ ...fieldStyle, appearance:'none', cursor:'pointer' }} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="confirmed">Confirmado</option>
                <option value="pending">Aguardando</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={labelStyle}>Início</label>
              <input style={fieldStyle} type="time" value={form.start} onChange={e => set('start', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Término</label>
              <input style={fieldStyle} type="time" value={form.end} onChange={e => set('end', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea style={{ ...fieldStyle, borderRadius:14, resize:'none' }} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          {error && (
            <div style={{ fontSize:12, color:T.danger, textAlign:'center' }}>{error}</div>
          )}
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <button onClick={onClose} style={{ flex:1, padding:'9px 0', borderRadius:999, border:`1px solid ${T.line}`, background:T.surfaceSoft, color:T.textSoft, fontFamily:T.sans, fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancelar</button>
            <button onClick={() => save(false)} disabled={saving} style={{ flex:1, padding:'9px 0', borderRadius:999, border:'none', background:T.accent, color:'white', fontFamily:T.sans, fontSize:13, fontWeight:700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow:'0 6px 18px rgba(122,62,106,0.28)' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
          {conflict && (
            <button onClick={() => save(true)} disabled={saving} style={{ padding:'9px 0', borderRadius:999, border:'1px solid rgba(176,80,96,0.35)', background:'rgba(176,80,96,0.06)', color:T.danger, fontFamily:T.sans, fontSize:12.5, fontWeight:700, cursor: saving ? 'wait' : 'pointer' }}>
              Ignorar conflito e salvar mesmo assim
            </button>
          )}
          <div style={{ borderTop:`1px solid ${T.line}`, paddingTop:10, marginTop:2 }}>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, width:'100%', padding:'8px 0', borderRadius:999, border:'none', background:'transparent', color:T.danger, fontFamily:T.sans, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                <IconTrash /> Excluir consulta
              </button>
            ) : (
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:11.5, color:T.textSoft, flex:1 }}>Excluir definitivamente?</span>
                <button onClick={() => setConfirmDelete(false)} style={{ padding:'6px 14px', borderRadius:999, border:`1px solid ${T.line}`, background:T.surfaceSoft, color:T.textSoft, fontFamily:T.sans, fontSize:11.5, fontWeight:600, cursor:'pointer' }}>Não</button>
                <button onClick={handleDelete} disabled={deleting} style={{ padding:'6px 14px', borderRadius:999, border:'none', background:T.danger, color:'white', fontFamily:T.sans, fontSize:11.5, fontWeight:700, cursor: deleting ? 'wait' : 'pointer' }}>
                  {deleting ? 'Excluindo...' : 'Confirmar exclusão'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
