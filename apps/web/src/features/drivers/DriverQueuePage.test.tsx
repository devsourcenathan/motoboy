import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { errorLabel, resolveLocale } from '@motoboy/shared'
import type { AdminDriverRow } from '@motoboy/api-client/types'
import { i18next } from '../../lib/i18n'
import { calledUrls, jsonResponse, mockFetch, render } from '../../test/render'
import { DriverQueuePage } from './DriverQueuePage'

/**
 * La file des dossiers de chauffeur.
 *
 * **Sans agence pour répondre d'un incident, cette page est la seule barrière**
 * entre la plateforme et quelqu'un dont personne n'a vu le permis. Ce qu'elle
 * décide met un inconnu au volant avec des passagers, et jusqu'ici rien ne la
 * testait.
 */
const COMPLETE: AdminDriverRow = {
  id: 7,
  status: 'PENDING',
  submitted_at: '2026-08-10T09:00:00Z',
  driver: { first_name: 'Jean', last_name: 'Kamdem', phone: '+237690000101' },
  city_id: 23,
  vehicle_plate: 'LT-4412-AB',
  documents: (['LICENSE', 'REGISTRATION', 'IDENTITY', 'INSURANCE'] as const).map(
    (type, index) => ({
      id: index + 1,
      type,
      // Ce que l'API produit : un lien signé, valable dix minutes.
      url: `https://api.test/v1/documents/driver/${index + 1}?expires=1&signature=abc`,
    }),
  ),
}

const INCOMPLETE: AdminDriverRow = {
  ...COMPLETE,
  id: 8,
  driver: { first_name: 'Awa', last_name: 'Nkeng', phone: '+237690000202' },
  documents: COMPLETE.documents.filter(
    (doc) => doc.type === 'LICENSE' || doc.type === 'IDENTITY',
  ),
}

function page(...rows: AdminDriverRow[]) {
  return jsonResponse({
    data: rows,
    meta: { page: 1, per_page: 20, total: rows.length, last_page: 1 },
  })
}

/** Le corps JSON envoyé à la première requête dont l'URL finit par `suffix`. */
async function sentBodyTo(suffix: string): Promise<string> {
  const mock = fetch as unknown as { mock: { calls: [Request | string][] } }

  const call = mock.mock.calls.find(([input]) =>
    (typeof input === 'string' ? input : input.url).endsWith(suffix),
  )

  const request = call?.[0]

  if (request === undefined || typeof request === 'string') return ''

  // Cloné : le corps est un flux, et le lire ici le consommerait pour de bon.
  return request.clone().text()
}

describe('DriverQueuePage', () => {
  it('demande d’abord les dossiers en attente de décision', async () => {
    mockFetch(page())

    render(<DriverQueuePage />)

    await waitFor(() => expect(calledUrls()[0]).toContain('status=PENDING'))
  })

  /**
   * Le cœur de l'écran : **valider reste impossible tant qu'une pièce manque**,
   * et l'écran dit lesquelles. Une liste de deux pièces ne se lit pas comme un
   * dossier incomplet tant qu'on ignore qu'il en faut quatre.
   */
  it('interdit de valider un dossier incomplet, et nomme ce qui manque', async () => {
    mockFetch(page(INCOMPLETE))

    render(<DriverQueuePage />)

    const approve = await screen.findByRole('button', { name: 'Valider' })

    expect(approve).toBeDisabled()
    /*
     * Le libellé est coupé par l'interpolation JSX, donc invisible à une
     * recherche de texte simple : on interroge le contenu de l'élément entier.
     */
    /*
     * Le libellé est coupé par l'interpolation JSX : on repère l'élément par son
     * début, puis on lit son contenu entier. Un matcher fonctionnel remonterait
     * tous les ancêtres et en trouverait plusieurs.
     */
    expect(screen.getByText(/Validation impossible/).textContent).toContain(
      'Carte grise, Assurance',
    )
  })

  it('autorise la validation dès que les quatre pièces sont là', async () => {
    mockFetch(page(COMPLETE))

    render(<DriverQueuePage />)

    expect(await screen.findByRole('button', { name: 'Valider' })).toBeEnabled()
  })

  it('valide par le dossier visé, et non par un autre', async () => {
    mockFetch(page(COMPLETE), jsonResponse({}), page())

    render(<DriverQueuePage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Valider' }))

    await waitFor(() =>
      expect(
        calledUrls().some((url) => url.endsWith('/v1/admin/drivers/7/approve')),
      ).toBe(true),
    )
  })

  /**
   * Le motif part avec le refus : c'est le chauffeur qui le lit, et un refus
   * sans raison le laisse redéposer le même dossier.
   */
  it('envoie le motif saisi avec le refus', async () => {
    mockFetch(page(COMPLETE), jsonResponse({}), page())

    render(<DriverQueuePage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Refuser' }))
    await userEvent.type(screen.getByRole('textbox'), 'Permis illisible')
    await userEvent.click(screen.getByRole('button', { name: 'Refuser le dossier' }))

    /*
     * **Le corps voyage sur la `Request`, pas dans `init`.** `openapi-fetch`
     * construit une `Request` et appelle `fetch(request)` : chercher le corps
     * dans le second argument ne trouve rien — la même surprise que le signal
     * d'annulation, qui avait déjà coûté une correction côté client.
     */
    await waitFor(() =>
      expect(sentBodyTo('/reject')).resolves.toContain('Permis illisible'),
    )
  })

  it('dit qu’il n’y a rien à instruire plutôt que de rester vide', async () => {
    mockFetch(page())

    render(<DriverQueuePage />)

    expect(
      await screen.findByText('Aucun dossier n’attend de décision.'),
    ).toBeInTheDocument()
  })

  /**
   * Une erreur d'API ne doit pas se lire comme une file vide : les deux écrans
   * seraient identiques, et personne ne saurait s'il faut réessayer ou passer à
   * autre chose.
   */
  it('montre l’échec au lieu de le taire', async () => {
    mockFetch(
      jsonResponse({ code: 'FORBIDDEN', message: 'Permission insuffisante.' }, 403),
    )

    render(<DriverQueuePage />)

    /*
     * Le libellé vient de `@motoboy/shared`, et sa langue est celle **choisie par
     * l'utilisateur** — épinglée au français par le harnais. On compare donc à la
     * même source de vérité plutôt qu'à une chaîne codée en dur.
     *
     * Ce test lisait `navigator.language` jusqu'ici, et passait pour une mauvaise
     * raison : `describeError` figeait alors la langue du navigateur au
     * chargement du module et ignorait le sélecteur. Les deux se trompaient de
     * concert, ce qui les faisait s'accorder.
     */
    expect(
      await screen.findByText(errorLabel('FORBIDDEN', resolveLocale(i18next.language))),
    ).toBeInTheDocument()
  })
  /**
   * **On approuvait sans pouvoir lire.**
   *
   * Ces pastilles ne disaient que la présence d'une pièce, parce que l'API ne
   * rendait que des types : le fichier partait au stockage et aucun endpoint ne
   * le rouvrait. Cet écran décide de mettre un inconnu au volant avec des
   * passagers — le permis doit s'ouvrir depuis là.
   */
  it('ouvre chaque pièce déposée, dans un onglet', async () => {
    mockFetch(page(COMPLETE))

    render(<DriverQueuePage />)

    const permis = await screen.findByRole('link', { name: /Permis/ })

    expect(permis).toHaveAttribute(
      'href',
      'https://api.test/v1/documents/driver/1?expires=1&signature=abc',
    )
    // Nouvel onglet : la décision se prend en gardant la file ouverte derrière.
    expect(permis).toHaveAttribute('target', '_blank')
  })

  /** Une pièce absente n'est pas un lien mort : il n'y a rien à ouvrir. */
  it('n’offre aucun lien pour une pièce manquante', async () => {
    mockFetch(page(INCOMPLETE))

    render(<DriverQueuePage />)

    // Le permis est là et s'ouvre ; l'assurance manque et n'est donc pas un
    // lien — pas un lien mort, pas de lien du tout.
    await screen.findByRole('link', { name: /Permis/ })

    expect(screen.queryByRole('link', { name: /Assurance/ })).toBeNull()
  })
})
