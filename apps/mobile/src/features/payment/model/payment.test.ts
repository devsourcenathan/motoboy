import { phaseOf, shouldPoll, validate } from './payment'

describe('validate', () => {
  it('exige un opérateur et un numéro', () => {
    expect(validate({ operator: null, payerPhone: '+237690000001' })).toBe(
      'OPERATOR_MISSING',
    )
    expect(validate({ operator: 'MTN', payerPhone: '  ' })).toBe('PHONE_MISSING')
    expect(validate({ operator: 'MTN', payerPhone: '+237690000001' })).toBeNull()
  })
})

describe('phaseOf', () => {
  it('part du formulaire tant que rien n’est lancé', () => {
    expect(phaseOf(undefined)).toBe('form')
  })

  /**
   * `PENDING` et `PROCESSING` se disent de la même façon au passager : la
   * différence est interne au prestataire et ne lui offre aucun geste
   * différent.
   */
  it('confond attente et traitement', () => {
    expect(phaseOf('PENDING')).toBe('waiting')
    expect(phaseOf('PROCESSING')).toBe('waiting')
  })

  it('distingue le succès de l’échec', () => {
    expect(phaseOf('SUCCEEDED')).toBe('succeeded')
    expect(phaseOf('FAILED')).toBe('failed')
  })
})

describe('shouldPoll', () => {
  /**
   * **Le verdict arrive par webhook**, pas dans la réponse à l'initiation :
   * rien n'est encaissé de façon synchrone, et l'écran attend en demandant.
   */
  it('interroge tant que le prestataire n’a pas tranché', () => {
    expect(shouldPoll('PENDING')).toBe(true)
    expect(shouldPoll('PROCESSING')).toBe(true)
  })

  /**
   * Continuer sur un paiement abouti viderait la batterie pour redemander une
   * réponse qui ne changera plus.
   */
  it('s’arrête dès que le sort est connu', () => {
    expect(shouldPoll('SUCCEEDED')).toBe(false)
    expect(shouldPoll('FAILED')).toBe(false)
  })

  it('n’interroge rien avant d’avoir lancé', () => {
    expect(shouldPoll(undefined)).toBe(false)
  })
})
