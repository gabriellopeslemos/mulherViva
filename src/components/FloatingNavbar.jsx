import { useState } from 'react'

const navLinks = [
  { label: 'Especialidades', href: '/#especialidades' },
  { label: 'Sobre', href: '/#sobre' },
  { label: 'Depoimentos', href: '/#depoimentos' },
  { label: 'Dúvidas', href: '/#duvidas' },
  { label: 'Endereço', href: '/#endereco' },
  { label: 'Blog', href: '/#blog' },
]

function FloatingNavbar({ onOpenAgenda }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full">
      <nav className="w-full border-b border-[var(--line)] bg-[var(--surface)]/80 shadow-[0_8px_30px_color-mix(in_srgb,var(--accent-strong)_8%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex w-[min(96%,_1180px)] items-center justify-between gap-6 py-3">
          <a href="/#inicio" className="flex items-center gap-3" aria-label="Mulher Viva, voltar ao início">
            <img
              src="/logo-mark.png"
              alt="Mulher Viva"
              className="h-10 w-10 object-contain"
            />
            <div className="hidden flex-col sm:flex">
              <span className="text-sm font-bold text-[var(--text-strong)]">Mulher Viva</span>
              <span className="text-xs text-[var(--text-muted)]">Dra. Luciana da Silva Lopes</span>
            </div>
          </a>

          <div className="hidden flex-1 items-center justify-center gap-1 text-sm font-semibold text-[var(--text-soft)] md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-2 transition-colors duration-200 hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
              onClick={() => onOpenAgenda?.()}
            >
              Login
            </button>
            <a
              href="/#agendamento"
              className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold !text-white shadow-[0_10px_24px_color-mix(in_srgb,var(--accent)_35%,transparent)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] hover:shadow-[0_14px_30px_color-mix(in_srgb,var(--accent-strong)_40%,transparent)]"
            >
              Agendar consulta
            </a>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)]/80 text-[var(--accent-strong)] transition-colors duration-200 hover:bg-[var(--accent-soft)] md:hidden"
            aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((value) => !value)}
          >
            <span className="relative block h-4 w-5" aria-hidden="true">
              <span
                className={`absolute left-0 h-0.5 w-full rounded bg-current transition-transform duration-200 ${isOpen ? 'top-1.5 rotate-45' : 'top-0'}`}
              />
              <span
                className={`absolute left-0 top-1.5 h-0.5 w-full rounded bg-current transition-opacity duration-200 ${isOpen ? 'opacity-0' : 'opacity-100'}`}
              />
              <span
                className={`absolute left-0 h-0.5 w-full rounded bg-current transition-transform duration-200 ${isOpen ? 'top-1.5 -rotate-45' : 'top-3'}`}
              />
            </span>
          </button>
        </div>
      </nav>

      {isOpen ? (
        <div className="mx-auto mt-0 w-[min(96%,_1180px)] rounded-b-3xl border border-t-0 border-[var(--line)] bg-[var(--surface)]/95 p-4 shadow-[0_24px_60px_color-mix(in_srgb,var(--accent-strong)_16%,transparent)] backdrop-blur-md md:hidden">
          <div className="grid gap-1 text-sm font-semibold text-[var(--text-soft)]">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-2xl px-4 py-3 transition-colors duration-200 hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="mt-4 grid gap-2 border-t border-[var(--line)] pt-4">
            <a
              href="/#agendamento"
              className="rounded-full bg-[var(--accent)] px-4 py-3 text-center text-sm font-bold !text-white shadow-[0_10px_24px_color-mix(in_srgb,var(--accent)_35%,transparent)] transition-colors duration-200 hover:bg-[var(--accent-strong)]"
              onClick={() => setIsOpen(false)}
            >
              Agendar consulta
            </a>
            <button
              type="button"
              className="rounded-full px-4 py-3 text-sm font-semibold text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--accent-soft)]"
              onClick={() => {
                setIsOpen(false)
                onOpenAgenda?.()
              }}
            >
              Login
            </button>
          </div>
        </div>
      ) : null}
    </header>
  )
}

export default FloatingNavbar
