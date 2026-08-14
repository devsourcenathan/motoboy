// Configuration Metro pour monorepo.
//
// Metro ne remonte pas l'arborescence au-delà du dossier de l'application : sans
// cette configuration, les imports de `@motoboy/shared` et `@motoboy/api-client`
// échouent, et le message d'erreur ne désigne pas la cause. C'est l'accroc connu
// de la mise en place, signalé en §6 du brief.
//
// Deux réglages suffisent :
//   1. surveiller la racine du dépôt, pour que les packages du workspace soient
//      lus et rechargés à chaud comme du code applicatif ;
//   2. déclarer les deux emplacements de node_modules, l'application ayant les
//      siens et la racine hébergeant les dépendances hoistées.

const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Les packages du workspace exportent leur source TypeScript directement — pas
// d'étape de build à orchestrer, ce qui est aussi la raison pour laquelle
// Turborepo n'a pas été retenu au départ. Metro les transpile comme le reste.
config.resolver.disableHierarchicalLookup = true

/*
 * Résolution des imports `.js` écrits dans du TypeScript.
 *
 * Les packages du workspace sont compilés en `moduleResolution: nodenext`, qui
 * **impose** l'extension `.js` dans les imports relatifs — `./locale.js`
 * désigne `locale.ts`. C'est la convention ESM de TypeScript, et le compilateur
 * la fait respecter.
 *
 * Metro, lui, ne connaît pas cette correspondance : il cherche un vrai fichier
 * `locale.js`, ne le trouve pas, et échoue sur `Unable to resolve module`. Sans
 * cette passerelle, aucun package du workspace ne traverse le bundler — la
 * compilation TypeScript passe, et c'est à l'exécution que tout tombe.
 *
 * La réécriture est **limitée aux imports relatifs**, pour ne pas toucher aux
 * `.js` bien réels de `node_modules`, et retombe sur la résolution normale si
 * aucun `.ts` ne correspond.
 */
const originalResolve = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = originalResolve ?? context.resolveRequest

  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    for (const extension of ['.ts', '.tsx']) {
      try {
        return resolve(context, moduleName.replace(/\.js$/, extension), platform)
      } catch {
        // Extension suivante, puis la résolution d'origine.
      }
    }
  }

  return resolve(context, moduleName, platform)
}

module.exports = config
