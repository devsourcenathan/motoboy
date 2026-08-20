import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render, sentRequest } from '../../test/render'
import { CommercialTerms } from './CommercialTerms'

/**
 * Les conditions commerciales.
 *
 * Quatorze champs dont trois changent de sens selon un autre. Les tests portent
 * exactement là-dessus — ce sont les seules erreurs que l'écran peut commettre
 * sans que rien ne se voie, et elles se paient en argent.
 */
const terms = {
  commission_type: 'PERCENTAGE',
  commission_value: 500,
  fee_bearer: 'PLATFORM',
  payout_delay_hours: 24,
  payout_frequency: 'WEEKLY',
  payout_day: 1,
  payout_minimum_amount: 10000,
  counter_sale_commission_enabled: false,
  counter_sale_sms_enabled: true,
  cancellation_deadline_hours: 12,
  cancellation_fee_type: 'PERCENTAGE',
  cancellation_fee_value: 1000,
  hold_duration_minutes: 15,
  online_sales_cutoff_minutes: 60,
}

const mount = () => {
  mockRoutes({ '/commercial-terms': () => jsonResponse(terms) })

  return render(<CommercialTerms reference="AG-001" terms={terms} />)
}

describe('CommercialTerms', () => {
  /**
   * **Le test qui compte le plus.** Toutes les règles de l'API sont en
   * `sometimes` : renvoyer l'objet entier écraserait ce qu'un autre
   * administrateur vient de modifier entre le chargement de la page et
   * l'enregistrement. Seul ce qui a bougé doit partir.
   */
  it('ne transmet que les champs modifiés', async () => {
    mount()

    const field = screen.getByLabelText(/Durée de tenue des places/)
    await userEvent.clear(field)
    await userEvent.type(field, '20')

    await userEvent.click(
      screen.getByRole('button', { name: 'Enregistrer les conditions' }),
    )

    const sent = (await sentRequest((request) =>
      request.url.endsWith('/commercial-terms'),
    )) as Record<string, unknown>

    expect(sent).toEqual({ hold_duration_minutes: 20 })
    // La commission n'a pas bougé : elle ne doit pas figurer dans l'envoi.
    expect(sent).not.toHaveProperty('commission_value')
  })

  it('n’offre rien à enregistrer tant que rien n’a changé', () => {
    mount()

    expect(
      screen.getByRole('button', { name: 'Enregistrer les conditions' }),
    ).toBeDisabled()
    expect(screen.getByText('Aucune modification.')).toBeInTheDocument()
  })

  /**
   * **`payout_day` change de sens avec la fréquence.** Jour du mois en mensuel,
   * jour de la semaine en hebdomadaire — et l'API accepte 1 à 28 dans les deux
   * cas. Saisir 15 en hebdomadaire passerait la validation puis serait ramené à
   * dimanche par le calcul des reversements, sans que rien ne le signale. D'où
   * une liste de jours plutôt qu'un champ numérique.
   */
  it('propose des jours de la semaine en hebdomadaire, un quantième en mensuel', async () => {
    mount()

    expect(screen.getByLabelText('Jour de la semaine')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Mercredi' })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Fréquence'), 'MONTHLY')

    expect(screen.getByLabelText(/Jour du mois/)).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Mercredi' })).not.toBeInTheDocument()
  })

  /**
   * `commission_value` vaut des points de base ou des francs selon le mode. Le
   * même 500 se lit « 5 % » ou « 500 F » — deux choses sans rapport, et l'écran
   * doit dire laquelle.
   */
  it('interprète la valeur selon le mode de calcul', async () => {
    mount()

    expect(screen.getByLabelText(/Commission, en points de base/)).toBeInTheDocument()
    expect(screen.getByText(/5\.00 %/)).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Mode de calcul'), 'FIXED')

    expect(screen.getByLabelText(/Commission, montant en francs/)).toBeInTheDocument()
  })

  /**
   * Le plafond des frais d'annulation n'est pas une borne technique : une agence
   * ne peut pas rendre une réservation intégralement non remboursable à
   * l'intérieur de sa propre fenêtre d'annulation. L'écran le dit.
   */
  it('annonce le plafond de 50 % sur les frais d’annulation', () => {
    mount()

    expect(screen.getByText(/plafonné à 50 %/)).toBeInTheDocument()
  })

  /**
   * Le passager n'est pas une option pour porter les frais d'agrégateur : le prix
   * affiché divergerait du prix guichet, et un comparateur qui n'affiche pas le
   * vrai prix perd sa raison d'être.
   */
  it('n’offre pas de faire porter les frais au passager', () => {
    mount()

    const options = screen
      .getByLabelText(/Qui porte les frais/)
      .querySelectorAll('option')

    expect([...options].map((option) => option.textContent)).toEqual([
      'La plateforme',
      'L’agence',
    ])
  })
})
