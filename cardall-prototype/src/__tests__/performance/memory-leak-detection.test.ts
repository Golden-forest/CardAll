/**
 * 内存泄漏检测测试
 * 测试应用的内存使用情况，确保没有内存泄漏
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { LocalOperationServiceOptimized } from '../../services/local-operation-service'
import { MultilevelCacheService } from '../../services/multilevel-cache-service'
import { CloudSyncServiceOptimized } from '../../services/cloud-sync-service'
import { OfflineManager } from '../../services/offline-manager'
import { MockDatabase } from '../utils/test-utils'
import { mockFactories, performanceTester, memoryLeakDetector } from '../utils/test-utils'

describe('内存泄漏检测测试', () => {
  let localService: LocalOperationServiceOptimized
  let cacheService: MultilevelCacheService
  let cloudService: CloudSyncServiceOptimized
  let offlineManager: OfflineManager
  let mockDb: MockDatabase

  beforeEach(async () => {
    // 重置模拟数据库
    mockDb = new MockDatabase()
    
    // 初始化服务
    cacheService = new MultilevelCacheService()
    localService = new LocalOperationServiceOptimized()
    cloudService = new CloudSyncServiceOptimized()
    offlineManager = new OfflineManager(localService, cloudService, cacheService)
    
    // 重置测试工具
    performanceTester.reset()
    memoryLeakDetector.clearSnapshots()
    
    // 清理所有模拟
    jest.clearAllMocks()
    
    // 设置内存基线
    memoryLeakDetector.setBaseline()
  })

  afterEach(async () => {
    // 清理资源
    await offlineManager.destroy()
    cacheService.stop()
    localService.destroy()
  })

  // ============================================================================
  // 基础服务内存测试
  // ============================================================================

  describe('基础服务内存使用', () => {
    test('LocalOperationService 应该正确管理内存', async () => {
      await localService.initialize()
      
      // 记录初始内存
      await memoryLeakDetector.takeSnapshot('local_service_initial')
      
      // 执行大量操作
      const operationCount = 100
      const cards = []
      
      for (let i = 0; i < operationCount; i++) {
        const cardData = mockFactories.createMockCard({
          frontContent: {
            title: `Memory Test Card ${i + 1}`,
            text: 'x'.repeat(1000) // 1KB content
          }
        })
        const result = await localService.createCard(cardData)
        cards.push(result)
      }
      
      // 记录操作后内存
      await memoryLeakDetector.takeSnapshot('local_service_after_operations')
      
      // 执行查询操作
      for (let i = 0; i < 50; i++) {
        await localService.getCards({ limit: 20 })
        if (cards[i]) {
          await localService.getCard(cards[i].id!)
        }
      }
      
      // 记录查询后内存
      await memoryLeakDetector.takeSnapshot('local_service_after_queries')
      
      // 清理缓存
      localService.clearCache()
      
      // 记录清理后内存
      await memoryLeakDetector.takeSnapshot('local_service_after_cleanup')
      
      // 检查内存增长
      const growthAfterOps = memoryLeakDetector.compareSnapshots('local_service_initial', 'local_service_after_operations')
      const growthAfterQueries = memoryLeakDetector.compareSnapshots('local_service_after_operations', 'local_service_after_queries')
      const growthAfterCleanup = memoryLeakDetector.compareSnapshots('local_service_after_queries', 'local_service_after_cleanup')
      
      // 操作期间内存增长应该合理
      expect(growthAfterOps).toBeLessThan(20) // 20MB
      
      // 查询操作不应该导致显著内存增长
      expect(growthAfterQueries).toBeLessThan(5) // 5MB
      
      // 清理后内存应该有所释放
      expect(growthAfterCleanup).toBeLessThan(0) // 应该释放内存
      
      // 检查总体内存泄漏
      const totalGrowth = memoryLeakDetector.getMemoryGrowthSinceBaseline()
      const leaks = memoryLeakDetector.detectLeaks(10) // 10MB阈值
      
      console.log(`LocalOperationService 内存增长: ${totalGrowth.toFixed(2)}MB`)
      if (leaks.length > 0) {
        console.warn('检测到潜在内存泄漏:', leaks)
      }
      
      // 内存增长应该在可接受范围内
      expect(totalGrowth).toBeLessThan(30) // 30MB
    })

    test('MultilevelCacheService 应该正确管理内存', async () => {
      // 记录初始内存
      await memoryLeakDetector.takeSnapshot('cache_service_initial')
      
      // 填充缓存
      const cacheItemCount = 1000
      for (let i = 0; i < cacheItemCount; i++) {
        await cacheService.set(`key_${i}`, {
          value: `value_${i}`,
          data: 'x'.repeat(1024), // 1KB data
          timestamp: Date.now()
        })
      }
      
      // 记录填充后内存
      await memoryLeakDetector.takeSnapshot('cache_service_after_fill')
      
      // 执行大量读取操作
      for (let i = 0; i < 5000; i++) {
        const key = `key_${Math.floor(Math.random() * cacheItemCount)}`
        await cacheService.get(key)
      }
      
      // 记录读取后内存
      await memoryLeakDetector.takeSnapshot('cache_service_after_reads')
      
      // 清理缓存
      await cacheService.clear()
      
      // 记录清理后内存
      await memoryLeakDetector.takeSnapshot('cache_service_after_clear')
      
      // 检查内存增长
      const growthAfterFill = memoryLeakDetector.compareSnapshots('cache_service_initial', 'cache_service_after_fill')
      const growthAfterReads = memoryLeakDetector.compareSnapshots('cache_service_after_fill', 'cache_service_after_reads')
      const growthAfterClear = memoryLeakDetector.compareSnapshots('cache_service_after_reads', 'cache_service_after_clear')
      
      // 缓存填充期间内存增长应该合理
      expect(growthAfterFill).toBeGreaterThan(0) // 应该增长
      expect(growthAfterFill).toBeLessThan(50) // 50MB
      
      // 读取操作不应该导致显著内存增长
      expect(growthAfterReads).toBeLessThan(5) // 5MB
      
      // 清理后内存应该大幅释放
      expect(growthAfterClear).toBeLessThan(-10) // 应该释放至少10MB
      
      // 验证缓存统计
      const stats = cacheService.getStats()
      expect(stats.l1.size).toBe(0)
      expect(stats.l2.size).toBe(0)
    })

    test('OfflineManager 应该正确管理内存', async () => {
      await offlineManager.initialize()
      
      // 记录初始内存
      await memoryLeakDetector.takeSnapshot('offline_manager_initial')
      
      // 模拟离线操作
      const operationCount = 50
      for (let i = 0; i < operationCount; i++) {
        const cardData = mockFactories.createMockCard({
          frontContent: {
            title: `Offline Memory Test ${i + 1}`,
            text: 'x'.repeat(2000) // 2KB content
          }
        })
        await offlineManager.createCard(cardData)
      }
      
      // 记录离线操作后内存
      await memoryLeakDetector.takeSnapshot('offline_manager_after_offline_ops')
      
      // 模拟网络状态变化
      for (let i = 0; i < 10; i++) {
        offlineManager.setNetworkStatus(i % 2 === 0)
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      
      // 记录状态变化后内存
      await memoryLeakDetector.takeSnapshot('offline_manager_after_status_changes')
      
      // 执行同步操作
      await offlineManager.syncPendingOperations()
      
      // 记录同步后内存
      await memoryLeakDetector.takeSnapshot('offline_manager_after_sync')
      
      // 清理资源
      await offlineManager.clearPendingOperations()
      
      // 记录清理后内存
      await memoryLeakDetector.takeSnapshot('offline_manager_after_cleanup')
      
      // 检查内存模式
      const growthAfterOps = memoryLeakDetector.compareSnapshots('offline_manager_initial', 'offline_manager_after_offline_ops')
      const growthAfterStatus = memoryLeakDetector.compareSnapshots('offline_manager_after_offline_ops', 'offline_manager_after_status_changes')
      const growthAfterSync = memoryLeakDetector.compareSnapshots('offline_manager_after_status_changes', 'offline_manager_after_sync')
      const growthAfterCleanup = memoryLeakDetector.compareSnapshots('offline_manager_after_sync', 'offline_manager_after_cleanup')
      
      // 离线操作期间内存增长应该合理
      expect(growthAfterOps).toBeLessThan(20) // 20MB
      
      // 状态变化不应该导致内存泄漏
      expect(growthAfterStatus).toBeLessThan(5) // 5MB
      
      // 同步后内存应该稳定
      expect(growthAfterSync).toBeLessThan(10) // 10MB
      
      // 清理后内存应该释放
      expect(growthAfterCleanup).toBeLessThan(0) // 应该释放内存
    })
  })

  // ============================================================================
  // 长时间运行测试
  // ============================================================================

  describe('长时间运行内存测试', () => {
    test('应该能够在长时间运行中保持内存稳定', async () => {
      await localService.initialize()
      
      // 记录初始状态
      await memoryLeakDetector.takeSnapshot('long_running_initial')
      
      // 模拟长时间运行（1000次操作）
      const operationCount = 1000
      const memorySnapshots = []
      
      for (let i = 0; i < operationCount; i++) {
        // 创建卡片
        const cardData = mockFactories.createMockCard({
          frontContent: {
            title: `Long Running Test ${i + 1}`,
            text: `Operation ${i + 1} of ${operationCount}`
          }
        })
        await localService.createCard(cardData)
        
        // 定期查询
        if (i % 100 === 0) {
          await localService.getCards({ limit: 50 })
          
          // 每200次操作记录一次内存快照
          if (i % 200 === 0) {
            await memoryLeakDetector.takeSnapshot(`long_running_op_${i}`)
            memorySnapshots.push(i)
          }
        }
        
        // 模拟一些删除操作
        if (i > 100 && i % 50 === 0) {
          const cards = await localService.getCards({ limit: 5 })
          if (cards.length > 0) {
            await localService.deleteCard(cards[0].id!)
          }
        }
      }
      
      // 记录最终状态
      await memoryLeakDetector.takeSnapshot('long_running_final')
      
      // 清理缓存
      localService.clearCache()
      await memoryLeakDetector.takeSnapshot('long_running_after_cleanup')
      
      // 分析内存趋势
      const memoryTrend = []
      for (let i = 0; i < memorySnapshots.length; i++) {
        const snapshotName = `long_running_op_${memorySnapshots[i]}`
        const nextSnapshotName = i < memorySnapshots.length - 1 ? 
          `long_running_op_${memorySnapshots[i + 1]}` : 'long_running_final'
        
        const growth = memoryLeakDetector.compareSnapshots(snapshotName, nextSnapshotName)
        memoryTrend.push({
          operation: memorySnapshots[i],
          memoryGrowth: growth
        })
      }
      
      // 计算总体内存增长
      const totalGrowth = memoryLeakDetector.compareSnapshots('long_running_initial', 'long_running_final')
      const growthAfterCleanup = memoryLeakDetector.compareSnapshots('long_running_final', 'long_running_after_cleanup')
      
      console.log('长时间运行内存趋势:', memoryTrend)
      console.log(`总体内存增长: ${totalGrowth.toFixed(2)}MB`)
      console.log(`清理后内存变化: ${growthAfterCleanup.toFixed(2)}MB`)
      
      // 内存增长应该在可接受范围内
      expect(totalGrowth).toBeLessThan(50) // 50MB for 1000 operations
      
      // 清理后内存应该释放
      expect(growthAfterCleanup).toBeLessThan(0)
      
      // 内存增长趋势不应该持续上升
      const increasingTrends = memoryTrend.filter(t => t.memoryGrowth > 2).length
      expect(increasingTrends).toBeLessThan(memoryTrend.length / 2) // 不应该超过一半的快照显示显著增长
    })

    test('应该正确处理大规模数据集', async () => {
      await localService.initialize()
      
      // 记录初始内存
      await memoryLeakDetector.takeSnapshot('large_dataset_initial')
      
      // 创建大规模数据集
      const datasetSize = 500
      const batchSize = 50
      
      for (let batch = 0; batch < datasetSize / batchSize; batch++) {
        const batchCards = []
        for (let i = 0; i < batchSize; i++) {
          const cardData = mockFactories.createMockCard({
            frontContent: {
              title: `Large Dataset Card ${batch * batchSize + i + 1}`,
              text: 'x'.repeat(500) // 500B content
            }
          })
          batchCards.push(cardData)
        }
        
        // 批量创建
        await localService.bulkCreateCards(batchCards)
        
        // 每批处理后记录内存
        if (batch % 5 === 0) {
          await memoryLeakDetector.takeSnapshot(`large_dataset_batch_${batch}`)
        }
      }
      
      // 记录数据加载完成后的内存
      await memoryLeakDetector.takeSnapshot('large_dataset_loaded')
      
      // 执行复杂查询
      for (let i = 0; i < 100; i++) {
        await localService.searchCards({
          term: 'Dataset',
          limit: 20
        })
        
        await localService.getCards({
          sortBy: 'createdAt',
          sortOrder: 'desc',
          limit: 30
        })
      }
      
      // 记录查询后内存
      await memoryLeakDetector.takeSnapshot('large_dataset_after_queries')
      
      // 删除部分数据
      const cardsToDelete = await localService.getCards({ limit: 100 })
      for (const card of cardsToDelete) {
        await localService.deleteCard(card.id!)
      }
      
      // 记录删除后内存
      await memoryLeakDetector.takeSnapshot('large_dataset_after_deletes')
      
      // 清理资源
      localService.clearCache()
      await memoryLeakDetector.takeSnapshot('large_dataset_final')
      
      // 分析内存使用
      const totalGrowth = memoryLeakDetector.compareSnapshots('large_dataset_initial', 'large_dataset_loaded')
      const queryGrowth = memoryLeakDetector.compareSnapshots('large_dataset_loaded', 'large_dataset_after_queries')
      const deleteGrowth = memoryLeakDetector.compareSnapshots('large_dataset_after_queries', 'large_dataset_after_deletes')
      const cleanupGrowth = memoryLeakDetector.compareSnapshots('large_dataset_after_deletes', 'large_dataset_final')
      
      console.log(`数据加载内存增长: ${totalGrowth.toFixed(2)}MB`)
      console.log(`查询操作内存增长: ${queryGrowth.toFixed(2)}MB`)
      console.log(`删除操作内存变化: ${deleteGrowth.toFixed(2)}MB`)
      console.log(`清理后内存变化: ${cleanupGrowth.toFixed(2)}MB`)
      
      // 验证内存使用合理性
      expect(totalGrowth).toBeLessThan(30) // 500个卡片应该在30MB内
      expect(queryGrowth).toBeLessThan(5) // 查询不应该显著增加内存
      expect(cleanupGrowth).toBeLessThan(0) // 清理应该释放内存
      
      // 验证最终内存状态
      const finalGrowth = memoryLeakDetector.getMemoryGrowthSinceBaseline()
      expect(finalGrowth).toBeLessThan(20) // 最终内存增长应该小于20MB
    })
  })

  // ============================================================================
  // 事件监听器测试
  // ============================================================================

  describe('事件监听器内存泄漏测试', () => {
    test('应该正确管理事件监听器', async () => {
      await offlineManager.initialize()
      
      // 记录初始内存
      await memoryLeakDetector.takeSnapshot('event_listeners_initial')
      
      // 添加大量事件监听器
      const listeners = []
      const listenerCount = 100
      
      for (let i = 0; i < listenerCount; i++) {
        const listener = jest.fn()
        offlineManager.onOnline(listener)
        offlineManager.onOffline(listener)
        listeners.push(listener)
      }
      
      // 记录添加监听器后内存
      await memoryLeakDetector.takeSnapshot('event_listeners_after_add')
      
      // 触发事件以激活监听器
      for (let i = 0; i < 20; i++) {
        offlineManager.setNetworkStatus(i % 2 === 0)
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // 记录事件触发后内存
      await memoryLeakDetector.takeSnapshot('event_listeners_after_events')
      
      // 移除一半的监听器
      for (let i = 0; i < listenerCount / 2; i++) {
        offlineManager.offOnline(listeners[i])
        offlineManager.offOffline(listeners[i])
      }
      
      // 记录移除部分监听器后内存
      await memoryLeakDetector.takeSnapshot('event_listeners_after_partial_remove')
      
      // 移除所有监听器
      for (let i = listenerCount / 2; i < listenerCount; i++) {
        offlineManager.offOnline(listeners[i])
        offlineManager.offOffline(listeners[i])
      }
      
      // 记录移除所有监听器后内存
      await memoryLeakDetector.takeSnapshot('event_listeners_after_all_remove')
      
      // 分析内存变化
      const growthAfterAdd = memoryLeakDetector.compareSnapshots('event_listeners_initial', 'event_listeners_after_add')
      const growthAfterEvents = memoryLeakDetector.compareSnapshots('event_listeners_after_add', 'event_listeners_after_events')
      const growthAfterPartialRemove = memoryLeakDetector.compareSnapshots('event_listeners_after_events', 'event_listeners_after_partial_remove')
      const growthAfterAllRemove = memoryLeakDetector.compareSnapshots('event_listeners_after_partial_remove', 'event_listeners_after_all_remove')
      
      console.log(`添加监听器内存增长: ${growthAfterAdd.toFixed(2)}MB`)
      console.log(`事件触发内存增长: ${growthAfterEvents.toFixed(2)}MB`)
      console.log(`部分移除内存变化: ${growthAfterPartialRemove.toFixed(2)}MB`)
      console.log(`全部移除内存变化: ${growthAfterAllRemove.toFixed(2)}MB`)
      
      // 添加监听器应该有一些内存增长
      expect(growthAfterAdd).toBeGreaterThan(0)
      expect(growthAfterAdd).toBeLessThan(10) // 10MB
      
      // 事件触发不应该导致显著内存增长
      expect(growthAfterEvents).toBeLessThan(2) // 2MB
      
      // 移除监听器应该释放内存
      expect(growthAfterPartialRemove).toBeLessThan(0)
      expect(growthAfterAllRemove).toBeLessThan(0)
      
      // 最终内存应该接近初始状态
      const totalGrowth = memoryLeakDetector.compareSnapshots('event_listeners_initial', 'event_listeners_after_all_remove')
      expect(totalGrowth).toBeLessThan(5) // 5MB
    })

    test('应该防止监听器重复添加', async () => {
      await offlineManager.initialize()
      
      const listener = jest.fn()
      
      // 重复添加同一个监听器
      for (let i = 0; i < 10; i++) {
        offlineManager.onOnline(listener)
      }
      
      // 记录内存
      await memoryLeakDetector.takeSnapshot('duplicate_listeners')
      
      // 触发事件
      offlineManager.setNetworkStatus(false)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // 验证监听器只被调用一次
      expect(listener).toHaveBeenCalledTimes(1)
      
      // 移除监听器（应该只需要移除一次）
      offlineManager.offOnline(listener)
      
      // 再次触发事件
      offlineManager.setNetworkStatus(true)
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // 验证监听器不再被调用
      expect(listener).toHaveBeenCalledTimes(1)
      
      // 记录最终内存
      await memoryLeakDetector.takeSnapshot('duplicate_listeners_final')
      
      // 内存增长应该很小
      const totalGrowth = memoryLeakDetector.compareSnapshots('duplicate_listeners', 'duplicate_listeners_final')
      expect(totalGrowth).toBeLessThan(1) // 1MB
    })
  })

  // ============================================================================
  // 定时器和异步操作测试
  // ============================================================================

  describe('定时器和异步操作内存测试', () => {
    test('应该正确管理定时器', async () => {
      await localService.initialize()
      
      // 记录初始内存
      await memoryLeakDetector.takeSnapshot('timers_initial')
      
      // 创建多个定时器
      const timers = []
      const timerCount = 20
      
      for (let i = 0; i < timerCount; i++) {
        const timer = setInterval(() => {
          // 模拟一些工作
          const data = new Array(1000).fill(`timer_data_${i}`)
        }, 100)
        timers.push(timer)
      }
      
      // 等待定时器运行一段时间
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 记录定时器运行后内存
      await memoryLeakDetector.takeSnapshot('timers_running')
      
      // 清理所有定时器
      timers.forEach(timer => clearInterval(timer))
      
      // 等待清理完成
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 记录清理后内存
      await memoryLeakDetector.takeSnapshot('timers_cleaned')
      
      // 分析内存变化
      const growthWhileRunning = memoryLeakDetector.compareSnapshots('timers_initial', 'timers_running')
      const growthAfterCleanup = memoryLeakDetector.compareSnapshots('timers_running', 'timers_cleaned')
      
      console.log(`定时器运行内存增长: ${growthWhileRunning.toFixed(2)}MB`)
      console.log(`定时器清理内存变化: ${growthAfterCleanup.toFixed(2)}MB`)
      
      // 定时器运行期间内存增长应该合理
      expect(growthWhileRunning).toBeLessThan(10) // 10MB
      
      // 清理后内存应该释放
      expect(growthAfterCleanup).toBeLessThan(0)
      
      // 最终内存应该接近初始状态
      const totalGrowth = memoryLeakDetector.compareSnapshots('timers_initial', 'timers_cleaned')
      expect(totalGrowth).toBeLessThan(5) // 5MB
    })

    test('应该正确管理异步操作队列', async () => {
      await offlineManager.initialize()
      
      // 记录初始内存
      await memoryLeakDetector.takeSnapshot('async_queue_initial')
      
      // 创建大量异步操作
      const asyncOperations = []
      const operationCount = 200
      
      for (let i = 0; i < operationCount; i++) {
        const operation = new Promise<void>(async (resolve) => {
          // 模拟异步工作
          await new Promise(r => setTimeout(r, Math.random() * 100))
          
          // 创建一些数据
          const data = {
            id: i,
            content: 'x'.repeat(1000),
            timestamp: Date.now()
          }
          
          resolve()
        })
        asyncOperations.push(operation)
      }
      
      // 等待所有操作完成
      await Promise.all(asyncOperations)
      
      // 记录操作完成后内存
      await memoryLeakDetector.takeSnapshot('async_queue_completed')
      
      // 强制垃圾回收（如果可用）
      if (typeof gc !== 'undefined') {
        gc()
      }
      
      // 记录垃圾回收后内存
      await memoryLeakDetector.takeSnapshot('async_queue_after_gc')
      
      // 分析内存变化
      const growthAfterOps = memoryLeakDetector.compareSnapshots('async_queue_initial', 'async_queue_completed')
      const growthAfterGC = memoryLeakDetector.compareSnapshots('async_queue_completed', 'async_queue_after_gc')
      
      console.log(`异步操作内存增长: ${growthAfterOps.toFixed(2)}MB`)
      console.log(`垃圾回收内存变化: ${growthAfterGC.toFixed(2)}MB`)
      
      // 异步操作期间内存增长应该合理
      expect(growthAfterOps).toBeLessThan(20) // 20MB for 200 operations
      
      // 垃圾回收应该释放一些内存
      expect(growthAfterGC).toBeLessThan(0)
      
      // 验证没有内存泄漏
      const totalGrowth = memoryLeakDetector.getMemoryGrowthSinceBaseline()
      const leaks = memoryLeakDetector.detectLeaks(5) // 5MB阈值
      
      if (leaks.length > 0) {
        console.warn('检测到内存泄漏:', leaks)
      }
      
      expect(leaks.length).toBe(0)
    })
  })

  // ============================================================================
  // 内存压力测试
  // ============================================================================

  describe('内存压力测试', () => {
    test('应该在高内存压力下保持稳定', async () => {
      await localService.initialize()
      
      // 记录初始内存
      await memoryLeakDetector.takeSnapshot('pressure_initial')
      
      // 创建内存压力场景
      const pressureData = []
      const dataCount = 1000
      
      for (let i = 0; i < dataCount; i++) {
        const largeData = {
          id: i,
          content: 'x'.repeat(10000), // 10KB per item
          metadata: {
            array: new Array(1000).fill(i),
            object: {
              nested: {
                data: `pressure_test_${i}`
              }
            }
          }
        }
        pressureData.push(largeData)
        
        // 每100个项目创建一个卡片
        if (i % 100 === 0) {
          const cardData = mockFactories.createMockCard({
            frontContent: {
              title: `Pressure Test Card ${i}`,
              text: JSON.stringify(largeData)
            }
          })
          await localService.createCard(cardData)
        }
      }
      
      // 记录压力后内存
      await memoryLeakDetector.takeSnapshot('pressure_after_load')
      
      // 执行查询操作
      for (let i = 0; i < 50; i++) {
        await localService.getCards({ limit: 100 })
        await localService.searchCards({ term: 'Pressure', limit: 50 })
      }
      
      // 记录查询后内存
      await memoryLeakDetector.takeSnapshot('pressure_after_queries')
      
      // 清理数据
      pressureData.length = 0
      
      // 记录清理后内存
      await memoryLeakDetector.takeSnapshot('pressure_after_cleanup')
      
      // 清理服务缓存
      localService.clearCache()
      await memoryLeakDetector.takeSnapshot('pressure_final')
      
      // 分析内存变化
      const growthAfterLoad = memoryLeakDetector.compareSnapshots('pressure_initial', 'pressure_after_load')
      const growthAfterQueries = memoryLeakDetector.compareSnapshots('pressure_after_load', 'pressure_after_queries')
      const growthAfterDataCleanup = memoryLeakDetector.compareSnapshots('pressure_after_queries', 'pressure_after_cleanup')
      const growthAfterCacheCleanup = memoryLeakDetector.compareSnapshots('pressure_after_cleanup', 'pressure_final')
      
      console.log(`数据加载内存增长: ${growthAfterLoad.toFixed(2)}MB`)
      console.log(`查询操作内存增长: ${growthAfterQueries.toFixed(2)}MB`)
      console.log(`数据清理内存变化: ${growthAfterDataCleanup.toFixed(2)}MB`)
      console.log(`缓存清理内存变化: ${growthAfterCacheCleanup.toFixed(2)}MB`)
      
      // 验证应用在高压力下仍然稳定
      expect(growthAfterLoad).toBeGreaterThan(0) // 应该有显著增长
      expect(growthAfterLoad).toBeLessThan(100) // 但应该在100MB内
      
      // 查询操作不应该导致过度增长
      expect(growthAfterQueries).toBeLessThan(10) // 10MB
      
      // 清理应该释放内存
      expect(growthAfterDataCleanup).toBeLessThan(-20) // 至少释放20MB
      expect(growthAfterCacheCleanup).toBeLessThan(0) // 缓存清理也应该释放内存
      
      // 验证最终内存状态合理
      const finalGrowth = memoryLeakDetector.getMemoryGrowthSinceBaseline()
      expect(finalGrowth).toBeLessThan(30) // 最终增长应该小于30MB
    })

    test('应该在内存不足时优雅降级', async () => {
      await cacheService.initialize()
      
      // 记录初始内存
      await memoryLeakDetector.takeSnapshot('memory_limit_initial')
      
      // 模拟接近内存限制
      const largeItems = 5000
      const items = []
      
      try {
        for (let i = 0; i < largeItems; i++) {
          const item = {
            id: `memory_limit_${i}`,
            data: 'x'.repeat(5000), // 5KB per item
            timestamp: Date.now()
          }
          
          await cacheService.set(item.id, item)
          items.push(item)
          
          // 每1000个项目检查一次内存
          if (i % 1000 === 0) {
            await memoryLeakDetector.takeSnapshot(`memory_limit_check_${i}`)
            
            const currentGrowth = memoryLeakDetector.getMemoryGrowthSinceBaseline()
            console.log(`项目 ${i}, 内存增长: ${currentGrowth.toFixed(2)}MB`)
            
            // 如果内存增长过大，停止测试
            if (currentGrowth > 50) {
              console.log(`内存增长超过50MB，在项目 ${i} 处停止`)
              break
            }
          }
        }
      } catch (error) {
        console.log('捕获到内存错误:', error)
        // 预期可能会捕获到内存相关的错误
      }
      
      // 记录最终状态
      await memoryLeakDetector.takeSnapshot('memory_limit_final')
      
      // 清理缓存
      await cacheService.clear()
      await memoryLeakDetector.takeSnapshot('memory_limit_after_clear')
      
      // 验证服务在内存压力下仍然可用
      const testItem = { id: 'test_after_pressure', data: 'test' }
      await cacheService.set(testItem.id, testItem)
      const retrieved = await cacheService.get(testItem.id)
      
      expect(retrieved).toEqual(testItem)
      
      // 验证清理效果
      const finalGrowth = memoryLeakDetector.compareSnapshots('memory_limit_initial', 'memory_limit_after_clear')
      console.log(`最终内存增长: ${finalGrowth.toFixed(2)}MB`)
      
      // 清理后内存应该显著释放
      expect(finalGrowth).toBeLessThan(10) // 10MB
    })
  })

  // ============================================================================
  // 内存泄漏检测结果
  // ============================================================================

  describe('内存泄漏检测结果汇总', () => {
    test('应该生成内存泄漏检测报告', async () => {
      // 执行一系列内存测试
      await localService.initialize()
      
      // 基础操作测试
      for (let i = 0; i < 100; i++) {
        const cardData = mockFactories.createMockCard()
        await localService.createCard(cardData)
      }
      
      await memoryLeakDetector.takeSnapshot('report_initial_ops')
      
      // 查询测试
      for (let i = 0; i < 50; i++) {
        await localService.getCards({ limit: 20 })
        await localService.searchCards({ term: 'test', limit: 10 })
      }
      
      await memoryLeakDetector.takeSnapshot('report_after_queries')
      
      // 清理测试
      localService.clearCache()
      await memoryLeakDetector.takeSnapshot('report_after_cleanup')
      
      // 生成内存泄漏报告
      const leaks = memoryLeakDetector.detectLeaks(2) // 2MB阈值
      const totalGrowth = memoryLeakDetector.getMemoryGrowthSinceBaseline()
      
      // 生成报告
      const memoryReport = {
        totalMemoryGrowthMB: totalGrowth,
        potentialLeaks: leaks,
        testPhases: [
          {
            phase: 'initial_ops',
            memoryGrowth: memoryLeakDetector.compareSnapshots('report_initial_ops', 'report_after_queries')
          },
          {
            phase: 'queries',
            memoryGrowth: memoryLeakDetector.compareSnapshots('report_after_queries', 'report_after_cleanup')
          },
          {
            phase: 'cleanup',
            memoryGrowth: memoryLeakDetector.compareSnapshots('report_after_cleanup', 'report_initial_ops')
          }
        ],
        recommendations: []
      }
      
      // 添加建议
      if (memoryReport.totalMemoryGrowthMB > 20) {
        memoryReport.recommendations.push('考虑优化数据结构以减少内存使用')
      }
      
      if (memoryReport.potentialLeaks.length > 0) {
        memoryReport.recommendations.push('检测到潜在内存泄漏，建议检查事件监听器和定时器清理')
      }
      
      if (memoryReport.totalMemoryGrowthMB < 5) {
        memoryReport.recommendations.push('内存管理表现优秀')
      }
      
      console.log('内存泄漏检测报告:', JSON.stringify(memoryReport, null, 2))
      
      // 验证报告质量
      expect(memoryReport.totalMemoryGrowthMB).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(memoryReport.potentialLeaks)).toBe(true)
      expect(memoryReport.testPhases.length).toBe(3)
      expect(Array.isArray(memoryReport.recommendations)).toBe(true)
      
      // 验证总体内存使用合理
      expect(memoryReport.totalMemoryGrowthMB).toBeLessThan(30)
      
      // 返回报告以便进一步分析
      return memoryReport
    })
  })
})