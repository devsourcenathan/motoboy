import { emptyForm, setPassenger, toRequestBody, validate } from './passengerForm'

describe('emptyForm', () => {
  it('crée un formulaire par passager', () => {
    expect(emptyForm([], 3).passengers).toHaveLength(3)
  })

  /**
   * Les places sont attribuées **dans l'ordre de sélection**. Le passager peut
   * les avoir choisies dans n'importe quel ordre : le sien fait foi.
   */
  it('associe les places dans l’ordre reçu', () => {
    const form = emptyForm([12, 7], 2)

    expect(form.passengers.map((p) => p.seatId)).toEqual([12, 7])
  })

  /** En mode capacité, il n'y a pas de siège à attribuer. */
  it('laisse les places nulles quand il n’y en a pas', () => {
    expect(emptyForm([], 2).passengers.map((p) => p.seatId)).toEqual([null, null])
  })
})

describe('validate', () => {
  const filled = {
    passengers: [{ firstName: 'Awa', lastName: 'Nkeng', seatId: 1 }],
    contactPhone: '+237690000001',
  }

  it('accepte un formulaire complet', () => {
    expect(validate(filled)).toBeNull()
  })

  /**
   * Un nom vide qui part quand même fait perdre au passager la place qu'il
   * tenait, le temps que le serveur refuse.
   */
  it('refuse un nom manquant, même sur un seul passager', () => {
    expect(
      validate({
        ...filled,
        passengers: [
          { firstName: 'Awa', lastName: 'Nkeng', seatId: 1 },
          { firstName: '', lastName: 'Mbarga', seatId: 2 },
        ],
      }),
    ).toBe('NAMES_MISSING')
  })

  it('refuse un nom fait d’espaces', () => {
    expect(
      validate({
        ...filled,
        passengers: [{ firstName: '  ', lastName: 'Nkeng', seatId: 1 }],
      }),
    ).toBe('NAMES_MISSING')
  })

  /** Le billet et les alertes de départ partent sur ce numéro. */
  it('exige un contact', () => {
    expect(validate({ ...filled, contactPhone: '  ' })).toBe('PHONE_MISSING')
  })
})

describe('setPassenger', () => {
  it('ne modifie que celui visé', () => {
    const form = emptyForm([1, 2], 2)
    const updated = setPassenger(form, 1, { firstName: 'Awa' })

    expect(updated.passengers[0]?.firstName).toBe('')
    expect(updated.passengers[1]?.firstName).toBe('Awa')
    expect(updated.passengers[1]?.seatId).toBe(2)
  })
})

describe('toRequestBody', () => {
  it('nettoie les espaces avant d’envoyer', () => {
    const body = toRequestBody(
      {
        passengers: [{ firstName: ' Awa ', lastName: ' Nkeng ', seatId: 5 }],
        contactPhone: ' +237690000001 ',
      },
      'TR-001',
    )

    expect(body.passengers[0]).toEqual({
      first_name: 'Awa',
      last_name: 'Nkeng',
      seat_id: 5,
    })
    expect(body.contact_phone).toBe('+237690000001')
  })

  /**
   * `seat_id` est ignoré en mode capacité : l'envoyer à `null` ferait échouer
   * la validation du serveur, qui refuse un siège sur un véhicule qui n'en
   * numérote pas.
   */
  it('omet la place quand il n’y en a pas', () => {
    const body = toRequestBody(
      {
        passengers: [{ firstName: 'Awa', lastName: 'Nkeng', seatId: null }],
        contactPhone: '+237',
      },
      'TR-001',
    )

    expect(body.passengers[0]).not.toHaveProperty('seat_id')
  })
})
