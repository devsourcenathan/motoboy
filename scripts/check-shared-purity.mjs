#!/usr/bin/env node
/*
 * Vérifie que `@motoboy/shared` reste pur.
 *
 * Deux règles du brief (§6) que le résolveur ne fait plus respecter :
 *
 *   1. `shared` n'a aucune dépendance DOM ni React Native. Metro imposant
 *      `node-linker=hoisted`, pnpm ne cloisonne plus les dépendances : un
 *      package peut importer ce qu'il n'a pas déclaré, et l'erreur
 *      n'apparaîtrait qu'à l'exécution, côté mobile, en production.
 *
 *   2. `shared` ne porte jamais de règle métier. Cette règle-là ne
 *      s'automatise pas — elle se tient en revue. Ce script ne couvre que la
 *      première.
 *
 * La contrainte de types est déjà tenue par `packages/shared/tsconfig.json`,
 * qui compile sans la lib DOM. Ce script couvre ce que le typage ne voit pas :
 * les imports d'exécution et les dépendances déclarées.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkgDir = join(root, 'packages/shared')

const FORBIDDEN_DEPS = [
  'react',
  'react-dom',
  'react-native',
  'expo',
  '@tanstack/react-query',
  'tailwindcss',
]

const FORBIDDEN_IMPORTS = [/from\s+['"]react/, /from\s+['"]expo/, /require\(['"]react/]

const FORBIDDEN_GLOBALS = [
  /\bwindow\./,
  /\bdocument\./,
  /\bnavigator\./,
  /\blocalStorage\b/,
]

const problems = []

// 1. Dépendances déclarées
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })

for (const dep of declared) {
  if (FORBIDDEN_DEPS.some((f) => dep === f || dep.startsWith(`${f}/`))) {
    problems.push(`dépendance interdite déclarée : ${dep}`)
  }
}

/*
 * Retire les commentaires avant d'analyser.
 *
 * Sans cela, une docstring qui *mentionne* `navigator.language` pour expliquer
 * ce que l'appelant doit passer est signalée comme une violation — alors que la
 * fonction reçoit une chaîne en paramètre et ne touche à aucune globale.
 *
 * On ne retire que les blocs `/* *\/` et les lignes dont la forme épurée
 * commence par `//` ou `*`. Les commentaires en fin de ligne de code sont
 * conservés : les supprimer naïvement tronquerait une URL dans une chaîne, et
 * masquerait une vraie violation placée sur la même ligne.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*')
    })
    .join('\n')
}

// 2. Imports et globales dans le source
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full)
      continue
    }
    if (!/\.(ts|tsx|js|mjs)$/.test(entry)) continue

    const source = stripComments(readFileSync(full, 'utf8'))
    const where = relative(root, full).replaceAll('\\', '/')

    for (const pattern of FORBIDDEN_IMPORTS) {
      if (pattern.test(source)) problems.push(`${where} : import interdit (${pattern})`)
    }
    for (const pattern of FORBIDDEN_GLOBALS) {
      if (pattern.test(source))
        problems.push(`${where} : globale d'environnement (${pattern})`)
    }
  }
}

walk(join(pkgDir, 'src'))

if (problems.length > 0) {
  console.error('@motoboy/shared doit rester sans dépendance DOM ni React Native.\n')
  for (const problem of problems) console.error(`  ✗ ${problem}`)
  console.error('\nVoir §6 du brief — organisation du dépôt.')
  process.exit(1)
}

console.log('✓ @motoboy/shared est pur — aucune dépendance DOM ni React Native.')
