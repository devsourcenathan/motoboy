import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Button,
  CheckIcon,
  fontSize,
  lineHeight,
  radius,
  SearchIcon,
  spacing,
  TabIcon,
  theme,
  TOUCH_TARGET,
} from '../../../shared/ui'

import { markOnboardingSeen } from '../model/storage'
import type { PassengerMessages } from '@motoboy/shared/i18n/passenger'

/**
 * Présentation du produit, au premier lancement.
 *
 * Trois écrans, pas davantage : ce qu'il y a à dire tient en trois phrases —
 * comparer, réserver, embarquer — et un onboarding plus long se saute
 * entièrement.
 *
 * **« Passer » est visible dès le premier écran.** Un passager qui veut son
 * billet ne doit pas avoir à traverser une introduction, et cacher la sortie ne
 * la fait pas lire, elle fait désinstaller.
 */
export function Onboarding() {
  const router = useRouter()
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const list = useRef<FlatList>(null)
  const [index, setIndex] = useState(0)

  const slides = t('onboarding.slides', {
    returnObjects: true,
  }) as PassengerMessages['onboarding']['slides']

  const last = index === slides.length - 1

  async function finish() {
    await markOnboardingSeen()
    router.replace('/search')
  }

  function advance() {
    if (last) {
      void finish()

      return
    }

    list.current?.scrollToIndex({ index: index + 1, animated: true })
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>

      <FlatList
        ref={list}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        keyExtractor={(slide) => slide.title}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: position }) => (
          <View style={[styles.slide, { width }]}>
            {/*
              Un panneau teinté portant un glyphe, faute d'illustrations : la
              maquette en montre trois, aucune n'existe comme fichier, et un
              cadre vide dirait qu'il en manque une.
            */}
            <View style={styles.stage}>
              <View style={styles.glyph}>
                {position === 0 ? <SearchIcon color={theme.text.brand} size={64} /> : null}
                {position === 1 ? (
                  <TabIcon name="tickets" color={theme.text.brand} size={64} />
                ) : null}
                {position === 2 ? <CheckIcon color={theme.text.brand} size={64} /> : null}
              </View>
            </View>

            <View style={styles.text}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        {/*
          « Passer » reste atteignable au pouce, en bas : en haut à droite il
          demande de changer de main sur un grand téléphone.
        */}
        <Pressable
          accessibilityRole="button"
          onPress={() => void finish()}
          style={styles.skip}
        >
          <Text style={styles.skipLabel}>{t('onboarding.skip')}</Text>
        </Pressable>

        <View
          style={styles.dots}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: slides.length, now: index + 1 }}
        >
          {slides.map((slide, i) => (
            <View
              key={slide.title}
              style={[styles.dot, i === index ? styles.dotActive : null]}
            />
          ))}
        </View>

        <Button
          label={last ? t('onboarding.start') : t('onboarding.next')}
          onPress={advance}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.surface.page,
  },
  slide: {
    flex: 1,
  },
  /** Le panneau occupe la moitié haute, comme sur la maquette. */
  stage: {
    flex: 1,
    margin: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    backgroundColor: theme.surface.brandSoft,
  },
  glyph: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: theme.surface.card,
  },
  text: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize['2xl'],
    lineHeight: lineHeight['2xl'],
    fontWeight: '700',
    letterSpacing: -0.5,
    color: theme.text.primary,
    textAlign: 'center',
  },
  body: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  footer: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: theme.surface.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  skip: {
    alignSelf: 'flex-end',
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  skipLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: theme.text.muted,
  },
  dots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: spacing.base,
    paddingBottom: spacing.base,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: theme.surface.inert,
  },
  /** La page courante s'allonge : la position se lit sans compter les points. */
  dotActive: {
    width: 28,
    backgroundColor: theme.surface.brand,
  },
})
