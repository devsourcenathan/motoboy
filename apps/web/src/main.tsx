import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
/*
 * **Avant `App`, et l'ordre compte.** `i18next.init` s'exécute au chargement du
 * module ; importé après le premier rendu, les composants afficheraient leurs
 * clés brutes le temps d'une image — « public:search.from » à la place de
 * « Départ ».
 */
import './lib/i18n'
import App from './App.tsx'
import { registerServiceWorker } from './lib/serviceWorker'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()
