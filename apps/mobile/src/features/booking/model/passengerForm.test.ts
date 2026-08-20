import {
  emptyForm,
  prefill,
  setPassenger,
  toRequestBody,
  validate,
} from './passengerForm'

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
    idNumber: '',
    idPath: null,
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
        idNumber: '',
        idPath: null,
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
        idNumber: '',
        idPath: null,
      },
      'TR-001',
    )

    expect(body.passengers[0]).not.toHaveProperty('seat_id')
  })
})

describe('prefill', () => {
  const blank = emptyForm([5], 2)

  it('renseigne le premier passager et le contact', () => {
    const form = prefill(blank, {
      firstName: 'Awa',
      lastName: 'Nkeng',
      phone: '+237690000001',
    })

    expect(form.passengers[0]).toMatchObject({ firstName: 'Awa', lastName: 'Nkeng' })
    expect(form.contactPhone).toBe('+237690000001')
  })

  /**
   * Le compte et la mémoire arrivent après le premier rendu. Sans cette
   * condition, ils effaceraient ce que le passager vient de taper pendant
   * qu'ils chargeaient — un champ qui se vide sous les doigts.
   */
  it('n’écrase pas une saisie en cours', () => {
    const typed = setPassenger({ ...blank, contactPhone: '+237699999999' }, 0, {
      firstName: 'Jean',
    })

    const form = prefill(typed, {
      firstName: 'Awa',
      lastName: 'Nkeng',
      phone: '+237690000001',
    })

    expect(form.passengers[0]?.firstName).toBe('Jean')
    expect(form.contactPhone).toBe('+237699999999')
  })

  /**
   * Les passagers suivants sont **d'autres personnes**. Leur proposer le nom du
   * titulaire du téléphone produirait des billets au mauvais nom — l'erreur que
   * ce confort doit précisément éviter.
   */
  it('ne touche jamais aux passagers suivants', () => {
    const form = prefill(blank, { firstName: 'Awa', lastName: 'Nkeng' })

    expect(form.passengers[1]).toMatchObject({ firstName: '', lastName: '' })
  })
})

describe('validate — pièce d’identité', () => {
  const filled = {
    passengers: [{ firstName: 'Awa', lastName: 'Nkeng', seatId: 1 }],
    contactPhone: '+237690000001',
    idNumber: '',
    idPath: null,
  }

  /**
   * La politique arrive du serveur. Tant qu'elle n'est pas là, on ne bloque
   * pas : retenir une saisie valide sur une hypothèse est pire que de laisser
   * partir une requête que le serveur refusera clairement.
   */
  it('n’exige rien tant que la politique est inconnue', () => {
    expect(validate(filled)).toBeNull()
  })

  it('exige un numéro en mode NUMBER', () => {
    expect(validate(filled, { mode: 'NUMBER', required: true })).toBe('ID_MISSING')
    expect(
      validate({ ...filled, idNumber: '110234567' }, { mode: 'NUMBER', required: true }),
    ).toBeNull()
  })

  /**
   * Le mode décide de la **forme** : un numéro ne satisfait pas une demande de
   * photo, sans quoi le réglage ne réglerait rien — et le serveur, lui, refuse.
   */
  it('n’accepte pas un numéro quand une photo est demandée', () => {
    expect(
      validate({ ...filled, idNumber: '110234567' }, { mode: 'IMAGE', required: true }),
    ).toBe('ID_MISSING')

    expect(
      validate(
        { ...filled, idPath: 'id-documents/1/a.jpg' },
        { mode: 'IMAGE', required: true },
      ),
    ).toBeNull()
  })

  it('n’exige rien quand le réglage est désactivé', () => {
    expect(validate(filled, { mode: 'IMAGE', required: false })).toBeNull()
  })
})

describe('toRequestBody — pièce d’identité', () => {
  const base = {
    passengers: [
      { firstName: 'Awa', lastName: 'Nkeng', seatId: 1 },
      { firstName: 'Jean', lastName: 'Kamdem', seatId: 2 },
    ],
    contactPhone: '+237690000001',
    idNumber: '',
    idPath: null,
  }

  /** Le **premier** seulement : les suivants ne sont pas concernés. */
  it('ne met la pièce que sur le voyageur principal', () => {
    const body = toRequestBody({ ...base, idNumber: '110234567' }, 'TR-1')

    expect(body.passengers[0]).toMatchObject({ id_document_number: '110234567' })
    expect(body.passengers[1]).not.toHaveProperty('id_document_number')
  })

  /** La base refuse un passager qui porterait les deux formes. */
  it('n’envoie jamais les deux formes à la fois', () => {
    const body = toRequestBody(
      { ...base, idNumber: '110234567', idPath: 'id-documents/1/a.jpg' },
      'TR-1',
    )

    expect(body.passengers[0]).toMatchObject({ id_document_path: 'id-documents/1/a.jpg' })
    expect(body.passengers[0]).not.toHaveProperty('id_document_number')
  })
})
