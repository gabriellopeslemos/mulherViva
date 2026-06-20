import { useState } from 'react'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { api, setToken } from '../lib/api'

const T = {
  surface: '#fffafb',
  surfaceSoft: '#f6edf2',
  textStrong: '#1f1119',
  text: '#2a1a24',
  textMuted: '#5b4552',
  accent: '#7a3e6a',
  accentStrong: '#5e2f52',
  line: '#dcc7d2',
  serif: '"Lora","Palatino Linotype",Georgia,serif',
  sans: '"Mulish","Gill Sans",system-ui,sans-serif',
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

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
      <div
        style={{
          background: T.surface,
          borderRadius: 22,
          padding: 'clamp(20px, 6vw, 32px)',
          width: 'min(360px, calc(100vw - 32px))',
          boxShadow: '0 28px 72px rgba(90,52,78,0.18)',
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
