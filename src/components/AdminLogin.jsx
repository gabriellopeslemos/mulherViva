import { useState } from 'react'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { api, setToken } from '../lib/api'

const T = {
  surface: 'var(--surface)',
  surfaceSoft: 'var(--surface-soft)',
  textStrong: 'var(--text-strong)',
  text: 'var(--text)',
  textMuted: 'var(--text-muted)',
  accent: 'var(--accent)',
  accentStrong: 'var(--accent-strong)',
  accentContrast: 'var(--accent-contrast)',
  line: 'var(--line)',
  serif: '"Lora","Palatino Linotype",Georgia,serif',
  sans: '"Mulish","Gill Sans",system-ui,sans-serif',
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
// import.meta.env.DEV garante que o botao de bypass nunca entra no build de producao.
const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

export default function AdminLogin({ onSuccess, onClose }) {
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleCredential = async (response) => {
    setError(null)
    setLoading(true)
    try {
      const data = await api.post('/api/auth/google', { credential: response.credential })
      setToken(data.access_token)
      onSuccess()
    } catch (err) {
      if (err.status === 403) {
        setError('Este e-mail não tem acesso ao painel')
      } else if (err.status === 401) {
        setError('Falha na verificação do Google')
      } else {
        setError('Não foi possível conectar ao servidor')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDevLogin = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await api.post('/api/auth/dev-login')
      setToken(data.access_token)
      onSuccess()
    } catch (err) {
      if (err.status === 404) {
        setError('Bypass desativado no backend (DEV_AUTH_BYPASS)')
      } else {
        setError('Não foi possível conectar ao servidor')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, var(--text-strong) 40%, transparent)',
        backdropFilter: 'blur(5px)',
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
          padding: 'clamp(20px, 6vw, 32px)',
          width: 'min(360px, calc(100vw - 32px))',
          boxShadow: '0 28px 72px color-mix(in srgb, var(--accent-strong) 18%, transparent)',
          fontFamily: T.sans,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ textAlign: 'center' }}>
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
              color: T.accentContrast,
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
            Acesse com sua conta Google autorizada
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {GOOGLE_CLIENT_ID ? (
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <div style={{ opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
                <GoogleLogin
                  onSuccess={handleCredential}
                  onError={() => setError('Não foi possível iniciar o login com o Google')}
                  shape="pill"
                  text="signin_with"
                  locale="pt-BR"
                  width="280"
                />
              </div>
            </GoogleOAuthProvider>
          ) : (
            <div style={{ fontSize: 12, color: '#b05060', textAlign: 'center' }}>
              Login Google não configurado (defina VITE_GOOGLE_CLIENT_ID)
            </div>
          )}
          {DEV_BYPASS && (
            <button
              type="button"
              onClick={handleDevLogin}
              disabled={loading}
              style={{
                padding: '8px 20px',
                borderRadius: 999,
                border: `1px dashed ${T.accent}`,
                background: 'transparent',
                color: T.accent,
                fontFamily: T.sans,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Entrar sem Google (dev)
            </button>
          )}
          {loading && (
            <div style={{ fontSize: 12, color: T.textMuted }}>Entrando...</div>
          )}
          {error && (
            <div style={{ fontSize: 12, color: '#b05060', textAlign: 'center' }}>{error}</div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '10px 0',
            borderRadius: 999,
            border: `1px solid ${T.line}`,
            background: T.surfaceSoft,
            color: T.textMuted,
            fontFamily: T.sans,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Voltar
        </button>
      </div>
    </div>
  )
}
