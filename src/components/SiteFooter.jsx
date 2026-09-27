import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'

const footerNav = [
  { label: 'Especialidades', href: '#especialidades' },
  { label: 'Sobre a doutora', href: '#sobre' },
  { label: 'Depoimentos', href: '#depoimentos' },
  { label: 'Dúvidas', href: '#duvidas' },
  { label: 'Blog', href: '#blog' },
]

// TODO: replace with the real Instagram handle
const INSTAGRAM_HANDLE = '@mulherviva'
const INSTAGRAM_URL = 'https://www.instagram.com/mulherviva/'

function SiteFooter({ year }) {
  const footerRef = useRef(null)
  const prefersReducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: footerRef,
    offset: ['start end', 'end end'],
  })
  const progress = useSpring(scrollYProgress, { stiffness: 80, damping: 24, mass: 0.4 })
  const wordmarkY = useTransform(progress, [0.3, 1], ['60%', '16%'])

  return (
    <footer className="site-footer" ref={footerRef}>
      <div className="footer-stage">
        <div className="footer-stage__glow" aria-hidden="true" />

        <div className="container footer-info">
          <nav className="footer-info__col" aria-label="Rodapé">
            <span className="footer-info__label">Navegue</span>
            {footerNav.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="footer-info__col">
            <span className="footer-info__label">Contato</span>
            <a href="tel:+5561999990000">+55 61 99999-0000</a>
            <a href="mailto:contato@mulherviva.org">contato@mulherviva.org</a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              Instagram · {INSTAGRAM_HANDLE}
            </a>
            <span>Atendimento das 8h às 18h</span>
          </div>

          <div className="footer-info__col">
            <span className="footer-info__label">Consultório</span>
            <span>Centro Médico Lúcio Costa</span>
            <span>SGAS 610, Bloco 2, Sala 250</span>
            <span>Asa Sul, Brasília - DF</span>
            <a href="#endereco">Ver no mapa</a>
          </div>
        </div>

        <p className="footer-legal">
          © {year} Mulher Viva. Todos os direitos reservados.
        </p>

        <div className="footer-wordmark" aria-hidden="true">
          <motion.span style={prefersReducedMotion ? undefined : { y: wordmarkY }}>
            Mulher Viva
          </motion.span>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
