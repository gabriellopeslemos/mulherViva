import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import FloatingNavbar from './components/FloatingNavbar'
import AdminHub from './components/AdminHub'
import AgendaPanel from './components/AgendaPanel'
import AdminLogin from './components/AdminLogin'
import BlogPanel from './components/BlogPanel'
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
    tone: '#f8ead9',
  },
  {
    title: 'Obstetrícia',
    text: 'Com o mínimo de intervenções possível, atendo gestantes e suas famílias, individualizando condutas e trabalhando em corresponsabilidade. A busca pelo nascimento natural, respeitoso e humanizado norteia a minha assistência.',
    image: obstImage,
    imageAlt: 'Gestante sendo acolhida em consulta de obstetrícia',
    tone: '#f3dde6',
  },
  {
    title: 'Homeopatia',
    text: 'A homeopatia é uma especialidade médica que busca restabelecer o equilíbrio da saúde física, emocional, mental e energética do ser. Adota uma abordagem holística, considerando a paciente, sua história e relações como um todo.',
    image: homeoImage,
    imageAlt: 'Atendimento de homeopatia em ambiente sereno',
    tone: '#e9dded',
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

const ribbonItems = [
  'Ginecologia natural',
  'Obstetrícia humanizada',
  'Homeopatia',
  'Medicina integrativa',
  'Escuta profunda',
  'Cuidado sem pressa',
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

function App() {
  // null = fechado | 'hub' | 'agenda' | 'blog'
  const [adminScreen, setAdminScreen] = useState(null)
  const [isAdminAuthed, setIsAdminAuthed] = useState(() => Boolean(getToken()))
  const [blogPosts, setBlogPosts] = useState(fallbackBlogPosts)
  const [blogTick, setBlogTick] = useState(0)
  const specialtiesScrollRef = useRef(null)
  const specialtiesTrackRef = useRef(null)
  // Pixel endpoints for the horizontal sweep: starts with the first panel
  // centered, ends with the last one centered — then the page scrolls on.
  const [trackRange, setTrackRange] = useState({ from: 0, to: 0 })
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
  // Short hold at the start keeps panel 1 centered while the section header
  // scrolls away, then the sweep begins.
  const trackX = useTransform(
    scrollYProgress,
    [0, 0.15, 1],
    [trackRange.from, trackRange.from, trackRange.to],
  )

  useEffect(() => {
    const measure = () => {
      const track = specialtiesTrackRef.current
      const first = track?.firstElementChild
      const last = track?.lastElementChild
      if (!track || !first || !last) return
      // Rect deltas are immune to the track's current translation.
      const trackLeft = track.getBoundingClientRect().left
      const lastRect = last.getBoundingClientRect()
      const centerOf = (width) => (window.innerWidth - width) / 2
      setTrackRange({
        from: Math.max(0, centerOf(first.offsetWidth)),
        to: centerOf(lastRect.width) - (lastRect.left - trackLeft),
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
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
            pinned: post.pinned,
          })),
        )
      })
      .catch(() => {})
  }, [blogTick])

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
      <FloatingNavbar onOpenAgenda={() => setAdminScreen('hub')} />

      {adminScreen && !isAdminAuthed && (
        <AdminLogin
          onSuccess={() => setIsAdminAuthed(true)}
          onClose={() => setAdminScreen(null)}
        />
      )}
      {adminScreen === 'hub' && isAdminAuthed && (
        <AdminHub
          onOpenAgenda={() => setAdminScreen('agenda')}
          onOpenBlog={() => setAdminScreen('blog')}
          onClose={() => setAdminScreen(null)}
        />
      )}
      {adminScreen === 'agenda' && isAdminAuthed && (
        <AgendaPanel
          onClose={() => setAdminScreen('hub')}
          onAuthExpired={() => {
            clearToken()
            setIsAdminAuthed(false)
          }}
        />
      )}
      {adminScreen === 'blog' && isAdminAuthed && (
        <BlogPanel
          onClose={() => setAdminScreen('hub')}
          onAuthExpired={() => {
            clearToken()
            setIsAdminAuthed(false)
          }}
          onChanged={() => setBlogTick((t) => t + 1)}
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

        <div className="ribbon" aria-hidden="true">
          <div className="ribbon-track">
            {/* Two identical halves so the -50% marquee loops seamlessly. */}
            {[...ribbonItems, ...ribbonItems].map((item, index) => (
              <span key={`${item}-${index}`} className="ribbon-item">
                {item}
                <i>✦</i>
              </span>
            ))}
          </div>
        </div>

        <section className="section specialties-section" id="especialidades">
          <div className="container">
            <div className="section-header section-header--center" data-reveal>
              <p className="eyebrow">Cuidado integral</p>
              <h2>Especialidades</h2>
              <p>
                Ginecologia, obstetrícia e homeopatia — três caminhos que se
                encontram no olhar integral sobre a saúde da mulher.
              </p>
            </div>
          </div>
          <div
            className={`specialties-scroll${prefersReducedMotion ? ' is-static' : ''}`}
            style={{ '--specialty-steps': specialties.length }}
            ref={specialtiesScrollRef}
          >
            <div className="specialties-sticky">
              <motion.div
                className="specialties-track"
                ref={specialtiesTrackRef}
                style={{ x: prefersReducedMotion ? 0 : trackX }}
              >
                {specialties.map((item, index) => (
                  <article
                    key={item.title}
                    className="specialty-card"
                    style={{ '--card-tone': item.tone }}
                  >
                    <div className="specialty-card__content">
                      <p className="specialty-card__number">[0{index + 1}]</p>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                      <a className="card-link" href="#agendamento">
                        Agendar Consulta &rarr;
                      </a>
                    </div>
                    <div className="specialty-card__media">
                      <img src={item.image} alt={item.imageAlt} loading="lazy" />
                    </div>
                  </article>
                ))}
              </motion.div>
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
                    {post.pinned && (
                      <span className="blog-pin" title="Publicação fixada">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9 4h6l-.6 6.2 2.6 2.8v2H7v-2l2.6-2.8L9 4z" />
                          <path d="M12 15v6" />
                        </svg>
                        Fixado
                      </span>
                    )}
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
      </main>

      <footer className="site-footer">
        <div className="footer-panel" data-reveal>
          <div className="container">
            <div className="footer-cols">
              <div className="footer-brand">
                <span className="footer-logo" aria-hidden="true">MV</span>
                <div>
                  <strong>Mulher Viva</strong>
                  <span>Medicina Integrativa da Saúde Feminina</span>
                </div>
              </div>
              <div className="footer-col">
                <span className="footer-col__label">Contato</span>
                <a href="tel:+5561999990000">+55 61 99999-0000</a>
                <a href="mailto:contato@mulherviva.org">contato@mulherviva.org</a>
                <span>Atendimento das 8h às 18h</span>
              </div>
              <div className="footer-col">
                <span className="footer-col__label">Consultório</span>
                <span>Centro Médico Lúcio Costa</span>
                <span>SGAS 610, Bloco 2, Sala 250</span>
                <span>Brasília - DF · Presencial e online</span>
              </div>
              <div className="footer-col footer-col--cta">
                <a className="btn btn-primary" href="#agendamento">
                  Agendar consulta
                </a>
              </div>
            </div>
            <div className="footer-bottom">
              <p>© {year} Dra. Luciana da Silva Lopes. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
