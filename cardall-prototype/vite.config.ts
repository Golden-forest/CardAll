import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}']
      },
      includeAssets: ['favicon.ico', 'cardall-icon.svg'],
      manifest: {
        name: 'CardAll - Advanced Knowledge Cards',
        short_name: 'CardAll',
        description: 'Advanced knowledge card management with offline-first architecture',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'cardall-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',  // 监听所有网络接口
    port: 5173,
    strictPort: false,  // 如果端口被占用，自动切换端口
    open: false,       // 不自动打开浏览器
    cors: true        // 允许跨域访问
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          radix: [
            '@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-tooltip',
            '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs',
            '@radix-ui/react-toast', '@radix-ui/react-alert-dialog', '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox', '@radix-ui/react-collapsible', '@radix-ui/react-context-menu',
            '@radix-ui/react-hover-card', '@radix-ui/react-label', '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu', '@radix-ui/react-progress', '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area', '@radix-ui/react-separator', '@radix-ui/react-slider',
            '@radix-ui/react-slot', '@radix-ui/react-switch', '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group', '@radix-ui/react-accordion', '@radix-ui/react-aspect-ratio'
          ],
          editor: ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-blockquote', '@tiptap/extension-code', '@tiptap/extension-image', '@tiptap/extension-link', '@tiptap/extension-placeholder', '@tiptap/extension-strike', '@tiptap/extension-task-item', '@tiptap/extension-task-list', 'tiptap-markdown-3'],
          // supabase: 已移除 - CardAll 现在使用本地模拟版本
          database: ['dexie'],
          form: ['react-hook-form', '@hookform/resolvers'],
          charts: ['recharts'],
          icons: ['lucide-react'],
          utils: ['clsx', 'tailwind-merge', 'class-variance-authority', 'date-fns'],
          sync: [
            './src/services/database.ts'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
