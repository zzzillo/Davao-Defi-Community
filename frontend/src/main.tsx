import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ClerkWithRouter from './components/ClerkWithRouter'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkWithRouter>
        <App />
      </ClerkWithRouter>
    </BrowserRouter>
  </StrictMode>,
)
