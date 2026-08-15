import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // Desativa o registro genérico para usarmos o virtual:pwa-register manual no app
      workbox: {
        importScripts: ['/push-sw.js'] // Incorpora os listeners de push no SW oficial gerado
      },
      devOptions: {
        enabled: true // Permite testar o PWA rodando localmente
      },
      manifest: {
        name: 'Carrin',
        short_name: 'Carrin',
        description: 'Lista de compras inteligente para casais.',
        theme_color: '#23CE6B', // Alinhado com o Design System (Verde Carrin)
        background_color: '#F6F8FF', // Alinhado com o Design System (Carrin Background)
        display: 'standalone', // Faz abrir em tela cheia, sem barra de navegador
        icons: [
          {
            src: '/pwa-192x192.png', // Com a barra inicial para garantir resolução correta a partir da raiz
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png', // Com a barra inicial
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
});