/**
 * T009 性能优化示例和测试脚本
 *
 * 演示如何使用T009性能优化功能，并验证批量操作效率提升50%的目标
 */

import { t009PerformanceIntegrator } from '../services/sync/t009-performance-integration'
import { t009PerformanceValidator } from '../tests/performance/t009-performance-validation'
import { batchOptimizer } from '../services/batch-optimizer'
import { performanceMonitor } from '../services/performance-monitor'
import { networkOptimizer } from '../services/network-optimizer'
import type { Card } from '@/types/card'

// ============================================================================
// 使用示例
// ============================================================================

/**
 * T009性能优化使用示例
 */
export class T009PerformanceExample {
  private isInitialized = false

  /**
   * 初始化示例
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      console.log('=== T009 性能优化示例 ===')
      console.log('初始化性能优化组件...')

      // 初始化T009性能集成器
      await t009PerformanceIntegrator.initialize()
      console.log('✓ T009性能集成器已初始化')

      // 初始化性能验证器
      await t009PerformanceValidator.initialize()
      console.log('✓ 性能验证器已初始化')

      this.isInitialized = true
      console.log('✓ 所有组件初始化完成')

    } catch (error) {
      console.error('❌ 初始化失败:', error)
      throw error
    }
  }

  /**
   * 演示批量操作优化
   */
  async demonstrateBatchOptimization(): Promise<void> {
    console.log('\n=== 批量操作优化演示 ===')

    // 创建测试数据
    const testCards: Card[] = Array.from({ length: 50 }, (_, i) => ({
      id: `demo-card-${i}`,
      frontContent: `演示卡片 ${i} - 正面内容`,
      backContent: `演示卡片 ${i} - 背面内容`,
      style: {
        backgroundColor: `hsl(${i * 7}, 70%, 80%)`,
        padding: 20,
        borderRadius: 12
      },
      tags: [`标签${i % 10}`, `演示${i % 5}`],
      createdAt: new Date(),
      updatedAt: new Date()
    }))

    console.log(`准备批量创建 ${testCards.length} 个卡片...`)

    // 使用优化的批量操作
    const startTime = performance.now()

    const results = await Promise.allSettled(
      testCards.map(card =>
        t009PerformanceIntegrator.executeOptimizedSync({
          type: 'create',
          entity: 'card',
          data: card,
          priority: 'normal'
        })
      )
    )

    const endTime = performance.now()
    const duration = endTime - startTime

    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    console.log(`✓ 批量操作完成:`)
    console.log(`  - 总耗时: ${duration.toFixed(2)}ms`)
    console.log(`  - 成功: ${successful}`)
    console.log(`  - 失败: ${failed}`)
    console.log(`  - 平均每操作: ${(duration / testCards.length).toFixed(2)}ms`)

    // 显示批量优化指标
    const batchMetrics = batchOptimizer.getCurrentMetrics()
    console.log(`  - 批量处理效率: ${batchMetrics.batchEfficiency.toFixed(1)}%`)
    console.log(`  - 吞吐量提升: ${batchMetrics.throughputImprovement.toFixed(1)}%`)
  }

  /**
   * 演示性能监控
   */
  async demonstratePerformanceMonitoring(): Promise<void> {
    console.log('\n=== 性能监控演示 ===')

    // 获取当前性能指标
    const currentMetrics = performanceMonitor.getCurrentMetrics()
    console.log('当前性能指标:')
    console.log(`  - 平均响应时间: ${currentMetrics.averageResponseTime.toFixed(2)}ms`)
    console.log(`  - 操作吞吐量: ${currentMetrics.operationsPerSecond.toFixed(2)} ops/s`)
    console.log(`  - 内存使用率: ${currentMetrics.memoryUsagePercentage.toFixed(1)}%`)
    console.log(`  - 网络质量: ${currentMetrics.networkQuality}`)
    console.log(`  - 缓存命中率: ${(currentMetrics.cacheHitRate * 100).toFixed(1)}%`)

    // 获取性能瓶颈
    const bottlenecks = performanceMonitor.getPerformanceBottlenecks()
    if (bottlenecks.length > 0) {
      console.log('\n⚠️  性能瓶颈:')
      bottlenecks.forEach(bottleneck => {
        console.log(`  - ${bottleneck.type}: ${bottleneck.description}`)
        console.log(`    建议: ${bottleneck.recommendation}`)
      })
    } else {
      console.log('✓ 未发现明显的性能瓶颈')
    }

    // 获取性能评分
    const performanceScore = performanceMonitor.getPerformanceScore()
    console.log(`\n📊 性能评分: ${performanceScore}/100`)
  }

  /**
   * 演示网络优化
   */
  async demonstrateNetworkOptimization(): Promise<void> {
    console.log('\n=== 网络优化演示 ===')

    // 获取网络指标
    const networkMetrics = networkOptimizer.getMetrics()
    console.log('网络优化指标:')
    console.log(`  - 总请求数: ${networkMetrics.totalRequests}`)
    console.log(`  - 成功率: ${((networkMetrics.successfulRequests / networkMetrics.totalRequests) * 100).toFixed(1)}%`)
    console.log(`  - 缓存命中率: ${(networkMetrics.cacheHitRate * 100).toFixed(1)}%`)
    console.log(`  - 压缩节省带宽: ${(networkMetrics.bandwidthSaved / 1024).toFixed(2)}KB`)

    // 获取缓存统计
    const cacheStats = networkOptimizer.getCacheStats()
    console.log('\n缓存统计:')
    console.log(`  - 缓存命中: ${cacheStats.hits}`)
    console.log(`  - 缓存未命中: ${cacheStats.misses}`)
    console.log(`  - 缓存条目数: ${cacheStats.entryCount}`)
    console.log(`  - 内存使用: ${(cacheStats.memoryUsage / 1024).toFixed(2)}KB`)

    // 演示网络请求优化
    console.log('\n演示网络请求优化...')
    const testUrls = [
      'https://api.example.com/users',
      'https://api.example.com/cards',
      'https://api.example.com/folders'
    ]

    for (const url of testUrls) {
      try {
        const response = await networkOptimizer.request({
          url,
          cache: true,
          priority: 'normal'
        })
        console.log(`✓ 请求成功: ${url} (状态: ${response.status})`)
      } catch (error) {
        console.log(`❌ 请求失败: ${url}`)
      }
    }
  }

  /**
   * 运行完整的T009验证
   */
  async runT009Validation(): Promise<void> {
    console.log('\n=== T009 目标验证 ===')

    try {
      const validation = await t009PerformanceValidator.runFullValidation()

      console.log('📋 验证结果:')
      console.log(`  - 总体评分: ${validation.overallScore}/100`)
      console.log(`  - T009目标达成: ${validation.t009GoalsAchieved ? '✓ 是' : '❌ 否'}`)

      console.log('\n📈 性能改进指标:')
      console.log(`  - 批量效率提升: ${validation.summary.batchEfficiencyImprovement.toFixed(1)}%`)
      console.log(`  - 响应时间减少: ${validation.summary.responseTimeReduction.toFixed(1)}%`)
      console.log(`  - 内存使用优化: ${validation.summary.memoryUsageOptimization.toFixed(1)}%`)
      console.log(`  - 缓存命中率: ${validation.summary.cacheHitRateAchieved.toFixed(1)}%`)
      console.log(`  - 整体性能提升: ${validation.summary.overallImprovement.toFixed(1)}%`)

      if (validation.recommendations.length > 0) {
        console.log('\n💡 优化建议:')
        validation.recommendations.forEach(rec => {
          console.log(`  - ${rec}`)
        })
      }

      // 显示测试详情
      console.log('\n📊 测试详情:')
      validation.results.forEach(result => {
        const status = result.targets.overallAchieved ? '✓' : '❌'
        console.log(`  ${status} ${result.testName}:`)
        console.log(`    吞吐量: ${result.metrics.throughput.toFixed(2)} ops/s`)
        console.log(`    成功率: ${result.metrics.successRate.toFixed(1)}%`)
        if (result.improvements.overall > 0) {
          console.log(`    性能改进: ${result.improvements.overall.toFixed(1)}%`)
        }
      })

    } catch (error) {
      console.error('❌ T009验证失败:', error)
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('\n=== 清理资源 ===')

    try {
      t009PerformanceIntegrator.destroy()
      console.log('✓ T009性能集成器已销毁')

      t009PerformanceValidator.destroy()
      console.log('✓ 性能验证器已销毁')

      console.log('✓ 所有资源已清理')

    } catch (error) {
      console.error('❌ 清理资源失败:', error)
    }

    this.isInitialized = false
  }
}

// ============================================================================
// 自动化测试脚本
// ============================================================================

/**
 * 运行T009性能优化测试
 */
export async function runT009PerformanceTest(): Promise<void> {
  const example = new T009PerformanceExample()

  try {
    // 初始化
    await example.initialize()

    // 演示各项功能
    await example.demonstrateBatchOptimization()
    await example.demonstratePerformanceMonitoring()
    await example.demonstrateNetworkOptimization()

    // 运行验证
    await example.runT009Validation()

    // 清理资源
    await example.cleanup()

    console.log('\n🎉 T009性能优化测试完成!')

  } catch (error) {
    console.error('❌ 测试失败:', error)
    await example.cleanup()
    process.exit(1)
  }
}

/**
 * 快速验证T009目标
 */
export async function quickT009Validation(): Promise<{
  success: boolean
  score: number
  batchEfficiencyImprovement: number
  message: string
}> {
  try {
    console.log('快速验证T009目标...')

    // 初始化组件
    await t009PerformanceIntegrator.initialize()
    await t009PerformanceValidator.initialize()

    // 运行验证
    const validation = await t009PerformanceValidator.runFullValidation()

    // 清理资源
    t009PerformanceIntegrator.destroy()
    t009PerformanceValidator.destroy()

    const success = validation.t009GoalsAchieved
    const score = validation.overallScore
    const batchEfficiencyImprovement = validation.summary.batchEfficiencyImprovement

    let message = ''
    if (success) {
      message = `🎉 T009目标达成! 评分: ${score}/100, 批量效率提升: ${batchEfficiencyImprovement.toFixed(1)}%`
    } else {
      message = `⚠️  T009目标未完全达成. 评分: ${score}/100, 批量效率提升: ${batchEfficiencyImprovement.toFixed(1)}%`
    }

    return {
      success,
      score,
      batchEfficiencyImprovement,
      message
    }

  } catch (error) {
    console.error('快速验证失败:', error)
    return {
      success: false,
      score: 0,
      batchEfficiencyImprovement: 0,
      message: `❌ 验证失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

// ============================================================================
// 导出
// ============================================================================

export { T009PerformanceExample }

// 如果直接运行此文件，执行快速验证
if (typeof window === 'undefined' && require.main === module) {
  quickT009Validation().then(result => {
    console.log('\n' + result.message)
    process.exit(result.success ? 0 : 1)
  })
}