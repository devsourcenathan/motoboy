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

module.exports = config
