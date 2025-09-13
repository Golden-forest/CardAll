/**
 * 小数据集优化系统使用示例
 * 展示如何集成和使用小数据集优化功能
 */

import { 
  initializeSmallDatasetOptimization, 
  getCardsOptimized, 
  searchOptimized, 
  getSmallDatasetStatus,
  refreshSmallDatasetOptimization
} from '../services/small-dataset-controller'
import { smallDatasetOptimizer } from '../services/small-dataset-optimizer'
import { smallDatasetCache } from '../services/small-dataset-cache'

// ============================================================================
// 示例1: 基础使用
// ============================================================================

export async function basicUsageExample() {
  console.log('📚 基础使用示例')
  
  try {
    // 1. 初始化优化系统
    console.log('1. 初始化小数据集优化系统...')
    await initializeSmallDatasetOptimization()
    
    // 2. 执行优化查询
    console.log('2. 执行优化查询...')
    const cardsResult = await getCardsOptimized({
      userId: 'test_user',
      limit: 10,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    })
    
    console.log(`查询结果: ${cardsResult.data.length} 张卡片`)
    console.log(`查询时间: ${cardsResult.queryTime.toFixed(2)}ms`)
    console.log(`缓存命中: ${cardsResult.cacheHit ? '是' : '否'}`)
    
    // 3. 执行优化搜索
    console.log('3. 执行优化搜索...')
    const searchResult = await searchOptimized('JavaScript', {
      type: 'cards',
      limit: 5
    })
    
    console.log(`搜索结果: ${searchResult.cards.length} 张卡片`)
    console.log(`搜索时间: ${searchResult.searchTime.toFixed(2)}ms`)
    console.log(`缓存命中: ${searchResult.cacheHit ? '是' : '否'}`)
    
  } catch (error) {
    console.error('基础使用示例失败:', error)
  }
}

// ============================================================================
// 示例2: 高级缓存操作
// ============================================================================

export async function advancedCacheExample() {
  console.log('🔧 高级缓存操作示例')
  
  try {
    // 1. 预加载数据到缓存
    console.log('1. 预加载数据...')
    const dataProvider = {
      getCards: async () => {
        // 模拟获取卡片数据
        return [
          {
            id: 'card_1',
            frontContent: { title: 'JavaScript基础', text: 'JS基础概念' },
            backContent: { title: '基础语法', text: '变量、函数、对象' },
            userId: 'test_user'
          }
        ]
      },
      getFolders: async () => [],
      getTags: async () => []
    }
    
    await smallDatasetCache.preloadData(dataProvider)
    
    // 2. 自定义缓存操作
    console.log('2. 自定义缓存操作...')
    
    // 设置缓存
    await smallDatasetCache.set('custom_key', { data: '自定义数据' }, 60000)
    
    // 获取缓存
    const cachedData = await smallDatasetCache.get('custom_key')
    console.log('缓存数据:', cachedData)
    
    // 3. 获取缓存统计
    console.log('3. 缓存统计信息...')
    const stats = smallDatasetCache.getStats()
    console.log(`缓存命中率: ${(stats.hitRate * 100).toFixed(1)}%`)
    console.log(`缓存大小: ${stats.size} 项`)
    
    // 4. 缓存健康检查
    console.log('4. 缓存健康检查...')
    const health = await smallDatasetCache.healthCheck()
    console.log('缓存健康状态:', health.healthy ? '健康' : '需要关注')
    if (!health.healthy) {
      console.log('问题:', health.issues)
      console.log('建议:', health.recommendations)
    }
    
  } catch (error) {
    console.error('高级缓存示例失败:', error)
  }
}

// ============================================================================
// 示例3: 性能监控
// ============================================================================

export async function performanceMonitoringExample() {
  console.log('📊 性能监控示例')
  
  try {
    // 1. 获取系统状态
    console.log('1. 获取系统状态...')
    const status = await getSmallDatasetStatus()
    
    console.log('系统状态:')
    console.log(`- 初始化状态: ${status.initialized ? '已初始化' : '未初始化'}`)
    console.log(`- 数据集大小: ${status.datasetSize.total} 项`)
    console.log(`- 缓存大小: ${status.cache.size} 项`)
    console.log(`- 缓存命中率: ${(status.cache.hitRate * 100).toFixed(1)}%`)
    
    // 2. 性能指标分析
    console.log('2. 性能指标分析...')
    const perf = status.performance
    console.log('性能指标:')
    console.log(`- 优化分数: ${perf.optimizationScore}/100`)
    console.log(`- 平均查询时间: ${perf.queryTime.toFixed(2)}ms`)
    console.log(`- 平均搜索时间: ${perf.searchTime.toFixed(2)}ms`)
    console.log(`- 缓存命中率: ${(perf.cacheHitRate * 100).toFixed(1)}%`)
    
    // 3. 性能评估
    console.log('3. 性能评估...')
    if (perf.optimizationScore >= 90) {
      console.log('✅ 性能优秀: 优化系统运行良好')
    } else if (perf.optimizationScore >= 70) {
      console.log('⚠️ 性能良好: 有提升空间')
    } else {
      console.log('❌ 性能需要改进: 建议进行优化')
    }
    
    // 4. 健康检查
    console.log('4. 系统健康检查...')
    const health = status.health
    if (health.healthy) {
      console.log('✅ 系统健康: 无异常')
    } else {
      console.log('❌ 系统异常:')
      health.issues.forEach(issue => console.log(`  - ${issue}`))
      console.log('建议:')
      health.recommendations.forEach(rec => console.log(`  - ${rec}`))
    }
    
  } catch (error) {
    console.error('性能监控示例失败:', error)
  }
}

// ============================================================================
// 示例4: 数据集优化器使用
// ============================================================================

export async function datasetOptimizerExample() {
  console.log('🎯 数据集优化器使用示例')
  
  try {
    // 1. 分析数据集特征
    console.log('1. 分析数据集特征...')
    const metrics = await smallDatasetOptimizer.analyzeDataset()
    
    console.log('数据集分析结果:')
    console.log(`- 卡片数量: ${metrics.cards.count}`)
    console.log(`- 文件夹数量: ${metrics.folders.count}`)
    console.log(`- 标签数量: ${metrics.tags.count}`)
    console.log(`- 总记录数: ${metrics.cards.count + metrics.folders.count + metrics.tags.count}`)
    
    // 2. 预加载数据
    console.log('2. 预加载数据到内存...')
    await smallDatasetOptimizer.preloadAllData()
    
    // 3. 即时搜索测试
    console.log('3. 即时搜索测试...')
    const searchResults = await smallDatasetOptimizer.instantSearch('JavaScript', {
      type: 'cards',
      limit: 5
    })
    
    console.log(`搜索结果: ${searchResults.cards.length} 张卡片`)
    
    // 4. 获取关联数据
    console.log('4. 获取关联数据...')
    if (searchResults.cards.length > 0) {
      const relatedData = await smallDatasetOptimizer.getRelatedData(
        searchResults.cards[0].id,
        'card'
      )
      console.log(`相关卡片: ${relatedData.cards.length} 张`)
      console.log(`相关标签: ${relatedData.tags.length} 个`)
    }
    
    // 5. 获取优化策略
    console.log('5. 当前优化策略...')
    const strategies = smallDatasetOptimizer.getStrategies()
    strategies.forEach(strategy => {
      if (strategy.enabled) {
        console.log(`✅ ${strategy.name}: ${strategy.description}`)
        console.log(`   性能提升: 查询 ${strategy.performance.queryImprovement}%`)
      }
    })
    
  } catch (error) {
    console.error('数据集优化器示例失败:', error)
  }
}

// ============================================================================
// 示例5: 实时数据更新处理
// ============================================================================

export async function realtimeDataUpdateExample() {
  console.log('⚡ 实时数据更新处理示例')
  
  try {
    // 1. 模拟数据更新
    console.log('1. 模拟数据更新...')
    
    // 添加新卡片（在实际应用中，这将触发缓存更新）
    const newCard = {
      frontContent: {
        title: '新添加的卡片',
        text: '这是一个新添加的测试卡片',
        tags: ['测试', '新卡片']
      },
      backContent: {
        title: '卡片背面',
        text: '卡片背面的内容',
        tags: ['测试']
      },
      userId: 'test_user'
    }
    
    console.log('添加新卡片:', newCard.frontContent.title)
    
    // 2. 刷新优化系统
    console.log('2. 刷新优化系统...')
    await refreshSmallDatasetOptimization()
    
    // 3. 验证更新后的查询
    console.log('3. 验证更新后的查询...')
    const updatedResult = await getCardsOptimized({
      userId: 'test_user',
      limit: 20
    })
    
    console.log(`更新后查询结果: ${updatedResult.data.length} 张卡片`)
    console.log(`查询时间: ${updatedResult.queryTime.toFixed(2)}ms`)
    
    // 4. 测试新数据的搜索
    console.log('4. 测试新数据搜索...')
    const newSearchResult = await searchOptimized('新添加', {
      type: 'cards',
      limit: 5
    })
    
    console.log(`新数据搜索结果: ${newSearchResult.cards.length} 张卡片`)
    
  } catch (error) {
    console.error('实时数据更新示例失败:', error)
  }
}

// ============================================================================
// 主函数：运行所有示例
// ============================================================================

export async function runAllExamples() {
  console.log('🚀 运行小数据集优化系统完整示例')
  console.log('='.repeat(80))
  
  try {
    // 运行各个示例
    await basicUsageExample()
    console.log('\n' + '='.repeat(80))
    
    await advancedCacheExample()
    console.log('\n' + '='.repeat(80))
    
    await performanceMonitoringExample()
    console.log('\n' + '='.repeat(80))
    
    await datasetOptimizerExample()
    console.log('\n' + '='.repeat(80))
    
    await realtimeDataUpdateExample()
    
    console.log('\n🎉 所有示例运行完成!')
    
  } catch (error) {
    console.error('示例运行失败:', error)
  }
}

// ============================================================================
// 导出函数供外部调用
// ============================================================================

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
  (window as any).SmallDatasetOptimizationExamples = {
    basicUsageExample,
    advancedCacheExample,
    performanceMonitoringExample,
    datasetOptimizerExample,
    realtimeDataUpdateExample,
    runAllExamples
  }
}

// 如果在Node.js环境中运行
if (typeof process !== 'undefined' && process.argv?.includes('run-examples')) {
  runAllExamples().catch(console.error)
}