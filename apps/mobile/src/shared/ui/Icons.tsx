import Svg, { Circle, Path } from 'react-native-svg'

export interface IconProps {
  color: string
  size?: number
}

/**
 * Glyphes de l'interface.
 *
 * Dessinés ici plutôt qu'importés d'une fonte : `@expo/vector-icons` n'est pas
 * installé, et l'ajouter pour une poignée de glyphes embarquerait plusieurs
 * milliers de caractères dans le paquet. `react-native-svg` est déjà présent
 * pour le QR du billet.
 *
 * Contour de 2 et non aplat : à 24 dp, un trait reste lisible sur la dalle d'un
 * téléphone d'entrée de gamme en plein soleil, là où un aplat de la même
 * couleur se referme.
 */
export function BackIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5m0 0l6.5-6.5M5 12l6.5 6.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function SearchIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={2} />
      <Path d="M16 16l4.5 4.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

/** Place occupée, sur le plan de sièges. */
export function CrossIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path
        d="M4.5 4.5l9 9m0-9l-9 9"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  )
}

/**
 * Le point qui marque une extrémité de trajet.
 *
 * Or au départ, bleu à l'arrivée — la paire se lit sans libellé, ce qui compte
 * quand on regarde son téléphone en marchant.
 */
export function RouteDot({ color, size = 12 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Circle cx={6} cy={6} r={5} fill={color} />
    </Svg>
  )
}
