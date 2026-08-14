import AsyncStorage from '@react-native-async-storage/async-storage'

const SEEN_KEY = 'motoboy.onboarding.seen'

/**
 * L'onboarding se voit **une fois**.
 *
 * Le marqueur vit dans le stockage de l'application, pas dans le compte : il
 * s'affiche avant toute inscription — c'est même son objet, expliquer le
 * produit à quelqu'un qui ne le connaît pas encore. Le lier au compte le
 * ferait réapparaître à chaque changement de téléphone, et ne servirait à rien
 * de plus.
 *
 * En cas de lecture impossible, on considère l'onboarding **vu**. L'inverse
 * ferait revenir trois écrans d'introduction devant un passager qui cherche son
 * billet — l'échec doit pencher du côté qui gêne le moins.
 */
export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) !== null
  } catch {
    return true
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY, new Date().toISOString())
  } catch {
    // Sans conséquence : l'onboarding se remontrera au prochain démarrage.
  }
}
