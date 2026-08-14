import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { newIdempotencyKey, unwrap, type Payment } from '@motoboy/api-client'
import { api } from '../../../shared/api/client'
import { queryKeys } from '../../../shared/api/queryKeys'
import { POLL_INTERVAL_MS, shouldPoll, type PaymentForm } from '../model/payment'

/**
 * Lance un encaissement.
 *
 * **Aucun succès synchrone.** La réponse est `PENDING` ou `PROCESSING` : le
 * passager reçoit une sollicitation sur son téléphone et doit saisir son code.
 * C'est le webhook qui tranche, et l'écran attend ce verdict.
 *
 * ⚠️ **La clé d'idempotence se renouvelle à chaque tentative, contrairement à
 * celle de la réservation.** Une réservation rejouée doit rendre la même
 * réservation ; une tentative de paiement, elle, est *une autre tentative* — le
 * contrat prévoit explicitement plusieurs paiements par réservation, dont un
 * seul aboutit. Réutiliser la clé ferait renvoyer l'échec précédent au lieu
 * d'essayer à nouveau, et le passager qui recompose correctement son code
 * verrait le même refus.
 */
export function useInitiatePayment(bookingReference: string) {
  const queryClient = useQueryClient()
  const [reference, setReference] = useState<string | null>(null)
  const attemptKey = useRef<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (form: PaymentForm) => {
      attemptKey.current = newIdempotencyKey()

      const response = await api.POST('/v1/bookings/{reference}/payments', {
        params: {
          path: { reference: bookingReference },
          header: { 'Idempotency-Key': attemptKey.current },
        },
        body: {
          method: 'MOBILE_MONEY',
          ...(form.operator === null ? {} : { operator: form.operator }),
          payer_phone: form.payerPhone.trim(),
        },
      })

      return unwrap(response) as Payment
    },
    onSuccess: (payment) => {
      setReference(payment.reference)
      queryClient.setQueryData(queryKeys.payment(payment.reference), payment)
    },
  })

  /** Repart d'un formulaire vierge après un échec, sans quitter l'écran. */
  const retry = useCallback(() => {
    setReference(null)
    mutation.reset()
  }, [mutation])

  return { ...mutation, reference, retry }
}

/**
 * Suit le sort d'un paiement.
 *
 * L'interrogation s'arrête d'elle-même dès que le prestataire a tranché : la
 * laisser tourner sur un paiement abouti viderait la batterie d'un téléphone
 * pour redemander une réponse qui ne changera plus.
 */
export function usePaymentStatus(reference: string | null) {
  return useQuery<Payment>({
    queryKey: reference ? queryKeys.payment(reference) : queryKeys.payment('none'),
    enabled: reference !== null,
    refetchInterval: (query) =>
      shouldPoll(query.state.data?.status) ? POLL_INTERVAL_MS : false,
    queryFn: async ({ signal }) => {
      const response = await api.GET('/v1/payments/{reference}', {
        params: { path: { reference: reference! } },
        signal,
      })

      return unwrap(response) as Payment
    },
  })
}
