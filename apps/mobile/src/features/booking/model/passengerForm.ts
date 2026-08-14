export interface PassengerInput {
  readonly firstName: string
  readonly lastName: string
  /** Renseigné en mode `SEATED`, absent en mode `CAPACITY`. */
  readonly seatId: number | null
}

export interface BookingForm {
  readonly passengers: readonly PassengerInput[]
  readonly contactPhone: string
}

export type BookingFormError = 'NAMES_MISSING' | 'PHONE_MISSING' | null

/**
 * Un formulaire par passager, plus un contact.
 *
 * Le contact reçoit le billet et les alertes de départ : c'est lui, et non le
 * premier passager, qui compte — une réservation se fait couramment **pour
 * quelqu'un d'autre**, et envoyer le billet au voyageur plutôt qu'à l'acheteur
 * le laisserait sans rien.
 */
export function emptyForm(seatIds: readonly number[], passengers: number): BookingForm {
  return {
    passengers: Array.from({ length: passengers }, (_, index) => ({
      firstName: '',
      lastName: '',
      // Les places sont attribuées dans l'ordre de sélection. Le passager peut
      // les avoir choisies dans n'importe quel ordre : celui-ci fait foi, et
      // rien ne justifie de le réordonner à sa place.
      seatId: seatIds[index] ?? null,
    })),
    contactPhone: '',
  }
}

export function setPassenger(
  form: BookingForm,
  index: number,
  patch: Partial<PassengerInput>,
): BookingForm {
  return {
    ...form,
    passengers: form.passengers.map((passenger, i) =>
      i === index ? { ...passenger, ...patch } : passenger,
    ),
  }
}

/**
 * Ce qui empêche d'envoyer.
 *
 * Vérifié **pour éviter un aller-retour**, jamais pour décider : le serveur
 * reste seul juge de ce qu'il accepte (§29). Un formulaire qui laisse partir un
 * nom vide fait perdre au passager la place qu'il tenait, le temps du refus.
 */
export function validate(form: BookingForm): BookingFormError {
  const named = form.passengers.every(
    (passenger) => passenger.firstName.trim() !== '' && passenger.lastName.trim() !== '',
  )

  if (!named) return 'NAMES_MISSING'
  if (form.contactPhone.trim() === '') return 'PHONE_MISSING'

  return null
}

/** @returns le corps attendu par `POST /v1/bookings`. */
export function toRequestBody(form: BookingForm, tripReference: string) {
  return {
    trip_reference: tripReference,
    passengers: form.passengers.map((passenger) => ({
      first_name: passenger.firstName.trim(),
      last_name: passenger.lastName.trim(),
      ...(passenger.seatId === null ? {} : { seat_id: passenger.seatId }),
    })),
    contact_phone: form.contactPhone.trim(),
  }
}
