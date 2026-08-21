import type { ReactNode } from 'react'

/**
 * L'étiquette et le champ, liés.
 *
 * `label` enveloppe le champ plutôt que de le viser par `htmlFor` : la liaison
 * ne peut pas se rompre quand on déplace l'un des deux, et cliquer l'étiquette
 * donne le focus sans qu'on ait à y penser.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  /**
   * `| undefined` explicitement.
   *
   * `exactOptionalPropertyTypes` distingue « absent » de « présent et indéfini »,
   * et cette distinction a un sens sur une donnée qu'on met à jour — elle empêche
   * d'effacer une valeur par inadvertance. Sur un indice d'affichage, elle n'en a
   * aucun : « pas d'indice » se dit des deux façons. Trois appelants ont dû
   * contourner par un `...spread` avant que je corrige ici plutôt que chez eux.
   */
  hint?: string | undefined
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-700">{label}</span>
      {children}
      {hint === undefined ? null : (
        <span className="mt-1 block text-xs text-neutral-500">{hint}</span>
      )}
    </label>
  )
}

/** La classe des champs, partagée par `input`, `select` et `textarea`. */
export const INPUT = 'mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm'
