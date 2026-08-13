import type { Money } from '@motoboy/api-client/types'

/**
 * Les montants circulent en **unités entières de devise**. Le XAF n'ayant pas
 * de subdivision en circulation, il n'y a ni décimale ni arrondi à gérer.
 */
export function formatMoney(money: Money, locale = 'fr-FR'): string {
  const formatted = new Intl.NumberFormat(locale, {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(money.amount)

  return `${formatted} ${money.currency}`
}

/** Somme de montants de même devise. Lève si les devises divergent. */
export function sumMoney(values: readonly Money[]): Money {
  const first = values[0]
  if (!first) throw new Error('sumMoney: liste vide')

  let total = 0
  for (const value of values) {
    if (value.currency !== first.currency) {
      throw new Error(
        `sumMoney: devises incompatibles (${first.currency} et ${value.currency})`,
      )
    }
    total += value.amount
  }

  return { amount: total, currency: first.currency }
}
