// Vitest 主配置文件
// Week 4 Day 1 测试和验证阶段 - Test-Engineer

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/vitest.setup.ts'],
    include: [
      'tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/fixtures/**',
      'tests/e2e/**',
      'tests/integration/**',
      'tests/performance/**',
      'tests/compatibility/**',
      'tests/offline/**',
      'tests/sync/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        'src/services/sync/conflict-resolution-engine/**' // 排除第三方库
      ]
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true
      }
    },
    benchmark: {
      include: ['tests/performance/**/*.{bench,test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/tests': resolve(__dirname, 'tests')
    }
  },
  define: {
    'process.env.NODE_ENV': '"test"'
  }
})