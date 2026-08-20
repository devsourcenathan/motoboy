import {
  emptyApplication,
  missingDocuments,
  validate,
  type DriverApplication,
} from './driverApplication'

const TODAY = '2026-08-17'

const complete: DriverApplication = {
  ...emptyApplication,
  licenceNumber: 'CM-4412',
  licenceExpiresAt: '2027-03-01',
  plate: 'LT 4412 AB',
  seats: 4,
  city: { cityId: 27, label: 'Bafang' },
}

describe('validate', () => {
  it('refuses an untouched form', () => {
    expect(validate(emptyApplication, TODAY)).toBe('INCOMPLETE')
  })

  it('accepts a complete form with a licence still valid', () => {
    expect(validate(complete, TODAY)).toBeNull()
  })

  it('refuses a licence that expires today', () => {
    // Le jour même ne vaut pas : un permis qui expire aujourd'hui ne couvre pas
    // la course de demain, et l'API le refuserait de toute façon.
    expect(validate({ ...complete, licenceExpiresAt: TODAY }, TODAY)).toBe(
      'EXPIRED_LICENCE',
    )
  })

  it('refuses a licence already expired', () => {
    expect(validate({ ...complete, licenceExpiresAt: '2025-01-01' }, TODAY)).toBe(
      'EXPIRED_LICENCE',
    )
  })

  it('refuses a form without a city, because that is what he will be shown', () => {
    expect(validate({ ...complete, city: null }, TODAY)).toBe('INCOMPLETE')
  })

  it('refuses more seats than a vehicle can carry', () => {
    expect(validate({ ...complete, seats: 21 }, TODAY)).toBe('INCOMPLETE')
  })

  it('reports incompleteness before an expired licence', () => {
    // Une date passée sur un formulaire vide n'est pas le premier problème.
    expect(validate({ ...emptyApplication, licenceExpiresAt: '2020-01-01' }, TODAY)).toBe(
      'INCOMPLETE',
    )
  })
})

describe('missingDocuments', () => {
  it('lists all four when nothing has been provided', () => {
    expect(missingDocuments([])).toEqual([
      'LICENSE',
      'REGISTRATION',
      'IDENTITY',
      'INSURANCE',
    ])
  })

  it('keeps the asking order rather than the provided order', () => {
    expect(missingDocuments(['INSURANCE', 'IDENTITY'])).toEqual([
      'LICENSE',
      'REGISTRATION',
    ])
  })

  it('returns nothing once the file is complete', () => {
    expect(
      missingDocuments(['IDENTITY', 'LICENSE', 'INSURANCE', 'REGISTRATION']),
    ).toEqual([])
  })

  it('ignores a type the client does not know', () => {
    expect(missingDocuments(['LICENSE', 'SOMETHING_ELSE'])).toEqual([
      'REGISTRATION',
      'IDENTITY',
      'INSURANCE',
    ])
  })
})
