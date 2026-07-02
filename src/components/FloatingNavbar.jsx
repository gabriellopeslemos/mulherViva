import { useState } from 'react'

const navLinks = [
  { label: 'Sobre', href: '#sobre' },
  { label: 'Abordagem', href: '#abordagem' },
  { label: 'Especialidades', href: '#especialidades' },
  { label: 'Depoimentos', href: '#depoimentos' },
  { label: 'Blog', href: '#blog' },
  { label: 'Endereço', href: '#endereco' },
]

function FloatingNavbar({ onOpenAgenda }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="fixed top-5 left-1/2 z-50 w-[min(96%,_1100px)] -translate-x-1/2">
      <nav className="flex items-center justify-between gap-6 rounded-full border border-[#e8d4d8] bg-[#fffdfc]/80 px-6 py-3 shadow-[0_18px_40px_rgba(98,44,70,0.1)] backdrop-blur-md">
        <a href="#inicio" className="flex items-center gap-3" aria-label="Voltar ao início">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#9a4067] to-[#74284a] font-serif text-sm font-semibold text-white">
            MV
          </span>
          <div className="hidden flex-col sm:flex">
            <span className="text-sm font-bold text-[#2b1421]">Mulher Viva</span>
            <span className="text-xs text-[#6d5260]">Dra. Luciana da Silva Lopes</span>
          </div>
        </a>

        <div className="hidden flex-1 items-center justify-center gap-1 text-sm font-semibold text-[#5d4250] md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 transition-colors duration-200 hover:bg-[#f7ebf0] hover:text-[#74284a]"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            className="rounded-full px-4 py-2 text-sm font-semibold text-[#6d5260] transition-colors duration-200 hover:bg-[#f7ebf0] hover:text-[#74284a]"
            onClick={() => onOpenAgenda?.()}
          >
            Login
          </button>
          <a
            href="#agendamento"
            className="rounded-full bg-[#9a4067] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(154,64,103,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#74284a] hover:shadow-[0_14px_30px_rgba(116,40,74,0.4)]"
          >
            Agendar consulta
          </a>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e8d4d8] bg-white/80 text-[#74284a] transition-colors duration-200 hover:bg-[#f7ebf0] md:hidden"
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
      </nav>

      {isOpen ? (
        <div className="mt-3 rounded-3xl border border-[#e8d4d8] bg-[#fffdfc]/95 p-4 shadow-[0_24px_60px_rgba(98,44,70,0.16)] backdrop-blur-md md:hidden">
          <div className="grid gap-1 text-sm font-semibold text-[#5d4250]">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-2xl px-4 py-3 transition-colors duration-200 hover:bg-[#f7ebf0] hover:text-[#74284a]"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="mt-4 grid gap-2 border-t border-[#f0e2e6] pt-4">
            <a
              href="#agendamento"
              className="rounded-full bg-[#9a4067] px-4 py-3 text-center text-sm font-bold text-white shadow-[0_10px_24px_rgba(154,64,103,0.35)] transition-colors duration-200 hover:bg-[#74284a]"
              onClick={() => setIsOpen(false)}
            >
              Agendar consulta
            </a>
            <button
              type="button"
              className="rounded-full px-4 py-3 text-sm font-semibold text-[#6d5260] transition-colors duration-200 hover:bg-[#f7ebf0]"
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
