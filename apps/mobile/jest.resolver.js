const path = require('node:path')

const WORKSPACE_PACKAGES = path.resolve(__dirname, '../../packages')

/**
 * Résolution des imports `.js` écrits dans du TypeScript.
 *
 * Les packages du workspace sont compilés en `moduleResolution: nodenext`, qui
 * **impose** l'extension `.js` dans les imports relatifs — `./locale.js`
 * désigne `locale.ts`. Jest cherche un vrai fichier `.js`, ne le trouve pas, et
 * échoue. C'est le même accroc que côté Metro, et il demande son propre
 * correctif : deux bundlers, deux configurations.
 *
 * **Pourquoi un résolveur et pas `moduleNameMapper`.** Une correspondance
 * globale s'applique à *toutes* les requêtes, y compris aux `.js` bien réels
 * des bibliothèques : `@testing-library/react-native` s'en trouvait chargé deux
 * fois, et `screen` ne voyait pas le rendu produit par `render` — un échec dont
 * le message ne désigne pas la cause. Un résolveur, lui, connaît le fichier
 * **appelant**, ce qui permet de ne réécrire que ce qui vient de nos packages.
 */
module.exports = (request, options) => {
  const fromWorkspace =
    typeof options.basedir === 'string' && options.basedir.startsWith(WORKSPACE_PACKAGES)

  if (fromWorkspace && request.startsWith('.') && request.endsWith('.js')) {
    for (const extension of ['.ts', '.tsx']) {
      try {
        return options.defaultResolver(request.replace(/\.js$/, extension), options)
      } catch {
        // Extension suivante, puis la résolution d'origine.
      }
    }
  }

  return options.defaultResolver(request, options)
}
