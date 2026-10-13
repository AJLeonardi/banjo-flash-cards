import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Version = number of commits, so it goes up by one with every commit.
// (CI checks out full history for this; see deploy.yml.)
function version(command: string): string {
  try {
    const n = execSync('git rev-list --count HEAD').toString().trim();
    return command === 'build' ? `v${n}` : `v${n}-dev`;
  } catch {
    return 'dev';
  }
}

// GitHub Pages serves the app from /banjo-flash-cards/.
export default defineConfig(({ command, mode }) => ({
  base: command === 'build' ? '/banjo-flash-cards/' : '/',
  define: { __APP_VERSION__: JSON.stringify(version(command)) },
  plugins: [
    react(),
    // Phones only allow the mic over https; `npm run dev:https` serves a self-signed cert on the LAN.
    mode === 'https' && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Banjo Chord Trainer',
        short_name: 'Banjo Chords',
        description: 'Drill 5-string banjo chords up and down the neck.',
        theme_color: '#16130f',
        background_color: '#16130f',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  test: { include: ['test/**/*.test.ts'] },
}));
