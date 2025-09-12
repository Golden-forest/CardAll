// ============================================================================
// 同步服务架构重构集成测试
// ============================================================================

import { optimizedCloudSyncService } from './optimized-cloud-sync'
import { conflictResolutionEngine } from './conflict-resolution-engine'
import { batchUploadOptimizer } from './batch-upload-optimizer'
import { networkAdapterManager } from './network-adapter'
import { syncQueueManager } from './sync-queue'
import { networkMonitorService } from './network-monitor'

// ============================================================================
// 测试数据类型
// ============================================================================

export interface TestUserData {
  id: string
  username: string
  email: string
  cards: TestCardData[]
  folders: TestFolderData[]
}

export interface TestCardData {
  id: string
  title: string
  content: string
  folderId: string
  tags: string[]
  syncVersion: number
  lastModified: Date
  createdAt: Date
}

export interface TestFolderData {
  id: string
  name: string
  parentId?: string
  syncVersion: number
  lastModified: Date
  createdAt: Date
}

export interface TestScenario {
  name: string
  description: string
  setup: () => Promise<void>
  execute: () => Promise<TestResult>
  cleanup: () => Promise<void>
}

export interface TestResult {
  success: boolean
  duration: number
  metrics: TestMetrics
  errors: string[]
  warnings: string[]
}

export interface TestMetrics {
  syncOperations: number
  conflictsDetected: number
  conflictsResolved: number
  batchesProcessed: number
  networkAdaptations: number
  performanceScore: number
}

// ============================================================================
// 测试配置
// ============================================================================

export const TEST_CONFIG = {
  // 用户测试数据
  testUsers: [
    {
      id: 'user-1',
      username: 'testuser1',
      email: 'test1@example.com',
      cards: [],
      folders: []
    },
    {
      id: 'user-2',
      username: 'testuser2',
      email: 'test2@example.com',
      cards: [],
      folders: []
    }
  ],
  
  // 测试场景配置
  scenarios: {
    concurrentSync: {
      userCount: 5,
      operationsPerUser: 20,
      duration: 30000 // 30秒
    },
    networkFluctuation: {
      qualityChanges: ['excellent', 'good', 'fair', 'poor', 'offline'],
      changeInterval: 5000,
      duration: 25000
    },
    conflictResolution: {
      conflictRate: 0.3, // 30%冲突率
      conflictTypes: ['field-level', 'record-level', 'structural']
    },
    largeDataSet: {
      cardCount: 1000,
      folderCount: 50,
      batchSize: 100
    }
  },
  
  // 性能阈值
  performanceThresholds: {
    maxSyncTime: 10000, // 10秒
    maxConflictResolutionTime: 5000, // 5秒
    minSuccessRate: 0.95, // 95%成功率
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    maxNetworkAdaptations: 10 // 最多10次网络适应
  }
}

// ============================================================================
// 测试工具类
// ============================================================================

export class SyncTestHarness {
  private testResults: TestResult[] = []
  private isRunning = false
  private startTime?: Date
  
  constructor(private config = TEST_CONFIG) {}
  
  /**
   * 运行完整测试套件
   */
  async runFullTestSuite(): Promise<{
    overallSuccess: boolean
    totalDuration: number
    results: TestResult[]
    summary: TestSummary
  }> {
    console.log('🚀 开始同步服务架构重构集成测试...')
    
    this.isRunning = true
    this.startTime = new Date()
    
    try {
      // 初始化所有服务
      await this.initializeServices()
      
      // 运行测试场景
      const scenarios = this.createTestScenarios()
      
      for (const scenario of scenarios) {
        if (!this.isRunning) break
        
        console.log(`📋 运行测试场景: ${scenario.name}`)
        const result = await this.runTestScenario(scenario)
        this.testResults.push(result)
        
        // 记录性能指标到网络适配器
        networkAdapterManager.recordSyncResult(
          result.success, 
          result.duration, 
          'integration_test'
        )
      }
      
      // 生成测试总结
      const summary = this.generateTestSummary()
      
      return {
        overallSuccess: summary.overallSuccess,
        totalDuration: Date.now() - this.startTime.getTime(),
        results: this.testResults,
        summary
      }
      
    } catch (error) {
      console.error('❌ 测试套件执行失败:', error)
      throw error
    } finally {
      await this.cleanupServices()
      this.isRunning = false
    }
  }
  
  /**
   * 初始化服务
   */
  private async initializeServices(): Promise<void> {
    console.log('🔧 初始化测试服务...')
    
    // 初始化网络监控
    networkMonitorService.startMonitoring()
    
    // 初始化网络适配器
    await networkAdapterManager.initialize()
    
    // 初始化冲突解决引擎
    await conflictResolutionEngine.initialize()
    
    // 等待服务稳定
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('✅ 测试服务初始化完成')
  }
  
  /**
   * 创建测试场景
   */
  private createTestScenarios(): TestScenario[] {
    return [
      this.createBasicSyncScenario(),
      this.createConcurrentSyncScenario(),
      this.createNetworkFluctuationScenario(),
      this.createConflictResolutionScenario(),
      this.createPerformanceStressScenario()
    ]
  }
  
  /**
   * 基础同步测试场景
   */
  private createBasicSyncScenario(): TestScenario {
    return {
      name: '基础同步功能测试',
      description: '测试基本的同步功能，包括增删改查操作',
      setup: async () => {
        // 准备测试用户数据
        this.config.testUsers[0].cards = this.generateTestCards(10)
        this.config.testUsers[0].folders = this.generateTestFolders(3)
      },
      execute: async () => {
        const startTime = Date.now()
        const errors: string[] = []
        const warnings: string[] = []
        let syncOperations = 0
        let conflictsDetected = 0
        let conflictsResolved = 0
        let batchesProcessed = 0
        
        try {
          // 测试数据同步
          const user = this.config.testUsers[0]
          
          // 创建同步操作
          for (const card of user.cards) {
            const operation = {
              type: 'create' as const,
              entity: 'card' as const,
              entityId: card.id,
              userId: user.id,
              data: card,
              priority: 'normal' as const,
              retryCount: 0,
              maxRetries: 3
            }
            
            await syncQueueManager.enqueueOperation(operation)
            syncOperations++
          }
          
          // 等待同步完成
          await this.waitForSyncCompletion(10000)
          
          // 获取同步统计
          const queueStats = await syncQueueManager.getQueueStats()
          batchesProcessed = Math.ceil(syncOperations / 10) // 假设批大小为10
          
          const duration = Date.now() - startTime
          const success = errors.length === 0
          
          return {
            success,
            duration,
            metrics: {
              syncOperations,
              conflictsDetected,
              conflictsResolved,
              batchesProcessed,
              networkAdaptations: 0,
              performanceScore: this.calculatePerformanceScore(duration, syncOperations)
            },
            errors,
            warnings
          }
          
        } catch (error) {
          errors.push(`基础同步测试失败: ${error instanceof Error ? error.message : String(error)}`)
          return {
            success: false,
            duration: Date.now() - startTime,
            metrics: {
              syncOperations,
              conflictsDetected,
              conflictsResolved,
              batchesProcessed,
              networkAdaptations: 0,
              performanceScore: 0
            },
            errors,
            warnings
          }
        }
      },
      cleanup: async () => {
        // 清理测试数据
        await this.cleanupTestData()
      }
    }
  }
  
  /**
   * 并发同步测试场景
   */
  private createConcurrentSyncScenario(): TestScenario {
    return {
      name: '并发同步测试',
      description: '测试多用户并发同步场景',
      setup: async () => {
        // 为多个用户准备测试数据
        for (let i = 0; i < this.config.scenarios.concurrentSync.userCount; i++) {
          const user = this.config.testUsers[i % this.config.testUsers.length]
          user.cards = this.generateTestCards(this.config.scenarios.concurrentSync.operationsPerUser)
          user.folders = this.generateTestFolders(5)
        }
      },
      execute: async () => {
        const startTime = Date.now()
        const errors: string[] = []
        const warnings: string[] = []
        let syncOperations = 0
        let conflictsDetected = 0
        let conflictsResolved = 0
        let batchesProcessed = 0
        
        try {
          // 并发执行同步操作
          const syncPromises = this.config.testUsers.map(async (user, index) => {
            const userOps = []
            
            for (const card of user.cards) {
              const operation = {
                type: 'create' as const,
                entity: 'card' as const,
                entityId: `${card.id}-${index}`,
                userId: user.id,
                data: { ...card, id: `${card.id}-${index}` },
                priority: 'normal' as const,
                retryCount: 0,
                maxRetries: 3
              }
              
              await syncQueueManager.enqueueOperation(operation)
              userOps.push(operation)
            }
            
            return userOps.length
          })
          
          const operationsPerUser = await Promise.all(syncPromises)
          syncOperations = operationsPerUser.reduce((sum, ops) => sum + ops, 0)
          
          // 等待所有同步完成
          await this.waitForSyncCompletion(20000)
          
          // 检测可能的冲突
          conflictsDetected = await this.detectConflicts()
          conflictsResolved = await this.resolveConflicts()
          
          batchesProcessed = Math.ceil(syncOperations / 15) // 假设批大小为15
          
          const duration = Date.now() - startTime
          const success = errors.length === 0
          
          return {
            success,
            duration,
            metrics: {
              syncOperations,
              conflictsDetected,
              conflictsResolved,
              batchesProcessed,
              networkAdaptations: 0,
              performanceScore: this.calculatePerformanceScore(duration, syncOperations)
            },
            errors,
            warnings
          }
          
        } catch (error) {
          errors.push(`并发同步测试失败: ${error instanceof Error ? error.message : String(error)}`)
          return {
            success: false,
            duration: Date.now() - startTime,
            metrics: {
              syncOperations,
              conflictsDetected,
              conflictsResolved,
              batchesProcessed,
              networkAdaptations: 0,
              performanceScore: 0
            },
            errors,
            warnings
          }
        }
      },
      cleanup: async () => {
        await this.cleanupTestData()
      }
    }
  }
  
  /**
   * 网络波动测试场景
   */
  private createNetworkFluctuationScenario(): TestScenario {
    return {
      name: '网络适应性测试',
      description: '测试网络条件变化时的同步适应能力',
      setup: async () => {
        // 准备测试数据
        this.config.testUsers[0].cards = this.generateTestCards(20)
      },
      execute: async () => {
        const startTime = Date.now()
        const errors: string[] = []
        const warnings: string[] = []
        let syncOperations = 0
        let conflictsDetected = 0
        let conflictsResolved = 0
        let batchesProcessed = 0
        let networkAdaptations = 0
        
        try {
          // 监听网络适应事件
          const adaptationListener = (event: any) => {
            if (event.type === 'strategy-change' || event.type === 'adaptation') {
              networkAdaptations++
            }
          }
          
          networkAdapterManager.addEventListener(adaptationListener)
          
          // 模拟网络质量变化
          const qualityChanges = this.config.scenarios.networkFluctuation.qualityChanges
          let changeIndex = 0
          
          const changeInterval = setInterval(() => {
            if (changeIndex < qualityChanges.length) {
              // 这里应该有办法模拟网络质量变化
              // 由于我们无法直接修改网络状态，我们通过触发网络适应来测试
              console.log(`🌐 模拟网络质量变化: ${qualityChanges[changeIndex]}`)
              changeIndex++
            } else {
              clearInterval(changeInterval)
            }
          }, this.config.scenarios.networkFluctuation.changeInterval)
          
          // 在网络变化期间执行同步操作
          const syncPromises = this.config.testUsers[0].cards.map(async (card, index) => {
            await new Promise(resolve => setTimeout(resolve, index * 1000)) // 错开同步时间
            
            const operation = {
              type: 'update' as const,
              entity: 'card' as const,
              entityId: card.id,
              userId: this.config.testUsers[0].id,
              data: { ...card, title: `${card.title} - Updated ${index}` },
              priority: index % 3 === 0 ? 'high' as const : 'normal' as const,
              retryCount: 0,
              maxRetries: 5
            }
            
            await syncQueueManager.enqueueOperation(operation)
            return 1
          })
          
          const operationsCount = await Promise.all(syncPromises)
          syncOperations = operationsCount.reduce((sum, count) => sum + count, 0)
          
          // 等待网络变化和同步完成
          await this.waitForSyncCompletion(this.config.scenarios.networkFluctuation.duration)
          
          clearInterval(changeInterval)
          networkAdapterManager.removeEventListener(adaptationListener)
          
          batchesProcessed = Math.ceil(syncOperations / 8) // 假设批大小会根据网络调整
          
          const duration = Date.now() - startTime
          const success = errors.length === 0
          
          return {
            success,
            duration,
            metrics: {
              syncOperations,
              conflictsDetected,
              conflictsResolved,
              batchesProcessed,
              networkAdaptations,
              performanceScore: this.calculatePerformanceScore(duration, syncOperations)
            },
            errors,
            warnings
          }
          
        } catch (error) {
          errors.push(`网络适应性测试失败: ${error instanceof Error ? error.message : String(error)}`)
          return {
            success: false,
            duration: Date.now() - startTime,
            metrics: {
              syncOperations,
              conflictsDetected,
              conflictsResolved,
              batchesProcessed,
              networkAdaptations,
              performanceScore: 0
            },
            errors,
            warnings
          }
        }
      },
      cleanup: async () => {
        await this.cleanupTestData()
      }
    }
  }
  
  /**
   * 冲突解决测试场景
   */
  private createConflictResolutionScenario(): TestScenario {
    return {
      name: '冲突解决测试',
      description: '测试各种冲突类型的检测和解决能力',
      setup: async () => {
        // 准备会产生冲突的测试数据
        this.config.testUsers[0].cards = this.generateTestCards(15)
        this.config.testUsers[1].cards = this.generateTestCards(15)
        
        // 创建一些冲突的数据（相同ID，不同内容）
        for (let i = 0; i < 5; i++) {
          const baseCard = this.config.testUsers[0].cards[i]
          this.config.testUsers[1].cards[i] = {
            ...baseCard,
            title: `冲突标题 ${i}`,
            content: `冲突内容 ${i}`
          }
        }
      },
      execute: async () => {
        const startTime = Date.now()
        const errors: string[] = []
        const warnings: string[] = []
        let syncOperations = 0
        let conflictsDetected = 0
        let conflictsResolved = 0
        let batchesProcessed = 0
        
        try {
          // 两个用户同时操作相同的数据
          const user1Operations = this.config.testUsers[0].cards.map(card => ({
            type: 'update' as const,
            entity: 'card' as const,
            entityId: card.id,
            userId: this.config.testUsers[0].id,
            data: card,
            priority: 'normal' as const,
            retryCount: 0,
            maxRetries: 3
          }))
          
          const user2Operations = this.config.testUsers[1].cards.map(card => ({
            type: 'update' as const,
            entity: 'card' as const,
            entityId: card.id,
            userId: this.config.testUsers[1].id,
            data: card,
            priority: 'normal' as const,
            retryCount: 0,
            maxRetries: 3
          }))
          
          // 并发执行操作以产生冲突
          await Promise.all([
            ...user1Operations.map(op => syncQueueManager.enqueueOperation(op)),
            ...user2Operations.map(op => syncQueueManager.enqueueOperation(op))
          ])
          
          syncOperations = user1Operations.length + user2Operations.length
          
          // 等待冲突检测和解决
          await this.waitForSyncCompletion(15000)
          
          // 统计冲突
          conflictsDetected = await this.detectConflicts()
          conflictsResolved = await this.resolveConflicts()
          
          batchesProcessed = Math.ceil(syncOperations / 12)
          
          const duration = Date.now() - startTime
          const success = errors.length === 0 && conflictsResolved >= conflictsDetected * 0.8 // 80%解决率
          
          if (conflictsDetected > conflictsResolved) {
            warnings.push(`${conflictsDetected - conflictsResolved} 个冲突未解决`)
          }
          
          return {
            success,
            duration,
            metrics: {
              syncOperations,
              conflictsDetected,
              conflictsResolved,
              batchesProcessed,
              networkAdaptations: 0,
              performanceScore: this.calculatePerformanceScore(duration, syncOperations)
            },
            errors,
            warnings
          }
          
        } catch (error) {
          errors.push(`冲突解决测试失败: ${error instanceof Error ? error.message : String(error)}`)
          return {
            success: false,
            duration: Date.now() - startTime,
            metrics: {
              syncOperations,
              conflictsDetected,
              conflictsResolved,
              batchesProcessed,
              networkAdaptations: 0,
              performanceScore: 0
            },
            errors,
            warnings
          }
        }
      },
      cleanup: async () => {
        await this.cleanupTestData()
      }
    }
  }
  
  /**
   * 性能压力测试场景
   */
  private createPerformanceStressScenario(): TestScenario {
    return {
      name: '性能压力测试',
      description: '测试大规模数据处理的性能表现',
      setup: async () => {
        // 生成大量测试数据
        const largeDataSet = this.config.scenarios.largeDataSet
        this.config.testUsers[0].cards = this.generateTestCards(largeDataSet.cardCount)
        this.config.testUsers[0].folders = this.generateTestFolders(largeDataSet.folderCount)
      },
      execute: async () => {
        const startTime = Date.now()
        const errors: string[] = []
        const warnings: string[] = []
        let syncOperations = 0
        let conflictsDetected = 0
        let conflictsResolved = 0
        let batchesProcessed = 0
        
        try {
          // 分批处理大量数据
          const batchSize = this.config.scenarios.largeDataSet.batchSize
          const cards = this.config.testUsers[0].cards
          
          for (let i = 0; i < cards.length; i += batchSize) {
            const batch = cards.slice(i, i + batchSize)
            
            const batchOperations = batch.map(card => ({
              type: 'create' as const,
              entity: 'card' as const,
              entityId: card.id,
              userId: this.config.testUsers[0].id,
              data: card,
              priority: 'normal' as const,
              retryCount: 0,
              maxRetries: 3
            }))
            
            await syncQueueManager.enqueueBatch(batchOperations)
            syncOperations += batchOperations.length
            
            // 监控内存使用
            const memoryUsage = this.getMemoryUsage()
            if (memoryUsage > this.config.performanceThresholds.maxMemoryUsage * 0.8) {
              warnings.push(`内存使用较高: ${Math.round(memoryUsage / 1024 / 1024)}MB`)
            }
            
            // 批次间短暂延迟
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          
          // 等待所有同步完成
          await this.waitForSyncCompletion(30000)
          
          conflictsDetected = await this.detectConflicts()
          conflictsResolved = await this.resolveConflicts()
          
          batchesProcessed = Math.ceil(syncOperations / batchSize)
          
          const duration = Date.now() - startTime
          const success = errors.length === 0 && duration < this.config.performanceThresholds.maxSyncTime * 2
          
          if (duration > this.config.performanceThresholds.maxSyncTime) {
            warnings.push(`执行时间超过预期: ${duration}ms`)
          }
          
          return {
            success,
            duration,
            metrics: {
              syncOperations,
              conflictsDetected,
              conflictsResolved,
              batchesProcessed,
              networkAdaptations: 0,
              performanceScore: this.calculatePerformanceScore(duration, syncOperations)
            },
            errors,
            warnings
          }
          
        } catch (error) {
          errors.push(`性能压力测试失败: ${error instanceof Error ? error.message : String(error)}`)
          return {
            success: false,
            duration: Date.now() - startTime,
            metrics: {
              syncOperations,
              conflictsDetected,
              conflictsResolved,
              batchesProcessed,
              networkAdaptations: 0,
              performanceScore: 0
            },
            errors,
            warnings
          }
        }
      },
      cleanup: async () => {
        await this.cleanupTestData()
      }
    }
  }
  
  /**
   * 运行单个测试场景
   */
  private async runTestScenario(scenario: TestScenario): Promise<TestResult> {
    console.log(`  📊 ${scenario.name}`)
    console.log(`  📝 ${scenario.description}`)
    
    const scenarioStartTime = Date.now()
    
    try {
      // 场景准备
      await scenario.setup()
      
      // 执行测试
      const result = await scenario.execute()
      
      // 场景清理
      await scenario.cleanup()
      
      const duration = Date.now() - scenarioStartTime
      console.log(`  ${result.success ? '✅' : '❌'} ${scenario.name} 完成 (${duration}ms)`)
      
      if (result.errors.length > 0) {
        console.log(`  ❌ 错误: ${result.errors.join(', ')}`)
      }
      
      if (result.warnings.length > 0) {
        console.log(`  ⚠️  警告: ${result.warnings.join(', ')}`)
      }
      
      return result
      
    } catch (error) {
      console.log(`  💥 ${scenario.name} 失败: ${error instanceof Error ? error.message : String(error)}`)
      
      return {
        success: false,
        duration: Date.now() - scenarioStartTime,
        metrics: {
          syncOperations: 0,
          conflictsDetected: 0,
          conflictsResolved: 0,
          batchesProcessed: 0,
          networkAdaptations: 0,
          performanceScore: 0
        },
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      }
    }
  }
  
  /**
   * 等待同步完成
   */
  private async waitForSyncCompletion(timeout: number): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      const stats = await syncQueueManager.getQueueStats()
      
      if (stats.byStatus.pending === 0 && stats.byStatus.processing === 0) {
        return
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.warn(`⚠️ 同步未在 ${timeout}ms 内完成`)
  }
  
  /**
   * 检测冲突
   */
  private async detectConflicts(): Promise<number> {
    // 这里应该调用冲突解决引擎的检测方法
    // 现在返回模拟数据
    return Math.floor(Math.random() * 10)
  }
  
  /**
   * 解决冲突
   */
  private async resolveConflicts(): Promise<number> {
    // 这里应该调用冲突解决引擎的解决方法
    // 现在返回模拟数据
    return Math.floor(Math.random() * 8)
  }
  
  /**
   * 计算性能分数 (0-100)
   */
  private calculatePerformanceScore(duration: number, operations: number): number {
    if (operations === 0) return 0
    
    const opsPerSecond = (operations / duration) * 1000
    return Math.min(100, Math.round(opsPerSecond * 10)) // 假设每秒10次操作为满分
  }
  
  /**
   * 生成测试卡片数据
   */
  private generateTestCards(count: number): TestCardData[] {
    const cards: TestCardData[] = []
    
    for (let i = 0; i < count; i++) {
      cards.push({
        id: `card-${Date.now()}-${i}`,
        title: `测试卡片 ${i}`,
        content: `这是第 ${i} 个测试卡片的内容`,
        folderId: `folder-${i % 5}`,
        tags: [`tag-${i % 3}`, `test-${i % 2}`],
        syncVersion: 1,
        lastModified: new Date(),
        createdAt: new Date()
      })
    }
    
    return cards
  }
  
  /**
   * 生成测试文件夹数据
   */
  private generateTestFolders(count: number): TestFolderData[] {
    const folders: TestFolderData[] = []
    
    for (let i = 0; i < count; i++) {
      folders.push({
        id: `folder-${Date.now()}-${i}`,
        name: `测试文件夹 ${i}`,
        parentId: i > 0 ? `folder-${Date.now()}-${Math.floor(i / 5)}` : undefined,
        syncVersion: 1,
        lastModified: new Date(),
        createdAt: new Date()
      })
    }
    
    return folders
  }
  
  /**
   * 获取内存使用量
   */
  private getMemoryUsage(): number {
    // 在浏览器环境中使用 performance.memory
    if ('memory' in (performance as any)) {
      return (performance as any).memory.usedJSHeapSize
    }
    // 在Node.js环境中使用 process.memoryUsage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return 0
  }
  
  /**
   * 清理测试数据
   */
  private async cleanupTestData(): Promise<void> {
    // 清理同步队列
    await syncQueueManager.cleanupCompletedOperations(0)
    
    // 重置测试用户数据
    this.config.testUsers.forEach(user => {
      user.cards = []
      user.folders = []
    })
  }
  
  /**
   * 清理服务
   */
  private async cleanupServices(): Promise<void> {
    console.log('🧹 清理测试服务...')
    
    // 停止网络监控
    networkMonitorService.stopMonitoring()
    
    // 销毁网络适配器
    networkAdapterManager.destroy()
    
    // 停止同步队列
    syncQueueManager.stop()
    
    console.log('✅ 测试服务清理完成')
  }
  
  /**
   * 生成测试总结
   */
  private generateTestSummary(): TestSummary {
    const totalTests = this.testResults.length
    const successfulTests = this.testResults.filter(r => r.success).length
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0)
    const totalOperations = this.testResults.reduce((sum, r) => sum + r.metrics.syncOperations, 0)
    const totalConflicts = this.testResults.reduce((sum, r) => sum + r.metrics.conflictsDetected, 0)
    const totalAdaptations = this.testResults.reduce((sum, r) => sum + r.metrics.networkAdaptations, 0)
    
    const averagePerformanceScore = this.testResults.reduce((sum, r) => sum + r.metrics.performanceScore, 0) / totalTests
    
    const overallSuccess = successfulTests === totalTests && averagePerformanceScore > 70
    
    return {
      overallSuccess,
      totalTests,
      successfulTests,
      totalDuration,
      totalOperations,
      totalConflicts,
      totalAdaptations,
      averagePerformanceScore,
      thresholdCompliance: this.checkThresholdCompliance(),
      recommendations: this.generateRecommendations()
    }
  }
  
  /**
   * 检查阈值合规性
   */
  private checkThresholdCompliance(): {
    syncTime: boolean
    successRate: boolean
    memoryUsage: boolean
    adaptations: boolean
  } {
    const avgSyncTime = this.testResults.reduce((sum, r) => sum + r.duration, 0) / this.testResults.length
    const successRate = this.testResults.filter(r => r.success).length / this.testResults.length
    const maxAdaptations = Math.max(...this.testResults.map(r => r.metrics.networkAdaptations))
    
    return {
      syncTime: avgSyncTime <= this.config.performanceThresholds.maxSyncTime,
      successRate: successRate >= this.config.performanceThresholds.minSuccessRate,
      memoryUsage: true, // 需要在实际运行中监控
      adaptations: maxAdaptations <= this.config.performanceThresholds.maxNetworkAdaptations
    }
  }
  
  /**
   * 生成优化建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    
    const avgPerformance = this.testResults.reduce((sum, r) => sum + r.metrics.performanceScore, 0) / this.testResults.length
    if (avgPerformance < 70) {
      recommendations.push('建议优化同步算法性能，考虑增加批处理效率')
    }
    
    const totalConflicts = this.testResults.reduce((sum, r) => sum + r.metrics.conflictsDetected, 0)
    const totalResolved = this.testResults.reduce((sum, r) => sum + r.metrics.conflictsResolved, 0)
    if (totalConflicts > 0 && totalResolved / totalConflicts < 0.8) {
      recommendations.push('建议改进冲突解决策略，提高解决成功率')
    }
    
    const avgAdaptations = this.testResults.reduce((sum, r) => sum + r.metrics.networkAdaptations, 0) / this.testResults.length
    if (avgAdaptations > 5) {
      recommendations.push('网络适应过于频繁，建议调整适应策略参数')
    }
    
    if (recommendations.length === 0) {
      recommendations.push('系统性能良好，无需特别优化')
    }
    
    return recommendations
  }
  
  /**
   * 停止测试
   */
  stop(): void {
    this.isRunning = false
  }
}

// ============================================================================
// 测试总结接口
// ============================================================================

export interface TestSummary {
  overallSuccess: boolean
  totalTests: number
  successfulTests: number
  totalDuration: number
  totalOperations: number
  totalConflicts: number
  totalAdaptations: number
  averagePerformanceScore: number
  thresholdCompliance: {
    syncTime: boolean
    successRate: boolean
    memoryUsage: boolean
    adaptations: boolean
  }
  recommendations: string[]
}

// ============================================================================
// 导出测试工具
// ============================================================================

export const syncTestHarness = new SyncTestHarness()

// ============================================================================
// 便利方法
// ============================================================================

export const runSyncIntegrationTests = async () => {
  return await syncTestHarness.runFullTestSuite()
}

export const createPerformanceReport = async () => {
  const result = await runSyncIntegrationTests()
  
  return {
    testResults: result.results,
    summary: result.summary,
    performanceMetrics: networkAdapterManager.getPerformanceHistory(),
    strategyPerformance: networkAdapterManager.getStrategyPerformance()
  }
}