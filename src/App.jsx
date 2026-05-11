import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import FloatingNavbar from './components/FloatingNavbar'
import heroImage from '../images/luciana-jaleco.jpeg'
import gynImage from '../images/exam.jpg'
import obstImage from '../images/hug.jpg'
import homeoImage from '../images/m.jpg'
import testimonialRandomOne from '../images/mulherRandom.jpg'
import testimonialRandomTwo from '../images/mulherRandom2.jpg'
import testimonialRandomThree from '../images/homemrandom.jpg'

const IconGraduation = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 8l9-4 9 4-9 4-9-4z" />
    <path d="M7 11v4c0 1.7 3 3 5 3s5-1.3 5-3v-4" />
    <path d="M21 10v5" />
  </svg>
)

const IconMedical = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="8" />
    <path d="M12 9v6" />
    <path d="M9 12h6" />
  </svg>
)

const IconClock = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </svg>
)

const IconLink = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10 13a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-1 1" />
    <path d="M14 11a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7l1-1" />
  </svg>
)

const aboutIcons = {
  graduation: IconGraduation,
  medical: IconMedical,
  clock: IconClock,
  link: IconLink,
}

const aboutCards = [
  {
    title: 'Formacao em Medicina',
    text: 'Base clinica solida e atualizada para um cuidado seguro.',
    icon: 'graduation',
  },
  {
    title: 'Especializacao em Ginecologia e Obstetricia',
    text: 'Atendimento preciso para cada fase da vida feminina.',
    icon: 'medical',
  },
  {
    title: '12+ anos de experiencia clinica',
    text: 'Historias de cuidado profundo e acompanhamento continuo.',
    icon: 'clock',
  },
  {
    title: 'Abordagem integrativa',
    text: 'Ciencia, mente e espiritualidade com equilibrio e evidencias.',
    icon: 'link',
  },
]

const approachSteps = [
  {
    title: 'Escuta profunda e individualizada',
    text: 'Tempo, presenca e dialogo para compreender a mulher inteira.',
  },
  {
    title: 'Avaliacao clinica completa',
    text: 'Exames, historico e sinais sutis alinhados ao contexto pessoal.',
  },
  {
    title: 'Integracao entre ciencia e terapias complementares',
    text: 'Recursos baseados em evidencia com sensibilidade e coerencia.',
  },
  {
    title: 'Plano de cuidado personalizado',
    text: 'Caminho claro, pratico e acolhedor para cada objetivo.',
  },
]

const specialties = [
  {
    title: 'Ginecologia',
    text: 'Ginecologia natural, integrativa, preventiva, baseada no olhar integral da mulher. A historia, sinais, sintomas, exame fisico e, quando necessario, exames complementares sao cuidadosamente avaliados.',
    image: gynImage,
    imageAlt: 'Foto de ginecologia',
  },
  {
    title: 'Obstetricia',
    text: 'Com o minimo de intervencoes possivel, atendo gestantes e suas familias, individualizando condutas e trabalhando em corresponsabilidade. A busca pelo nascimento natural, respeitoso e humanizado norteia a minha assistencia.',
    image: obstImage,
    imageAlt: 'Foto de obstetricia',
  },
  {
    title: 'Homeopatia',
    text: 'A homeopatia e uma especialidade medica que busca restabelecer o equilibrio da saude fisica, emocional, mental e energetica do ser. Adota uma abordagem holistica, considerando o paciente, sua historia e relacoes como um todo.',
    image: homeoImage,
    imageAlt: 'Foto de homeopatia',
  },
]

const differentials = [
  'Atendimento sem pressa, com tempo real para voce.',
  'Visao integral da mulher, corpo, mente e emocao.',
  'Integracao entre evidencia clinica e cuidado sensivel.',
  'Plano pratico com acompanhamento proximo e humano.',
]

const testimonials = [
  {
    name: 'Luciana M.',
    text: 'Encontrei um cuidado profundo, sem julgamentos e com respeito real.',
    tone: '#eaddea',
    image: testimonialRandomOne,
    imageAlt: 'Foto de Luciana',
  },
  {
    name: 'Renata C.',
    text: 'A consulta foi serena e precisa, senti que tudo foi explicado com calma.',
    tone: '#e4d7e3',
    image: testimonialRandomTwo,
    imageAlt: 'Foto de Renata',
  },
  {
    name: 'Pedro F.',
    text: 'Um encontro entre ciencia e sensibilidade que transformou meu olhar.',
    tone: '#e9d4e6',
    image: testimonialRandomThree,
    imageAlt: 'Foto de Patricia',
  },
]

const blogPosts = [
  {
    title: 'Equilibrio hormonal no dia a dia',
    text: 'Ajustes simples de sono, alimentacao e rotina para reduzir oscilacoes.',
    date: 'Abril 2026',
    tag: 'Saude hormonal',
  },
  {
    title: 'Menopausa com clareza e suporte',
    text: 'Sinais, cuidados integrativos e escolhas conscientes para cada fase.',
    date: 'Marco 2026',
    tag: 'Menopausa',
  },
  {
    title: 'Autocuidado emocional feminino',
    text: 'Praticas para regular estresse, ansiedade e fortalecer a vitalidade.',
    date: 'Fevereiro 2026',
    tag: 'Bem-estar',
  },
]

const educationTopics = [
  {
    title: 'Ciclo menstrual',
    text: 'Como ler sinais do corpo e apoiar o equilibrio hormonal.',
  },
  {
    title: 'Menopausa',
    text: 'Transicao com calma, estrategias clinicas e acolhimento.',
  },
  {
    title: 'Saude emocional',
    text: 'Relacao entre estresse, libido e vitalidade feminina.',
  },
  {
    title: 'Autocuidado',
    text: 'Rituais simples para fortalecer corpo, mente e energia.',
  },
]

function App() {
  const [activeSpecialtyIndex, setActiveSpecialtyIndex] = useState(0)
  const specialtiesScrollRef = useRef(null)
  const prefersReducedMotion = useReducedMotion()
  const heroTiltX = useMotionValue(0)
  const heroTiltY = useMotionValue(0)
  const { scrollYProgress: pageScrollProgress } = useScroll()
  const heroTiltXSpring = useSpring(heroTiltX, {
    stiffness: 90,
    damping: 22,
    mass: 0.6,
  })
  const heroTiltYSpring = useSpring(heroTiltY, {
    stiffness: 90,
    damping: 22,
    mass: 0.6,
  })
  const { scrollYProgress } = useScroll({
    target: specialtiesScrollRef,
    offset: ['start start', 'end end'],
  })
  const pageProgressSpring = useSpring(pageScrollProgress, {
    stiffness: 140,
    damping: 24,
    mass: 0.25,
  })
  const entryHold = 0.12
  const exitHold = 0.08
  const storyProgress = useTransform(
    scrollYProgress,
    [0, entryHold, 1 - exitHold, 1],
    [0, 0, 1, 1],
  )

  useEffect(() => {
    const prefersReducedMotionSetting = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const revealElements = Array.from(document.querySelectorAll('[data-reveal]'))

    if (prefersReducedMotionSetting) {
      revealElements.forEach((element) => element.classList.add('is-visible'))
    }

    const observer = prefersReducedMotionSetting
      ? null
      : new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add('is-visible')
                observer.unobserve(entry.target)
              }
            })
          },
          { threshold: 0.2 },
        )

    if (observer) {
      revealElements.forEach((element) => observer.observe(element))
    }

    const parallaxElements = Array.from(
      document.querySelectorAll('[data-parallax]'),
    )
    const approachSection = document.querySelector('[data-approach]')

    const handleScroll = () => {
      const scrollY = window.scrollY
      parallaxElements.forEach((element) => {
        const speed = Number(element.dataset.parallax || 0.08)
        element.style.transform = `translateY(${scrollY * speed}px)`
      })

      if (approachSection) {
        const rect = approachSection.getBoundingClientRect()
        const viewHeight = window.innerHeight
        const total = rect.height + viewHeight
        const progress = Math.min(
          1,
          Math.max(0, (viewHeight - rect.top) / total),
        )
        approachSection.style.setProperty(
          '--approach-progress',
          progress.toFixed(3),
        )
      }
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    return () => {
      if (observer) {
        observer.disconnect()
      }
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  useMotionValueEvent(storyProgress, 'change', (value) => {
    const steps = specialties.length
    const nextIndex = Math.min(steps - 1, Math.max(0, Math.floor(value * steps)))
    setActiveSpecialtyIndex(nextIndex)
  })

  const handleHeroPointerMove = (event) => {
    if (prefersReducedMotion) {
      return
    }
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const xProgress = x / rect.width
    const yProgress = y / rect.height
    const maxTilt = 20
    heroTiltX.set((yProgress - 0.5) * -maxTilt)
    heroTiltY.set((xProgress - 0.5) * maxTilt)
  }

  const resetHeroTilt = () => {
    heroTiltX.set(0)
    heroTiltY.set(0)
  }

  const year = new Date().getFullYear()

  return (
    <div className="page">
      <motion.div
        className="scroll-progress"
        style={{ scaleX: pageProgressSpring }}
        aria-hidden="true"
      />
      <FloatingNavbar />

      <main>
        <section className="hero" id="inicio">
          <div className="hero-backdrop" data-parallax="0.08" aria-hidden="true" />
          <div className="container hero-grid">
            <div className="hero-content" data-reveal style={{ '--delay': '120ms' }}>
              <p className="eyebrow">Integracao clinica e espiritualidade consciente</p>
              <h1>Um novo olhar para a saude feminina - mais humano, mais completo.</h1>
              <p className="lead">
                Medicina integrativa para mulheres que buscam um cuidado profundo,
                personalizado e consciente.
              </p>
              <div className="hero-actions">
                <a className="btn btn-primary" href="#contato">
                  Agendar consulta
                </a>
              </div>
              <div className="hero-meta">
                <div className="meta-card">CRM 000000 | RQE 00000</div>
                <div className="meta-card">Atendimento presencial e online</div>
              </div>
            </div>
            <div className="hero-media" data-reveal style={{ '--delay': '220ms' }}>
              <div
                className="hero-tilt"
                onPointerMove={handleHeroPointerMove}
                onPointerLeave={resetHeroTilt}
                onPointerCancel={resetHeroTilt}
              >
                <motion.div
                  className="hero-tilt__inner"
                  style={{ rotateX: heroTiltXSpring, rotateY: heroTiltYSpring }}
                >
                  <div className="hero-media__frame">
                    <div
                      className="hero-media__image"
                      style={{ backgroundImage: `url(${heroImage})` }}
                      role="img"
                      aria-label="Luz natural em consultorio acolhedor"
                    />
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        <section className="section alt" id="sobre">
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Sobre a medica</p>
              <h2>Autoridade clinica com presenca humana e sofisticada.</h2>
              <p>
                Uma medicina que une ciencia, intuicao e cuidado integrativo,
                respeitando a historia de cada mulher com profundidade.
              </p>
            </div>
            <div className="card-grid">
              {aboutCards.map((card, index) => {
                const Icon = aboutIcons[card.icon]
                return (
                  <article
                    key={card.title}
                    className="stat-card"
                    data-reveal
                    style={{ '--delay': `${index * 80}ms` }}
                  >
                    {Icon ? (
                      <div className="stat-card__icon" aria-hidden="true">
                        <Icon />
                      </div>
                    ) : null}
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="section" id="abordagem" data-approach>
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Abordagem</p>
              <h2>Um caminho claro, sensivel e cientifico.</h2>
              <p>
                O atendimento e conduzido com profundidade clinica e
                espiritualidade equilibrada, sem perder o rigor tecnico.
              </p>
            </div>
            <div className="approach-body">
              <div className="approach-line" aria-hidden="true" />
              <div className="approach-steps">
                {approachSteps.map((step, index) => (
                  <article
                    key={step.title}
                    className="approach-step"
                    data-reveal
                    style={{ '--delay': `${index * 120}ms` }}
                  >
                    <div className="step-number">0{index + 1}</div>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section alt specialties-section" id="especialidades">
          <div
            className="specialties-scroll"
            style={{ '--specialty-steps': specialties.length }}
            ref={specialtiesScrollRef}
          >
            <div className="specialties-sticky">
              <div className="container specialties-stage">
                {specialties.map((item, index) => {
                  const steps = specialties.length
                  const stepSize = 1 / steps
                  const start = index * stepSize
                  const end = start + stepSize
                  const fadeWindow = stepSize * 0.34
                  const holdStart = start + fadeWindow
                  const holdEnd = end - fadeWindow
                  const startOpacity = index === 0 ? 1 : 0
                  const endOpacity = index === steps - 1 ? 1 : 0
                  const opacity = useTransform(
                    storyProgress,
                    [start, holdStart, holdEnd, end],
                    [startOpacity, 1, 1, endOpacity],
                  )
                  const translateY = useTransform(
                    storyProgress,
                    [start, holdStart, holdEnd, end],
                    [prefersReducedMotion ? 0 : 24, 0, 0, prefersReducedMotion ? 0 : -24],
                  )
                  const mediaScale = useTransform(
                    storyProgress,
                    [start, holdStart, holdEnd, end],
                    [0.98, 1, 1, 0.98],
                  )
                  const isActive = index === activeSpecialtyIndex

                  return (
                    <motion.div
                      key={item.title}
                      className={`specialty-layer${isActive ? ' is-active' : ''}`}
                      aria-hidden={!isActive}
                      style={{ opacity, zIndex: isActive ? 2 : 1 }}
                    >
                      <motion.div className="specialty-layer__content" style={{ y: translateY }}>
                        <p className="eyebrow">0{index + 1}</p>
                        <h3>{item.title}</h3>
                        <p>{item.text}</p>
                        <a className="card-link" href="#agendamento">
                          Agendar Consulta &rarr;
                        </a>
                      </motion.div>
                      <motion.div className="specialty-layer__media" style={{ scale: mediaScale }}>
                        <img
                          src={item.image}
                          alt={item.imageAlt}
                          loading="lazy"
                        />
                      </motion.div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="depoimentos">
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Depoimentos</p>
              <h2>Relatos reais de mulheres que se sentiram vistas.</h2>
              <p>Cuidado profundo que transforma a relacao com o corpo.</p>
            </div>
          </div>
          <div className="carousel" aria-label="Depoimentos das pacientes">
            <div className="carousel-track">
              {[...testimonials, ...testimonials].map((item, index) => (
                <article key={`${item.name}-${index}`} className="testimonial-card">
                  <div
                    className="avatar"
                    role="img"
                    aria-label={item.imageAlt || `Foto de ${item.name}`}
                    style={{
                      '--avatar-tone': item.tone,
                      '--avatar-image': item.image ? `url(${item.image})` : undefined,
                    }}
                  >
                    {!item.image
                      ? item.name
                          .split(' ')
                          .map((word) => word[0])
                          .join('')
                      : null}
                  </div>
                  <div>
                    <p className="testimonial-text">"{item.text}"</p>
                    <p className="testimonial-name">{item.name}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section alt" id="blog">
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Blog</p>
              <h2>Posts recentes para apoiar sua jornada.</h2>
              <p>
                Espaco reservado para novos artigos, reflexoes e orientacoes
                clinicas.
              </p>
            </div>
            <div className="card-grid blog-grid">
              {blogPosts.map((post, index) => (
                <article
                  key={post.title}
                  className="blog-card"
                  data-reveal
                  style={{ '--delay': `${index * 90}ms` }}
                >
                  <div className="blog-meta">
                    <span className="blog-tag">{post.tag}</span>
                    <span className="blog-date">{post.date}</span>
                  </div>
                  <h3>{post.title}</h3>
                  <p>{post.text}</p>
                  <span className="card-link">Ler post</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="endereco">
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Endereco</p>
              <h2>Um consultorio pensado para acolher com calma.</h2>
              <p>
                Centro Médico Lucio Costa, com facil acesso e apoio no local.
              </p>
            </div>
            <div className="address-grid">
              <div className="address-card" data-reveal>
                <h3>Centro Médico Lucio Costa</h3>
                <p className="address-line">SGAS 610, Bloco 2, Sala 250</p>
                <p className="address-line">Brasilia - DF</p>
                <div className="address-divider" aria-hidden="true" />
                <ul className="address-list">
                  <li>Entrada pela L3</li>
                  <li>Estacionamento rotativo no local</li>
                </ul>
              </div>
              <div className="map-card" data-reveal style={{ '--delay': '120ms' }}>
                <div className="map-frame">
                  <iframe
                    className="map-embed"
                    title="Mapa do Centro Medico Lucio Costa"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src="https://www.google.com/maps?q=Centro%20Medico%20Lucio%20Costa%20Brasilia%20DF&output=embed"
                  />
                </div>
                <p className="map-note">
                  SGAS 610, Bloco 2, sala 250 - Entrada pela L3.
                </p>
                <a
                  className="btn btn-outline"
                  href="https://www.google.com/maps/dir/?api=1&destination=Centro%20Medico%20Lucio%20Costa%20Brasilia%20DF"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir rotas no Google Maps
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="section appointment-section" id="contato">
          <div className="container">
            <div className="appointment-card" data-reveal>
              <aside className="appointment-aside">
                <p className="appointment-label">Agendamento</p>
                <h2>Vamos conversar?</h2>
                <p className="appointment-copy">
                  Preencha o formulario e nossa equipe entrara em contato para
                  confirmar o melhor horario.
                </p>
                <div className="appointment-divider" aria-hidden="true" />
                <div className="appointment-contacts">
                  <div className="appointment-contact">
                    <span className="appointment-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" role="img" focusable="false">
                        <path
                          d="M12 3.5a8.5 8.5 0 0 1 7.3 12.9L20 20l-3.8-1.3A8.5 8.5 0 1 1 12 3.5z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="11" r="3" fill="currentColor" />
                      </svg>
                    </span>
                    <div>
                      <strong>Consultorio Rio de Janeiro</strong>
                      <span>Atendimento presencial e online</span>
                    </div>
                  </div>
                  <div className="appointment-contact">
                    <span className="appointment-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" role="img" focusable="false">
                        <path
                          d="M6.4 5.6c.3-.4.8-.6 1.3-.4l3 1.2c.4.2.7.6.7 1.1v2c0 .4-.2.8-.6 1l-1.5.9c.8 1.6 2.1 2.9 3.7 3.7l.9-1.5c.2-.4.6-.6 1-.6h2c.5 0 .9.3 1.1.7l1.2 3c.2.5 0 1-.4 1.3-.9.7-2 1.1-3.2 1-2.8-.3-5.4-1.8-7.6-4-2.2-2.2-3.7-4.8-4-7.6-.1-1.2.3-2.3 1-3.2z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <div>
                      <strong>+55 21 99999-0000</strong>
                      <span>Atendimento das 8h as 18h</span>
                    </div>
                  </div>
                  <div className="appointment-contact">
                    <span className="appointment-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" role="img" focusable="false">
                        <rect
                          x="3"
                          y="5"
                          width="18"
                          height="14"
                          rx="2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                        <path
                          d="M4 7l8 6 8-6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div>
                      <strong>contato@mulherviva.org</strong>
                      <span>Respondemos em ate 24h</span>
                    </div>
                  </div>
                </div>
              </aside>
              <form className="appointment-form">
                <div className="appointment-grid">
                  <label className="field" htmlFor="nome">
                    <span>Nome</span>
                    <input id="nome" name="nome" type="text" placeholder="Seu nome" />
                  </label>
                  <label className="field" htmlFor="telefone">
                    <span>Telefone</span>
                    <input
                      id="telefone"
                      name="telefone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                    />
                  </label>
                  <label className="field span-2" htmlFor="email">
                    <span>E-mail</span>
                    <input id="email" name="email" type="email" placeholder="Seu e-mail" />
                  </label>
                  <label className="field" htmlFor="data">
                    <span>Data preferida</span>
                    <input id="data" name="data" type="text" placeholder="dd/mm/aaaa" />
                  </label>
                  <label className="field" htmlFor="especialidade">
                    <span>Especialidade</span>
                    <select id="especialidade" name="especialidade">
                      <option>Ginecologia Integrativa</option>
                      <option>Obstetricia Humanizada</option>
                      <option>Homeopatia</option>
                      <option>Consulta Integrativa</option>
                    </select>
                  </label>
                  <label className="field span-2" htmlFor="mensagem">
                    <span>Mensagem (opcional)</span>
                    <textarea
                      id="mensagem"
                      name="mensagem"
                      placeholder="Conte um pouco sobre o que voce precisa"
                    />
                  </label>
                </div>
                <div className="appointment-actions">
                  <button className="appointment-submit" type="submit">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect
                        x="3"
                        y="5"
                        width="18"
                        height="16"
                        rx="2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <path
                        d="M8 3v4M16 3v4M3 10h18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Solicitar agendamento
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p>Mulher Viva - Medicina Integrativa da Saude Feminina</p>
          <p>Copyright {year}. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
