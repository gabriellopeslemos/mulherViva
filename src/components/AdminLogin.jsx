import { useState } from 'react'
import { api, setToken } from '../lib/api'

const T = {
  surface: '#fffdfc',
  surfaceSoft: '#f6ecec',
  textStrong: '#1f1119',
  text: '#2a1a24',
  textMuted: '#5b4552',
  accent: '#9a4067',
  accentStrong: '#74284a',
  line: '#e8d4d8',
  serif: '"Lora","Palatino Linotype",Georgia,serif',
  sans: '"Mulish","Gill Sans",system-ui,sans-serif',
}

const fieldStyle = {
  width: '100%',
  padding: '11px 16px',
  borderRadius: 999,
  border: `1.5px solid ${T.line}`,
  background: T.surfaceSoft,
  fontFamily: T.sans,
  fontSize: 13,
  color: T.text,
  outline: 'none',
  boxSizing: 'border-box',
}

export default function AdminLogin({ onSuccess, onClose }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await api.post('/api/auth/login', { username, password })
      setToken(data.access_token)
      onSuccess()
    } catch (err) {
      setError(err.status === 401 ? 'Usuário ou senha incorretos' : 'Não foi possível conectar ao servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31,17,25,0.4)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: T.surface,
          borderRadius: 22,
          padding: 'clamp(20px, 6vw, 32px)',
          width: 'min(360px, calc(100vw - 32px))',
          boxShadow: '0 28px 72px rgba(98,44,70,0.18)',
          fontFamily: T.sans,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              margin: '0 auto 12px',
              background: `linear-gradient(135deg, ${T.accent} 0%, ${T.accentStrong} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontFamily: T.serif,
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            MV
          </div>
          <h2 style={{ fontFamily: T.serif, fontSize: 19, fontWeight: 600, color: T.textStrong, margin: 0 }}>
            Área administrativa
          </h2>
          <p style={{ fontSize: 12, color: T.textMuted, margin: '6px 0 0' }}>
            Acesse a agenda e o painel de gestão
          </p>
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.textMuted, display: 'block', marginBottom: 5 }}>
            Usuário
          </label>
          <input
            style={fieldStyle}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.textMuted, display: 'block', marginBottom: 5 }}>
            Senha
          </label>
          <input
            style={fieldStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && (
          <div style={{ fontSize: 12, color: '#b05060', textAlign: 'center' }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, padding: '10px 0', borderRadius: 999, border: `1px solid ${T.line}`, background: T.surfaceSoft, color: T.textMuted, fontFamily: T.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 999,
              border: 'none',
              background: T.accent,
              color: 'white',
              fontFamily: T.sans,
              fontSize: 13,
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading || !username || !password ? 0.6 : 1,
              boxShadow: '0 6px 18px rgba(154,64,103,0.28)',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
