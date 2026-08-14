import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { hasSeenOnboarding } from '../src/features/onboarding'
import { sharedStyles, theme } from '../src/shared/ui'

/**
 * Aiguillage d'entrée.
 *
 * Onboarding la première fois, recherche ensuite. La lecture du marqueur est
 * asynchrone — on n'affiche donc **ni l'un ni l'autre** tant qu'on ne sait pas :
 * montrer la recherche puis basculer sur l'onboarding produirait un
 * clignotement, et l'inverse ferait apparaître une introduction à quelqu'un qui
 * ouvre l'application pour la centième fois.
 */
export default function Entry() {
  const [seen, setSeen] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true

    void hasSeenOnboarding().then((value) => {
      if (active) setSeen(value)
    })

    return () => {
      active = false
    }
  }, [])

  if (seen === null) {
    return (
      <View style={sharedStyles.centered}>
        <ActivityIndicator color={theme.text.brand} />
      </View>
    )
  }

  return <Redirect href={seen ? '/search' : '/onboarding'} />
}
