// ============================================================================
// Phase 1 验证脚本 - 独立运行测试
// 验证所有Phase 1组件的基本功能
// ============================================================================

import { ConflictStateManager } from './src/services/sync/conflict-state-manager'
import { ConflictDiagnosticTools } from './src/services/sync/conflict-diagnostic-tools'
import { ConflictStorageOptimizer } from './src/services/sync/conflict-storage-optimizer'

// ============================================================================
// 测试函数
// ============================================================================

async function testPhase1Components() {
  console.log('🚀 开始 Phase 1 组件验证测试')
  console.log('='.repeat(60))

  let stateManager: ConflictStateManager | null = null
  let diagnosticTools: ConflictDiagnosticTools | null = null
  let storageOptimizer: ConflictStorageOptimizer | null = null

  try {
    // 1. 初始化所有组件
    console.log('🔧 初始化组件...')

    stateManager = new ConflictStateManager()
    diagnosticTools = new ConflictDiagnosticTools()
    storageOptimizer = new ConflictStorageOptimizer()

    await Promise.all([
      stateManager.initialize(),
      diagnosticTools.initialize(),
      storageOptimizer.initialize()
    ])

    console.log('✅ 组件初始化成功')

    // 2. 测试冲突状态管理器
    console.log('\n🔄 测试冲突状态管理器...')

    // 创建冲突
    const conflictId = await stateManager.createConflict({
      entityType: 'card',
      entityId: 'test-card-123',
      conflictType: 'content',
      status: 'pending',
      severity: 'medium',
      localData: { content: '本地卡片内容' },
      cloudData: { content: '云端卡片内容' },
      localVersion: 1,
      cloudVersion: 2,
      localTimestamp: new Date(),
      cloudTimestamp: new Date(),
      detectionTime: Date.now(),
      sourceDevice: 'test-device',
      retryCount: 0,
      maxRetries: 3
    })

    console.log(`✅ 创建冲突成功: ${conflictId}`)

    // 检查状态
    let state = stateManager.getConflictState(conflictId)
    console.log(`📊 初始状态: ${state?.status}`)

    // 状态转换
    await stateManager.updateConflictState(conflictId, { status: 'detecting' })
    state = stateManager.getConflictState(conflictId)
    console.log(`📊 检测状态: ${state?.status}`)

    await stateManager.updateConflictState(conflictId, { status: 'resolving' })
    state = stateManager.getConflictState(conflictId)
    console.log(`📊 解决状态: ${state?.status}`)

    // 解决冲突
    const resolutionResult = await stateManager.resolveConflict(conflictId, {
      type: 'merge',
      strategy: 'smart',
      success: true,
      reasoning: '测试解决',
      timestamp: new Date()
    })

    console.log(`✅ 冲突解决结果: ${resolutionResult ? '成功' : '失败'}`)

    // 验证最终状态
    state = stateManager.getConflictState(conflictId)
    console.log(`📊 最终状态: ${state?.status}`)

    // 3. 测试存储优化器
    console.log('\n🗄️ 测试存储优化器...')

    // 存储冲突状态
    if (state) {
      await storageOptimizer.storeConflict(state)
      console.log('✅ 冲突状态存储成功')
    }

    // 查询冲突
    const queryResults = await storageOptimizer.queryConflicts({ limit: 10 })
    console.log(`📊 查询结果: ${queryResults.length} 个冲突`)

    // 4. 测试诊断工具
    console.log('\n🔍 测试诊断工具...')

    // 创建问题冲突用于诊断
    const problematicConflictId = await stateManager.createConflict({
      entityType: 'card',
      entityId: 'stale-card',
      conflictType: 'content',
      status: 'pending',
      severity: 'critical',
      localData: { content: '过期的本地内容' },
      cloudData: { content: '新的云端内容' },
      localVersion: 1,
      cloudVersion: 2,
      localTimestamp: new Date(Date.now() - 600000), // 10分钟前
      cloudTimestamp: new Date(),
      detectionTime: Date.now(),
      sourceDevice: 'test-device',
      retryCount: 4, // 超过重试限制
      maxRetries: 3
    })

    console.log(`✅ 创建问题冲突: ${problematicConflictId}`)

    // 运行诊断
    const diagnosticResults = await diagnosticTools.runFullDiagnostic()
    console.log(`📊 诊断结果: ${diagnosticResults.length} 个问题`)

    if (diagnosticResults.length > 0) {
      console.log('🔍 主要问题:')
      diagnosticResults.slice(0, 3).forEach((result, index) => {
        console.log(`  ${index + 1}. [${result.severity.toUpperCase()}] ${result.title}`)
      })
    }

    // 5. 测试持久化
    console.log('\n💾 测试持久化...')

    await stateManager.persistAllStates()
    console.log('✅ 状态持久化成功')

    const metrics = stateManager.getMetrics()
    console.log(`📊 持久化指标: ${metrics.persistenceStats.totalPersisted} 个已持久化`)

    // 6. 获取健康报告
    console.log('\n🏥 获取系统健康报告...')

    const healthReport = await diagnosticTools.getHealthReport()
    console.log(`📊 系统健康状态: ${healthReport.overallHealth}`)
    console.log(`📊 建议: ${healthReport.recommendations.length} 条`)

    console.log('\n✅ Phase 1 组件验证测试完成!')

  } catch (error) {
    console.error('❌ 测试失败:', error)
    throw error
  } finally {
    // 清理资源
    console.log('\n🧹 清理资源...')
    await Promise.all([
      stateManager?.destroy(),
      diagnosticTools?.destroy(),
      storageOptimizer?.destroy()
    ])
    console.log('✅ 资源清理完成')
  }
}

// ============================================================================
// 导出测试函数
// ============================================================================

export { testPhase1Components }

// ============================================================================
// 如果直接运行此脚本
// ============================================================================

if (typeof window !== 'undefined') {
  // 浏览器环境
  (window as any).testPhase1Components = testPhase1Components
} else {
  // Node.js 环境
  if (require.main === module) {
    testPhase1Components()
      .then(() => {
        console.log('\n🎉 所有测试通过!')
        process.exit(0)
      })
      .catch((error) => {
        console.error('\n💥 测试失败:', error)
        process.exit(1)
      })
  }
}