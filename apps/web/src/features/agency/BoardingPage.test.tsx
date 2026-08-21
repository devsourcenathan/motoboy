import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render, sentRequest } from '../../test/render'
import { BoardingPage } from './BoardingPage'

/**
 * L'embarquement vu du bureau.
 *
 * Le scan se fait sur le quai, depuis la PWA. Ici on **complète et on contrôle** :
 * qui est monté, qui manque. Les tests portent sur ce que la validation manuelle
 * envoie, puisque c'est elle qui marque un billet consommé.
 */
const trip = {
  reference: 'TR-ABC123',
  origin_station: { city: 'Douala' },
  destination_station: { city: 'Bafoussam' },
  departure_at: '2026-08-20T08:00:00Z',
}

const routes = (extra: Record<string, () => Response> = {}) => ({
  '/boarding-list': () =>
    jsonResponse({
      trip,
      generated_at: '2026-08-20T07:00:00Z',
      passengers: [
        {
          ticket_reference: 'TCK-111111',
          passenger_name: 'Awa Nkeng',
          seat_label: 'A1',
          status: 'VALID',
        },
      ],
    }),
  '/agency/trips': () => jsonResponse({ data: [trip] }),
  /*
   * `extra` en **dernier** : posé en premier, il se faisait écraser par les
   * routes par défaut, si bien qu'un test qui croyait remplacer une réponse
   * obtenait l'autre — sans erreur, et en passant pour la mauvaise raison.
   */
  ...extra,
})

describe('BoardingPage', () => {
  /**
   * **Attendu ou embarqué, jamais autre chose.** L'agent lit cette colonne en
   * diagonale pendant que les gens montent : deux états et pas trois.
   */
  it('distingue qui est monté de qui est attendu', async () => {
    mockRoutes(routes())

    render(<BoardingPage />)

    await userEvent.selectOptions(await screen.findByLabelText(/Départ/), 'TR-ABC123')

    expect(await screen.findByText('Awa Nkeng')).toBeInTheDocument()
    expect(screen.getByText('Attendu')).toBeInTheDocument()
  })

  /**
   * **Le test qui compte.** Une validation saisie à la main part avec `MANUAL` et
   * non `SCAN` : la distinction sert à savoir, après coup, ce qui a été contrôlé
   * par le QR et ce qui a été recopié — et un billet recopié se conteste
   * autrement.
   */
  it('marque une validation manuelle comme telle', async () => {
    mockRoutes(
      routes({
        '/validations': () =>
          jsonResponse({
            results: [{ ticket_reference: 'TCK-111111', status: 'ACCEPTED' }],
          }),
      }),
    )

    render(<BoardingPage />)

    await userEvent.selectOptions(await screen.findByLabelText(/Départ/), 'TR-ABC123')
    await userEvent.type(await screen.findByLabelText(/Saisie manuelle/), 'TCK-111111')
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))

    expect(
      await sentRequest((request) => request.url.includes('/validations')),
    ).toMatchObject({
      validations: [expect.objectContaining({ method: 'MANUAL' })],
    })

    /*
     * **Le résultat est lu, pas seulement envoyé.**
     *
     * Ce test s'arrêtait à la requête partie. L'écran plantait pourtant au
     * rendu suivant — il recevait la réponse d'un autre endpoint, `mockRoutes`
     * appariant par `includes` : `…/agency/trips/TR-ABC123/validations`
     * contient `/agency/trips`. Vitest le signalait en « unhandled error », le
     * test passait quand même, et seule la CI l'a fait échouer.
     */
    expect(await screen.findByText(/Billet validé/)).toBeInTheDocument()
  })
})
