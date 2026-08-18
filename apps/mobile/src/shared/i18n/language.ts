import AsyncStorage from '@react-native-async-storage/async-storage'
import i18next from 'i18next'
import { resolveLocale, type Locale } from '@motoboy/shared'

const KEY = 'motoboy.locale'

/**
 * La langue choisie, si elle l'a été.
 *
 * `null` quand le passager n'a jamais tranché : celle du téléphone fait alors
 * foi, et changer la langue du système doit continuer de suivre.
 */
export async function readChosenLanguage(): Promise<Locale | null> {
  try {
    const stored = await AsyncStorage.getItem(KEY)

    return stored === null ? null : resolveLocale(stored)
  } catch {
    return null
  }
}

/**
 * Applique et retient un choix de langue.
 *
 * **Appliqué d'abord, retenu ensuite.** Si l'écriture échoue — disque plein,
 * stockage indisponible — l'interface a quand même changé de langue, ce que le
 * passager vient de demander ; il la reperdra au prochain démarrage, ce qui est
 * moins grave qu'un réglage qui ne fait rien.
 *
 * Cette fonction ne prévient pas le serveur : c'est l'écran de réglages qui
 * pousse le choix sur le profil quand une session existe, parce que la
 * recherche fonctionne sans compte et que le réglage doit fonctionner aussi.
 * `users.locale` décide de la langue des **SMS** ; les deux doivent suivre.
 */
export async function chooseLanguage(locale: Locale): Promise<void> {
  await i18next.changeLanguage(locale)

  try {
    await AsyncStorage.setItem(KEY, locale)
  } catch {
    // Sans conséquence immédiate : la langue est déjà appliquée.
  }
}

/**
 * Restaure le choix au démarrage.
 *
 * Asynchrone par nature — le stockage l'est — donc l'application démarre dans
 * la langue du téléphone et bascule si un choix existe. Le décalage tient en
 * une image et vaut mieux qu'un écran blanc le temps de lire le disque.
 */
export async function restoreLanguage(): Promise<void> {
  const chosen = await readChosenLanguage()

  if (chosen !== null && chosen !== i18next.language) {
    await i18next.changeLanguage(chosen)
  }
}
