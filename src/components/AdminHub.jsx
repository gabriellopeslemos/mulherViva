import { useEffect } from 'react'
import { motion } from 'framer-motion'
import '../styles/agenda.css'
import '../styles/admin.css'

const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="16" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <path d="M8 14h3M8 17.5h5" />
  </svg>
)

const IconBlog = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h16" />
    <path d="m6 16 9.5-9.5a2.1 2.1 0 0 1 3 3L9 19l-4 1 1-4z" />
  </svg>
)

export default function AdminHub({ onOpenAgenda, onOpenBlog, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const cards = [
    {
      key: 'agenda',
      title: 'Agenda',
      text: 'Visualize e gerencie as consultas, horários de atendimento, bloqueios e aberturas extras.',
      icon: <IconCalendar />,
      onClick: onOpenAgenda,
    },
    {
      key: 'blog',
      title: 'Blog',
      text: 'Crie novas publicações, edite as antigas e escolha quais ficam fixadas na página inicial.',
      icon: <IconBlog />,
      onClick: onOpenBlog,
    },
  ]

  return (
    <div className="hub-root" role="dialog" aria-modal="true" aria-label="Painel administrativo">
      <header className="hub-topbar">
        <button type="button" className="ag-iconbtn" onClick={onClose} aria-label="Fechar painel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div className="hub-topbar__title">
          <h2>Painel administrativo</h2>
          <span>Mulher Viva</span>
        </div>
      </header>

      <div className="hub-body">
        <div className="hub-grid">
          {cards.map((card, index) => (
            <motion.button
              key={card.key}
              type="button"
              className="hub-card"
              onClick={card.onClick}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: index * 0.08, ease: 'easeOut' }}
            >
              <span className="hub-card__icon">{card.icon}</span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
              <span className="hub-card__cta">Abrir &rarr;</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
