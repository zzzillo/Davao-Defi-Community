import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SiteNavbar, { publicNavLinks } from './components/SiteNavbar'
import Landing from './pages/public/Landing'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteNavbar homeHref="#landing-home" links={publicNavLinks} />
    <Landing />
  </StrictMode>,
)
