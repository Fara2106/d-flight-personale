import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { warmMapCacheOnceControlled } from './pwa/warmMapCache.ts'
import { lockPageZoom } from './ui/lockPageZoom.ts'

// primo avvio: appena il SW prende il controllo (clientsClaim), replay delle
// risorse mappa già scaricate → cache runtime piene già dalla prima sessione
warmMapCacheOnceControlled()
// iOS: il pinch deve zoomare la mappa, non la pagina
lockPageZoom()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
