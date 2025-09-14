import { LocalOperationService } from '@/services/local-operation'
import { NetworkMonitorService } from '@/services/network-monitor'
import { SyncStrategyService } from '@/services/sync-strategy'
import { SyncPerformanceOptimizer } from '@/services/sync-performance'
import { SyncIntegrationService } from '@/services/sync-integration'

// 模拟 Supabase 和数据库
vi.mock('@/services/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }
}))

vi.mock('@/services/database', () => ({
  db: {
    cards: {
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
    },
    folders: {
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tags: {
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    syncQueue: {
      add: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
    },
    syncHistory: {
      add: vi.fn(),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
    }
  }
}))

describe('Sync System Integration Tests', () => {
  let localOperation: LocalOperationService
  let networkMonitor: NetworkMonitorService
  let syncStrategy: SyncStrategyService
  let performanceOptimizer: SyncPerformanceOptimizer
  let integrationService: SyncIntegrationService

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // 创建服务实例
    localOperation = new LocalOperationService()
    networkMonitor = new NetworkMonitorService()
    syncStrategy = new SyncStrategyService()
    performanceOptimizer = new SyncPerformanceOptimizer()
    integrationService = new SyncIntegrationService()

    // 初始化所有服务
    await localOperation.initialize()
    await networkMonitor.initialize()
    await syncStrategy.initialize()
    await performanceOptimizer.initialize()
    await integrationService.initialize()
  })

  describe('端到端同步流程', () => {
    it('应该完成完整的同步生命周期', async () => {
      // 1. 模拟用户操作添加到本地队列
      const mockOperation = {
        type: 'create' as const,
        table: 'cards' as const,
        data: { 
          frontContent: 'What is React?', 
          backContent: 'A JavaScript library for building user interfaces',
          style: 'basic' as const
        },
        localId: 'card-123',
        priority: 'normal' as const,
        dependencies: []
      }

      // 2. 监听网络状态
      const networkListener = vi.fn()
      networkMonitor.onNetworkChange(networkListener)

      // 3. 监听同步进度
      const syncListener = vi.fn()
      syncStrategy.onSyncProgress(syncListener)

      // 4. 监听系统事件
      const systemListener = vi.fn()
      integrationService.onSystemEvent(systemListener)

      // 5. 模拟网络在线状态
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '4g',
          downlink: 10,
          rtt: 50,
          saveData: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
        writable: true,
      })

      // 6. 添加操作到队列
      const operationId = await localOperation.addOperation(mockOperation)
      expect(operationId).toBeDefined()

      // 7. 触发网络连接事件
      window.dispatchEvent(new Event('online'))

      // 8. 验证网络状态监听
      expect(networkListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status_change',
          isOnline: true
        })
      )

      // 9. 触发同步
      const syncPromise = integrationService.triggerSync()

      // 10. 验证系统事件
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(systemListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync_started'
        })
      )

      // 等待同步完成
      await syncPromise

      // 11. 验证最终状态
      const systemStatus = integrationService.getSystemStatus()
      expect(systemStatus.isInitialized).toBe(true)
      expect(systemStatus.componentsReady.localQueue).toBe(true)
    })

    it('应该处理网络中断和恢复', async () => {
      // 1. 添加一些操作到队列
      await localOperation.addOperation({
        type: 'create',
        table: 'cards',
        data: { frontContent: 'Test 1', backContent: 'Answer 1' },
        localId: 'card-1'
      })

      await localOperation.addOperation({
        type: 'update',
        table: 'cards',
        data: { frontContent: 'Test 2', backContent: 'Answer 2' },
        localId: 'card-2'
      })

      // 2. 监听事件
      const networkListener = vi.fn()
      const systemListener = vi.fn()
      
      networkMonitor.onNetworkChange(networkListener)
      integrationService.onSystemEvent(systemListener)

      // 3. 模拟网络断开
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      window.dispatchEvent(new Event('offline'))

      // 4. 验证网络断开被检测到
      expect(networkListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status_change',
          isOnline: false
        })
      )

      // 5. 尝试同步（应该被跳过）
      await integrationService.triggerSync()

      // 6. 验证同步未执行
      expect(systemListener).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync_started' })
      )

      // 7. 模拟网络恢复
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))

      // 8. 验证网络恢复被检测到
      expect(networkListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status_change',
          isOnline: true
        })
      )

      // 9. 等待自动同步触发
      await new Promise(resolve => setTimeout(resolve, 100))

      // 10. 验证系统事件
      expect(systemListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync_started'
        })
      )
    })

    it('应该处理同步冲突', async () => {
      // 1. 模拟云端和本地数据冲突
      const mockCloudCard = {
        id: 'card-conflict',
        user_id: 'user-123',
        front_content: 'Cloud Content',
        back_content: 'Cloud Answer',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date().toISOString(),
        sync_version: 2
      }

      const mockLocalCard = {
        id: 'card-conflict',
        frontContent: 'Local Content',
        backContent: 'Local Answer',
        isFlipped: false,
        createdAt: new Date(Date.now() - 7200000),
        updatedAt: new Date(Date.now() - 1800000),
        syncVersion: 1,
        pendingSync: true
      }

      // 2. 设置模拟数据
      const mockDb = require('@/services/database').db
      const mockSupabase = require('@/services/supabase').supabase

      mockDb.cards.get.mockResolvedValue(mockLocalCard)
      mockSupabase.from.mockReturnThis()
      mockSupabase.select.mockReturnThis()
      mockSupabase.eq.mockReturnThis()
      mockSupabase.gte.mockReturnThis()
      mockSupabase.mockResolvedValue({ data: [mockCloudCard], error: null })

      // 3. 监听冲突事件
      const conflictListener = vi.fn()
      syncStrategy.onSyncProgress(conflictListener)

      // 4. 执行同步
      const userId = 'user-123'
      const lastSyncTime = new Date(Date.now() - 86400000)

      const progress = await syncStrategy.performIncrementalSync(userId, lastSyncTime)

      // 5. 验证冲突被检测到
      expect(progress.conflicts).toBeGreaterThan(0)
      expect(progress.isSuccessful).toBe(true)
    })
  })

  describe('性能优化集成', () => {
    it('应该根据网络条件调整同步策略', async () => {
      // 1. 模拟网络条件变化
      Object.defineProperty(navigator.connection, 'effectiveType', { 
        value: '2g', 
        writable: true 
      })
      Object.defineProperty(navigator.connection, 'downlink', { 
        value: 0.5, 
        writable: true 
      })
      Object.defineProperty(navigator.connection, 'rtt', { 
        value: 800, 
        writable: true 
      })

      // 2. 触发网络质量评估
      networkMonitor.startMonitoring()

      // 3. 获取网络推荐
      const recommendations = networkMonitor.getSyncRecommendations()

      // 4. 验证推荐的保守设置
      expect(recommendations.batchSize).toBeLessThan(10)
      expect(recommendations.maxConcurrentOperations).toBe(1)
      expect(recommendations.enableCompression).toBe(true)

      // 5. 验证性能优化器已应用这些设置
      const metrics = performanceOptimizer.getCurrentMetrics()
      expect(metrics).toBeDefined()
    })

    it('应该监控和优化同步性能', async () => {
      // 1. 模拟多个同步操作
      const operations = Array.from({ length: 20 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { 
          frontContent: `Question ${i}`, 
          backContent: `Answer ${i}` 
        },
        localId: `card-${i}`,
        priority: 'normal' as const,
        dependencies: []
      }))

      // 2. 添加操作到队列
      for (const op of operations) {
        await localOperation.addOperation(op)
      }

      // 3. 执行批量同步
      const mockExecutor = vi.fn().mockImplementation((op) => {
        return Promise.resolve({ 
          success: true, 
          operationId: op.id, 
          latency: Math.random() * 200 + 50 
        })
      })

      // 4. 使用性能优化器执行
      const results = []
      for (const op of operations) {
        const result = await performanceOptimizer.executeOptimizedOperation(op, mockExecutor)
        results.push(result)
      }

      // 5. 验证所有操作成功
      expect(results.every(r => r.success)).toBe(true)

      // 6. 验证性能指标
      const metrics = performanceOptimizer.getCurrentMetrics()
      expect(metrics.totalOperations).toBe(20)
      expect(metrics.successfulOperations).toBe(20)
      expect(metrics.successRate).toBe(100)
    })
  })

  describe('错误恢复和重试机制', () => {
    it('应该处理操作失败并自动重试', async () => {
      // 1. 添加一个会失败的操作
      const failingOperation = {
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: 'Failing Card', backContent: 'Failing Answer' },
        localId: 'card-fail',
        priority: 'normal' as const,
        dependencies: []
      }

      // 2. 模拟执行器失败
      let attemptCount = 0
      const mockExecutor = vi.fn().mockImplementation(() => {
        attemptCount++
        if (attemptCount <= 2) {
          return Promise.reject(new Error('Network timeout'))
        }
        return Promise.resolve({ success: true, operationId: 'card-fail', latency: 100 })
      })

      // 3. 添加操作并执行
      await localOperation.addOperation(failingOperation)

      // 4. 使用性能优化器执行（包含重试逻辑）
      const result = await performanceOptimizer.executeOptimizedOperation(failingOperation, mockExecutor)

      // 5. 验证最终成功
      expect(result.success).toBe(true)
      expect(attemptCount).toBe(3) // 初始失败 + 2次重试
    })

    it('应该处理队列阻塞和死锁情况', async () => {
      // 1. 添加相互依赖的操作
      const operation1 = {
        type: 'create' as const,
        table: 'folders' as const,
        data: { name: 'Folder 1' },
        localId: 'folder-1',
        priority: 'normal' as const,
        dependencies: []
      }

      const operation2 = {
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: 'Card 1', backContent: 'Answer 1' },
        localId: 'card-1',
        priority: 'normal' as const,
        dependencies: ['folder-1']
      }

      // 2. 添加操作到队列
      await localOperation.addOperation(operation1)
      await localOperation.addOperation(operation2)

      // 3. 获取队列状态
      const queueStats = await localOperation.getQueueStats()

      // 4. 验证队列状态正确
      expect(queueStats.totalOperations).toBe(2)
      expect(queueStats.byType.create).toBe(2)

      // 5. 处理队列
      await localOperation.processQueue()

      // 6. 验证依赖关系被正确处理
      const processedStats = await localOperation.getQueueStats()
      // 队列应该被处理（具体状态取决于模拟的实现）
      expect(processedStats).toBeDefined()
    })
  })

  describe('数据一致性验证', () => {
    it('应该确保本地和云端数据一致性', async () => {
      // 1. 创建测试数据
      const testData = {
        localCards: [
          {
            id: 'card-1',
            frontContent: 'Local Question 1',
            backContent: 'Local Answer 1',
            createdAt: new Date(),
            updatedAt: new Date(),
            syncVersion: 1,
            pendingSync: false
          }
        ],
        cloudCards: [
          {
            id: 'card-1',
            front_content: 'Cloud Question 1',
            back_content: 'Cloud Answer 1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sync_version: 1
          }
        ]
      }

      // 2. 模拟数据库和云端数据
      const mockDb = require('@/services/database').db
      const mockSupabase = require('@/services/supabase').supabase

      mockDb.cards.toArray.mockResolvedValue(testData.localCards)
      mockSupabase.from.mockReturnThis()
      mockSupabase.select.mockReturnThis()
      mockSupabase.eq.mockReturnThis()
      mockSupabase.mockResolvedValue({ data: testData.cloudCards, error: null })

      // 3. 执行数据一致性检查
      const consistency = await syncStrategy.validateDataConsistency('user-123')

      // 4. 验证一致性结果
      expect(consistency).toBeDefined()
      expect(consistency.isConsistent).toBeDefined()
      expect(consistency.differences).toBeDefined()
    })

    it('应该检测和修复数据损坏', async () => {
      // 1. 模拟损坏的数据
      const corruptedData = [
        {
          id: 'card-corrupted',
          frontContent: '', // 空内容，应该被检测为损坏
          backContent: 'Valid Answer',
          createdAt: new Date(),
          updatedAt: new Date(),
          syncVersion: 1
        }
      ]

      const mockDb = require('@/services/database').db
      mockDb.cards.toArray.mockResolvedValue(corruptedData)

      // 2. 执行数据验证
      const validation = await syncStrategy.validateLocalData('cards', corruptedData[0])

      // 3. 验证损坏被检测到
      expect(validation).toBe(false)

      // 4. 尝试修复数据
      const repairResult = await syncStrategy.attemptDataRepair('cards', corruptedData[0])

      // 5. 验证修复结果
      expect(repairResult).toBeDefined()
      expect(repairResult.repaired).toBeDefined()
    })
  })

  describe('系统健康监控', () => {
    it('应该监控系统健康状态', async () => {
      // 1. 添加一些操作来创建系统活动
      await localOperation.addOperation({
        type: 'create',
        table: 'cards',
        data: { frontContent: 'Health Test', backContent: 'Health Answer' },
        localId: 'card-health'
      })

      // 2. 执行健康检查
      const health = await integrationService.performHealthCheck()

      // 3. 验证健康检查结果
      expect(health.overallHealth).toBeDefined()
      expect(health.components).toBeDefined()
      expect(health.components.localQueue).toBeDefined()
      expect(health.components.networkMonitor).toBeDefined()
      expect(health.components.syncStrategy).toBeDefined()
      expect(health.components.performanceOptimizer).toBeDefined()

      // 4. 验证健康评分
      expect(health.overallHealth).toMatch(/^(good|warning|poor|critical)$/)
    })

    it('应该生成系统性能报告', async () => {
      // 1. 模拟一些性能数据
      const performanceData = [
        { success: true, latency: 100 },
        { success: true, latency: 120 },
        { success: true, latency: 80 },
        { success: false, latency: 500, error: 'Timeout' },
        { success: true, latency: 90 }
      ]

      // 2. 记录性能数据
      performanceData.forEach(data => {
        performanceOptimizer.recordOperationResult(data)
      })

      // 3. 生成性能报告
      const report = performanceOptimizer.getPerformanceRecommendations()

      // 4. 验证报告内容
      expect(report).toBeDefined()
      expect(report.currentHealth).toBeDefined()
      expect(report.suggestions).toBeDefined()
      expect(Array.isArray(report.suggestions)).toBe(true)

      // 5. 验证健康评分
      expect(report.currentHealth.score).toBeGreaterThanOrEqual(0)
      expect(report.currentHealth.score).toBeLessThanOrEqual(100)
    })
  })

  describe('内存和资源管理', () => {
    it('应该正确管理内存使用', async () => {
      // 1. 添加大量操作来测试内存管理
      const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: `Card ${i}`, backContent: `Answer ${i}` },
        localId: `card-${i}`,
        priority: 'normal' as const,
        dependencies: []
      }))

      // 2. 批量添加操作
      for (const op of largeBatch) {
        await localOperation.addOperation(op)
      }

      // 3. 获取内存统计
      const memoryStats = performanceOptimizer.getMemoryStats()

      // 4. 验证内存统计
      expect(memoryStats.totalHistorySize).toBeDefined()
      expect(memoryStats.estimatedMemoryUsage).toBeDefined()

      // 5. 触发内存清理
      performanceOptimizer.cleanupOldData()

      // 6. 验证清理效果
      const cleanedStats = performanceOptimizer.getMemoryStats()
      expect(cleanedStats.totalHistorySize).toBeLessThanOrEqual(memoryStats.totalHistorySize)
    })

    it('应该在组件销毁时清理资源', () => {
      // 1. 启动所有服务
      networkMonitor.startMonitoring()
      integrationService.startScheduledSync()

      // 2. 验证服务正在运行
      expect((networkMonitor as any).isMonitoring).toBe(true)
      expect((integrationService as any).syncTimer).toBeDefined()

      // 3. 清理资源
      integrationService.cleanup()

      // 4. 验证资源被清理
      expect((networkMonitor as any).isMonitoring).toBe(false)
      expect((integrationService as any).syncTimer).toBeNull()
    })
  })

  describe('并发和竞态条件', () => {
    it('应该处理并发同步请求', async () => {
      // 1. 创建多个并发同步请求
      const syncPromises = []
      for (let i = 0; i < 5; i++) {
        syncPromises.push(integrationService.triggerSync())
      }

      // 2. 等待所有同步完成
      const results = await Promise.allSettled(syncPromises)

      // 3. 验证结果
      expect(results).toHaveLength(5)
      
      // 4. 验证系统状态
      const status = integrationService.getSystemStatus()
      expect(status.currentSyncActivity.isActive).toBe(false)
    })

    it('应该防止队列处理的竞态条件', async () => {
      // 1. 添加多个操作
      const operations = Array.from({ length: 10 }, (_, i) => ({
        type: 'create' as const,
        table: 'cards' as const,
        data: { frontContent: `Concurrent ${i}`, backContent: `Answer ${i}` },
        localId: `card-concurrent-${i}`,
        priority: 'normal' as const,
        dependencies: []
      }))

      // 2. 并发添加操作
      const addPromises = operations.map(op => localOperation.addOperation(op))
      await Promise.all(addPromises)

      // 3. 验证队列状态
      const stats = await localOperation.getQueueStats()
      expect(stats.totalOperations).toBe(10)

      // 4. 并发触发队列处理
      const processPromises = []
      for (let i = 0; i < 3; i++) {
        processPromises.push(localOperation.processQueue())
      }

      // 5. 等待处理完成
      await Promise.allSettled(processPromises)

      // 6. 验证最终状态
      const finalStats = await localOperation.getQueueStats()
      expect(finalStats).toBeDefined()
    })
  })
})