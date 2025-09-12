# 数据模型优化与迁移策略

## 1. 数据模型优化方案

### 1.1 核心数据模型优化

#### 1.1.1 卡片模型优化

**当前问题**:
- 标签存储在卡片内容中，查询效率低
- 缺少搜索优化字段
- 统计信息重复计算

**优化方案**:
```typescript
// 优化后的卡片模型
interface OptimizedDbCard extends SyncableEntity {
  id?: string
  
  // 基础内容
  frontContent: CardContent
  backContent: CardContent
  style: CardStyle
  
  // 关系字段
  folderId?: string
  userId?: string
  
  // 搜索优化
  searchVector?: string
  searchTerms: string[]
  contentHash: string // 用于变更检测
  
  // 性能优化字段
  imageCount: number
  tagCount: number
  hasImages: boolean
  styleType: string
  
  // 时间戳
  createdAt: Date
  updatedAt: Date
  
  // 兼容性字段
  isFlipped?: boolean
  isSelected?: boolean
}
```

#### 1.1.2 标签系统重构

**当前问题**:
- 标签与卡片关系存储在卡片内容中
- 标签计数不准确
- 缺少标签关联查询优化

**优化方案**:
```typescript
// 标签-卡片关联表
interface CardTagRelation {
  id?: string
  cardId: string
  tagId: string
  userId?: string
  position: 'front' | 'back'
  addedAt: Date
  
  // 索引支持
  compoundIndex?: '[cardId+tagId]'
  userTagIndex?: '[userId+tagId]'
}

// 优化后的标签模型
interface OptimizedDbTag extends SyncableEntity {
  id?: string
  name: string
  color: string
  userId?: string
  
  // 统计信息
  count: number
  usageFrequency: number // 最近使用频率
  
  // 性能优化
  searchVector: string
  isSystem: boolean // 系统标签
  isHidden?: boolean
  
  createdAt: Date
  updatedAt: Date
}
```

#### 1.1.3 图片存储优化

**当前问题**:
- 图片元数据存储冗余
- 缺少图片版本控制
- 缩略图管理不完善

**优化方案**:
```typescript
// 优化后的图片模型
interface OptimizedDbImage extends SyncableEntity {
  id?: string
  cardId: string
  userId?: string
  
  // 文件信息
  fileName: string
  filePath: string
  fileSize: number
  
  // 存储模式
  storageMode: 'indexeddb' | 'filesystem' | 'cloud'
  cloudUrl?: string
  
  // 图片元数据
  metadata: {
    width: number
    height: number
    format: string
    quality?: number
    compressed: boolean
    colorSpace?: string
    hasTransparency?: boolean
  }
  
  // 缩略图
  thumbnails: {
    small?: string // 64x64
    medium?: string // 256x256
    large?: string // 512x512
  }
  
  // 版本控制
  version: number
  contentHash: string
  
  createdAt: Date
  updatedAt: Date
}
```

### 1.2 新增数据模型

#### 1.2.1 搜索索引表

```typescript
// 全文搜索索引
interface SearchIndex {
  id?: string
  cardId: string
  userId?: string
  
  // 搜索项
  term: string
  termType: 'title' | 'content' | 'tag' | 'filename'
  
  // 排名信息
  score: number
  position: number
  context?: string
  
  // 索引信息
  language: string
  stemming: boolean
  
  createdAt: Date
  updatedAt: Date
}
```

#### 1.2.2 统计缓存表

```typescript
// 统计信息缓存
interface StatsCache {
  id?: string
  userId?: string
  cacheType: 'user_stats' | 'folder_stats' | 'tag_stats' | 'system_stats'
  
  // 缓存数据
  data: any
  
  // 缓存控制
  version: string
  expiresAt: Date
  hitCount: number
  lastAccessed: Date
  
  createdAt: Date
  updatedAt: Date
}
```

#### 1.2.3 操作日志表

```typescript
// 操作审计日志
interface OperationLog {
  id?: string
  userId?: string
  operation: string
  entityType: 'card' | 'folder' | 'tag' | 'image'
  entityId: string
  
  // 操作详情
  details: any
  changes?: any // 变更前后的差异
  
  // 执行信息
  duration: number
  success: boolean
  errorMessage?: string
  
  // 同步信息
  syncStatus: 'pending' | 'synced' | 'failed'
  syncAt?: Date
  
  createdAt: Date
}
```

### 1.3 数据库版本升级

```typescript
// 数据库版本4：优化版本
class CardAllOptimizedDatabase extends Dexie {
  // 优化的数据表
  cards!: Table<OptimizedDbCard>
  folders!: Table<OptimizedDbFolder>
  tags!: Table<OptimizedDbTag>
  images!: Table<OptimizedDbImage>
  
  // 新增表
  searchIndex!: Table<SearchIndex>
  cardTags!: Table<CardTagRelation>
  statsCache!: Table<StatsCache>
  operationLogs!: Table<OperationLog>
  
  // 原有表
  syncQueue!: Table<SyncOperation>
  settings!: Table<AppSettings>
  sessions!: Table<UserSession>
  
  constructor() {
    super('CardAllOptimizedDatabase')
    
    this.version(4).stores({
      // 优化的核心表
      cards: `++id, userId, folderId, createdAt, updatedAt, syncVersion, 
              pendingSync, [userId+folderId], [userId+updatedAt], 
              hasImages, styleType, contentHash, [userId+hasImages]`,
              
      folders: `++id, userId, parentId, createdAt, updatedAt, syncVersion, 
               pendingSync, [userId+parentId], [userId+createdAt], 
               fullPath, depth, [depth+userId], isExpanded`,
               
      tags: `++id, userId, name, createdAt, syncVersion, pendingSync, 
            [userId+name], [name+userId], count, isSystem, isHidden`,
            
      images: `++id, cardId, userId, createdAt, updatedAt, syncVersion, 
               pendingSync, storageMode, [cardId+userId], [storageMode+userId], 
               [userId+createdAt], contentHash`,
               
      // 新增表
      searchIndex: `++id, cardId, userId, term, termType, score, 
                    [userId+term], [term+userId], [cardId+term]`,
                    
      cardTags: `++id, cardId, tagId, userId, position, addedAt,
                [cardId+tagId], [tagId+userId], [userId+tagId]`,
                
      statsCache: `++id, userId, cacheType, version, expiresAt,
                  [userId+cacheType], [cacheType+userId]`,
                  
      operationLogs: `++id, userId, operation, entityType, entityId,
                      createdAt, [userId+createdAt], [entityType+entityId]`,
                      
      // 原有表保持兼容
      syncQueue: `++id, type, entity, entityId, userId, timestamp, 
                  retryCount, priority, [userId+priority]`,
                  
      settings: `++id, key, updatedAt, scope, [key+scope]`,
      sessions: `++id, userId, deviceId, lastActivity, isActive, [userId+deviceId]`
    })
    
    this.upgradeDatabase()
  }
  
  private async upgradeDatabase(): Promise<void> {
    // 版本3 -> 4的升级逻辑
    this.version(4).upgrade(async (tx) => {
      console.log('Upgrading to version 4: Optimized database schema...')
      
      // 1. 迁移卡片数据
      await this.migrateCards()
      
      // 2. 建立标签关联关系
      await this.migrateTagRelations()
      
      // 3. 构建搜索索引
      await this.buildSearchIndex()
      
      // 4. 计算统计信息
      await this.calculateStatistics()
      
      console.log('Database upgrade completed successfully')
    })
  }
}
```

## 2. 数据迁移策略

### 2.1 迁移原则

1. **安全性第一**: 确保数据不丢失
2. **向后兼容**: 保持现有功能正常工作
3. **渐进式迁移**: 分阶段进行，降低风险
4. **可回滚**: 每个阶段都支持回滚
5. **性能保证**: 迁移过程不影响系统性能

### 2.2 迁移阶段规划

#### 阶段一：准备工作 (1-2天)
- [ ] 备份现有数据库
- [ ] 创建迁移测试环境
- [ ] 编写迁移脚本
- [ ] 制定回滚方案
- [ ] 准备迁移验证工具

#### 阶段二：结构迁移 (2-3天)
- [ ] 升级数据库版本
- [ ] 创建新表结构
- [ ] 添加新索引
- [ ] 迁移基础数据
- [ ] 验证数据完整性

#### 阶段三：数据转换 (3-5天)
- [ ] 转换卡片数据格式
- [ ] 建立标签关联关系
- [ ] 构建搜索索引
- [ ] 计算统计缓存
- [ ] 清理冗余数据

#### 阶段四：功能验证 (2-3天)
- [ ] 验证查询功能
- [ ] 测试搜索性能
- [ ] 验证同步功能
- [ ] 性能基准测试
- [ ] 用户体验测试

### 2.3 具体迁移实现

#### 2.3.1 数据库备份方案

```typescript
// 数据库备份服务
class DatabaseBackupService {
  async createBackup(): Promise<BackupInfo> {
    const timestamp = new Date().toISOString()
    const backup = {
      id: crypto.randomUUID(),
      timestamp,
      version: '3.0.0',
      data: {}
    }
    
    // 备份所有数据
    backup.data = {
      cards: await db.cards.toArray(),
      folders: await db.folders.toArray(),
      tags: await db.tags.toArray(),
      images: await db.images.toArray(),
      syncQueue: await db.syncQueue.toArray(),
      settings: await db.settings.toArray()
    }
    
    // 保存到 IndexedDB
    await backupDb.backups.add(backup)
    
    // 同时保存到 localStorage
    localStorage.setItem(`cardall_backup_${timestamp}`, JSON.stringify(backup))
    
    return {
      id: backup.id,
      timestamp,
      size: JSON.stringify(backup).length,
      status: 'completed'
    }
  }
  
  async restoreFromBackup(backupId: string): Promise<void> {
    const backup = await backupDb.backups.get(backupId)
    if (!backup) throw new Error('Backup not found')
    
    // 清空当前数据库
    await db.clearAll()
    
    // 恢复数据
    for (const [tableName, data] of Object.entries(backup.data)) {
      if (data && Array.isArray(data)) {
        await db[tableName].bulkAdd(data)
      }
    }
  }
  
  async listBackups(): Promise<BackupInfo[]> {
    return backupDb.backups.orderBy('timestamp').reverse().toArray()
  }
}
```

#### 2.3.2 卡片数据迁移

```typescript
// 卡片数据迁移
async function migrateCards(): Promise<void> {
  console.log('Migrating cards...')
  
  const oldCards = await db.cards.toArray()
  const migrationResults = {
    total: oldCards.length,
    success: 0,
    failed: 0,
    errors: [] as string[]
  }
  
  for (const oldCard of oldCards) {
    try {
      // 计算新的优化字段
      const allTags = [
        ...oldCard.frontContent.tags,
        ...oldCard.backContent.tags
      ]
      
      const allImages = [
        ...oldCard.frontContent.images,
        ...oldCard.backContent.images
      ]
      
      // 创建优化后的卡片
      const optimizedCard: OptimizedDbCard = {
        ...oldCard,
        searchTerms: generateSearchTerms(oldCard),
        contentHash: calculateContentHash(oldCard),
        imageCount: allImages.length,
        tagCount: allTags.length,
        hasImages: allImages.length > 0,
        styleType: oldCard.style.type
      }
      
      await db.cards.update(oldCard.id!, optimizedCard)
      migrationResults.success++
      
    } catch (error) {
      migrationResults.failed++
      migrationResults.errors.push(`Card ${oldCard.id}: ${error.message}`)
    }
  }
  
  console.log('Card migration completed:', migrationResults)
}
```

#### 2.3.3 标签关联迁移

```typescript
// 标签关联迁移
async function migrateTagRelations(): Promise<void> {
  console.log('Migrating tag relations...')
  
  const cards = await db.cards.toArray()
  const tagRelations: CardTagRelation[] = []
  
  for (const card of cards) {
    // 处理正面标签
    card.frontContent.tags.forEach((tag, index) => {
      tagRelations.push({
        cardId: card.id!,
        tagId: normalizeTag(tag),
        userId: card.userId,
        position: 'front' as const,
        addedAt: new Date()
      })
    })
    
    // 处理背面标签
    card.backContent.tags.forEach((tag, index) => {
      tagRelations.push({
        cardId: card.id!,
        tagId: normalizeTag(tag),
        userId: card.userId,
        position: 'back' as const,
        addedAt: new Date()
      })
    })
  }
  
  // 批量插入标签关系
  await db.cardTags.bulkAdd(tagRelations)
  console.log(`Created ${tagRelations.length} tag relations`)
}

// 标签标准化
function normalizeTag(tagName: string): string {
  return tagName.toLowerCase().trim()
}
```

#### 2.3.4 搜索索引构建

```typescript
// 搜索索引构建
async function buildSearchIndex(): Promise<void> {
  console.log('Building search index...')
  
  const cards = await db.cards.toArray()
  const searchIndexEntries: SearchIndex[] = []
  
  for (const card of cards) {
    const entries = createSearchIndexEntries(card)
    searchIndexEntries.push(...entries)
  }
  
  // 批量插入搜索索引
  await db.searchIndex.bulkAdd(searchIndexEntries)
  console.log(`Created ${searchIndexEntries.length} search index entries`)
}

function createSearchIndexEntries(card: OptimizedDbCard): SearchIndex[] {
  const entries: SearchIndex[] = []
  
  // 标题索引
  if (card.frontContent.title) {
    entries.push({
      cardId: card.id!,
      userId: card.userId,
      term: card.frontContent.title.toLowerCase(),
      termType: 'title',
      score: 10,
      position: 0,
      language: 'zh',
      stemming: false,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }
  
  // 内容索引
  if (card.frontContent.text) {
    const terms = extractTerms(card.frontContent.text)
    terms.forEach((term, position) => {
      entries.push({
        cardId: card.id!,
        userId: card.userId,
        term: term.toLowerCase(),
        termType: 'content',
        score: 5,
        position,
        language: 'zh',
        stemming: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    })
  }
  
  return entries
}
```

## 3. 回滚方案

### 3.1 回滚触发条件

1. **数据丢失**: 迁移过程中数据丢失
2. **性能严重下降**: 迁移后性能低于预期50%
3. **功能异常**: 核心功能无法正常使用
4. **数据不一致**: 数据完整性检查失败
5. **用户反馈**: 大量用户投诉或问题报告

### 3.2 回滚流程

```typescript
// 回滚管理器
class RollbackManager {
  async rollback(backupId: string): Promise<RollbackResult> {
    const result: RollbackResult = {
      success: false,
      steps: [],
      timestamp: new Date()
    }
    
    try {
      // 1. 停止所有数据库操作
      await this.stopDatabaseOperations()
      result.steps.push('Stopped database operations')
      
      // 2. 创建当前状态备份
      const currentBackup = await backupService.createBackup()
      result.steps.push('Created pre-rollback backup')
      
      // 3. 恢复到指定备份
      await backupService.restoreFromBackup(backupId)
      result.steps.push('Restored from backup')
      
      // 4. 降级数据库版本
      await this.downgradeDatabaseVersion()
      result.steps.push('Downgraded database version')
      
      // 5. 重启数据库服务
      await this.restartDatabaseServices()
      result.steps.push('Restarted database services')
      
      // 6. 验证回滚结果
      const validation = await this.validateRollback()
      if (validation.success) {
        result.success = true
        result.steps.push('Rollback validation successful')
      } else {
        throw new Error('Rollback validation failed')
      }
      
    } catch (error) {
      console.error('Rollback failed:', error)
      result.error = error.message
      
      // 尝试恢复到当前备份
      try {
        await backupService.restoreFromBackup(currentBackup.id)
        result.steps.push('Restored to pre-rollback state')
      } catch (recoveryError) {
        console.error('Recovery failed:', recoveryError)
        result.steps.push('Recovery failed - manual intervention required')
      }
    }
    
    return result
  }
  
  private async validateRollback(): Promise<ValidationResult> {
    // 验证所有核心功能
    const tests = [
      () => this.testCardOperations(),
      () => this.testSearchFunctionality(),
      () => this.testSyncOperations(),
      () => this testDataIntegrity()
    ]
    
    const results = await Promise.allSettled(tests.map(test => test()))
    
    return {
      success: results.every(r => r.status === 'fulfilled'),
      failures: results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason)
    }
  }
}
```

## 4. 风险控制

### 4.1 数据安全措施

1. **多重备份**: 迁移前创建多个备份
2. **校验机制**: 每个迁移步骤都有数据校验
3. **事务保护**: 关键操作使用数据库事务
4. **监控告警**: 实时监控迁移状态
5. **人工审核**: 关键步骤需要人工确认

### 4.2 性能保障

1. **分批处理**: 大数据量分批迁移
2. **限流控制**: 控制迁移速度避免影响系统
3. **资源监控**: 监控系统资源使用情况
4. **降级方案**: 性能问题时的降级策略

### 4.3 用户体验

1. **透明通知**: 迁移前通知用户
2. **进度显示**: 迁移进度实时显示
3. **功能降级**: 迁移期间降级非核心功能
4. **快速回滚**: 用户体验问题快速回滚