/**
 * 错误处理机制测试
 * 验证错误处理系统的完整性和可靠性
 */

import { errorHandlingService } from './error-handling-service'
import { syncErrorHandler, SyncErrorContext, SyncErrorType } from './sync-error-integration'
import { ErrorCategory, ErrorLevel, ErrorSubCategory } from './types'

// 测试配置
const testConfig = {
  enableMonitoring: true,
  enableRecovery: true,
  enableSelfHealing: false, // 测试时禁用自愈
  monitoring: {
    bufferSize: 100,
    historySize: 24,
    sampleRate: 1.0
  },
  recovery: {
    maxRetries: 2,
    baseDelay: 1000,
    maxDelay: 5000,
    enableCircuitBreaker: true
  },
  selfHealing: {
    enabled: false,
    autoRepair: false,
    learningEnabled: false,
    maxApplications: 10
  },
  alerts: {
    enabled: true,
    severity: 'low' as const,
    channels: ['console']
  }
}

/**
 * 测试运行器
 */
class ErrorHandlingTestRunner {
  private testResults: TestResult[] = []

  constructor() {
    errorHandlingService.updateConfig(testConfig)
  }

  /**
   * 运行所有测试
   */
  public async runAllTests(): Promise<TestReport> {
    console.log('🚀 开始运行错误处理系统测试...')

    const testGroups = [
      this.testBasicErrorHandling,
      this.testNetworkErrorHandling,
      this.testDataErrorHandling,
      this.testSyncErrorHandling,
      this.testRecoveryMechanisms,
      this.testMonitoringAndAlerting
    ]

    for (const testGroup of testGroups) {
      await testGroup.call(this)
    }

    const report = this.generateTestReport()
    console.log('\n✅ 测试完成！')
    this.printTestReport(report)

    return report
  }

  /**
   * 测试基础错误处理
   */
  private async testBasicErrorHandling(): Promise<void> {
    console.log('\n📋 测试基础错误处理...')

    // 测试错误分类
    const networkError = new Error('Network connection failed')
    const result1 = await errorHandlingService.handleNetworkError(networkError)

    this.testResults.push({
      name: '网络错误分类',
      passed: result1.error?.category === ErrorCategory.NETWORK,
      details: result1
    })

    // 测试错误级别
    const systemError = new Error('System out of memory')
    const result2 = await errorHandlingService.handleSystemError(systemError)

    this.testResults.push({
      name: '系统错误级别',
      passed: result2.error?.level === ErrorLevel.CRITICAL,
      details: result2
    })

    // 测试错误上下文
    const context = {
      userId: 'test-user',
      operation: 'test-operation',
      environment: 'development' as const
    }

    const result3 = await errorHandlingService.handleSyncError(new Error('Test error'), context)
    this.testResults.push({
      name: '错误上下文传递',
      passed: result3.error?.userId === 'test-user',
      details: result3
    })
  }

  /**
   * 测试网络错误处理
   */
  private async testNetworkErrorHandling(): Promise<void> {
    console.log('\n🌐 测试网络错误处理...')

    const testContext: SyncErrorContext = {
      syncId: 'test-sync-001',
      operation: 'upload',
      entityType: 'card',
      entityId: 'card-001',
      userId: 'test-user',
      attempt: 1,
      maxAttempts: 3
    }

    // 测试连接错误
    const connectionError = new Error('Failed to connect to server')
    const result1 = await syncErrorHandler.handleConnectionError(connectionError, testContext)

    this.testResults.push({
      name: '连接错误处理',
      passed: result1.syncSpecific.shouldRetrySync === true,
      details: result1
    })

    // 测试超时错误
    const timeoutError = new Error('Request timeout')
    const result2 = await syncErrorHandler.handleTimeoutError(timeoutError, testContext)

    this.testResults.push({
      name: '超时错误处理',
      passed: result2.syncSpecific.shouldRetrySync === true,
      details: result2
    })

    // 测试认证错误
    const authError = new Error('Authentication failed')
    const result3 = await syncErrorHandler.handleAuthenticationError(authError, testContext)

    this.testResults.push({
      name: '认证错误处理',
      passed: result3.syncSpecific.userActionRequired === true,
      details: result3
    })
  }

  /**
   * 测试数据错误处理
   */
  private async testDataErrorHandling(): Promise<void> {
    console.log('\n💾 测试数据错误处理...')

    const testContext: SyncErrorContext = {
      syncId: 'test-sync-002',
      operation: 'sync',
      entityType: 'card',
      entityId: 'card-002',
      userId: 'test-user'
    }

    // 测试数据验证错误
    const validationError = new Error('Data validation failed')
    const result1 = await syncErrorHandler.handleDataValidationError(validationError, testContext)

    this.testResults.push({
      name: '数据验证错误处理',
      passed: result1.syncSpecific.shouldRollback === true,
      details: result1
    })

    // 测试数据冲突错误
    const conflictError = new Error('Data conflict detected')
    conflictError.localData = { id: 'card-002', title: 'Local Title' }
    conflictError.cloudData = { id: 'card-002', title: 'Cloud Title' }

    const result2 = await syncErrorHandler.handleDataConflictError(conflictError, testContext)

    this.testResults.push({
      name: '数据冲突错误处理',
      passed: result2.syncSpecific.userActionRequired === true,
      details: result2
    })
  }

  /**
   * 测试同步错误处理
   */
  private async testSyncErrorHandling(): Promise<void> {
    console.log('\n🔄 测试同步错误处理...')

    const testContext: SyncErrorContext = {
      syncId: 'test-sync-003',
      operation: 'sync',
      entityType: 'folder',
      entityId: 'folder-001',
      userId: 'test-user'
    }

    // 测试服务器错误
    const serverError = new Error('Internal server error')
    serverError.status = 500

    const result1 = await syncErrorHandler.handleServerError(serverError, testContext)

    this.testResults.push({
      name: '服务器错误处理',
      passed: result1.syncSpecific.shouldRetrySync === true,
      details: result1
    })

    // 测试未知错误
    const unknownError = new Error('Unknown error occurred')
    const result2 = await syncErrorHandler.handleSyncError(unknownError, testContext)

    this.testResults.push({
      name: '未知错误处理',
      passed: result2.syncSpecific.userActionRequired === true,
      details: result2
    })
  }

  /**
   * 测试恢复机制
   */
  private async testRecoveryMechanisms(): Promise<void> {
    console.log('\n🔧 测试恢复机制...')

    // 测试健康状态检查
    const healthStatus = errorHandlingService.getHealthStatus()

    this.testResults.push({
      name: '健康状态检查',
      passed: typeof healthStatus.status === 'string' && typeof healthStatus.score === 'number',
      details: healthStatus
    })

    // 测试错误统计
    const errorStats = errorHandlingService.getErrorStatistics()

    this.testResults.push({
      name: '错误统计获取',
      passed: errorStats !== null && typeof errorStats.totalErrors === 'number',
      details: errorStats
    })

    // 测试最近错误获取
    const recentErrors = errorHandlingService.getRecentErrors(10)

    this.testResults.push({
      name: '最近错误获取',
      passed: Array.isArray(recentErrors),
      details: { count: recentErrors.length }
    })
  }

  /**
   * 测试监控和告警
   */
  private async testMonitoringAndAlerting(): Promise<void> {
    console.log('\n📊 测试监控和告警...')

    // 测试同步错误统计
    const syncStats = syncErrorHandler.getSyncErrorStatistics()

    this.testResults.push({
      name: '同步错误统计',
      passed: syncStats !== null && syncStats.syncSpecific !== undefined,
      details: syncStats
    })

    // 测试配置更新
    const originalConfig = syncErrorHandler.getConfig()
    const newConfig = { ...originalConfig, enableMonitoring: false }
    syncErrorHandler.updateConfig(newConfig)

    const updatedConfig = syncErrorHandler.getConfig()

    this.testResults.push({
      name: '配置更新',
      passed: updatedConfig.enableMonitoring === false,
      details: { original: originalConfig.enableMonitoring, updated: updatedConfig.enableMonitoring }
    })

    // 恢复原始配置
    syncErrorHandler.updateConfig(originalConfig)
  }

  /**
   * 生成测试报告
   */
  private generateTestReport(): TestReport {
    const passedTests = this.testResults.filter(r => r.passed).length
    const totalTests = this.testResults.length
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0

    return {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      passRate,
      results: this.testResults,
      timestamp: new Date(),
      duration: 0 // 实际实现中可以计算测试持续时间
    }
  }

  /**
   * 打印测试报告
   */
  private printTestReport(report: TestReport): void> {
    console.log('\n📊 测试报告')
    console.log('═'.repeat(50))
    console.log(`总测试数: ${report.totalTests}`)
    console.log(`通过测试: ${report.passedTests}`)
    console.log(`失败测试: ${report.failedTests}`)
    console.log(`通过率: ${report.passRate.toFixed(2)}%`)
    console.log('═'.repeat(50))

    if (report.failedTests > 0) {
      console.log('\n❌ 失败的测试:')
      report.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.name}`)
        })
    }

    console.log('\n✅ 通过的测试:')
    report.results
      .filter(r => r.passed)
      .forEach(r => {
        console.log(`  - ${r.name}`)
      })
  }
}

// 测试结果接口
interface TestResult {
  name: string
  passed: boolean
  details: any
}

// 测试报告接口
interface TestReport {
  totalTests: number
  passedTests: number
  failedTests: number
  passRate: number
  results: TestResult[]
  timestamp: Date
  duration: number
}

/**
 * 运行错误处理测试
 */
export async function runErrorHandlingTests(): Promise<TestReport> {
  const runner = new ErrorHandlingTestRunner()
  return runner.runAllTests()
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
  runErrorHandlingTests().catch(console.error)
}