import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import FloatingNavbar from './components/FloatingNavbar'
import AgendaPanel from './components/AgendaPanel'
import AdminLogin from './components/AdminLogin'
import BookingSection from './components/BookingSection'
import { api, clearToken, getToken } from './lib/api'
import heroImage from '../images/hero-nobg.png'
import aboutImage from '../images/about.png'
import gynImage from '../images/exam.jpg'
import obstImage from '../images/hug.jpg'
import homeoImage from '../images/m.jpg'
import testimonialRandomOne from '../images/mulherRandom.jpg'
import testimonialRandomTwo from '../images/mulherRandom2.jpg'
import testimonialRandomThree from '../images/homemrandom.jpg'
import iphoneMapImage from '../images/iphone17map.png'

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

const aboutTags = [
  'Medicina integrativa',
  'Obstetrícia humanizada',
  'Homeopatia',
]

const approachSteps = [
  {
    title: 'Escuta profunda e individualizada',
    text: 'Tempo de consulta de verdade: presença e diálogo para compreender a mulher inteira, não apenas o sintoma.',
  },
  {
    title: 'Avaliação clínica completa',
    text: 'Exames, histórico e sinais sutis interpretados dentro do seu contexto de vida.',
  },
  {
    title: 'Integração entre ciência e terapias complementares',
    text: 'Recursos baseados em evidência, aplicados com sensibilidade e coerência.',
  },
  {
    title: 'Plano de cuidado personalizado',
    text: 'Um caminho claro, prático e acolhedor, construído junto com você.',
  },
]

const specialties = [
  {
    title: 'Ginecologia',
    text: 'Ginecologia natural, integrativa e preventiva, baseada no olhar integral da mulher. A história, os sinais, os sintomas, o exame físico e, quando necessário, exames complementares são cuidadosamente avaliados.',
    image: gynImage,
    imageAlt: 'Médica realizando atendimento ginecológico acolhedor',
  },
  {
    title: 'Obstetrícia',
    text: 'Com o mínimo de intervenções possível, atendo gestantes e suas famílias, individualizando condutas e trabalhando em corresponsabilidade. A busca pelo nascimento natural, respeitoso e humanizado norteia a minha assistência.',
    image: obstImage,
    imageAlt: 'Gestante sendo acolhida em consulta de obstetrícia',
  },
  {
    title: 'Homeopatia',
    text: 'A homeopatia é uma especialidade médica que busca restabelecer o equilíbrio da saúde física, emocional, mental e energética do ser. Adota uma abordagem holística, considerando a paciente, sua história e relações como um todo.',
    image: homeoImage,
    imageAlt: 'Atendimento de homeopatia em ambiente sereno',
  },
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
    text: 'A consulta foi serena e precisa. Senti que tudo foi explicado com calma.',
    tone: '#e4d7e3',
    image: testimonialRandomTwo,
    imageAlt: 'Foto de Renata',
  },
  {
    name: 'Pedro F.',
    text: 'Um encontro entre ciência e sensibilidade que transformou meu olhar.',
    tone: '#e9d4e6',
    image: testimonialRandomThree,
    imageAlt: 'Foto de Pedro',
  },
]

const fallbackBlogPosts = [
  {
    title: 'Equilíbrio hormonal no dia a dia',
    text: 'Ajustes simples de sono, alimentação e rotina para reduzir oscilações.',
    date: 'Abril 2026',
    tag: 'Saúde hormonal',
  },
  {
    title: 'Menopausa com clareza e suporte',
    text: 'Sinais, cuidados integrativos e escolhas conscientes para cada fase.',
    date: 'Março 2026',
    tag: 'Menopausa',
  },
  {
    title: 'Autocuidado emocional feminino',
    text: 'Práticas para regular estresse, ansiedade e fortalecer a vitalidade.',
    date: 'Fevereiro 2026',
    tag: 'Bem-estar',
  },
]

const heroBlobDefs = [
  { color: '#dfa9bf', blur: 80, w: 520, h: 420, baseX: 0.08, baseY: 0.08, phase: 0.0 },
  { color: '#c98ba6', blur: 90, w: 480, h: 380, baseX: 0.72, baseY: 0.45, phase: 1.3 },
  { color: '#e7bccd', blur: 75, w: 560, h: 440, baseX: 0.85, baseY: 0.85, phase: 2.5 },
  { color: '#d295ac', blur: 85, w: 340, h: 300, baseX: 0.78, baseY: 0.10, phase: 3.8 },
  { color: '#f0d0da', blur: 70, w: 460, h: 360, baseX: 0.15, baseY: 0.80, phase: 1.0 },
  { color: '#bb7e96', blur: 100, w: 400, h: 320, baseX: 0.45, baseY: 0.30, phase: 2.1 },
  { color: '#d9a4b7', blur: 80, w: 300, h: 260, baseX: 0.02, baseY: 0.45, phase: 0.7 },
]

function formatPostDate(isoDate) {
  const formatted = new Date(isoDate).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function SpecialtyLayer({ item, index, steps, storyProgress, prefersReducedMotion, isActive }) {
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

  return (
    <motion.div
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
}

function App() {
  const [showAgenda, setShowAgenda] = useState(false)
  const [isAdminAuthed, setIsAdminAuthed] = useState(() => Boolean(getToken()))
  const [blogPosts, setBlogPosts] = useState(fallbackBlogPosts)
  const [activeSpecialtyIndex, setActiveSpecialtyIndex] = useState(0)
  const specialtiesScrollRef = useRef(null)
  const addressContentRef = useRef(null)
  const addressTitleRef = useRef(null)
  const heroBlobLayerRef = useRef(null)
  const aboutSectionRef = useRef(null)
  const prefersReducedMotion = useReducedMotion()
  const [years, setYears] = useState(0)
  const [startYearsCount, setStartYearsCount] = useState(false)
  const isAboutInView = useInView(aboutSectionRef, { once: true, amount: 0.3 })
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
    api
      .get('/api/blog?limit=6')
      .then((data) => {
        if (!data.items.length) return
        setBlogPosts(
          data.items.map((post) => ({
            id: post.id,
            title: post.title,
            text: post.excerpt,
            date: formatPostDate(post.published_at),
            tag: post.tag || 'Blog',
            permalink: post.permalink,
          })),
        )
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (prefersReducedMotion || !startYearsCount) return undefined

    let rafId = null
    let start = null
    const duration = 1400

    const tick = (ts) => {
      if (!start) start = ts
      const progress = Math.min(1, (ts - start) / duration)
      setYears(Math.floor(progress * 20))
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick)
      } else {
        setYears(20)
      }
    }
    rafId = window.requestAnimationFrame(tick)

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [startYearsCount, prefersReducedMotion])

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

  useEffect(() => {
    if (prefersReducedMotion) {
      return undefined
    }

    const layer = heroBlobLayerRef.current
    if (!layer) {
      return undefined
    }

    const blobs = heroBlobDefs.map((def) => {
      const el = document.createElement('div')
      el.className = 'hero-blob'
      el.style.width = `${def.w}px`
      el.style.height = `${def.h}px`
      el.style.background = def.color
      el.style.filter = `blur(${def.blur}px)`
      el.style.opacity = '0.75'
      layer.appendChild(el)
      return { el, ...def, curX: def.baseX, curY: def.baseY }
    })

    const speed = 4 / 5
    let t = 0
    let frameId = 0

    const tick = () => {
      t += 0.012
      const width = layer.offsetWidth
      const height = layer.offsetHeight

      blobs.forEach((blob) => {
        const targetX =
          blob.baseX + Math.sin(t * speed * 0.8 + blob.phase) * 0.18
        const targetY =
          blob.baseY + Math.cos(t * speed * 0.6 + blob.phase * 1.4) * 0.14

        blob.curX += (targetX - blob.curX) * 0.03
        blob.curY += (targetY - blob.curY) * 0.03

        const px = blob.curX * width - blob.w / 2
        const py = blob.curY * height - blob.h / 2
        blob.el.style.transform = `translate(${px}px, ${py}px)`
      })

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
      blobs.forEach((blob) => blob.el.remove())
    }
  }, [prefersReducedMotion])

  useEffect(() => {
    const updateAddressTitleWidth = () => {
      if (!addressContentRef.current || !addressTitleRef.current) {
        return
      }
      const { width } = addressTitleRef.current.getBoundingClientRect()
      addressContentRef.current.style.setProperty(
        '--address-title-width',
        `${Math.round(width)}px`,
      )
    }

    updateAddressTitleWidth()
    window.addEventListener('resize', updateAddressTitleWidth)

    return () => window.removeEventListener('resize', updateAddressTitleWidth)
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

  const handleAppointmentSubmit = (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const subject = `Solicitação de agendamento - ${data.get('nome') || 'Paciente'}`
    const body = [
      `Nome: ${data.get('nome') || ''}`,
      `Telefone: ${data.get('telefone') || ''}`,
      `E-mail: ${data.get('email') || ''}`,
      `Data preferida: ${data.get('data') || ''}`,
      `Especialidade: ${data.get('especialidade') || ''}`,
      '',
      data.get('mensagem') || '',
    ].join('\n')
    window.location.href = `mailto:contato@mulherviva.org?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="page">
      <motion.div
        className="scroll-progress"
        style={{ scaleX: pageProgressSpring }}
        aria-hidden="true"
      />
      <FloatingNavbar onOpenAgenda={() => setShowAgenda(true)} />

      {showAgenda && !isAdminAuthed && (
        <AdminLogin
          onSuccess={() => setIsAdminAuthed(true)}
          onClose={() => setShowAgenda(false)}
        />
      )}
      {showAgenda && isAdminAuthed && (
        <AgendaPanel
          onClose={() => setShowAgenda(false)}
          onAuthExpired={() => {
            clearToken()
            setIsAdminAuthed(false)
          }}
        />
      )}

      <main>
        <section className="hero hero-bg" id="inicio">
          <div className="hero-blob-layer" ref={heroBlobLayerRef} aria-hidden="true" />
          <div className="container hero-grid">
            <div className="hero-content" data-reveal style={{ '--delay': '120ms' }}>
              <p className="eyebrow">Ginecologia · Obstetrícia · Homeopatia</p>
              <h1>
                Um novo olhar para a saúde feminina — <em>mais humano, mais completo</em>.
              </h1>
              <p className="lead">
                Medicina integrativa para mulheres que buscam um cuidado
                profundo, personalizado e consciente, em todas as fases da vida.
              </p>
              <div className="hero-actions">
                <a className="btn btn-primary" href="#agendamento">
                  Agendar consulta
                </a>
                <a className="btn btn-outline" href="#sobre">
                  Conhecer a doutora
                </a>
              </div>
              <ul className="hero-trust">
                {[
                  '20+ anos de experiência',
                  'Atendimento humanizado',
                  'Presencial e online',
                ].map((item) => (
                  <li key={item}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4.5 12.5 10 18 19.5 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
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

        <section className="section alt specialties-section" id="especialidades">
          <div
            className="specialties-scroll"
            style={{ '--specialty-steps': specialties.length }}
            ref={specialtiesScrollRef}
          >
            <div className="specialties-sticky">
              <div className="container specialties-stage">
                {specialties.map((item, index) => (
                  <SpecialtyLayer
                    key={item.title}
                    item={item}
                    index={index}
                    steps={specialties.length}
                    storyProgress={storyProgress}
                    prefersReducedMotion={prefersReducedMotion}
                    isActive={index === activeSpecialtyIndex}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="sobre" ref={aboutSectionRef} style={{ overflow: 'hidden' }}>
          <div className="container">
            <div className="about-card" data-reveal>
              <motion.div
                className="about-media"
                initial={prefersReducedMotion ? false : { x: '-100vw' }}
                animate={prefersReducedMotion ? {} : { x: isAboutInView ? 0 : '-100vw' }}
                transition={{ type: 'spring', stiffness: 65, damping: 22, mass: 1 }}
                onAnimationComplete={() => {
                  if (isAboutInView && !prefersReducedMotion) setStartYearsCount(true)
                }}
              >
                <div
                  className="about-photo"
                  role="img"
                  aria-label="Retrato da Dra. Luciana da Silva Lopes"
                  style={{ backgroundImage: `url(${aboutImage})` }}
                />
                <div className="about-badge">
                  <span className="about-badge__icon" aria-hidden="true">
                    <IconGraduation />
                  </span>
                  <div>
                      <strong>{prefersReducedMotion ? 20 : years}+ anos</strong>
                      <span>Experiência médica</span>
                    </div>
                </div>
              </motion.div>
              <div className="about-content">
                <p className="about-label">Sobre mim</p>
                <h2>Presença clínica com rigor e sensibilidade.</h2>
                <p>
                  Atendo mulheres em todas as fases da vida, com escuta profunda
                  e condutas individualizadas que respeitam história e contexto.
                </p>
                <p>
                  A integração entre ciência, terapias complementares e
                  espiritualidade consciente cria um cuidado sofisticado e
                  humano.
                </p>
                <div className="about-tags">
                  {aboutTags.map((tag) => (
                    <span key={tag} className="about-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--soft" id="abordagem" data-approach>
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Abordagem</p>
              <h2>Como é cuidar e ser cuidada por aqui.</h2>
              <p>
                O atendimento é conduzido com profundidade clínica e
                acolhimento, sem abrir mão do rigor técnico.
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

        

        <section className="section" id="depoimentos">
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Depoimentos</p>
              <h2>Histórias de mulheres que se sentiram ouvidas.</h2>
              <p>Cuidado profundo transforma a relação com o próprio corpo.</p>
            </div>
          </div>
          <div className="carousel" aria-label="Depoimentos das pacientes">
            <div className="carousel-track">
              {/* Two identical halves (each repeats the list enough to span the
                  viewport) so the -50% marquee loops seamlessly and forever. */}
              {[...testimonials, ...testimonials, ...testimonials, ...testimonials].map((item, index) => (
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

        <section className="section" id="blog">
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Blog</p>
              <h2>Conteúdo para apoiar a sua jornada.</h2>
              <p>
                Artigos, reflexões e orientações clínicas escritas com calma —
                para você ler no seu tempo.
              </p>
            </div>
            <div className="card-grid blog-grid">
              {blogPosts.map((post, index) => (
                <article
                  key={post.id ?? post.title}
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
                  {post.permalink ? (
                    <a
                      className="card-link"
                      href={post.permalink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ler post &rarr;
                    </a>
                  ) : (
                    <span className="card-link">Ler post</span>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="endereco">
          <div className="container">
            
            <div className="address-grid address-grid--device">
              <div className="address-content" data-reveal ref={addressContentRef}>
                <p className="address-eyebrow">Consultório</p>
                <h3 className="address-title" ref={addressTitleRef}>
                  Centro Médico Lúcio Costa
                </h3>
                <p className="address-lead">
                  Um espaço sereno, discreto e preparado para consultas sem pressa.
                </p>
                <div className="address-details address-details--spread">
                  <div className="address-item">
                    <span className="address-label">Endereço</span>
                    <span className="address-value">SGAS 610, Bloco 2, Sala 250</span>
                    <span className="address-subvalue">Brasília - DF</span>
                  </div>
                  <div className="address-item">
                    <span className="address-label">Atendimento</span>
                    <span className="address-value">Presencial e online</span>
                  </div>
                </div>
                <div className="address-tags">
                  <span className="address-tag">Entrada pela L3</span>
                  <span className="address-tag">Recepção acolhedora</span>
                </div>
                <div className="address-actions">
                  <a className="btn btn-primary" href="#agendamento">
                    Agendar consulta
                  </a>
                  <a
                    className="btn btn-outline"
                    href="https://www.google.com/maps/search/?api=1&query=Centro%20Medico%20Lucio%20Costa%2C%20SGAS%20610%2C%20Bloco%202%2C%20Sala%20250%2C%20Brasilia%20-%20DF"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver no Maps
                  </a>
                </div>
              </div>
              <div
                className="device-showcase__device"
                data-reveal
                style={{ '--delay': '120ms' }}
              >

                <div
                  className="device-showcase__frame"
                  role="img"
                  aria-label="Mapa com a localização do consultório em um iPhone"
                >
                  <img
                    className="device-showcase__image"
                    src={iphoneMapImage}
                    alt="Mapa com a localização do consultório no iPhone"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <BookingSection />

        <section className="section appointment-section" id="contato">
          <div className="container">
            <div className="appointment-card" data-reveal>
              <aside className="appointment-aside">
                <p className="appointment-label">Contato</p>
                <h2>Vamos conversar?</h2>
                <p className="appointment-copy">
                  Preencha o formulário e a equipe entrará em contato para
                  confirmar o melhor horário para você.
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
                      <strong>Consultório · Brasília - DF</strong>
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
                      <strong>+55 61 99999-0000</strong>
                      <span>Atendimento das 8h às 18h</span>
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
                      <span>Respondemos em até 24h</span>
                    </div>
                  </div>
                </div>
              </aside>
              <form className="appointment-form" onSubmit={handleAppointmentSubmit}>
                <div className="appointment-grid">
                  <label className="field" htmlFor="nome">
                    <span>Nome</span>
                    <input
                      id="nome"
                      name="nome"
                      type="text"
                      placeholder="Seu nome"
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label className="field" htmlFor="telefone">
                    <span>Telefone</span>
                    <input
                      id="telefone"
                      name="telefone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      autoComplete="tel"
                      required
                    />
                  </label>
                  <label className="field span-2" htmlFor="email">
                    <span>E-mail</span>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Seu e-mail"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="field" htmlFor="data">
                    <span>Data preferida</span>
                    <input id="data" name="data" type="date" />
                  </label>
                  <label className="field" htmlFor="especialidade">
                    <span>Especialidade</span>
                    <select id="especialidade" name="especialidade">
                      <option>Medicina Integrativa</option>
                      <option>Obstetrícia Humanizada</option>
                      <option>Homeopatia</option>
                    </select>
                  </label>
                  <label className="field span-2" htmlFor="mensagem">
                    <span>Mensagem (opcional)</span>
                    <textarea
                      id="mensagem"
                      name="mensagem"
                      placeholder="Conte um pouco sobre o que você precisa"
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
          <p>Mulher Viva · Medicina Integrativa da Saúde Feminina</p>
          <p>© {year} Dra. Luciana da Silva Lopes. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
