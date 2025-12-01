import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');

  // 配置插件
  const plugins = [
    react({
      // 优化 Fast Refresh
      fastRefresh: {
        // 自定义错误覆盖层
        overlay: {
          position: 'top-right'
        }
      }
    }),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        // 优化 PWA 缓存策略
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 年
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 天
              }
            }
          }
        ]
      },
      includeAssets: ['favicon.ico', 'cardall-icon.svg', 'apple-touch-icon.png'],
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
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'apple-touch-icon'
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ]

  // 仅在生产构建时添加 Bundle Analyzer 插件
  if (mode === 'production') {
    plugins.push(
      visualizer({
        filename: 'bundle-analysis.html',
        open: false
      })
    )
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      // 优化解析策略
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
      // 启用缓存
      preserveSymlinks: false
    },
    server: {
      host: '0.0.0.0',  // 监听所有网络接口
      port: 5173,
      strictPort: false,  // 如果端口被占用，自动切换端口
      open: false,       // 不自动打开浏览器
      cors: true,        // 允许跨域访问
      // 优化开发服务器
      hmr: {
        // 启用热模块替换
        overlay: true,
        // 自定义 HMR 端口
        port: 5174
      },
      // 启用服务器缓存
      cacheDir: '.vite/cache',
      // 优化文件监听
      watch: {
        usePolling: false,
        // 忽略不需要监听的文件
        ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**']
      }
    },
    build: {
      target: 'esnext',
      // 优化构建输出
      outDir: 'dist',
      assetsDir: 'assets',
      // 启用源代码映射
      sourcemap: mode === 'development',
      // 优化 CSS 代码分割
      cssCodeSplit: true,
      // 优化静态资源
      assetsInlineLimit: 4096, // 4kb 以下的资源内联
      // 优化 chunk 大小
      chunkSizeWarningLimit: 1000,
      // 启用 rollup 优化
      rollupOptions: {
        output: {
          // 优化代码分割
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
            database: ['dexie'],
            form: ['react-hook-form', '@hookform/resolvers'],
            charts: ['recharts'],
            icons: ['lucide-react'],
            utils: ['clsx', 'tailwind-merge', 'class-variance-authority', 'date-fns']
          },
          // 优化输出格式
          format: 'es',
          // 优化文件名哈希
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]'
        },
        // 优化构建过程
        treeshake: true,
        // 优化依赖
        external: []
      },
      // 启用 minify
      minify: mode === 'production' ? 'terser' : false,
      // 优化 terser 配置
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production'
        }
      }
    },
    define: {
      // 定义环境变量的类型，确保 TypeScript 类型安全
      __ENABLE_DEBUG_MODE__: env.VITE_ENABLE_DEBUG_MODE === 'true',
      // 启用 React 18 新特性
      'process.env.NODE_ENV': JSON.stringify(mode)
    },
    // 优化 CSS 配置
    css: {
      modules: {
        localsConvention: 'camelCaseOnly'
      },
      preprocessorOptions: {
        css: {
          charset: false
        }
      },
      devSourcemap: mode === 'development'
    },
    // 优化依赖预构建
    optimizeDeps: {
      // 预构建依赖
      include: [
        'react',
        'react-dom',
        'lucide-react',
        'clsx',
        'tailwind-merge'
      ],
      // 禁用依赖预构建缓存
      force: false,
      // 启用 esbuild 优化
      esbuildOptions: {
        target: 'esnext',
        // 优化 esbuild 输出
        define: {
          global: 'globalThis'
        },
        plugins: []
      }
    },
    // 优化预览服务器
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: false
    }
  }
})