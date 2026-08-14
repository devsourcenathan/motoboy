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
import { Button, fontSize, spacing, theme, TOUCH_TARGET } from '../../../shared/ui'

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
      <View style={styles.skipRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void finish()}
          style={styles.skip}
        >
          <Text style={styles.skipLabel}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>

      <FlatList
        ref={list}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        keyExtractor={(slide) => slide.title}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
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
  skipRow: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
  },
  skip: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  skipLabel: {
    color: theme.text.muted,
    fontSize: fontSize.base,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: theme.text.primary,
  },
  body: {
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * 1.5,
    color: theme.text.secondary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: spacing.sm / 2,
    backgroundColor: theme.surface.border,
  },
  dotActive: {
    backgroundColor: theme.surface.brand,
    width: spacing.lg,
  },
})
