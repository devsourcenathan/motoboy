import type { ReactNode } from 'react'

/**
 * La charpente d'un écran.
 *
 * Titre, sections, tableaux : ce qui donne à dix pages écrites séparément l'air
 * d'un seul produit. Répéter ces classes sur chaque page les fait diverger en
 * une semaine — un espacement ici, un arrondi là.
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

/**
 * Un groupe, avec son titre.
 *
 * **Le titre porte la question à laquelle le groupe répond**, pas la catégorie
 * de ses données : « Ce qui attend une décision » se lit et se hiérarchise,
 * « Statistiques » n'apprend rien. Le `hint` sert aux réserves — ce que le
 * groupe ne compte pas, et pourquoi.
 */
export function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint?: string | undefined
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wide text-ink-700 uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
      {hint === undefined ? null : <p className="text-xs text-neutral-500">{hint}</p>}
    </section>
  )
}

/**
 * Un tableau qui défile **dans son cadre**.
 *
 * Un inventaire a beaucoup de colonnes et un écran d'agence n'est pas toujours
 * large : sans ce cadre, c'est la page entière qui défile latéralement, et
 * l'en-tête part avec.
 */
export function Table({
  head,
  children,
}: {
  head: readonly string[]
  children: ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs tracking-wide text-neutral-500 uppercase">
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

export function Cell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}
