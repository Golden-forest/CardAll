// 增强离线管理器测试运行脚本
// Week 3 Day 11-13 同步机制重构 - Project-Brainstormer
// 用于运行所有增强离线管理器相关的测试

import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// 测试配置
const testConfig = {
  // 测试文件路径
  testFiles: [
    'tests/offline/enhanced-offline-quick-test.ts',
    'tests/unit/services/enhanced-offline-manager.test.ts',
    'tests/sync/unified-sync-service-base.test.ts',
    'tests/integration/offline-sync-integration.test.ts'
  ],

  // Jest 配置
  jestConfig: {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    testMatch: ['**/__tests__/**/*.(ts|tsx|js)', '**/*.(test|spec).(ts|tsx|js)'],
    transform: {
      '^.+\\.(ts|tsx)$': 'ts-jest'
    },
    moduleNameMapping: {
      '^@/(.*)$': '<rootDir>/src/$1'
    },
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true
  }
}

// 测试结果接口
interface TestResult {
  file: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  error?: string
  output?: string
}

interface TestSuiteResult {
  totalTests: number
  passedTests: number
  failedTests: number
  skippedTests: number
  duration: number
  results: TestResult[]
  summary: string
}

// 测试运行器类
class EnhancedOfflineTestRunner {
  private projectRoot: string

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
  }

  async runAllTests(): Promise<TestSuiteResult> {
    console.log('🚀 开始运行增强离线管理器测试套件')
    console.log('=' * 60)

    const startTime = Date.now()
    const results: TestResult[] = []

    // 运行快速测试
    console.log('\n📋 运行快速功能测试...')
    const quickTestResult = await this.runQuickTest()
    results.push(quickTestResult)

    // 运行单元测试
    console.log('\n🔬 运行单元测试...')
    const unitTestResult = await this.runUnitTest()
    results.push(unitTestResult)

    // 运行集成测试
    console.log('\n🔗 运行集成测试...')
    const integrationTestResult = await this.runIntegrationTest()
    results.push(integrationTestResult)

    // 运行兼容性测试
    console.log('\n🔧 运行兼容性测试...')
    const compatibilityTestResult = await this.runCompatibilityTest()
    results.push(compatibilityTestResult)

    const duration = Date.now() - startTime
    const summary = this.generateSummary(results, duration)

    console.log('\n' + '=' * 60)
    console.log('📊 测试完成')
    console.log('=' * 60)
    console.log(summary)

    return {
      totalTests: results.length,
      passedTests: results.filter(r => r.status === 'passed').length,
      failedTests: results.filter(r => r.status === 'failed').length,
      skippedTests: results.filter(r => r.status === 'skipped').length,
      duration,
      results,
      summary
    }
  }

  private async runQuickTest(): Promise<TestResult> {
    const startTime = Date.now()

    try {
      // 运行快速测试
      execSync('npx ts-node tests/offline/enhanced-offline-quick-test.ts', {
        cwd: this.projectRoot,
        stdio: 'inherit',
        timeout: 30000
      })

      return {
        file: 'tests/offline/enhanced-offline-quick-test.ts',
        status: 'passed',
        duration: Date.now() - startTime
      }
    } catch (error) {
      return {
        file: 'tests/offline/enhanced-offline-quick-test.ts',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error.message
      }
    }
  }

  private async runUnitTest(): Promise<TestResult> {
    const startTime = Date.now()

    try {
      // 运行 Jest 单元测试
      execSync('npx jest tests/unit/services/enhanced-offline-manager.test.ts --verbose', {
        cwd: this.projectRoot,
        stdio: 'pipe',
        timeout: 60000
      })

      return {
        file: 'tests/unit/services/enhanced-offline-manager.test.ts',
        status: 'passed',
        duration: Date.now() - startTime
      }
    } catch (error) {
      return {
        file: 'tests/unit/services/enhanced-offline-manager.test.ts',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error.message
      }
    }
  }

  private async runIntegrationTest(): Promise<TestResult> {
    const startTime = Date.now()

    try {
      // 运行集成测试
      execSync('npx jest tests/integration/offline-sync-integration.test.ts --verbose', {
        cwd: this.projectRoot,
        stdio: 'pipe',
        timeout: 90000
      })

      return {
        file: 'tests/integration/offline-sync-integration.test.ts',
        status: 'passed',
        duration: Date.now() - startTime
      }
    } catch (error) {
      return {
        file: 'tests/integration/offline-sync-integration.test.ts',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error.message
      }
    }
  }

  private async runCompatibilityTest(): Promise<TestResult> {
    const startTime = Date.now()

    try {
      // 运行兼容性测试
      execSync('npx jest tests/sync/unified-sync-service-base.test.ts --verbose', {
        cwd: this.projectRoot,
        stdio: 'pipe',
        timeout: 60000
      })

      return {
        file: 'tests/sync/unified-sync-service-base.test.ts',
        status: 'passed',
        duration: Date.now() - startTime
      }
    } catch (error) {
      return {
        file: 'tests/sync/unified-sync-service-base.test.ts',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error.message
      }
    }
  }

  private generateSummary(results: TestResult[], duration: number): string {
    const passed = results.filter(r => r.status === 'passed').length
    const failed = results.filter(r => r.status === 'failed').length
    const skipped = results.filter(r => r.status === 'skipped').length

    let summary = `总测试数: ${results.length}\n`
    summary += `通过测试: ${passed}\n`
    summary += `失败测试: ${failed}\n`
    summary += `跳过测试: ${skipped}\n`
    summary += `总耗时: ${(duration / 1000).toFixed(2)}s\n`
    summary += `成功率: ${((passed / results.length) * 100).toFixed(1)}%\n\n`

    if (failed > 0) {
      summary += '❌ 失败的测试:\n'
      results.filter(r => r.status === 'failed').forEach(result => {
        summary += `  - ${result.file}\n`
        if (result.error) {
          summary += `    错误: ${result.error}\n`
        }
      })
      summary += '\n'
    }

    if (passed === results.length) {
      summary += '🎉 所有测试通过！增强离线管理器功能正常且兼容性良好\n'
    } else {
      summary += '⚠️  部分测试失败，请检查实现\n'
    }

    return summary
  }

  // 生成测试报告
  generateTestReport(results: TestSuiteResult): string {
    const report = {
      timestamp: new Date().toISOString(),
      project: 'CardEverything - Enhanced Offline Manager',
      version: 'Week 3 Day 11-13',
      summary: {
        totalTests: results.totalTests,
        passedTests: results.passedTests,
        failedTests: results.failedTests,
        skippedTests: results.skippedTests,
        duration: results.duration,
        successRate: (results.passedTests / results.totalTests) * 100
      },
      details: results.results,
      recommendations: this.generateRecommendations(results)
    }

    return JSON.stringify(report, null, 2)
  }

  private generateRecommendations(results: TestSuiteResult): string[] {
    const recommendations: string[] = []

    if (results.failedTests > 0) {
      recommendations.push('修复失败的测试用例')
    }

    if (results.duration > 300000) { // 5分钟
      recommendations.push('优化测试执行时间')
    }

    if (results.passedTests / results.totalTests < 0.9) {
      recommendations.push('提高测试覆盖率')
    }

    recommendations.push('定期运行测试以确保功能稳定性')
    recommendations.push('在CI/CD流水线中集成测试')

    return recommendations
  }

  // 保存测试报告
  saveTestReport(results: TestSuiteResult, outputPath: string): void {
    const report = this.generateTestReport(results)
    writeFileSync(outputPath, report)
    console.log(`📄 测试报告已保存到: ${outputPath}`)
  }
}

// 兼容性验证器
class CompatibilityValidator {
  private projectRoot: string

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
  }

  async validateCompatibility(): Promise<{
    compatible: boolean
    issues: string[]
    recommendations: string[]
  }> {
    console.log('🔧 验证增强离线管理器与现有架构的兼容性...')

    const issues: string[] = []
    const recommendations: string[] = []

    // 检查文件依赖关系
    const dependencyIssues = await this.checkDependencies()
    issues.push(...dependencyIssues)

    // 检查API兼容性
    const apiIssues = await this.checkAPICompatibility()
    issues.push(...apiIssues)

    // 检查类型兼容性
    const typeIssues = await this.checkTypeCompatibility()
    issues.push(...typeIssues)

    // 检查事件系统兼容性
    const eventIssues = await this.checkEventCompatibility()
    issues.push(...eventIssues)

    // 生成建议
    if (issues.length > 0) {
      recommendations.push('解决所有兼容性问题后再次运行测试')
      recommendations.push('逐步迁移现有功能以使用新的增强离线管理器')
    } else {
      recommendations.push('兼容性验证通过，可以安全使用增强离线管理器')
    }

    return {
      compatible: issues.length === 0,
      issues,
      recommendations
    }
  }

  private async checkDependencies(): Promise<string[]> {
    const issues: string[] = []

    try {
      // 检查必要的文件是否存在
      const requiredFiles = [
        'src/services/sync/enhanced-offline-manager.ts',
        'src/services/sync/unified-sync-service-base.ts',
        'src/services/sync/types/sync-types.ts'
      ]

      for (const file of requiredFiles) {
        const filePath = join(this.projectRoot, file)
        try {
          readFileSync(filePath, 'utf8')
        } catch (error) {
          issues.push(`必需文件不存在: ${file}`)
        }
      }
    } catch (error) {
      issues.push(`依赖检查失败: ${error.message}`)
    }

    return issues
  }

  private async checkAPICompatibility(): Promise<string[]> {
    const issues: string[] = []

    try {
      // 检查API接口兼容性
      // 这里应该检查新的增强离线管理器是否实现了所有必需的接口
      // 由于是模拟检查，我们只做简单的验证

      const enhancedOfflineManagerPath = join(this.projectRoot, 'src/services/sync/enhanced-offline-manager.ts')
      const content = readFileSync(enhancedOfflineManagerPath, 'utf8')

      const requiredMethods = [
        'executeOfflineOperation',
        'getPendingOfflineOperations',
        'predictOperationOutcome',
        'assessNetworkQuality',
        'detectConflict',
        'resolveConflict'
      ]

      for (const method of requiredMethods) {
        if (!content.includes(method)) {
          issues.push(`缺少必需方法: ${method}`)
        }
      }
    } catch (error) {
      issues.push(`API兼容性检查失败: ${error.message}`)
    }

    return issues
  }

  private async checkTypeCompatibility(): Promise<string[]> {
    const issues: string[] = []

    try {
      // 检查类型定义兼容性
      const syncTypesPath = join(this.projectRoot, 'src/services/sync/types/sync-types.ts')
      const content = readFileSync(syncTypesPath, 'utf8')

      const requiredTypes = [
        'SyncOperation',
        'SyncResult',
        'ConflictInfo',
        'SyncError'
      ]

      for (const type of requiredTypes) {
        if (!content.includes(type)) {
          issues.push(`缺少必需类型: ${type}`)
        }
      }
    } catch (error) {
      issues.push(`类型兼容性检查失败: ${error.message}`)
    }

    return issues
  }

  private async checkEventCompatibility(): Promise<string[]> {
    const issues: string[] = []

    try {
      // 检查事件系统兼容性
      const enhancedOfflineManagerPath = join(this.projectRoot, 'src/services/sync/enhanced-offline-manager.ts')
      const content = readFileSync(enhancedOfflineManagerPath, 'utf8')

      const requiredEvents = [
        'operationQueued',
        'operationCompleted',
        'operationFailed',
        'conflictDetected',
        'networkStatusChanged'
      ]

      for (const event of requiredEvents) {
        if (!content.includes(event)) {
          issues.push(`缺少必需事件: ${event}`)
        }
      }
    } catch (error) {
      issues.push(`事件兼容性检查失败: ${error.message}`)
    }

    return issues
  }
}

// 主函数
async function main() {
  const runner = new EnhancedOfflineTestRunner()
  const validator = new CompatibilityValidator()

  try {
    // 验证兼容性
    console.log('🔍 第一步：兼容性验证')
    const compatibilityResult = await validator.validateCompatibility()

    if (!compatibilityResult.compatible) {
      console.log('❌ 兼容性验证失败:')
      compatibilityResult.issues.forEach(issue => {
        console.log(`  - ${issue}`)
      })

      console.log('\n建议:')
      compatibilityResult.recommendations.forEach(rec => {
        console.log(`  - ${rec}`)
      })

      process.exit(1)
    }

    console.log('✅ 兼容性验证通过')

    // 运行测试
    console.log('\n🧪 第二步：运行测试套件')
    const testResults = await runner.runAllTests()

    // 保存测试报告
    const reportPath = join(process.cwd(), 'test-report.json')
    runner.saveTestReport(testResults, reportPath)

    // 输出最终结果
    if (testResults.failedTests === 0) {
      console.log('\n🎉 所有测试通过！增强离线管理器迁移成功完成')
      process.exit(0)
    } else {
      console.log('\n⚠️  部分测试失败，请检查实现')
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ 测试运行失败:', error)
    process.exit(1)
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main()
}

export { EnhancedOfflineTestRunner, CompatibilityValidator }