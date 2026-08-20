import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { hasMadeAuthChoice, hasSeenOnboarding } from '../src/features/onboarding'
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
  /*
   * Le type des routes est genere par Expo Router : une chaine libre ne passe
   * pas, et c'est tant mieux — une faute de frappe dans un chemin echouerait
   * sinon a l'execution, sur un ecran blanc.
   */
  const [route, setRoute] = useState<
    '/onboarding' | '/account/sign-in' | '/search' | null
  >(null)

  useEffect(() => {
    let active = true

    /*
     * Trois portes, franchies une seule fois chacune : l'introduction, puis le
     * choix entre se connecter et continuer sans compte, puis la recherche.
     *
     * Les deux marqueurs sont lus **ensemble** : les enchaîner ferait afficher
     * l'introduction, puis un blanc, puis la connexion — trois écrans pour une
     * seule décision.
     */
    void Promise.all([hasSeenOnboarding(), hasMadeAuthChoice()]).then(([seen, chose]) => {
      if (!active) return

      setRoute(!seen ? '/onboarding' : !chose ? '/account/sign-in' : '/search')
    })

    return () => {
      active = false
    }
  }, [])

  if (route === null) {
    return (
      <View style={sharedStyles.centered}>
        <ActivityIndicator color={theme.text.brand} />
      </View>
    )
  }

  return <Redirect href={route} />
}
