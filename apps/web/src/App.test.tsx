import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from './App'
import { session } from './lib/api'
import { jsonResponse, mockFetch, render } from './test/render'

/**
 * Le garde de session.
 *
 * Il ne protège rien — c'est l'API qui refuse, et elle seule fait autorité. Il
 * évite d'afficher des pages qui échoueraient, et c'est déjà beaucoup : sans
 * lui, quelqu'un sans droits voyait un back-office vide en croyant qu'il était
 * cassé.
 */
const me = (roles: string[]) => ({
  id: 1,
  phone: '+237690000999',
  email: null,
  first_name: 'Ada',
  last_name: 'Moderatrice',
  phone_verified: true,
  locale: 'fr',
  roles,
})

describe('RequireSession', () => {
  it('renvoie à la connexion quand aucune session n’existe', async () => {
    render(<AppRoutes />, { route: '/admin/drivers' })

    expect(
      await screen.findByRole('button', { name: 'Recevoir un code' }),
    ).toBeInTheDocument()
  })

  /**
   * Un compte sans droits n'est pas un compte absent : le renvoyer à la
   * connexion le ferait tourner en boucle, puisqu'il est déjà connecté.
   */
  it('dit qu’un compte sans droits n’a pas accès, sans le déconnecter', async () => {
    await session.start('jeton-passager')
    mockFetch(jsonResponse(me(['PASSENGER'])))

    render(<AppRoutes />, { route: '/admin/drivers' })

    expect(await screen.findByText('Espace réservé')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Recevoir un code' }),
    ).not.toBeInTheDocument()
  })

  it('laisse entrer un administrateur', async () => {
    await session.start('jeton-admin')
    mockFetch(
      jsonResponse(me(['ADMIN'])),
      jsonResponse({ data: [], meta: { page: 1, per_page: 20, total: 0, last_page: 1 } }),
    )

    render(<AppRoutes />, { route: '/admin/drivers' })

    expect(
      await screen.findByRole('heading', { name: 'Dossiers de chauffeur' }),
    ).toBeInTheDocument()
  })

  /**
   * La file des dossiers reste la page d'accueil **de l'administration** : c'est
   * ce qui attend une décision.
   */
  it('ouvre sur la file des dossiers', async () => {
    await session.start('jeton-admin')
    mockFetch(
      jsonResponse(me(['SUPER_ADMIN'])),
      jsonResponse({ data: [], meta: { page: 1, per_page: 20, total: 0, last_page: 1 } }),
    )

    render(<AppRoutes />, { route: '/admin' })

    expect(
      await screen.findByRole('heading', { name: 'Dossiers de chauffeur' }),
    ).toBeInTheDocument()
  })

  /**
   * **La racine appartient au public.** La recherche fonctionne sans compte
   * (§35) ; y exiger une session perdrait les gens sur une question qu'ils ne se
   * posaient pas, et c'est le premier écran du produit.
   */
  it('ouvre la recherche publique à la racine, sans session', async () => {
    mockFetch(jsonResponse({ data: [] }))

    render(<AppRoutes />, { route: '/' })

    expect(
      await screen.findByRole('heading', { name: /Comparez les départs/ }),
    ).toBeInTheDocument()
  })
})
