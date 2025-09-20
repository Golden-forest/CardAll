// ============================================================================
// Phase 1 冲突状态管理修复 - 演示和测试脚本
// 展示如何使用新的冲突管理组件解决现有问题
// ============================================================================

import { unifiedSyncService } from '../unified-sync-service-base'
import { ConflictStateManager } from './conflict-state-manager'
import { ConflictDiagnosticTools } from './conflict-diagnostic-tools'
import { ConflictStorageOptimizer } from './conflict-storage-optimizer'
import { runConflictManagementTests } from './conflict-management-test-suite'

// ============================================================================
// 演示场景
// ============================================================================

export class Phase1Demo {
  private stateManager: ConflictStateManager
  private diagnosticTools: ConflictDiagnosticTools
  private storageOptimizer: ConflictStorageOptimizer

  constructor() {
    this.stateManager = new ConflictStateManager()
    this.diagnosticTools = new ConflictDiagnosticTools()
    this.storageOptimizer = new ConflictStorageOptimizer()
  }

  /**
   * 运行完整演示
   */
  async runFullDemo(): Promise<void> {
    console.log('🚀 Starting Phase 1 Conflict Management Demo')
    console.log('='.repeat(60))

    try {
      // 1. 初始化所有组件
      await this.initializeComponents()

      // 2. 演示冲突状态生命周期管理
      await this.demoConflictLifecycle()

      // 3. 演示持久化和恢复
      await this.demoPersistence()

      // 4. 演示诊断功能
      await this.demoDiagnostics()

      // 5. 演示存储优化
      await this.demoStorageOptimization()

      // 6. 演示集成功能
      await this.demoIntegration()

      // 7. 运行测试套件
      await this.runTestSuite()

      console.log('✅ Phase 1 Demo completed successfully!')

    } catch (error) {
      console.error('❌ Demo failed:', error)
    } finally {
      await this.cleanup()
    }
  }

  /**
   * 初始化组件
   */
  private async initializeComponents(): Promise<void> {
    console.log('🔧 Initializing Phase 1 components...')

    await Promise.all([
      this.stateManager.initialize(),
      this.diagnosticTools.initialize(),
      this.storageOptimizer.initialize()
    ])

    console.log('✅ All components initialized')
  }

  /**
   * 演示冲突状态生命周期
   */
  private async demoConflictLifecycle(): Promise<void> {
    console.log('\n🔄 Demonstrating Conflict State Lifecycle...')

    // 创建一个测试冲突
    const conflictId = await this.stateManager.createConflict({
      entityType: 'card',
      entityId: 'card-123',
      conflictType: 'content',
      status: 'pending',
      severity: 'high',
      localData: { content: 'Local card content' },
      cloudData: { content: 'Cloud card content' },
      localVersion: 1,
      cloudVersion: 2,
      localTimestamp: new Date(),
      cloudTimestamp: new Date(),
      detectionTime: 100,
      sourceDevice: 'demo-device',
      retryCount: 0,
      maxRetries: 3
    })

    console.log(`📝 Created conflict: ${conflictId}`)

    // 检查状态
    let state = this.stateManager.getConflictState(conflictId)
    console.log(`📊 Initial state: ${state?.status}`)

    // 状态转换：pending -> detecting
    await this.stateManager.updateConflictState(conflictId, { status: 'detecting' })
    state = this.stateManager.getConflictState(conflictId)
    console.log(`📊 State after detection: ${state?.status}`)

    // 状态转换：detecting -> resolving
    await this.stateManager.updateConflictState(conflictId, { status: 'resolving' })
    state = this.stateManager.getConflictState(conflictId)
    console.log(`📊 State during resolution: ${state?.status}`)

    // 解决冲突
    await this.stateManager.resolveConflict(conflictId, {
      type: 'merge',
      strategy: 'smart',
      success: true,
      reasoning: 'Demo resolution',
      timestamp: new Date()
    })

    // 验证最终状态
    state = this.stateManager.getConflictState(conflictId)
    console.log(`📊 Final state: ${state?.status}`)
    console.log(`✅ Conflict lifecycle completed successfully`)
  }

  /**
   * 演示持久化功能
   */
  private async demoPersistence(): Promise<void> {
    console.log('\n💾 Demonstrating Persistence...')

    // 创建多个冲突
    const conflictIds: string[] = []
    for (let i = 0; i < 5; i++) {
      const id = await this.stateManager.createConflict({
        entityType: 'card',
        entityId: `card-${i}`,
        conflictType: 'content',
        status: 'pending',
        severity: 'medium',
        localData: { content: `Local content ${i}` },
        cloudData: { content: `Cloud content ${i}` },
        localVersion: i,
        cloudVersion: i + 1,
        localTimestamp: new Date(),
        cloudTimestamp: new Date(),
        detectionTime: 100,
        sourceDevice: 'demo-device',
        retryCount: 0,
        maxRetries: 3
      })
      conflictIds.push(id)
    }

    console.log(`📝 Created ${conflictIds.length} conflicts`)

    // 持久化所有状态
    await this.stateManager.persistAllStates()
    console.log('💾 All conflicts persisted')

    // 检查指标
    const metrics = this.stateManager.getMetrics()
    console.log(`📊 Persistence metrics: ${metrics.persistenceStats.totalPersisted} persisted, ${metrics.persistenceStats.persistenceFailures} failures`)

    // 解决一些冲突
    for (let i = 0; i < 3; i++) {
      await this.stateManager.resolveConflict(conflictIds[i], {
        type: 'keep_local',
        strategy: 'timestamp',
        success: true,
        reasoning: `Demo resolution ${i}`,
        timestamp: new Date()
      })
    }

    // 检查最终状态
    const finalMetrics = this.stateManager.getMetrics()
    console.log(`📊 Final metrics: ${finalMetrics.resolvedConflicts} resolved, ${finalMetrics.pendingConflicts} pending`)
  }

  /**
   * 演示诊断功能
   */
  private async demoDiagnostics(): Promise<void> {
    console.log('\n🔍 Demonstrating Diagnostics...')

    // 创建一些有问题的情况
    await this.stateManager.createConflict({
      entityType: 'card',
      entityId: 'stale-card',
      conflictType: 'content',
      status: 'pending',
      severity: 'critical',
      localData: { content: 'Stale local content' },
      cloudData: { content: 'Fresh cloud content' },
      localVersion: 1,
      cloudVersion: 2,
      localTimestamp: new Date(Date.now() - 600000), // 10分钟前
      cloudTimestamp: new Date(),
      detectionTime: 100,
      sourceDevice: 'demo-device',
      retryCount: 4, // 超过重试限制
      maxRetries: 3
    })

    await this.stateManager.createConflict({
      entityType: 'folder',
      entityId: 'timeout-folder',
      conflictType: 'structure',
      status: 'resolving',
      severity: 'high',
      localData: { name: 'Local folder' },
      cloudData: { name: 'Cloud folder' },
      localVersion: 1,
      cloudVersion: 1,
      localTimestamp: new Date(),
      cloudTimestamp: new Date(),
      detectionTime: 100,
      resolutionTime: 400000, // 超过5分钟
      sourceDevice: 'demo-device',
      retryCount: 0,
      maxRetries: 3
    })

    console.log('📝 Created problematic conflicts for diagnosis')

    // 运行完整诊断
    const results = await this.diagnosticTools.runFullDiagnostic()
    console.log(`🔍 Found ${results.length} diagnostic issues`)

    // 显示一些诊断结果
    results.slice(0, 3).forEach((result, index) => {
      console.log(`  ${index + 1}. [${result.severity.toUpperCase()}] ${result.title}`)
      console.log(`     ${result.description}`)
    })

    // 获取健康报告
    const healthReport = await this.diagnosticTools.getHealthReport()
    console.log(`📊 System health: ${healthReport.overallHealth}`)
    console.log(`📊 ${healthReport.recommendations.length} recommendations provided`)

    // 检查日志
    const logs = this.diagnosticTools.getLogs({ limit: 5 })
    console.log(`📝 Recent logs: ${logs.length} entries`)
  }

  /**
   * 演示存储优化
   */
  private async demoStorageOptimization(): Promise<void> {
    console.log('\n🗄️ Demonstrating Storage Optimization...')

    // 创建大量冲突来测试存储
    const conflictIds: string[] = []
    for (let i = 0; i < 20; i++) {
      const id = await this.stateManager.createConflict({
        entityType: i % 2 === 0 ? 'card' : 'folder',
        entityId: `entity-${i}`,
        conflictType: 'content',
        status: i % 3 === 0 ? 'resolved' : 'pending',
        severity: i % 4 === 0 ? 'critical' : 'medium',
        localData: { content: `Local content ${i}`.repeat(10) }, // 大量数据
        cloudData: { content: `Cloud content ${i}`.repeat(10) },
        localVersion: i,
        cloudVersion: i + 1,
        localTimestamp: new Date(),
        cloudTimestamp: new Date(),
        detectionTime: 100,
        sourceDevice: 'demo-device',
        retryCount: 0,
        maxRetries: 3
      })
      conflictIds.push(id)
    }

    console.log(`📝 Created ${conflictIds.length} conflicts with large data`)

    // 获取初始存储指标
    const initialMetrics = this.storageOptimizer.getMetrics()
    console.log(`📊 Initial storage: ${initialMetrics.totalRecords} records, ${Math.round(initialMetrics.storageSize / 1024)}KB`)

    // 运行存储优化
    const optimizationResult = await this.storageOptimizer.optimizeStorage()
    console.log(`⚡ Storage optimization completed:`)
    console.log(`   - Space saved: ${Math.round(optimizationResult.spaceSaved / 1024)}KB`)
    console.log(`   - Records optimized: ${optimizationResult.recordsOptimized}`)
    console.log(`   - Time taken: ${Math.round(optimizationResult.timeTaken)}ms`)

    // 检查优化后指标
    const finalMetrics = this.storageOptimizer.getMetrics()
    console.log(`📊 Final storage: ${finalMetrics.totalRecords} records, ${Math.round(finalMetrics.storageSize / 1024)}KB`)

    // 测试查询性能
    const queryStart = performance.now()
    const queryResults = await this.storageOptimizer.queryConflicts({ limit: 10 })
    const queryTime = performance.now() - queryStart
    console.log(`⚡ Query performance: ${Math.round(queryTime)}ms for ${queryResults.length} results`)
  }

  /**
   * 演示集成功能
   */
  private async demoIntegration(): Promise<void> {
    console.log('\n🔗 Demonstrating Integration with Unified Sync Service...')

    // 使用统一同步服务的Phase 1功能
    try {
      // 获取冲突状态指标
      const stateMetrics = await unifiedSyncService.getConflictStateMetrics()
      console.log(`📊 Integrated state metrics: ${stateMetrics.totalConflicts} total conflicts`)

      // 获取诊断报告
      const diagnosticReport = await unifiedSyncService.getConflictDiagnosticReport()
      console.log(`📊 Integrated diagnostic health: ${diagnosticReport.overallHealth}`)

      // 获取存储指标
      const storageMetrics = await unifiedSyncService.getStorageMetrics()
      console.log(`📊 Integrated storage metrics: ${storageMetrics.totalRecords} records`)

      // 运行诊断
      const diagnosticResults = await unifiedSyncService.runConflictDiagnostic()
      console.log(`📊 Integrated diagnostic found: ${diagnosticResults.length} issues`)

      console.log('✅ Integration with Unified Sync Service successful')

    } catch (error) {
      console.warn('⚠️ Integration demo skipped - unified sync service not available:', (error as Error).message)
    }
  }

  /**
   * 运行测试套件
   */
  private async runTestSuite(): Promise<void> {
    console.log('\n🧪 Running Test Suite...')

    try {
      // 运行快速测试
      const testResults = await runConflictManagementTests({
        testData: { conflictCount: 10 },
        performance: { enabled: false },
        stress: { enabled: false }
      })

      console.log(`📊 Test Results:`)
      console.log(`   - Total tests: ${testResults.totalTests}`)
      console.log(`   - Passed: ${testResults.passedTests} ✅`)
      console.log(`   - Failed: ${testResults.failedTests} ${testResults.failedTests > 0 ? '❌' : '✅'}`)
      console.log(`   - Success rate: ${testResults.successRate.toFixed(1)}%`)
      console.log(`   - Duration: ${Math.round(testResults.duration)}ms`)

      if (testResults.failedTests > 0) {
        console.log('\n❌ Failed tests:')
        testResults.results
          .filter(r => r.status === 'failed')
          .forEach(test => {
            console.log(`   • ${test.name}: ${test.error}`)
          })
      }

    } catch (error) {
      console.error('❌ Test suite failed:', error)
    }
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up resources...')

    await Promise.all([
      this.stateManager.destroy(),
      this.diagnosticTools.destroy(),
      this.storageOptimizer.destroy()
    ])

    console.log('✅ Cleanup completed')
  }
}

// ============================================================================
// 便利函数
// ============================================================================

/**
 * 运行Phase 1演示
 */
export async function runPhase1Demo(): Promise<void> {
  const demo = new Phase1Demo()
  await demo.runFullDemo()
}

/**
 * 快速验证Phase 1功能
 */
export async function quickVerification(): Promise<void> {
  console.log('🔍 Quick Phase 1 Verification...')

  try {
    // 验证组件可以创建和初始化
    const stateManager = new ConflictStateManager()
    const diagnosticTools = new ConflictDiagnosticTools()
    const storageOptimizer = new ConflictStorageOptimizer()

    await Promise.all([
      stateManager.initialize(),
      diagnosticTools.initialize(),
      storageOptimizer.initialize()
    ])

    // 验证基本功能
    const conflictId = await stateManager.createConflict({
      entityType: 'card',
      entityId: 'test-card',
      conflictType: 'content',
      status: 'pending',
      severity: 'medium',
      localData: { content: 'Test' },
      cloudData: { content: 'Test' },
      localVersion: 1,
      cloudVersion: 2,
      localTimestamp: new Date(),
      cloudTimestamp: new Date(),
      detectionTime: 100,
      sourceDevice: 'test',
      retryCount: 0,
      maxRetries: 3
    })

    const state = stateManager.getConflictState(conflictId)
    if (!state || state.status !== 'pending') {
      throw new Error('State creation failed')
    }

    // 清理
    await Promise.all([
      stateManager.destroy(),
      diagnosticTools.destroy(),
      storageOptimizer.destroy()
    ])

    console.log('✅ Quick verification passed!')

  } catch (error) {
    console.error('❌ Quick verification failed:', error)
    throw error
  }
}

// ============================================================================
// 导出
// ============================================================================

export { Phase1Demo as default }

// 如果直接运行此文件，执行演示
if (typeof window !== 'undefined') {
  // 浏览器环境，提供全局函数
  (window as any).runPhase1Demo = runPhase1Demo
  (window as any).quickVerification = quickVerification
}