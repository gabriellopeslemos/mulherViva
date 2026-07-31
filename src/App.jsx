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
import ContactSection from './components/ContactSection'
import ManageBooking from './components/ManageBooking'
import BlogPostModal from './components/BlogPostModal'
import ErrorBoundary from './components/ErrorBoundary'
import { api, clearToken, getToken, setUnauthorizedHandler } from './lib/api'
import { clinic, fullAddress, mapsUrl } from './lib/siteConfig'
import {
  heroImage,
  aboutImage,
  gynImage,
  obstImage,
  homeoImage,
  testimonialRandomOne,
  testimonialRandomTwo,
  testimonialRandomThree,
  iphoneMapImage,
} from './lib/placeholderImages'

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
    text: 'Tempo, presença e diálogo para compreender a mulher inteira.',
  },
  {
    title: 'Avaliação clínica completa',
    text: 'Exames, histórico e sinais sutis alinhados ao contexto pessoal.',
  },
  {
    title: 'Integração entre ciência e terapias complementares',
    text: 'Recursos baseados em evidência com sensibilidade e coerência.',
  },
  {
    title: 'Plano de cuidado personalizado',
    text: 'Caminho claro, prático e acolhedor para cada objetivo.',
  },
]

const specialties = [
  {
    title: 'Ginecologia',
    text: 'Ginecologia natural, integrativa, preventiva, baseada no olhar integral da mulher. A história, sinais, sintomas, exame físico e, quando necessário, exames complementares são cuidadosamente avaliados.',
    image: gynImage,
    imageAlt: 'Foto de ginecologia',
  },
  {
    title: 'Obstetrícia',
    text: 'Com o mínimo de intervenções possível, atendo gestantes e suas famílias, individualizando condutas e trabalhando em corresponsabilidade. A busca pelo nascimento natural, respeitoso e humanizado norteia a minha assistência.',
    image: obstImage,
    imageAlt: 'Foto de obstetrícia',
  },
  {
    title: 'Homeopatia',
    text: 'A homeopatia é uma especialidade médica que busca restabelecer o equilíbrio da saúde física, emocional, mental e energética do ser. Adota uma abordagem holística, considerando o paciente, sua história e relações como um todo.',
    image: homeoImage,
    imageAlt: 'Foto de homeopatia',
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
    text: 'A consulta foi serena e precisa; senti que tudo foi explicado com calma.',
    tone: '#e4d7e3',
    image: testimonialRandomTwo,
    imageAlt: 'Foto de Renata',
  },
  {
    name: 'Patricia F.',
    text: 'Um encontro entre ciência e sensibilidade que transformou meu olhar.',
    tone: '#e9d4e6',
    image: testimonialRandomThree,
    imageAlt: 'Foto de Patricia',
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
  { color: '#cfa4bf', blur: 80, w: 520, h: 420, baseX: 0.08, baseY: 0.08, phase: 0.0 },
  { color: '#b887a7', blur: 90, w: 480, h: 380, baseX: 0.72, baseY: 0.45, phase: 1.3 },
  { color: '#d7b3c9', blur: 75, w: 560, h: 440, baseX: 0.85, baseY: 0.85, phase: 2.5 },
  { color: '#c193b2', blur: 85, w: 340, h: 300, baseX: 0.78, baseY: 0.10, phase: 3.8 },
  { color: '#e2c2d6', blur: 70, w: 460, h: 360, baseX: 0.15, baseY: 0.80, phase: 1.0 },
  { color: '#ad7f9d', blur: 100, w: 400, h: 320, baseX: 0.45, baseY: 0.30, phase: 2.1 },
  { color: '#c9a1bc', blur: 80, w: 300, h: 260, baseX: 0.02, baseY: 0.45, phase: 0.7 },
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
  const [manageToken, setManageToken] = useState(() =>
    new URLSearchParams(window.location.search).get('manage'),
  )
  const [isAdminAuthed, setIsAdminAuthed] = useState(() => Boolean(getToken()))
  const [blogPosts, setBlogPosts] = useState(fallbackBlogPosts)
  const [openPostId, setOpenPostId] = useState(null)
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

  // An expired or revoked admin session must drop the panel from anywhere,
  // not only from the components that happen to catch the 401 themselves.
  useEffect(() => {
    setUnauthorizedHandler(() => setIsAdminAuthed(false))
    return () => setUnauthorizedHandler(null)
  }, [])

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

  return (
    <div className="page">
      <motion.div
        className="scroll-progress"
        style={{ scaleX: pageProgressSpring }}
        aria-hidden="true"
      />
      <FloatingNavbar onOpenAgenda={() => setShowAgenda(true)} />

      {manageToken && (
        <ErrorBoundary>
          <ManageBooking
            token={manageToken}
            onClose={() => {
              setManageToken(null)
              window.history.replaceState(null, '', window.location.pathname)
            }}
          />
        </ErrorBoundary>
      )}

      {openPostId && (
        <ErrorBoundary>
          <BlogPostModal postId={openPostId} onClose={() => setOpenPostId(null)} />
        </ErrorBoundary>
      )}

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
              <p className="eyebrow">Integração clínica e espiritualidade consciente</p>
              <h1>Um novo olhar para a saúde feminina — mais humano, mais completo.</h1>
              <p className="lead">
                Medicina integrativa para mulheres que buscam um cuidado profundo,
                personalizado e consciente.
              </p>
              <div className="hero-actions">
                <a className="btn btn-primary" href="#agendamento">
                  Agendar consulta
                </a>
                <a className="btn btn-outline" href="#contato">
                  Falar com a equipe
                </a>
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
                      aria-label="Luz natural em consultório acolhedor"
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
                  aria-label="Retrato da médica"
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
                <p className="about-label">SOBRE MIM</p>
                <h2>Presença clínica com rigor e sensibilidade.</h2>
                <p>
                  Atendo mulheres em todas as fases da vida, com escuta profunda e
                  condutas individualizadas que respeitam história e contexto.
                </p>
                <p>
                  A integração entre ciência, terapias complementares e
                  espiritualidade consciente cria um cuidado sofisticado e humano.
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

        <section className="section alt" id="abordagem" data-approach>
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Abordagem</p>
              <h2>Um caminho claro, sensível e científico.</h2>
              <p>
                O atendimento é conduzido com profundidade clínica e
                espiritualidade equilibrada, sem perder o rigor técnico.
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
              <h2>Relatos reais de mulheres que se sentiram vistas.</h2>
              <p>Cuidado profundo que transforma a relação com o corpo.</p>
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
                Espaço reservado para novos artigos, reflexões e orientações
                clínicas.
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
                  {post.id ? (
                    <button
                      className="card-link card-link--button"
                      type="button"
                      onClick={() => setOpenPostId(post.id)}
                    >
                      Ler post &rarr;
                    </button>
                  ) : (
                    // Fallback copy shown before the API responds — there is no
                    // post to open yet, so it must not look clickable.
                    <span className="card-link is-placeholder">Em breve</span>
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
                  {clinic.building}
                </h3>
                <p className="address-lead">
                  Um espaço sereno, discreto e preparado para consultas profundas.
                </p>
                <div className="address-details address-details--spread">
                  <div className="address-item">
                    <span className="address-label">Endereço</span>
                    <span className="address-value">{clinic.street}</span>
                    <span className="address-subvalue">
                      {clinic.city} - {clinic.state}
                    </span>
                  </div>
                  <div className="address-item">
                    <span className="address-label">Atendimento</span>
                    <span className="address-value">Presencial e online</span>
                  </div>
                </div>
                <div className="address-tags">
                  <span className="address-tag">Entrada pela L3</span>
                  <span className="address-tag">Recepção</span>
                </div>
                <div className="address-actions">
                  <a className="btn btn-primary" href="#agendamento">
                    Agendar consulta
                  </a>
                  <a
                    className="btn btn-outline"
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
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
                  aria-label="Mapa do consultório em um iPhone"
                >
                  <img
                    className="device-showcase__image"
                    src={iphoneMapImage}
                    alt="Mapa do consultório no iPhone"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Both talk to the API; a failure in one must not blank the page. */}
        <ErrorBoundary>
          <BookingSection />
        </ErrorBoundary>

        <ErrorBoundary>
          <ContactSection />
        </ErrorBoundary>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <p className="footer-name">
              {clinic.name} — {clinic.tagline}
            </p>
            <p className="footer-doctor">{clinic.doctor}</p>
          </div>
          <div className="footer-contact">
            <p>{fullAddress}</p>
            <p>
              <a href={`tel:${clinic.phoneE164}`}>{clinic.phoneDisplay}</a>
              {' · '}
              <a href={`mailto:${clinic.email}`}>{clinic.email}</a>
            </p>
          </div>
          <p className="footer-legal">
            &copy; {year} {clinic.name}. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
