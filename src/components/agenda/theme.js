// Design tokens shared by the agenda panel modules
export const T = {
  bg: '#f7eef3',
  surface: '#fffafb',
  surfaceSoft: '#f6edf2',
  textStrong: '#1f1119',
  text: '#2a1a24',
  textSoft: '#4a3541',
  textMuted: '#5b4552',
  accent: '#7a3e6a',
  accentStrong: '#5e2f52',
  line: '#dcc7d2',
  danger: '#b05060',
  ok: '#6dbf8f',
  serif: '"Lora","Palatino Linotype",Georgia,serif',
  sans: '"Mulish","Gill Sans",system-ui,sans-serif',
  ease: 'cubic-bezier(0.22,1,0.36,1)',
}

export const fieldStyle = {
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

export const labelStyle = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: T.textMuted,
  display: 'block',
  marginBottom: 5,
}
