import { render, screen } from '@testing-library/react-native'
import type { TripSummary } from '@motoboy/api-client/types'
import '../../../shared/i18n'
import { TripCard } from './TripCard'

/**
 * ⚠️ `render` est **asynchrone** depuis Testing Library 14 : il faut l'attendre
 * avant d'interroger `screen`, sinon les requêtes lèvent
 * « `render` function has not been called » — un message qui ne désigne pas la
 * cause.
 */
const BASE: TripSummary = {
  reference: 'TR-001',
  agency: { id: 1, name: 'Général Express' },
  departure_at: '2026-08-15T07:00:00Z',
  origin_station: { id: 1, name: 'Gare de Bonabéri', city: 'Douala' },
  destination_station: { id: 2, name: 'Gare de Bafoussam', city: 'Bafoussam' },
  price: { amount: 6500, currency: 'XAF' },
  seats_available: 12,
  seating_mode: 'SEATED',
  vehicle_type: 'BUS',
  online_sales_close_at: '2026-08-15T06:30:00Z',
}

function trip(overrides: Partial<TripSummary> = {}): TripSummary {
  return { ...BASE, ...overrides }
}

describe('TripCard', () => {
  it('montre ce qui décide : agence, prix, places', async () => {
    await render(<TripCard trip={trip()} onPress={jest.fn()} />)

    expect(screen.getByText('Général Express')).toBeTruthy()
    expect(screen.getByText(/6\s?500/)).toBeTruthy()
    expect(screen.getByText(/12/)).toBeTruthy()
  })

  /**
   * Les conditions d'annulation sont un **critère de comparaison affiché**, pas
   * une ligne de conditions générales : elles varient d'une agence à l'autre, et
   * c'est ce qui permet à une agence souple de s'en prévaloir (B5).
   */
  describe('conditions d’annulation', () => {
    it('dit « gratuite » quand les frais sont nuls — c’est un argument commercial', async () => {
      await render(
        <TripCard
          trip={trip({
            cancellation_policy: {
              deadline_hours: 2,
              fee_type: 'PERCENTAGE',
              fee_value: 0,
            },
          })}

          onPress={jest.fn()}
        />,
      )

      expect(screen.getByText(/gratuite/i)).toBeTruthy()
    })

    it('rend un pourcentage depuis les points de base', async () => {
      await render(
        <TripCard
          trip={trip({
            // 2000 points de base valent 20 %.
            cancellation_policy: {
              deadline_hours: 2,
              fee_type: 'PERCENTAGE',
              fee_value: 2000,
            },
          })}

          onPress={jest.fn()}
        />,
      )

      expect(screen.getByText(/20 ?%/)).toBeTruthy()
    })

    it('rend un montant fixe comme un montant', async () => {
      await render(
        <TripCard
          trip={trip({
            cancellation_policy: {
              deadline_hours: 4,
              fee_type: 'FIXED',
              fee_value: 1000,
            },
          })}

          onPress={jest.fn()}
        />,
      )

      expect(screen.getByText(/1\s?000/)).toBeTruthy()
    })
  })

  it('signale un départ complet', async () => {
    await render(<TripCard trip={trip({ seats_available: 0 })} onPress={jest.fn()} />)

    expect(screen.getByText('Complet')).toBeTruthy()
  })

  /**
   * Les escales sont **purement informatives** : elles s'affichent, mais ne
   * rendent pas le départ réservable jusqu'à elles (B6).
   */
  it('affiche les escales', async () => {
    await render(
      <TripCard
        trip={trip({ stops: [{ city: 'Nkongsamba', position: 1 }] })}
        onPress={jest.fn()}
      />,
    )

    expect(screen.getByText(/Nkongsamba/)).toBeTruthy()
  })

  it('annonce le départ au lecteur d’écran', async () => {
    await render(<TripCard trip={trip()} onPress={jest.fn()} />)

    expect(screen.getByLabelText(/Général Express/)).toBeTruthy()
  })
})
