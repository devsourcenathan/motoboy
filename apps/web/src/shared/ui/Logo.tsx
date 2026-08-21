import {
  BRAND_COLORS,
  BRAND_MARK_BOX,
  BRAND_MARK_PATH,
  BRAND_MARK_WIDTH,
  BRAND_SQUARE,
  BRAND_STREAK_PATH,
} from '@motoboy/shared'
import { useTranslation } from 'react-i18next'
import { setLocale } from '../../lib/i18n'

/**
 * La marque MOTOBOY.
 *
 * Le tracé vient de `@motoboy/shared`, partagé avec le mobile et avec les PNG
 * générés par `pnpm brand` : il n'existe qu'une seule définition du dessin.
 *
 * `mark` (sans le carré marine) est la variante des bandeaux : le carré posé sur
 * un en-tête `bg-ink-700` donnerait un carré marine sur du marine, dessiné par
 * son seul arrondi.
 *
 * `aria-hidden` par défaut, et c'est volontaire : partout où la marque apparaît,
 * le mot « MOTOBOY » est écrit juste à côté. L'annoncer deux fois ferait entendre
 * « MOTOBOY MOTOBOY » à un lecteur d'écran. Passez un `title` là où la marque est
 * seule.
 */
export function Logo({
  size = 32,
  variant = 'icon',
  title,
}: {
  size?: number
  variant?: 'icon' | 'mark'
  title?: string
}) {
  const box =
    variant === 'icon'
      ? '0 0 512 512'
      : `${BRAND_MARK_BOX.x} ${BRAND_MARK_BOX.y} ${BRAND_MARK_BOX.width} ${BRAND_MARK_BOX.height}`

  return (
    <svg
      width={size}
      height={
        variant === 'icon'
          ? size
          : Math.round((size * BRAND_MARK_BOX.height) / BRAND_MARK_BOX.width)
      }
      viewBox={box}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {variant === 'icon' ? (
        <rect
          x={BRAND_SQUARE.x}
          y={BRAND_SQUARE.y}
          width={BRAND_SQUARE.size}
          height={BRAND_SQUARE.size}
          rx={BRAND_SQUARE.radius}
          fill={BRAND_COLORS.navy}
        />
      ) : null}
      <path
        d={BRAND_MARK_PATH}
        fill="none"
        stroke={BRAND_COLORS.mark}
        strokeWidth={BRAND_MARK_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={BRAND_STREAK_PATH} fill={BRAND_COLORS.accent} />
    </svg>
  )
}

/**
 * Le choix de la langue.
 *
 * **Deux boutons et non une liste déroulante.** Avec deux langues, un menu
 * demande deux gestes pour en changer et cache la langue courante derrière le
 * premier. Ici les deux sont visibles, et celle qui est active se voit.
 *
 * `lang` sur chaque bouton : un lecteur d'écran en français doit prononcer
 * « English » à l'anglaise, faute de quoi l'option devient méconnaissable à
 * l'oreille de celui qui la cherche.
 */
export function LocaleSwitch({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation()

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {(
        [
          ['fr', 'Français'],
          ['en', 'English'],
        ] as const
      ).map(([locale, label]) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-current={i18n.language === locale ? 'true' : undefined}
          onClick={() => setLocale(locale)}
          className={
            i18n.language === locale
              ? 'rounded px-2 py-1 text-xs font-bold underline'
              : 'rounded px-2 py-1 text-xs opacity-70 hover:opacity-100'
          }
        >
          {label}
        </button>
      ))}
    </div>
  )
}
