/**
 * 集成测试运行器
 * 提供测试运行、报告生成和性能分析功能
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

// 测试配置
const testConfig = {
  // 测试文件匹配模式
  testPatterns: [
    'tests/integration/**/*.test.ts',
    'tests/integration/**/*.test.js'
  ],

  // 测试环境变量
  env: {
    NODE_ENV: 'test',
    VITEST: 'true'
  },

  // 测试覆盖率要求
  coverage: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80
  },

  // 性能测试阈值
  performance: {
    maxSyncDuration: 10000, // 10秒
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    maxResponseTime: 5000 // 5秒
  }
}

// 测试结果类型
interface TestResult {
  total: number
  passed: number
  failed: number
  duration: number
  coverage?: {
    statements: number
    branches: number
    functions: number
    lines: number
  }
  performance?: {
    avgSyncTime: number
    maxMemoryUsage: number
    avgResponseTime: number
  }
}

// 测试运行器类
class IntegrationTestRunner {
  private results: TestResult = {
    total: 0,
    passed: 0,
    failed: 0,
    duration: 0
  }

  constructor(private config: typeof testConfig) {}

  /**
   * 运行所有集成测试
   */
  async runAllTests(): Promise<TestResult> {
    console.log('🚀 开始运行集成测试套件...')
    console.log('=====================================')

    const startTime = Date.now()

    try {
      // 运行核心功能测试
      await this.runCoreFunctionalityTests()

      // 运行网络错误处理测试
      await this.runNetworkErrorHandlingTests()

      // 运行数据一致性测试
      await this.runDataConsistencyTests()

      // 运行用户场景测试
      await this.runUserScenarioTests()

      // 生成测试报告
      this.results.duration = Date.now() - startTime
      await this.generateTestReport()

      console.log('=====================================')
      console.log(`✅ 测试完成！总计: ${this.results.total}, 通过: ${this.results.passed}, 失败: ${this.results.failed}`)
      console.log(`⏱️  总耗时: ${this.results.duration}ms`)

      return this.results
    } catch (error) {
      console.error('❌ 测试运行失败:', error)
      throw error
    }
  }

  /**
   * 运行核心功能测试
   */
  private async runCoreFunctionalityTests(): Promise<void> {
    console.log('🔧 运行核心功能集成测试...')

    const result = await this.runVitest('tests/integration/core-functionality-e2e.test.ts')

    this.results.total += result.total
    this.results.passed += result.passed
    this.results.failed += result.failed

    console.log(`   ✓ 核心功能测试: ${result.passed}/${result.total} 通过`)
  }

  /**
   * 运行网络错误处理测试
   */
  private async runNetworkErrorHandlingTests(): Promise<void> {
    console.log('🌐 运行网络错误处理测试...')

    const result = await this.runVitest('tests/integration/network-error-handling-integration.test.ts')

    this.results.total += result.total
    this.results.passed += result.passed
    this.results.failed += result.failed

    console.log(`   ✓ 网络错误处理测试: ${result.passed}/${result.total} 通过`)
  }

  /**
   * 运行数据一致性测试
   */
  private async runDataConsistencyTests(): Promise<void> {
    console.log('🔄 运行数据一致性测试...')

    const result = await this.runVitest('tests/integration/data-consistency-conflict-resolution.test.ts')

    this.results.total += result.total
    this.results.passed += result.passed
    this.results.failed += result.failed

    console.log(`   ✓ 数据一致性测试: ${result.passed}/${result.total} 通过`)
  }

  /**
   * 运行用户场景测试
   */
  private async runUserScenarioTests(): Promise<void> {
    console.log('👤 运行用户场景测试...')

    const result = await this.runVitest('tests/integration/complete-user-scenarios-e2e.test.ts')

    this.results.total += result.total
    this.results.passed += result.passed
    this.results.failed += result.failed

    console.log(`   ✓ 用户场景测试: ${result.passed}/${result.total} 通过`)
  }

  /**
   * 运行 Vitest 测试
   */
  private async runVitest(testPattern: string): Promise<{ total: number; passed: number; failed: number }> {
    try {
      const output = execSync(
        `npx vitest run ${testPattern} --reporter=verbose`,
        {
          env: { ...process.env, ...this.config.env },
          encoding: 'utf8',
          stdio: 'pipe'
        }
      )

      return this.parseVitestOutput(output)
    } catch (error: any) {
      console.error(`   ❌ 测试失败: ${error.message}`)
      return { total: 1, passed: 0, failed: 1 }
    }
  }

  /**
   * 解析 Vitest 输出
   */
  private parseVitestOutput(output: string): { total: number; passed: number; failed: number } {
    const lines = output.split('\n')
    let total = 0
    let passed = 0
    let failed = 0

    for (const line of lines) {
      const testMatch = line.match(/Tests\s+(\d+)\s+passed\s*\((\d+)\)/)
      if (testMatch) {
        total = parseInt(testMatch[1])
        passed = parseInt(testMatch[2])
        failed = total - passed
        break
      }
    }

    return { total, passed, failed }
  }

  /**
   * 生成测试报告
   */
  private async generateTestReport(): Promise<void> {
    const reportDir = path.join(process.cwd(), 'test-reports')
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }

    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results,
      config: this.config,
      details: {
        coreFunctionality: {
          total: this.results.total / 4,
          passed: this.results.passed / 4,
          failed: this.results.failed / 4
        },
        networkErrorHandling: {
          total: this.results.total / 4,
          passed: this.results.passed / 4,
          failed: this.results.failed / 4
        },
        dataConsistency: {
          total: this.results.total / 4,
          passed: this.results.passed / 4,
          failed: this.results.failed / 4
        },
        userScenarios: {
          total: this.results.total / 4,
          passed: this.results.passed / 4,
          failed: this.results.failed / 4
        }
      }
    }

    const reportPath = path.join(reportDir, 'integration-test-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

    // 生成 HTML 报告
    await this.generateHtmlReport(report)

    console.log(`📊 测试报告已生成: ${reportPath}`)
  }

  /**
   * 生成 HTML 报告
   */
  private async generateHtmlReport(report: any): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>集成测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 8px; }
        .summary { display: flex; justify-content: space-around; margin: 20px 0; }
        .metric { text-align: center; padding: 15px; background: #fff; border: 1px solid #ddd; border-radius: 5px; }
        .metric h3 { margin: 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; margin: 10px 0; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .details { margin-top: 30px; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .test-section h3 { margin-top: 0; color: #333; }
        .progress-bar { width: 100%; height: 20px; background: #f4f4f4; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: #28a745; transition: width 0.3s ease; }
        .timestamp { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>集成测试报告</h1>
        <p class="timestamp">生成时间: ${new Date(report.timestamp).toLocaleString()}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>总测试数</h3>
            <div class="value">${report.summary.total}</div>
        </div>
        <div class="metric">
            <h3>通过</h3>
            <div class="value passed">${report.summary.passed}</div>
        </div>
        <div class="metric">
            <h3>失败</h3>
            <div class="value failed">${report.summary.failed}</div>
        </div>
        <div class="metric">
            <h3>通过率</h3>
            <div class="value">${((report.summary.passed / report.summary.total) * 100).toFixed(1)}%</div>
        </div>
        <div class="metric">
            <h3>总耗时</h3>
            <div class="value">${report.summary.duration}ms</div>
        </div>
    </div>

    <div class="details">
        <h2>测试详情</h2>

        <div class="test-section">
            <h3>核心功能测试</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${(report.details.coreFunctionality.passed / report.details.coreFunctionality.total) * 100}%"></div>
            </div>
            <p>通过: ${report.details.coreFunctionality.passed}/${report.details.coreFunctionality.total}</p>
        </div>

        <div class="test-section">
            <h3>网络错误处理测试</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${(report.details.networkErrorHandling.passed / report.details.networkErrorHandling.total) * 100}%"></div>
            </div>
            <p>通过: ${report.details.networkErrorHandling.passed}/${report.details.networkErrorHandling.total}</p>
        </div>

        <div class="test-section">
            <h3>数据一致性测试</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${(report.details.dataConsistency.passed / report.details.dataConsistency.total) * 100}%"></div>
            </div>
            <p>通过: ${report.details.dataConsistency.passed}/${report.details.dataConsistency.total}</p>
        </div>

        <div class="test-section">
            <h3>用户场景测试</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${(report.details.userScenarios.passed / report.details.userScenarios.total) * 100}%"></div>
            </div>
            <p>通过: ${report.details.userScenarios.passed}/${report.details.userScenarios.total}</p>
        </div>
    </div>
</body>
</html>
    `

    const htmlPath = path.join(process.cwd(), 'test-reports', 'integration-test-report.html')
    fs.writeFileSync(htmlPath, html)
  }

  /**
   * 运行性能测试
   */
  async runPerformanceTests(): Promise<void> {
    console.log('⚡ 运行性能测试...')

    const performanceTests = [
      'tests/integration/core-functionality-e2e.test.ts',
      'tests/integration/complete-user-scenarios-e2e.test.ts'
    ]

    for (const test of performanceTests) {
      console.log(`   运行性能测试: ${test}`)

      const startTime = performance.now()
      await this.runVitest(test)
      const endTime = performance.now()

      const duration = endTime - startTime
      console.log(`   ⏱️  执行时间: ${duration}ms`)

      if (duration > this.config.performance.maxSyncDuration) {
        console.warn(`   ⚠️  性能警告: 测试执行时间超过阈值 ${this.config.performance.maxSyncDuration}ms`)
      }
    }
  }

  /**
   * 运行覆盖率测试
   */
  async runCoverageTests(): Promise<void> {
    console.log('📊 运行覆盖率测试...')

    try {
      const output = execSync(
        `npx vitest run --coverage`,
        {
          env: { ...process.env, ...this.config.env },
          encoding: 'utf8'
        }
      )

      console.log('   ✅ 覆盖率测试完成')
      console.log(output)
    } catch (error: any) {
      console.error('   ❌ 覆盖率测试失败:', error.message)
    }
  }
}

// 导出测试运行器
export { IntegrationTestRunner, testConfig }

// 如果直接运行此文件，执行所有测试
if (require.main === module) {
  const runner = new IntegrationTestRunner(testConfig)

  runner.runAllTests()
    .then((results) => {
      if (results.failed > 0) {
        process.exit(1)
      }
      process.exit(0)
    })
    .catch((error) => {
      console.error('测试运行失败:', error)
      process.exit(1)
    })
}