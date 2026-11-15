import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import ClerkWithRouter from './components/ClerkWithRouter'

const root = document.getElementById('root')!
const tree = (
  <StrictMode>
    <BrowserRouter>
      <ClerkWithRouter>
        <App />
      </ClerkWithRouter>
    </BrowserRouter>
  </StrictMode>
)

if (root.hasChildNodes()) hydrateRoot(root, tree)
else createRoot(root).render(tree)
