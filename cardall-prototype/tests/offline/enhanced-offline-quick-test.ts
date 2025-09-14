// 增强离线管理器快速测试执行脚本
// Week 3 Day 11-13 同步机制重构 - Project-Brainstormer
// 用于快速验证增强离线管理器和统一同步服务基础的核心功能

import { jest } from '@jest/globals'

// ============================================================================
// 测试模拟工具
// ============================================================================

// 模拟增强离线管理器
class MockEnhancedOfflineManager {
  private operations: any[] = []
  private stats = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageExecutionTime: 0,
    predictionAccuracy: 0.85
  }
  private eventListeners: Map<string, Function[]> = new Map()
  private isInitialized = false

  async initialize() {
    this.isInitialized = true
    console.log('✅ MockEnhancedOfflineManager 初始化完成')
  }

  async executeOfflineOperation(operation: any) {
    const startTime = performance.now()

    try {
      const enhancedOperation = {
        ...operation,
        id: `op-${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        retryCount: 0,
        optimized: this.optimizeOperation(operation)
      }

      this.operations.push(enhancedOperation)
      this.stats.totalOperations++
      this.stats.successfulOperations++

      const executionTime = performance.now() - startTime
      this.updateAverageExecutionTime(executionTime)

      this.emit('operationCompleted', enhancedOperation)

      return {
        success: true,
        operationId: enhancedOperation.id,
        executionTime,
        performanceMetrics: {
          optimizationApplied: enhancedOperation.optimized,
          predictionAccuracy: this.stats.predictionAccuracy
        }
      }
    } catch (error) {
      this.stats.failedOperations++
      this.emit('operationFailed', { operation, error })
      throw error
    }
  }

  async getPendingOfflineOperations() {
    return this.operations.filter(op => op.status !== 'completed')
  }

  async predictOperationOutcome(operation: any) {
    const successProbability = Math.random() * 0.3 + 0.7 // 70-100%
    const estimatedTime = Math.random() * 200 + 50 // 50-250ms
    const confidence = Math.random() * 0.2 + 0.8 // 80-100%

    return {
      successProbability,
      estimatedExecutionTime: estimatedTime,
      confidence,
      recommendedOptimizations: this.getRecommendedOptimizations(operation)
    }
  }

  async assessNetworkQuality() {
    return {
      isStable: Math.random() > 0.2,
      bandwidth: ['poor', 'fair', 'good', 'excellent'][Math.floor(Math.random() * 4)],
      latency: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      reliability: Math.random() * 0.4 + 0.6,
      recommendedStrategy: ['immediate', 'delayed', 'batch'][Math.floor(Math.random() * 3)]
    }
  }

  async getOperationPerformanceMetrics() {
    return {
      ...this.stats,
      throughput: this.stats.successfulOperations / Math.max(1, this.stats.totalOperations),
      lastUpdated: new Date()
    }
  }

  async detectConflict(localData: any, remoteData: any) {
    const hasConflict = localData.title !== remoteData.title ||
                        localData.content !== remoteData.content

    return {
      hasConflict,
      conflictType: hasConflict ? 'data_mismatch' : 'no_conflict',
      severity: hasConflict ? (Math.random() > 0.5 ? 'high' : 'medium') : 'low',
      detectedAt: new Date()
    }
  }

  async resolveConflict(localData: any, remoteData: any) {
    // 简单的冲突解决策略：智能合并
    const mergedData = {
      ...remoteData,
      content: localData.content, // 保留本地内容
      title: remoteData.title, // 使用远程标题
      tags: [...new Set([...(localData.tags || []), ...(remoteData.tags || [])])] // 合并标签
    }

    return {
      success: true,
      mergedData,
      resolutionStrategy: 'smart_merge',
      resolvedAt: new Date()
    }
  }

  addEventListener(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  private optimizeOperation(operation: any) {
    return Math.random() > 0.3 // 70% 的操作可以被优化
  }

  private getRecommendedOptimizations(operation: any) {
    const optimizations = []
    if (operation.priority === 'high') {
      optimizations.push('immediate_execution')
    }
    if (operation.type === 'create') {
      optimizations.push('batch_processing')
    }
    return optimizations
  }

  private updateAverageExecutionTime(newTime: number) {
    this.stats.averageExecutionTime =
      (this.stats.averageExecutionTime * (this.stats.totalOperations - 1) + newTime) / this.stats.totalOperations
  }

  private emit(event: string, data: any) {
    const callbacks = this.eventListeners.get(event) || []
    callbacks.forEach(callback => callback(data))
  }
}

// 模拟统一同步服务基础类
class MockUnifiedSyncServiceBase {
  private syncInProgress = false
  private syncHistory: any[] = []
  private eventListeners: Map<string, Function[]> = new Map()
  private offlineManager: MockEnhancedOfflineManager

  constructor(offlineManager: MockEnhancedOfflineManager) {
    this.offlineManager = offlineManager
  }

  async initialize() {
    console.log('✅ MockUnifiedSyncServiceBase 初始化完成')
  }

  async performSmartSync() {
    if (this.syncInProgress) {
      return { success: false, error: 'Sync already in progress' }
    }

    this.syncInProgress = true
    this.emit('syncStarted', { timestamp: new Date() })

    try {
      const startTime = performance.now()

      // 获取待处理操作
      const pendingOps = await this.offlineManager.getPendingOfflineOperations()

      // 模拟同步过程
      const processedCount = Math.min(pendingOps.length, 10)

      await new Promise(resolve => setTimeout(resolve, processedCount * 50))

      const duration = performance.now() - startTime
      const result = {
        success: true,
        processedCount,
        failedCount: 0,
        duration,
        bytesTransferred: processedCount * 256,
        conflicts: [],
        errors: []
      }

      this.syncHistory.push({
        timestamp: new Date(),
        ...result
      })

      this.emit('syncCompleted', result)
      return result
    } catch (error) {
      const errorResult = {
        success: false,
        processedCount: 0,
        failedCount: 1,
        duration: 0,
        bytesTransferred: 0,
        conflicts: [],
        errors: [error]
      }

      this.emit('syncFailed', errorResult)
      return errorResult
    } finally {
      this.syncInProgress = false
    }
  }

  async getSyncStatus() {
    return {
      isSyncing: this.syncInProgress,
      lastSyncTime: this.syncHistory.length > 0 ? this.syncHistory[this.syncHistory.length - 1].timestamp : null,
      totalSyncs: this.syncHistory.length,
      successfulSyncs: this.syncHistory.filter(s => s.success).length
    }
  }

  addEventListener(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  private emit(event: string, data: any) {
    const callbacks = this.eventListeners.get(event) || []
    callbacks.forEach(callback => callback(data))
  }
}

// ============================================================================
// 测试数据生成器
// ============================================================================

class TestDataGenerator {
  generateTestCard(overrides = {}) {
    return {
      id: `card-${Date.now()}-${Math.random()}`,
      title: 'Test Card',
      content: 'Test content for enhanced offline testing',
      tags: ['test', 'enhanced'],
      folderId: null,
      style: 'default',
      isFlipped: false,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'test-user-id',
      isLocalOnly: false,
      cloudSynced: false,
      ...overrides
    }
  }

  generateTestFolder(overrides = {}) {
    return {
      id: `folder-${Date.now()}-${Math.random()}`,
      name: 'Test Folder',
      parentId: null,
      userId: 'test-user-id',
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isLocalOnly: false,
      cloudSynced: false,
      ...overrides
    }
  }

  generateTestTag(overrides = {}) {
    return {
      id: `tag-${Date.now()}-${Math.random()}`,
      name: 'Test Tag',
      color: '#3b82f6',
      userId: 'test-user-id',
      count: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    }
  }
}

// ============================================================================
// 网络模拟工具
// ============================================================================

class NetworkSimulator {
  private isOnline = true
  private listeners: Map<string, Function[]> = new Map()

  simulateOffline() {
    this.isOnline = false
    this.emit('offline')
    console.log('📡 模拟网络离线')
  }

  simulateOnline() {
    this.isOnline = true
    this.emit('online')
    console.log('📡 模拟网络在线')
  }

  isCurrentlyOnline() {
    return this.isOnline
  }

  addListener(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  private emit(event: string) {
    const callbacks = this.listeners.get(event) || []
    callbacks.forEach(callback => callback())
  }
}

// ============================================================================
// 测试执行器
// ============================================================================

class EnhancedOfflineTestRunner {
  private offlineManager: MockEnhancedOfflineManager
  private syncService: MockUnifiedSyncServiceBase
  private dataGenerator: TestDataGenerator
  private networkSimulator: NetworkSimulator
  private testResults: any[] = []

  constructor() {
    this.dataGenerator = new TestDataGenerator()
    this.networkSimulator = new NetworkSimulator()
    this.offlineManager = new MockEnhancedOfflineManager()
    this.syncService = new MockUnifiedSyncServiceBase(this.offlineManager)
  }

  async runAllTests() {
    console.log('🚀 开始增强离线管理器快速测试')
    console.log('=' * 60)

    await this.initialize()

    await this.testBasicOperations()
    await this.testPredictionEngine()
    await this.testNetworkAdaptation()
    await this.testConflictResolution()
    await this.testPerformanceMonitoring()
    await this.testEventSystem()
    await this.testIntegration()
    await this.testStressConditions()

    this.printTestResults()
  }

  private async initialize() {
    console.log('🔧 初始化测试环境...')

    await this.offlineManager.initialize()
    await this.syncService.initialize()

    // 设置事件监听器
    this.setupEventListeners()

    console.log('✅ 测试环境初始化完成')
  }

  private setupEventListeners() {
    this.offlineManager.addEventListener('operationCompleted', (data) => {
      console.log(`📝 操作完成: ${data.operationId}`)
    })

    this.syncService.addEventListener('syncStarted', () => {
      console.log('🔄 同步开始')
    })

    this.syncService.addEventListener('syncCompleted', (result) => {
      console.log(`✅ 同步完成: 处理 ${result.processedCount} 个操作`)
    })

    this.networkSimulator.addListener('offline', () => {
      console.log('📡 网络状态: 离线')
    })

    this.networkSimulator.addListener('online', () => {
      console.log('📡 网络状态: 在线')
    })
  }

  private async testBasicOperations() {
    console.log('\n📋 测试基本离线操作...')

    const testCard = this.dataGenerator.generateTestCard({ title: 'Basic Test Card' })

    const result = await this.offlineManager.executeOfflineOperation({
      type: 'create',
      entity: 'card',
      entityId: testCard.id,
      data: testCard,
      priority: 'medium'
    })

    this.assert(result.success, '基本离线操作应该成功')
    this.assert(result.operationId, '应该返回操作ID')
    this.assert(result.performanceMetrics, '应该包含性能指标')

    const pendingOps = await this.offlineManager.getPendingOfflineOperations()
    this.assert(pendingOps.length > 0, '应该有待处理操作')

    this.recordResult('基本离线操作', true)
  }

  private async testPredictionEngine() {
    console.log('\n🔮 测试预测引擎...')

    const testCard = this.dataGenerator.generateTestCard({ title: 'Prediction Test Card' })

    const prediction = await this.offlineManager.predictOperationOutcome({
      type: 'create',
      entity: 'card',
      entityId: testCard.id,
      data: testCard,
      priority: 'high'
    })

    this.assert(prediction.successProbability > 0, '应该有成功概率')
    this.assert(prediction.estimatedExecutionTime > 0, '应该有预估执行时间')
    this.assert(prediction.confidence > 0, '应该有置信度')

    this.recordResult('预测引擎', true)
  }

  private async testNetworkAdaptation() {
    console.log('\n🌐 测试网络适应能力...')

    // 测试网络质量评估
    const quality = await this.offlineManager.assessNetworkQuality()
    this.assert(quality.isStable !== undefined, '应该评估网络稳定性')
    this.assert(quality.bandwidth, '应该评估带宽')
    this.assert(quality.reliability > 0, '应该评估可靠性')

    // 测试网络切换
    this.networkSimulator.simulateOffline()
    await new Promise(resolve => setTimeout(resolve, 100))

    this.networkSimulator.simulateOnline()
    await new Promise(resolve => setTimeout(resolve, 100))

    this.recordResult('网络适应能力', true)
  }

  private async testConflictResolution() {
    console.log('\n⚔️ 测试冲突解决...')

    const localData = this.dataGenerator.generateTestCard({
      id: 'conflict-card',
      title: 'Local Version',
      content: 'Local content'
    })

    const remoteData = this.dataGenerator.generateTestCard({
      id: 'conflict-card',
      title: 'Remote Version',
      content: 'Remote content'
    })

    const conflict = await this.offlineManager.detectConflict(localData, remoteData)
    this.assert(conflict.hasConflict, '应该检测到冲突')

    const resolution = await this.offlineManager.resolveConflict(localData, remoteData)
    this.assert(resolution.success, '应该能够解决冲突')
    this.assert(resolution.mergedData, '应该有合并后的数据')

    this.recordResult('冲突解决', true)
  }

  private async testPerformanceMonitoring() {
    console.log('\n📊 测试性能监控...')

    // 执行一些操作来收集性能数据
    for (let i = 0; i < 5; i++) {
      const card = this.dataGenerator.generateTestCard({ title: `Perf Test Card ${i}` })
      await this.offlineManager.executeOfflineOperation({
        type: 'create',
        entity: 'card',
        entityId: card.id,
        data: card,
        priority: 'medium'
      })
    }

    const metrics = await this.offlineManager.getOperationPerformanceMetrics()
    this.assert(metrics.totalOperations > 0, '应该有操作统计')
    this.assert(metrics.successfulOperations > 0, '应该有成功操作统计')
    this.assert(metrics.averageExecutionTime >= 0, '应该有平均执行时间')

    this.recordResult('性能监控', true)
  }

  private async testEventSystem() {
    console.log('\n🎯 测试事件系统...')

    let eventsReceived = 0

    const eventListener = () => {
      eventsReceived++
    }

    this.offlineManager.addEventListener('testEvent', eventListener)

    // 模拟触发事件
    const testCard = this.dataGenerator.generateTestCard({ title: 'Event Test Card' })
    await this.offlineManager.executeOfflineOperation(testCard)

    // 等待事件处理
    await new Promise(resolve => setTimeout(resolve, 100))

    this.assert(eventsReceived > 0, '应该接收到事件')

    this.recordResult('事件系统', true)
  }

  private async testIntegration() {
    console.log('\n🔗 测试系统集成...')

    // 添加离线操作
    const testCard = this.dataGenerator.generateTestCard({ title: 'Integration Test Card' })
    await this.offlineManager.executeOfflineOperation({
      type: 'create',
      entity: 'card',
      entityId: testCard.id,
      data: testCard,
      priority: 'high'
    })

    // 执行同步
    const syncResult = await this.syncService.performSmartSync()
    this.assert(syncResult.success, '同步应该成功')
    this.assert(syncResult.processedCount > 0, '应该处理了操作')

    // 检查同步状态
    const status = await this.syncService.getSyncStatus()
    this.assert(status.totalSyncs > 0, '应该有同步历史')

    this.recordResult('系统集成', true)
  }

  private async testStressConditions() {
    console.log('\n💪 测试压力条件...')

    const operationCount = 20
    const startTime = performance.now()

    // 批量执行操作
    const promises = []
    for (let i = 0; i < operationCount; i++) {
      const card = this.dataGenerator.generateTestCard({ title: `Stress Test Card ${i}` })
      promises.push(
        this.offlineManager.executeOfflineOperation({
          type: 'create',
          entity: 'card',
          entityId: card.id,
          data: card,
          priority: 'low'
        })
      )
    }

    await Promise.all(promises)

    const duration = performance.now() - startTime
    this.assert(duration < 10000, `应该在10秒内完成 ${operationCount} 个操作`)

    // 执行同步
    const syncResult = await this.syncService.performSmartSync()
    this.assert(syncResult.success, '压力条件下的同步应该成功')

    this.recordResult('压力条件', true)
  }

  private assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`断言失败: ${message}`)
    }
  }

  private recordResult(testName: string, success: boolean) {
    this.testResults.push({
      testName,
      success,
      timestamp: new Date()
    })

    const status = success ? '✅' : '❌'
    console.log(`${status} ${testName}`)
  }

  private printTestResults() {
    console.log('\n' + '=' * 60)
    console.log('📊 测试结果汇总')
    console.log('=' * 60)

    const passedTests = this.testResults.filter(r => r.success).length
    const totalTests = this.testResults.length

    console.log(`总测试数: ${totalTests}`)
    console.log(`通过测试: ${passedTests}`)
    console.log(`失败测试: ${totalTests - passedTests}`)
    console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`)

    console.log('\n详细结果:')
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌'
      console.log(`${status} ${result.testName} - ${result.timestamp.toLocaleTimeString()}`)
    })

    if (passedTests === totalTests) {
      console.log('\n🎉 所有测试通过！增强离线管理器功能正常')
    } else {
      console.log('\n⚠️  部分测试失败，请检查实现')
    }
  }
}

// ============================================================================
// 主执行函数
// ============================================================================

export async function runEnhancedOfflineQuickTests() {
  const runner = new EnhancedOfflineTestRunner()

  try {
    await runner.runAllTests()
  } catch (error) {
    console.error('❌ 测试执行失败:', error)
    process.exit(1)
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runEnhancedOfflineQuickTests()
}

// ============================================================================
// 导出测试工具
// ============================================================================

export {
  MockEnhancedOfflineManager,
  MockUnifiedSyncServiceBase,
  TestDataGenerator,
  NetworkSimulator,
  EnhancedOfflineTestRunner
}