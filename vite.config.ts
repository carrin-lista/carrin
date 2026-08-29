import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

// Mini-plugin para gerar o version.json no build sem trabalho manual
const generateVersionJson = () => {
  return {
    name: 'generate-version-json',
    writeBundle() {
      if (!fs.existsSync('dist')) fs.mkdirSync('dist');
      fs.writeFileSync('dist/version.json', JSON.stringify({ version: packageJson.version }));
    }
  };
};

export default defineConfig({
  define: {
    // Injeta a versão do package.json como variável de ambiente
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
  },
  plugins: [
    react(),
    generateVersionJson(),
    VitePWA({
      registerType: 'prompt', // MUDANÇA: Exige ação do usuário
      injectRegister: null, 
      workbox: {
        importScripts: ['/push-sw.js'] 
      },
      devOptions: {
        enabled: true 
      },
      manifest: {
        name: 'Carrin',
        short_name: 'Carrin',
        description: 'Lista de Compras.',
        theme_color: '#10b981', 
        background_color: '#f8fafc', 
        display: 'standalone', 
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
});