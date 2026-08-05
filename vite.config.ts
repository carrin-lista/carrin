import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true // Permite testar o PWA rodando localmente
      },
      manifest: {
        name: 'Carrin',
        short_name: 'Carrin',
        description: 'Lista de compras inteligente para casais.',
        theme_color: '#23CE6B', // Alinhado com o Design System (Verde Carrin)[cite: 10]
        background_color: '#F6F8FF', // Alinhado com o Design System (Carrin Background)[cite: 10]
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