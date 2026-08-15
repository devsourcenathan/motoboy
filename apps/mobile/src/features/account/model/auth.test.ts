import {
  normaliseCode,
  normalisePhone,
  toInternational,
  validate,
  type CredentialsForm,
} from './auth'

describe('normalisePhone', () => {
  /**
   * Un numéro se saisit avec des espaces, se transmet sans. Les garder ferait
   * refuser côté serveur un numéro que le passager a pourtant bien tapé.
   */
  it('retire ce que la saisie ajoute', () => {
    expect(normalisePhone('+237 690 00 00 01')).toBe('+237690000001')
    expect(normalisePhone('+237-690-000-001')).toBe('+237690000001')
    expect(normalisePhone('+237 (690) 000.001')).toBe('+237690000001')
  })

  it('laisse un numéro déjà propre intact', () => {
    expect(normalisePhone('+237690000001')).toBe('+237690000001')
  })
})

describe('validate', () => {
  /** Ajouter un champ au formulaire ne doit pas faire réécrire chaque cas. */
  const form = (over: Partial<CredentialsForm>): CredentialsForm => ({
    phone: '',
    firstName: '',
    lastName: '',
    email: '',
    ...over,
  })

  const phone = '+237690000001'

  /**
   * Le numéro porte l'identité du compte **et** la destination des SMS. Sans
   * indicatif, le code part vers nulle part et le passager attend un message
   * qui n'arrivera jamais.
   */
  it('exige le format international', () => {
    expect(validate(form({ phone: '690000001' }), 'signIn')).toBe(
      'PHONE_INVALID',
    )
    expect(
      validate(form({ phone: '00237690000001' }), 'signIn'),
    ).toBe('PHONE_INVALID')
    expect(validate(form({ phone }), 'signIn')).toBeNull()
  })

  it('accepte un numéro saisi avec des espaces', () => {
    expect(
      validate(form({ phone: '+237 690 00 00 01' }), 'signIn'),
    ).toBeNull()
  })

  it('n’exige les noms qu’à l’inscription', () => {
    expect(validate(form({ phone }), 'signIn')).toBeNull()
    expect(validate(form({ phone }), 'signUp')).toBe(
      'NAME_MISSING',
    )
    expect(validate(form({ phone, firstName: 'Awa', lastName: '  ' }), 'signUp')).toBe(
      'NAME_MISSING',
    )
    expect(validate(form({ phone, firstName: 'Awa', lastName: 'Nkeng' }), 'signUp')).toBeNull()
  })

  /**
   * Volontairement large : le serveur reste seul juge, et un filtre trop strict
   * refuserait des numéros valides qu'on ne connaît pas encore (§29).
   */
  it('accepte d’autres indicatifs que le Cameroun', () => {
    expect(
      validate(form({ phone: '+33612345678' }), 'signIn'),
    ).toBeNull()
    expect(
      validate(form({ phone: '+15551234567' }), 'signIn'),
    ).toBeNull()
  })
})

describe('normaliseCode', () => {
  it('ne garde que les chiffres', () => {
    expect(normaliseCode('12 34 56')).toBe('123456')
    expect(normaliseCode('a1b2c3')).toBe('123')
  })
})

describe('toInternational', () => {
  /**
   * L'écran affiche « +237 » à côté du champ : le passager tape la suite. Mais
   * il colle aussi des numéros pris dans ses contacts, et écrit parfois le
   * format national avec son zéro. Les trois doivent aboutir au même numéro,
   * sans quoi le code part nulle part et personne ne sait pourquoi.
   */
  it('compose le même numéro depuis les trois saisies courantes', () => {
    expect(toInternational('690000001')).toBe('+237690000001')
    expect(toInternational('0690000001')).toBe('+237690000001')
    expect(toInternational('+237690000001')).toBe('+237690000001')
  })

  it('tolère les espaces et les tirets de la saisie', () => {
    expect(toInternational('6 90 00 00 01')).toBe('+237690000001')
    expect(toInternational('690-000-001')).toBe('+237690000001')
  })
})
