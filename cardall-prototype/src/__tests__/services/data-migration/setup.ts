/**
 * 数据迁移测试环境设置
 */

import { db } from '@/services/database-unified'
import { dataMigrationTool } from '@/services/data-migration-tool'
import { MigrationTestHelpers } from './test-utils'

// 测试前全局设置
beforeAll(async () => {
  console.log('🧪 数据迁移测试环境初始化...')

  // 设置测试环境变量
  process.env.NODE_ENV = 'test'

  // 模拟必要的浏览器API
  if (!global.crypto) {
    global.crypto = {} as any
  }

  if (!global.crypto.randomUUID) {
    global.crypto.randomUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    }
  }

  // 模拟fetch API（用于图片处理）
  global.fetch = jest.fn() as any

  // 模拟fileSystemService
  jest.mock('@/services/file-system', () => ({
    fileSystemService: {
      saveImage: jest.fn().mockImplementation(async (file: File, cardId: string, folderId?: string) => {
        return {
          filePath: `/images/${cardId}/${file.name}`,
          metadata: {
            width: 100,
            height: 100,
            format: file.type.split('/')[1],
            size: file.size
          }
        }
      })
    }
  }))

  console.log('✅ 数据迁移测试环境初始化完成')
})

// 每个测试前的设置
beforeEach(async () => {
  // 清理localStorage
  MigrationTestHelpers.cleanupLocalStorage()

  // 清理数据库
  try {
    await db.clearAll()
  } catch (error) {
    console.warn('数据库清理失败:', error)
  }

  // 重置所有mock
  jest.clearAllMocks()

  // 重置迁移工具状态
  ;(dataMigrationTool as any).isMigrating = false
  ;(dataMigrationTool as any).currentPlan = null
  ;(dataMigrationTool as any).progressCallbacks.clear()
  ;(dataMigrationTool as any).migrationQueue = []
  ;(dataMigrationTool as any).activeMigrations.clear()
})

// 所有测试后的清理
afterAll(async () => {
  console.log('🧪 数据迁移测试环境清理...')

  // 清理localStorage
  MigrationTestHelpers.cleanupLocalStorage()

  // 清理数据库
  try {
    await db.clearAll()
  } catch (error) {
    console.warn('数据库最终清理失败:', error)
  }

  // 重置全局mock
  jest.restoreAllMocks()

  console.log('✅ 数据迁移测试环境清理完成')
})

// 全局测试超时设置
jest.setTimeout(30000)

// 抑制控制台警告（测试期间）
beforeAll(() => {
  const originalConsoleWarn = console.warn
  const originalConsoleError = console.error

  console.warn = (...args) => {
    if (!args[0]?.includes?.('Failed to cleanup')) {
      originalConsoleWarn(...args)
    }
  }

  console.error = (...args) => {
    if (!args[0]?.includes?.('cleanup failed')) {
      originalConsoleError(...args)
    }
  }
})

// 导出测试工具
export { MigrationTestHelpers }