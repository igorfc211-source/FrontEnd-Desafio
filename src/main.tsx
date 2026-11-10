import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-700.css'
import './styles.css'

const target = document.getElementById('root')!

async function start() {
  const mocks = import.meta.env.VITE_ENABLE_MOCKS !== 'false'
    ? import('./mocks/browser').then(({ startMocks }) => startMocks())
    : undefined
  const [{ App }] = await Promise.all([import('./router'), mocks])
  createRoot(target).render(<App />)
}

start().catch((error: unknown) => {
  console.error(error)
  const message = document.createElement('p')
  message.setAttribute('role', 'alert')
  message.textContent = 'Não foi possível iniciar o marketplace. Atualize a página para tentar novamente.'
  target.append(message)
})
