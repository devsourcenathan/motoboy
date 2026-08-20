import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { unwrap } from '@motoboy/api-client'
import { api } from '../../lib/api'
import { queryKeys } from '../../lib/queryKeys'

/**
 * Les appels de l'administration.
 *
 * Rassemblés ici plutôt qu'éparpillés dans les écrans : c'est l'invalidation du
 * cache qui l'impose. Approuver une agence la déplace d'une file vers une autre,
 * change le tableau de bord et écrit au journal d'audit — trois caches qu'un
 * écran ne pense pas à invalider, et qui restent alors périmés sous les yeux de
 * celui qui vient d'agir.
 */

export type AgencyStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'

export function useAgencies(status: AgencyStatus) {
  return useQuery({
    queryKey: queryKeys.agencies(status),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/admin/agencies', { params: { query: { status } }, signal }),
      ),
  })
}

/**
 * La fiche d'une agence.
 *
 * `enabled` plutôt qu'un appel conditionnel : le panneau se ferme en remettant
 * la référence à `null`, et une requête lancée sur `null` demanderait à l'API
 * une agence nommée « null ».
 */
export function useAgency(reference: string | null) {
  return useQuery({
    queryKey: queryKeys.agency(reference ?? ''),
    enabled: reference !== null,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/admin/agencies/{reference}', {
          params: { path: { reference: reference ?? '' } },
          signal,
        }),
      ),
  })
}

/**
 * Admettre une agence, ou la refuser.
 *
 * **Le refus exige un motif, l'admission non.** Ce n'est pas une asymétrie
 * gratuite : celui qu'on refuse doit savoir quoi corriger pour revenir, alors
 * qu'une admission ne laisse rien à expliquer.
 */
export function useDecideAgency() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      reference,
      decision,
      reason,
    }: {
      reference: string
      decision: 'approve' | 'reject'
      reason?: string
    }) => {
      const params = { path: { reference } }

      if (decision === 'approve') {
        return unwrap(
          await api.POST('/v1/admin/agencies/{reference}/approve', { params }),
        )
      }

      return unwrap(
        await api.POST('/v1/admin/agencies/{reference}/reject', {
          params,
          body: { reason: reason ?? '' },
        }),
      )
    },
    onSuccess: () => {
      // Toutes les files, pas seulement celle affichée : la décision fait
      // changer l'agence de file, et la file d'arrivée serait périmée.
      void queryClient.invalidateQueries({ queryKey: ['agencies'] })
      void queryClient.invalidateQueries({ queryKey: ['agency'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() })
    },
  })
}

/** Les conditions commerciales — commission, reversements, annulation. */
export function useUpdateTerms(reference: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (changes: Record<string, unknown>) =>
      unwrap(
        await api.PATCH('/v1/admin/agencies/{reference}/commercial-terms', {
          params: { path: { reference } },
          body: changes as never,
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.agency(reference) }),
  })
}

/**
 * Une écriture manuelle au grand livre d'une agence.
 *
 * Le montant est signé — un crédit corrige à la hausse, un débit à la baisse —
 * et zéro est refusé par l'API : une écriture qui ne déplace rien n'est pas une
 * correction, c'est une note.
 */
export function useAdjustLedger(reference: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: { amount: number; description: string }) =>
      unwrap(
        await api.POST('/v1/admin/agencies/{reference}/ledger-adjustments', {
          params: { path: { reference } },
          body: body as never,
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.agency(reference) }),
  })
}

// ── Réglages de la plateforme ────────────────────────────────────────────────

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings(),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/admin/settings', { signal })),
  })
}

export function useUpdateRideCommission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: { commission_bps: number }) =>
      unwrap(
        await api.PATCH('/v1/admin/settings/ride-commission', { body: body as never }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings() }),
  })
}

export function useUpdateIdDocumentPolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: {
      id_document_mode: string
      id_document_required: boolean
    }) =>
      unwrap(await api.PATCH('/v1/admin/settings/id-documents', { body: body as never })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings() }),
  })
}

// ── Modération du référentiel ────────────────────────────────────────────────

export function useStations() {
  return useQuery({
    queryKey: queryKeys.stations(),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/admin/stations', { signal })),
  })
}

export function useModerateStation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      decision,
      reason,
    }: {
      id: number
      decision: 'KEEP' | 'DEACTIVATE'
      reason?: string
    }) =>
      unwrap(
        await api.POST('/v1/admin/stations/{id}/moderate', {
          params: { path: { id } },
          body: { decision, ...(reason === undefined ? {} : { reason }) } as never,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stations() }),
  })
}

export function useCityRequests() {
  return useQuery({
    queryKey: queryKeys.cityRequests(),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/admin/city-requests', { signal })),
  })
}

/**
 * Répondre à une agence qui demande une ville absente.
 *
 * Approuver demande de désigner la ville existante qui répond à la demande :
 * l'agence a écrit un nom libre, et c'est ici qu'on le rattache au référentiel.
 * Sans ce rattachement, on aurait deux Douala.
 */
export function useResolveCityRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      decision,
      cityId,
      note,
    }: {
      id: number
      decision: 'APPROVE' | 'REJECT'
      cityId?: number
      note?: string
    }) =>
      unwrap(
        await api.POST('/v1/admin/city-requests/{id}/resolve', {
          params: { path: { id } },
          body: {
            decision,
            ...(cityId === undefined ? {} : { city_id: cityId }),
            ...(note === undefined ? {} : { note }),
          } as never,
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.cityRequests() }),
  })
}

// ── Tableau de bord et journal ───────────────────────────────────────────────

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/v1/admin/dashboard', { signal })),
  })
}

export function useAuditLogs(action: string, page: number) {
  return useQuery({
    queryKey: queryKeys.auditLogs(action, page),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/admin/audit-logs', {
          params: { query: { ...(action === '' ? {} : { action }), page } },
          signal,
        }),
      ),
  })
}
