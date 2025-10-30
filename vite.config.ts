/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png', 'offline.html'],
      manifest: {
        name: 'ResQLink - Emergency Mesh Network',
        short_name: 'ResQLink',
        description: 'Offline mesh messaging app for emergency communication with end-to-end encryption',
        theme_color: '#3880ff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'assets/icon/icon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'assets/icon/icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Send SOS',
            short_name: 'SOS',
            description: 'Send emergency SOS broadcast',
            url: '/?action=sos',
            icons: [{ src: 'assets/icon/icon.png', sizes: '192x192' }]
          },
          {
            name: 'View Map',
            short_name: 'Map',
            description: 'View resource map',
            url: '/resources',
            icons: [{ src: 'assets/icon/icon.png', sizes: '192x192' }]
          },
          {
            name: 'Messages',
            short_name: 'Messages',
            description: 'View messages',
            url: '/messages',
            icons: [{ src: 'assets/icon/icon.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2}'],
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api/, /^\/assets/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapbox-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.(?:json|xml)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              }
            }
          }
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      }
    })
  ],
  build: {
    // Set chunk size warning limit to 1000 KB
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Manual chunks for better code splitting
        manualChunks: {
          // Ionic framework and related components
          'ionic': [
            '@ionic/react',
            '@ionic/react-router',
            '@ionic/core'
          ],
          // React and related libraries
          'react-vendor': [
            'react',
            'react-dom',
            'react-router',
            'react-router-dom'
          ],
          // Zustand state management
          'zustand': [
            'zustand'
          ],
          // Cryptography libraries (TweetNaCl and utils)
          'crypto': [
            'tweetnacl',
            'tweetnacl-util'
          ],
          // Map library (MapLibre GL)
          'map': [
            'maplibre-gl'
          ],
          // Capacitor plugins
          'capacitor': [
            '@capacitor/core',
            '@capacitor/app',
            '@capacitor/camera',
            '@capacitor/device',
            '@capacitor/filesystem',
            '@capacitor/geolocation',
            '@capacitor/haptics',
            '@capacitor/keyboard',
            '@capacitor/status-bar'
          ]
        }
      }
    },
    // Enable CSS minification
    cssMinify: true,
    // Configure terser options for better compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true, // Remove debugger statements
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      format: {
        comments: false // Remove all comments
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
