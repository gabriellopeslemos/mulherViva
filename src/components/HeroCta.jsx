import { useRef } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import { buildSpiralPath } from '../lib/spiral'

const spiralPath = buildSpiralPath()

const headlineWords = ['Seu', 'corpo', 'fala.', 'Vamos', 'ouvir', 'juntas?']

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

// Alternative hero (the former footer CTA): dark stage, drawn spiral and a
// word-by-word headline. Plays on mount; the spiral keeps turning as the hero
// scrolls away.
function HeroCta({ whatsappHref, IconWhatsapp }) {
  const heroRef = useRef(null)
  const prefersReducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const progress = useSpring(scrollYProgress, { stiffness: 80, damping: 24, mass: 0.4 })
  const spiralRotate = useTransform(progress, [0, 1], [0, 40])
  const spiralY = useTransform(progress, [0, 1], ['0%', '18%'])

  const wordVariants = {
    hidden: { opacity: 0, y: '0.6em', filter: 'blur(8px)' },
    visible: (i) => ({
      opacity: 1,
      y: '0em',
      filter: 'blur(0px)',
      transition: { delay: 0.25 + 0.08 * i, duration: 0.9, ease: [0.22, 1, 0.36, 1] },
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

  const motionProps = prefersReducedMotion
    ? { initial: false, animate: 'visible' }
    : { initial: 'hidden', animate: 'visible' }

  return (
    <div className="hero-cta" ref={heroRef}>
      <div className="hero-cta__glow" aria-hidden="true" />

      <motion.svg
        className="hero-cta__spiral"
        viewBox="0 0 400 400"
        aria-hidden="true"
        style={prefersReducedMotion ? undefined : { rotate: spiralRotate, y: spiralY }}
      >
        <path className="hero-cta__spiral-ghost" d={spiralPath} />
        <motion.path
          className="hero-cta__spiral-line"
          d={spiralPath}
          initial={prefersReducedMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.6, delay: 0.2, ease: [0.65, 0, 0.35, 1] }}
        />
      </motion.svg>

      <div className="container hero-cta__content">
        <motion.span className="hero-cta__eyebrow" variants={fadeUp} custom={0.1} {...motionProps}>
          <img src="/logo-mark.png" alt="" width="28" height="28" />
          Mulher Viva
        </motion.span>

        <motion.h1 className="hero-cta__title" {...motionProps}>
          {headlineWords.map((word, i) => (
            <span key={word}>
              <span className="hero-cta__word-mask">
                <motion.span
                  className={`hero-cta__word${i >= 3 ? ' hero-cta__word--accent' : ''}`}
                  custom={i}
                  variants={wordVariants}
                >
                  {word}
                </motion.span>
              </span>{' '}
              {i === 2 && <span className="hero-cta__title-break" aria-hidden="true" />}
            </span>
          ))}
        </motion.h1>

        <motion.p className="hero-cta__lead" variants={fadeUp} custom={0.8} {...motionProps}>
          Uma consulta sem pressa, com escuta de verdade e um olhar para você por inteiro.
          Escolha o horário que cabe na sua rotina — o resto a gente cuida junto.
        </motion.p>

        <motion.div className="hero-cta__actions" variants={fadeUp} custom={1} {...motionProps}>
          <MagneticButton className="hero-cta__btn hero-cta__btn--solid" href="#agendamento">
            <span>Agendar minha consulta</span>
            <span className="hero-cta__btn-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </MagneticButton>
          <MagneticButton
            className="hero-cta__btn hero-cta__btn--ghost"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconWhatsapp />
            <span>Tirar dúvidas no WhatsApp</span>
          </MagneticButton>
        </motion.div>

        <motion.ul className="hero-cta__promises" variants={fadeUp} custom={1.15} {...motionProps}>
          <li>Agendamento online em minutos</li>
          <li>Remarque ou cancele pelo link do e-mail</li>
          <li>Atendimento presencial ou online</li>
        </motion.ul>
      </div>
    </div>
  )
}

export default HeroCta
