// ============================================================================
// 统一冲突解决引擎测试配置 - W3-T003
// Vitest配置文件
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../../'),
      '@services': path.resolve(__dirname, '../../../services'),
      '@components': path.resolve(__dirname, '../../../components'),
      '@utils': path.resolve(__dirname, '../../../utils')
    }
  },
  server: {
    port: 5173
  }
})