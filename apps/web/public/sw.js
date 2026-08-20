/*
 * Le service worker de l'embarquement.
 *
 * **Écrit à la main plutôt que généré.** Un plugin produit un manifeste de
 * pré-cache lié aux noms de fichiers hachés du build ; ici on n'en a pas besoin,
 * parce que deux stratégies simples suffisent et se lisent en entier :
 *
 * - les **ressources hachées** (`/assets/…`) ne changent jamais à URL constante :
 *   on les sert depuis le cache dès qu'on les a vues une fois ;
 * - la **navigation** part au réseau d'abord et retombe sur la coquille en cache,
 *   ce qui donne un écran d'embarquement même sans réseau.
 *
 * Ce qui n'est **jamais** mis en cache : les appels à l'API. Une liste
 * d'embarquement servie depuis un cache HTTP serait invisible pour le code, qui
 * la croirait fraîche ; la copie hors ligne est gérée explicitement dans
 * `offline.ts`, où l'agent voit son heure de téléchargement.
 */

const CACHE = 'motoboy-boarding-v1'
const SHELL = '/index.html'

self.addEventListener('install', (event) => {
  // La coquille est prise à l'installation : sans elle, un premier chargement
  // hors ligne ne donne rien du tout.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((name) => name !== CACHE).map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  // Seules les requêtes GET de notre propre origine nous concernent.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  /*
   * L'API n'est jamais mise en cache. Servir une réponse périmée ferait valider
   * des billets contre une liste dont personne ne connaîtrait l'âge — exactement
   * ce que la copie explicite évite.
   */
  if (url.pathname.startsWith('/api/')) return

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone()

            void caches.open(CACHE).then((cache) => cache.put(request, copy))

            return response
          }),
      ),
    )

    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(SHELL).then((cached) => cached ?? Response.error()),
      ),
    )
  }
})
