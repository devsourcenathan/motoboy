import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native'
import { radius, spacing, theme } from './theme'

/**
 * Une forme grise qui respire, à la place du contenu qui arrive.
 *
 * **Un squelette dit deux choses qu'un rond qui tourne ne dit pas** : que
 * quelque chose arrive, et de quelle forme. L'écran ne saute donc pas au moment
 * où les données remplacent l'attente, et sur une 3G de gare — où l'attente dure
 * réellement — le passager voit la page se construire plutôt qu'un vide.
 *
 * L'animation est en **opacité seule** : `useNativeDriver` la porte alors sur le
 * fil d'affichage, et elle continue même quand le fil JavaScript est occupé à
 * décoder la réponse qu'on attend. Animer une couleur de fond l'aurait laissée
 * se figer précisément au moment où elle doit rassurer.
 */
export function Skeleton({
  width,
  height = 14,
  radius: corner = radius.sm,
  style,
}: {
  width?: ViewStyle['width']
  height?: number
  radius?: number
  style?: ViewStyle
}) {
  const pulse = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    )

    loop.start()

    // Arrêtée au démontage : une boucle laissée derrière continue de réveiller
    // le fil d'affichage sur un écran que plus personne ne regarde.
    return () => loop.stop()
  }, [pulse])

  return (
    <Animated.View
      // Invisible pour un lecteur d'écran : il annonce déjà le chargement par
      // l'état de la liste, et six formes vides n'ajouteraient que du bruit.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: width ?? '100%',
          height,
          borderRadius: corner,
          backgroundColor: theme.surface.inert,
          opacity: pulse,
        },
        style,
      ]}
    />
  )
}

/**
 * Une ligne de liste en attente : un titre, un sous-titre plus court.
 *
 * Les largeurs varient légèrement d'une ligne à l'autre — un empilement de
 * barres identiques ressemble à un motif, pas à du texte.
 */
export function SkeletonRow({ index = 0 }: { index?: number }) {
  const widths = ['72%', '58%', '65%', '80%'] as const
  const width = widths[index % widths.length]

  return (
    <View style={styles.row}>
      <Skeleton width={width} height={16} />
      <Skeleton width="34%" height={12} />
    </View>
  )
}

/** Une carte en attente, pour les écrans qui en empilent. */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton width="45%" height={18} />
      <Skeleton width="80%" height={13} />
      <Skeleton width="60%" height={13} />
    </View>
  )
}

/**
 * Autant de lignes qu'il en faut pour remplir l'attente.
 *
 * Le nombre par défaut couvre un écran de téléphone sans le dépasser : moins
 * laisserait un blanc en bas, plus ferait défiler du vide.
 */
export function SkeletonList({
  count = 6,
  variant = 'row',
}: {
  count?: number
  variant?: 'row' | 'card'
}) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) =>
        variant === 'card' ? (
          <SkeletonCard key={index} />
        ) : (
          <SkeletonRow key={index} index={index} />
        ),
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    /*
     * **Occupe toute la largeur offerte.** Sans cela, un parent qui centre ses
     * enfants — le cas de plusieurs états vides — laisse la liste se réduire à
     * son contenu, et des barres en `width: '100%'` d'un parent large de zéro
     * deviennent invisibles : l'écran paraît vide au lieu de paraître en train
     * de charger.
     */
    alignSelf: 'stretch',
  },
  row: {
    gap: spacing.base,
    paddingVertical: spacing.sm,
    alignSelf: 'stretch',
  },
  card: {
    gap: spacing.base,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: theme.surface.card,
    alignSelf: 'stretch',
  },
})
