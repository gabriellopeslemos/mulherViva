import { useRef } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'

// The logo mark is a spiral unwinding from the center with a loose tail —
// rebuilt here as a stroke path so it can be "drawn" as the footer scrolls in.
// Archimedean spiral (r grows linearly with the angle), slightly wider than
// tall like the original mark.
function buildSpiralPath({ turns = 2.7, cx = 200, cy = 200, maxR = 176, steps = 260 }) {
  const maxTheta = turns * Math.PI * 2
  const points = []
  for (let i = 0; i <= steps; i += 1) {
    const theta = (i / steps) * maxTheta
    const r = 8 + (theta / maxTheta) * (maxR - 8)
    // Start pointing right-down (like the inner end of the logo) and wind
    // counter-clockwise outward.
    const angle = -theta + Math.PI * 0.35
    points.push([cx + Math.cos(angle) * r * 1.06, cy + Math.sin(angle) * r])
  }
  return points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ')
}

const spiralPath = buildSpiralPath({})

const ribbonWords = [
  'Ginecologia natural',
  'Obstetrícia humanizada',
  'Ortomolecular',
  'Escuta sem pressa',
  'Cuidado integral',
  'Presencial e online',
]

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

const headlineWords = ['Seu', 'corpo', 'fala.', 'Vamos', 'ouvir', 'juntas?']

const SpiralGlyph = ({ className }) => (
  <svg className={className} viewBox="0 0 400 400" aria-hidden="true">
    <path d={spiralPath} fill="none" stroke="currentColor" strokeWidth="26" strokeLinecap="round" />
  </svg>
)

function MagneticButton({ children, className, href, ...rest }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 })
  const springY = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 })
  const prefersReducedMotion = useReducedMotion()

  const handleMove = (event) => {
    if (prefersReducedMotion || event.pointerType !== 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    x.set((event.clientX - rect.left - rect.width / 2) * 0.28)
    y.set((event.clientY - rect.top - rect.height / 2) * 0.4)
  }

  const reset = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.a
      href={href}
      className={className}
      style={{ x: springX, y: springY }}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      {...rest}
    >
      {children}
    </motion.a>
  )
}

function SiteFooter({ whatsappHref, IconWhatsapp, year }) {
  const footerRef = useRef(null)
  const prefersReducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: footerRef,
    offset: ['start end', 'end end'],
  })
  const progress = useSpring(scrollYProgress, { stiffness: 80, damping: 24, mass: 0.4 })
  const spiralDraw = useTransform(progress, [0.05, 0.75], [0, 1])
  const spiralRotate = useTransform(progress, [0, 1], [-50, 0])
  const spiralScale = useTransform(progress, [0, 1], [0.82, 1])
  const wordmarkY = useTransform(progress, [0.45, 1], ['60%', '16%'])

  const wordVariants = {
    hidden: { opacity: 0, y: '0.6em', filter: 'blur(8px)' },
    visible: (i) => ({
      opacity: 1,
      y: '0em',
      filter: 'blur(0px)',
      transition: { delay: 0.08 * i, duration: 0.9, ease: [0.22, 1, 0.36, 1] },
    }),
  }

  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: (delay = 0) => ({
      opacity: 1,
      y: 0,
      transition: { delay, duration: 0.9, ease: [0.22, 1, 0.36, 1] },
    }),
  }

  return (
    <footer className="site-footer" ref={footerRef}>
      <div className="footer-ribbon" aria-hidden="true">
        <div className="footer-ribbon__track">
          {[...ribbonWords, ...ribbonWords].map((word, index) => (
            <span className="footer-ribbon__item" key={`${word}-${index}`}>
              {word}
              <SpiralGlyph className="footer-ribbon__glyph" />
            </span>
          ))}
        </div>
      </div>

      <div className="footer-stage">
        <div className="footer-stage__glow" aria-hidden="true" />

        <motion.svg
          className="footer-spiral"
          viewBox="0 0 400 400"
          aria-hidden="true"
          style={
            prefersReducedMotion
              ? undefined
              : { rotate: spiralRotate, scale: spiralScale }
          }
        >
          <path className="footer-spiral__ghost" d={spiralPath} />
          <motion.path
            className="footer-spiral__line"
            d={spiralPath}
            style={prefersReducedMotion ? undefined : { pathLength: spiralDraw }}
          />
        </motion.svg>

        <div className="container footer-cta">
          <motion.span
            className="footer-cta__eyebrow"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.6 }}
          >
            <img src="/logo-mark.png" alt="" width="28" height="28" />
            Mulher Viva
          </motion.span>

          <motion.h2
            className="footer-cta__title"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
          >
            {headlineWords.map((word, i) => (
              <span key={word}>
                <span className="footer-cta__word-mask">
                  <motion.span
                    className={`footer-cta__word${i >= 3 ? ' footer-cta__word--accent' : ''}`}
                    custom={i}
                    variants={wordVariants}
                  >
                    {word}
                  </motion.span>
                </span>{' '}
                {i === 2 && <span className="footer-title-break" aria-hidden="true" />}
              </span>
            ))}
          </motion.h2>

          <motion.p
            className="footer-cta__lead"
            variants={fadeUp}
            custom={0.5}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.6 }}
          >
            Uma consulta sem pressa, com escuta de verdade e um olhar para você por inteiro.
            Escolha o horário que cabe na sua rotina — o resto a gente cuida junto.
          </motion.p>

          <motion.div
            className="footer-cta__actions"
            variants={fadeUp}
            custom={0.7}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.6 }}
          >
            <MagneticButton className="footer-btn footer-btn--solid" href="#agendamento">
              <span>Agendar minha consulta</span>
              <span className="footer-btn__arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </MagneticButton>
            {/* TODO: replace with real WhatsApp number */}
            <MagneticButton
              className="footer-btn footer-btn--ghost"
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconWhatsapp />
              <span>Tirar dúvidas no WhatsApp</span>
            </MagneticButton>
          </motion.div>

          <motion.ul
            className="footer-cta__promises"
            variants={fadeUp}
            custom={0.85}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.6 }}
          >
            <li>Agendamento online em minutos</li>
            <li>Remarque ou cancele pelo link do e-mail</li>
            <li>Atendimento presencial em Brasília ou online</li>
          </motion.ul>
        </div>

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
