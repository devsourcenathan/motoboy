import {
  BRAND_COLORS,
  BRAND_MARK_BOX,
  BRAND_MARK_PATH,
  BRAND_MARK_WIDTH,
  BRAND_SQUARE,
  BRAND_STREAK_PATH,
} from '@motoboy/shared'
import Svg, { Path, Rect } from 'react-native-svg'

export interface LogoProps {
  size?: number
  /**
   * `icon` porte le carré marine — pour une vignette posée sur du clair.
   * `mark` n'est que le dessin, sur fond transparent : c'est ce qu'il faut sur un
   * bandeau marine, où le carré donnerait un carré marine sur du marine, souligné
   * par son propre arrondi.
   */
  variant?: 'icon' | 'mark'
}

/**
 * La marque MOTOBOY.
 *
 * Le tracé vient de `@motoboy/shared` : le même que le web, le même que les PNG
 * générés pour l'icône de l'application. Recopier le chemin ici aurait suffi —
 * et aurait garanti qu'un jour la marque du mobile et celle du web ne soient
 * plus tout à fait la même.
 *
 * `mark` est rendu dans une fenêtre calée sur l'encombrement réel du dessin, pas
 * sur le carré de 512 : la marque n'y est ni centrée ni carrée, donc la centrer
 * naïvement la ferait pencher vers le bas.
 */
export function Logo({ size = 40, variant = 'icon' }: LogoProps) {
  const box =
    variant === 'icon'
      ? '0 0 512 512'
      : `${BRAND_MARK_BOX.x} ${BRAND_MARK_BOX.y} ${BRAND_MARK_BOX.width} ${BRAND_MARK_BOX.height}`

  // En `mark`, la hauteur suit la largeur réelle du dessin — sinon le composant
  // réserverait un carré et l'espacement autour paraîtrait faux.
  const height =
    variant === 'icon'
      ? size
      : Math.round((size * BRAND_MARK_BOX.height) / BRAND_MARK_BOX.width)

  return (
    <Svg width={size} height={height} viewBox={box}>
      {variant === 'icon' ? (
        <Rect
          x={BRAND_SQUARE.x}
          y={BRAND_SQUARE.y}
          width={BRAND_SQUARE.size}
          height={BRAND_SQUARE.size}
          rx={BRAND_SQUARE.radius}
          fill={BRAND_COLORS.navy}
        />
      ) : null}
      <Path
        d={BRAND_MARK_PATH}
        fill="none"
        stroke={BRAND_COLORS.mark}
        strokeWidth={BRAND_MARK_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d={BRAND_STREAK_PATH} fill={BRAND_COLORS.accent} />
    </Svg>
  )
}
