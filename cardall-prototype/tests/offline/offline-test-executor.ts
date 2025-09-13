// 离线功能测试执行器
// 执行 Week 2 Day 8-9 的离线功能测试任务

import { runOfflineTests, runSpecificTestScenario } from './offline-test-scenarios'
import { OfflineManager } from '../../src/services/offline-manager'
import { NetworkMonitor } from '../../src/services/network-monitor'
import { DatabaseUnified } from '../../src/services/database-unified'

// ============================================================================
// 测试配置
// ============================================================================

const testConfig = {
  // 是否启用详细日志
  enableVerboseLogging: true,
  
  // 测试超时时间 (毫秒)
  testTimeout: 30000,
  
  // 是否在测试失败时继续执行
  continueOnFailure: true,
  
  // 是否生成详细报告
  generateDetailedReport: true,
  
  // 测试环境配置
  environment: {
    // 是否模拟真实网络环境
    simulateRealNetwork: true,
    
    // 网络延迟范围 (毫秒)
    networkLatency: { min: 50, max: 200 },
    
    // 是否启用数据压缩
    enableCompression: true,
    
    // 是否启用性能监控
    enablePerformanceMonitoring: true
  }
}

// ============================================================================
// 主测试执行器
// ============================================================================

export class OfflineTestRunner {
  private config: typeof testConfig
  private startTime: number
  private testResults: any[] = []
  
  constructor(config: Partial<typeof testConfig> = {}) {
    this.config = { ...testConfig, ...config }
    this.startTime = performance.now()
  }
  
  /**
   * 运行所有离线测试
   */
  async runAllOfflineTests(): Promise<{
    success: boolean
    results: any[]
    report: string
    duration: number
  }> {
    console.log('🚀 开始执行离线功能测试...')
    console.log(`📊 配置: ${JSON.stringify(this.config, null, 2)}`)
    
    try {
      // 初始化测试环境
      await this.initializeTestEnvironment()
      
      // 执行离线测试场景
      console.log('\n📋 执行离线测试场景...')
      const { results, report } = await runOfflineTests()
      
      // 记录结果
      this.testResults = Array.from(results.entries()).map(([name, result]) => ({
        scenario: name,
        ...result
      }))
      
      // 生成增强报告
      const enhancedReport = await this.generateEnhancedReport(report, results)
      
      // 执行清理
      await this.cleanupTestEnvironment()
      
      const duration = performance.now() - this.startTime
      const success = this.testResults.every(r => r.success)
      
      console.log(`\n✅ 测试完成！`)
      console.log(`⏱️  总耗时: ${duration.toFixed(2)}ms`)
      console.log(`📈 成功率: ${((this.testResults.filter(r => r.success).length / this.testResults.length) * 100).toFixed(1)}%`)
      
      return {
        success,
        results: this.testResults,
        report: enhancedReport,
        duration
      }
      
    } catch (error) {
      console.error('❌ 测试执行失败:', error)
      
      const duration = performance.now() - this.startTime
      
      return {
        success: false,
        results: this.testResults,
        report: `测试执行失败: ${error}`,
        duration
      }
    }
  }
  
  /**
   * 运行特定测试场景
   */
  async runSpecificScenario(scenarioName: string): Promise<{
    success: boolean
    result: any
    duration: number
  }> {
    console.log(`🎯 运行特定测试场景: ${scenarioName}`)
    
    try {
      await this.initializeTestEnvironment()
      
      const result = await runSpecificTestScenario(scenarioName)
      
      await this.cleanupTestEnvironment()
      
      const duration = performance.now() - this.startTime
      
      console.log(`✅ 场景 ${scenarioName} 完成`)
      console.log(`⏱️  耗时: ${duration.toFixed(2)}ms`)
      console.log(`📊 结果: ${result.success ? '通过' : '失败'}`)
      
      return {
        success: result.success,
        result,
        duration
      }
      
    } catch (error) {
      console.error(`❌ 场景 ${scenarioName} 执行失败:`, error)
      
      const duration = performance.now() - this.startTime
      
      return {
        success: false,
        result: null,
        duration
      }
    }
  }
  
  /**
   * 初始化测试环境
   */
  private async initializeTestEnvironment(): Promise<void> {
    console.log('🔧 初始化测试环境...')
    
    // 初始化数据库
    await DatabaseUnified.initialize()
    
    // 初始化离线管理器
    await OfflineManager.initialize()
    
    // 初始化网络监控
    await NetworkMonitor.initialize()
    
    // 配置测试环境
    await this.configureTestEnvironment()
    
    console.log('✅ 测试环境初始化完成')
  }
  
  /**
   * 配置测试环境
   */
  private async configureTestEnvironment(): Promise<void> {
    // 配置离线管理器
    await OfflineManager.configure({
      maxOfflineOperations: 1000,
      enableAutoBackup: true,
      backupInterval: 5000,
      enableCompression: this.config.environment.enableCompression,
      enablePerformanceMonitoring: this.config.environment.enablePerformanceMonitoring
    })
    
    // 配置网络监控
    await NetworkMonitor.configure({
      enableRealTimeMonitoring: true,
      monitoringInterval: 1000,
      enableDetailedMetrics: true
    })
    
    // 清理现有测试数据
    await DatabaseUnified.clearTestData()
    
    console.log('✅ 测试环境配置完成')
  }
  
  /**
   * 清理测试环境
   */
  private async cleanupTestEnvironment(): Promise<void> {
    console.log('🧹 清理测试环境...')
    
    // 清理测试数据
    await DatabaseUnified.clearTestData()
    
    // 关闭连接
    await OfflineManager.shutdown()
    await NetworkMonitor.shutdown()
    await DatabaseUnified.shutdown()
    
    console.log('✅ 测试环境清理完成')
  }
  
  /**
   * 生成增强报告
   */
  private async generateEnhancedReport(basicReport: string, results: Map<string, any>): Promise<string> {
    let enhancedReport = basicReport
    
    // 添加性能分析
    enhancedReport += '\n## 性能分析\n\n'
    
    const totalDuration = performance.now() - this.startTime
    const avgDuration = totalDuration / results.size
    
    enhancedReport += `- 总测试时间: ${totalDuration.toFixed(2)}ms\n`
    enhancedReport += `- 平均场景时间: ${avgDuration.toFixed(2)}ms\n`
    
    // 添加操作统计
    let totalOperations = 0
    let totalErrors = 0
    
    for (const result of results.values()) {
      totalOperations += result.operations.length
      totalErrors += result.errors.length
    }
    
    enhancedReport += `- 总操作数: ${totalOperations}\n`
    enhancedReport += `- 总错误数: ${totalErrors}\n`
    enhancedReport += `- 错误率: ${((totalErrors / Math.max(totalOperations, 1)) * 100).toFixed(2)}%\n\n`
    
    // 添加环境信息
    enhancedReport += '## 测试环境信息\n\n'
    enhancedReport += `- Node.js 版本: ${process.version}\n`
    enhancedReport += `- 测试时间: ${new Date().toISOString()}\n`
    enhancedReport += `- 测试配置: ${JSON.stringify(this.config, null, 2)}\n\n`
    
    // 添加建议
    enhancedReport += '## 改进建议\n\n'
    
    const failedScenarios = Array.from(results.entries()).filter(([_, result]) => !result.success)
    
    if (failedScenarios.length > 0) {
      enhancedReport += '### 失败场景分析\n'
      for (const [name, result] of failedScenarios) {
        enhancedReport += `- **${name}**: ${result.errors.join('; ')}\n`
      }
      enhancedReport += '\n'
    }
    
    // 性能建议
    const slowScenarios = Array.from(results.entries()).filter(([_, result]) => result.duration > 3000)
    
    if (slowScenarios.length > 0) {
      enhancedReport += '### 性能优化建议\n'
      for (const [name, result] of slowScenarios) {
        enhancedReport += `- **${name}**: 耗时 ${result.duration.toFixed(2)}ms，建议优化\n`
      }
      enhancedReport += '\n'
    }
    
    return enhancedReport
  }
}

// ============================================================================
// 测试执行入口
// ============================================================================

/**
 * 运行 Week 2 Day 8-9 离线功能测试
 */
export async function executeWeek2Day8_9OfflineTests(): Promise<void> {
  console.log('📅 执行 Week 2 Day 8-9 离线功能测试\n')
  
  const runner = new OfflineTestRunner({
    enableVerboseLogging: true,
    generateDetailedReport: true,
    continueOnFailure: true
  })
  
  // 运行所有测试
  const result = await runner.runAllOfflineTests()
  
  // 输出结果
  console.log('\n📋 测试结果摘要:')
  console.log(result.report)
  
  // 保存报告到文件
  const fs = require('fs')
  const path = require('path')
  
  const reportPath = path.join(process.cwd(), 'offline-test-report.md')
  fs.writeFileSync(reportPath, result.report)
  
  console.log(`\n📄 详细报告已保存到: ${reportPath}`)
  
  // 如果测试失败，提供调试信息
  if (!result.success) {
    console.log('\n🔍 调试信息:')
    
    for (const testResult of result.results) {
      if (!testResult.success) {
        console.log(`\n❌ 失败场景: ${testResult.scenario}`)
        console.log(`错误信息: ${testResult.errors.join(', ')}`)
        console.log(`耗时: ${testResult.duration.toFixed(2)}ms`)
      }
    }
    
    process.exit(1)
  }
  
  console.log('\n🎉 所有离线功能测试通过！')
}

/**
 * 运行特定测试场景（用于调试）
 */
export async function runSpecificOfflineTest(scenarioName: string): Promise<void> {
  console.log(`🎯 运行特定离线测试: ${scenarioName}\n`)
  
  const runner = new OfflineTestRunner({
    enableVerboseLogging: true
  })
  
  const result = await runner.runSpecificScenario(scenarioName)
  
  console.log('\n📋 测试结果:')
  console.log(`成功: ${result.success ? '是' : '否'}`)
  console.log(`耗时: ${result.duration.toFixed(2)}ms`)
  
  if (result.result) {
    console.log(`操作数: ${result.result.operations.length}`)
    console.log(`错误数: ${result.result.errors.length}`)
    
    if (result.result.errors.length > 0) {
      console.log('错误详情:')
      result.result.errors.forEach((error: string, index: number) => {
        console.log(`  ${index + 1}. ${error}`)
      })
    }
  }
  
  if (!result.success) {
    process.exit(1)
  }
}

// ============================================================================
// 命令行接口
// ============================================================================

// 如果直接运行此文件
if (require.main === module) {
  const args = process.argv.slice(2)
  
  if (args.length > 0) {
    const scenarioName = args[0]
    runSpecificOfflineTest(scenarioName)
  } else {
    executeWeek2Day8_9OfflineTests()
  }
}