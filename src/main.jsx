import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Hints the browser to fetch the hero (LCP) image immediately instead of
// waiting for React to mount and set it as a CSS background-image. Injected
// as JS (not a static <link> in index.html) so Vite's HTML asset pipeline
// doesn't fingerprint it — /images/* is served as-is, outside that pipeline.
const heroPreload = document.createElement('link')
heroPreload.rel = 'preload'
heroPreload.as = 'image'
heroPreload.href = '/images/hero-nobg.webp'
heroPreload.fetchPriority = 'high'
document.head.appendChild(heroPreload)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
