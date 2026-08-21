import type { ReactNode } from 'react'
import { Icon, Spinner, type IconName } from './Icon'

/**
 * Le bouton, et l'attente qui va avec.
 *
 * **Un envoi sans retour visible se rejoue.** Le bouton était seulement
 * désactivé pendant la requête : sur un réseau lent, rien ne distingue « en
 * cours » de « mon clic n'a pas été pris », et l'on reclique — ou l'on quitte
 * l'écran en croyant l'action perdue.
 *
 * Le libellé **reste affiché** pendant l'attente, le rond s'ajoutant devant
 * lui : le remplacer par « Envoi… » change la largeur du bouton, déplace ce qui
 * l'entoure, et fait perdre de vue ce qu'on était en train de valider.
 */

const VARIANTS = {
  primary: 'bg-brand-500 text-neutral-0 hover:bg-brand-600 shadow-sm',
  secondary:
    'border border-neutral-300 bg-neutral-0 text-neutral-700 hover:bg-neutral-50',
  ink: 'bg-ink-700 text-neutral-0 hover:bg-ink-900 shadow-sm',
  danger: 'border border-danger text-danger hover:bg-danger-soft',
  ghost: 'text-neutral-700 hover:bg-neutral-100',
} as const

const SIZES = {
  md: 'px-4 py-2 text-sm',
  sm: 'px-3 py-1.5 text-xs',
} as const

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  icon,
  form,
  className = '',
}: {
  label: string
  onPress?: () => void
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  type?: 'button' | 'submit'
  disabled?: boolean
  /** Bloque **et** montre l'attente. Un envoi en cours n'est pas un bouton gris. */
  loading?: boolean
  icon?: IconName
  /**
   * Relie le bouton à un `form` qu'il ne contient pas.
   *
   * Le pied d'un panneau est **hors** de la zone qui défile, donc hors du
   * `form` : sans cet attribut, le bouton d'envoi ne soumet rien, et l'on ne
   * s'en aperçoit qu'à l'usage puisque le clic ne produit aucune erreur.
   */
  form?: string
  className?: string
}) {
  return (
    <button
      type={type}
      form={form}
      onClick={onPress}
      disabled={disabled || loading}
      // `aria-busy` dit à un lecteur d'écran ce que le rond dit à l'œil.
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <Spinner /> : icon === undefined ? null : <Icon name={icon} size={16} />}
      {label}
    </button>
  )
}

/**
 * Les boutons d'un pied de formulaire.
 *
 * L'action de confirmation est **à droite**, la sortie à sa gauche : c'est
 * l'ordre du système, et l'inverser fait cliquer « Annuler » à ceux qui visent
 * sans lire.
 */
export function Actions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2">{children}</div>
}
