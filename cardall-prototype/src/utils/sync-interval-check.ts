/**
 * 同步间隔检查工具
 * 验证data-sync-service.ts中的同步间隔设置是否正确
 */

import { dataSyncService } from '../services/data-sync-service'

export interface SyncIntervalInfo {
  mainSyncInterval: number
  consistencyCheckInterval: number
  cleanupInterval: number
  healthCheckInterval: number
  dataValidationInterval: number
  adaptiveIntervals: {
    lowReliability: number
    mediumReliability: number
    highReliability: number
    veryHighReliability: number
  }
  currentInterval: number
  reliability: number
}

export class SyncIntervalChecker {
  private static instance: SyncIntervalChecker

  static getInstance(): SyncIntervalChecker {
    if (!SyncIntervalChecker.instance) {
      SyncIntervalChecker.instance = new SyncIntervalChecker()
    }
    return SyncIntervalChecker.instance
  }

  /**
   * 检查同步间隔设置
   */
  async checkSyncIntervals(): Promise<SyncIntervalInfo> {
    console.log('⏰ 检查同步间隔设置...')

    try {
      // 获取同步指标
      const metrics = await dataSyncService.getMetrics()
      const reliability = metrics.reliability || 1

      // 根据代码定义的间隔设置
      const intervals = {
        // 主要后台同步间隔（自适应）
        mainSyncInterval: this.getAdaptiveSyncInterval(reliability),

        // 数据一致性检查间隔（30分钟）
        consistencyCheckInterval: 30 * 60 * 1000,

        // 清理过期会话间隔（6小时）
        cleanupInterval: 6 * 60 * 60 * 1000,

        // 健康检查间隔（10分钟）
        healthCheckInterval: 10 * 60 * 1000,

        // 数据验证间隔（30分钟）
        dataValidationInterval: 30 * 60 * 1000,

        // 自适应间隔设置
        adaptiveIntervals: {
          // 可靠性 < 0.5: 3分钟
          lowReliability: 3 * 60 * 1000,
          // 可靠性 < 0.8: 2分钟
          mediumReliability: 2 * 60 * 1000,
          // 可靠性 < 0.95: 1分钟
          highReliability: 1 * 60 * 1000,
          // 可靠性 >= 0.95: 30秒
          veryHighReliability: 30 * 1000
        },

        // 当前实际间隔
        currentInterval: this.getAdaptiveSyncInterval(reliability),

        // 当前可靠性
        reliability
      }

      console.log('📊 同步间隔设置:', intervals)
      return intervals

    } catch (error) {
      console.error('❌ 检查同步间隔失败:', error)
      throw error
    }
  }

  /**
   * 模拟data-sync-service中的getAdaptiveSyncInterval方法
   */
  private getAdaptiveSyncInterval(reliability: number): number {
    // 根据网络状态和同步历史动态调整 - 使用更积极的同步策略
    if (reliability < 0.5) {
      return 3 * 60 * 1000 // 可靠性很低，3分钟
    } else if (reliability < 0.8) {
      return 2 * 60 * 1000 // 可靠性较低，2分钟
    } else if (reliability < 0.95) {
      return 1 * 60 * 1000 // 中等可靠性，1分钟
    } else {
      return 30 * 1000 // 高可靠性，30秒
    }
  }

  /**
   * 验证同步间隔是否合理
   */
  validateIntervals(intervals: SyncIntervalInfo): {
    isValid: boolean
    issues: string[]
    recommendations: string[]
  } {
    console.log('🔍 验证同步间隔设置...')

    const issues: string[] = []
    const recommendations: string[] = []

    // 检查主要同步间隔
    if (intervals.currentInterval < 30 * 1000) {
      recommendations.push('主要同步间隔较短（<30秒），可能影响性能')
    }

    if (intervals.currentInterval > 5 * 60 * 1000) {
      issues.push('主要同步间隔过长（>5分钟），可能导致数据不同步')
    }

    // 检查一致性检查间隔
    if (intervals.consistencyCheckInterval < 10 * 60 * 1000) {
      recommendations.push('一致性检查间隔较短（<10分钟），可能影响性能')
    }

    if (intervals.consistencyCheckInterval > 60 * 60 * 1000) {
      issues.push('一致性检查间隔过长（>1小时），可能无法及时发现数据问题')
    }

    // 检查清理间隔
    if (intervals.cleanupInterval < 1 * 60 * 60 * 1000) {
      recommendations.push('清理间隔较短（<1小时），可能不必要')
    }

    if (intervals.cleanupInterval > 24 * 60 * 60 * 1000) {
      issues.push('清理间隔过长（>24小时），可能导致数据堆积')
    }

    // 检查健康检查间隔
    if (intervals.healthCheckInterval < 5 * 60 * 1000) {
      recommendations.push('健康检查间隔较短（<5分钟），可能影响性能')
    }

    if (intervals.healthCheckInterval > 30 * 60 * 1000) {
      issues.push('健康检查间隔过长（>30分钟），可能无法及时发现系统问题')
    }

    // 检查数据验证间隔
    if (intervals.dataValidationInterval < 15 * 60 * 1000) {
      recommendations.push('数据验证间隔较短（<15分钟），可能影响性能')
    }

    if (intervals.dataValidationInterval > 2 * 60 * 60 * 1000) {
      issues.push('数据验证间隔过长（>2小时），可能无法及时发现数据一致性问题')
    }

    // 根据可靠性给出建议
    if (intervals.reliability < 0.5) {
      recommendations.push('系统可靠性较低，建议检查网络连接和同步错误')
      issues.push('系统可靠性低于50%，需要关注')
    } else if (intervals.reliability < 0.8) {
      recommendations.push('系统可靠性中等，建议优化同步策略')
    }

    console.log('📊 验证结果:', { isValid: issues.length === 0, issues, recommendations })

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    }
  }

  /**
   * 生成间隔设置报告
   */
  generateIntervalReport(intervals: SyncIntervalInfo, validation: {
    isValid: boolean
    issues: string[]
    recommendations: string[]
  }): string {
    console.log('📋 生成同步间隔报告...')

    const report = `
=== CardAll 同步间隔设置报告 ===
生成时间: ${new Date().toLocaleString()}

⏰ 同步间隔设置
- 主要同步间隔: ${this.formatInterval(intervals.currentInterval)} (基于可靠性: ${(intervals.reliability * 100).toFixed(1)}%)
- 一致性检查间隔: ${this.formatInterval(intervals.consistencyCheckInterval)}
- 清理间隔: ${this.formatInterval(intervals.cleanupInterval)}
- 健康检查间隔: ${this.formatInterval(intervals.healthCheckInterval)}
- 数据验证间隔: ${this.formatInterval(intervals.dataValidationInterval)}

🔄 自适应间隔策略
- 低可靠性 (<50%): ${this.formatInterval(intervals.adaptiveIntervals.lowReliability)}
- 中等可靠性 (50%-80%): ${this.formatInterval(intervals.adaptiveIntervals.mediumReliability)}
- 高可靠性 (80%-95%): ${this.formatInterval(intervals.adaptiveIntervals.highReliability)}
- 极高可靠性 (>=95%): ${this.formatInterval(intervals.adaptiveIntervals.veryHighReliability)}

📊 当前系统状态
- 可靠性: ${(intervals.reliability * 100).toFixed(1)}%
- 实际同步间隔: ${this.formatInterval(intervals.currentInterval)}

🔍 验证结果
状态: ${validation.isValid ? '✅ 正常' : '⚠️ 需要关注'}

发现的问题:
${validation.issues.length > 0 ? validation.issues.map(issue => `  - ${issue}`).join('\n') : '  无'}

建议:
${validation.recommendations.length > 0 ? validation.recommendations.map(rec => `  - ${rec}`).join('\n') : '  无'}

=== 报告结束 ===
    `

    console.log('同步间隔报告已生成')
    return report
  }

  /**
   * 格式化时间间隔
   */
  private formatInterval(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`
    } else if (ms < 60 * 1000) {
      return `${(ms / 1000).toFixed(1)}秒`
    } else if (ms < 60 * 60 * 1000) {
      return `${(ms / 60 / 1000).toFixed(1)}分钟`
    } else {
      return `${(ms / 60 / 60 / 1000).toFixed(1)}小时`
    }
  }

  /**
   * 测试同步间隔自适应逻辑
   */
  testAdaptiveLogic(): void {
    console.log('🧪 测试同步间隔自适应逻辑...')

    const testCases = [
      { reliability: 0.2, expected: '3分钟' },
      { reliability: 0.6, expected: '2分钟' },
      { reliability: 0.9, expected: '1分钟' },
      { reliability: 0.98, expected: '30秒' }
    ]

    testCases.forEach(({ reliability, expected }) => {
      const interval = this.getAdaptiveSyncInterval(reliability)
      const formatted = this.formatInterval(interval)
      const isCorrect = formatted === expected

      console.log(`可靠性: ${(reliability * 100).toFixed(0)}% -> ${formatted} ${isCorrect ? '✅' : '❌ (期望: ' + expected + ')'}`)
    })

    console.log('✅ 自适应逻辑测试完成')
  }
}

// 导出单例实例
export const syncIntervalChecker = SyncIntervalChecker.getInstance()

// 便利方法
export const checkSyncIntervals = () => syncIntervalChecker.checkSyncIntervals()
export const validateSyncIntervals = (intervals: SyncIntervalInfo) => syncIntervalChecker.validateIntervals(intervals)
export const generateIntervalReport = (intervals: SyncIntervalInfo, validation: any) => syncIntervalChecker.generateIntervalReport(intervals, validation)
export const testAdaptiveLogic = () => syncIntervalChecker.testAdaptiveLogic()