// 测试运行脚本
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

class TestRunner {
  constructor() {
    this.results = {
      unit: { passed: 0, failed: 0, total: 0 },
      integration: { passed: 0, failed: 0, total: 0 },
      e2e: { passed: 0, failed: 0, total: 0 },
      performance: { passed: 0, failed: 0, total: 0 },
      overall: { passed: 0, failed: 0, total: 0, coverage: 0 }
    }
    this.startTime = Date.now()
    this.outputDir = path.join(__dirname, '..', 'test-results')
  }

  async run() {
    console.log('🚀 开始执行 CardEverything 测试套件...')
    console.log('='.repeat(60))

    // 创建输出目录
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }

    try {
      // 运行单元测试
      await this.runUnitTests()
      
      // 运行集成测试
      await this.runIntegrationTests()
      
      // 运行E2E测试
      await this.runE2ETests()
      
      // 运行性能测试
      await this.runPerformanceTests()
      
      // 生成报告
      await this.generateReport()
      
      // 显示总结
      this.showSummary()
      
      // 检查是否所有测试都通过
      const allPassed = this.results.overall.failed === 0
      process.exit(allPassed ? 0 : 1)
      
    } catch (error) {
      console.error('❌ 测试执行失败:', error)
      process.exit(1)
    }
  }

  async runUnitTests() {
    console.log('📦 运行单元测试...')
    try {
      const output = execSync('npm test -- --testPathPattern=tests/unit --verbose --coverage', {
        encoding: 'utf8',
        stdio: 'pipe'
      })

      // 解析测试结果
      this.parseJestOutput(output, 'unit')
      
      // 保存详细输出
      fs.writeFileSync(path.join(this.outputDir, 'unit-tests.log'), output)
      
      console.log('✅ 单元测试完成')
      
    } catch (error) {
      console.error('❌ 单元测试失败:', error.message)
      this.parseJestOutput(error.stdout || '', 'unit', true)
    }
  }

  async runIntegrationTests() {
    console.log('🔗 运行集成测试...')
    try {
      const output = execSync('npm test -- --testPathPattern=tests/integration --verbose', {
        encoding: 'utf8',
        stdio: 'pipe'
      })

      this.parseJestOutput(output, 'integration')
      fs.writeFileSync(path.join(this.outputDir, 'integration-tests.log'), output)
      
      console.log('✅ 集成测试完成')
      
    } catch (error) {
      console.error('❌ 集成测试失败:', error.message)
      this.parseJestOutput(error.stdout || '', 'integration', true)
    }
  }

  async runE2ETests() {
    console.log('🌐 运行E2E测试...')
    try {
      const output = execSync('npx playwright test --config=playwright.config.ts tests/e2e/', {
        encoding: 'utf8',
        stdio: 'pipe'
      })

      this.parsePlaywrightOutput(output, 'e2e')
      fs.writeFileSync(path.join(this.outputDir, 'e2e-tests.log'), output)
      
      console.log('✅ E2E测试完成')
      
    } catch (error) {
      console.error('❌ E2E测试失败:', error.message)
      this.parsePlaywrightOutput(error.stdout || '', 'e2e', true)
    }
  }

  async runPerformanceTests() {
    console.log('⚡ 运行性能测试...')
    try {
      const output = execSync('npm test -- --testPathPattern=tests/performance --verbose', {
        encoding: 'utf8',
        stdio: 'pipe'
      })

      this.parseJestOutput(output, 'performance')
      fs.writeFileSync(path.join(this.outputDir, 'performance-tests.log'), output)
      
      console.log('✅ 性能测试完成')
      
    } catch (error) {
      console.error('❌ 性能测试失败:', error.message)
      this.parseJestOutput(error.stdout || '', 'performance', true)
    }
  }

  parseJestOutput(output, type, hasErrors = false) {
    // 解析Jest输出
    const testResults = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed/i)
    const coverageMatch = output.match(/All files[^|]*\|\s+([\d.]+)\s+\|/i)

    if (testResults) {
      const total = parseInt(testResults[1]) + parseInt(testResults[2])
      const passed = parseInt(testResults[1])
      const failed = parseInt(testResults[2])

      this.results[type] = { total, passed, failed }
      
      // 更新总体结果
      this.results.overall.total += total
      this.results.overall.passed += passed
      this.results.overall.failed += failed
    }

    if (coverageMatch && type === 'unit') {
      this.results.overall.coverage = parseFloat(coverageMatch[1])
    }

    // 如果有错误，尝试解析错误信息
    if (hasErrors) {
      const errorMatch = output.match(/FAIL\s+(.+)/i)
      if (errorMatch) {
        console.error(`  错误详情: ${errorMatch[1]}`)
      }
    }
  }

  parsePlaywrightOutput(output, type, hasErrors = false) {
    // 解析Playwright输出
    const passedMatch = output.match(/(\d+)\s+passed/i)
    const failedMatch = output.match(/(\d+)\s+failed/i)
    const skippedMatch = output.match(/(\d+)\s+skipped/i)

    const passed = passedMatch ? parseInt(passedMatch[1]) : 0
    const failed = failedMatch ? parseInt(failedMatch[1]) : 0
    const skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0
    const total = passed + failed + skipped

    this.results[type] = { total, passed, failed }
    
    this.results.overall.total += total
    this.results.overall.passed += passed
    this.results.overall.failed += failed

    if (hasErrors) {
      const errorMatch = output.match(/Error:\s+(.+)/i)
      if (errorMatch) {
        console.error(`  错误详情: ${errorMatch[1]}`)
      }
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - this.startTime,
      results: this.results,
      summary: {
        totalTests: this.results.overall.total,
        passedTests: this.results.overall.passed,
        failedTests: this.results.overall.failed,
        passRate: ((this.results.overall.passed / this.results.overall.total) * 100).toFixed(2) + '%',
        coverage: this.results.overall.coverage + '%',
        executionTime: this.formatTime(Date.now() - this.startTime)
      },
      details: {
        unit: {
          ...this.results.unit,
          passRate: this.results.unit.total > 0 ? 
            ((this.results.unit.passed / this.results.unit.total) * 100).toFixed(2) + '%' : '0%'
        },
        integration: {
          ...this.results.integration,
          passRate: this.results.integration.total > 0 ? 
            ((this.results.integration.passed / this.results.integration.total) * 100).toFixed(2) + '%' : '0%'
        },
        e2e: {
          ...this.results.e2e,
          passRate: this.results.e2e.total > 0 ? 
            ((this.results.e2e.passed / this.results.e2e.total) * 100).toFixed(2) + '%' : '0%'
        },
        performance: {
          ...this.results.performance,
          passRate: this.results.performance.total > 0 ? 
            ((this.results.performance.passed / this.results.performance.total) * 100).toFixed(2) + '%' : '0%'
        }
      }
    }

    // 保存JSON报告
    fs.writeFileSync(
      path.join(this.outputDir, 'test-report.json'),
      JSON.stringify(report, null, 2)
    )

    // 生成HTML报告
    const htmlReport = this.generateHTMLReport(report)
    fs.writeFileSync(
      path.join(this.outputDir, 'test-report.html'),
      htmlReport
    )

    console.log('📊 测试报告已生成')
    console.log(`   JSON: ${path.join(this.outputDir, 'test-report.json')}`)
    console.log(`   HTML: ${path.join(this.outputDir, 'test-report.html')}`)
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CardEverything 测试报告</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }
        .metric {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            margin: 10px 0;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        .success { color: #28a745; }
        .danger { color: #dc3545; }
        .warning { color: #ffc107; }
        .details {
            padding: 30px;
        }
        .test-section {
            margin-bottom: 30px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            overflow: hidden;
        }
        .test-section-header {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #e9ecef;
            font-weight: bold;
            font-size: 1.1em;
        }
        .test-section-content {
            padding: 20px;
        }
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #28a745, #20c997);
            transition: width 0.3s ease;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-top: 15px;
        }
        .stat-item {
            text-align: center;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
        }
        .footer {
            padding: 20px;
            text-align: center;
            color: #666;
            border-top: 1px solid #e9ecef;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 CardEverything 测试报告</h1>
            <p>生成时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}</p>
            <p>执行时间: ${report.summary.executionTime}</p>
        </div>

        <div class="summary">
            <div class="metric">
                <div class="metric-label">总测试数</div>
                <div class="metric-value">${report.summary.totalTests}</div>
            </div>
            <div class="metric">
                <div class="metric-label">通过测试</div>
                <div class="metric-value success">${report.summary.passedTests}</div>
            </div>
            <div class="metric">
                <div class="metric-label">失败测试</div>
                <div class="metric-value ${report.summary.failedTests > 0 ? 'danger' : 'success'}">${report.summary.failedTests}</div>
            </div>
            <div class="metric">
                <div class="metric-label">通过率</div>
                <div class="metric-value ${report.summary.passedTests === report.summary.totalTests ? 'success' : 'warning'}">${report.summary.passRate}</div>
            </div>
            <div class="metric">
                <div class="metric-label">代码覆盖率</div>
                <div class="metric-value ${parseFloat(report.summary.coverage) >= 90 ? 'success' : parseFloat(report.summary.coverage) >= 80 ? 'warning' : 'danger'}">${report.summary.coverage}</div>
            </div>
        </div>

        <div class="details">
            <div class="test-section">
                <div class="test-section-header">📦 单元测试</div>
                <div class="test-section-content">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${parseFloat(report.details.unit.passRate)}%"></div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div>总计</div>
                            <div><strong>${report.details.unit.total}</strong></div>
                        </div>
                        <div class="stat-item">
                            <div>通过</div>
                            <div class="success"><strong>${report.details.unit.passed}</strong></div>
                        </div>
                        <div class="stat-item">
                            <div>失败</div>
                            <div class="danger"><strong>${report.details.unit.failed}</strong></div>
                        </div>
                    </div>
                    <p style="margin-top: 15px; text-align: center;">
                        <strong>通过率: ${report.details.unit.passRate}</strong>
                    </p>
                </div>
            </div>

            <div class="test-section">
                <div class="test-section-header">🔗 集成测试</div>
                <div class="test-section-content">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${parseFloat(report.details.integration.passRate)}%"></div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div>总计</div>
                            <div><strong>${report.details.integration.total}</strong></div>
                        </div>
                        <div class="stat-item">
                            <div>通过</div>
                            <div class="success"><strong>${report.details.integration.passed}</strong></div>
                        </div>
                        <div class="stat-item">
                            <div>失败</div>
                            <div class="danger"><strong>${report.details.integration.failed}</strong></div>
                        </div>
                    </div>
                    <p style="margin-top: 15px; text-align: center;">
                        <strong>通过率: ${report.details.integration.passRate}</strong>
                    </p>
                </div>
            </div>

            <div class="test-section">
                <div class="test-section-header">🌐 E2E测试</div>
                <div class="test-section-content">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${parseFloat(report.details.e2e.passRate)}%"></div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div>总计</div>
                            <div><strong>${report.details.e2e.total}</strong></div>
                        </div>
                        <div class="stat-item">
                            <div>通过</div>
                            <div class="success"><strong>${report.details.e2e.passed}</strong></div>
                        </div>
                        <div class="stat-item">
                            <div>失败</div>
                            <div class="danger"><strong>${report.details.e2e.failed}</strong></div>
                        </div>
                    </div>
                    <p style="margin-top: 15px; text-align: center;">
                        <strong>通过率: ${report.details.e2e.passRate}</strong>
                    </p>
                </div>
            </div>

            <div class="test-section">
                <div class="test-section-header">⚡ 性能测试</div>
                <div class="test-section-content">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${parseFloat(report.details.performance.passRate)}%"></div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div>总计</div>
                            <div><strong>${report.details.performance.total}</strong></div>
                        </div>
                        <div class="stat-item">
                            <div>通过</div>
                            <div class="success"><strong>${report.details.performance.passed}</strong></div>
                        </div>
                        <div class="stat-item">
                            <div>失败</div>
                            <div class="danger"><strong>${report.details.performance.failed}</strong></div>
                        </div>
                    </div>
                    <p style="margin-top: 15px; text-align: center;">
                        <strong>通过率: ${report.details.performance.passRate}</strong>
                    </p>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>🤖 由 CardEverything 测试系统自动生成</p>
        </div>
    </div>
</body>
</html>
    `
  }

  showSummary() {
    console.log('='.repeat(60))
    console.log('📊 测试执行总结')
    console.log('='.repeat(60))
    
    const { overall, details } = this.results
    
    console.log(`总测试数: ${overall.total}`)
    console.log(`通过测试: ${overall.passed} ✅`)
    console.log(`失败测试: ${overall.failed} ${overall.failed > 0 ? '❌' : '✅'}`)
    console.log(`通过率: ${((overall.passed / overall.total) * 100).toFixed(2)}%`)
    console.log(`代码覆盖率: ${overall.coverage}%`)
    console.log(`执行时间: ${this.formatTime(Date.now() - this.startTime)}`)
    
    console.log('\n📋 详细结果:')
    console.log(`  单元测试: ${details.unit.passed}/${details.unit.total} (${details.unit.passRate})`)
    console.log(`  集成测试: ${details.integration.passed}/${details.integration.total} (${details.integration.passRate})`)
    console.log(`  E2E测试: ${details.e2e.passed}/${details.e2e.total} (${details.e2e.passRate})`)
    console.log(`  性能测试: ${details.performance.passed}/${details.performance.total} (${details.performance.passRate})`)
    
    if (overall.failed > 0) {
      console.log('\n❌ 存在失败的测试，请检查测试报告')
    } else {
      console.log('\n🎉 所有测试都通过了！')
    }
  }

  formatTime(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }
}

// 运行测试
if (require.main === module) {
  const runner = new TestRunner()
  runner.run().catch(console.error)
}

module.exports = TestRunner