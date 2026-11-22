import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Politique de sécurité du contenu, ajoutée seulement au build : en dev, le rechargement
 * à chaud de React a besoin d'un script en ligne.
 */
const csp: Plugin = {
  name: 'hibou-csp',
  apply: 'build',
  transformIndexHtml: () => [{
    tag: 'meta',
    attrs: {
      'http-equiv': 'Content-Security-Policy',
      content: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
    },
    injectTo: 'head-prepend',
  }],
};

// @hibou/core est du TypeScript source : on l'intègre au bundle au lieu de l'externaliser.
export default defineConfig({
  main: { build: { externalizeDeps: { exclude: ['@hibou/core'] } } },
  preload: { build: { externalizeDeps: { exclude: ['@hibou/core'] } } },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), csp],
  },
});
