import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { T, fieldStyle, labelStyle } from './agenda/theme'
import { IconX } from './agenda/ui'

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const PERIODS = {
  manha: { label: 'Manhã (08h–12h)', start: '08:00', end: '12:00' },
  tarde: { label: 'Tarde (13h–18h)', start: '13:00', end: '18:00' },
  custom: { label: 'Personalizado', start: '08:00', end: '12:00' },
}
const DURATIONS = [30, 45, 60, 90]

const sectionTitleStyle = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.2em',
  color: T.accent,
  margin: '0 0 10px',
}

function formatTime(t) {
  return t ? t.slice(0, 5) : ''
}

// ── Specialty settings row ────────────────────────────────────────────────────
function SpecialtyRow({ specialty, onSaved, onError }) {
  const [name, setName] = useState(specialty.name)
  const [duration, setDuration] = useState(specialty.slot_duration_min)
  const [active, setActive] = useState(specialty.active)
  const [saving, setSaving] = useState(false)

  const dirty =
    name.trim() !== specialty.name ||
    Number(duration) !== specialty.slot_duration_min ||
    active !== specialty.active

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const updated = await api.patch(
        `/api/admin/specialties/${specialty.id}`,
        { name: name.trim(), slot_duration_min: Number(duration), active },
        { auth: true },
      )
      onSaved(updated)
    } catch (err) {
      onError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', padding:'8px 12px', borderRadius:12, background:T.surfaceSoft, border:`1px solid ${T.line}`, opacity: active ? 1 : 0.65 }}>
      <input style={{ ...fieldStyle, background:T.surface }} value={name} onChange={e => setName(e.target.value)} />
      <select style={{ ...fieldStyle, background:T.surface, cursor:'pointer' }} value={duration} onChange={e => setDuration(e.target.value)}>
        {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
      </select>
      <button
        type="button"
        onClick={() => setActive(a => !a)}
        title={active ? 'Especialidade ativa — clique para desativar' : 'Especialidade inativa — clique para ativar'}
        style={{ width:36, height:20, borderRadius:999, border:'none', cursor:'pointer', position:'relative', background: active ? T.accent : T.line, transition:'background 180ms', flexShrink:0 }}
      >
        <span style={{ position:'absolute', top:2, left: active ? 18 : 2, width:16, height:16, borderRadius:'50%', background:'white', transition:'left 180ms', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
      <button
        onClick={handleSave}
        disabled={!dirty || saving}
        style={{ padding:'6px 14px', borderRadius:999, border:'none', background: dirty ? T.accent : T.line, color:'white', fontFamily:T.sans, fontSize:11.5, fontWeight:700, cursor: dirty && !saving ? 'pointer' : 'default', opacity: saving ? 0.7 : 1, transition:'background 180ms' }}
      >
        {saving ? '...' : 'Salvar'}
      </button>
    </div>
  )
}

// ── Inline rule editor ────────────────────────────────────────────────────────
function RuleEditor({ rule, onSaved, onCancel, onError }) {
  const [weekday, setWeekday] = useState(rule.weekday)
  const [start, setStart] = useState(formatTime(rule.start_time))
  const [end, setEnd] = useState(formatTime(rule.end_time))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!start || !end || end <= start) {
      onError({ detail: 'Informe um intervalo de horário válido.' })
      return
    }
    setSaving(true)
    try {
      const updated = await api.patch(
        `/api/admin/availability/rules/${rule.id}`,
        { weekday: Number(weekday), start_time: start, end_time: end },
        { auth: true },
      )
      onSaved(updated)
    } catch (err) {
      onError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 95px 95px auto auto', gap:7, alignItems:'center', padding:'7px 13px', borderRadius:11, background:'rgba(122,62,106,0.06)', border:`1.5px solid ${T.accent}` }}>
      <select style={{ ...fieldStyle, padding:'6px 10px', cursor:'pointer' }} value={weekday} onChange={e => setWeekday(e.target.value)}>
        {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
      </select>
      <input style={{ ...fieldStyle, padding:'6px 10px' }} type="time" value={start} onChange={e => setStart(e.target.value)} />
      <input style={{ ...fieldStyle, padding:'6px 10px' }} type="time" value={end} onChange={e => setEnd(e.target.value)} />
      <button onClick={handleSave} disabled={saving} style={{ padding:'6px 13px', borderRadius:999, border:'none', background:T.accent, color:'white', fontFamily:T.sans, fontSize:11.5, fontWeight:700, cursor: saving ? 'wait' : 'pointer' }}>
        {saving ? '...' : 'Salvar'}
      </button>
      <button onClick={onCancel} style={{ padding:'6px 10px', borderRadius:999, border:`1px solid ${T.line}`, background:T.surface, color:T.textMuted, fontFamily:T.sans, fontSize:11.5, fontWeight:600, cursor:'pointer' }}>
        Cancelar
      </button>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function AvailabilityModal({ onClose, onAuthExpired }) {
  const [allSpecialties, setAllSpecialties] = useState([])
  const [rules, setRules] = useState([])
  const [overrides, setOverrides] = useState([])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState(null)
  const initRef = useRef(false)

  const [ruleForm, setRuleForm] = useState({
    specialtyIds: [],
    weekday: 0,
    period: 'manha',
    start: '08:00',
    end: '12:00',
  })
  const [blockForm, setBlockForm] = useState({ date: '', reason: '' })
  const [openForm, setOpenForm] = useState({ date: '', start: '09:00', end: '12:00', specialtyId: '' })

  const handleApiError = useCallback(
    (err) => {
      if (err?.status === 401) {
        onAuthExpired?.()
        return
      }
      setError(err?.detail || 'Falha ao comunicar com o servidor.')
    },
    [onAuthExpired],
  )

  const load = useCallback(() => {
    api
      .get('/api/admin/specialties', { auth: true })
      .then(data => {
        setAllSpecialties(data)
        if (!initRef.current) {
          initRef.current = true
          setRuleForm(f => ({ ...f, specialtyIds: data.filter(s => s.active).map(s => s.id) }))
        }
      })
      .catch(handleApiError)
    api
      .get('/api/admin/availability/rules', { auth: true })
      .then(setRules)
      .catch(handleApiError)
    api
      .get('/api/admin/availability/overrides', { auth: true })
      .then(setOverrides)
      .catch(handleApiError)
  }, [handleApiError])

  useEffect(() => { load() }, [load])

  const activeSpecialties = allSpecialties.filter(s => s.active)

  const setRule = (k, v) => setRuleForm((f) => ({ ...f, [k]: v }))

  const toggleSpecialty = (id) =>
    setRuleForm((f) => ({
      ...f,
      specialtyIds: f.specialtyIds.includes(id)
        ? f.specialtyIds.filter((x) => x !== id)
        : [...f.specialtyIds, id],
    }))

  const handlePeriodChange = (period) => {
    const p = PERIODS[period]
    setRuleForm((f) => ({ ...f, period, start: p.start, end: p.end }))
  }

  const handleAddRule = async () => {
    if (ruleForm.specialtyIds.length === 0) {
      setError('Selecione ao menos uma especialidade.')
      return
    }
    if (!ruleForm.start || !ruleForm.end || ruleForm.end <= ruleForm.start) {
      setError('Informe um intervalo de horário válido.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      for (const id of ruleForm.specialtyIds) {
        await api.post(
          '/api/admin/availability/rules',
          {
            specialty_id: id,
            weekday: Number(ruleForm.weekday),
            start_time: ruleForm.start,
            end_time: ruleForm.end,
          },
          { auth: true },
        )
      }
      load()
    } catch (err) {
      handleApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRule = async (id) => {
    setError(null)
    try {
      await api.delete(`/api/admin/availability/rules/${id}`, { auth: true })
      setRules((list) => list.filter((r) => r.id !== id))
    } catch (err) {
      handleApiError(err)
    }
  }

  const handleAddBlock = async () => {
    if (!blockForm.date) return
    setError(null)
    setSaving(true)
    try {
      await api.post(
        '/api/admin/availability/overrides',
        { date: blockForm.date, kind: 'block', reason: blockForm.reason.trim() || null },
        { auth: true },
      )
      setBlockForm({ date: '', reason: '' })
      load()
    } catch (err) {
      handleApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleAddOpening = async () => {
    if (!openForm.date || !openForm.start || !openForm.end) return
    if (openForm.end <= openForm.start) {
      setError('Informe um intervalo de horário válido para a abertura.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await api.post(
        '/api/admin/availability/overrides',
        {
          date: openForm.date,
          start_time: openForm.start,
          end_time: openForm.end,
          kind: 'open',
          specialty_id: openForm.specialtyId ? Number(openForm.specialtyId) : null,
        },
        { auth: true },
      )
      setOpenForm({ date: '', start: '09:00', end: '12:00', specialtyId: '' })
      load()
    } catch (err) {
      handleApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteOverride = async (id) => {
    setError(null)
    try {
      await api.delete(`/api/admin/availability/overrides/${id}`, { auth: true })
      setOverrides((list) => list.filter((o) => o.id !== id))
    } catch (err) {
      handleApiError(err)
    }
  }

  const specialtyName = (id) =>
    allSpecialties.find((s) => s.id === id)?.name || `Especialidade ${id}`

  const rulesBySpecialty = allSpecialties.map((s) => ({
    specialty: s,
    rules: rules
      .filter((r) => r.specialty_id === s.id)
      .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)),
  }))

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(31,17,25,0.35)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background:T.surface, borderRadius:22, width:'min(620px,calc(100vw - 16px))', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 28px 72px rgba(90,52,78,0.16)', fontFamily:T.sans, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 26px 14px', borderBottom:`1px solid ${T.line}` }}>
          <h2 style={{ fontFamily:T.serif, fontSize:18, fontWeight:600, color:T.textStrong, margin:0 }}>
            Disponibilidade
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.textMuted, padding:4, display:'flex' }} aria-label="Fechar">
            <IconX />
          </button>
        </div>

        <div style={{ overflowY:'auto', padding:'18px 26px 24px', display:'flex', flexDirection:'column', gap:22 }}>

          {/* Specialty settings */}
          <div>
            <p style={sectionTitleStyle}>Especialidades</p>
            <p style={{ fontSize:12, color:T.textMuted, margin:'0 0 10px', lineHeight:1.5 }}>
              Nome, duração padrão da consulta e visibilidade no site público.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {allSpecialties.map(s => (
                <SpecialtyRow
                  key={s.id}
                  specialty={s}
                  onSaved={updated => setAllSpecialties(list => list.map(x => (x.id === updated.id ? updated : x)))}
                  onError={handleApiError}
                />
              ))}
            </div>
          </div>

          {/* Add rule */}
          <div style={{ borderTop:`1px solid ${T.line}`, paddingTop:18 }}>
            <p style={sectionTitleStyle}>Novo horário semanal</p>
            <p style={{ fontSize:12, color:T.textMuted, margin:'0 0 12px', lineHeight:1.5 }}>
              Somente os horários abertos aqui ficam disponíveis para agendamento —
              todo o restante é bloqueado automaticamente.
            </p>
            <div style={{ marginBottom:12 }}>
              <label style={labelStyle}>Especialidades</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {activeSpecialties.map((s) => {
                  const sel = ruleForm.specialtyIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSpecialty(s.id)}
                      style={{ padding:'6px 13px', borderRadius:999, border:`1.5px solid ${sel ? T.accent : T.line}`, background: sel ? 'rgba(122,62,106,0.1)' : T.surfaceSoft, color: sel ? T.accent : T.textMuted, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:T.sans, transition:'all 150ms' }}
                    >
                      {s.name}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() =>
                    setRuleForm((f) => ({
                      ...f,
                      specialtyIds:
                        f.specialtyIds.length === activeSpecialties.length
                          ? []
                          : activeSpecialties.map((s) => s.id),
                    }))
                  }
                  style={{ padding:'6px 13px', borderRadius:999, border:'none', background:'transparent', color:T.accentStrong, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:T.sans, textDecoration:'underline' }}
                >
                  {ruleForm.specialtyIds.length === activeSpecialties.length ? 'Limpar' : 'Todas'}
                </button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={labelStyle}>Dia da semana</label>
                <select style={{ ...fieldStyle, cursor:'pointer' }} value={ruleForm.weekday} onChange={(e) => setRule('weekday', e.target.value)}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Período</label>
                <select style={{ ...fieldStyle, cursor:'pointer' }} value={ruleForm.period} onChange={(e) => handlePeriodChange(e.target.value)}>
                  {Object.entries(PERIODS).map(([k, p]) => (
                    <option key={k} value={k}>{p.label}</option>
                  ))}
                </select>
              </div>
              {ruleForm.period === 'custom' && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div>
                    <label style={labelStyle}>Início</label>
                    <input style={fieldStyle} type="time" value={ruleForm.start} onChange={(e) => setRule('start', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Fim</label>
                    <input style={fieldStyle} type="time" value={ruleForm.end} onChange={(e) => setRule('end', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleAddRule}
              disabled={saving}
              style={{ marginTop:12, padding:'9px 22px', borderRadius:999, border:'none', background:T.accent, color:'white', fontFamily:T.sans, fontSize:12.5, fontWeight:700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow:'0 6px 18px rgba(122,62,106,0.28)' }}
            >
              {saving ? 'Salvando...' : 'Adicionar horário'}
            </button>
          </div>

          {/* Rules list */}
          <div>
            <p style={sectionTitleStyle}>Horários cadastrados</p>
            {rules.length === 0 && (
              <p style={{ fontSize:12.5, color:T.textMuted, margin:0 }}>
                Nenhum horário cadastrado. Sem horários, os pacientes não conseguem agendar online.
              </p>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {rulesBySpecialty.map(({ specialty, rules: list }) =>
                list.length === 0 ? null : (
                  <div key={specialty.id}>
                    <div style={{ fontSize:12, fontWeight:700, color:T.textStrong, fontFamily:T.serif, marginBottom:6 }}>
                      {specialty.name}{!specialty.active && <span style={{ fontSize:10, color:T.textMuted, fontWeight:400, fontFamily:T.sans }}> (inativa)</span>}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      {list.map((r) =>
                        editingRuleId === r.id ? (
                          <RuleEditor
                            key={r.id}
                            rule={r}
                            onSaved={updated => {
                              setRules(rs => rs.map(x => (x.id === updated.id ? updated : x)))
                              setEditingRuleId(null)
                              setError(null)
                            }}
                            onCancel={() => setEditingRuleId(null)}
                            onError={handleApiError}
                          />
                        ) : (
                          <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 13px', borderRadius:11, background:T.surfaceSoft, border:`1px solid ${T.line}` }}>
                            <span style={{ fontSize:12.5, color:T.textSoft }}>
                              <strong style={{ color:T.textStrong }}>{WEEKDAYS[r.weekday]}</strong>
                              {` · ${formatTime(r.start_time)} – ${formatTime(r.end_time)}`}
                            </span>
                            <span style={{ display:'flex', gap:2 }}>
                              <button
                                onClick={() => setEditingRuleId(r.id)}
                                style={{ background:'none', border:'none', cursor:'pointer', color:T.accent, fontSize:11.5, fontWeight:700, fontFamily:T.sans, padding:'2px 6px' }}
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteRule(r.id)}
                                style={{ background:'none', border:'none', cursor:'pointer', color:T.danger, fontSize:11.5, fontWeight:700, fontFamily:T.sans, padding:'2px 6px' }}
                              >
                                Remover
                              </button>
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Exceptions */}
          <div style={{ borderTop:`1px solid ${T.line}`, paddingTop:18 }}>
            <p style={sectionTitleStyle}>Exceções de agenda</p>

            <label style={{ ...labelStyle, marginBottom:8 }}>Bloquear dia inteiro</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'flex-end', marginBottom:16 }}>
              <div>
                <label style={labelStyle}>Data</label>
                <input style={fieldStyle} type="date" value={blockForm.date} onChange={(e) => setBlockForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Motivo (opcional)</label>
                <input style={fieldStyle} placeholder="Feriado, congresso..." value={blockForm.reason} onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))} />
              </div>
              <button
                onClick={handleAddBlock}
                disabled={saving || !blockForm.date}
                style={{ padding:'9px 18px', borderRadius:999, border:'1.5px solid rgba(176,80,96,0.5)', background:'transparent', color:T.danger, fontFamily:T.sans, fontSize:12.5, fontWeight:700, cursor: saving || !blockForm.date ? 'default' : 'pointer', opacity: saving || !blockForm.date ? 0.5 : 1 }}
              >
                Bloquear dia
              </button>
            </div>

            <label style={{ ...labelStyle, marginBottom:8 }}>Abertura extra (fora do horário semanal)</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'flex-end' }}>
              <div>
                <label style={labelStyle}>Data</label>
                <input style={fieldStyle} type="date" value={openForm.date} onChange={(e) => setOpenForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Início</label>
                <input style={fieldStyle} type="time" value={openForm.start} onChange={(e) => setOpenForm((f) => ({ ...f, start: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Fim</label>
                <input style={fieldStyle} type="time" value={openForm.end} onChange={(e) => setOpenForm((f) => ({ ...f, end: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Especialidade</label>
                <select style={{ ...fieldStyle, cursor:'pointer' }} value={openForm.specialtyId} onChange={(e) => setOpenForm((f) => ({ ...f, specialtyId: e.target.value }))}>
                  <option value="">Todas</option>
                  {activeSpecialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button
                onClick={handleAddOpening}
                disabled={saving || !openForm.date}
                style={{ padding:'9px 18px', borderRadius:999, border:`1.5px solid ${T.accent}`, background:'transparent', color:T.accent, fontFamily:T.sans, fontSize:12.5, fontWeight:700, cursor: saving || !openForm.date ? 'default' : 'pointer', opacity: saving || !openForm.date ? 0.5 : 1 }}
              >
                Abrir
              </button>
            </div>

            {overrides.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:14 }}>
                {overrides.map((o) => (
                  <div key={o.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 13px', borderRadius:11, background: o.kind === 'block' ? 'rgba(176,80,96,0.06)' : 'rgba(109,191,143,0.1)', border: o.kind === 'block' ? '1px solid rgba(176,80,96,0.2)' : '1px solid rgba(109,191,143,0.35)' }}>
                    <span style={{ fontSize:12.5, color:T.textSoft }}>
                      <strong style={{ color:T.textStrong }}>
                        {new Date(`${o.date}T00:00:00`).toLocaleDateString('pt-BR')}
                      </strong>
                      {o.kind === 'block'
                        ? o.start_time
                          ? ` · bloqueado ${formatTime(o.start_time)} – ${formatTime(o.end_time)}`
                          : ' · dia inteiro bloqueado'
                        : ` · aberto ${formatTime(o.start_time)} – ${formatTime(o.end_time)}`}
                      {o.specialty_id ? ` · ${specialtyName(o.specialty_id)}` : ''}
                      {o.reason ? ` — ${o.reason}` : ''}
                    </span>
                    <button
                      onClick={() => handleDeleteOverride(o.id)}
                      style={{ background:'none', border:'none', cursor:'pointer', color:T.danger, fontSize:11.5, fontWeight:700, fontFamily:T.sans, padding:'2px 6px' }}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{ fontSize:12, color:T.danger, textAlign:'center' }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  )
}
