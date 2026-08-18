import type { ReactNode } from 'react'

/**
 * Les primitives du back-office.
 *
 * **Un seul endroit pour les classes.** Dix pages qui répètent le même Tailwind
 * divergent en une semaine : un padding ici, un arrondi là, et l'ensemble cesse
 * de ressembler à un produit. Ce fichier ne contient que ce qui se répète
 * réellement — inventer des composants avant d'en avoir besoin coûte plus qu'il
 * ne rapporte.
 */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-700">{title}</h1>
        {subtitle === undefined ? null : (
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-neutral-0 p-5 shadow-sm ${className}`}>{children}</div>
}

const VARIANTS = {
  primary: 'bg-brand-500 text-neutral-0 hover:bg-brand-600',
  secondary: 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50',
  ink: 'bg-ink-700 text-neutral-0 hover:bg-ink-900',
  danger: 'border border-danger text-danger hover:bg-danger-soft',
} as const

export function Button({
  label,
  onPress,
  variant = 'primary',
  type = 'button',
  disabled = false,
}: {
  label: string
  onPress?: () => void
  variant?: keyof typeof VARIANTS
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onPress}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${VARIANTS[variant]}`}
    >
      {label}
    </button>
  )
}

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

/**
 * Un tableau qui défile **dans son cadre**.
 *
 * Un inventaire a beaucoup de colonnes et un écran d'agence n'est pas toujours
 * large : sans ce cadre, c'est la page entière qui défile latéralement, et
 * l'en-tête part avec.
 */
export function Table({ head, children }: { head: readonly string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-neutral-0 shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-200 text-xs tracking-wide text-neutral-500 uppercase">
          <tr>
            {head.map((cell) => (
              <th key={cell} className="px-4 py-3 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">{children}</tbody>
      </table>
    </div>
  )
}

export function Cell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}

/**
 * Ce qu'on montre quand il n'y a rien.
 *
 * **Une phrase seule se lit comme un bogue** : rien ne dit si le chargement est
 * fini, si le filtre ne rend rien, ou si l'écran est cassé. L'action compte
 * autant que le texte — un inventaire vide sans bouton « ajouter » laisse
 * l'agence chercher par où commencer.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl bg-neutral-0 p-10 text-center shadow-sm">
      <p className="font-semibold text-neutral-900">{title}</p>
      {body === undefined ? null : (
        <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">{body}</p>
      )}
      {action === undefined ? null : <div className="mt-4">{action}</div>}
    </div>
  )
}

/**
 * L'attente, avec la forme de ce qui arrive.
 *
 * Comme sur le mobile : un squelette annonce du contenu, un rond annonce une
 * action. Les deux ne s'échangent pas.
 */
export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
      ))}
    </div>
  )
}

/** Le message d'erreur d'un écran, à sa place et non dans une alerte. */
export function ErrorNote({ message }: { message: string }) {
  return <p className="text-sm whitespace-pre-line text-danger">{message}</p>
}

/**
 * Un panneau de saisie.
 *
 * En **surcouche** plutôt qu'en page : ajouter un véhicule se fait en regardant
 * la liste des véhicules, et quitter la liste pour un formulaire fait perdre le
 * contexte de ce qu'on est en train de compléter.
 */
export function Panel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-10 flex justify-end bg-ink-900/30">
      {/*
        Le fond ferme le panneau : c'est le geste attendu, et l'oublier force à
        viser une croix de seize pixels.
      */}
      <button
        type="button"
        aria-label="Fermer"
        className="flex-1 cursor-default"
        onClick={onClose}
      />
      <section className="w-full max-w-md overflow-y-auto bg-neutral-0 p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-700">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-neutral-500">
            Fermer
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}
