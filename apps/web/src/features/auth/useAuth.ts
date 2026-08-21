import { useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { unwrap, type User } from '@motoboy/api-client'
import { api, session } from '../../lib/api'
import { queryKeys } from '../../lib/queryKeys'

/**
 * La session courante, ou rien.
 *
 * Sert de garde au routage : le jeton peut avoir été révoqué côté serveur, et
 * seul un appel le dit. Un `401` purge la session par le client d'API.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me(),
    retry: false,
    queryFn: async ({ signal }) => {
      const token = await session.token()

      if (token === null) return null

      const response = await api.GET('/v1/me', { signal })

      return unwrap(response) as User
    },
  })
}

/**
 * Demande un code.
 *
 * Pas d'inscription ici : un compte d'administration ne se crée pas depuis le
 * back-office. Il est créé en base, puis se connecte — ouvrir l'inscription
 * ferait de cette page la porte d'entrée de la plateforme.
 */
export function useRequestOtp() {
  return useMutation({
    mutationFn: async (phone: string) =>
      unwrap(await api.POST('/v1/auth/login', { body: { phone } })),
  })
}

export function useVerifyOtp() {
  const queryClient = useQueryClient()

  return useMutation({
    /*
     * **Le motif accompagne le code, et il n'est pas toujours `LOGIN`.**
     *
     * Une candidature d'agence émet un code de `REGISTRATION` : le figer ici
     * ferait refuser la vérification d'un compte qui vient d'être créé, avec un
     * message parlant d'un code invalide alors qu'il est parfaitement bon.
     */
    mutationFn: async ({
      phone,
      code,
      purpose = 'LOGIN',
    }: {
      phone: string
      code: string
      purpose?: 'LOGIN' | 'REGISTRATION'
    }) => {
      const result = unwrap(
        await api.POST('/v1/auth/otp/verify', {
          body: { phone, code, purpose },
        }),
      ) as { token: string; user: User }

      await session.start(result.token)

      return result
    },
    onSuccess: (result) => {
      // Écrit plutôt qu'invalidé : le profil vient d'arriver dans la réponse, et
      // le relire serait un aller-retour pour une donnée déjà en main.
      queryClient.setQueryData(queryKeys.me(), result.user)
    },
  })
}

/**
 * Fermer la session.
 *
 * **La navigation est ici, et non chez l'appelant.** Elle y était nulle part :
 * la mutation révoquait le jeton, l'oubliait, vidait le cache — et l'écran
 * restait sur `/admin/…`. `queryClient.clear()` **retire** les requêtes sans en
 * relancer aucune, si bien que les observateurs déjà montés demeurent en
 * attente : le garde de session, faute de réponse, affichait « Vérification de
 * la session… » indéfiniment. On se croyait connecté jusqu'au premier clic.
 *
 * Où atterrir n'est pas une décision d'appelant : une session close mène à la
 * connexion, depuis l'espace agence comme depuis l'administration. Le laisser à
 * chacun garantit qu'un troisième appelant l'oubliera.
 *
 * `replace` : le retour arrière ne doit pas ramener dans un back-office dont
 * plus aucun appel n'aboutira.
 */
export function useSignOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async () => {
      /*
       * Le jeton est révoqué côté serveur **avant** d'être oublié ici : dans
       * l'ordre inverse, un échec réseau laisserait un jeton valide dans la
       * nature sans que personne ne puisse plus s'en servir pour le révoquer.
       */
      await api.POST('/v1/auth/logout', {})
      session.expire()
    },
    onSettled: () => {
      // Même en cas d'échec : l'utilisateur a demandé à partir.
      session.expire()

      /*
       * On navigue **avant** de vider le cache : l'inverse laisse le garde
       * rendre son écran d'attente sur une requête qui ne repartira jamais.
       */
      navigate('/sign-in', { replace: true })
      queryClient.clear()
    },
  })
}
