/**
 * Amorçage des tests.
 *
 * Le fuseau est **fixé**, et ce n'est pas cosmétique : le calcul de la date du
 * jour dépend du fuseau d'affichage, et une suite qui passe à Douala mais
 * échoue sur une machine réglée sur Paris ne prouve rien. `Africa/Douala` est
 * le fuseau du produit ; la CI et le poste de développement doivent voir la
 * même chose.
 */
process.env.TZ = 'Africa/Douala'

/**
 * Langue fixée elle aussi.
 *
 * Les tests héritaient sinon de la langue de l'environnement : la suite
 * s'écrivait en français et rendait en anglais, parce que le mock
 * d'`expo-localization` renvoie `en-US`. Un test doit décider de ce qu'il
 * observe, pas le subir.
 */
import { i18next } from './src/shared/i18n'

beforeAll(async () => {
  await i18next.changeLanguage('fr')
})
