import type { ReactNode } from 'react'

/**
 * L'attente, l'absence, et l'échec.
 *
 * Les trois se confondent quand on ne les distingue pas à l'écran, et c'est le
 * défaut le plus banal d'un back-office : une page vide peut aussi bien être en
 * train de charger, ne rien avoir à montrer, ou être cassée.
 */

/**
 * Un squelette prend **la forme de ce qui arrive**.
 *
 * Des barres génériques là où un tableau va paraître annoncent la mauvaise
 * chose : la page tressaute au chargement, et l'œil doit refaire le trajet.
 * D'où les variantes ci-dessous plutôt qu'un seul rectangle réglable.
 */
function Bar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-200/70 ${className}`} />
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <Bar key={index} className="h-12" />
      ))}
    </div>
  )
}

/** Des lignes de texte, de largeurs inégales — un paragraphe n'est pas un bloc. */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  const widths = ['w-full', 'w-11/12', 'w-4/5', 'w-2/3']

  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <Bar key={index} className={`h-3 ${widths[index % widths.length]}`} />
      ))}
    </div>
  )
}

/*
 * Les largeurs sont écrites en toutes lettres : Tailwind **lit** le source, il
 * ne l'exécute pas, et une classe composée à l'exécution — `lg:grid-cols-${n}` —
 * n'est jamais générée. Elle disparaît sans erreur, et la grille s'effondre en
 * une colonne alors que le code paraît juste.
 */
const COLUMNS = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
} as const

/** La grille de vignettes du tableau de bord, à sa taille réelle. */
export function SkeletonCards({
  count = 4,
  columns = 4,
}: {
  count?: number
  columns?: keyof typeof COLUMNS
}) {
  return (
    <div className={`grid gap-4 ${COLUMNS[columns]}`} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-0 p-5"
        >
          <Bar className="h-3 w-1/2" />
          <Bar className="h-7 w-2/3" />
          <Bar className="h-2.5 w-3/4" />
        </div>
      ))}
    </div>
  )
}

/**
 * Un tableau, avec son en-tête et ses colonnes.
 *
 * Le nombre de colonnes vient de l'appelant parce qu'il le connaît : un
 * squelette à trois colonnes suivi d'un tableau à six est plus déroutant que
 * pas de squelette du tout.
 */
export function SkeletonTable({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0"
      aria-hidden
    >
      <div className="flex gap-4 border-b border-neutral-200 px-4 py-3">
        {Array.from({ length: columns }, (_, index) => (
          <Bar key={index} className="h-2.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="flex gap-4 border-b border-neutral-100 px-4 py-4 last:border-0"
        >
          {Array.from({ length: columns }, (_, index) => (
            <Bar key={index} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
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
  /** `| undefined` explicitement, pour la même raison que `hint` sur `Field`. */
  body?: string | undefined
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-0 p-10 text-center">
      <p className="font-semibold text-neutral-900">{title}</p>
      {body === undefined ? null : (
        <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">{body}</p>
      )}
      {action === undefined ? null : (
        <div className="mt-4 flex justify-center">{action}</div>
      )}
    </div>
  )
}

/** Le message d'erreur d'un écran, à sa place et non dans une alerte. */
export function ErrorNote({ message }: { message: string }) {
  return (
    <p
      // `alert` fait annoncer le message dès qu'il paraît : une erreur muette
      // pour un lecteur d'écran laisse attendre une réponse qui est déjà là.
      role="alert"
      className="rounded-lg bg-danger-soft px-3 py-2 text-sm whitespace-pre-line text-danger-strong"
    >
      {message}
    </p>
  )
}
