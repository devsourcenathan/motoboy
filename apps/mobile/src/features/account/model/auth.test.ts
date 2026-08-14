import { normaliseCode, normalisePhone, validate } from './auth'

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
  const phone = '+237690000001'

  /**
   * Le numéro porte l'identité du compte **et** la destination des SMS. Sans
   * indicatif, le code part vers nulle part et le passager attend un message
   * qui n'arrivera jamais.
   */
  it('exige le format international', () => {
    expect(validate({ phone: '690000001', firstName: '', lastName: '' }, 'signIn')).toBe(
      'PHONE_INVALID',
    )
    expect(
      validate({ phone: '00237690000001', firstName: '', lastName: '' }, 'signIn'),
    ).toBe('PHONE_INVALID')
    expect(validate({ phone, firstName: '', lastName: '' }, 'signIn')).toBeNull()
  })

  it('accepte un numéro saisi avec des espaces', () => {
    expect(
      validate({ phone: '+237 690 00 00 01', firstName: '', lastName: '' }, 'signIn'),
    ).toBeNull()
  })

  it('n’exige les noms qu’à l’inscription', () => {
    expect(validate({ phone, firstName: '', lastName: '' }, 'signIn')).toBeNull()
    expect(validate({ phone, firstName: '', lastName: '' }, 'signUp')).toBe(
      'NAME_MISSING',
    )
    expect(validate({ phone, firstName: 'Awa', lastName: '  ' }, 'signUp')).toBe(
      'NAME_MISSING',
    )
    expect(validate({ phone, firstName: 'Awa', lastName: 'Nkeng' }, 'signUp')).toBeNull()
  })

  /**
   * Volontairement large : le serveur reste seul juge, et un filtre trop strict
   * refuserait des numéros valides qu'on ne connaît pas encore (§29).
   */
  it('accepte d’autres indicatifs que le Cameroun', () => {
    expect(
      validate({ phone: '+33612345678', firstName: '', lastName: '' }, 'signIn'),
    ).toBeNull()
    expect(
      validate({ phone: '+15551234567', firstName: '', lastName: '' }, 'signIn'),
    ).toBeNull()
  })
})

describe('normaliseCode', () => {
  it('ne garde que les chiffres', () => {
    expect(normaliseCode('12 34 56')).toBe('123456')
    expect(normaliseCode('a1b2c3')).toBe('123')
  })
})
