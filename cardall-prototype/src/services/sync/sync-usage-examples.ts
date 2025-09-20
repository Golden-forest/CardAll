/**
 * 增量同步使用示例
 * 展示如何使用新的增量同步功能
 */

import { syncIntegrationService } from './sync-integration-service'
import { incrementalSyncAlgorithm } from './incremental-sync-algorithm'
import { versionControlSystem } from './version-control-system'
import { syncPerformanceOptimizer } from './sync-performance-optimizer'
import { syncCompatibilityAdapter } from './sync-compatibility-adapter'

// ============================================================================
// 基础使用示例
// ============================================================================

/**
 * 基础同步示例
 */
export async function basicSyncExample() {
  console.log('=== 基础同步示例 ===')

  try {
    // 1. 初始化同步集成服务
    await syncIntegrationService.initialize()

    // 2. 执行智能同步（自动选择最佳策略）
    await syncIntegrationService.performSmartSync()

    // 3. 获取同步状态
    const status = await syncIntegrationService.getSyncStatus()
    console.log('同步状态:', status)

    // 4. 获取集成指标
    const metrics = syncIntegrationService.getIntegrationMetrics()
    console.log('集成指标:', metrics)

  } catch (error) {
    console.error('同步失败:', error)
  }
}

/**
 * 增量同步示例
 */
export async function incrementalSyncExample() {
  console.log('=== 增量同步示例 ===')

  try {
    // 1. 执行增量同步
    await syncIntegrationService.performIncrementalSync({
      entityTypes: ['card', 'folder'], // 只同步卡片和文件夹
      sinceVersion: 123, // 从特定版本开始同步
      forceFullSync: false // 不强制完整同步
    })

    console.log('增量同步完成')

  } catch (error) {
    console.error('增量同步失败:', error)
  }
}

/**
 * 完整同步示例
 */
export async function fullSyncExample() {
  console.log('=== 完整同步示例 ===')

  try {
    // 1. 执行完整同步
    await syncIntegrationService.performFullSync()

    console.log('完整同步完成')

  } catch (error) {
    console.error('完整同步失败:', error)
  }
}

// ============================================================================
// 高级使用示例
// ============================================================================

/**
 * 版本控制示例
 */
export async function versionControlExample() {
  console.log('=== 版本控制示例 ===')

  try {
    // 1. 创建一个卡片版本
    const cardData = {
      id: 'card_123',
      frontContent: '新卡片正面',
      backContent: '新卡片背面',
      style: { color: 'blue' }
    }

    const versionInfo = await versionControlSystem.createVersion(
      'card_123',
      'card',
      cardData,
      'user_123',
      '创建新卡片'
    )

    console.log('版本创建成功:', versionInfo)

    // 2. 检测变更
    const updatedCardData = {
      ...cardData,
      frontContent: '更新后的卡片正面'
    }

    const changeDetection = await versionControlSystem.detectChanges(
      'card_123',
      'card',
      updatedCardData
    )

    console.log('变更检测结果:', changeDetection)

    // 3. 获取版本历史
    const versionHistory = await versionControlSystem.getVersionHistory('card_123', 'card')
    console.log('版本历史:', versionHistory)

  } catch (error) {
    console.error('版本控制操作失败:', error)
  }
}

/**
 * 性能优化示例
 */
export async function performanceOptimizationExample() {
  console.log('=== 性能优化示例 ===')

  try {
    // 1. 批量优化同步操作
    const operations = [
      {
        type: 'update' as const,
        entity: 'card' as const,
        entityId: 'card_123',
        data: { frontContent: '优化后的内容' },
        priority: 'normal' as const
      },
      {
        type: 'create' as const,
        entity: 'folder' as const,
        entityId: 'folder_456',
        data: { name: '新文件夹' },
        priority: 'high' as const
      }
    ]

    const batchResult = await syncPerformanceOptimizer.optimizeBatching(operations, {
      networkQuality: 'good',
      memoryPressure: false,
      timeSensitive: false
    })

    console.log('批量优化结果:', batchResult)

    // 2. 获取性能报告
    const performanceReport = await syncPerformanceOptimizer.getPerformanceReport()
    console.log('性能报告:', performanceReport.summary)

  } catch (error) {
    console.error('性能优化失败:', error)
  }
}

/**
 * 兼容性检查示例
 */
export async function compatibilityCheckExample() {
  console.log('=== 兼容性检查示例 ===')

  try {
    // 1. 获取兼容性报告
    const compatibilityReport = syncCompatibilityAdapter.getCompatibilityReport()
    console.log('兼容性报告:', compatibilityReport)

    // 2. 执行兼容同步
    await syncCompatibilityAdapter.performCompatibleSync({
      type: 'incremental',
      force: false
    })

    console.log('兼容同步完成')

  } catch (error) {
    console.error('兼容性检查失败:', error)
  }
}

// ============================================================================
// 监控和分析示例
// ============================================================================

/**
 * 集成监控示例
 */
export async function integrationMonitoringExample() {
  console.log('=== 集成监控示例 ===')

  try {
    // 1. 设置指标监听器
    const unsubscribeMetrics = syncIntegrationService.onIntegrationMetrics((metrics) => {
      console.log('集成指标更新:', {
        整体性能: `${metrics.overallPerformance.toFixed(2)  }%`,
        用户体验: `${metrics.userExperienceScore.toFixed(2)  }%`,
        系统稳定性: `${metrics.systemStability.toFixed(2)  }%`,
        增量同步效率: `${metrics.incrementalSyncEfficiency.toFixed(2)  }%`,
        缓存命中率: `${metrics.cacheHitRate.toFixed(2)  }%`
      })
    })

    // 2. 设置迁移进度监听器
    const unsubscribeMigration = syncIntegrationService.onMigrationProgress((progress) => {
      console.log(`迁移进度: ${progress.toFixed(2)}%`)
    })

    // 3. 执行一些同步操作来触发监控
    await syncIntegrationService.performSmartSync()

    // 4. 获取当前状态
    const status = syncIntegrationService.getIntegrationStatus()
    console.log('集成状态:', status)

    // 5. 清理监听器
    setTimeout(() => {
      unsubscribeMetrics()
      unsubscribeMigration()
    }, 5000)

  } catch (error) {
    console.error('集成监控失败:', error)
  }
}

/**
 * 性能分析示例
 */
export async function performanceAnalysisExample() {
  console.log('=== 性能分析示例 ===')

  try {
    // 1. 执行多次同步操作以收集数据
    const syncTimes = []
    for (let i = 0; i < 5; i++) {
      const startTime = performance.now()
      await syncIntegrationService.performIncrementalSync()
      const endTime = performance.now()
      syncTimes.push(endTime - startTime)
    }

    // 2. 分析性能数据
    const avgSyncTime = syncTimes.reduce((a, b) => a + b, 0) / syncTimes.length
    const minSyncTime = Math.min(...syncTimes)
    const maxSyncTime = Math.max(...syncTimes)

    console.log('性能分析结果:', {
      平均同步时间: `${avgSyncTime.toFixed(2)  }ms`,
      最快同步时间: `${minSyncTime.toFixed(2)  }ms`,
      最慢同步时间: `${maxSyncTime.toFixed(2)  }ms`,
      性能稳定性: `${((1 - (maxSyncTime - minSyncTime) / avgSyncTime) * 100).toFixed(2)  }%`
    })

    // 3. 获取详细指标
    const metrics = syncIntegrationService.getIntegrationMetrics()
    console.log('详细指标:', metrics)

  } catch (error) {
    console.error('性能分析失败:', error)
  }
}

// ============================================================================
// 错误处理和恢复示例
// ============================================================================

/**
 * 错误处理示例
 */
export async function errorHandlingExample() {
  console.log('=== 错误处理示例 ===')

  try {
    // 1. 模拟网络错误情况下的同步
    try {
      await syncIntegrationService.performSmartSync()
    } catch (error) {
      console.log('同步失败，尝试恢复...')

      // 2. 检查兼容性并尝试回退
      const compatibilityReport = syncCompatibilityAdapter.getCompatibilityReport()
      if (compatibilityReport && compatibilityReport.status !== 'compatible') {
        console.log('检测到兼容性问题，尝试自动修复...')

        // 兼容性适配器会自动尝试修复
        await syncCompatibilityAdapter.performCompatibleSync({
          type: 'full',
          force: true
        })
      } else {
        console.log('使用回退策略...')
        await syncIntegrationService.performFullSync()
      }
    }

    console.log('错误恢复完成')

  } catch (error) {
    console.error('错误处理失败:', error)
  }
}

/**
 * 迁移管理示例
 */
export async function migrationManagementExample() {
  console.log('=== 迁移管理示例 ===')

  try {
    // 1. 检查当前迁移状态
    const status = syncIntegrationService.getIntegrationStatus()
    console.log('当前迁移状态:', status)

    // 2. 如果未迁移，执行迁移
    if (!status.isMigrated) {
      console.log('开始迁移到增强模式...')

      // 设置迁移监听器
      const unsubscribeMigration = syncIntegrationService.onMigrationProgress((progress) => {
        console.log(`迁移进度: ${progress.toFixed(2)}%`)
      })

      // 执行迁移
      await syncIntegrationService.forceMigration()

      // 清理监听器
      unsubscribeMigration()

      console.log('迁移完成')
    } else {
      console.log('已经处于增强模式')
    }

    // 3. 验证迁移结果
    const newStatus = syncIntegrationService.getIntegrationStatus()
    console.log('迁移后状态:', newStatus)

  } catch (error) {
    console.error('迁移管理失败:', error)
  }
}

// ============================================================================
// 配置优化示例
// ============================================================================

/**
 * 配置优化示例
 */
export async function configurationOptimizationExample() {
  console.log('=== 配置优化示例 ===')

  try {
    // 1. 获取当前配置
    const currentMetrics = syncIntegrationService.getIntegrationMetrics()
    console.log('当前性能指标:', currentMetrics)

    // 2. 根据性能指标优化配置
    const optimizedConfig = {
      integrationMode: 'enhanced' as const,
      options: {
        preferIncrementalSync: currentMetrics.incrementalSyncEfficiency > 70,
        enableSmartSync: currentMetrics.overallPerformance > 80,
        enableCacheOptimization: currentMetrics.cacheHitRate < 80,
        enableNetworkOptimization: currentMetrics.bandwidthSaved < 1024
      }
    }

    // 3. 应用优化配置
    syncIntegrationService.updateConfig(optimizedConfig)
    console.log('配置已优化')

    // 4. 测试优化效果
    await syncIntegrationService.performSmartSync()

    const newMetrics = syncIntegrationService.getIntegrationMetrics()
    console.log('优化后指标:', newMetrics)

  } catch (error) {
    console.error('配置优化失败:', error)
  }
}

// ============================================================================
// 实际应用场景示例
// ============================================================================

/**
 * 离线同步场景示例
 */
export async function offlineSyncScenario() {
  console.log('=== 离线同步场景 ===')

  try {
    // 1. 模拟离线环境
    console.log('模拟离线环境...')

    // 2. 在离线状态下进行操作
    await syncIntegrationService.performIncrementalSync({
      entityTypes: ['card']
    })

    // 3. 恢复网络连接
    console.log('恢复网络连接...')

    // 4. 自动同步离线操作
    await syncIntegrationService.performSmartSync()

    console.log('离线同步场景完成')

  } catch (error) {
    console.error('离线同步场景失败:', error)
  }
}

/**
 * 大数据量同步场景示例
 */
export async function largeDataSyncScenario() {
  console.log('=== 大数据量同步场景 ===')

  try {
    // 1. 配置大数据量优化
    const largeDataConfig = {
      performanceOptimization: {
        adaptiveBatching: true,
        concurrencyControl: true,
        thresholds: {
          memoryUsage: 60,
          operationQueueSize: 50,
          batchTimeout: 60000
        }
      }
    }

    syncIntegrationService.updateConfig(largeDataConfig)

    // 2. 执行批量同步操作
    const startTime = performance.now()

    await syncIntegrationService.performIncrementalSync({
      entityTypes: ['card', 'folder', 'tag', 'image']
    })

    const endTime = performance.now()
    const totalTime = endTime - startTime

    console.log(`大数据量同步完成，耗时: ${totalTime.toFixed(2)}ms`)

    // 3. 分析性能
    const metrics = syncIntegrationService.getIntegrationMetrics()
    console.log('大数据量同步性能:', {
      总操作数: metrics.totalSyncOperations,
      成功率: `${((metrics.successfulSyncOperations / metrics.totalSyncOperations) * 100).toFixed(2)  }%`,
      平均延迟: `${metrics.operationLatency.toFixed(2)  }ms`,
      缓存命中率: `${metrics.cacheHitRate.toFixed(2)  }%`
    })

  } catch (error) {
    console.error('大数据量同步场景失败:', error)
  }
}

/**
 * 多设备同步场景示例
 */
export async function multiDeviceSyncScenario() {
  console.log('=== 多设备同步场景 ===')

  try {
    // 1. 模拟多设备环境
    const devices = ['device1', 'device2', 'device3']

    for (const device of devices) {
      console.log(`模拟设备 ${device} 的同步操作...`)

      // 2. 每个设备执行同步
      await syncIntegrationService.performIncrementalSync({
        entityTypes: ['card']
      })

      // 3. 检查冲突解决
      const compatibilityReport = syncCompatibilityAdapter.getCompatibilityReport()
      if (compatibilityReport && compatibilityReport.issues.length > 0) {
        console.log(`设备 ${device} 检测到冲突，自动解决中...`)
      }
    }

    // 4. 验证多设备同步结果
    const finalMetrics = syncIntegrationService.getIntegrationMetrics()
    console.log('多设备同步结果:', {
      总同步次数: finalMetrics.totalSyncOperations,
      冲突检测准确率: `${finalMetrics.conflictDetectionAccuracy.toFixed(2)  }%`,
      版本控制效率: `${finalMetrics.versionControlEfficiency.toFixed(2)  }%`
    })

  } catch (error) {
    console.error('多设备同步场景失败:', error)
  }
}

// ============================================================================
// 导出示例函数
// ============================================================================

export const syncExamples = {
  basicSyncExample,
  incrementalSyncExample,
  fullSyncExample,
  versionControlExample,
  performanceOptimizationExample,
  compatibilityCheckExample,
  integrationMonitoringExample,
  performanceAnalysisExample,
  errorHandlingExample,
  migrationManagementExample,
  configurationOptimizationExample,
  offlineSyncScenario,
  largeDataSyncScenario,
  multiDeviceSyncScenario
}

// ============================================================================
// 便利方法
// ============================================================================

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  console.log('开始运行所有增量同步示例...')

  try {
    await basicSyncExample()
    await incrementalSyncExample()
    await fullSyncExample()
    await versionControlExample()
    await performanceOptimizationExample()
    await compatibilityCheckExample()
    await integrationMonitoringExample()
    await performanceAnalysisExample()
    await errorHandlingExample()
    await migrationManagementExample()
    await configurationOptimizationExample()
    await offlineSyncScenario()
    await largeDataSyncScenario()
    await multiDeviceSyncScenario()

    console.log('所有示例运行完成')

  } catch (error) {
    console.error('运行示例时发生错误:', error)
  }
}

/**
 * 运行特定示例
 */
export async function runExample(exampleName: keyof typeof syncExamples) {
  console.log(`运行示例: ${exampleName}`)

  try {
    await syncExamples[exampleName]()
    console.log(`示例 ${exampleName} 运行完成`)
  } catch (error) {
    console.error(`示例 ${exampleName} 运行失败:`, error)
  }
}