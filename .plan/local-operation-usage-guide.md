# LocalOperationService 使用指南

## 🚀 快速开始

### 基础使用

```typescript
import { 
  localOperationServiceOptimized,
  createCardLocal,
  updateCardLocal,
  deleteCardLocal,
  getCardsLocal,
  searchCardsLocal
} from '@/services/local-operation-service'

// 1. 创建卡片
const createResult = await localOperationServiceOptimized.createCard({
  frontContent: {
    title: '我的第一张卡片',
    text: '这是卡片正面内容',
    tags: ['学习', '重要']
  },
  backContent: {
    title: '背面内容',
    text: '这是卡片背面内容',
    tags: ['复习']
  },
  userId: 'user123'
})

if (createResult.success) {
  console.log('卡片创建成功:', createResult.id)
  console.log('响应时间:', createResult.duration, 'ms')
}

// 2. 更新卡片
if (createResult.id) {
  const updateResult = await localOperationServiceOptimized.updateCard(createResult.id, {
    frontContent: {
      title: '更新后的标题',
      text: '更新后的内容'
    }
  })
  
  if (updateResult.success) {
    console.log('卡片更新成功')
  }
}

// 3. 查询卡片
const cards = await localOperationServiceOptimized.getCards({
  userId: 'user123',
  limit: 20,
  sortBy: 'updatedAt',
  sortOrder: 'desc'
})

console.log('获取到', cards.length, '张卡片')

// 4. 搜索卡片
const searchResults = await localOperationServiceOptimized.searchCards({
  term: '学习',
  userId: 'user123',
  limit: 10
})

console.log('搜索到', searchResults.length, '张相关卡片')
```

### 批量操作

```typescript
// 批量创建卡片
const cardData = [
  {
    frontContent: { title: '卡片1', text: '内容1', tags: ['标签1'] },
    backContent: { title: '背面1', text: '内容1', tags: ['背面'] },
    userId: 'user123'
  },
  {
    frontContent: { title: '卡片2', text: '内容2', tags: ['标签2'] },
    backContent: { title: '背面2', text: '内容2', tags: ['背面'] },
    userId: 'user123'
  }
]

const batchResults = await localOperationServiceOptimized.bulkCreateCards(cardData)

const successCount = batchResults.filter(r => r.success).length
console.log(`批量创建完成: ${successCount}/${batchResults.length} 成功`)

// 批量删除
for (const result of batchResults) {
  if (result.success && result.id) {
    await localOperationServiceOptimized.deleteCard(result.id)
  }
}
```

## 📊 性能监控

### 获取性能指标

```typescript
// 获取基础性能指标
const metrics = await localOperationServiceOptimized.getPerformanceMetrics()

console.log('性能指标:', {
  totalOperations: metrics.totalOperations,
  averageResponseTime: metrics.averageResponseTime.toFixed(2) + 'ms',
  successRate: (metrics.successRate * 100).toFixed(1) + '%',
  cacheHitRate: (metrics.cacheHitRate * 100).toFixed(1) + '%',
  queueSize: metrics.queueSize
})

// 获取详细统计信息
const detailedStats = await localOperationServiceOptimized.getDetailedStats()

console.log('详细统计:', {
  performance: detailedStats.performance,
  cache: detailedStats.cache,
  queue: detailedStats.queue
})
```

### 监控代码示例

```typescript
// 设置定期性能监控
setInterval(async () => {
  const metrics = await localOperationServiceOptimized.getPerformanceMetrics()
  
  // 性能警告
  if (metrics.averageResponseTime > 100) {
    console.warn('⚠️ 平均响应时间过高:', metrics.averageResponseTime.toFixed(2) + 'ms')
  }
  
  // 成功率警告
  if (metrics.successRate < 0.95) {
    console.warn('⚠️ 操作成功率过低:', (metrics.successRate * 100).toFixed(1) + '%')
  }
  
  // 队列积压警告
  if (metrics.queueSize > 100) {
    console.warn('⚠️ 同步队列积压:', metrics.queueSize)
  }
  
}, 30000) // 每30秒检查一次
```

## 🔧 高级功能

### 1. 缓存管理

```typescript
// 手动清除缓存
localOperationServiceOptimized.clearCache()

// 清除特定缓存
localOperationServiceOptimized.cacheManager.invalidate('cards')
localOperationServiceOptimized.cacheManager.invalidate('folder_123')

// 获取缓存统计
const cacheStats = localOperationServiceOptimized.cacheManager.getStats()
console.log('缓存统计:', cacheStats)
```

### 2. 同步队列管理

```typescript
// 获取待同步操作
const pendingOperations = await localOperationServiceOptimized.getPendingSyncOperations()

console.log('待同步操作数:', pendingOperations.length)

// 按优先级分组
const byPriority = pendingOperations.reduce((acc, op) => {
  acc[op.priority] = (acc[op.priority] || 0) + 1
  return acc
}, {} as Record<string, number>)

console.log('按优先级分布:', byPriority)

// 手动触发同步处理
if (pendingOperations.length > 0) {
  console.log('发现待同步操作，准备处理...')
  // 同步处理逻辑在服务内部自动进行
}
```

### 3. 错误处理和重试

```typescript
// 带重试的操作
async function safeCreateCard(cardData: any, maxRetries = 3): Promise<LocalOperationResult> {
  let lastError: Error | null = null
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await localOperationServiceOptimized.createCard(cardData)
      if (result.success) {
        return result
      }
      lastError = new Error(result.error || 'Unknown error')
    } catch (error) {
      lastError = error as Error
    }
    
    // 指数退避
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
    }
  }
  
  return {
    success: false,
    error: lastError?.message || 'Max retries exceeded',
    duration: 0,
    timestamp: new Date()
  }
}
```

## 🎯 最佳实践

### 1. 性能优化

```typescript
// ✅ 使用批量操作减少数据库调用
const batchResults = await localOperationServiceOptimized.bulkCreateCards(cardDataArray)

// ✅ 合理使用缓存
const cards = await localOperationServiceOptimized.getCards({ userId: 'user123', limit: 20 })

// ✅ 使用搜索过滤而非获取全部
const searchResults = await localOperationServiceOptimized.searchCards({
  term: '重要',
  userId: 'user123'
})

// ❌ 避免频繁的同步操作
// await Promise.all(cardDataArray.map(data => createCardLocal(data))) // 性能较差
// 改为使用批量操作
```

### 2. 错误处理

```typescript
// ✅ 完整的错误处理
async function handleCardOperation() {
  try {
    const result = await localOperationServiceOptimized.createCard(cardData)
    
    if (result.success) {
      // 成功处理
      showSuccessMessage('卡片创建成功')
      return result.id
    } else {
      // 失败处理
      showErrorMessage('卡片创建失败: ' + result.error)
      return null
    }
  } catch (error) {
    // 异常处理
    console.error('创建卡片时发生异常:', error)
    showErrorMessage('系统错误，请稍后重试')
    return null
  }
}
```

### 3. 状态管理

```typescript
// 在 React/Vue 组件中的使用示例
import { useState, useEffect } from 'react'

function CardManager() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState(null)
  
  // 加载卡片
  const loadCards = async () => {
    setLoading(true)
    try {
      const cardList = await localOperationServiceOptimized.getCards({
        userId: currentUser.id,
        limit: 50
      })
      setCards(cardList)
    } catch (error) {
      console.error('加载卡片失败:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // 创建卡片
  const handleCreateCard = async (cardData) => {
    try {
      const result = await localOperationServiceOptimized.createCard({
        ...cardData,
        userId: currentUser.id
      })
      
      if (result.success) {
        // 重新加载列表或乐观更新
        await loadCards()
        showSuccess('卡片创建成功')
      } else {
        showError('创建失败: ' + result.error)
      }
    } catch (error) {
      showError('系统错误')
    }
  }
  
  // 定期更新性能指标
  useEffect(() => {
    const updateMetrics = async () => {
      const currentMetrics = await localOperationServiceOptimized.getPerformanceMetrics()
      setMetrics(currentMetrics)
    }
    
    updateMetrics()
    const interval = setInterval(updateMetrics, 30000)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div>
      {/* 组件内容 */}
    </div>
  )
}
```

## 🧪 测试和调试

### 1. 运行性能测试

```typescript
// 在浏览器控制台中运行
if (typeof window !== 'undefined' && window.runLocalOperationPerformanceTests) {
  await window.runLocalOperationPerformanceTests()
}

// 或者在测试文件中
import { runLocalOperationPerformanceTests } from './tests/performance/local-operation-performance.test'

// 在测试套件中运行
describe('LocalOperationService Performance', () => {
  it('should meet performance requirements', async () => {
    await runLocalOperationPerformanceTests()
    // 测试会自动验证性能目标
  })
})
```

### 2. 调试模式

```typescript
// 启用详细日志
const debug = {
  log: (...args) => console.log('[LocalOperation]', ...args),
  warn: (...args) => console.warn('[LocalOperation]', ...args),
  error: (...args) => console.error('[LocalOperation]', ...args)
}

// 包装操作以添加调试信息
async function debugCreateCard(cardData) {
  debug.log('开始创建卡片:', cardData)
  const startTime = performance.now()
  
  try {
    const result = await localOperationServiceOptimized.createCard(cardData)
    const duration = performance.now() - startTime
    
    debug.log('创建卡片完成:', {
      success: result.success,
      duration: duration.toFixed(2) + 'ms',
      id: result.id
    })
    
    return result
  } catch (error) {
    debug.error('创建卡片失败:', error)
    throw error
  }
}
```

## 🔄 与现有系统集成

### 1. 与统一同步服务集成

```typescript
import { unifiedSyncService } from '@/services/unified-sync-service'

// LocalOperationService 已经内部集成了同步队列
// 本地操作会自动创建同步操作

// 手动触发同步处理
await unifiedSyncService.triggerLocalSyncProcessing()

// 监听同步状态
unifiedSyncService.onStatusChange((status) => {
  console.log('同步状态:', status)
})
```

### 2. 数据迁移

```typescript
// 从旧版本迁移数据
async function migrateFromOldVersion() {
  try {
    // 检查是否需要迁移
    const currentVersion = await db.settings.get('databaseVersion')
    if (currentVersion?.value >= '4.0.0') {
      console.log('数据已是最新版本，无需迁移')
      return
    }
    
    console.log('开始数据迁移...')
    
    // 迁移逻辑已在数据库升级中自动处理
    await db.open() // 这将触发升级过程
    
    console.log('数据迁移完成')
  } catch (error) {
    console.error('数据迁移失败:', error)
  }
}
```

## 📈 性能基准

根据性能测试，LocalOperationService 优化后应达到以下基准：

- **创建卡片**: < 50ms (90%分位)
- **更新卡片**: < 30ms (90%分位)
- **删除卡片**: < 20ms (90%分位)
- **批量创建(50张)**: < 500ms
- **搜索查询**: < 100ms
- **列表查询**: < 50ms
- **缓存命中率**: > 80%
- **内存使用**: < 50MB (1000张卡片)

## 🆘 故障排除

### 常见问题

1. **操作响应慢**
   - 检查是否有大量待同步操作
   - 查看内存使用情况
   - 检查数据库索引是否正常

2. **同步失败**
   - 检查网络连接
   - 查看同步队列中的错误信息
   - 验证用户认证状态

3. **缓存命中率低**
   - 检查缓存配置
   - 验证缓存键生成逻辑
   - 检查缓存失效策略

### 调试工具

```typescript
// 调试工具函数
const debugTools = {
  // 显示缓存状态
  showCacheStatus: () => {
    const stats = localOperationServiceOptimized.cacheManager.getStats()
    console.log('缓存状态:', stats)
  },
  
  // 显示同步队列状态
  showSyncQueueStatus: async () => {
    const pending = await localOperationServiceOptimized.getPendingSyncOperations()
    console.log('同步队列:', {
      total: pending.length,
      byPriority: pending.reduce((acc, op) => {
        acc[op.priority] = (acc[op.priority] || 0) + 1
        return acc
      }, {})
    })
  },
  
  // 重置服务状态
  resetService: () => {
    localOperationServiceOptimized.clearCache()
    console.log('服务状态已重置')
  }
}

// 在控制台中可用
if (typeof window !== 'undefined') {
  (window as any).debugLocalOperationService = debugTools
}
```