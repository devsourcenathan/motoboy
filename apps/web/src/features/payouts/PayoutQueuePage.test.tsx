import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Payout } from '@motoboy/api-client/types'
import { calledUrls, jsonResponse, mockFetch, render } from '../../test/render'
import { PayoutQueuePage } from './PayoutQueuePage'

/**
 * La file des reversements.
 *
 * **C'est l'écran qui fait partir de l'argent réel.** Un virement Mobile Money
 * mal dirigé ne se récupère pas, et rien ne testait cette page — ni qu'elle
 * nomme son bénéficiaire, ni qu'elle sépare la validation de l'envoi.
 */
const money = (amount: number) => ({ amount, currency: 'XAF' })

const PENDING: Payout = {
  reference: 'PYT-Q6D3NG',
  agency_id: null,
  payee: { kind: 'DRIVER', name: 'Jean Kamdem', phone: '+237690000101' },
  destination: {
    operator: 'MTN',
    account_name: 'Jean Kamdem',
    masked_number: '••••••900',
    verified: true,
  },
  period_start: '2026-08-18',
  period_end: '2026-08-18',
  status: 'PENDING_VALIDATION',
  gross: money(8000),
  commission: money(800),
  refunds: money(0),
  adjustments: money(0),
  net: money(7200),
  approved_at: null,
  paid_at: null,
  provider_reference: null,
  failure_reason: null,
}

function page(...rows: Payout[]) {
  return jsonResponse({
    data: rows,
    meta: { page: 1, per_page: 20, total: rows.length, last_page: 1 },
  })
}

describe('PayoutQueuePage', () => {
  /**
   * Le nom d'abord : c'est la question que se pose celui qui valide. Un montant
   * sans destinataire est exactement ce que cette page affichait avant qu'on la
   * corrige.
   */
  it('nomme le bénéficiaire et la destination', async () => {
    mockFetch(page(PENDING))

    render(<PayoutQueuePage />)

    /*
     * **Deux fois, et c'est voulu** : le nom du bénéficiaire et celui porté par
     * le compte Mobile Money. Les rapprocher à l'œil est tout l'objet du
     * contrôle — les afficher une seule fois priverait le validateur de la seule
     * vérification qu'il peut faire.
     */
    expect(await screen.findAllByText('Jean Kamdem')).toHaveLength(2)
    expect(screen.getByText('••••••900')).toBeInTheDocument()
    expect(screen.getByText(/Chauffeur/)).toBeInTheDocument()
  })

  /**
   * **Deux gestes, pas un.** Valider dit « ce montant est juste » ; envoyer fait
   * partir l'argent. Tant que le reversement attend validation, aucun bouton ne
   * doit pouvoir déclencher un virement.
   */
  it('ne propose pas d’envoyer avant d’avoir validé', async () => {
    mockFetch(page(PENDING))

    render(<PayoutQueuePage />)

    expect(await screen.findByRole('button', { name: 'Valider le montant' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Envoyer' })).not.toBeInTheDocument()
  })

  it('valide par la référence affichée', async () => {
    mockFetch(page(PENDING), jsonResponse(PENDING), page(PENDING))

    render(<PayoutQueuePage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Valider le montant' }))

    await waitFor(() =>
      expect(
        calledUrls().some((url) => url.endsWith('/v1/admin/payouts/PYT-Q6D3NG/approve')),
      ).toBe(true),
    )
  })

  /**
   * L'envoi n'a pas de contraire : il demande confirmation, et la confirmation
   * répète **à qui** et **sur quel numéro**, parce que c'est là qu'une erreur se
   * voit encore.
   */
  it('demande confirmation avant d’envoyer, en répétant la destination', async () => {
    const approved: Payout = { ...PENDING, status: 'APPROVED', approved_at: '2026-08-18T10:00:00Z' }

    mockFetch(page(approved))

    render(<PayoutQueuePage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Envoyer' }))

    const confirmation = screen.getByText(/Ce\s+virement ne se rattrape pas/)

    expect(confirmation.textContent).toContain('Jean Kamdem')
    expect(confirmation.textContent).toContain('••••••900')
  })

  /**
   * L'en-tête d'idempotence est obligatoire côté serveur : sans elle un
   * décaissement rejoué partirait deux fois. Elle doit accompagner l'envoi.
   */
  it('envoie avec une clé d’idempotence', async () => {
    const approved: Payout = { ...PENDING, status: 'APPROVED' }

    mockFetch(page(approved), jsonResponse(approved), page(approved))

    render(<PayoutQueuePage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Envoyer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer l’argent' }))

    const mock = fetch as unknown as { mock: { calls: [Request | string][] } }

    await waitFor(() => {
      const send = mock.mock.calls
        .map(([input]) => input)
        .find((input) => typeof input !== 'string' && input.url.endsWith('/send'))

      expect(send).toBeDefined()
      expect((send as Request).headers.get('Idempotency-Key')).toBeTruthy()
    })
  })

  /**
   * `BuildPayout` exclut les comptes non vérifiés. En voir un ici signifie que
   * quelque chose a changé après construction — il vaut mieux le dire que le
   * laisser partir.
   */
  it('signale une destination non vérifiée', async () => {
    const risky: Payout = {
      ...PENDING,
      destination: { ...PENDING.destination!, verified: false },
    }

    mockFetch(page(risky))

    render(<PayoutQueuePage />)

    expect(await screen.findByText('compte non vérifié')).toBeInTheDocument()
  })
})
