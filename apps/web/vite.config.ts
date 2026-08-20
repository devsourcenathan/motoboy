// `defineConfig` vient de `vitest/config` et non de `vite` : lui seul connaît la
// clé `test`. La directive `/// <reference types="vitest" />` ne suffit plus
// depuis Vitest 3, et l'erreur qu'elle laisse — « 'test' does not exist » —
// n'indique pas qu'il faut changer d'import.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  /*
   * Les tests vivent dans **ce** fichier et non dans un `vitest.config.ts`
   * séparé : Vitest préfère le fichier dédié et ignore alors celui-ci
   * entièrement — plugins et alias compris. Deux configurations qui se
   * remplacent l'une l'autre en silence est exactement le genre de piège qu'on
   * ne découvre qu'en cherchant pourquoi un import cesse de résoudre.
   */
  test: {
    environment: 'jsdom',
    /*
     * **Une origine réelle, sinon pas de `localStorage`.** Sur l'URL par défaut
     * jsdom traite l'origine comme opaque et n'installe pas le stockage — or
     * c'est là que le client d'API range le jeton de session.
     */
    environmentOptions: { jsdom: { url: 'http://localhost' } },
    globals: true,
    /*
     * **Au-dessus de `asyncUtilTimeout`, et c'est l'ordre qui compte.**
     *
     * `findBy*` dispose de cinq secondes (voir `src/test/setup.ts`). Laisser le
     * délai du test à sa valeur par défaut — cinq secondes également — tue le
     * test à l'instant précis où l'attente allait aboutir : le message parle
     * alors de test trop long là où il n'y avait qu'une machine chargée.
     */
    testTimeout: 15000,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Fuseau figé : un test qui formate une date ne doit pas dépendre de la
    // machine qui l'exécute.
    env: { TZ: 'Africa/Douala' },
  },

  server: {
    // Les packages du workspace exportent leur source TypeScript : Vite doit
    // pouvoir lire au-dessus du dossier de l'application pour les servir en
    // développement.
    fs: {
      allow: [path.resolve(import.meta.dirname, '../..')],
    },
  },
})
