/**
 * Enregistre le service worker.
 *
 * **Uniquement en production.** En développement, Vite sert des modules non
 * groupés et un service worker qui met en cache la coquille masquerait chaque
 * modification derrière un rechargement forcé — on passerait plus de temps à
 * vider le cache qu'à écrire du code.
 *
 * L'échec est silencieux, et c'est voulu : un navigateur qui refuse
 * l'enregistrement — mode privé, origine non sécurisée — doit encore pouvoir
 * embarquer en ligne. Perdre le hors-ligne est ennuyeux ; perdre l'application
 * ne l'est pas.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  globalThis.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
