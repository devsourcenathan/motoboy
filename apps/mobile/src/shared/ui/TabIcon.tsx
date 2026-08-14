import Svg, { Circle, Path, Rect } from 'react-native-svg'

export type TabName = 'home' | 'tickets' | 'account'

export interface TabIconProps {
  name: TabName
  color: string
  /** Onglet actif : le glyphe se remplit, comme le prévoit le système. */
  filled?: boolean
  size?: number
}

/**
 * Les trois icônes de la barre d'onglets.
 *
 * L'onglet actif porte un glyphe **plein** sur la pastille bleue, l'inactif un
 * glyphe en contour : le système demande une distinction qui ne repose pas que
 * sur la couleur, ce qui la rend lisible en plein soleil et pour un daltonien.
 */
export function TabIcon({ name, color, filled = false, size = 24 }: TabIconProps) {
  const stroke = filled ? 'none' : color
  const fill = filled ? color : 'none'

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'home' ? (
        <Path
          d="M3.5 10.5L12 3.5l8.5 7v9a1 1 0 0 1-1 1h-4.5v-6h-6v6H4.5a1 1 0 0 1-1-1v-9z"
          stroke={stroke}
          fill={fill}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      ) : null}

      {name === 'tickets' ? (
        <>
          {/*
            L'encoche latérale est ce qui distingue un billet d'un rectangle :
            sans elle, l'icône se confond avec « document ».
          */}
          <Path
            d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.2a2.3 2.3 0 0 0 0 4.6v1.2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.2a2.3 2.3 0 0 0 0-4.6V8.5z"
            stroke={stroke}
            fill={fill}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {filled ? (
            <Rect x={13.2} y={9.5} width={1.6} height={5} rx={0.8} fill="#ffffff" />
          ) : (
            <Path
              d="M14 9.5v5"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="1.5 2.5"
            />
          )}
        </>
      ) : null}

      {name === 'account' ? (
        <>
          <Circle
            cx={12}
            cy={8}
            r={3.75}
            stroke={stroke}
            fill={fill}
            strokeWidth={2}
          />
          <Path
            d="M4.5 20c0-3.6 3.4-5.75 7.5-5.75s7.5 2.15 7.5 5.75"
            stroke={filled ? 'none' : color}
            fill={filled ? color : 'none'}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      ) : null}
    </Svg>
  )
}
