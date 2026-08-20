import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockRoutes, render } from '../../test/render'
import { AuditLogPage } from './AuditLogPage'

/**
 * Le journal d'audit.
 *
 * Il n'existe que pour répondre à une question : **qui a changé quoi, et depuis
 * quelle valeur.** Un journal qui dit « commission modifiée » sans dire de
 * combien ne répond pas.
 */
const entry = (over: Record<string, unknown> = {}) => ({
  id: 1,
  action: 'commercial_terms.updated',
  auditable_type: 'Agency',
  auditable_id: 3,
  user_id: 9,
  old_values: { commission_value: 250, fee_bearer: 'PLATFORM' },
  new_values: { commission_value: 900, fee_bearer: 'PLATFORM' },
  created_at: '2026-08-19T10:00:00Z',
  ...over,
})

describe('AuditLogPage', () => {
  /**
   * **Le test qui compte.** Seuls les champs qui ont bougé sont montrés. Recopier
   * l'objet entier noierait la modification au milieu de valeurs identiques — et
   * c'est la modification qu'on est venu chercher.
   */
  it('ne montre que ce qui a changé, avec l’avant et l’après', async () => {
    mockRoutes({ '/admin/audit-logs': () => jsonResponse({ data: [entry()] }) })

    render(<AuditLogPage />)

    expect(await screen.findByText(/commission_value/)).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getByText('900')).toBeInTheDocument()
    // `fee_bearer` n'a pas bougé : le montrer diluerait ce qui a bougé.
    expect(screen.queryByText(/fee_bearer/)).not.toBeInTheDocument()
  })

  /**
   * Une valeur absente n'est pas une chaîne vide : « ∅ → 900 » se lit comme une
   * mise en place, « → 900 » comme un affichage cassé.
   */
  it('nomme l’absence plutôt que de laisser un vide', async () => {
    mockRoutes({
      '/admin/audit-logs': () =>
        jsonResponse({
          data: [entry({ old_values: null, new_values: { commission_value: 900 } })],
        }),
    })

    render(<AuditLogPage />)

    expect(await screen.findByText('∅')).toBeInTheDocument()
  })

  it('dit qu’aucune action ne porte ce nom plutôt que de rester vide', async () => {
    mockRoutes({ '/admin/audit-logs': () => jsonResponse({ data: [] }) })

    render(<AuditLogPage />)

    expect(await screen.findByText('Aucune entrée')).toBeInTheDocument()
  })
})
