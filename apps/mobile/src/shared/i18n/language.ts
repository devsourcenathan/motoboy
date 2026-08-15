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
 * Le serveur n'est pas prévenu, faute d'endpoint : `users.locale` continue de
 * décider de la langue des **SMS**. Un passager qui bascule l'application en
 * anglais recevra donc ses billets dans la langue de son inscription. C'est une
 * incohérence assumée, pas un oubli — la corriger demande une mise à jour du
 * profil côté API.
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
