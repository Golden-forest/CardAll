/**
 * 数据迁移工具核心功能测试
 */

import { dataMigrationTool } from '@/services/data-migration-tool'
import { TestDataFactory, MigrationTestHelpers } from './test-utils'
import { setup } from './setup'

describe('DataMigrationTool - 核心功能测试', () => {
  const { validateMigrationResult, validateMigrationPlan, createProgressListener } = MigrationTestHelpers

  describe('基本初始化和状态管理', () => {
    test('应该正确初始化数据迁移工具', () => {
      expect(dataMigrationTool).toBeDefined()
      expect(dataMigrationTool).toBeInstanceOf(Object)
    })

    test('应该检查系统状态', async () => {
      const status = await dataMigrationTool.getSystemStatus()

      expect(status).toBeDefined()
      expect(status.isMigrating).toBe(false)
      expect(Array.isArray(status.activeMigrations)).toBe(true)
      expect(typeof status.databaseHealthy).toBe('boolean')
      expect(status.storageQuota).toBeDefined()
      expect(typeof status.storageQuota.used).toBe('number')
      expect(typeof status.storageQuota.total).toBe('number')
    })

    test('应该检查迁移需求', async () => {
      const needs = await dataMigrationTool.checkMigrationNeeds()

      expect(needs).toBeDefined()
      expect(typeof needs.needsMigration).toBe('boolean')
      expect(Array.isArray(needs.sources)).toBe(true)
      expect(Array.isArray(needs.recommendations)).toBe(true)
    })

    test('应该获取迁移建议', async () => {
      const recommendations = await dataMigrationTool.getMigrationRecommendations()

      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations)).toBe(true)

      if (recommendations.length > 0) {
        const firstRec = recommendations[0]
        expect(['high', 'medium', 'low']).toContain(firstRec.priority)
        expect(firstRec.source).toBeDefined()
        expect(typeof firstRec.reason).toBe('string')
        expect(typeof firstRec.estimatedTime).toBe('number')
        expect(['low', 'medium', 'high']).toContain(firstRec.risk)
      }
    })
  })

  describe('迁移进度管理', () => {
    test('应该注册和移除进度回调', () => {
      const callback = jest.fn()
      const removeCallback = dataMigrationTool.onProgress(callback)

      expect(typeof removeCallback).toBe('function')

      // 测试回调注册
      expect(callback).not.toHaveBeenCalled()

      // 移除回调
      removeCallback()
    })

    test('应该获取迁移进度', () => {
      const planId = 'test-plan-id'
      const progress = dataMigrationTool.getMigrationProgress(planId)

      // 初始状态应该返回undefined
      expect(progress).toBeUndefined()
    })

    test('应该能够取消迁移', async () => {
      const planId = 'test-plan-id'
      const result = await dataMigrationTool.cancelMigration(planId)

      // 对于不存在的迁移，应该返回false
      expect(result).toBe(false)
    })
  })

  describe('迁移历史管理', () => {
    test('应该获取迁移历史', async () => {
      const history = await dataMigrationTool.getMigrationHistory()

      expect(Array.isArray(history)).toBe(true)

      // 如果有历史记录，验证其结构
      if (history.length > 0) {
        const firstResult = history[0]
        expect(firstResult).toHaveProperty('planId')
        expect(firstResult).toHaveProperty('executedAt')
        expect(firstResult).toHaveProperty('duration')
        expect(firstResult).toHaveProperty('success')
        expect(firstResult.executedAt).toBeInstanceOf(Date)
      }
    })
  })

  describe('验证报告功能', () => {
    test('应该创建验证报告', async () => {
      const report = await dataMigrationTool.createValidationReport()

      expect(report).toBeDefined()
      expect(report).toHaveProperty('success')
      expect(report).toHaveProperty('integrity')
      expect(report).toHaveProperty('consistency')
      expect(report).toHaveProperty('performance')
      expect(report).toHaveProperty('issues')
      expect(report).toHaveProperty('recommendations')

      // 验证完整性检查
      expect(report.integrity).toHaveProperty('cardsValid')
      expect(report.integrity).toHaveProperty('cardsInvalid')
      expect(report.integrity).toHaveProperty('foldersValid')
      expect(report.integrity).toHaveProperty('foldersInvalid')
      expect(report.integrity).toHaveProperty('tagsValid')
      expect(report.integrity).toHaveProperty('tagsInvalid')
      expect(report.integrity).toHaveProperty('imagesValid')
      expect(report.integrity).toHaveProperty('imagesInvalid')

      // 验证一致性检查
      expect(report.consistency).toHaveProperty('referencesValid')
      expect(report.consistency).toHaveProperty('duplicatesFound')
      expect(report.consistency).toHaveProperty('orphansFound')

      // 验证性能数据
      expect(report.performance).toHaveProperty('totalTime')
      expect(report.performance).toHaveProperty('dataSize')
      expect(report.performance).toHaveProperty('throughput')

      // 验证数组和属性类型
      expect(Array.isArray(report.issues)).toBe(true)
      expect(Array.isArray(report.recommendations)).toBe(true)
      expect(typeof report.success).toBe('boolean')
    })
  })

  describe('并发迁移管理', () => {
    test('应该防止并发迁移', async () => {
      // 创建一个简单的测试源
      const source = {
        type: 'localStorage' as const,
        version: '1.0'
      }

      // 创建迁移计划
      const plan = await dataMigrationTool.analyzeAndCreatePlan(source)

      // 模拟一个正在运行的迁移
      ;(dataMigrationTool as any).isMigrating = true

      // 尝试执行第二个迁移
      await expect(dataMigrationTool.executeMigration(plan))
        .rejects.toThrow('Migration already in progress')

      // 清理状态
      ;(dataMigrationTool as any).isMigrating = false
    })

    test('应该正确管理多个迁移任务', async () => {
      const source1 = { type: 'localStorage' as const, version: '1.0' }
      const source2 = { type: 'database-simple' as const, version: '1.0' }

      // 创建多个迁移计划
      const plan1 = await dataMigrationTool.analyzeAndCreatePlan(source1)
      const plan2 = await dataMigrationTool.analyzeAndCreatePlan(source2)

      // 验证计划ID唯一性
      expect(plan1.id).not.toBe(plan2.id)
      expect(plan1.id).toBeDefined()
      expect(plan2.id).toBeDefined()

      // 验证基本结构
      validateMigrationPlan(plan1, {
        sourceType: 'localStorage',
        backupRequired: true,
        rollbackEnabled: true,
        minSteps: 1
      })

      validateMigrationPlan(plan2, {
        sourceType: 'database-simple',
        backupRequired: true,
        rollbackEnabled: true,
        minSteps: 1
      })
    })
  })

  describe('错误处理和恢复', () => {
    test('应该优雅处理无效输入', async () => {
      // 测试无效的迁移源
      const invalidSource = {
        type: 'invalid-type' as any,
        version: '1.0'
      }

      await expect(dataMigrationTool.analyzeAndCreatePlan(invalidSource))
        .rejects.toThrow('Unknown migration source')

      // 测试null输入
      await expect(dataMigrationTool.analyzeAndCreatePlan(null as any))
        .rejects.toThrow()
    })

    test('应该处理数据库连接错误', async () => {
      // 模拟数据库健康检查失败
      const { db } = await import('@/services/database-unified')
      const originalHealthCheck = db.healthCheck

      db.healthCheck = jest.fn().mockResolvedValue({
        isHealthy: false,
        issues: ['Connection failed']
      })

      try {
        const status = await dataMigrationTool.getSystemStatus()
        expect(status.databaseHealthy).toBe(false)
        expect(status.isMigrating).toBe(false)
      } finally {
        // 恢复原始方法
        db.healthCheck = originalHealthCheck
      }
    })
  })

  describe('工具函数', () => {
    test('应该生成有效的搜索向量', () => {
      const testCard = TestDataFactory.createTestCard({
        frontContent: {
          title: '测试标题',
          text: '测试内容',
          tags: ['标签1', '标签2'],
          images: []
        },
        backContent: {
          title: '背面标题',
          text: '背面内容',
          tags: ['标签3', '标签4'],
          images: []
        }
      })

      // 通过私有方法测试搜索向量生成
      const searchVector = (dataMigrationTool as any).generateSearchVector(testCard)

      expect(typeof searchVector).toBe('string')
      expect(searchVector.toLowerCase()).toBe(searchVector) // 应该是小写的
      expect(searchVector).toContain('测试标题')
      expect(searchVector).toContain('测试内容')
      expect(searchVector).toContain('背面标题')
      expect(searchVector).toContain('背面内容')
      expect(searchVector).toContain('标签1')
      expect(searchVector).toContain('标签2')
      expect(searchVector).toContain('标签3')
      expect(searchVector).toContain('标签4')
    })

    test('应该计算文件夹深度', () => {
      // 测试根文件夹
      const rootFolder = TestDataFactory.createTestFolder({ parentId: null })
      const rootDepth = (dataMigrationTool as any).calculateDepth(rootFolder)
      expect(rootDepth).toBe(0)

      // 测试子文件夹
      const subFolder = TestDataFactory.createTestFolder({ parentId: 'parent-id' })
      const subDepth = (dataMigrationTool as any).calculateDepth(subFolder)
      expect(subDepth).toBe(1)
    })

    test('应该生成文件夹完整路径', () => {
      const folder = TestDataFactory.createTestFolder({ name: '测试文件夹' })
      const fullPath = (dataMigrationTool as any).generateFullPath(folder)

      expect(typeof fullPath).toBe('string')
      expect(fullPath).toContain('测试文件夹')
    })

    test('应该正确转换base64到Blob', async () => {
      const base64Data = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='

      // 模拟fetch响应
      global.fetch = jest.fn().mockResolvedValue({
        blob: () => new Blob(['test'], { type: 'image/jpeg' })
      }) as any

      const blob = await (dataMigrationTool as any).base64ToBlob(base64Data)

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/jpeg')

      // 清理mock
      jest.restoreAllMocks()
    })
  })

  describe('性能测试', () => {
    test('应该在合理时间内完成基本操作', async () => {
      const startTime = performance.now()

      // 测试系统状态检查
      await dataMigrationTool.getSystemStatus()

      // 测试迁移需求检查
      await dataMigrationTool.checkMigrationNeeds()

      // 测试验证报告生成
      await dataMigrationTool.createValidationReport()

      const endTime = performance.now()
      const duration = endTime - startTime

      // 这些操作应该在1秒内完成
      expect(duration).toBeLessThan(1000)
      console.log(`基本操作耗时: ${duration.toFixed(2)}ms`)
    })

    test('应该能够处理大量数据的状态查询', async () => {
      // 创建大量测试数据
      const bulkData = TestDataFactory.createBulkTestData(1000, 100, 200)

      // 设置localStorage数据
      MigrationTestHelpers.setupLocalStorageData(bulkData)

      // 测试大数据量的迁移需求检查
      const startTime = performance.now()
      const needs = await dataMigrationTool.checkMigrationNeeds()
      const endTime = performance.now()

      const duration = endTime - startTime
      console.log(`大数据量检查耗时: ${duration.toFixed(2)}ms`)

      // 验证结果
      expect(needs.needsMigration).toBe(true)
      expect(needs.sources.length).toBeGreaterThan(0)

      // 应该在合理时间内完成（5秒内）
      expect(duration).toBeLessThan(5000)

      // 清理
      MigrationTestHelpers.cleanupLocalStorage()
    })
  })
})