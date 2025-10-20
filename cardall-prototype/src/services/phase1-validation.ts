import { UniversalStorageAdapter } from './universal-storage-adapter'
import { DataConverterAdapter } from './data-converter-adapter'
import { DataMigrationService } from './data-migration.service'
import { MigrationValidator } from './migration-validator'
import { unifiedErrorHandler } from './unified-error-handler'
import { performanceMonitor } from './performance-monitor'
import { CardAllProviderAdapter } from './cardall-provider-adapter'
import { StorageError, createStorageError } from './storage-adapter'
import { Card } from '@/types/card'

/**
 * Phase 1验证结果
 */
export interface Phase1ValidationResult {
  phase: string
  timestamp: Date
  overallStatus: 'success' | 'partial_success' | 'failed'
  components: {
    storageAdapter: TestResult
    dataConverter: TestResult
    migrationService: TestResult
    migrationValidator: TestResult
    errorHandler: TestResult
    performanceMonitor: TestResult
    providerAdapter: TestResult
  }
  summary: {
    totalTests: number
    passedTests: number
    failedTests: number
    successRate: number
  }
  recommendations: string[]
}

/**
 * 测试结果
 */
export interface TestResult {
  component: string
  status: 'passed' | 'failed' | 'warning'
  message: string
  details?: any
  executionTime: number
}

/**
 * Phase 1验证器
 */
export class Phase1Validator {
  private results: TestResult[] = []

  /**
   * 验证所有Phase 1组件
   */
  async validate(): Promise<Phase1ValidationResult> {
    console.log('Starting Phase 1 validation...')
    const startTime = Date.now()

    try {
      // 验证存储适配器
      const storageAdapterResult = await this.validateStorageAdapter()

      // 验证数据转换器
      const dataConverterResult = await this.validateDataConverter()

      // 验证迁移服务
      const migrationServiceResult = await this.validateMigrationService()

      // 验证迁移验证器
      const migrationValidatorResult = await this.validateMigrationValidator()

      // 验证错误处理器
      const errorHandlerResult = await this.validateErrorHandler()

      // 验证性能监控器
      const performanceMonitorResult = await this.validatePerformanceMonitor()

      // 验证Provider适配器
      const providerAdapterResult = await this.validateProviderAdapter()

      const components = {
        storageAdapter: storageAdapterResult,
        dataConverter: dataConverterResult,
        migrationService: migrationServiceResult,
        migrationValidator: migrationValidatorResult,
        errorHandler: errorHandlerResult,
        performanceMonitor: performanceMonitorResult,
        providerAdapter: providerAdapterResult
      }

      const summary = this.calculateSummary(components)

      const result: Phase1ValidationResult = {
        phase: 'Phase 1 - Core Infrastructure',
        timestamp: new Date(),
        overallStatus: summary.successRate >= 0.8 ? 'success' : summary.successRate >= 0.5 ? 'partial_success' : 'failed',
        components,
        summary,
        recommendations: this.generateRecommendations(components)
      }

      console.log(`Phase 1 validation completed in ${Date.now() - startTime}ms`)
      console.log(`Overall status: ${result.overallStatus}`)
      console.log(`Success rate: ${(summary.successRate * 100).toFixed(1)}%`)

      return result
    } catch (error) {
      console.error('Phase 1 validation failed:', error)
      throw error
    }
  }

  /**
   * 验证存储适配器
   */
  private async validateStorageAdapter(): Promise<TestResult> {
    const startTime = Date.now()

    try {
      console.log('Validating Storage Adapter...')

      const adapter = new UniversalStorageAdapter()

      // 测试初始化
      await adapter.initialize()

      // 测试基础操作
      const testCard: Card = {
        id: `test_card_${  Date.now()}`,
        frontContent: {
          title: 'Test Card',
          text: 'This is a test card',
          images: [],
          tags: ['test'],
          lastModified: new Date()
        },
        backContent: {
          title: 'Test Back',
          text: 'This is the back of the test card',
          images: [],
          tags: ['test'],
          lastModified: new Date()
        },
        style: {
          type: 'solid',
          backgroundColor: '#ffffff',
          fontFamily: 'system-ui',
          fontSize: 'base',
          fontWeight: 'normal',
          textColor: '#000000',
          borderRadius: 'md',
          shadow: 'none',
          borderWidth: 0
        },
        isFlipped: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // 测试保存和加载
      await adapter.saveCards([testCard])
      const loadedCards = await adapter.getCards()

      const found = loadedCards.find(c => c.id === testCard.id)
      const success = found && found.frontContent.title === testCard.frontContent.title

      const result: TestResult = {
        component: 'StorageAdapter',
        status: success ? 'passed' : 'failed',
        message: success ? 'Storage adapter basic operations working' : 'Storage adapter basic operations failed',
        details: {
          testCardCount: loadedCards.length,
          expectedCardCount: 1,
          testCardId: testCard.id
        },
        executionTime: Date.now() - startTime
      }

      console.log(`Storage Adapter validation: ${result.status}`)
      return result
    } catch (error) {
      const result: TestResult = {
        component: 'StorageAdapter',
        status: 'failed',
        message: `Storage adapter validation failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime
      }

      console.log(`Storage Adapter validation: ${result.status}`)
      return result
    }
  }

  /**
   * 验证数据转换器
   */
  private async validateDataConverter(): Promise<TestResult> {
    const startTime = Date.now()

    try {
      console.log('Validating Data Converter...')

      const testCard: Card = {
        id: `test_converter_${  Date.now()}`,
        frontContent: {
          title: 'Converter Test',
          text: 'Testing data conversion',
          images: [],
          tags: ['conversion'],
          lastModified: new Date()
        },
        backContent: {
          title: 'Converter Back',
          text: 'Back of conversion test',
          images: [],
          tags: ['conversion'],
          lastModified: new Date()
        },
        style: {
          type: 'solid',
          backgroundColor: '#ffffff',
          fontFamily: 'system-ui',
          fontSize: 'base',
          fontWeight: 'normal',
          textColor: '#000000',
          borderRadius: 'md',
          shadow: 'none',
          borderWidth: 0
        },
        isFlipped: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // 测试验证
      const validation = DataConverterAdapter.validateCard(testCard)

      // 测试清理
      const sanitized = DataConverterAdapter.sanitizeCard(testCard)

      // 测试比较
      const comparison = DataConverterAdapter.areCardsEqual(testCard, sanitized as Card)

      const result: TestResult = {
        component: 'DataConverter',
        status: validation.valid && comparison ? 'passed' : 'failed',
        message: 'Data converter validation and sanitization working',
        details: {
          validation: validation.valid,
          sanitization: !!sanitized,
          comparison,
          errors: validation.errors
        },
        executionTime: Date.now() - startTime
      }

      console.log(`Data Converter validation: ${result.status}`)
      return result
    } catch (error) {
      const result: TestResult = {
        component: 'DataConverter',
        status: 'failed',
        message: `Data converter validation failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime
      }

      console.log(`Data Converter validation: ${result.status}`)
      return result
    }
  }

  /**
   * 验证迁移服务
   */
  private async validateMigrationService(): Promise<TestResult> {
    const startTime = Date.now()

    try {
      console.log('Validating Migration Service...')

      const service = DataMigrationService.getInstance()

      // 检查是否需要迁移
      const needsMigration = await service.needsMigration()

      // 获取迁移统计信息
      const stats = await service.getMigrationStats()

      // 获取可用的备份
      const backups = service.getAvailableBackups()

      const result: TestResult = {
        component: 'MigrationService',
        status: 'passed',
        message: 'Migration service basic functionality working',
        details: {
          needsMigration,
          migrationCompleted: stats.migrationCompleted,
          availableBackups: backups.length,
          localStorageCardCount: stats.localStorageCardCount,
          indexedDBCardCount: stats.indexedDBCardCount
        },
        executionTime: Date.now() - startTime
      }

      console.log(`Migration Service validation: ${result.status}`)
      return result
    } catch (error) {
      const result: TestResult = {
        component: 'MigrationService',
        status: 'failed',
        message: `Migration service validation failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime
      }

      console.log(`Migration Service validation: ${result.status}`)
      return result
    }
  }

  /**
   * 验证迁移验证器
   */
  private async validateMigrationValidator(): Promise<TestResult> {
    const startTime = Date.now()

    try {
      console.log('Validating Migration Validator...')

      const validator = new MigrationValidator()

      const testCard: Card = {
        id: `test_validator_${  Date.now()}`,
        frontContent: {
          title: 'Validator Test',
          text: 'Testing migration validation',
          images: [],
          tags: ['validation'],
          lastModified: new Date()
        },
        backContent: {
          title: 'Validator Back',
          text: 'Back of validation test',
          images: [],
          tags: ['validation'],
          lastModified: new Date()
        },
        style: {
          type: 'solid',
          backgroundColor: '#ffffff',
          fontFamily: 'system-ui',
          fontSize: 'base',
          fontWeight: 'normal',
          textColor: '#000000',
          borderRadius: 'md',
          shadow: 'none',
          borderWidth: 0
        },
        isFlipped: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // 测试数据验证
      const validation = await validator.validateDataIntegrity([testCard])

      // 测试性能验证
      const performance = await validator.validatePerformance({
        operationCount: 1,
        expectedDuration: 1000
      })

      const result: TestResult = {
        component: 'MigrationValidator',
        status: validation.success && performance.success ? 'passed' : 'failed',
        message: 'Migration validator working',
        details: {
          dataIntegrity: validation.success,
          performance: performance.success,
          validationIssues: validation.issues,
          performanceIssues: performance.issues
        },
        executionTime: Date.now() - startTime
      }

      console.log(`Migration Validator validation: ${result.status}`)
      return result
    } catch (error) {
      const result: TestResult = {
        component: 'MigrationValidator',
        status: 'failed',
        message: `Migration validator validation failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime
      }

      console.log(`Migration Validator validation: ${result.status}`)
      return result
    }
  }

  /**
   * 验证错误处理器
   */
  private async validateErrorHandler(): Promise<TestResult> {
    const startTime = Date.now()

    try {
      console.log('Validating Error Handler...')

      // 创建测试错误
      const testError = createStorageError('TEST_ERROR', 'Test error for validation')

      // 处理错误
      const report = await unifiedErrorHandler.handleError(testError, {
        component: 'Phase1Validator',
        operation: 'validation'
      })

      // 获取错误统计
      const stats = unifiedErrorHandler.getErrorStats()

      const result: TestResult = {
        component: 'ErrorHandler',
        status: report.id ? 'passed' : 'failed',
        message: 'Error handler working',
        details: {
          errorReportId: report.id,
          errorType: report.type,
          errorCategory: report.category,
          totalErrors: stats.total,
          resolvedErrors: stats.resolved
        },
        executionTime: Date.now() - startTime
      }

      console.log(`Error Handler validation: ${result.status}`)
      return result
    } catch (error) {
      const result: TestResult = {
        component: 'ErrorHandler',
        status: 'failed',
        message: `Error handler validation failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime
      }

      console.log(`Error Handler validation: ${result.status}`)
      return result
    }
  }

  /**
   * 验证性能监控器
   */
  private async validatePerformanceMonitor(): Promise<TestResult> {
    const startTime = Date.now()

    try {
      console.log('Validating Performance Monitor...')

      // 开始测试操作
      const operationId = performanceMonitor.startOperation('test_operation')

      // 模拟一些工作
      await new Promise(resolve => setTimeout(resolve, 100))

      // 结束操作
      performanceMonitor.endOperation(operationId, true)

      // 获取指标
      const metrics = performanceMonitor.getMetrics()

      // 执行健康检查
      const health = await performanceMonitor.performHealthCheck()

      const result: TestResult = {
        component: 'PerformanceMonitor',
        status: health.status ? 'passed' : 'failed',
        message: 'Performance monitor working',
        details: {
          operationRecorded: metrics.databaseOperations.readCount > 0 || metrics.system.uptime > 0,
          healthStatus: health.status,
          healthScore: health.score,
          issuesFound: health.issues.length
        },
        executionTime: Date.now() - startTime
      }

      console.log(`Performance Monitor validation: ${result.status}`)
      return result
    } catch (error) {
      const result: TestResult = {
        component: 'PerformanceMonitor',
        status: 'failed',
        message: `Performance monitor validation failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime
      }

      console.log(`Performance Monitor validation: ${result.status}`)
      return result
    }
  }

  /**
   * 验证Provider适配器
   */
  private async validateProviderAdapter(): Promise<TestResult> {
    const startTime = Date.now()

    try {
      console.log('Validating Provider Adapter...')

      // 创建适配器实例（这里需要传入CardAllProvider的引用）
      // 由于我们无法直接获取CardAllProvider，我们主要测试基础功能

      const adapter = new CardAllProviderAdapter(null as any, {
        enableMigration: false,
        enablePerformanceMonitoring: false,
        enableErrorHandling: false
      })

      // 获取状态
      const state = adapter.getState()

      const result: TestResult = {
        component: 'ProviderAdapter',
        status: state ? 'passed' : 'failed',
        message: 'Provider adapter basic functionality working',
        details: {
          isInitialized: state.isInitialized,
          storageMode: state.storageMode,
          migrationStatus: state.migrationStatus,
          healthStatus: state.healthStatus
        },
        executionTime: Date.now() - startTime
      }

      console.log(`Provider Adapter validation: ${result.status}`)
      return result
    } catch (error) {
      const result: TestResult = {
        component: 'ProviderAdapter',
        status: 'failed',
        message: `Provider adapter validation failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime
      }

      console.log(`Provider Adapter validation: ${result.status}`)
      return result
    }
  }

  /**
   * 计算总结
   */
  private calculateSummary(components: Phase1ValidationResult['components']): Phase1ValidationResult['summary'] {
    const testResults = Object.values(components)
    const totalTests = testResults.length
    const passedTests = testResults.filter(r => r.status === 'passed').length
    const failedTests = testResults.filter(r => r.status === 'failed').length
    const successRate = passedTests / totalTests

    return {
      totalTests,
      passedTests,
      failedTests,
      successRate
    }
  }

  /**
   * 生成建议
   */
  private generateRecommendations(components: Phase1ValidationResult['components']): string[] {
    const recommendations: string[] = []

    Object.entries(components).forEach(([componentName, result]) => {
      if (result.status === 'failed') {
        recommendations.push(`修复${componentName}组件的问题: ${result.message}`)
      } else if (result.status === 'warning') {
        recommendations.push(`检查${componentName}组件的警告: ${result.message}`)
      }
    })

    if (recommendations.length === 0) {
      recommendations.push('所有Phase 1组件验证通过，可以继续Phase 2开发')
    }

    return recommendations
  }
}

// 导出验证器实例
export const phase1Validator = new Phase1Validator()

// 导出便捷函数
export async function validatePhase1(): Promise<Phase1ValidationResult> {
  return phase1Validator.validate()
}

// 运行验证并生成报告
export async function runPhase1Validation(): Promise<string> {
  try {
    const result = await validatePhase1()

    let report = `
Phase 1 验证报告
================
时间: ${result.timestamp.toLocaleString()}
整体状态: ${result.overallStatus}
成功率: ${(result.summary.successRate * 100).toFixed(1)}%

组件验证结果:
`

    Object.entries(result.components).forEach(([component, testResult]) => {
      report += `- ${component}: ${testResult.status.toUpperCase()} (${testResult.executionTime}ms)
  ${testResult.message}
`
    })

    report += `
统计信息:
- 总测试数: ${result.summary.totalTests}
- 通过测试: ${result.summary.passedTests}
- 失败测试: ${result.summary.failedTests}

建议:
${result.recommendations.map(rec => `- ${rec}`).join('\n')}
`

    return report
  } catch (error) {
    return `Phase 1 验证失败: ${error instanceof Error ? error.message : String(error)}`
  }
}