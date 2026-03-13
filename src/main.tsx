import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from '@/contexts/AuthContext'
import { CreditsProvider } from '@/contexts/CreditsContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <AuthProvider>
        <CreditsProvider>
          <App />
        </CreditsProvider>
      </AuthProvider>
    </HelmetProvider>
  </StrictMode>,
)
