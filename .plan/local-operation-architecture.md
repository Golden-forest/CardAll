# LocalOperationService 架构设计文档

## 🎯 设计目标

### 核心目标
- **响应时间**: 本地操作响应时间 < 100ms
- **异步同步**: 不阻塞用户操作的云同步机制
- **性能优化**: 本地查询性能优化和智能缓存
- **兼容性**: 与现有架构完全兼容

### 性能指标
- 本地操作响应: < 50ms (90%分位)
- 队列处理延迟: < 100ms (高优先级)
- 同步成功率: > 99%
- 内存使用: < 50MB
- 数据库查询: < 20ms

## 🏗️ 架构组件

### 1. 核心服务层 (Core Service Layer)

```typescript
class LocalOperationService {
  // 快速本地操作
  async createCard(data: CardData): Promise<LocalOperationResult>
  async updateCard(id: string, updates: CardUpdate): Promise<LocalOperationResult>
  async deleteCard(id: string): Promise<LocalOperationResult>
  
  // 批量操作
  async bulkCreateCards(cards: CardData[]): Promise<LocalOperationResult[]>
  async bulkUpdateCards(updates: CardUpdate[]): Promise<LocalOperationResult[]>
  
  // 查询操作
  async getCards(options: QueryOptions): Promise<Card[]>
  async searchCards(query: SearchQuery): Promise<Card[]>
}
```

### 2. 缓存层 (Cache Layer)

```typescript
interface LocalCacheManager {
  // 内存缓存
  memoryCache: Map<string, CachedItem>
  // 数据库索引缓存
  indexCache: Map<string, IndexData>
  // 查询结果缓存
  queryCache: Map<string, QueryResult>
  
  // 缓存策略
  strategy: {
    ttl: number
    maxSize: number
    evictionPolicy: 'lru' | 'fifo'
  }
}
```

### 3. 队列管理层 (Queue Management Layer)

```typescript
class OperationQueueManager {
  // 高优先级队列 (立即处理)
  highPriorityQueue: PriorityOperation[]
  // 正常优先级队列 (批量处理)
  normalPriorityQueue: PriorityOperation[]
  // 低优先级队列 (延迟处理)
  lowPriorityQueue: PriorityOperation[]
  
  // 批处理机制
  batchProcessor: BatchProcessor
  // 依赖管理
  dependencyResolver: DependencyResolver
}
```

### 4. 同步适配层 (Sync Adapter Layer)

```typescript
class SyncAdapter {
  // 适配统一同步服务
  unifiedSyncService: UnifiedSyncService
  
  // 转换本地操作为同步操作
  convertLocalToSync(localOp: LocalOperation): SyncOperation
  
  // 批量同步优化
  batchSync(operations: SyncOperation[]): Promise<BatchSyncResult>
}
```

## 🔄 数据流设计

### 1. 本地操作流程

```
用户操作 → 本地数据库 → 返回结果 → 加入同步队列
    ↓              ↓              ↓              ↓
  UI更新      索引更新      用户反馈      异步同步
```

### 2. 同步队列流程

```
本地队列 → 优先级排序 → 依赖检查 → 批处理 → 云端同步
    ↓         ↓         ↓         ↓         ↓
状态更新  重试机制  冲突检测  错误处理  结果反馈
```

### 3. 缓存策略

```
查询请求 → 缓存检查 → 数据库查询 → 缓存更新 → 返回结果
    ↓         ↓         ↓         ↓         ↓
  缓存命中  缓存未命中  索引优化  TTL更新  性能统计
```

## 🛠️ 技术实现要点

### 1. 本地数据库优化

#### 索引策略
```typescript
// 优化的复合索引
db.cards.hook('creating', (primKey, obj) => {
  // 生成搜索向量
  obj.searchVector = generateSearchVector(obj)
})

// 实时索引更新
db.cards.hook('updating', (mods, primKey, obj) => {
  if (mods.frontContent || mods.backContent) {
    mods.searchVector = generateSearchVector({...obj, ...mods})
  }
})
```

#### 批量操作优化
```typescript
async bulkCreateCards(cards: CardData[]): Promise<LocalOperationResult[]> {
  const results: LocalOperationResult[] = []
  
  // 使用事务确保原子性
  await db.transaction('rw', [db.cards, db.syncQueue], async () => {
    // 批量插入到本地数据库
    const cardIds = await db.cards.bulkAdd(cards.map(card => ({
      ...card,
      syncVersion: 1,
      pendingSync: true,
      updatedAt: new Date()
    })))
    
    // 批量创建同步操作
    const syncOperations = cards.map((card, index) => ({
      type: 'create' as const,
      entity: 'card' as const,
      entityId: cardIds[index],
      data: card,
      priority: 'normal' as const
    }))
    
    await db.syncQueue.bulkAdd(syncOperations)
    
    results = cardIds.map(id => ({
      success: true,
      id,
      message: 'Card created successfully'
    }))
  })
  
  return results
}
```

### 2. 智能缓存机制

#### 多级缓存设计
```typescript
class LocalCacheManager {
  private memoryCache = new Map<string, CachedItem>()
  private queryCache = new Map<string, QueryResult>()
  private stats = new Map<string, CacheStats>()
  
  async get<T>(key: string): Promise<T | null> {
    const cached = this.memoryCache.get(key)
    if (!cached) return null
    
    // 检查TTL
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.memoryCache.delete(key)
      return null
    }
    
    return cached.data as T
  }
  
  async set<T>(key: string, data: T, ttl: number = 30000): Promise<void> {
    // 检查缓存大小限制
    if (this.memoryCache.size > 1000) {
      this.evictLeastRecentlyUsed()
    }
    
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }
  
  // 查询结果缓存
  async cacheQuery(query: string, result: any): Promise<void> {
    const cacheKey = this.generateQueryKey(query)
    await this.set(cacheKey, result, 10000) // 10秒缓存
  }
  
  async getQueryResult(query: string): Promise<any | null> {
    const cacheKey = this.generateQueryKey(query)
    return await this.get(cacheKey)
  }
}
```

#### 缓存失效策略
```typescript
class CacheInvalidator {
  // 数据变更时清除相关缓存
  invalidateCardCache(cardId: string): void {
    // 清除卡片相关缓存
    this.cacheManager.delete(`card:${cardId}`)
    this.cacheManager.delete(`cards:folder:*`)
    this.cacheManager.delete(`cards:search:*`)
  }
  
  // 批量失效
  invalidateCardsCache(cardIds: string[]): void {
    cardIds.forEach(id => this.invalidateCardCache(id))
  }
  
  // 全局失效
  invalidateAll(): void {
    this.cacheManager.clear()
  }
}
```

### 3. 高性能队列处理

#### 优先级队列实现
```typescript
class PriorityOperationQueue {
  private queues = {
    critical: [] as LocalOperation[],
    high: [] as LocalOperation[],
    normal: [] as LocalOperation[],
    low: [] as LocalOperation[]
  }
  
  enqueue(operation: LocalOperation): void {
    this.queues[operation.priority].push(operation)
    this.sortByPriority()
  }
  
  dequeue(): LocalOperation | null {
    for (const priority of ['critical', 'high', 'normal', 'low']) {
      const queue = this.queues[priority as keyof typeof this.queues]
      if (queue.length > 0) {
        return queue.shift()!
      }
    }
    return null
  }
  
  // 批量获取
  dequeueBatch(size: number = 10): LocalOperation[] {
    const batch: LocalOperation[] = []
    
    while (batch.length < size) {
      const operation = this.dequeue()
      if (!operation) break
      
      batch.push(operation)
    }
    
    return batch
  }
}
```

#### 依赖解析机制
```typescript
class DependencyResolver {
  private dependencyGraph = new Map<string, string[]>()
  
  addDependencies(operationId: string, dependencies: string[]): void {
    this.dependencyGraph.set(operationId, dependencies)
  }
  
  isReady(operationId: string): boolean {
    const dependencies = this.dependencyGraph.get(operationId) || []
    return dependencies.every(dep => this.isCompleted(dep))
  }
  
  getReadyOperations(): string[] {
    return Array.from(this.dependencyGraph.keys())
      .filter(id => this.isReady(id))
  }
}
```

### 4. 异步同步优化

#### 批处理同步
```typescript
class BatchSyncProcessor {
  async processBatch(operations: LocalOperation[]): Promise<BatchSyncResult> {
    const batchId = crypto.randomUUID()
    const startTime = Date.now()
    
    try {
      // 按类型分组
      const groups = this.groupOperationsByType(operations)
      
      // 并行处理不同类型
      const results = await Promise.all(
        Object.entries(groups).map(([type, ops]) => 
          this.processOperationGroup(type as EntityType, ops)
        )
      )
      
      const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0)
      const totalFailed = results.reduce((sum, r) => sum + r.failed, 0)
      
      return {
        batchId,
        processed: totalProcessed,
        failed: totalFailed,
        duration: Date.now() - startTime,
        success: totalFailed === 0
      }
    } catch (error) {
      console.error(`Batch ${batchId} failed:`, error)
      return {
        batchId,
        processed: 0,
        failed: operations.length,
        duration: Date.now() - startTime,
        success: false,
        error: error.message
      }
    }
  }
  
  private async processOperationGroup(
    type: EntityType, 
    operations: LocalOperation[]
  ): Promise<{ processed: number; failed: number }> {
    // 根据类型使用不同的处理策略
    switch (type) {
      case 'card':
        return await this.processCardOperations(operations)
      case 'folder':
        return await this.processFolderOperations(operations)
      case 'tag':
        return await this.processTagOperations(operations)
      case 'image':
        return await this.processImageOperations(operations)
      default:
        return { processed: 0, failed: operations.length }
    }
  }
}
```

## 📊 性能监控

### 1. 性能指标收集

```typescript
class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric>()
  
  recordOperation(type: string, duration: number, success: boolean): void {
    const key = `operation_${type}`
    const metric = this.metrics.get(key) || {
      count: 0,
      totalDuration: 0,
      successCount: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0
    }
    
    metric.count++
    metric.totalDuration += duration
    if (success) metric.successCount++
    metric.avgDuration = metric.totalDuration / metric.count
    metric.minDuration = Math.min(metric.minDuration, duration)
    metric.maxDuration = Math.max(metric.maxDuration, duration)
    
    this.metrics.set(key, metric)
  }
  
  getMetrics(): PerformanceMetrics {
    return Object.fromEntries(this.metrics)
  }
}
```

### 2. 实时性能监控

```typescript
class RealTimeMonitor {
  private performanceObserver: PerformanceObserver
  
  constructor() {
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.analyzePerformance(entry)
      }
    })
    
    this.performanceObserver.observe({ entryTypes: ['measure'] })
  }
  
  private analyzePerformance(entry: PerformanceEntry): void {
    if (entry.duration > 100) {
      console.warn(`Slow operation detected: ${entry.name} took ${entry.duration}ms`)
    }
  }
}
```

## 🔄 兼容性保证

### 1. 向后兼容接口

```typescript
// 保持现有接口不变，扩展新功能
interface LocalOperationService {
  // 现有方法保持不变
  addOperation(operation: Omit<LocalSyncOperation, ...>): Promise<string>
  getPendingOperations(limit?: number): Promise<LocalSyncOperation[]>
  
  // 新增高性能方法
  createCardFast(cardData: CardData): Promise<LocalOperationResult>
  updateCardFast(id: string, updates: CardUpdate): Promise<LocalOperationResult>
  
  // 性能监控
  getPerformanceMetrics(): Promise<PerformanceMetrics>
}
```

### 2. 数据迁移策略

```typescript
class DataMigration {
  async migrateToNewSchema(): Promise<void> {
    // 检查是否需要迁移
    const currentVersion = await db.settings.get('databaseVersion')
    if (currentVersion && currentVersion.value >= '4.0.0') {
      return
    }
    
    // 执行迁移
    await this.migrateSyncQueue()
    await this.migrateIndexes()
    await this.migrateCache()
    
    // 更新版本号
    await db.settings.put({
      key: 'databaseVersion',
      value: '4.0.0',
      scope: 'global',
      updatedAt: new Date()
    })
  }
}
```

## 🎯 实施计划

### 阶段 1: 核心优化 (1-2天)
- [ ] 实现高性能本地操作方法
- [ ] 优化数据库索引和查询
- [ ] 添加内存缓存机制
- [ ] 性能测试和调优

### 阶段 2: 队列优化 (1-2天)
- [ ] 优化队列处理逻辑
- [ ] 实现智能批处理
- [ ] 添加依赖管理
- [ ] 错误处理优化

### 阶段 3: 监控和维护 (1天)
- [ ] 实现性能监控
- [ ] 添加健康检查
- [ ] 文档完善
- [ ] 集成测试

### 阶段 4: 兼容性测试 (1天)
- [ ] 向后兼容测试
- [ ] 性能基准测试
- [ ] 用户体验测试
- [ ] 部署准备

## 📈 预期效果

### 性能提升
- 本地操作响应时间: 从 ~200ms 降低到 < 50ms
- 同步队列处理: 提升 50% 处理速度
- 查询性能: 提升 80% 响应速度
- 内存使用: 优化 30% 内存占用

### 用户体验
- 即时反馈: 用户操作立即得到响应
- 离线友好: 完善的离线操作支持
- 稳定性: 更好的错误处理和恢复机制
- 一致性: 确保本地和云端数据一致性

## 🛡️ 安全考虑

### 数据安全
- 本地数据加密存储
- 敏感信息保护
- 访问权限控制

### 网络安全
- 安全的数据传输
- 请求验证和授权
- 防止重放攻击

### 错误处理
- 完整的错误日志
- 用户友好的错误提示
- 自动恢复机制