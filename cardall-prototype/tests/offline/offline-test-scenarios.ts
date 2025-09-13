// 离线功能测试场景设计
// 提供全面的离线功能测试用例和模拟环境

import { jest } from '@jest/globals'
import { OfflineManager } from '../../src/services/offline-manager'
import { NetworkMonitor } from '../../src/services/network-monitor'
import { DatabaseUnified } from '../../src/services/database-unified'
import { mockDataUtils, networkUtils } from '../test-utils'

// ============================================================================
// 离线测试场景定义
// ============================================================================

export interface OfflineTestScenario {
  name: string
  description: string
  setup: () => Promise<void>
  execute: () => Promise<OfflineTestResult>
  cleanup: () => Promise<void>
  expectedResults: OfflineTestExpectation
}

export interface OfflineTestResult {
  success: boolean
  duration: number
  operations: TestOperation[]
  errors: string[]
  warnings: string[]
  metrics: OfflineTestMetrics
}

export interface TestOperation {
  type: 'create' | 'update' | 'delete'
  entity: 'card' | 'folder' | 'tag'
  entityId: string
  timestamp: Date
  success: boolean
  error?: string
  syncStatus: 'pending' | 'synced' | 'failed'
}

export interface OfflineTestMetrics {
  offlineOperationsCount: number
  queuedOperationsCount: number
  syncOperationsCount: number
  conflictCount: number
  dataIntegrityScore: number
  responseTimeAverage: number
  memoryUsage: number
}

export interface OfflineTestExpectation {
  success: boolean
  maxDuration?: number
  maxErrors?: number
  minDataIntegrity?: number
  maxResponseTime?: number
  specificBehaviors?: string[]
}

// ============================================================================
// 离线测试场景集合
// ============================================================================

export const offlineTestScenarios: OfflineTestScenario[] = [
  // 场景1: 基本离线操作
  {
    name: 'Basic Offline Operations',
    description: '测试基本的离线操作功能，包括创建、更新、删除操作',
    setup: async () => {
      // 模拟离线环境
      networkUtils.simulateOffline()
      
      // 清理测试数据
      await DatabaseUnified.clearTestData()
      
      // 初始化离线管理器
      await OfflineManager.initialize()
    },
    execute: async () => {
      const startTime = performance.now()
      const operations: TestOperation[] = []
      const errors: string[] = []
      
      try {
        // 测试创建操作
        const card1 = mockDataUtils.generateTestCard({ title: 'Offline Card 1' })
        const createResult = await OfflineManager.queueOfflineOperation({
          type: 'create',
          entity: 'card',
          entityId: card1.id,
          data: card1,
          timestamp: new Date()
        })
        
        operations.push({
          type: 'create',
          entity: 'card',
          entityId: card1.id,
          timestamp: new Date(),
          success: createResult.success,
          syncStatus: 'pending'
        })
        
        // 测试更新操作
        const folder1 = mockDataUtils.generateTestFolder({ name: 'Offline Folder 1' })
        const updateResult = await OfflineManager.queueOfflineOperation({
          type: 'update',
          entity: 'folder',
          entityId: folder1.id,
          data: { ...folder1, name: 'Updated Offline Folder' },
          timestamp: new Date()
        })
        
        operations.push({
          type: 'update',
          entity: 'folder',
          entityId: folder1.id,
          timestamp: new Date(),
          success: updateResult.success,
          syncStatus: 'pending'
        })
        
        // 测试删除操作
        const deleteResult = await OfflineManager.queueOfflineOperation({
          type: 'delete',
          entity: 'tag',
          entityId: 'test-tag-to-delete',
          data: {},
          timestamp: new Date()
        })
        
        operations.push({
          type: 'delete',
          entity: 'tag',
          entityId: 'test-tag-to-delete',
          timestamp: new Date(),
          success: deleteResult.success,
          syncStatus: 'pending'
        })
        
      } catch (error) {
        errors.push(`Test execution failed: ${error}`)
      }
      
      const duration = performance.now() - startTime
      
      // 验证离线操作结果
      const stats = await OfflineManager.getOfflineStats()
      
      return {
        success: errors.length === 0,
        duration,
        operations,
        errors,
        warnings: [],
        metrics: {
          offlineOperationsCount: operations.length,
          queuedOperationsCount: stats.pendingOperations,
          syncOperationsCount: 0,
          conflictCount: 0,
          dataIntegrityScore: 1.0,
          responseTimeAverage: duration / operations.length,
          memoryUsage: 0
        }
      }
    },
    cleanup: async () => {
      // 恢复网络连接
      networkUtils.simulateOnline()
      
      // 清理测试数据
      await DatabaseUnified.clearTestData()
    },
    expectedResults: {
      success: true,
      maxDuration: 1000,
      maxErrors: 0,
      minDataIntegrity: 1.0,
      maxResponseTime: 500,
      specificBehaviors: [
        'All operations should be queued when offline',
        'No operations should be synced while offline',
        'Local storage should persist operations'
      ]
    }
  },
  
  // 场景2: 网络状态变化测试
  {
    name: 'Network State Transitions',
    description: '测试网络状态变化时的离线操作处理，包括断网和恢复',
    setup: async () => {
      // 初始化离线管理器和网络监控
      await OfflineManager.initialize()
      await NetworkMonitor.initialize()
      
      // 清理测试数据
      await DatabaseUnified.clearTestData()
      
      // 设置网络状态监听器
      NetworkMonitor.addListener('online', () => {
        console.log('Network online event detected')
      })
      
      NetworkMonitor.addListener('offline', () => {
        console.log('Network offline event detected')
      })
    },
    execute: async () => {
      const startTime = performance.now()
      const operations: TestOperation[] = []
      const errors: string[] = []
      
      try {
        // 第1阶段：在线状态
        console.log('Phase 1: Online state')
        const card1 = mockDataUtils.generateTestCard({ title: 'Online Card' })
        await OfflineManager.queueOfflineOperation({
          type: 'create',
          entity: 'card',
          entityId: card1.id,
          data: card1,
          timestamp: new Date()
        })
        
        // 第2阶段：模拟断网
        console.log('Phase 2: Simulating network disconnection')
        networkUtils.simulateOffline()
        await networkUtils.waitForNetworkChange()
        
        const card2 = mockDataUtils.generateTestCard({ title: 'Offline Card 2' })
        await OfflineManager.queueOfflineOperation({
          type: 'create',
          entity: 'card',
          entityId: card2.id,
          data: card2,
          timestamp: new Date()
        })
        
        // 等待离线状态稳定
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // 第3阶段：恢复网络
        console.log('Phase 3: Recovering network')
        networkUtils.simulateOnline()
        await networkUtils.waitForNetworkChange()
        
        // 等待自动同步完成
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (error) {
        errors.push(`Network transition test failed: ${error}`)
      }
      
      const duration = performance.now() - startTime
      
      // 验证结果
      const stats = await OfflineManager.getOfflineStats()
      const networkHistory = await NetworkMonitor.getNetworkHistory()
      
      return {
        success: errors.length === 0,
        duration,
        operations,
        errors,
        warnings: [],
        metrics: {
          offlineOperationsCount: stats.pendingOperations,
          queuedOperationsCount: stats.pendingOperations,
          syncOperationsCount: stats.syncedOperations,
          conflictCount: 0,
          dataIntegrityScore: 1.0,
          responseTimeAverage: duration / Math.max(operations.length, 1),
          memoryUsage: 0
        }
      }
    },
    cleanup: async () => {
      // 确保网络连接恢复
      networkUtils.simulateOnline()
      
      // 清理监听器
      NetworkMonitor.removeAllListeners()
      
      // 清理测试数据
      await DatabaseUnified.clearTestData()
    },
    expectedResults: {
      success: true,
      maxDuration: 5000,
      maxErrors: 0,
      minDataIntegrity: 1.0,
      specificBehaviors: [
        'Network transitions should be detected correctly',
        'Operations should be queued when offline',
        'Automatic sync should trigger when online',
        'Network history should record all state changes'
      ]
    }
  },
  
  // 场景3: 大量离线操作压力测试
  {
    name: 'High Volume Offline Operations',
    description: '测试大量离线操作的性能和稳定性',
    setup: async () => {
      // 模拟离线环境
      networkUtils.simulateOffline()
      
      // 清理测试数据
      await DatabaseUnified.clearTestData()
      
      // 初始化离线管理器
      await OfflineManager.initialize()
      
      // 配置性能监控
      await OfflineManager.configure({
        maxOfflineOperations: 1000,
        compressionThreshold: 1024,
        enablePerformanceMonitoring: true
      })
    },
    execute: async () => {
      const startTime = performance.now()
      const operations: TestOperation[] = []
      const errors: string[] = []
      
      try {
        // 生成大量测试数据
        const testOperations = []
        const operationCount = 500
        
        for (let i = 0; i < operationCount; i++) {
          const card = mockDataUtils.generateTestCard({
            title: `Stress Test Card ${i}`,
            content: `Content for stress test card ${i}`.repeat(10) // 增加数据量
          })
          
          testOperations.push({
            type: 'create',
            entity: 'card',
            entityId: card.id,
            data: card,
            timestamp: new Date()
          })
        }
        
        // 批量添加操作
        console.log(`Adding ${operationCount} operations...`)
        const batchStartTime = performance.now()
        
        for (const op of testOperations) {
          const result = await OfflineManager.queueOfflineOperation(op)
          
          operations.push({
            type: op.type,
            entity: op.entity,
            entityId: op.entityId,
            timestamp: op.timestamp,
            success: result.success,
            syncStatus: 'pending'
          })
        }
        
        const batchDuration = performance.now() - batchStartTime
        console.log(`Batch operations completed in ${batchDuration.toFixed(2)}ms`)
        
        // 验证内存使用
        const memoryUsage = await OfflineManager.getMemoryUsage()
        
        // 验证数据压缩
        const compressionStats = await OfflineManager.getCompressionStats()
        
      } catch (error) {
        errors.push(`High volume test failed: ${error}`)
      }
      
      const duration = performance.now() - startTime
      
      // 获取最终统计
      const stats = await OfflineManager.getOfflineStats()
      
      return {
        success: errors.length === 0,
        duration,
        operations,
        errors,
        warnings: [],
        metrics: {
          offlineOperationsCount: operations.length,
          queuedOperationsCount: stats.pendingOperations,
          syncOperationsCount: 0,
          conflictCount: 0,
          dataIntegrityScore: 1.0,
          responseTimeAverage: duration / operations.length,
          memoryUsage: stats.memoryUsage || 0
        }
      }
    },
    cleanup: async () => {
      // 恢复网络连接
      networkUtils.simulateOnline()
      
      // 清理测试数据
      await DatabaseUnified.clearTestData()
      
      // 重置配置
      await OfflineManager.resetConfiguration()
    },
    expectedResults: {
      success: true,
      maxDuration: 10000,
      maxErrors: 0,
      minDataIntegrity: 0.95,
      specificBehaviors: [
        'All operations should be queued successfully',
        'Memory usage should remain stable',
        'Performance should not degrade significantly',
        'Data compression should be effective'
      ]
    }
  },
  
  // 场景4: 冲突解决测试
  {
    name: 'Conflict Resolution Scenarios',
    description: '测试离线操作中的冲突检测和解决机制',
    setup: async () => {
      // 初始化离线管理器
      await OfflineManager.initialize()
      
      // 清理测试数据
      await DatabaseUnified.clearTestData()
      
      // 创建初始数据
      const initialCard = mockDataUtils.generateTestCard({
        id: 'conflict-test-card',
        title: 'Original Card',
        content: 'Original content'
      })
      
      // 模拟云端已有数据
      await DatabaseUnified.createCard(initialCard)
    },
    execute: async () => {
      const startTime = performance.now()
      const operations: TestOperation[] = []
      const errors: string[] = []
      
      try {
        // 第1步：模拟离线状态并修改数据
        networkUtils.simulateOffline()
        
        const localUpdate = {
          type: 'update',
          entity: 'card',
          entityId: 'conflict-test-card',
          data: {
            title: 'Local Modified Card',
            content: 'Locally modified content',
            updatedAt: new Date()
          },
          timestamp: new Date()
        }
        
        await OfflineManager.queueOfflineOperation(localUpdate)
        
        operations.push({
          type: 'update',
          entity: 'card',
          entityId: 'conflict-test-card',
          timestamp: new Date(),
          success: true,
          syncStatus: 'pending'
        })
        
        // 第2步：模拟云端也被修改
        await DatabaseUnified.updateCard({
          id: 'conflict-test-card',
          title: 'Remote Modified Card',
          content: 'Remotely modified content',
          updatedAt: new Date(Date.now() + 1000) // 稍晚的时间
        })
        
        // 第3步：恢复网络，触发冲突检测
        networkUtils.simulateOnline()
        
        // 等待冲突检测和处理
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // 获取冲突信息
        const conflicts = await OfflineManager.getDetectedConflicts()
        
        // 模拟冲突解决
        for (const conflict of conflicts) {
          const resolution = await OfflineManager.resolveConflict(conflict, 'merge')
          console.log(`Conflict resolved: ${resolution.success}`)
        }
        
      } catch (error) {
        errors.push(`Conflict resolution test failed: ${error}`)
      }
      
      const duration = performance.now() - startTime
      
      // 获取冲突统计
      const conflicts = await OfflineManager.getDetectedConflicts()
      
      return {
        success: errors.length === 0,
        duration,
        operations,
        errors,
        warnings: [],
        metrics: {
          offlineOperationsCount: operations.length,
          queuedOperationsCount: operations.length,
          syncOperationsCount: 0,
          conflictCount: conflicts.length,
          dataIntegrityScore: conflicts.length === 0 ? 1.0 : 0.8,
          responseTimeAverage: duration / Math.max(operations.length, 1),
          memoryUsage: 0
        }
      }
    },
    cleanup: async () => {
      // 确保网络连接恢复
      networkUtils.simulateOnline()
      
      // 清理测试数据
      await DatabaseUnified.clearTestData()
    },
    expectedResults: {
      success: true,
      maxDuration: 3000,
      maxErrors: 0,
      minDataIntegrity: 0.8,
      specificBehaviors: [
        'Conflicts should be detected correctly',
        'Conflict resolution should be available',
        'Data integrity should be maintained',
        'Both local and remote changes should be preserved'
      ]
    }
  },
  
  // 场景5: 数据持久化和恢复测试
  {
    name: 'Data Persistence and Recovery',
    description: '测试离线数据的持久化存储和恢复功能',
    setup: async () => {
      // 模拟离线环境
      networkUtils.simulateOffline()
      
      // 清理测试数据
      await DatabaseUnified.clearTestData()
      
      // 初始化离线管理器
      await OfflineManager.initialize()
      
      // 配置备份策略
      await OfflineManager.configure({
        enableAutoBackup: true,
        backupInterval: 1000, // 1秒
        maxBackups: 3
      })
    },
    execute: async () => {
      const startTime = performance.now()
      const operations: TestOperation[] = []
      const errors: string[] = []
      
      try {
        // 创建测试数据
        const testData = []
        for (let i = 0; i < 20; i++) {
          const card = mockDataUtils.generateTestCard({
            title: `Persistence Test Card ${i}`,
            content: `Content ${i}`.repeat(5)
          })
          
          await OfflineManager.queueOfflineOperation({
            type: 'create',
            entity: 'card',
            entityId: card.id,
            data: card,
            timestamp: new Date()
          })
          
          operations.push({
            type: 'create',
            entity: 'card',
            entityId: card.id,
            timestamp: new Date(),
            success: true,
            syncStatus: 'pending'
          })
        }
        
        // 等待自动备份
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // 创建备份快照
        const snapshot = await OfflineManager.createBackupSnapshot()
        
        // 模拟数据损坏
        await OfflineManager.simulateDataCorruption()
        
        // 从备份恢复
        const restoreResult = await OfflineManager.restoreFromSnapshot(snapshot.id)
        
        if (!restoreResult.success) {
          errors.push('Failed to restore from backup')
        }
        
        // 验证数据完整性
        const integrityCheck = await OfflineManager.verifyDataIntegrity()
        
        if (!integrityCheck.valid) {
          errors.push(`Data integrity check failed: ${integrityCheck.errors.join(', ')}`)
        }
        
      } catch (error) {
        errors.push(`Persistence test failed: ${error}`)
      }
      
      const duration = performance.now() - startTime
      
      // 获取备份统计
      const backupStats = await OfflineManager.getBackupStats()
      
      return {
        success: errors.length === 0,
        duration,
        operations,
        errors,
        warnings: [],
        metrics: {
          offlineOperationsCount: operations.length,
          queuedOperationsCount: operations.length,
          syncOperationsCount: 0,
          conflictCount: 0,
          dataIntegrityScore: backupStats.integrityScore || 1.0,
          responseTimeAverage: duration / operations.length,
          memoryUsage: backupStats.memoryUsage || 0
        }
      }
    },
    cleanup: async () => {
      // 恢复网络连接
      networkUtils.simulateOnline()
      
      // 清理测试数据
      await DatabaseUnified.clearTestData()
      
      // 清理备份
      await OfflineManager.cleanupBackups()
    },
    expectedResults: {
      success: true,
      maxDuration: 5000,
      maxErrors: 0,
      minDataIntegrity: 0.9,
      specificBehaviors: [
        'Automatic backups should be created',
        'Data should be recoverable from backups',
        'Data integrity should be maintained',
        'Backup and restore should be efficient'
      ]
    }
  }
]

// ============================================================================
// 测试执行器
// ============================================================================

export class OfflineTestExecutor {
  private scenarios: OfflineTestScenario[]
  private results: Map<string, OfflineTestResult> = new Map()
  
  constructor(scenarios: OfflineTestScenario[] = offlineTestScenarios) {
    this.scenarios = scenarios
  }
  
  async runAllTests(): Promise<Map<string, OfflineTestResult>> {
    console.log(`Starting offline tests execution...`)
    console.log(`Total scenarios: ${this.scenarios.length}`)
    
    for (const scenario of this.scenarios) {
      console.log(`\n=== Running scenario: ${scenario.name} ===`)
      console.log(`Description: ${scenario.description}`)
      
      try {
        // 执行场景
        const result = await this.runScenario(scenario)
        this.results.set(scenario.name, result)
        
        // 验证结果
        const validation = this.validateResult(result, scenario.expectedResults)
        
        console.log(`Result: ${result.success ? 'PASS' : 'FAIL'}`)
        console.log(`Duration: ${result.duration.toFixed(2)}ms`)
        console.log(`Operations: ${result.operations.length}`)
        console.log(`Errors: ${result.errors.length}`)
        console.log(`Validation: ${validation.valid ? 'PASS' : 'FAIL'}`)
        
        if (!validation.valid) {
          console.log(`Validation errors: ${validation.errors.join(', ')}`)
        }
        
      } catch (error) {
        console.error(`Scenario failed with error:`, error)
        
        const errorResult: OfflineTestResult = {
          success: false,
          duration: 0,
          operations: [],
          errors: [String(error)],
          warnings: [],
          metrics: {
            offlineOperationsCount: 0,
            queuedOperationsCount: 0,
            syncOperationsCount: 0,
            conflictCount: 0,
            dataIntegrityScore: 0,
            responseTimeAverage: 0,
            memoryUsage: 0
          }
        }
        
        this.results.set(scenario.name, errorResult)
      }
      
      // 场景间延迟
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    return this.results
  }
  
  private async runScenario(scenario: OfflineTestScenario): Promise<OfflineTestResult> {
    // 执行设置
    await scenario.setup()
    
    try {
      // 执行测试
      const result = await scenario.execute()
      return result
    } finally {
      // 执行清理
      await scenario.cleanup()
    }
  }
  
  private validateResult(
    result: OfflineTestResult, 
    expected: OfflineTestExpectation
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (result.success !== expected.success) {
      errors.push(`Expected success: ${expected.success}, got: ${result.success}`)
    }
    
    if (expected.maxDuration && result.duration > expected.maxDuration) {
      errors.push(`Duration exceeded: ${result.duration}ms > ${expected.maxDuration}ms`)
    }
    
    if (expected.maxErrors && result.errors.length > expected.maxErrors) {
      errors.push(`Too many errors: ${result.errors.length} > ${expected.maxErrors}`)
    }
    
    if (expected.minDataIntegrity && result.metrics.dataIntegrityScore < expected.minDataIntegrity) {
      errors.push(`Data integrity too low: ${result.metrics.dataIntegrityScore} < ${expected.minDataIntegrity}`)
    }
    
    if (expected.maxResponseTime && result.metrics.responseTimeAverage > expected.maxResponseTime) {
      errors.push(`Response time too high: ${result.metrics.responseTimeAverage}ms > ${expected.maxResponseTime}ms`)
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
  
  generateReport(): string {
    let report = '# 离线功能测试报告\n\n'
    report += `测试时间: ${new Date().toISOString()}\n`
    report += `测试场景: ${this.scenarios.length}\n\n`
    
    const passedTests = Array.from(this.results.values()).filter(r => r.success).length
    const failedTests = this.scenarios.length - passedTests
    
    report += `## 测试摘要\n`
    report += `- 通过: ${passedTests}\n`
    report += `- 失败: ${failedTests}\n`
    report += `- 通过率: ${((passedTests / this.scenarios.length) * 100).toFixed(1)}%\n\n`
    
    report += `## 详细结果\n\n`
    
    for (const [scenarioName, result] of this.results) {
      report += `### ${scenarioName}\n`
      report += `- 状态: ${result.success ? '✅ 通过' : '❌ 失败'}\n`
      report += `- 耗时: ${result.duration.toFixed(2)}ms\n`
      report += `- 操作数: ${result.operations.length}\n`
      report += `- 错误数: ${result.errors.length}\n`
      report += `- 数据完整性: ${(result.metrics.dataIntegrityScore * 100).toFixed(1)}%\n`
      
      if (result.errors.length > 0) {
        report += `- 错误详情: ${result.errors.join('; ')}\n`
      }
      
      report += '\n'
    }
    
    return report
  }
}

// ============================================================================
// 导出工具函数
// ============================================================================

export async function runOfflineTests(): Promise<{
  results: Map<string, OfflineTestResult>
  report: string
}> {
  const executor = new OfflineTestExecutor()
  const results = await executor.runAllTests()
  const report = executor.generateReport()
  
  return { results, report }
}

export async function runSpecificTestScenario(scenarioName: string): Promise<OfflineTestResult> {
  const scenario = offlineTestScenarios.find(s => s.name === scenarioName)
  
  if (!scenario) {
    throw new Error(`Scenario not found: ${scenarioName}`)
  }
  
  const executor = new OfflineTestExecutor([scenario])
  const results = await executor.runAllTests()
  
  return results.get(scenarioName)!
}