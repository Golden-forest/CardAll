/**
 * 存储模式切换使用示例
 *
 * 本文件展示了如何使用增强的UniversalStorageAdapter进行安全的存储模式切换
 */

import { UniversalStorageAdapter } from '@/services/universal-storage-adapter'
import { Card } from '@/types/card'

// 获取存储适配器实例
const storageAdapter = UniversalStorageAdapter.getInstance()

/**
 * 基本存储模式切换示例
 */
async function basicStorageModeSwitch() {
  console.log('=== 基本存储模式切换示例 ===')

  try {
    // 获取当前存储模式
    const currentMode = storageAdapter.getStorageMode()
    console.log(`当前存储模式: ${currentMode}`)

    // 切换到目标模式
    const targetMode = currentMode === 'localStorage' ? 'indexeddb' : 'localStorage'

    console.log(`开始切换到 ${targetMode}...`)
    const result = await storageAdapter.switchStorageMode(targetMode)

    if (result.success) {
      console.log('✅ 切换成功!')
      console.log(`- 从: ${result.fromMode}`)
      console.log(`- 到: ${result.toMode}`)
      console.log(`- 耗时: ${result.duration}ms`)
      console.log(`- 数据迁移: ${result.dataMigrated ? '是' : '否'}`)
      console.log(`- 回滚执行: ${result.rollbackPerformed ? '是' : '否'}`)
    } else {
      console.log('❌ 切换失败:', result.message)
    }

  } catch (error) {
    console.error('❌ 切换过程中发生错误:', error)
  }
}

/**
 * 带进度反馈的存储模式切换示例
 */
async function storageModeSwitchWithProgress() {
  console.log('=== 带进度反馈的存储模式切换示例 ===')

  try {
    const currentMode = storageAdapter.getStorageMode()
    const targetMode = currentMode === 'localStorage' ? 'indexeddb' : 'localStorage'

    console.log(`开始切换到 ${targetMode}...`)

    const result = await storageAdapter.switchStorageMode(targetMode, {
      onProgress: (progress) => {
        console.log(`🔄 [${progress.percentage}%] ${progress.phase}: ${progress.message}`)

        if (progress.details) {
          Object.entries(progress.details).forEach(([key, value]) => {
            console.log(`   ${key}: ${JSON.stringify(value)}`)
          })
        }
      },
      skipBackup: false // 默认创建备份
    })

    if (result.success) {
      console.log('✅ 切换成功!')

      // 显示进度历史
      if (result.progress) {
        console.log('\n📊 进度历史:')
        result.progress.forEach(p => {
          console.log(`   ${p.timestamp.toISOString()}: ${p.phase} (${p.percentage}%)`)
        })
      }
    } else {
      console.log('❌ 切换失败:', result.message)
    }

  } catch (error) {
    console.error('❌ 切换过程中发生错误:', error)
  }
}

/**
 * 可取消的存储模式切换示例
 */
async function cancellableStorageModeSwitch() {
  console.log('=== 可取消的存储模式切换示例 ===')

  let cancelled = false

  try {
    const currentMode = storageAdapter.getStorageMode()
    const targetMode = currentMode === 'localStorage' ? 'indexeddb' : 'localStorage'

    console.log(`开始切换到 ${targetMode}...`)

    // 设置一个定时器来取消操作
    const cancelTimer = setTimeout(() => {
      console.log('⏰ 取消切换操作...')
      storageAdapter.cancelStorageModeSwitch('用户取消操作')
      cancelled = true
    }, 2000) // 2秒后取消

    const result = await storageAdapter.switchStorageMode(targetMode, {
      onProgress: (progress) => {
        console.log(`🔄 [${progress.percentage}%] ${progress.message}`)
      },
      onCancel: () => {
        console.log('🛑 切换操作已取消')
      }
    })

    clearTimeout(cancelTimer)

    if (cancelled) {
      console.log('❌ 切换已取消')
    } else if (result.success) {
      console.log('✅ 切换成功!')
    } else {
      console.log('❌ 切换失败:', result.message)
    }

  } catch (error) {
    if (cancelled) {
      console.log('❌ 切换已取消 (预期行为)')
    } else {
      console.error('❌ 切换过程中发生错误:', error)
    }
  }
}

/**
 * 获取存储统计信息和推荐示例
 */
async function storageStatisticsExample() {
  console.log('=== 存储统计信息和推荐示例 ===')

  try {
    // 获取存储模式统计
    const stats = await storageAdapter.getStorageModeStats()
    console.log('📊 存储统计信息:')
    console.log(`- 当前模式: ${stats.currentMode}`)
    console.log(`- 切换次数: ${stats.switchCount}`)
    console.log(`- 失败次数: ${stats.failedSwitches}`)
    console.log(`- localStorage可用: ${stats.availableStorage.localStorage}`)
    console.log(`- IndexedDB可用: ${stats.availableStorage.indexedDB}`)
    console.log(`- localStorage卡片数: ${stats.dataDistribution.localStorageCards}`)
    console.log(`- IndexedDB卡片数: ${stats.dataDistribution.indexedDBCards}`)
    console.log(`- localStorage大小: ${Math.round(stats.dataDistribution.localStorageSize / 1024)}KB`)
    console.log(`- IndexedDB大小: ${Math.round(stats.dataDistribution.indexedDBSize / 1024)}KB`)

    if (stats.lastSwitchTime) {
      console.log(`- 上次切换时间: ${stats.lastSwitchTime.toLocaleString()}`)
      console.log(`- 上次切换耗时: ${stats.lastSwitchDuration}ms`)
    }

    // 获取存储模式推荐
    const recommendation = await storageAdapter.getRecommendedStorageMode()
    console.log('\n💡 存储模式推荐:')
    console.log(`- 推荐模式: ${recommendation.recommendedMode}`)
    console.log(`- 推荐原因: ${recommendation.reason}`)
    console.log(`- 置信度: ${recommendation.confidence}`)

    if (recommendation.issues.length > 0) {
      console.log(`- 注意事项: ${recommendation.issues.join(', ')}`)
    }

  } catch (error) {
    console.error('❌ 获取统计信息时发生错误:', error)
  }
}

/**
 * 数据验证和完整性检查示例
 */
async function dataValidationExample() {
  console.log('=== 数据验证和完整性检查示例 ===')

  try {
    // 验证当前数据完整性
    const validation = await storageAdapter.validateDataIntegrity()

    console.log('🔍 数据完整性检查结果:')
    console.log(`- 整体状态: ${validation.isValid ? '✅ 通过' : '❌ 失败'}`)
    console.log(`- 卡片数量: ${validation.cardCount}`)
    console.log(`- 损坏卡片: ${validation.corruptedCards.length}`)

    if (validation.issues.length > 0) {
      console.log(`- 发现问题: ${validation.issues.length}个`)
      validation.issues.forEach(issue => {
        console.log(`   - ${issue}`)
      })
    }

    if (!validation.isValid) {
      console.log('\n🔧 尝试修复数据问题...')
      const repairResult = await storageAdapter.repairDataIntegrity()

      console.log(`- 修复结果: ${repairResult.repaired ? '✅ 成功' : '❌ 失败'}`)
      console.log(`- 修复卡片数: ${repairResult.repairedCards}`)
      console.log(`- 修复失败: ${repairResult.failedRepairs.length}`)

      if (repairResult.issues.length > 0) {
        console.log(`- 修复问题: ${repairResult.issues.join(', ')}`)
      }
    }

  } catch (error) {
    console.error('❌ 数据验证时发生错误:', error)
  }
}

/**
 * 健康检查示例
 */
async function healthCheckExample() {
  console.log('=== 健康检查示例 ===')

  try {
    const healthCheck = await storageAdapter.healthCheck()

    console.log('🏥 存储健康检查结果:')
    console.log(`- 整体健康: ${healthCheck.healthy ? '✅ 良好' : '❌ 有问题'}`)
    console.log(`- 健康分数: ${healthCheck.score}/100`)

    if (healthCheck.issues.length > 0) {
      console.log(`- 发现问题: ${healthCheck.issues.length}个`)
      healthCheck.issues.forEach(issue => {
        console.log(`   [${issue.level}] ${issue.code}: ${issue.message}`)
      })
    }

    if (healthCheck.recommendations.length > 0) {
      console.log(`- 建议: ${healthCheck.recommendations.join(', ')}`)
    }

  } catch (error) {
    console.error('❌ 健康检查时发生错误:', error)
  }
}

/**
 * 事件监听示例
 */
async function eventListenerExample() {
  console.log('=== 事件监听示例 ===')

  try {
    // 添加事件监听器
    const eventTypes = [
      'storageModeChanged',
      'storageModeSwitchProgress',
      'backupCreated',
      'backupRestored',
      'error'
    ]

    const eventLog: string[] = []

    eventTypes.forEach(eventType => {
      storageAdapter.addEventListener(eventType, (event) => {
        const logEntry = `[${event.timestamp.toISOString()}] ${eventType}: ${JSON.stringify(event.data)}`
        eventLog.push(logEntry)
        console.log(`📢 事件: ${logEntry}`)
      })
    })

    console.log('👂 开始监听存储事件...')

    // 执行一些操作来触发事件
    const currentMode = storageAdapter.getStorageMode()
    const targetMode = currentMode === 'localStorage' ? 'indexeddb' : 'localStorage'

    await storageAdapter.switchStorageMode(targetMode, {
      onProgress: (progress) => {
        console.log(`🔄 进度: ${progress.message}`)
      }
    })

    // 等待一下确保所有事件都被处理
    await new Promise(resolve => setTimeout(resolve, 100))

    console.log(`\n📋 事件日志总结: 共记录 ${eventLog.length} 个事件`)

    // 清理事件监听器
    eventTypes.forEach(eventType => {
      storageAdapter.removeEventListener(eventType, () => {})
    })

    console.log('👋 事件监听器已清理')

  } catch (error) {
    console.error('❌ 事件监听示例中发生错误:', error)
  }
}

/**
 * 完整的工作流程示例
 */
async function completeWorkflowExample() {
  console.log('=== 完整的存储模式切换工作流程示例 ===')

  try {
    // 1. 获取当前状态
    console.log('1️⃣ 获取当前状态...')
    const stats = await storageAdapter.getStorageModeStats()
    const recommendation = await storageAdapter.getRecommendedStorageMode()

    console.log(`当前模式: ${stats.currentMode}`)
    console.log(`推荐模式: ${recommendation.recommendedMode}`)
    console.log(`推荐原因: ${recommendation.reason}`)

    // 2. 健康检查
    console.log('\n2️⃣ 执行健康检查...')
    const healthCheck = await storageAdapter.healthCheck()
    console.log(`健康状态: ${healthCheck.healthy ? '良好' : '需要关注'}`)

    if (!healthCheck.healthy) {
      console.log('发现健康问题，建议检查并修复后再进行切换')
      return
    }

    // 3. 数据完整性检查
    console.log('\n3️⃣ 检查数据完整性...')
    const validation = await storageAdapter.validateDataIntegrity()
    console.log(`数据完整性: ${validation.isValid ? '良好' : '需要修复'}`)

    if (!validation.isValid) {
      console.log('尝试修复数据问题...')
      const repairResult = await storageAdapter.repairDataIntegrity()
      console.log(`修复结果: ${repairResult.repaired ? '成功' : '失败'}`)
    }

    // 4. 执行切换
    console.log('\n4️⃣ 开始存储模式切换...')
    const targetMode = recommendation.recommendedMode
    const currentMode = stats.currentMode

    if (currentMode === targetMode) {
      console.log('已经在推荐模式，无需切换')
      return
    }

    const result = await storageAdapter.switchStorageMode(targetMode, {
      onProgress: (progress) => {
        const indicator = progress.phase.includes('failed') || progress.phase.includes('error') ? '❌' : '🔄'
        console.log(`${indicator} [${progress.percentage}%] ${progress.message}`)
      }
    })

    // 5. 结果验证
    console.log('\n5️⃣ 验证切换结果...')
    if (result.success) {
      console.log('✅ 切换成功!')

      // 验证数据可访问性
      const postSwitchValidation = await storageAdapter.validateDataIntegrity()
      console.log(`切换后数据完整性: ${postSwitchValidation.isValid ? '✅ 良好' : '❌ 有问题'}`)

      // 获取新的统计信息
      const newStats = await storageAdapter.getStorageModeStats()
      console.log(`新模式: ${newStats.currentMode}`)
      console.log(`切换总耗时: ${result.duration}ms`)
      console.log(`数据迁移: ${result.dataMigrated ? '是' : '否'}`)

    } else {
      console.log('❌ 切换失败:', result.message)

      if (result.rollbackPerformed) {
        console.log('🔄 已执行回滚操作')
      }
    }

  } catch (error) {
    console.error('❌ 工作流程执行失败:', error)
  }
}

/**
 * 运行所有示例
 */
export async function runAllStorageModeExamples() {
  console.log('🚀 开始运行存储模式切换示例\n')

  try {
    await basicStorageModeSwitch()
    console.log(`\n${  '='.repeat(50)  }\n`)

    await storageModeSwitchWithProgress()
    console.log(`\n${  '='.repeat(50)  }\n`)

    await cancellableStorageModeSwitch()
    console.log(`\n${  '='.repeat(50)  }\n`)

    await storageStatisticsExample()
    console.log(`\n${  '='.repeat(50)  }\n`)

    await dataValidationExample()
    console.log(`\n${  '='.repeat(50)  }\n`)

    await healthCheckExample()
    console.log(`\n${  '='.repeat(50)  }\n`)

    await eventListenerExample()
    console.log(`\n${  '='.repeat(50)  }\n`)

    await completeWorkflowExample()
    console.log(`\n${  '='.repeat(50)  }\n`)

    console.log('🎉 所有示例执行完成!')

  } catch (error) {
    console.error('❌ 示例执行过程中发生错误:', error)
  }
}

// 如果直接运行此文件，执行所有示例
if (typeof window !== 'undefined') {
  // 浏览器环境
  (window as any).runStorageModeExamples = runAllStorageModeExamples
} else {
  // Node.js环境
  runAllStorageModeExamples().catch(console.error)
}