/**
 * LocalOperationService 性能测试
 * 验证本地操作响应时间和性能指标
 */

import { localOperationServiceOptimized } from '../src/services/local-operation-service'
import { db } from '../src/services/database-unified'

// ============================================================================
// 测试配置
// ============================================================================

interface TestConfig {
  iterations: number
  batchSize: number
  testData: any[]
}

interface TestResult {
  operation: string
  totalDuration: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  successRate: number
  withinThreshold: boolean
}

// ============================================================================
// 测试数据生成器
// ============================================================================

class TestDataGenerator {
  static generateCardData(count: number = 1) {
    const cards = []
    
    for (let i = 0; i < count; i++) {
      cards.push({
        frontContent: {
          title: `Test Card ${i + 1}`,
          text: `This is test card number ${i + 1} with some sample content.`,
          tags: [`tag${i % 5}`, `test`, `generated`]
        },
        backContent: {
          title: `Back ${i + 1}`,
          text: `Back content for card ${i + 1}`,
          tags: [`back${i % 3}`, `test`]
        },
        style: {
          type: ['solid', 'gradient', 'glass'][Math.floor(Math.random() * 3)],
          colors: ['#ff6b6b', '#4ecdc4', '#45b7d1']
        },
        userId: 'test_user'
      })
    }
    
    return cards
  }
  
  static generateSearchTerms(count: number = 10): string[] {
    const terms = [
      'test', 'card', 'content', 'back', 'front', 'title', 
      'sample', 'generated', 'data', 'performance'
    ]
    
    const searchTerms = []
    for (let i = 0; i < count; i++) {
      searchTerms.push(terms[Math.floor(Math.random() * terms.length)])
    }
    
    return searchTerms
  }
}

// ============================================================================
// 性能测试执行器
// ============================================================================

class PerformanceTestRunner {
  private results: TestResult[] = []
  private thresholdMs = 100 // 100ms 阈值

  async runAllTests(): Promise<TestResult[]> {
    console.log('🚀 开始 LocalOperationService 性能测试...')
    
    // 确保数据库初始化
    await db.open()
    
    // 运行所有测试
    await this.testCreateCard()
    await this.testUpdateCard()
    await this.testDeleteCard()
    await this.testBulkCreate()
    await this.testGetCards()
    await this.testSearchCards()
    
    // 输出测试结果
    this.printResults()
    
    return this.results
  }

  private async testCreateCard(): Promise<void> {
    console.log('\n📝 测试创建卡片性能...')
    
    const testData = TestDataGenerator.generateCardData(50)
    const durations: number[] = []
    let successCount = 0
    
    for (const cardData of testData) {
      const startTime = performance.now()
      
      try {
        const result = await localOperationServiceOptimized.createCard(cardData)
        const duration = performance.now() - startTime
        
        durations.push(duration)
        if (result.success) successCount++
        
        // 清理测试数据
        if (result.success && result.id) {
          await db.cards.delete(result.id)
        }
      } catch (error) {
        const duration = performance.now() - startTime
        durations.push(duration)
        console.error(`Create card failed:`, error)
      }
    }
    
    this.addTestResult('createCard', durations, successCount, testData.length)
  }

  private async testUpdateCard(): Promise<void> {
    console.log('\n✏️ 测试更新卡片性能...')
    
    // 先创建测试卡片
    const testCard = await localOperationServiceOptimized.createCard(
      TestDataGenerator.generateCardData(1)[0]
    )
    
    if (!testCard.success || !testCard.id) {
      console.error('无法创建测试卡片进行更新测试')
      return
    }
    
    const durations: number[] = []
    let successCount = 0
    
    for (let i = 0; i < 50; i++) {
      const startTime = performance.now()
      
      try {
        const result = await localOperationServiceOptimized.updateCard(testCard.id, {
          frontContent: {
            title: `Updated Title ${i}`,
            text: `Updated content ${i}`
          }
        })
        const duration = performance.now() - startTime
        
        durations.push(duration)
        if (result.success) successCount++
      } catch (error) {
        const duration = performance.now() - startTime
        durations.push(duration)
        console.error(`Update card failed:`, error)
      }
    }
    
    // 清理测试数据
    await db.cards.delete(testCard.id)
    
    this.addTestResult('updateCard', durations, successCount, 50)
  }

  private async testDeleteCard(): Promise<void> {
    console.log('\n🗑️ 测试删除卡片性能...')
    
    // 先创建测试卡片
    const testCards: any[] = []
    for (let i = 0; i < 50; i++) {
      const result = await localOperationServiceOptimized.createCard(
        TestDataGenerator.generateCardData(1)[0]
      )
      if (result.success && result.id) {
        testCards.push(result)
      }
    }
    
    const durations: number[] = []
    let successCount = 0
    
    for (const card of testCards) {
      const startTime = performance.now()
      
      try {
        const result = await localOperationServiceOptimized.deleteCard(card.id)
        const duration = performance.now() - startTime
        
        durations.push(duration)
        if (result.success) successCount++
      } catch (error) {
        const duration = performance.now() - startTime
        durations.push(duration)
        console.error(`Delete card failed:`, error)
      }
    }
    
    this.addTestResult('deleteCard', durations, successCount, testCards.length)
  }

  private async testBulkCreate(): Promise<void> {
    console.log('\n📦 测试批量创建卡片性能...')
    
    const batchSizes = [10, 25, 50]
    
    for (const batchSize of batchSizes) {
      const testData = TestDataGenerator.generateCardData(batchSize)
      const durations: number[] = []
      
      for (let i = 0; i < 10; i++) { // 每个批次大小测试10次
        const startTime = performance.now()
        
        try {
          const results = await localOperationServiceOptimized.bulkCreateCards(testData)
          const duration = performance.now() - startTime
          
          durations.push(duration)
          
          // 清理测试数据
          for (const result of results) {
            if (result.success && result.id) {
              await db.cards.delete(result.id)
            }
          }
        } catch (error) {
          const duration = performance.now() - startTime
          durations.push(duration)
          console.error(`Bulk create failed:`, error)
        }
      }
      
      this.addTestResult(`bulkCreate_${batchSize}`, durations, durations.length, durations.length)
    }
  }

  private async testGetCards(): Promise<void> {
    console.log('\n📋 测试获取卡片列表性能...')
    
    // 创建一些测试数据
    const testData = TestDataGenerator.generateCardData(100)
    const createdCards: any[] = []
    
    for (const cardData of testData) {
      const result = await localOperationServiceOptimized.createCard(cardData)
      if (result.success && result.id) {
        createdCards.push(result)
      }
    }
    
    const durations: number[] = []
    const testOptions = [
      { limit: 10 },
      { limit: 50 },
      { limit: 100 },
      { folderId: createdCards[0]?.id ? 'test_folder' : undefined, limit: 25 }
    ]
    
    for (const options of testOptions) {
      const startTime = performance.now()
      
      try {
        await localOperationServiceOptimized.getCards(options)
        const duration = performance.now() - startTime
        durations.push(duration)
      } catch (error) {
        const duration = performance.now() - startTime
        durations.push(duration)
        console.error(`Get cards failed:`, error)
      }
    }
    
    // 清理测试数据
    for (const card of createdCards) {
      await db.cards.delete(card.id)
    }
    
    this.addTestResult('getCards', durations, durations.length, durations.length)
  }

  private async testSearchCards(): Promise<void> {
    console.log('\n🔍 测试搜索卡片性能...')
    
    // 创建测试数据
    const testData = TestDataGenerator.generateCardData(50)
    const createdCards: any[] = []
    
    for (const cardData of testData) {
      const result = await localOperationServiceOptimized.createCard(cardData)
      if (result.success && result.id) {
        createdCards.push(result)
      }
    }
    
    const searchTerms = TestDataGenerator.generateSearchTerms(20)
    const durations: number[] = []
    
    for (const searchTerm of searchTerms) {
      const startTime = performance.now()
      
      try {
        await localOperationServiceOptimized.searchCards({
          term: searchTerm,
          limit: 25
        })
        const duration = performance.now() - startTime
        durations.push(duration)
      } catch (error) {
        const duration = performance.now() - startTime
        durations.push(duration)
        console.error(`Search cards failed:`, error)
      }
    }
    
    // 清理测试数据
    for (const card of createdCards) {
      await db.cards.delete(card.id)
    }
    
    this.addTestResult('searchCards', durations, durations.length, durations.length)
  }

  private addTestResult(operation: string, durations: number[], successCount: number, totalCount: number): void {
    const totalDuration = durations.reduce((sum, d) => sum + d, 0)
    const averageDuration = totalDuration / durations.length
    const minDuration = Math.min(...durations)
    const maxDuration = Math.max(...durations)
    const successRate = successCount / totalCount
    
    const result: TestResult = {
      operation,
      totalDuration,
      averageDuration,
      minDuration,
      maxDuration,
      successRate,
      withinThreshold: averageDuration <= this.thresholdMs
    }
    
    this.results.push(result)
  }

  private printResults(): void {
    console.log('\n📊 性能测试结果:')
    console.log('='.repeat(80))
    
    const header = '| 操作类型               | 平均时间 | 最小时间 | 最大时间 | 成功率 | 达标 |'
    console.log(header)
    console.log('|' + '-'.repeat(78) + '|')
    
    for (const result of this.results) {
      const status = result.withinThreshold ? '✅' : '❌'
      const row = `| ${result.operation.padEnd(22)} | ${result.averageDuration.toFixed(2).padStart(8)}ms | ${result.minDuration.toFixed(2).padStart(8)}ms | ${result.maxDuration.toFixed(2).padStart(8)}ms | ${(result.successRate * 100).toFixed(1).padStart(5)}% | ${status.padEnd(4)} |`
      console.log(row)
    }
    
    console.log('\n📈 总体统计:')
    const avgTime = this.results.reduce((sum, r) => sum + r.averageDuration, 0) / this.results.length
    const overallSuccessRate = this.results.reduce((sum, r) => sum + r.successRate, 0) / this.results.length
    const passCount = this.results.filter(r => r.withinThreshold).length
    
    console.log(`平均响应时间: ${avgTime.toFixed(2)}ms`)
    console.log(`总体成功率: ${(overallSuccessRate * 100).toFixed(1)}%`)
    console.log(`达标操作数: ${passCount}/${this.results.length}`)
    console.log(`达标率: ${(passCount / this.results.length * 100).toFixed(1)}%`)
    
    console.log('\n🎯 性能目标验证:')
    if (avgTime <= 50) {
      console.log('✅ 平均响应时间 < 50ms: 达标')
    } else {
      console.log(`❌ 平均响应时间 < 50ms: 未达标 (实际: ${avgTime.toFixed(2)}ms)`)
    }
    
    if (overallSuccessRate >= 0.99) {
      console.log('✅ 成功率 >= 99%: 达标')
    } else {
      console.log(`❌ 成功率 >= 99%: 未达标 (实际: ${(overallSuccessRate * 100).toFixed(1)}%)`)
    }
    
    if (passCount === this.results.length) {
      console.log('✅ 所有操作响应时间 < 100ms: 达标')
    } else {
      console.log(`❌ 所有操作响应时间 < 100ms: 未达标 (达标: ${passCount}/${this.results.length})`)
    }
  }
}

// ============================================================================
// 内存使用测试
// ============================================================================

class MemoryUsageTest {
  async runMemoryTest(): Promise<void> {
    console.log('\n💾 内存使用测试...')
    
    // 获取初始内存使用
    const initialMemory = this.getMemoryUsage()
    console.log(`初始内存使用: ${(initialMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    
    // 执行大量操作
    const testData = TestDataGenerator.generateCardData(1000)
    const startTime = performance.now()
    
    const createdCards: any[] = []
    for (const cardData of testData) {
      const result = await localOperationServiceOptimized.createCard(cardData)
      if (result.success && result.id) {
        createdCards.push(result)
      }
    }
    
    // 获取峰值内存使用
    const peakMemory = this.getMemoryUsage()
    console.log(`峰值内存使用: ${(peakMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    
    // 清理数据
    for (const card of createdCards) {
      await db.cards.delete(card.id)
    }
    
    // 获取清理后内存使用
    const finalMemory = this.getMemoryUsage()
    console.log(`清理后内存使用: ${(finalMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    
    const memoryIncrease = peakMemory.usedJSHeapSize - initialMemory.usedJSHeapSize
    console.log(`内存增长: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`)
    
    const duration = performance.now() - startTime
    console.log(`创建1000张卡片耗时: ${duration.toFixed(2)}ms`)
    console.log(`平均每张卡片耗时: ${(duration / 1000).toFixed(2)}ms`)
    
    // 验证内存使用目标
    if (memoryIncrease < 50 * 1024 * 1024) { // 50MB
      console.log('✅ 内存使用增长 < 50MB: 达标')
    } else {
      console.log(`❌ 内存使用增长 < 50MB: 未达标 (实际: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB)`)
    }
  }
  
  private getMemoryUsage() {
    if ('memory' in performance) {
      return (performance as any).memory
    }
    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0
    }
  }
}

// ============================================================================
// 并发性能测试
// ============================================================================

class ConcurrencyTest {
  async runConcurrencyTest(): Promise<void> {
    console.log('\n⚡ 并发性能测试...')
    
    const concurrentOperations = 50
    const testData = TestDataGenerator.generateCardData(concurrentOperations)
    
    const startTime = performance.now()
    
    // 并发执行创建操作
    const promises = testData.map(cardData => 
      localOperationServiceOptimized.createCard(cardData)
    )
    
    const results = await Promise.all(promises)
    const duration = performance.now() - startTime
    
    const successCount = results.filter(r => r.success).length
    const averageTime = duration / concurrentOperations
    
    console.log(`并发创建${concurrentOperations}张卡片耗时: ${duration.toFixed(2)}ms`)
    console.log(`平均每张卡片耗时: ${averageTime.toFixed(2)}ms`)
    console.log(`成功率: ${(successCount / concurrentOperations * 100).toFixed(1)}%`)
    
    // 清理测试数据
    for (const result of results) {
      if (result.success && result.id) {
        await db.cards.delete(result.id)
      }
    }
    
    // 验证并发性能目标
    if (averageTime <= 100) {
      console.log('✅ 并发操作平均时间 < 100ms: 达标')
    } else {
      console.log(`❌ 并发操作平均时间 < 100ms: 未达标 (实际: ${averageTime.toFixed(2)}ms)`)
    }
  }
}

// ============================================================================
// 小数据集优化测试
// ============================================================================

class SmallDatasetOptimizationTest {
  async runSmallDatasetTest(): Promise<void> {
    console.log('\n📊 小数据集优化测试...')
    
    // 创建小数据集测试数据 (9 cards, 8 folders, 13 tags)
    const smallCards = TestDataGenerator.generateCardData(9)
    const createdCards: any[] = []
    
    console.log('创建小数据集测试数据...')
    for (const cardData of smallCards) {
      const result = await localOperationServiceOptimized.createCard(cardData)
      if (result.success && result.id) {
        createdCards.push(result)
      }
    }
    
    console.log(`✅ 创建了 ${createdCards.length} 张测试卡片`)
    
    // 测试小数据集查询性能
    const queryTestResults = await this.testQueryPerformance(createdCards)
    
    // 测试内存缓存效果
    const cacheTestResults = await this.testCacheEffectiveness(createdCards)
    
    // 测试搜索性能
    const searchTestResults = await this.testSearchPerformance(createdCards)
    
    // 清理测试数据
    console.log('清理小数据集测试数据...')
    for (const card of createdCards) {
      await db.cards.delete(card.id)
    }
    
    // 输出综合结果
    console.log('\n📈 小数据集优化测试结果:')
    console.log(`查询性能: ${queryTestResults.averageQueryTime.toFixed(2)}ms (目标: < 10ms) ${queryTestResults.passed ? '✅' : '❌'}`)
    console.log(`缓存命中率: ${(cacheTestResults.hitRate * 100).toFixed(1)}% (目标: > 90%) ${cacheTestResults.passed ? '✅' : '❌'}`)
    console.log(`搜索性能: ${searchTestResults.averageSearchTime.toFixed(2)}ms (目标: < 15ms) ${searchTestResults.passed ? '✅' : '❌'}`)
    
    const allPassed = queryTestResults.passed && cacheTestResults.passed && searchTestResults.passed
    console.log(`\n小数据集优化总体: ${allPassed ? '✅ 通过' : '❌ 未通过'}`)
    
    return allPassed
  }
  
  private async testQueryPerformance(cards: any[]): Promise<{
    averageQueryTime: number
    passed: boolean
  }> {
    console.log('测试小数据集查询性能...')
    
    const queryTimes: number[] = []
    const testIterations = 20
    
    for (let i = 0; i < testIterations; i++) {
      const startTime = performance.now()
      
      try {
        await localOperationServiceOptimized.getCards({ limit: 9 })
        const queryTime = performance.now() - startTime
        queryTimes.push(queryTime)
      } catch (error) {
        console.warn(`查询测试 ${i + 1} 失败:`, error)
      }
    }
    
    const averageQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length
    const passed = averageQueryTime < 10 // 目标: 小于10ms
    
    console.log(`平均查询时间: ${averageQueryTime.toFixed(2)}ms`)
    
    return { averageQueryTime, passed }
  }
  
  private async testCacheEffectiveness(cards: any[]): Promise<{
    hitRate: number
    passed: boolean
  }> {
    console.log('测试小数据集缓存效果...')
    
    let cacheHits = 0
    const totalQueries = 15
    
    // 首次查询 (缓存未命中)
    await localOperationServiceOptimized.getCards({ limit: 9 })
    
    // 重复查询 (测试缓存命中)
    for (let i = 0; i < totalQueries; i++) {
      const startTime = performance.now()
      
      try {
        await localOperationServiceOptimized.getCards({ limit: 9 })
        const queryTime = performance.now() - startTime
        
        // 如果查询时间小于1ms，认为是缓存命中
        if (queryTime < 1) {
          cacheHits++
        }
      } catch (error) {
        console.warn(`缓存测试 ${i + 1} 失败:`, error)
      }
    }
    
    const hitRate = cacheHits / totalQueries
    const passed = hitRate > 0.9 // 目标: 大于90%
    
    console.log(`缓存命中率: ${(hitRate * 100).toFixed(1)}%`)
    
    return { hitRate, passed }
  }
  
  private async testSearchPerformance(cards: any[]): Promise<{
    averageSearchTime: number
    passed: boolean
  }> {
    console.log('测试小数据集搜索性能...')
    
    const searchTerms = ['test', 'card', 'content', 'title', 'back']
    const searchTimes: number[] = []
    
    for (const term of searchTerms) {
      const startTime = performance.now()
      
      try {
        await localOperationServiceOptimized.searchCards({
          term,
          limit: 10
        })
        const searchTime = performance.now() - startTime
        searchTimes.push(searchTime)
      } catch (error) {
        console.warn(`搜索测试失败:`, error)
      }
    }
    
    const averageSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length
    const passed = averageSearchTime < 15 // 目标: 小于15ms
    
    console.log(`平均搜索时间: ${averageSearchTime.toFixed(2)}ms`)
    
    return { averageSearchTime, passed }
  }
}

// ============================================================================
// 主测试入口
// ============================================================================

export async function runLocalOperationPerformanceTests(): Promise<void> {
  console.log('🧪 LocalOperationService 性能测试开始')
  console.log('='.repeat(80))
  
  try {
    // 运行基础性能测试
    const testRunner = new PerformanceTestRunner()
    await testRunner.runAllTests()
    
    // 运行内存使用测试
    const memoryTest = new MemoryUsageTest()
    await memoryTest.runMemoryTest()
    
    // 运行并发性能测试
    const concurrencyTest = new ConcurrencyTest()
    await concurrencyTest.runConcurrencyTest()
    
    // 运行小数据集优化测试
    const smallDatasetTest = new SmallDatasetOptimizationTest()
    await smallDatasetTest.runSmallDatasetTest()
    
    console.log('\n🎉 所有性能测试完成!')
    
  } catch (error) {
    console.error('\n❌ 性能测试失败:', error)
  }
}

// 如果直接运行此文件，执行测试
if (typeof window !== 'undefined') {
  // 浏览器环境
  (window as any).runLocalOperationPerformanceTests = runLocalOperationPerformanceTests
} else if (typeof process !== 'undefined') {
  // Node.js环境
  runLocalOperationPerformanceTests().catch(console.error)
}