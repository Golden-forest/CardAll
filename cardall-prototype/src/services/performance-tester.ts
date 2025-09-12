import { localOperationService } from './local-operation'
import { queryOptimizer } from './query-optimizer'
import { advancedCacheManager } from './advanced-cache'
import { syncQueueManager } from './sync-queue'
import { offlineManager } from './offline-manager'
import { db } from './database-unified'

// ============================================================================
// 性能测试结果接口
// ============================================================================

export interface PerformanceTestResult {
  testName: string
  success: boolean
  executionTime: number
  operationsPerSecond?: number
  memoryUsage?: number
  error?: string
  metadata?: Record<string, any>
}

export interface BenchmarkSuite {
  name: string
  tests: PerformanceTestResult[]
  totalTime: number
  averageTime: number
  successRate: number
  summary: string
}

export interface LoadTestResult {
  concurrentUsers: number
  totalOperations: number
  successRate: number
  averageResponseTime: number
  maxResponseTime: number
  minResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  throughput: number
  errorRate: number
}

// ============================================================================
// 性能测试管理器
// ============================================================================

export class PerformanceTester {
  private testResults: PerformanceTestResult[] = []
  private benchmarkSuites: BenchmarkSuite[] = []
  private loadTestResults: LoadTestResult[] = []

  constructor() {
    this.initializePerformanceTester()
  }

  // ============================================================================
  // 核心性能测试
  // ============================================================================

  /**
   * 运行完整的性能测试套件
   */
  async runFullPerformanceSuite(): Promise<BenchmarkSuite> {
    console.log('🚀 开始运行完整的性能测试套件...')
    
    const suiteName = '本地操作服务性能测试'
    const tests: PerformanceTestResult[] = []
    
    try {
      // 1. 本地操作性能测试
      console.log('📊 测试本地操作性能...')
      tests.push(...await this.testLocalOperations())
      
      // 2. 查询性能测试
      console.log('🔍 测试查询性能...')
      tests.push(...await this.testQueryPerformance())
      
      // 3. 缓存性能测试
      console.log('💾 测试缓存性能...')
      tests.push(...await this.testCachePerformance())
      
      // 4. 同步队列性能测试
      console.log('🔄 测试同步队列性能...')
      tests.push(...await this.testSyncQueuePerformance())
      
      // 5. 离线操作性能测试
      console.log('📡 测试离线操作性能...')
      tests.push(...await this.testOfflinePerformance())
      
      // 6. 内存使用测试
      console.log('🧠 测试内存使用...')
      tests.push(...await this.testMemoryUsage())
      
      // 7. 并发性能测试
      console.log('⚡ 测试并发性能...')
      tests.push(...await this.testConcurrencyPerformance())
      
      const totalTime = tests.reduce((sum, test) => sum + test.executionTime, 0)
      const averageTime = totalTime / tests.length
      const successRate = tests.filter(t => t.success).length / tests.length
      
      const suite: BenchmarkSuite = {
        name: suiteName,
        tests,
        totalTime,
        averageTime,
        successRate,
        summary: this.generatePerformanceSummary(tests)
      }
      
      this.benchmarkSuites.push(suite)
      console.log('✅ 性能测试套件完成')
      
      return suite
    } catch (error) {
      console.error('❌ 性能测试套件失败:', error)
      throw error
    }
  }

  /**
   * 本地操作性能测试
   */
  private async testLocalOperations(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = []
    const testCard = {
      frontContent: { title: '测试卡片', text: '这是一个测试卡片的内容', tags: ['测试'] },
      backContent: { title: '背面', text: '这是卡片背面的内容', tags: ['测试'] },
      style: { type: 'solid' as const, backgroundColor: '#ffffff' }
    }

    // 测试创建操作
    console.log('  📝 测试卡片创建性能...')
    const createResult = await this.measurePerformance(
      '卡片创建',
      async () => {
        const result = await localOperationService.createCard(testCard, 'test-user')
        return result
      },
      100 // 执行100次
    )
    results.push(createResult)

    // 测试更新操作
    console.log('  ✏️  测试卡片更新性能...')
    if (createResult.success && createResult.metadata?.createdId) {
      const updateResult = await this.measurePerformance(
        '卡片更新',
        async () => {
          const result = await localOperationService.updateCard(
            createResult.metadata.createdId,
            { frontContent: { ...testCard.frontContent, title: '更新后的标题' } },
            'test-user'
          )
          return result
        },
        100
      )
      results.push(updateResult)
    }

    // 测试删除操作
    console.log('  🗑️  测试卡片删除性能...')
    if (createResult.success && createResult.metadata?.createdId) {
      const deleteResult = await this.measurePerformance(
        '卡片删除',
        async () => {
          await localOperationService.deleteCard(createResult.metadata.createdId, 'test-user')
        },
        100
      )
      results.push(deleteResult)
    }

    // 测试批量操作
    console.log('  📦 测试批量操作性能...')
    const batchResult = await this.measurePerformance(
      '批量操作',
      async () => {
        const batchOperations = Array(10).fill(null).map((_, i) => ({
          type: 'create' as const,
          entity: 'card' as const,
          data: {
            ...testCard,
            frontContent: { ...testCard.frontContent, title: `批量测试卡片 ${i}` }
          }
        }))
        return await localOperationService.batchOperations(batchOperations, 'test-user')
      },
      50
    )
    results.push(batchResult)

    return results
  }

  /**
   * 查询性能测试
   */
  private async testQueryPerformance(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = []

    // 准备测试数据
    console.log('  📊 准备查询测试数据...')
    const testCards = Array(100).fill(null).map((_, i) => ({
      frontContent: { title: `查询测试卡片 ${i}`, text: '查询测试内容', tags: [`tag${i % 10}`] },
      backContent: { title: '背面', text: '背面内容', tags: [] },
      style: { type: 'solid' as const, backgroundColor: '#ffffff' }
    }))

    for (const card of testCards) {
      await localOperationService.createCard(card, 'test-user')
    }

    // 测试列表查询
    console.log('  📋 测试列表查询性能...')
    const listQueryResult = await this.measurePerformance(
      '列表查询',
      async () => {
        return await localOperationService.getCards({ limit: 50 })
      },
      100
    )
    results.push(listQueryResult)

    // 测试搜索查询
    console.log('  🔍 测试搜索查询性能...')
    const searchResult = await this.measurePerformance(
      '搜索查询',
      async () => {
        return await localOperationService.searchCards({
          query: '查询测试',
          limit: 20
        })
      },
      50
    )
    results.push(searchResult)

    // 测试复杂过滤查询
    console.log('  🎯 测试复杂过滤查询性能...')
    const filterResult = await this.measurePerformance(
      '复杂过滤查询',
      async () => {
        return await queryOptimizer.queryCards({
          userId: 'test-user',
          tags: ['tag0', 'tag1'],
          limit: 30,
          orderBy: 'createdAt',
          sortOrder: 'desc'
        })
      },
      30
    )
    results.push(filterResult)

    // 测试统计查询
    console.log('  📈 测试统计查询性能...')
    const statsResult = await this.measurePerformance(
      '统计查询',
      async () => {
        return await queryOptimizer.getCardStats('test-user')
      },
      20
    )
    results.push(statsResult)

    return results
  }

  /**
   * 缓存性能测试
   */
  private async testCachePerformance(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = []

    // 测试缓存写入性能
    console.log('  ✍️ 测试缓存写入性能...')
    const cacheWriteResult = await this.measurePerformance(
      '缓存写入',
      async () => {
        const testData = Array(1000).fill(null).map((_, i) => ({
          id: i,
          title: `缓存测试数据 ${i}`,
          content: `这是缓存测试内容 ${i}`.repeat(10)
        }))
        await advancedCacheManager.set('large-dataset', testData, {
          ttl: 60 * 1000,
          priority: 'normal'
        })
      },
      50
    )
    results.push(cacheWriteResult)

    // 测试缓存读取性能
    console.log('  📖 测试缓存读取性能...')
    const cacheReadResult = await this.measurePerformance(
      '缓存读取',
      async () => {
        return await advancedCacheManager.get('large-dataset')
      },
      1000
    )
    results.push(cacheReadResult)

    // 测试缓存命中率
    console.log('  🎯 测试缓存命中率...')
    const cacheHitResult = await this.measurePerformance(
      '缓存命中率测试',
      async () => {
        const results = []
        for (let i = 0; i < 1000; i++) {
          const result = await advancedCacheManager.get('large-dataset')
          results.push(result !== null)
        }
        return { hitRate: results.filter(r => r).length / results.length }
      },
      1
    )
    results.push(cacheHitResult)

    return results
  }

  /**
   * 同步队列性能测试
   */
  private async testSyncQueuePerformance(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = []

    // 测试队列写入性能
    console.log('  📝 测试队列写入性能...')
    const queueWriteResult = await this.measurePerformance(
      '队列写入',
      async () => {
        const operations = Array(100).fill(null).map((_, i) => ({
          type: 'create' as const,
          entity: 'card' as const,
          entityId: `card-${i}`,
          userId: 'test-user',
          data: { title: `队列测试 ${i}` },
          priority: 'normal' as const,
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 3
        }))
        return await syncQueueManager.enqueueBatch(operations)
      },
      20
    )
    results.push(queueWriteResult)

    // 测试队列状态查询
    console.log('  📊 测试队列状态查询性能...')
    const queueStatsResult = await this.measurePerformance(
      '队列状态查询',
      async () => {
        return await syncQueueManager.getQueueStats()
      },
      100
    )
    results.push(queueStatsResult)

    return results
  }

  /**
   * 离线操作性能测试
   */
  private async testOfflinePerformance(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = []

    // 模拟离线状态
    const originalOnline = navigator.onLine
    Object.defineProperty(navigator, 'onLine', { get: () => false })

    try {
      console.log('  📡 测试离线操作性能...')
      const offlineResult = await this.measurePerformance(
        '离线操作',
        async () => {
          const operation = {
            type: 'create' as const,
            entity: 'card' as const,
            data: {
              frontContent: { title: '离线测试', text: '离线测试内容', tags: ['离线'] },
              backContent: { title: '背面', text: '背面内容', tags: [] },
              style: { type: 'solid' as const, backgroundColor: '#ffffff' }
            },
            userId: 'test-user',
            priority: 'normal' as const,
            maxRetries: 3
          }
          return await offlineManager.executeOfflineOperation(operation)
        },
        50
      )
      results.push(offlineResult)

      // 测试离线统计查询
      console.log('  📈 测试离线统计查询性能...')
      const offlineStatsResult = await this.measurePerformance(
        '离线统计查询',
        async () => {
          return await offlineManager.getOfflineStats()
        },
      100
      )
      results.push(offlineStatsResult)
    } finally {
      // 恢复在线状态
      Object.defineProperty(navigator, 'onLine', { get: () => originalOnline })
    }

    return results
  }

  /**
   * 内存使用测试
   */
  private async testMemoryUsage(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = []

    // 测试大量数据的内存使用
    console.log('  🧠 测试大量数据内存使用...')
    const memoryResult = await this.measurePerformance(
      '内存使用测试',
      async () => {
        const initialMemory = this.getCurrentMemoryUsage()
        
        // 创建大量数据
        const largeDataset = Array(10000).fill(null).map((_, i) => ({
          id: crypto.randomUUID(),
          title: `内存测试 ${i}`,
          content: 'x'.repeat(1000), // 1KB 内容
          timestamp: new Date()
        }))
        
        await advancedCacheManager.set('huge-dataset', largeDataset, {
          ttl: 5 * 60 * 1000,
          priority: 'normal'
        })
        
        const finalMemory = this.getCurrentMemoryUsage()
        const memoryIncrease = finalMemory - initialMemory
        
        return { memoryIncrease, finalMemory }
      },
      5
    )
    results.push(memoryResult)

    return results
  }

  /**
   * 并发性能测试
   */
  private async testConcurrencyPerformance(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = []

    // 测试并发创建操作
    console.log('  ⚡ 测试并发创建性能...')
    const concurrentCreateResult = await this.measurePerformance(
      '并发创建操作',
      async () => {
        const promises = Array(50).fill(null).map((_, i) =>
          localOperationService.createCard({
            frontContent: { title: `并发测试 ${i}`, text: '并发测试内容', tags: ['并发'] },
            backContent: { title: '背面', text: '背面内容', tags: [] },
            style: { type: 'solid' as const, backgroundColor: '#ffffff' }
          }, 'test-user')
        )
        return await Promise.all(promises)
      },
      10
    )
    results.push(concurrentCreateResult)

    // 测试并发查询
    console.log('  🔍 测试并发查询性能...')
    const concurrentQueryResult = await this.measurePerformance(
      '并发查询操作',
      async () => {
        const promises = Array(100).fill(null).map(() =>
          localOperationService.getCards({ limit: 10 })
        )
        return await Promise.all(promises)
      },
      20
    )
    results.push(concurrentQueryResult)

    return results
  }

  // ============================================================================
  // 负载测试
  // ============================================================================

  /**
   * 运行负载测试
   */
  async runLoadTest(
    concurrentUsers: number = 100,
    duration: number = 30000 // 30秒
  ): Promise<LoadTestResult> {
    console.log(`🏋️ 开始负载测试: ${concurrentUsers} 并发用户, ${duration}ms 持续时间`)
    
    const startTime = performance.now()
    const endTime = startTime + duration
    const results: { success: boolean; responseTime: number; error?: string }[] = []
    let completedOperations = 0

    // 创建并发用户
    const users = Array(concurrentUsers).fill(null).map((_, i) => ({
      id: `user-${i}`,
      operations: 0
    }))

    // 模拟用户操作
    const userPromises = users.map(async (user) => {
      const userResults: { success: boolean; responseTime: number; error?: string }[] = []
      
      while (performance.now() < endTime) {
        try {
          const opStartTime = performance.now()
          
          // 随机选择操作类型
          const operationType = Math.random()
          
          if (operationType < 0.4) {
            // 40% 创建操作
            await localOperationService.createCard({
              frontContent: { 
                title: `负载测试 ${user.operations}`, 
                text: '负载测试内容', 
                tags: ['负载'] 
              },
              backContent: { title: '背面', text: '背面内容', tags: [] },
              style: { type: 'solid' as const, backgroundColor: '#ffffff' }
            }, user.id)
          } else if (operationType < 0.7) {
            // 30% 查询操作
            await localOperationService.getCards({ limit: 20 })
          } else if (operationType < 0.9) {
            // 20% 搜索操作
            await localOperationService.searchCards({
              query: '负载',
              limit: 10
            })
          } else {
            // 10% 统计操作
            await queryOptimizer.getCardStats(user.id)
          }
          
          const responseTime = performance.now() - opStartTime
          userResults.push({ success: true, responseTime })
          user.operations++
          completedOperations++
          
        } catch (error) {
          const responseTime = performance.now() - (performance.now() - 100) // 估算响应时间
          userResults.push({ 
            success: false, 
            responseTime, 
            error: error instanceof Error ? error.message : String(error) 
          })
        }
        
        // 添加随机延迟模拟真实用户行为
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100))
      }
      
      return userResults
    })

    // 等待所有用户完成
    const allUserResults = await Promise.all(userPromises)
    const flatResults = allUserResults.flat()

    // 计算统计数据
    const successfulResults = flatResults.filter(r => r.success)
    const responseTimes = successfulResults.map(r => r.responseTime)
    
    const sortedTimes = responseTimes.sort((a, b) => a - b)
    const p95Index = Math.floor(sortedTimes.length * 0.95)
    const p99Index = Math.floor(sortedTimes.length * 0.99)
    
    const result: LoadTestResult = {
      concurrentUsers,
      totalOperations: completedOperations,
      successRate: successfulResults.length / flatResults.length,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
      maxResponseTime: Math.max(...responseTimes) || 0,
      minResponseTime: Math.min(...responseTimes) || 0,
      p95ResponseTime: sortedTimes[p95Index] || 0,
      p99ResponseTime: sortedTimes[p99Index] || 0,
      throughput: completedOperations / (duration / 1000), // ops/second
      errorRate: (flatResults.length - successfulResults.length) / flatResults.length
    }

    this.loadTestResults.push(result)
    console.log('✅ 负载测试完成')

    return result
  }

  // ============================================================================
  // 性能测量工具方法
  // ============================================================================

  /**
   * 测量操作性能
   */
  private async measurePerformance<T>(
    testName: string,
    operation: () => Promise<T>,
    iterations: number = 1
  ): Promise<PerformanceTestResult> {
    const startTime = performance.now()
    let success = true
    let result: T | undefined
    let error: string | undefined
    const executionTimes: number[] = []

    try {
      for (let i = 0; i < iterations; i++) {
        const iterStart = performance.now()
        result = await operation()
        const iterEnd = performance.now()
        executionTimes.push(iterEnd - iterStart)
      }
    } catch (err) {
      success = false
      error = err instanceof Error ? err.message : String(err)
    }

    const totalTime = performance.now() - startTime
    const averageTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length || 0
    const operationsPerSecond = iterations > 1 ? 1000 / averageTime : undefined

    const memoryUsage = this.getCurrentMemoryUsage()

    const testResult: PerformanceTestResult = {
      testName,
      success,
      executionTime: totalTime,
      operationsPerSecond,
      memoryUsage,
      error,
      metadata: {
        iterations,
        averageTime,
        minTime: Math.min(...executionTimes) || 0,
        maxTime: Math.max(...executionTimes) || 0,
        result
      }
    }

    this.testResults.push(testResult)
    
    // 输出结果
    const status = success ? '✅' : '❌'
    console.log(`    ${status} ${testName}: ${averageTime.toFixed(2)}ms (${operationsPerSecond?.toFixed(2) || 'N/A'} ops/s)`)
    
    if (!success) {
      console.log(`       错误: ${error}`)
    }

    return testResult
  }

  /**
   * 获取当前内存使用量
   */
  private getCurrentMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory
      return memory.usedJSHeapSize
    }
    
    // 估算内存使用
    return Math.round(this.testResults.length * 1024) // 简化估算
  }

  // ============================================================================
  // 报告生成
  // ============================================================================

  /**
   * 生成性能摘要
   */
  private generatePerformanceSummary(tests: PerformanceTestResult[]): string {
    const successfulTests = tests.filter(t => t.success)
    const failedTests = tests.filter(t => !t.success)
    const avgExecutionTime = tests.reduce((sum, t) => sum + t.executionTime, 0) / tests.length
    const opsPerSecond = tests
      .filter(t => t.operationsPerSecond)
      .reduce((sum, t) => sum + t.operationsPerSecond!, 0) / tests.filter(t => t.operationsPerSecond).length

    return `
📊 性能测试摘要:
==================
✅ 成功测试: ${successfulTests.length}/${tests.length} (${(successfulTests.length / tests.length * 100).toFixed(1)}%)
❌ 失败测试: ${failedTests.length}/${tests.length}
🕐 平均执行时间: ${avgExecutionTime.toFixed(2)}ms
⚡ 平均吞吐量: ${opsPerSecond.toFixed(2)} ops/s

🏆 最佳表现:
${tests
  .filter(t => t.success)
  .sort((a, b) => a.executionTime - b.executionTime)
  .slice(0, 3)
  .map(t => `   ${t.testName}: ${t.executionTime.toFixed(2)}ms`)
  .join('\n')}

⚠️  需要关注:
${failedTests
  .map(t => `   ${t.testName}: ${t.error}`)
  .join('\n')}
    `.trim()
  }

  /**
   * 生成完整性能报告
   */
  generatePerformanceReport(): string {
    const latestSuite = this.benchmarkSuites[this.benchmarkSuites.length - 1]
    const latestLoadTest = this.loadTestResults[this.loadTestResults.length - 1]

    let report = `
# 🚀 本地操作服务性能测试报告

## 📋 测试概览
- 测试时间: ${new Date().toISOString()}
- 测试套件: ${this.benchmarkSuites.length}
- 负载测试: ${this.loadTestResults.length}

## 📊 整体性能指标
`.trim()

    if (latestSuite) {
      report += `
- 成功率: ${(latestSuite.successRate * 100).toFixed(1)}%
- 总执行时间: ${latestSuite.totalTime.toFixed(2)}ms
- 平均响应时间: ${latestSuite.averageTime.toFixed(2)}ms
`.trim()
    }

    report += `

## 🧪 详细测试结果
`.trim()

    if (latestSuite) {
      report += `

### ${latestSuite.name}

| 测试名称 | 状态 | 执行时间(ms) | 吞吐量(ops/s) | 内存使用(MB) |
|---------|------|-------------|---------------|-------------|
${latestSuite.tests
  .map(t => `| ${t.testName} | ${t.success ? '✅' : '❌'} | ${t.executionTime.toFixed(2)} | ${t.operationsPerSecond?.toFixed(2) || 'N/A'} | ${(t.memoryUsage || 0) / 1024 / 1024} |`)
  .join('\n')}
`
    }

    if (latestLoadTest) {
      report += `

## 🏋️ 负载测试结果

### ${latestLoadTest.concurrentUsers} 并发用户测试

| 指标 | 值 |
|------|-----|
| 总操作数 | ${latestLoadTest.totalOperations} |
| 成功率 | ${(latestLoadTest.successRate * 100).toFixed(1)}% |
| 平均响应时间 | ${latestLoadTest.averageResponseTime.toFixed(2)}ms |
| P95响应时间 | ${latestLoadTest.p95ResponseTime.toFixed(2)}ms |
| P99响应时间 | ${latestLoadTest.p99ResponseTime.toFixed(2)}ms |
| 吞吐量 | ${latestLoadTest.throughput.toFixed(2)} ops/s |
| 错误率 | ${(latestLoadTest.errorRate * 100).toFixed(2)}% |
`
    }

    report += `

## 📈 性能分析
`.trim()

    // 分析关键性能指标
    const slowTests = latestSuite?.tests.filter(t => t.success && t.executionTime > 100) || []
    const fastTests = latestSuite?.tests.filter(t => t.success && t.executionTime < 50) || []
    
    if (slowTests.length > 0) {
      report += `

### 🐌 需要优化的操作 (${slowTests.length})
${slowTests.map(t => `- ${t.testName}: ${t.executionTime.toFixed(2)}ms`).join('\n')}
`.trim()
    }

    if (fastTests.length > 0) {
      report += `

### ⚡ 优秀的性能 (${fastTests.length})
${fastTests.map(t => `- ${t.testName}: ${t.executionTime.toFixed(2)}ms`).join('\n')}
`.trim()
    }

    // 目标达成情况
    const targetAchievement = this.analyzeTargetAchievement(latestSuite?.tests || [])
    report += `

## 🎯 目标达成情况

${targetAchievement}

## 💡 优化建议

### 性能优化建议
${this.generateOptimizationSuggestions(latestSuite?.tests || [], latestLoadTest)}

### 缓存优化建议
${this.generateCacheOptimizationSuggestions()}

### 内存优化建议
${this.generateMemoryOptimizationSuggestions()}
`

    return report
  }

  /**
   * 分析目标达成情况
   */
  private analyzeTargetAchievement(tests: PerformanceTestResult[]): string {
    const targetMet: string[] = []
    const targetMissed: string[] = []

    // 检查100ms响应时间目标
    const avgResponseTime = tests.reduce((sum, t) => sum + t.executionTime, 0) / tests.length
    if (avgResponseTime < 100) {
      targetMet.push('✅ 本地操作响应时间 < 100ms (实际: ' + avgResponseTime.toFixed(2) + 'ms)')
    } else {
      targetMissed.push('❌ 本地操作响应时间 > 100ms (实际: ' + avgResponseTime.toFixed(2) + 'ms)')
    }

    // 检查成功率目标
    const successRate = tests.filter(t => t.success).length / tests.length
    if (successRate >= 0.95) {
      targetMet.push('✅ 操作成功率 ≥ 95% (实际: ' + (successRate * 100).toFixed(1) + '%)')
    } else {
      targetMissed.push('❌ 操作成功率 < 95% (实际: ' + (successRate * 100).toFixed(1) + '%)')
    }

    // 检查吞吐量目标
    const avgThroughput = tests
      .filter(t => t.operationsPerSecond)
      .reduce((sum, t) => sum + t.operationsPerSecond!, 0) / tests.filter(t => t.operationsPerSecond).length
    
    if (avgThroughput > 10) {
      targetMet.push('✅ 平均吞吐量 > 10 ops/s (实际: ' + avgThroughput.toFixed(2) + ' ops/s)')
    } else {
      targetMissed.push('❌ 平均吞吐量 < 10 ops/s (实际: ' + avgThroughput.toFixed(2) + ' ops/s)')
    }

    return `
${targetMet.join('\n')}
${targetMissed.join('\n')}
    `.trim()
  }

  /**
   * 生成优化建议
   */
  private generateOptimizationSuggestions(tests: PerformanceTestResult[], loadTest?: LoadTestResult): string {
    const suggestions: string[] = []

    // 基于测试结果的建议
    const slowTests = tests.filter(t => t.success && t.executionTime > 100)
    if (slowTests.length > 0) {
      suggestions.push(`- 考虑优化以下慢操作: ${slowTests.map(t => t.testName).join(', ')}`)
      suggestions.push('- 检查数据库索引是否正确配置')
      suggestions.push('- 考虑实现更高效的查询策略')
    }

    // 基于负载测试的建议
    if (loadTest) {
      if (loadTest.p95ResponseTime > 200) {
        suggestions.push('- P95响应时间较高，考虑优化并发处理')
        suggestions.push('- 实现请求限流和排队机制')
      }
      
      if (loadTest.errorRate > 0.05) {
        suggestions.push('- 错误率较高，需要加强错误处理和重试机制')
      }
    }

    // 通用建议
    suggestions.push('- 定期监控性能指标，及时发现性能退化')
    suggestions.push('- 考虑实现性能基准测试自动化')
    suggestions.push('- 在生产环境中监控实际用户性能体验')

    return suggestions.join('\n')
  }

  /**
   * 生成缓存优化建议
   */
  private generateCacheOptimizationSuggestions(): string {
    const cacheStats = advancedCacheManager.getStats()
    const suggestions: string[] = []

    if (cacheStats.hitRate < 0.8) {
      suggestions.push('- 缓存命中率较低(' + (cacheStats.hitRate * 100).toFixed(1) + '%)，考虑调整缓存策略')
      suggestions.push('- 增加缓存预热机制')
      suggestions.push('- 优化缓存失效策略')
    }

    if (cacheStats.memoryUsage > 50 * 1024 * 1024) { // 50MB
      suggestions.push('- 内存使用量较高，考虑清理不必要的缓存项')
      suggestions.push('- 实现更智能的缓存淘汰策略')
    }

    return suggestions.length > 0 ? suggestions.join('\n') : '- 缓存性能良好，无需优化'
  }

  /**
   * 生成内存优化建议
   */
  private generateMemoryOptimizationSuggestions(): string {
    const suggestions: string[] = []

    suggestions.push('- 定期检查内存泄漏，特别是在长时间运行的场景中')
    suggestions.push('- 实现内存使用监控和告警机制')
    suggestions.push('- 考虑实现数据分页和懒加载')
    suggestions.push('- 定期清理过期数据和缓存')

    return suggestions.join('\n')
  }

  // ============================================================================
  // 初始化和清理
  // ============================================================================

  private initializePerformanceTester(): void {
    // 注册性能监控
    if (typeof performance !== 'undefined') {
      // 可以添加更详细的性能监控
    }
  }

  /**
   * 清理测试数据
   */
  async cleanupTestData(): Promise<void> {
    console.log('🧹 清理测试数据...')
    
    try {
      // 清理测试用户的数据
      await db.cards.where('userId').equals('test-user').delete()
      
      // 清理缓存
      await advancedCacheManager.clear()
      
      // 清理测试结果
      this.testResults = []
      
      console.log('✅ 测试数据清理完成')
    } catch (error) {
      console.error('❌ 清理测试数据失败:', error)
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const performanceTester = new PerformanceTester()

// ============================================================================
// 便利方法导出
// ============================================================================

export const runPerformanceSuite = () => performanceTester.runFullPerformanceSuite()
export const runLoadTest = (users?: number, duration?: number) => 
  performanceTester.runLoadTest(users, duration)
export const generatePerformanceReport = () => performanceTester.generatePerformanceReport()
export const cleanupTestData = () => performanceTester.cleanupTestData()