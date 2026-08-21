import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon, type IconName } from './Icon'

/**
 * Les surfaces.
 *
 * **Une bordure plutôt qu'une ombre seule.** Les cartes n'étaient tenues que par
 * une ombre légère : sur un fond clair elles flottaient sans se délimiter, et
 * une grille de six chiffres se lisait comme un seul bloc gris. La bordure donne
 * l'arête, l'ombre garde la profondeur.
 */
export function Card({
  children,
  padded = true,
  className = '',
}: {
  children: ReactNode
  /**
   * Faux quand la carte est **composée** — un `CardHeader` puis un corps, qui
   * portent chacun leur propre marge.
   *
   * Un booléen plutôt qu'un `className="p-0"` de l'appelant : deux classes
   * Tailwind de même spécificité se départagent par leur ordre dans la feuille
   * de style, pas par celui de l'attribut. `p-0` posé après `p-5` gagne parfois,
   * et le reste du temps on cherche pourquoi la marge tient bon.
   */
  padded?: boolean
  className?: string
}) {
  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * Un titre de section **dans** une carte, avec ce qu'il faut savoir à côté.
 *
 * Le sous-titre porte le pourquoi, pas la redite du titre : « Dernières
 * décisions » n'apprend rien de plus que le titre, « ce que l'équipe a tranché
 * aujourd'hui » situe la liste.
 */
export function CardHeader({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string | undefined
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
      <div>
        <h2 className="text-sm font-bold text-ink-700">{title}</h2>
        {hint === undefined ? null : (
          <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>
        )}
      </div>
      {action}
    </div>
  )
}

/**
 * Le ton d'un chiffre.
 *
 * **L'orange dit « votre action », et seulement elle.** Un compteur qui décrit
 * reste neutre, même grand. Colorer les deux ferait perdre la seule information
 * que la couleur porte ici — et un zéro en orange crierait sans rien demander,
 * d'où le repli sur `neutral` que `StatCard` applique lui-même.
 */
const TONES = {
  neutral: { value: 'text-ink-700', icon: 'bg-neutral-100 text-neutral-500' },
  action: { value: 'text-brand-600', icon: 'bg-brand-50 text-brand-600' },
  alert: { value: 'text-danger', icon: 'bg-danger-soft text-danger' },
  good: { value: 'text-success-700', icon: 'bg-success-50 text-success-700' },
} as const

export type Tone = keyof typeof TONES

/**
 * La vignette d'un chiffre.
 *
 * `hint` porte ce que le nombre seul ne dit pas — « sur 14 agences », « dont 3
 * annulées ». Un grand chiffre sans dénominateur se lit bien et ne s'interprète
 * pas.
 *
 * `to` transforme la vignette en lien : un compteur qui appelle une décision
 * doit mener à l'écran où on la prend, sinon il faut retrouver l'onglet
 * soi-même — et l'on finit par ne plus ouvrir le tableau de bord.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  to,
}: {
  label: string
  value: string
  hint?: string | undefined
  icon: IconName
  tone?: Tone
  to?: string | undefined
}) {
  const skin = TONES[tone]

  /*
   * Une **liste de définitions**, et non trois paragraphes : un intitulé et sa
   * valeur, c'est exactement ce que `dl` décrit. Le gain n'est pas théorique —
   * la valeur se rattache à son libellé, pour un lecteur d'écran comme pour un
   * test, là où trois `p` frères n'avaient aucun lien entre eux.
   */
  const body = (
    <dl>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
          {label}
        </dt>
        <span className={`rounded-lg p-1.5 ${skin.icon}`}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <dd className={`mt-3 text-3xl font-bold tabular-nums ${skin.value}`}>{value}</dd>
      {hint === undefined ? null : (
        <dd className="mt-1 text-xs text-neutral-500">{hint}</dd>
      )}
    </dl>
  )

  const shell = 'rounded-xl border border-neutral-200 bg-neutral-0 p-5 shadow-sm'

  if (to === undefined) return <div className={shell}>{body}</div>

  return (
    <Link
      to={to}
      className={`${shell} block transition-shadow hover:border-neutral-300 hover:shadow-md`}
    >
      {body}
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
        Ouvrir la file
        <Icon name="arrow" size={13} />
      </span>
    </Link>
  )
}

const BADGES = {
  neutral: 'bg-neutral-100 text-neutral-700',
  action: 'bg-brand-50 text-brand-700',
  alert: 'bg-danger-soft text-danger-strong',
  good: 'bg-success-50 text-success-700',
} as const

/** Un état, dit par sa forme autant que par son texte. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGES[tone]}`}
    >
      {label}
    </span>
  )
}

/**
 * L'aperçu d'une pièce déposée.
 *
 * **Une ligne de texte ne dit pas qu'un document est le bon.** On ouvrait le
 * fichier pour découvrir que c'était la mauvaise page — puis on refermait
 * l'onglet, puis on recommençait avec le suivant. Une vignette montre l'image
 * là où elle est une image, et un pictogramme là où c'est un PDF, que le
 * navigateur ne sait pas réduire.
 *
 * Le lien reste celui de l'API — signé, valable dix minutes — et s'ouvre dans un
 * onglet : la décision se prend en gardant le dossier ouvert derrière.
 */
export function Thumb({
  label,
  hint,
  url,
  image = false,
  children,
}: {
  label: string
  hint?: string | undefined
  url?: string | undefined
  /** Vrai quand le fichier est une image : un PDF ne se réduit pas en vignette. */
  image?: boolean
  /**
   * Sous le libellé — un état, une échéance.
   *
   * Composé plutôt que configuré : donner à cette vignette une propriété
   * `status` puis `expiry` puis `owner` finirait par y faire entrer les règles
   * de trois écrans différents.
   */
  children?: ReactNode
}) {
  const inner = (
    <>
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 text-neutral-500">
        {image && url !== undefined ? (
          // `alt` vide : le libellé est écrit juste dessous, et le répéter
          // ferait entendre deux fois le même mot.
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name={image ? 'image' : 'document'} size={26} />
        )}
      </div>
      <p className="mt-2 truncate text-sm font-medium text-neutral-900">{label}</p>
      {hint === undefined ? null : (
        <p className="truncate text-xs text-neutral-500">{hint}</p>
      )}
      {children === undefined ? null : <div className="mt-1.5">{children}</div>}
    </>
  )

  const shell = 'rounded-xl border border-neutral-200 bg-neutral-0 p-2.5'

  if (url === undefined) return <div className={shell}>{inner}</div>

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`${shell} block transition-shadow hover:border-neutral-300 hover:shadow-md`}
    >
      {inner}
    </a>
  )
}
