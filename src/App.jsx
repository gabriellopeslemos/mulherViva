import { useEffect } from 'react'
import FloatingNavbar from './components/FloatingNavbar'

const heroImage = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' width='720' height='860' viewBox='0 0 720 860'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#f6eff6'/>
      <stop offset='55%' stop-color='#ecdff0'/>
      <stop offset='100%' stop-color='#e2d2e6'/>
    </linearGradient>
    <radialGradient id='r' cx='0.82' cy='0.18' r='0.6'>
      <stop offset='0%' stop-color='#ffffff' stop-opacity='0.9'/>
      <stop offset='100%' stop-color='#ffffff' stop-opacity='0'/>
    </radialGradient>
  </defs>
  <rect width='720' height='860' fill='url(#g)'/>
  <circle cx='540' cy='190' r='240' fill='url(#r)'/>
  <path d='M-40 720 C 120 620 240 760 380 700 C 520 640 620 760 760 700 L 760 900 L -40 900 Z' fill='#efe6f0'/>
</svg>
`)}`

const aboutCards = [
  {
    title: 'Formacao em Medicina',
    text: 'Base clinica solida e atualizada para um cuidado seguro.',
  },
  {
    title: 'Especializacao em Ginecologia e Obstetricia',
    text: 'Atendimento preciso para cada fase da vida feminina.',
  },
  {
    title: '12+ anos de experiencia clinica',
    text: 'Historias de cuidado profundo e acompanhamento continuo.',
  },
  {
    title: 'Abordagem integrativa',
    text: 'Ciencia, mente e espiritualidade com equilibrio e evidencias.',
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
  },
  {
    title: 'Obstetricia',
    text: 'Com o minimo de intervencoes possivel, atendo gestantes e suas familias, individualizando condutas e trabalhando em corresponsabilidade. A busca pelo nascimento natural, respeitoso e humanizado norteia a minha assistencia.',
  },
  {
    title: 'Homeopatia',
    text: 'A homeopatia e uma especialidade medica que busca restabelecer o equilibrio da saude fisica, emocional, mental e energetica do ser. Adota uma abordagem holistica, considerando o paciente, sua historia e relacoes como um todo.',
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
  },
  {
    name: 'Renata C.',
    text: 'A consulta foi serena e precisa, senti que tudo foi explicado com calma.',
    tone: '#e4d7e3',
  },
  {
    name: 'Patricia A.',
    text: 'Um encontro entre ciencia e sensibilidade que transformou meu olhar.',
    tone: '#e9d4e6',
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
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const revealElements = Array.from(document.querySelectorAll('[data-reveal]'))

    if (prefersReducedMotion) {
      revealElements.forEach((element) => element.classList.add('is-visible'))
      return undefined
    }

    const observer = new IntersectionObserver(
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

    revealElements.forEach((element) => observer.observe(element))

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
      observer.disconnect()
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  const year = new Date().getFullYear()

  return (
    <div className="page">
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
                <a className="btn btn-outline" href="#abordagem">
                  Conhecer abordagem
                </a>
              </div>
              <div className="hero-meta">
                <div className="meta-card">CRM 000000 | RQE 00000</div>
                <div className="meta-card">Atendimento presencial e online</div>
                <div className="meta-card">Consultorio com luz natural</div>
              </div>
            </div>
            <div className="hero-media" data-reveal style={{ '--delay': '220ms' }}>
              <div className="hero-media__frame">
                <div
                  className="hero-media__image"
                  style={{ backgroundImage: `url(${heroImage})` }}
                  role="img"
                  aria-label="Luz natural em consultorio acolhedor"
                />
                <div className="hero-media__overlay">
                  <p>Ambiente calmo, reservado e iluminado.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="sobre">
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
              {aboutCards.map((card, index) => (
                <article
                  key={card.title}
                  className="stat-card"
                  data-reveal
                  style={{ '--delay': `${index * 80}ms` }}
                >
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section alt" id="abordagem" data-approach>
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

        <section className="section" id="especialidades">
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Especialidades</p>
              <h2>Cuidado especializado para cada fase da vida.</h2>
              <p>
                Protocolos personalizados com base clinica, ciencia e
                sensibilidade feminina.
              </p>
            </div>
            <div className="card-grid specialties-grid">
              {specialties.map((item, index) => (
                <article
                  key={item.title}
                  className="specialty-card"
                  data-reveal
                  style={{ '--delay': `${index * 90}ms` }}
                >
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <span className="card-link">Saiba mais</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section alt" id="diferenciais">
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Diferenciais</p>
              <h2>O cuidado que respeita a sua historia.</h2>
              <p>
                Uma experiencia clinica que equilibra tecnica, presencia e
                integracao emocional.
              </p>
            </div>
            <div className="differentials-grid">
              {differentials.map((item, index) => (
                <div
                  key={item}
                  className="differential-card"
                  data-reveal
                  style={{ '--delay': `${index * 90}ms` }}
                >
                  <span className="differential-mark">+</span>
                  <p>{item}</p>
                </div>
              ))}
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
                    aria-label={`Foto de ${item.name}`}
                    style={{ '--avatar-tone': item.tone }}
                  >
                    {item.name
                      .split(' ')
                      .map((word) => word[0])
                      .join('')}
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

        <section className="section alt" id="conteudo">
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Conteudo e educacao</p>
              <h2>Conhecimento que empodera escolhas conscientes.</h2>
              <p>
                Temas essenciais para voce compreender seu ciclo e cuidar da
                sua energia vital.
              </p>
            </div>
            <div className="card-grid content-grid">
              {educationTopics.map((topic, index) => (
                <article
                  key={topic.title}
                  className="content-card"
                  data-reveal
                  style={{ '--delay': `${index * 90}ms` }}
                >
                  <h3>{topic.title}</h3>
                  <p>{topic.text}</p>
                  <span className="card-link">Ver artigos</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="blog">
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

        <section className="section alt" id="endereco">
          <div className="container">
            <div className="section-header" data-reveal>
              <p className="eyebrow">Endereco</p>
              <h2>Um consultorio pensado para acolher com calma.</h2>
              <p>
                Use este espaco para compartilhar localizacao, horarios e
                facilidades do atendimento.
              </p>
            </div>
            <div className="address-grid">
              <div className="address-card" data-reveal>
                <h3>Consultorio Mulher Viva</h3>
                <p className="address-line">Rua Exemplo, 123 - Bairro Jardim</p>
                <p className="address-line">Sao Paulo - SP, 00000-000</p>
                <div className="address-divider" aria-hidden="true" />
                <ul className="address-list">
                  <li>Segunda a sexta, 08h as 18h</li>
                  <li>Atendimento presencial e telemedicina</li>
                  <li>Estacionamento proximo e acessibilidade</li>
                </ul>
              </div>
              <div className="map-card" data-reveal style={{ '--delay': '120ms' }}>
                <div
                  className="map-frame"
                  role="img"
                  aria-label="Mapa do consultorio"
                >
                  <div className="map-pin" aria-hidden="true">
                    MV
                  </div>
                  <p>Mapa e rotas em breve</p>
                </div>
                <p className="map-note">
                  Reserve este espaco para inserir o mapa interativo quando
                  estiver pronto.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="contato">
          <div className="container">
            <div className="cta-card" data-reveal>
              <div>
                <p className="eyebrow">Comece agora</p>
                <h2>Comece seu cuidado com mais consciencia e profundidade.</h2>
                <p>
                  Atendimento individualizado para mulheres que desejam clareza,
                  equilibrio e vitalidade.
                </p>
              </div>
              <div className="cta-actions">
                <a className="btn btn-primary" href="#contato">
                  Agendar consulta
                </a>
                <a
                  className="btn btn-outline"
                  href="https://wa.me/5500000000000"
                  rel="noreferrer"
                >
                  Falar no WhatsApp
                </a>
              </div>
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
