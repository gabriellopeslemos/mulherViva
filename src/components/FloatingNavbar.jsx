import { useState } from 'react'

const navLinks = [
  { label: 'Sobre', href: '#sobre' },
  { label: 'Abordagem', href: '#abordagem' },
  { label: 'Especialidades', href: '#especialidades' },
  { label: 'Depoimentos', href: '#depoimentos' },
  { label: 'Blog', href: '#blog' },
  { label: 'Acesso', href: './acesso.html' },
  { label: 'Endereco', href: '#endereco' },
]

function FloatingNavbar() {
  const [isOpen, setIsOpen] = useState(false)

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
