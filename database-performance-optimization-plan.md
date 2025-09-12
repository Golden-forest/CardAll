# 数据库性能优化与索引策略方案

## 1. 查询性能优化机会分析

### 1.1 当前查询性能瓶颈

#### 🔍 关键性能问题：

1. **全文搜索性能低下**
   - 当前：使用 `filter()` + `toLowerCase()` 内存过滤
   - 问题：无法利用索引，O(n) 时间复杂度
   - 影响：数据量增长时性能线性下降

2. **标签查询缺少索引**
   - 当前：卡片中存储标签数组，查询时全表扫描
   - 问题：无法快速查找包含特定标签的卡片
   - 影响：标签筛选操作性能差

3. **统计数据计算效率低**
   - 当前：每次调用都重新计算所有统计信息
   - 问题：重复计算，无缓存机制
   - 影响：统计页面响应慢

4. **文件夹层级查询优化**
   - 当前：使用 `parentId` 递归查询
   - 问题：深度嵌套时查询次数多
   - 影响：文件夹展开性能差

### 1.2 索引优化策略

#### 1.2.1 全文搜索索引

**方案**: 实现 FTS (Full Text Search) 索引

```typescript
// 1. 添加搜索索引表
searchIndex: '++id, cardId, userId, term, type, score'

// 2. 优化后的卡片表索引
cards: `++id, userId, folderId, createdAt, updatedAt, syncVersion, 
        pendingSync, [userId+folderId], [userId+updatedAt], hasImages, styleType`
```

**实现策略**:
```typescript
// 搜索索引生成
async function updateSearchIndex(card: DbCard) {
  const terms = extractSearchTerms(card)
  const operations = terms.map(term => ({
    cardId: card.id,
    userId: card.userId,
    term: term.toLowerCase(),
    type: determineTermType(term),
    score: calculateTermScore(term)
  }))
  
  await db.searchIndex.bulkAdd(operations)
}

// 优化后的搜索查询
async function searchCards(searchTerm: string, userId: string): Promise<DbCard[]> {
  const terms = searchTerm.toLowerCase().split(' ')
  const cardIds = await db.searchIndex
    .where('term')
    .anyOf(terms)
    .and(index => index.userId === userId)
    .distinct()
    .primaryKeys()
  
  return db.cards.where('id').anyOf(cardIds).toArray()
}
```

#### 1.2.2 标签关联索引

**方案**: 建立标签-卡片关联表

```typescript
// 标签关联表
cardTags: '++id, cardId, tagId, userId, position'

// 优化后的查询
async function getCardsByTag(tagId: string, userId: string): Promise<DbCard[]> {
  const cardIds = await db.cardTags
    .where('[tagId+userId]')
    .equals([tagId, userId])
    .primaryKeys()
  
  return db.cards.where('id').anyOf(cardIds).toArray()
}
```

#### 1.2.3 复合索引优化

```typescript
// 优化的索引设计
this.version(4).stores({
  cards: `++id, userId, folderId, createdAt, updatedAt, syncVersion, 
          pendingSync, [userId+folderId], [userId+updatedAt], 
          [folderId+updatedAt], hasImages, styleType, [userId+hasImages]`,
  
  folders: `++id, userId, parentId, createdAt, updatedAt, syncVersion, 
           pendingSync, [userId+parentId], [userId+createdAt], 
           fullPath, depth, [depth+userId]`,
           
  tags: `++id, userId, name, createdAt, syncVersion, pendingSync, 
        [userId+name], [name+userId], count`,
        
  images: `++id, cardId, userId, createdAt, updatedAt, syncVersion, 
           pendingSync, storageMode, [cardId+userId], [storageMode+userId], 
           [userId+createdAt]`,
           
  searchIndex: `++id, cardId, userId, term, type, score, [userId+term], [term+userId]`,
  
  cardTags: `++id, cardId, tagId, userId, position, [cardId+tagId], [tagId+userId], [userId+tagId]`,
  
  // 统计缓存表
  statsCache: `++id, userId, type, data, updatedAt, [userId+type]`
})
```

### 1.3 查询优化实现

#### 1.3.1 批量查询优化

```typescript
// 批量获取卡片信息
async function getCardsWithDetails(cardIds: string[]): Promise<CardDetails[]> {
  const [cards, images, tags] = await Promise.all([
    db.cards.where('id').anyOf(cardIds).toArray(),
    db.images.where('cardId').anyOf(cardIds).toArray(),
    db.cardTags.where('cardId').anyOf(cardIds).toArray()
  ])
  
  return cardIds.map(id => ({
    card: cards.find(c => c.id === id),
    images: images.filter(img => img.cardId === id),
    tags: tags.filter(tag => tag.cardId === id)
  }))
}
```

#### 1.3.2 分页查询优化

```typescript
async function getPaginatedCards(
  userId: string,
  folderId?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ cards: DbCard[], total: number }> {
  const collection = folderId 
    ? db.cards.where('[userId+folderId]').equals([userId, folderId])
    : db.cards.where('userId').equals(userId)
  
  const [cards, total] = await Promise.all([
    collection
      .reverse()
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    collection.count()
  ])
  
  return { cards, total }
}
```

## 2. 缓存策略优化

### 2.1 多层缓存架构

```typescript
// 缓存层级设计
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  version: string
  dependencies: string[]
}

class DatabaseCache {
  private l1Cache = new Map<string, CacheEntry<any>>() // 内存缓存
  private l2Cache = new Map<string, CacheEntry<any>>() // 持久化缓存
  
  // 智能缓存策略
  async get<T>(key: string, query: () => Promise<T>): Promise<T> {
    // L1 缓存检查
    const l1Entry = this.l1Cache.get(key)
    if (l1Entry && !this.isExpired(l1Entry)) {
      return l1Entry.data
    }
    
    // L2 缓存检查
    const l2Entry = await this.l2Cache.get(key)
    if (l2Entry && !this.isExpired(l2Entry)) {
      this.l1Cache.set(key, l2Entry) // 提升到 L1
      return l2Entry.data
    }
    
    // 查询数据库
    const data = await query()
    const entry: CacheEntry<any> = {
      data,
      timestamp: Date.now(),
      ttl: this.calculateTTL(key),
      version: await this.getDataVersion(key),
      dependencies: await this.getDependencies(key)
    }
    
    // 更新缓存
    this.l1Cache.set(key, entry)
    await this.l2Cache.set(key, entry)
    
    return data
  }
  
  // 缓存失效策略
  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern)
    
    // 失效 L1 缓存
    for (const [key] of this.l1Cache) {
      if (regex.test(key)) {
        this.l1Cache.delete(key)
      }
    }
    
    // 失效 L2 缓存
    for (const [key] of this.l2Cache) {
      if (regex.test(key)) {
        this.l2Cache.delete(key)
      }
    }
  }
}
```

### 2.2 统计信息缓存

```typescript
// 统计信息缓存表
interface StatsCache {
  id?: string
  userId: string
  type: 'card_count' | 'folder_count' | 'tag_count' | 'storage_size'
  data: any
  updatedAt: Date
  version: string
}

// 缓存统计查询
async function getCachedStats(userId: string): Promise<DatabaseStats> {
  const cacheKey = `stats_${userId}`
  
  return cache.get(cacheKey, async () => {
    const [cards, folders, tags, images, pendingSync] = await Promise.all([
      db.cards.where('userId').equals(userId).count(),
      db.folders.where('userId').equals(userId).count(),
      db.tags.where('userId').equals(userId).count(),
      db.images.where('userId').equals(userId).toArray(),
      db.syncQueue.where('userId').equals(userId).count()
    ])
    
    const totalSize = images.reduce((total, img) => total + img.metadata.size, 0)
    
    return { cards, folders, tags, images: images.length, pendingSync, totalSize }
  })
}
```

## 3. 数据一致性保证机制

### 3.1 事务完整性增强

```typescript
// 增强的事务管理
class TransactionManager {
  async execute<T>(operations: () => Promise<T>, retries: number = 3): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await db.transaction('rw', [db.cards, db.folders, db.tags, db.images], operations)
      } catch (error) {
        if (i === retries - 1) throw error
        if (error.name === 'ConstraintError') {
          await this.resolveConstraintError(error)
        }
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)))
      }
    }
    throw new Error('Transaction failed after maximum retries')
  }
  
  private async resolveConstraintError(error: any): Promise<void> {
    // 解析约束错误并自动修复
    if (error.message.includes('unique constraint')) {
      await this.handleUniqueConstraintViolation(error)
    }
  }
}
```

### 3.2 数据完整性检查

```typescript
// 数据完整性检查器
class DataIntegrityChecker {
  async checkDatabase(userId: string): Promise<IntegrityReport> {
    const issues: IntegrityIssue[] = []
    
    // 检查孤立图片
    const orphanImages = await this.findOrphanImages(userId)
    if (orphanImages.length > 0) {
      issues.push({
        type: 'orphan_images',
        severity: 'warning',
        count: orphanImages.length,
        description: `Found ${orphanImages.length} orphaned images`
      })
    }
    
    // 检查标签一致性
    const tagIssues = await this.checkTagConsistency(userId)
    issues.push(...tagIssues)
    
    // 检查文件夹引用完整性
    const folderIssues = await this.checkFolderReferences(userId)
    issues.push(...folderIssues)
    
    return {
      isHealthy: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      checkedAt: new Date()
    }
  }
  
  private async findOrphanImages(userId: string): Promise<DbImage[]> {
    const userCardIds = await db.cards
      .where('userId')
      .equals(userId)
      .primaryKeys()
    
    return db.images
      .where('userId')
      .equals(userId)
      .and(img => !userCardIds.includes(img.cardId))
      .toArray()
  }
}
```

## 4. 性能监控系统

### 4.1 查询性能监控

```typescript
// 性能监控装饰器
function monitorQuery(name: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      const start = performance.now()
      try {
        const result = await originalMethod.apply(this, args)
        const duration = performance.now() - start
        
        // 记录性能指标
        performanceTracker.recordQuery({
          name,
          duration,
          success: true,
          args: this.sanitizeArgs(args)
        })
        
        return result
      } catch (error) {
        const duration = performance.now() - start
        performanceTracker.recordQuery({
          name,
          duration,
          success: false,
          error: error.message
        })
        throw error
      }
    }
  }
}

// 性能指标收集
class PerformanceTracker {
  private metrics: QueryMetric[] = []
  
  recordQuery(metric: QueryMetric): void {
    this.metrics.push({
      ...metric,
      timestamp: Date.now()
    })
    
    // 保持最近1000条记录
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }
  
  getSlowQueries(threshold: number = 100): QueryMetric[] {
    return this.metrics
      .filter(m => m.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
  }
  
  getPerformanceReport(): PerformanceReport {
    const successful = this.metrics.filter(m => m.success)
    const failed = this.metrics.filter(m => !m.success)
    
    return {
      totalQueries: this.metrics.length,
      averageDuration: successful.reduce((sum, m) => sum + m.duration, 0) / successful.length || 0,
      errorRate: failed.length / this.metrics.length,
      slowQueries: this.getSlowQueries(),
      timestamp: Date.now()
    }
  }
}
```

### 4.2 索引使用分析

```typescript
// 索引使用情况分析
async function analyzeIndexUsage(): Promise<IndexAnalysisReport> {
  const report: IndexAnalysisReport = {
    indexes: [],
    recommendations: []
  }
  
  // 分析每个索引的使用情况
  for (const [tableName, indexes] of Object.entries(INDEX_DEFINITIONS)) {
    for (const index of indexes) {
      const usage = await estimateIndexUsage(tableName, index)
      report.indexes.push({
        table: tableName,
        index,
        usage,
        recommendation: generateIndexRecommendation(usage)
      })
    }
  }
  
  return report
}
```

## 5. 实施计划

### 5.1 阶段性实施策略

#### 第一阶段：基础索引优化 (1-2周)
1. 添加复合索引优化常用查询
2. 实现统计信息缓存
3. 添加基本的性能监控

#### 第二阶段：搜索优化 (2-3周)
1. 实现全文搜索索引
2. 优化标签关联查询
3. 添加搜索性能监控

#### 第三阶段：高级优化 (3-4周)
1. 实现多层缓存策略
2. 添加数据完整性检查
3. 完善性能监控系统

### 5.2 性能目标

**优化目标**:
- 搜索查询响应时间 < 50ms (10,000条记录)
- 标签筛选响应时间 < 20ms
- 统计信息查询 < 10ms (缓存命中)
- 数据库操作成功率 > 99.9%

**监控指标**:
- 平均查询响应时间
- 缓存命中率
- 索引使用率
- 错误率