/**
 * Les icônes du back-office.
 *
 * **Un jeu de tracés, pas une dépendance.** Une bibliothèque d'icônes apporte
 * un millier de dessins pour la dizaine qu'un back-office utilise, et impose sa
 * convention de nommage à un code qui a la sienne. Ici chaque tracé est nommé
 * par ce qu'il désigne dans le produit — `agencies`, `payouts` — et non par sa
 * forme, si bien qu'en changer le dessin ne demande pas de renommer ses appels.
 *
 * Tous les tracés partagent la même grille de 24 et le même trait : mélangés,
 * des dessins d'épaisseurs différentes se remarquent immédiatement alors qu'on
 * ne saurait dire pourquoi.
 */

/** Tracés sur une grille de 24, trait de 1,75 — jamais de remplissage. */
const PATHS = {
  agencies: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 11h.01M15 11h.01',
  drivers: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5m0 0l3.5 3.5M12 12l-3.5 3.5',
  payouts: 'M3 7h18v10H3zM12 14a2 2 0 100-4 2 2 0 000 4zM7 7v10M17 7v10',
  trips:
    'M4 17V6a2 2 0 012-2h12a2 2 0 012 2v11M4 17h16M4 17l-1 3M20 17l1 3M8 9h8M7 13h.01M17 13h.01',
  tickets:
    'M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V8zM14 6v12',
  users:
    'M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7M21 20v-2a4 4 0 00-3-3.87',
  money: 'M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  refunds: 'M3 12a9 9 0 109-9 9 9 0 00-6.36 2.64L3 8M3 3v5h5',
  alert: 'M12 3l9.5 16.5H2.5L12 3zM12 10v4M12 17.5h.01',
  document:
    'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5M9 13h6M9 17h4',
  image: 'M4 5h16v14H4zM4 15l4.5-4.5 4 4L16 11l4 4M9 9.5h.01',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M4 12.5l5 5L20 6.5',
} as const

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  size = 18,
  className = '',
}: {
  name: IconName
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      // Décoratif : partout où une icône apparaît, son libellé est écrit à côté.
      // L'annoncer ferait lire deux fois la même chose.
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

/**
 * L'attente d'une **action**, par opposition au squelette qui annonce du
 * contenu. Les deux ne s'échangent pas : un rond là où du texte va paraître
 * laisse croire à un blocage, un squelette sur un bouton laisse croire à une
 * mise en page cassée.
 */
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 00-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
