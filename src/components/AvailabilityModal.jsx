import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

const T = {
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
}

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const PERIODS = {
  manha: { label: 'Manhã (08h–12h)', start: '08:00', end: '12:00' },
  tarde: { label: 'Tarde (13h–18h)', start: '13:00', end: '18:00' },
  custom: { label: 'Personalizado', start: '08:00', end: '12:00' },
}

const fieldStyle = {
  width: '100%',
  padding: '9px 13px',
  borderRadius: 999,
  border: `1.5px solid ${T.line}`,
  background: T.surfaceSoft,
  fontFamily: T.sans,
  fontSize: 12.5,
  color: T.text,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: T.textMuted,
  display: 'block',
  marginBottom: 5,
}

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

export default function AvailabilityModal({ onClose, specialties, onAuthExpired }) {
  const [rules, setRules] = useState([])
  const [overrides, setOverrides] = useState([])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [ruleForm, setRuleForm] = useState({
    specialtyIds: specialties.map((s) => s.id),
    weekday: 0,
    period: 'manha',
    start: '08:00',
    end: '12:00',
  })
  const [blockForm, setBlockForm] = useState({ date: '', reason: '' })

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
      .get('/api/admin/availability/rules', { auth: true })
      .then(setRules)
      .catch(handleApiError)
    api
      .get('/api/admin/availability/overrides', { auth: true })
      .then(setOverrides)
      .catch(handleApiError)
  }, [handleApiError])

  useEffect(() => { load() }, [load])

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
    specialties.find((s) => s.id === id)?.name || `Especialidade ${id}`

  const rulesBySpecialty = specialties.map((s) => ({
    specialty: s,
    rules: rules
      .filter((r) => r.specialty_id === s.id)
      .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)),
  }))

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31,17,25,0.35)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: 22,
          width: 560,
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 28px 72px rgba(90,52,78,0.16)',
          fontFamily: T.sans,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 26px 14px', borderBottom: `1px solid ${T.line}` }}>
          <h2 style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 600, color: T.textStrong, margin: 0 }}>
            Disponibilidade
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 4, fontSize: 16, lineHeight: 1 }}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '18px 26px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Add rule */}
          <div>
            <p style={sectionTitleStyle}>Novo horário semanal</p>
            <p style={{ fontSize: 12, color: T.textMuted, margin: '0 0 12px', lineHeight: 1.5 }}>
              Somente os horários abertos aqui ficam disponíveis para agendamento —
              todo o restante é bloqueado automaticamente.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Especialidades</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {specialties.map((s) => {
                  const sel = ruleForm.specialtyIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSpecialty(s.id)}
                      style={{ padding: '6px 13px', borderRadius: 999, border: `1.5px solid ${sel ? T.accent : T.line}`, background: sel ? 'rgba(122,62,106,0.1)' : T.surfaceSoft, color: sel ? T.accent : T.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: T.sans, transition: 'all 150ms' }}
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
                        f.specialtyIds.length === specialties.length
                          ? []
                          : specialties.map((s) => s.id),
                    }))
                  }
                  style={{ padding: '6px 13px', borderRadius: 999, border: 'none', background: 'transparent', color: T.accentStrong, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: T.sans, textDecoration: 'underline' }}
                >
                  {ruleForm.specialtyIds.length === specialties.length ? 'Limpar' : 'Todas'}
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Dia da semana</label>
                <select style={{ ...fieldStyle, cursor: 'pointer' }} value={ruleForm.weekday} onChange={(e) => setRule('weekday', e.target.value)}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Período</label>
                <select style={{ ...fieldStyle, cursor: 'pointer' }} value={ruleForm.period} onChange={(e) => handlePeriodChange(e.target.value)}>
                  {Object.entries(PERIODS).map(([k, p]) => (
                    <option key={k} value={k}>{p.label}</option>
                  ))}
                </select>
              </div>
              {ruleForm.period === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
              style={{ marginTop: 12, padding: '9px 22px', borderRadius: 999, border: 'none', background: T.accent, color: 'white', fontFamily: T.sans, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: '0 6px 18px rgba(122,62,106,0.28)' }}
            >
              {saving ? 'Salvando...' : 'Adicionar horário'}
            </button>
          </div>

          {/* Rules list */}
          <div>
            <p style={sectionTitleStyle}>Horários cadastrados</p>
            {rules.length === 0 && (
              <p style={{ fontSize: 12.5, color: T.textMuted, margin: 0 }}>
                Nenhum horário cadastrado. Sem horários, os pacientes não conseguem agendar online.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {rulesBySpecialty.map(({ specialty, rules: list }) =>
                list.length === 0 ? null : (
                  <div key={specialty.id}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textStrong, fontFamily: T.serif, marginBottom: 6 }}>
                      {specialty.name}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {list.map((r) => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 13px', borderRadius: 11, background: T.surfaceSoft, border: `1px solid ${T.line}` }}>
                          <span style={{ fontSize: 12.5, color: T.textSoft }}>
                            <strong style={{ color: T.textStrong }}>{WEEKDAYS[r.weekday]}</strong>
                            {` · ${formatTime(r.start_time)} – ${formatTime(r.end_time)}`}
                          </span>
                          <button
                            onClick={() => handleDeleteRule(r.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b05060', fontSize: 11.5, fontWeight: 700, fontFamily: T.sans, padding: '2px 6px' }}
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Blocks */}
          <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 18 }}>
            <p style={sectionTitleStyle}>Bloqueios de agenda</p>
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto', gap: 8, alignItems: 'end' }}>
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
                style={{ padding: '9px 18px', borderRadius: 999, border: `1.5px solid ${T.accent}`, background: 'transparent', color: T.accent, fontFamily: T.sans, fontSize: 12.5, fontWeight: 700, cursor: saving || !blockForm.date ? 'default' : 'pointer', opacity: saving || !blockForm.date ? 0.5 : 1 }}
              >
                Bloquear dia
              </button>
            </div>
            {overrides.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12 }}>
                {overrides.map((o) => (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 13px', borderRadius: 11, background: 'rgba(176,80,96,0.06)', border: '1px solid rgba(176,80,96,0.2)' }}>
                    <span style={{ fontSize: 12.5, color: T.textSoft }}>
                      <strong style={{ color: T.textStrong }}>
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
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b05060', fontSize: 11.5, fontWeight: 700, fontFamily: T.sans, padding: '2px 6px' }}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#b05060', textAlign: 'center' }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  )
}
