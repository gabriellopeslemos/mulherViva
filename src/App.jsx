import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
} from 'framer-motion'
import FloatingNavbar from './components/FloatingNavbar'
import BookingSection from './components/BookingSection'
import FallbackImage from './components/FallbackImage'

const AdminHub = lazy(() => import('./components/AdminHub'))
const AgendaPanel = lazy(() => import('./components/AgendaPanel'))
const AdminLogin = lazy(() => import('./components/AdminLogin'))
const BlogPanel = lazy(() => import('./components/BlogPanel'))
const ManageBooking = lazy(() => import('./components/ManageBooking'))
const BlogPage = lazy(() => import('./pages/BlogPage'))
const PostPage = lazy(() => import('./pages/PostPage'))
import { api, clearToken, getToken } from './lib/api'
import { useAvailableImage } from './lib/useAvailableImage'
import {
  heroImage as heroPlaceholder,
  aboutImage as aboutPlaceholder,
  gynImage as gynPlaceholder,
  obstImage as obstPlaceholder,
  ortoImage as ortoPlaceholder,
  testimonialRandomOne as testimonialPlaceholderOne,
  testimonialRandomTwo as testimonialPlaceholderTwo,
  testimonialRandomThree as testimonialPlaceholderThree,
  clinicPhotoImage as clinicPhotoPlaceholder,
} from './lib/placeholderImages'

// TODO: replace with real WhatsApp number
const WHATSAPP_NUMBER = '5561999990000'
const WHATSAPP_MESSAGE = 'Olá! Gostaria de agendar uma consulta.'
const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`

const IconWhatsapp = () => (
  <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
    <path d="M16.02 3C9.4 3 4 8.38 4 15c0 2.36.68 4.55 1.86 6.4L4 29l7.78-1.83A11.9 11.9 0 0 0 16.02 27C22.63 27 28 21.62 28 15S22.63 3 16.02 3Zm0 21.7c-1.98 0-3.83-.55-5.4-1.5l-.39-.23-4.62 1.09 1.13-4.5-.25-.4A9.63 9.63 0 0 1 5.3 15c0-5.9 4.8-10.7 10.72-10.7 5.9 0 10.7 4.8 10.7 10.7s-4.8 10.7-10.7 10.7Zm5.86-8.02c-.32-.16-1.9-.94-2.2-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1 1.25-.19.21-.37.24-.69.08-.32-.16-1.34-.5-2.55-1.58-.94-.84-1.58-1.87-1.76-2.19-.19-.32-.02-.5.14-.65.14-.14.32-.37.48-.55.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.75-.99-2.39-.26-.63-.53-.54-.72-.55h-.62c-.21 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.67 0 1.57 1.15 3.09 1.31 3.3.16.21 2.26 3.45 5.47 4.84.76.33 1.36.53 1.82.67.77.24 1.46.21 2.02.13.62-.09 1.9-.78 2.16-1.53.27-.75.27-1.4.19-1.53-.08-.13-.29-.21-.61-.37Z" />
  </svg>
)

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
  'Medicina humanizada',
  'Obstetrícia humanizada',
  'Ortomolecular',
]

const specialties = [
  {
    title: 'Ginecologia',
    text: 'Ginecologia natural e preventiva, baseada no olhar integral da mulher. A história, os sinais, os sintomas, o exame físico e, quando necessário, exames complementares são cuidadosamente avaliados.',
    image: '/images/exam.jpg',
    placeholder: gynPlaceholder,
    imageAlt: 'Médica realizando atendimento ginecológico acolhedor',
    tone: 'color-mix(in srgb, var(--palette-5) 70%, white)',
  },
  {
    title: 'Obstetrícia',
    text: 'Com o mínimo de intervenções possível, atendo gestantes e suas famílias, individualizando condutas e trabalhando em corresponsabilidade. A busca pelo nascimento natural, respeitoso e humanizado norteia a minha assistência.',
    image: '/images/hug.jpg',
    placeholder: obstPlaceholder,
    imageAlt: 'Gestante sendo acolhida em consulta de obstetrícia',
    tone: 'color-mix(in srgb, var(--palette-4) 55%, white)',
  },
  {
    title: 'Ortomolecular',
    text: 'A Medicina Ortomolecular é uma prática terapêutica complementar baseada na teoria de que doenças e o envelhecimento resultam de desequilíbrios bioquímicos e excesso de radicais livres no corpo. O objetivo é restaurar o equilíbrio molecular por meio de dietas, mudanças no estilo de vida e suplementação individualizada de vitaminas, minerais e aminoácidos.',
    image: '/images/m.jpg',
    placeholder: ortoPlaceholder,
    imageAlt: 'Atendimento de medicina ortomolecular em ambiente sereno',
    tone: 'color-mix(in srgb, var(--palette-3) 45%, white)',
  },
]

// Many back-to-back copies so the track always has a real card to slide into
// on either side (even through a burst of rapid clicks) for a seamless loop.
const SPECIALTIES_LOOP_COPIES = 13
const specialtiesLoop = Array.from({ length: SPECIALTIES_LOOP_COPIES }, () => specialties).flat()

const testimonialsRowOne = [
  {
    name: 'Luciana M.',
    role: 'Paciente · Ginecologia',
    text: 'Encontrei um cuidado profundo, sem julgamentos e com respeito real.',
    tone: 'color-mix(in srgb, var(--palette-3) 40%, white)',
    image: '/images/mulherRandom.jpg',
    placeholder: testimonialPlaceholderOne,
    imageAlt: 'Foto de Luciana',
  },
  {
    name: 'Renata C.',
    role: 'Paciente · Obstetrícia',
    text: 'A consulta foi serena e precisa. Senti que tudo foi explicado com calma.',
    tone: 'color-mix(in srgb, var(--palette-4) 45%, white)',
    image: '/images/mulherRandom2.jpg',
    placeholder: testimonialPlaceholderTwo,
    imageAlt: 'Foto de Renata',
  },
  {
    name: 'Pedro F.',
    role: 'Paciente · Medicina ortomolecular',
    text: 'Um encontro entre ciência e sensibilidade que transformou meu olhar.',
    tone: 'color-mix(in srgb, var(--palette-2) 35%, white)',
    image: '/images/homemrandom.jpg',
    placeholder: testimonialPlaceholderThree,
    imageAlt: 'Foto de Pedro',
  },
]

const testimonialsRowTwo = [
  {
    name: 'Camila S.',
    role: 'Paciente · Ginecologia',
    text: 'Me senti acolhida do início ao fim, com uma escuta que eu nunca tinha tido.',
    tone: 'color-mix(in srgb, var(--palette-5) 40%, white)',
    image: '/images/mulherRandom2.jpg',
    placeholder: testimonialPlaceholderTwo,
    imageAlt: 'Foto de Camila',
  },
  {
    name: 'Beatriz A.',
    role: 'Paciente',
    text: 'Cuidado individualizado de verdade, sem pressa e com muita clareza nas explicações.',
    tone: 'color-mix(in srgb, var(--palette-2) 40%, white)',
    image: '/images/mulherRandom.jpg',
    placeholder: testimonialPlaceholderOne,
    imageAlt: 'Foto de Beatriz',
  },
  {
    name: 'Marcelo T.',
    role: 'Paciente · Obstetrícia',
    text: 'Indiquei para toda a minha família pela qualidade do atendimento e atenção aos detalhes.',
    tone: 'color-mix(in srgb, var(--palette-3) 45%, white)',
    image: '/images/homemrandom.jpg',
    placeholder: testimonialPlaceholderThree,
    imageAlt: 'Foto de Marcelo',
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
  'Ortomolecular',
  'Medicina humanizada',
  'Escuta profunda',
  'Cuidado sem pressa',
]

const faqItems = [
  {
    question: 'A consulta é coberta por convênio?',
    answer:
      'O atendimento é particular, com recibo detalhado para solicitação de reembolso junto ao seu convênio. // TODO: confirmar política de reembolso/convênios com a clínica',
  },
  {
    question: 'Quanto tempo dura a consulta?',
    answer:
      'A primeira consulta costuma durar entre 60 e 90 minutos, tempo suficiente para uma escuta profunda e sem pressa. Retornos são mais breves, mas sempre respeitando o que você precisa trazer naquele momento.',
  },
  {
    question: 'Como funciona a consulta online?',
    answer:
      'É feita por videochamada, com a mesma atenção e cuidado do atendimento presencial. Exames físicos e procedimentos, quando necessários, são combinados para um encontro presencial posterior.',
  },
  {
    question: 'O que é medicina ortomolecular?',
    answer:
      'É uma abordagem complementar que busca equilibrar o organismo por meio de nutrição, estilo de vida e suplementação individualizada de vitaminas, minerais e aminoácidos, sempre integrada à avaliação clínica tradicional.',
  },
  {
    question: 'Atende gestantes de alto risco?',
    answer:
      'Sim, gestações de maior complexidade são acompanhadas com atenção redobrada e, quando necessário, em conjunto com outros especialistas, mantendo o mesmo compromisso com um cuidado individualizado e humanizado.',
  },
  {
    question: 'Como remarco ou cancelo minha consulta?',
    answer:
      'Após o agendamento você recebe um e-mail com um link pessoal de gerenciamento, pelo qual pode remarcar ou cancelar a qualquer momento, sem precisar ligar ou esperar retorno. Perdeu o e-mail? Use o botão "Quero reagendar" na seção de agendamento e reenviamos o link.',
  },
]

const heroBlobDefs = [
  { color: 'var(--palette-4)', blur: 80, w: 520, h: 420, baseX: 0.08, baseY: 0.08, phase: 0.0 },
  { color: 'var(--palette-3)', blur: 90, w: 480, h: 380, baseX: 0.72, baseY: 0.45, phase: 1.3 },
  { color: 'color-mix(in srgb, var(--palette-4) 60%, white)', blur: 75, w: 560, h: 440, baseX: 0.85, baseY: 0.85, phase: 2.5 },
  { color: 'color-mix(in srgb, var(--palette-3) 70%, white)', blur: 85, w: 340, h: 300, baseX: 0.78, baseY: 0.10, phase: 3.8 },
  { color: 'var(--palette-5)', blur: 70, w: 460, h: 360, baseX: 0.15, baseY: 0.80, phase: 1.0 },
  { color: 'color-mix(in srgb, var(--palette-2) 55%, white)', blur: 100, w: 400, h: 320, baseX: 0.45, baseY: 0.30, phase: 2.1 },
  { color: 'color-mix(in srgb, var(--palette-3) 55%, white)', blur: 80, w: 300, h: 260, baseX: 0.02, baseY: 0.45, phase: 0.7 },
]

function formatPostDate(isoDate) {
  const formatted = new Date(isoDate).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function TestimonialCard({ item }) {
  const resolvedImage = useAvailableImage(item.image, item.placeholder)

  return (
    <article className="testimonial-card">
      <p className="testimonial-text">"{item.text}"</p>
      <div className="testimonial-author">
        <div
          className="avatar"
          role="img"
          aria-label={item.imageAlt || `Foto de ${item.name}`}
          style={{
            '--avatar-tone': item.tone,
            '--avatar-image': resolvedImage ? `url(${resolvedImage})` : undefined,
          }}
        >
          {!resolvedImage
            ? item.name
                .split(' ')
                .map((word) => word[0])
                .join('')
            : null}
        </div>
        <div className="testimonial-author__meta">
          <p className="testimonial-name">{item.name}</p>
          {item.role ? <p className="testimonial-role">{item.role}</p> : null}
        </div>
      </div>
    </article>
  )
}

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <div className="faq-list">
      {faqItems.map((item, index) => {
        const isOpen = openIndex === index
        return (
          <div
            key={item.question}
            className="faq-item"
            data-reveal
            style={{ '--delay': `${index * 70}ms` }}
          >
            <h3 className="faq-item__heading">
              <button
                type="button"
                className="faq-question"
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${index}`}
                id={`faq-trigger-${index}`}
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
              >
                <span>{item.question}</span>
                <span className="faq-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              className="faq-answer"
              id={`faq-panel-${index}`}
              role="region"
              aria-labelledby={`faq-trigger-${index}`}
              data-open={isOpen}
            >
              <div className="faq-answer__inner">
                <p>{item.answer}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Ambient color blobs for the page-level glow layer (.page-glow-layer).
// `top` is a percentage of the FULL page height, so positions are approximate
// by design — the goal is even ambient distribution, not pixel alignment with
// sections. Sides alternate, sizes and palette tones vary. The hero (~top 10%)
// paints its own opaque background, so blobs start below it.
const pageGlows = [
  { top: '9%', left: '-8%', size: 620, color: 'var(--palette-4)', mix: 60 },
  { top: '17%', right: '-10%', size: 520, color: 'var(--palette-5)', mix: 85 },
  { top: '25%', left: '-6%', size: 380, color: 'var(--palette-3)', mix: 45 },
  { top: '33%', right: '-8%', size: 600, color: 'var(--palette-4)', mix: 55 },
  { top: '42%', left: '-10%', size: 480, color: 'var(--palette-2)', mix: 40 },
  // boundary glows (right side): centered on section transitions, measured
  // against the live page height so the seams read as one continuous surface.
  { top: '46.5%', right: '-7%', size: 520, color: 'var(--palette-3)', mix: 62 }, // sobre → abordagem
  { top: '54%', right: '-8%', size: 480, color: 'var(--palette-2)', mix: 48 }, // abordagem → depoimentos
  { top: '60%', left: '-8%', size: 620, color: 'var(--palette-4)', mix: 60 },
  { top: '69.4%', right: '-8%', size: 520, color: 'var(--palette-3)', mix: 60 }, // duvidas → agendamento
  { top: '78%', left: '-6%', size: 340, color: 'var(--palette-2)', mix: 38 },
  { top: '86%', right: '-8%', size: 600, color: 'var(--palette-3)', mix: 48 },
  { top: '94%', left: '-10%', size: 440, color: 'var(--palette-4)', mix: 55 },
]

function Landing() {
  // null = fechado | 'hub' | 'agenda' | 'blog'
  const [adminScreen, setAdminScreen] = useState(null)
  const [manageToken, setManageToken] = useState(() =>
    new URLSearchParams(window.location.search).get('manage'),
  )
  const [isAdminAuthed, setIsAdminAuthed] = useState(() => Boolean(getToken()))
  const [presetSpecialty, setPresetSpecialty] = useState(null)
  const [blogPosts, setBlogPosts] = useState(fallbackBlogPosts)
  const [blogTick, setBlogTick] = useState(0)
  // Same reasoning as the booking section: this preview sits far below the
  // fold and already renders `fallbackBlogPosts` immediately, so the fetch is
  // pure progressive enhancement — deferring it until the section nears the
  // viewport keeps it out of the initial critical request chain.
  const blogSectionRef = useRef(null)
  const [shouldLoadBlog, setShouldLoadBlog] = useState(false)
  // The track renders many back-to-back copies of `specialties` so stepping
  // past the last card keeps sliding into a real (duplicate) next card
  // instead of jumping — and so a burst of rapid clicks (each one redirects
  // the animation instead of being dropped) always has a real card to land
  // on. trackIndex is an absolute index into that array; once the active
  // card settles far from the middle copy it's silently re-centered by a
  // whole number of copy-lengths (identical content, so the jump is invisible).
  const specialtiesLoopMiddleStart =
    specialties.length * Math.floor(SPECIALTIES_LOOP_COPIES / 2)
  const [trackIndex, setTrackIndex] = useState(specialtiesLoopMiddleStart)
  const trackIndexRef = useRef(specialtiesLoopMiddleStart)
  const [stepPositions, setStepPositions] = useState([])
  const trackX = useMotionValue(0)
  const specialtiesTrackRef = useRef(null)
  const isSpecialtySnappingRef = useRef(false)
  const activeSpecialty =
    ((trackIndex % specialties.length) + specialties.length) % specialties.length
  const addressContentRef = useRef(null)
  const addressTitleRef = useRef(null)
  const heroBlobLayerRef = useRef(null)
  const aboutSectionRef = useRef(null)
  const prefersReducedMotion = useReducedMotion()
  const [years, setYears] = useState(0)
  const [startYearsCount, setStartYearsCount] = useState(false)
  const isAboutInView = useInView(aboutSectionRef, { once: true, amount: 0.3 })
  const heroImage = useAvailableImage('/images/hero-nobg.webp', heroPlaceholder)
  const aboutImage = useAvailableImage('/images/about.webp', aboutPlaceholder)
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
  const pageProgressSpring = useSpring(pageScrollProgress, {
    stiffness: 140,
    damping: 24,
    mass: 0.25,
  })

  // Re-centers trackIndex into the middle copy of the loop, whatever copy it
  // drifted to (a burst of rapid clicks can walk it several copies away
  // before things settle) — content is identical across copies, so the jump
  // is invisible.
  const normalizeTrackIndex = () => {
    const length = specialties.length
    const current = trackIndexRef.current
    if (current >= length && current < length * (SPECIALTIES_LOOP_COPIES - 1)) return
    const real = ((current % length) + length) % length
    const next = specialtiesLoopMiddleStart + real
    if (next === current) return
    trackIndexRef.current = next
    setTrackIndex(next)
    trackX.set(stepPositions[next] ?? 0)
  }

  const animateTrackTo = (index) => {
    trackIndexRef.current = index
    setTrackIndex(index)
    const target = stepPositions[index] ?? 0
    if (prefersReducedMotion) {
      trackX.set(target)
      return
    }
    isSpecialtySnappingRef.current = true
    // animate() on the same motion value interrupts whatever spring is
    // already running, so clicking again mid-transition just redirects it —
    // no click is ever dropped, however fast they come in.
    animate(trackX, target, {
      type: 'spring',
      stiffness: 260,
      damping: 34,
      onComplete: () => {
        isSpecialtySnappingRef.current = false
        normalizeTrackIndex()
      },
    })
  }

  const stepSpecialty = (delta) => {
    animateTrackTo(trackIndexRef.current + delta)
  }

  const goToSpecialty = (targetIndex) => {
    const length = specialties.length
    const currentReal = ((trackIndexRef.current % length) + length) % length
    const delta = (targetIndex - currentReal + length) % length
    if (delta === 0) return
    animateTrackTo(trackIndexRef.current + delta)
  }

  // Measure each card's centered x offset up front, then keep the track
  // snapped to the active one whenever the layout changes (resize).
  useEffect(() => {
    const measure = () => {
      const track = specialtiesTrackRef.current
      const cards = track ? Array.from(track.children) : []
      if (!track || !cards.length) return
      const trackLeft = track.getBoundingClientRect().left
      // Center against the viewport's own width, not the window's — the
      // viewport is its own centered, capped-width box, not always edge-to-edge.
      const viewportWidth = track.parentElement.getBoundingClientRect().width
      const centerOf = (width) => (viewportWidth - width) / 2
      const positions = cards.map((card) => {
        const rect = card.getBoundingClientRect()
        return centerOf(rect.width) - (rect.left - trackLeft)
      })
      setStepPositions(positions)
      if (!isSpecialtySnappingRef.current) {
        trackX.set(positions[trackIndexRef.current] ?? 0)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [trackX])

  // Autoplay: advance one specialty at a time on a timer, looping seamlessly.
  // Restarts on every change so a manual click resets the pace. Reads
  // stepSpecialty through a ref so the effect doesn't need it as a dependency.
  const stepSpecialtyRef = useRef(stepSpecialty)
  useEffect(() => {
    stepSpecialtyRef.current = stepSpecialty
  })
  useEffect(() => {
    if (prefersReducedMotion || specialties.length <= 1) return undefined
    const timer = setInterval(() => {
      stepSpecialtyRef.current(1)
    }, 6000)
    return () => clearInterval(timer)
  }, [trackIndex, prefersReducedMotion])

  useEffect(() => {
    const node = blogSectionRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShouldLoadBlog(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoadBlog(true)
          observer.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!shouldLoadBlog && blogTick === 0) return
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
  }, [shouldLoadBlog, blogTick])

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
    const handleScroll = () => {
      const scrollY = window.scrollY
      parallaxElements.forEach((element) => {
        const speed = Number(element.dataset.parallax || 0.08)
        element.style.transform = `translateY(${scrollY * speed}px)`
      })
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
    // Blog cards are keyed by post.id and replace the fallback DOM nodes once
    // the real posts load, so this must re-scan for new [data-reveal] elements.
  }, [blogPosts])

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
      <div className="page-glow-layer" aria-hidden="true">
        {pageGlows.map((glow, index) => (
          <div
            key={index}
            className="page-glow"
            style={{
              top: glow.top,
              width: `${glow.size}px`,
              height: `${glow.size}px`,
              ...(glow.left ? { left: glow.left } : { right: glow.right }),
              '--glow-color': `color-mix(in srgb, ${glow.color} ${glow.mix}%, transparent)`,
            }}
          />
        ))}
      </div>
      <motion.div
        className="scroll-progress"
        style={{ scaleX: pageProgressSpring }}
        aria-hidden="true"
      />
      <FloatingNavbar onOpenAgenda={() => setAdminScreen('hub')} />

      <Suspense fallback={null}>
        {manageToken && (
          <ManageBooking
            token={manageToken}
            onClose={() => {
              setManageToken(null)
              window.history.replaceState(null, '', window.location.pathname)
            }}
          />
        )}

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
      </Suspense>

      <main>
        <section className="hero hero-bg" id="inicio" tabIndex={-1}>
          <div className="hero-blob-layer" ref={heroBlobLayerRef} aria-hidden="true" />
          <div className="container hero-grid">
            <div className="hero-content" data-reveal style={{ '--delay': '120ms' }}>
              <p className="eyebrow">Ginecologia · Obstetrícia · Ortomolecular</p>
              <h1>
                Um novo olhar para a saúde feminina: <em>mais humano, mais completo</em>.
              </h1>
              <p className="lead">
                Medicina para mulheres que buscam um cuidado
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
        </section>

        <section className="section specialties-section" id="especialidades" tabIndex={-1}>
          <div className="container">
            <div className="section-header section-header--center" data-reveal>
              <h2>Especialidades</h2>
            </div>
          </div>

          <div className="specialties-carousel">
            <div className="specialties-viewport">
              <motion.div
                className="specialties-track"
                ref={specialtiesTrackRef}
                style={{ x: prefersReducedMotion ? 0 : trackX }}
              >
                {specialtiesLoop.map((item, loopIndex) => (
                  <article
                    key={loopIndex}
                    className={`specialty-card${
                      loopIndex === trackIndex ? ' is-active' : ''
                    }`}
                    style={{ '--card-tone': item.tone }}
                  >
                    <div className="specialty-card__content">
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                      <a
                        className="card-link"
                        href="#agendamento"
                        onClick={() => setPresetSpecialty(item.title)}
                      >
                        Agendar Consulta &rarr;
                      </a>
                    </div>
                    <div className="specialty-card__media">
                      <FallbackImage
                        src={item.image}
                        fallback={item.placeholder}
                        alt={item.imageAlt}
                        loading="lazy"
                      />
                    </div>
                  </article>
                ))}
              </motion.div>
            </div>

            <div className="specialties-nav">
              <button
                type="button"
                className="specialties-nav__arrow"
                onClick={() => stepSpecialty(-1)}
                aria-label="Especialidade anterior"
              >
                &larr;
              </button>
              <div className="specialties-dots">
                {specialties.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    className={`specialties-dot${index === activeSpecialty ? ' is-active' : ''}`}
                    onClick={() => goToSpecialty(index)}
                    aria-label={`Ver especialidade ${item.title}`}
                    aria-current={index === activeSpecialty}
                  />
                ))}
              </div>
              <button
                type="button"
                className="specialties-nav__arrow"
                onClick={() => stepSpecialty(1)}
                aria-label="Próxima especialidade"
              >
                &rarr;
              </button>
            </div>
          </div>
        </section>

        <section className="section" id="sobre" tabIndex={-1} ref={aboutSectionRef} style={{ overflow: 'hidden' }}>
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

        <section className="section" id="depoimentos" tabIndex={-1}>
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Depoimentos</p>
              <h2>Histórias de mulheres que se sentiram ouvidas.</h2>
              <p>Cuidado profundo transforma a relação com o próprio corpo.</p>
            </div>
          </div>
          <div className="carousel-stack">
            <div className="carousel" aria-label="Depoimentos das pacientes">
              <div className="carousel-track carousel-track--row1">
                {/* Two identical halves (each repeats the list enough to span the
                    viewport) so the -50% marquee loops seamlessly and forever. */}
                {[...testimonialsRowOne, ...testimonialsRowOne, ...testimonialsRowOne, ...testimonialsRowOne].map((item, index) => (
                  <TestimonialCard key={`row1-${item.name}-${index}`} item={item} />
                ))}
              </div>
            </div>
            <div className="carousel" aria-label="Depoimentos das pacientes">
              <div className="carousel-track carousel-track--row2">
                {[...testimonialsRowTwo, ...testimonialsRowTwo, ...testimonialsRowTwo, ...testimonialsRowTwo].map((item, index) => (
                  <TestimonialCard key={`row2-${item.name}-${index}`} item={item} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section section--soft" id="duvidas" tabIndex={-1}>
          <div className="container">
            <div className="faq-grid">
              <div className="section-header faq-intro" data-reveal>
                <p className="eyebrow">Dúvidas frequentes</p>
                <h2>Perguntas que ajudam você a se sentir mais segura.</h2>
                <p>
                  Separamos aqui as dúvidas mais comuns sobre a consulta, o
                  atendimento e o cuidado com a sua saúde. Se quiser saber algo
                  mais, estou por aqui.
                </p>
                <p className="faq-note" aria-hidden="true">Sua saúde é prioridade ♡</p>
              </div>
              <FaqAccordion />
            </div>
          </div>
        </section>

        <BookingSection presetSpecialty={presetSpecialty} />

        <section className="section" id="endereco" tabIndex={-1}>
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
                <div className="address-photo" data-reveal style={{ '--delay': '160ms' }}>
                  <FallbackImage
                    src="/images/centroLucioCosta.png"
                    fallback={clinicPhotoPlaceholder}
                    alt="Fachada e recepção do Centro Médico Lúcio Costa, consultório da Dra. Luciana da Silva Lopes"
                    loading="lazy"
                  />
                  <span className="address-photo__caption">Nosso espaço de acolhimento</span>
                </div>
                <div className="address-actions">
                  <a className="btn btn-primary" href="#agendamento">
                    Agendar consulta
                  </a>
                </div>
              </div>
              <div className="map-block" data-reveal style={{ '--delay': '120ms' }}>
                <iframe
                  className="map-block__frame"
                  src="https://www.google.com/maps?q=Centro%20Medico%20Lucio%20Costa%2C%20SGAS%20610%2C%20Bloco%202%2C%20Sala%20250%2C%20Brasilia%20-%20DF&output=embed"
                  title="Mapa com a localização do consultório"
                  loading="lazy"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <a
                  className="map-block__link"
                  href="https://www.google.com/maps/search/?api=1&query=Centro%20Medico%20Lucio%20Costa%2C%20SGAS%20610%2C%20Bloco%202%2C%20Sala%20250%2C%20Brasilia%20-%20DF"
                  target="_blank"
                  rel="noreferrer"
                >

                  <span className="map-block__info">
                    <strong>Centro Médico Lúcio Costa</strong>
                    <span>SGAS 610, Bloco 2, Sala 250, Brasília - DF</span>
                  </span>
                  <span className="map-block__cta">Ver no Maps &rarr;</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--soft" id="blog" ref={blogSectionRef}>
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Blog</p>
              <h2>Conteúdo para apoiar a sua jornada.</h2>
              <p>
                Artigos, reflexões e orientações clínicas escritas com calma —
                para você ler no seu tempo.
              </p>
              <Link className="card-link" to="/blog">
                Ver todas as publicações &rarr;
              </Link>
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
                  {post.id ? (
                    <Link className="card-link" to={`/blog/${post.id}`}>
                      Ler post &rarr;
                    </Link>
                  ) : (
                    <span className="card-link">Ler post</span>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {!adminScreen && (
        <a
          className="whatsapp-fab"
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Conversar no WhatsApp"
          data-reveal
          style={{ '--delay': '400ms' }}
        >
          {/* TODO: replace with real WhatsApp number */}
          <IconWhatsapp />
        </a>
      )}

      <footer className="site-footer">
        <div className="footer-panel" data-reveal>
          <div className="container">
            <div className="footer-cols">
              <div className="footer-brand">
                <span className="footer-logo" aria-hidden="true">MV</span>
                <div>
                  <strong>Mulher Viva</strong>
                  <span>Medicina da Saúde Feminina</span>
                </div>
              </div>
              <div className="footer-col">
                <span className="footer-col__label">Contato</span>
                <a href="tel:+5561999990000">+55 61 99999-0000</a>
                <a href="mailto:contato@mulherviva.org">contato@mulherviva.org</a>
                {/* TODO: replace with real WhatsApp number */}
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
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

function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:id" element={<PostPage />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </Suspense>
  )
}

export default App
