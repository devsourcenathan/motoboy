import { defineConfig } from 'vite'
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
  server: {
    // Les packages du workspace exportent leur source TypeScript : Vite doit
    // pouvoir lire au-dessus du dossier de l'application pour les servir en
    // développement.
    fs: {
      allow: [path.resolve(import.meta.dirname, '../..')],
    },
  },
})
