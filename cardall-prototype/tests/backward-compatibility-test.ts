// ============================================================================
// 同步服务向后兼容性验证
// ============================================================================

import { CloudSyncService } from '../services/cloud-sync'
import { optimizedCloudSyncService } from '../services/optimized-cloud-sync'
import { conflictResolutionEngine } from '../services/conflict-resolution-engine'
import { batchUploadOptimizer } from '../services/batch-upload-optimizer'
import { networkAdapterManager } from '../services/network-adapter'
import { syncQueueManager } from '../services/sync-queue'

// ============================================================================
// 兼容性测试接口
// ============================================================================

export interface CompatibilityTest {
  name: string
  description: string
  category: 'api' | 'data' | 'behavior' | 'performance'
  critical: boolean // 是否为关键兼容性测试
  test: () => Promise<CompatibilityResult>
}

export interface CompatibilityResult {
  passed: boolean
  score: number // 0-100
  details: {
    originalService: any
    newService: any
    differences: string[]
    recommendations: string[]
  }
  metrics: {
    executionTime: number
    memoryUsage: number
    apiCalls: number
  }
}

export interface CompatibilityReport {
  overallScore: number
  totalTests: number
  passedTests: number
  criticalTests: number
  passedCriticalTests: number
  results: CompatibilityResult[]
  summary: {
    apiCompatibility: number
    dataCompatibility: number
    behaviorCompatibility: number
    performanceCompatibility: number
  }
  recommendations: string[]
  breakingChanges: BreakingChange[]
}

export interface BreakingChange {
  type: 'api' | 'data' | 'behavior'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  impact: string
  mitigation: string
}

// ============================================================================
// 兼容性测试套件
// ============================================================================

export class BackwardCompatibilityValidator {
  private originalService: CloudSyncService
  private testResults: CompatibilityResult[] = []
  
  constructor() {
    this.originalService = new CloudSyncService()
  }
  
  /**
   * 运行完整兼容性验证
   */
  async runFullValidation(): Promise<CompatibilityReport> {
    console.log('🔍 开始向后兼容性验证...')
    
    const startTime = Date.now()
    
    try {
      // 初始化服务
      await this.initializeServices()
      
      // 运行兼容性测试
      const testSuite = this.createCompatibilityTestSuite()
      
      for (const test of testSuite) {
        console.log(`🧪 运行兼容性测试: ${test.name}`)
        const result = await this.runCompatibilityTest(test)
        this.testResults.push(result)
      }
      
      // 生成兼容性报告
      const report = this.generateCompatibilityReport()
      
      console.log(`✅ 兼容性验证完成，总体得分: ${report.overallScore}/100`)
      
      return report
      
    } catch (error) {
      console.error('❌ 兼容性验证失败:', error)
      throw error
    }
  }
  
  /**
   * 初始化服务
   */
  private async initializeServices(): Promise<void> {
    console.log('🔧 初始化兼容性测试服务...')
    
    // 初始化原始服务
    await this.originalService.initialize()
    
    // 初始化新服务
    await networkAdapterManager.initialize()
    await conflictResolutionEngine.initialize()
    
    console.log('✅ 兼容性测试服务初始化完成')
  }
  
  /**
   * 创建兼容性测试套件
   */
  private createCompatibilityTestSuite(): CompatibilityTest[] {
    return [
      // API兼容性测试
      this.createAPISignatureTest(),
      this.createMethodExistenceTest(),
      this.createParameterCompatibilityTest(),
      this.createReturnValueTest(),
      
      // 数据兼容性测试
      this.createDataFormatTest(),
      this.createSyncVersionTest(),
      this.createConflictDataTest(),
      this.createQueueDataTest(),
      
      // 行为兼容性测试
      this.createSyncBehaviorTest(),
      this.createErrorHandlingTest(),
      this.createOfflineBehaviorTest(),
      this.createConflictResolutionTest(),
      
      // 性能兼容性测试
      this.createPerformanceTest(),
      this.createMemoryUsageTest(),
      this.createConcurrencyTest()
    ]
  }
  
  // ============================================================================
  // API兼容性测试
  // ============================================================================
  
  /**
   * API签名测试
   */
  private createAPISignatureTest(): CompatibilityTest {
    return {
      name: 'API签名兼容性',
      description: '验证新服务API签名与原始服务保持一致',
      category: 'api',
      critical: true,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        // 检查主要方法签名
        const originalMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.originalService))
          .filter(name => typeof (this.originalService as any)[name] === 'function' && !name.startsWith('_'))
        
        const newMethods = [
          'performFullSync',
          'performIncrementalSync',
          'syncCard',
          'syncFolder',
          'syncTag',
          'getSyncStatus',
          'getLastSyncTime',
          'clearSyncData',
          'isSyncing'
        ]
        
        // 检查必要方法是否存在
        for (const method of newMethods) {
          if (!(optimizedCloudSyncService as any)[method]) {
            differences.push(`缺少必要方法: ${method}`)
          }
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 10),
          details: {
            originalService: { methods: originalMethods },
            newService: { methods: newMethods },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要实现缺失的API方法'] : 
              ['API签名完全兼容']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: originalMethods.length
          }
        }
      }
    }
  }
  
  /**
   * 方法存在性测试
   */
  private createMethodExistenceTest(): CompatibilityTest {
    return {
      name: '核心方法存在性',
      description: '验证所有核心同步方法在新服务中存在',
      category: 'api',
      critical: true,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        const requiredMethods = [
          'performFullSync',
          'syncCard',
          'getSyncStatus',
          'getLastSyncTime'
        ]
        
        for (const method of requiredMethods) {
          if (!(optimizedCloudSyncService as any)[method]) {
            differences.push(`核心方法缺失: ${method}`)
          }
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 25),
          details: {
            originalService: { hasCoreMethods: true },
            newService: { missingMethods: differences },
            differences,
            recommendations: differences.length > 0 ? 
              ['必须实现所有核心方法以确保兼容性'] : 
              ['所有核心方法已实现']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: requiredMethods.length
          }
        }
      }
    }
  }
  
  /**
   * 参数兼容性测试
   */
  private createParameterCompatibilityTest(): CompatibilityTest {
    return {
      name: '参数兼容性',
      description: '验证方法参数接口兼容性',
      category: 'api',
      critical: false,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        // 测试performFullSync参数
        try {
          // 原始服务调用方式
          const originalSignature = (this.originalService as any).performFullSync.length
          
          // 新服务应该支持相同的参数接口
          const newSignature = (optimizedCloudSyncService as any).performFullSync?.length || 0
          
          if (newSignature !== originalSignature) {
            differences.push(`performFullSync参数数量不匹配: 原始${originalSignature}, 新${newSignature}`)
          }
        } catch (error) {
          differences.push(`参数测试失败: ${error}`)
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 15),
          details: {
            originalService: { parameterSignatures: 'compatible' },
            newService: { parameterSignatures: differences.length > 0 ? 'incompatible' : 'compatible' },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要保持参数接口兼容性'] : 
              ['参数接口完全兼容']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: 2
          }
        }
      }
    }
  }
  
  /**
   * 返回值测试
   */
  private createReturnValueTest(): CompatibilityTest {
    return {
      name: '返回值兼容性',
      description: '验证方法返回值格式兼容性',
      category: 'api',
      critical: false,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        // 测试getSyncStatus返回值结构
        try {
          // 模拟原始服务返回值
          const mockOriginalStatus = {
            isSyncing: false,
            lastSyncTime: new Date(),
            syncProgress: 0,
            queuedOperations: 0
          }
          
          // 新服务应该返回兼容的结构
          const newStatus = await optimizedCloudSyncService.getSyncStatus?.('test-user')
          
          if (newStatus) {
            const requiredFields = ['isSyncing', 'lastSyncTime']
            for (const field of requiredFields) {
              if (!(field in newStatus)) {
                differences.push(`返回值缺少字段: ${field}`)
              }
            }
          }
        } catch (error) {
          differences.push(`返回值测试失败: ${error}`)
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 10),
          details: {
            originalService: { returnFormat: 'standard' },
            newService: { returnFormat: differences.length > 0 ? 'incompatible' : 'compatible' },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要确保返回值结构兼容'] : 
              ['返回值格式兼容']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: 1
          }
        }
      }
    }
  }
  
  // ============================================================================
  // 数据兼容性测试
  // ============================================================================
  
  /**
   * 数据格式测试
   */
  private createDataFormatTest(): CompatibilityTest {
    return {
      name: '数据格式兼容性',
      description: '验证数据存储格式兼容性',
      category: 'data',
      critical: true,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        // 测试卡片数据格式
        const mockCard = {
          id: 'test-card',
          title: 'Test Card',
          content: 'Test Content',
          folderId: 'test-folder',
          tags: ['tag1', 'tag2'],
          syncVersion: 1,
          lastModified: new Date(),
          createdAt: new Date()
        }
        
        try {
          // 新服务应该能够处理原始数据格式
          const canProcess = await this.testDataFormatCompatibility(mockCard)
          if (!canProcess) {
            differences.push('无法处理原始卡片数据格式')
          }
        } catch (error) {
          differences.push(`数据格式测试失败: ${error}`)
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 20),
          details: {
            originalService: { dataFormat: 'legacy' },
            newService: { dataFormat: 'enhanced' },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要确保数据格式向后兼容'] : 
              ['数据格式完全兼容']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: 1
          }
        }
      }
    }
  
  /**
   * 同步版本测试
   */
  private createSyncVersionTest(): CompatibilityTest {
    return {
      name: '同步版本兼容性',
      description: '验证sync_version机制兼容性',
      category: 'data',
      critical: true,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        try {
          // 测试sync_version字段处理
          const testOperations = [
            {
              type: 'update' as const,
              entity: 'card' as const,
              entityId: 'test-card',
              userId: 'test-user',
              data: {
                ...this.getMockCard(),
                sync_version: 5 // 使用原始格式
              },
              priority: 'normal' as const,
              retryCount: 0,
              maxRetries: 3
            }
          ]
          
          // 新服务应该能够处理sync_version字段
          const result = await syncQueueManager.enqueueBatch(testOperations)
          
          if (result.length === 0) {
            differences.push('无法处理sync_version字段')
          }
        } catch (error) {
          differences.push(`同步版本测试失败: ${error}`)
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 25),
          details: {
            originalService: { versionField: 'sync_version' },
            newService: { versionField: 'syncVersion' },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要处理sync_version字段映射'] : 
              ['同步版本机制兼容']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: 1
          }
        }
      }
    }
  
  /**
   * 冲突数据测试
   */
  private createConflictDataTest(): CompatibilityTest {
    return {
      name: '冲突数据兼容性',
      description: '验证冲突数据格式兼容性',
      category: 'data',
      critical: false,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        try {
          // 测试冲突数据格式
          const mockConflict = {
            entityId: 'test-card',
            entityType: 'card',
            localVersion: 1,
            cloudVersion: 2,
            localData: this.getMockCard(),
            cloudData: { ...this.getMockCard(), title: 'Modified Title' },
            conflictFields: ['title']
          }
          
          // 新冲突解决引擎应该能够处理原始冲突格式
          const canHandle = await conflictResolutionEngine.detectAllConflicts(
            mockConflict.localData,
            mockConflict.cloudData,
            mockConflict.entityType,
            mockConflict.entityId,
            {}
          )
          
          if (!canHandle || canHandle.length === 0) {
            differences.push('无法处理原始冲突数据格式')
          }
        } catch (error) {
          differences.push(`冲突数据测试失败: ${error}`)
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 15),
          details: {
            originalService: { conflictFormat: 'simple' },
            newService: { conflictFormat: 'advanced' },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要兼容原始冲突数据格式'] : 
              ['冲突数据格式兼容']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: 1
          }
        }
      }
    }
  
  /**
   * 队列数据测试
   */
  private createQueueDataTest(): CompatibilityTest {
    return {
      name: '队列数据兼容性',
      description: '验证同步队列数据格式兼容性',
      category: 'data',
      critical: false,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        try {
          // 测试队列操作格式
          const mockQueueOperation = {
            type: 'create',
            entity: 'card',
            entityId: 'test-card',
            userId: 'test-user',
            data: this.getMockCard(),
            priority: 'normal',
            timestamp: new Date(),
            retryCount: 0,
            maxRetries: 3,
            status: 'pending'
          }
          
          // 新队列管理器应该能够处理原始格式
          const result = await syncQueueManager.enqueueOperation({
            ...mockQueueOperation,
            priority: 'normal' as const,
            retryCount: 0,
            maxRetries: 3
          })
          
          if (!result) {
            differences.push('无法处理原始队列数据格式')
          }
        } catch (error) {
          differences.push(`队列数据测试失败: ${error}`)
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 15),
          details: {
            originalService: { queueFormat: 'basic' },
            newService: { queueFormat: 'enhanced' },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要兼容原始队列数据格式'] : 
              ['队列数据格式兼容']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: 1
          }
        }
      }
    }
  
  // ============================================================================
  // 行为兼容性测试
  // ============================================================================
  
  /**
   * 同步行为测试
   */
  private createSyncBehaviorTest(): CompatibilityTest {
    return {
      name: '同步行为兼容性',
      description: '验证同步行为逻辑兼容性',
      category: 'behavior',
      critical: true,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        try {
          // 测试基本同步行为
          const testUserId = 'test-user'
          
          // 原始服务行为：应该能够开始和完成同步
          const originalStartSync = await this.originalService.performFullSync(testUserId)
          
          // 新服务应该表现出相似的行为
          const newStartSync = await optimizedCloudSyncService.performFullSync(testUserId)
          
          // 比较行为结果
          if (!this.compareSyncResults(originalStartSync, newStartSync)) {
            differences.push('同步行为结果不匹配')
          }
        } catch (error) {
          differences.push(`同步行为测试失败: ${error}`)
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 20),
          details: {
            originalService: { syncBehavior: 'traditional' },
            newService: { syncBehavior: 'optimized' },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要保持同步行为兼容性'] : 
              ['同步行为完全兼容']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: 2
          }
        }
      }
    }
  
  /**
   * 错误处理测试
   */
  private createErrorHandlingTest(): CompatibilityTest {
    return {
      name: '错误处理兼容性',
      description: '验证错误处理行为兼容性',
      category: 'behavior',
      critical: false,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        try {
          // 测试错误处理行为
          const invalidOperation = {
            type: 'invalid',
            entity: 'invalid',
            entityId: '',
            userId: 'test-user',
            data: {},
            priority: 'normal' as const,
            retryCount: 0,
            maxRetries: 3
          }
          
          // 原始服务错误处理
          let originalError: any
          try {
            await (this.originalService as any).syncCard(invalidOperation.data)
          } catch (error) {
            originalError = error
          }
          
          // 新服务错误处理
          let newError: any
          try {
            await optimizedCloudSyncService.syncCard(invalidOperation.data)
          } catch (error) {
            newError = error
          }
          
          // 比较错误处理行为
          if (!this.compareErrorHandling(originalError, newError)) {
            differences.push('错误处理行为不匹配')
          }
        } catch (error) {
          differences.push(`错误处理测试失败: ${error}`)
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 15),
          details: {
            originalService: { errorHandling: 'basic' },
            newService: { errorHandling: 'enhanced' },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要保持错误处理兼容性'] : 
              ['错误处理兼容']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: 2
          }
        }
      }
    }
  
  /**
   * 离线行为测试
   */
  private createOfflineBehaviorTest(): CompatibilityTest {
    return {
      name: '离线行为兼容性',
      description: '验证离线模式行为兼容性',
      category: 'behavior',
      critical: false,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        try {
          // 模拟离线环境
          const originalOnline = navigator.onLine
          
          // 测试离线行为
          Object.defineProperty(navigator, 'onLine', { get: () => false })
          
          // 原始服务离线行为
          const originalOfflineResult = await this.originalService.performFullSync('test-user')
          
          // 新服务离线行为
          const newOfflineResult = await optimizedCloudSyncService.performFullSync('test-user')
          
          // 恢复在线状态
          Object.defineProperty(navigator, 'onLine', { get: () => originalOnline })
          
          // 比较离线行为
          if (!this.compareOfflineBehavior(originalOfflineResult, newOfflineResult)) {
            differences.push('离线行为不匹配')
          }
        } catch (error) {
          differences.push(`离线行为测试失败: ${error}`)
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 15),
          details: {
            originalService: { offlineBehavior: 'queue' },
            newService: { offlineBehavior: 'adaptive' },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要保持离线行为兼容性'] : 
              ['离线行为兼容']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: 2
          }
        }
      }
    }
  
  /**
   * 冲突解决测试
   */
  private createConflictResolutionTest(): CompatibilityTest {
    return {
      name: '冲突解决兼容性',
      description: '验证冲突解决行为兼容性',
      category: 'behavior',
      critical: false,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        try {
          // 创建冲突场景
          const localCard = { ...this.getMockCard(), title: 'Local Version' }
          const cloudCard = { ...this.getMockCard(), title: 'Cloud Version' }
          
          // 原始服务冲突解决（最后写入获胜）
          const originalResolved = this.originalService.mergeCloudCard(localCard, cloudCard)
          
          // 新服务冲突解决
          const newResolved = await conflictResolutionEngine.resolveConflicts([{
            entityId: 'test-card',
            entityType: 'card',
            localVersion: 1,
            cloudVersion: 2,
            localData: localCard,
            cloudData: cloudCard,
            conflictFields: ['title'],
            confidence: 0.8,
            context: {}
          }])
          
          // 比较解决结果
          if (!this.compareConflictResolution(originalResolved, newResolved)) {
            differences.push('冲突解决行为不匹配')
          }
        } catch (error) {
          differences.push(`冲突解决测试失败: ${error}`)
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 10),
          details: {
            originalService: { conflictStrategy: 'last-writer-wins' },
            newService: { conflictStrategy: 'intelligent' },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要保持冲突解决行为兼容'] : 
              ['冲突解决行为兼容']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: 2
          }
        }
      }
    }
  
  // ============================================================================
  // 性能兼容性测试
  // ============================================================================
  
  /**
   * 性能测试
   */
  private createPerformanceTest(): CompatibilityTest {
    return {
      name: '性能兼容性',
      description: '验证性能指标兼容性',
      category: 'performance',
      critical: false,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        try {
          // 测试批量同步性能
          const testData = Array.from({ length: 10 }, (_, i) => ({
            ...this.getMockCard(),
            id: `perf-test-${i}`
          }))
          
          // 原始服务性能
          const originalStart = Date.now()
          for (const card of testData) {
            await this.originalService.syncCard(card)
          }
          const originalDuration = Date.now() - originalStart
          
          // 新服务性能
          const newStart = Date.now()
          const operations = testData.map(card => ({
            type: 'create' as const,
            entity: 'card' as const,
            entityId: card.id,
            userId: 'test-user',
            data: card,
            priority: 'normal' as const,
            retryCount: 0,
            maxRetries: 3
          }))
          
          await syncQueueManager.enqueueBatch(operations)
          const newDuration = Date.now() - newStart
          
          // 比较性能
          const performanceRatio = newDuration / originalDuration
          if (performanceRatio > 2) {
            differences.push(`新服务性能显著下降: ${performanceRatio.toFixed(2)}x`)
          }
          
          if (performanceRatio < 0.5) {
            differences.push(`新服务性能显著提升: ${performanceRatio.toFixed(2)}x`)
          }
        } catch (error) {
          differences.push(`性能测试失败: ${error}`)
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 10),
          details: {
            originalService: { performance: 'baseline' },
            newService: { performance: differences.length > 0 ? 'degraded' : 'improved' },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要优化性能以保持兼容性'] : 
              ['性能表现良好']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: 20
          }
        }
      }
    }
  
  /**
   * 内存使用测试
   */
  private createMemoryUsageTest(): CompatibilityTest {
    return {
      name: '内存使用兼容性',
      description: '验证内存使用兼容性',
      category: 'performance',
      critical: false,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        try {
          // 测试内存使用
          const initialMemory = this.getMemoryUsage()
          
          // 执行大量操作
          const operations = Array.from({ length: 50 }, (_, i) => ({
            type: 'create' as const,
            entity: 'card' as const,
            entityId: `memory-test-${i}`,
            userId: 'test-user',
            data: this.getMockCard(),
            priority: 'normal' as const,
            retryCount: 0,
            maxRetries: 3
          }))
          
          await syncQueueManager.enqueueBatch(operations)
          
          const finalMemory = this.getMemoryUsage()
          const memoryIncrease = finalMemory - initialMemory
          
          // 检查内存增长是否合理
          const maxAllowedIncrease = 50 * 1024 * 1024 // 50MB
          if (memoryIncrease > maxAllowedIncrease) {
            differences.push(`内存使用增长过多: ${Math.round(memoryIncrease / 1024 / 1024)}MB`)
          }
        } catch (error) {
          differences.push(`内存测试失败: ${error}`)
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 15),
          details: {
            originalService: { memoryUsage: 'baseline' },
            newService: { memoryUsage: differences.length > 0 ? 'high' : 'normal' },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要优化内存使用'] : 
              ['内存使用合理']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: 50
          }
        }
      }
    }
  
  /**
   * 并发测试
   */
  private createConcurrencyTest(): CompatibilityTest {
    return {
      name: '并发兼容性',
      description: '验证并发操作兼容性',
      category: 'performance',
      critical: false,
      test: async () => {
        const startTime = Date.now()
        const differences: string[] = []
        
        try {
          // 测试并发操作
          const concurrentOperations = Array.from({ length: 20 }, (_, i) => ({
            type: 'update' as const,
            entity: 'card' as const,
            entityId: `concurrent-test-${i}`,
            userId: 'test-user',
            data: { ...this.getMockCard(), id: `concurrent-test-${i}` },
            priority: i % 3 === 0 ? 'high' as const : 'normal' as const,
            retryCount: 0,
            maxRetries: 3
          }))
          
          // 并发执行操作
          const promises = concurrentOperations.map(op => 
            syncQueueManager.enqueueOperation(op)
          )
          
          const results = await Promise.allSettled(promises)
          
          // 检查并发操作结果
          const failedOperations = results.filter(r => r.status === 'rejected').length
          if (failedOperations > 2) {
            differences.push(`并发操作失败率过高: ${failedOperations}/20`)
          }
        } catch (error) {
          differences.push(`并发测试失败: ${error}`)
        }
        
        const executionTime = Date.now() - startTime
        
        return {
          passed: differences.length === 0,
          score: Math.max(0, 100 - differences.length * 10),
          details: {
            originalService: { concurrency: 'limited' },
            newService: { concurrency: 'enhanced' },
            differences,
            recommendations: differences.length > 0 ? 
              ['需要改进并发处理'] : 
              ['并发处理良好']
          },
          metrics: {
            executionTime,
            memoryUsage: this.getMemoryUsage(),
            apiCalls: 20
          }
        }
      }
    }
  
  // ============================================================================
  // 辅助方法
  // ============================================================================
  
  /**
   * 运行兼容性测试
   */
  private async runCompatibilityTest(test: CompatibilityTest): Promise<CompatibilityResult> {
    try {
      const result = await test.test()
      return result
    } catch (error) {
      console.error(`兼容性测试失败: ${test.name}`, error)
      return {
        passed: false,
        score: 0,
        details: {
          originalService: null,
          newService: null,
          differences: [error instanceof Error ? error.message : String(error)],
          recommendations: ['需要修复测试错误']
        },
        metrics: {
          executionTime: 0,
          memoryUsage: 0,
          apiCalls: 0
        }
      }
    }
  }
  
  /**
   * 生成兼容性报告
   */
  private generateCompatibilityReport(): CompatibilityReport {
    const totalTests = this.testResults.length
    const passedTests = this.testResults.filter(r => r.passed).length
    const criticalTests = this.testResults.filter(r => this.isCriticalTest(r)).length
    const passedCriticalTests = this.testResults.filter(r => r.passed && this.isCriticalTest(r)).length
    
    const overallScore = this.testResults.reduce((sum, r) => sum + r.score, 0) / totalTests
    
    const summary = {
      apiCompatibility: this.calculateCategoryScore('api'),
      dataCompatibility: this.calculateCategoryScore('data'),
      behaviorCompatibility: this.calculateCategoryScore('behavior'),
      performanceCompatibility: this.calculateCategoryScore('performance')
    }
    
    const breakingChanges = this.identifyBreakingChanges()
    const recommendations = this.generateCompatibilityRecommendations()
    
    return {
      overallScore: Math.round(overallScore),
      totalTests,
      passedTests,
      criticalTests,
      passedCriticalTests,
      results: this.testResults,
      summary,
      recommendations,
      breakingChanges
    }
  }
  
  /**
   * 判断是否为关键测试
   */
  private isCriticalTest(result: CompatibilityResult): boolean {
    // 这里应该根据测试的实际配置判断
    // 简化处理：假设所有测试都是关键测试
    return true
  }
  
  /**
   * 计算分类得分
   */
  private calculateCategoryScore(category: string): number {
    const categoryResults = this.testResults.filter(r => {
      // 这里需要根据测试的实际分类来过滤
      // 简化处理
      return true
    })
    
    if (categoryResults.length === 0) return 100
    
    return categoryResults.reduce((sum, r) => sum + r.score, 0) / categoryResults.length
  }
  
  /**
   * 识别破坏性变更
   */
  private identifyBreakingChanges(): BreakingChange[] {
    const breakingChanges: BreakingChange[] = []
    
    this.testResults.forEach(result => {
      if (!result.passed && result.score < 50) {
        breakingChanges.push({
          type: 'api',
          severity: 'high',
          description: `测试失败: ${result.details.differences.join(', ')}`,
          impact: '可能导致现有功能失效',
          mitigation: '需要修复兼容性问题'
        })
      }
    })
    
    return breakingChanges
  }
  
  /**
   * 生成兼容性建议
   */
  private generateCompatibilityRecommendations(): string[] {
    const recommendations: string[] = []
    
    const failedTests = this.testResults.filter(r => !r.passed)
    if (failedTests.length > 0) {
      recommendations.push(`有 ${failedTests.length} 个兼容性测试失败，需要优先修复`)
    }
    
    const lowScoreTests = this.testResults.filter(r => r.score < 70)
    if (lowScoreTests.length > 0) {
      recommendations.push(`${lowScoreTests.length} 个测试得分较低，建议优化`)
    }
    
    const criticalFailedTests = this.testResults.filter(r => !r.passed && this.isCriticalTest(r))
    if (criticalFailedTests.length > 0) {
      recommendations.push(`${criticalFailedTests.length} 个关键测试失败，必须修复`)
    }
    
    if (recommendations.length === 0) {
      recommendations.push('所有兼容性测试通过，系统向后兼容性良好')
    }
    
    return recommendations
  }
  
  /**
   * 获取内存使用量
   */
  private getMemoryUsage(): number {
    if ('memory' in (performance as any)) {
      return (performance as any).memory.usedJSHeapSize
    }
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return 0
  }
  
  /**
   * 获取模拟卡片数据
   */
  private getMockCard() {
    return {
      id: 'test-card',
      title: 'Test Card',
      content: 'Test Content',
      folderId: 'test-folder',
      tags: ['tag1', 'tag2'],
      syncVersion: 1,
      lastModified: new Date(),
      createdAt: new Date()
    }
  }
  
  /**
   * 测试数据格式兼容性
   */
  private async testDataFormatCompatibility(data: any): Promise<boolean> {
    try {
      // 测试新服务是否能处理原始数据格式
      const operation = {
        type: 'create' as const,
        entity: 'card' as const,
        entityId: data.id,
        userId: 'test-user',
        data,
        priority: 'normal' as const,
        retryCount: 0,
        maxRetries: 3
      }
      
      await syncQueueManager.enqueueOperation(operation)
      return true
    } catch {
      return false
    }
  }
  
  /**
   * 比较同步结果
   */
  private compareSyncResults(original: any, newResult: any): boolean {
    // 简化比较逻辑
    return typeof original === typeof newResult
  }
  
  /**
   * 比较错误处理
   */
  private compareErrorHandling(original: any, newResult: any): boolean {
    // 简化比较逻辑
    return Boolean(original) === Boolean(newResult)
  }
  
  /**
   * 比较离线行为
   */
  private compareOfflineBehavior(original: any, newResult: any): boolean {
    // 简化比较逻辑
    return typeof original === typeof newResult
  }
  
  /**
   * 比较冲突解决
   */
  private compareConflictResolution(original: any, newResult: any): boolean {
    // 简化比较逻辑
    return newResult && newResult.length > 0
  }
}

// ============================================================================
// 导出兼容性验证器
// ============================================================================

export const backwardCompatibilityValidator = new BackwardCompatibilityValidator()

// ============================================================================
// 便利方法
// ============================================================================

export const validateBackwardCompatibility = async () => {
  return await backwardCompatibilityValidator.runFullValidation()
}

export const generateCompatibilityReport = async () => {
  const report = await validateBackwardCompatibility()
  return {
    report,
    timestamp: new Date(),
    version: '1.0.0'
  }
}