import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field, INPUT } from '../../shared/ui'
import { useCitySearch } from './useCities'

export interface CityChoice {
  id: number
  label: string
}

/**
 * Choisir une ville **dans le référentiel**, jamais en texte libre.
 *
 * C'est le référentiel qui fait que « Douala », « douala » et « Dla » désignent
 * la même ville, et donc que les offres de plusieurs agences se regroupent sur
 * une même recherche (B1). Un champ libre créerait autant de villes que
 * d'orthographes, et la recherche cesserait de comparer quoi que ce soit.
 *
 * Extrait parce que trois écrans en ont besoin — gares, itinéraires, filtres —
 * et qu'une copie par écran divergerait sur le détail qui compte : ne retenir
 * que ce qui a été **sélectionné**.
 */
export function CityField({
  label,
  value,
  onChange,
}: {
  label: string
  value: CityChoice | null
  onChange: (city: CityChoice | null) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(value?.label ?? '')
  const cities = useCitySearch(query)

  return (
    <div>
      <Field
        label={label}
        hint={value === null ? t('agency:inventory.stations.cityHint') : undefined}
      >
        <input
          className={INPUT}
          value={query}
          placeholder="Douala"
          onChange={(event) => {
            setQuery(event.target.value)
            /*
             * Toute frappe annule la sélection : sans cela, corriger une lettre
             * après avoir choisi laisserait l'identifiant de l'ancienne ville
             * sous un libellé qui ne lui correspond plus.
             */
            onChange(null)
          }}
        />
      </Field>

      {value === null && cities.data !== undefined && cities.data.length > 0 ? (
        <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 p-1">
          {cities.data.map((suggestion) => (
            <li key={suggestion.city_id}>
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-neutral-50"
                onClick={() => {
                  onChange({ id: suggestion.city_id, label: suggestion.label })
                  setQuery(suggestion.label)
                }}
              >
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
