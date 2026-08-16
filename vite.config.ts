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
        description: 'Lista de Compras.',
        theme_color: '#10b981', // Cor da barra superior do celular (mantém verde)
        background_color: '#f8fafc', // MUDANÇA: Fundo clarinho para a tela de abertura
        display: 'standalone', // Faz abrir em tela cheia, sem barra de navegador
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
});