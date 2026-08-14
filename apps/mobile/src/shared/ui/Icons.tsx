import Svg, { Circle, Path, Rect } from 'react-native-svg'

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

/** Le temps qui reste sur une tenue de place. */
export function TimerIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={13.5} r={7.5} stroke={color} strokeWidth={2} />
      <Path
        d="M12 10v3.5l2.5 1.5M9.5 2.5h5M12 6V2.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  )
}

/** Affordance de ligne de menu : il y a quelque chose derrière. */
export function ChevronIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.5 5.5l7 6.5-7 6.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function HistoryIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5V10h5.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 7.5V12l3 2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Confirmation — le sceau du billet valide. */
export function CheckIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Départ — une cible, à distinguer de l'épingle d'arrivée au premier coup d'œil. */
export function TargetIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={7.5} stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={12} r={2.5} fill={color} />
    </Svg>
  )
}

/** Arrivée. */
export function PinIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10.5} r={2.5} fill={color} />
    </Svg>
  )
}

export function CalendarIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3.5}
        y={5.5}
        width={17}
        height={15}
        rx={2.5}
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M3.5 10h17M8 3.5v4M16 3.5v4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  )
}

export function PersonIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.5} stroke={color} strokeWidth={2} />
      <Path
        d="M5 20c0-3.4 3.2-5.5 7-5.5s7 2.1 7 5.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  )
}

/** Inverser départ et arrivée. */
export function SwapIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 4v16m0 0l-3.5-3.5M8 20l3.5-3.5M16 20V4m0 0l-3.5 3.5M16 4l3.5 3.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
