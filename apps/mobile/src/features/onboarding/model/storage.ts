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

const CHOICE_KEY = 'motoboy.auth.choiceMade'

/**
 * Le passager a-t-il déjà tranché entre se connecter et continuer sans compte ?
 *
 * **Sans ce marqueur, l'écran d'accueil redemanderait à chaque lancement.** Un
 * choix qu'on repose est une obstruction, pas une proposition — et quelqu'un qui
 * a décidé de chercher sans compte ne doit pas être ramené devant la même
 * question le lendemain.
 *
 * Le marqueur est posé dans les deux cas : connexion réussie **ou** entrée en
 * invité. C'est le fait d'avoir choisi qui compte, pas ce qui a été choisi.
 */
export async function hasMadeAuthChoice(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CHOICE_KEY)) === '1'
  } catch {
    // Un stockage indisponible ne doit pas bloquer l'entrée : on laisse passer
    // plutôt que d'enfermer quelqu'un devant un écran de connexion.
    return true
  }
}

export async function markAuthChoiceMade(): Promise<void> {
  try {
    await AsyncStorage.setItem(CHOICE_KEY, '1')
  } catch {
    // Sans effet : la question se reposera au prochain lancement, ce qui est
    // ennuyeux mais pas bloquant.
  }
}
