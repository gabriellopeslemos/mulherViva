import { useEffect, useRef, useState } from 'react'

const navLinks = [
  { label: 'Sobre', href: '#sobre' },
  { label: 'Abordagem', href: '#abordagem' },
  { label: 'Especialidades', href: '#especialidades' },
  { label: 'Depoimentos', href: '#depoimentos' },
  { label: 'Blog', href: '#blog' },
  { label: 'Endereco', href: '#endereco' },
]

function FloatingNavbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const loginMenuRef = useRef(null)

  useEffect(() => {
    if (!isLoginOpen) {
      return
    }

    const handlePointerDown = (event) => {
      if (!loginMenuRef.current) {
        return
      }

      if (!loginMenuRef.current.contains(event.target)) {
        setIsLoginOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isLoginOpen])

  return (
    <header className="fixed top-5 left-1/2 z-50 w-[min(96%,_1100px)] -translate-x-1/2">
      <nav className="flex items-center justify-between gap-6 rounded-full border border-white/40 bg-purple-200/70 px-6 py-3 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-purple-500/20 text-sm font-semibold text-purple-900">
            MV
          </span>
          <div className="hidden flex-col sm:flex">
            <span className="text-sm font-semibold text-purple-950">Mulher Viva</span>
            <span className="text-xs text-purple-700">Dra. Luciana da Silva Lopes</span>
          </div>
        </div>

        <div className="hidden flex-1 items-center justify-center gap-5 text-sm font-medium text-purple-900 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors duration-200 hover:text-purple-700"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="relative" ref={loginMenuRef}>
            <button
              type="button"
              className="rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm font-semibold text-purple-900 transition-all duration-200 hover:bg-white"
              aria-haspopup="dialog"
              aria-expanded={isLoginOpen}
              aria-controls="login-popover"
              onClick={() => setIsLoginOpen((value) => !value)}
            >
              Login
            </button>
            <div
              id="login-popover"
              role="dialog"
              aria-label="Opcoes de login"
              aria-hidden={!isLoginOpen}
              className={`login-popover absolute right-0 top-full mt-3 origin-top-right rounded-2xl border border-white/70 bg-white/90 p-3 shadow-lg backdrop-blur-md transition-all duration-200 ease-out ${
                isLoginOpen
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none -translate-y-2 opacity-0'
              }`}
            >
              <button type="button" className="gsi-material-button">
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      xmlnsXlink="http://www.w3.org/1999/xlink"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">Entrar com Google</span>
                  <span style={{ display: 'none' }}>Entrar com Google</span>
                </div>
              </button>
            </div>
          </div>
          <a
            href="#contato"
            className="rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm font-semibold text-purple-900 transition-all duration-200 hover:bg-white"
          >
            Contato
          </a>
          <a
            href="#contato"
            className="rounded-full bg-[#5e2f52] px-5 py-2 text-sm font-semibold text-white !text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            Agendar Consulta
          </a>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/70 text-purple-900 transition-colors duration-200 hover:bg-white md:hidden"
          aria-label="Abrir menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((value) => !value)}
        >
          <span className="relative block h-4 w-5">
            <span className="absolute left-0 top-0 h-0.5 w-full rounded bg-current" />
            <span className="absolute left-0 top-1.5 h-0.5 w-full rounded bg-current" />
            <span className="absolute left-0 top-3 h-0.5 w-full rounded bg-current" />
          </span>
        </button>
      </nav>

      {isOpen ? (
        <div className="mt-3 rounded-3xl border border-white/50 bg-white/80 p-4 shadow-lg backdrop-blur-md md:hidden">
          <div className="grid gap-3 text-sm font-medium text-purple-900">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-2xl px-3 py-2 transition-colors duration-200 hover:bg-purple-100"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              className="rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-900 transition-colors duration-200 hover:bg-purple-100"
              onClick={() => setIsOpen(false)}
            >
              Login
            </button>
            <a
              href="#contato"
              className="rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-900 transition-colors duration-200 hover:bg-purple-100"
              onClick={() => setIsOpen(false)}
            >
              Contato
            </a>
            <a
              href="#contato"
              className="rounded-full bg-[#b6ff00] px-4 py-2 text-sm font-semibold text-white !text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => setIsOpen(false)}
            >
              Agendar Consulta
            </a>
          </div>
        </div>
      ) : null}
    </header>
  )
}

export default FloatingNavbar
