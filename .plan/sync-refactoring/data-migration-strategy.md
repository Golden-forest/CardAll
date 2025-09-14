# CardEverything 数据迁移策略文档

## 📋 文档信息

- **文档版本**: 2.0.0
- **创建日期**: 2025-01-13
- **最后更新**: 2025-01-13
- **作者**: Database-Architect
- **适用范围**: CardEverything 同步服务重构项目
- **依赖任务**: W1-T002 数据存储架构分析, W1-T006 统一架构设计
- **任务状态**: W1-T008 进行中

## 🎯 执行摘要

本数据迁移策略文档为CardEverything同步服务重构项目提供了完整的数据迁移解决方案。基于W1-T002数据存储架构分析和W1-T006统一架构设计的深入分析，我们设计了支持三重同步服务统一的数据迁移方案。

### 核心目标
1. **架构统一**: 将三个独立的同步服务（CloudSyncService、OptimizedCloudSyncService、UnifiedSyncService）统一到单一架构
2. **零停机迁移**: 确保用户在迁移过程中无感知服务中断
3. **数据一致性**: 保证IndexedDB本地数据与Supabase云端数据的完全一致
4. **向后兼容**: 通过API兼容层确保现有UI组件无需修改即可平滑迁移
5. **性能优化**: 迁移后实现70-80%的性能提升目标

### 迁移范围
- **本地数据库**: IndexedDB schema统一和优化
- **云端数据库**: Supabase数据模型同步
- **同步机制**: 统一同步队列和冲突解决机制
- **用户数据**: 卡片、文件夹、标签、图片等核心实体数据

## 📊 现有数据架构分析

### 1. 数据库文件差异分析

#### 1.1 database.ts (当前统一版本) - 版本3
**核心特性：**
- **数据库版本**: 3.0.0
- **表结构**: 7个核心表（cards, folders, tags, images, syncQueue, settings, sessions）
- **索引策略**: 优化的复合索引设计
- **同步机制**: 完整的syncVersion和pendingSync字段
- **用户支持**: 完整的多用户支持
- **图片管理**: 独立的DbImage实体，支持多种存储模式

**关键数据模型：**
```typescript
interface DbCard extends SyncableEntity {
  searchVector?: string    // 全文搜索优化
  thumbnailUrl?: string    // 缩略图支持
  folderId?: string        // 文件夹关联
}

interface DbImage {
  storageMode: 'indexeddb' | 'filesystem' | 'cloud'
  metadata: {              // 完整的元数据
    size: number
    width: number
    height: number
    format: string
    compressed: boolean
  }
}
```

#### 1.2 database-simple.ts (已移除版本) - 版本1
**核心特性：**
- **数据库版本**: 1.0.0
- **表结构**: 5个基本表（缺少images和sessions）
- **索引策略**: 基础索引，缺少复合索引
- **同步机制**: 基础版本控制
- **用户支持**: 基础用户字段
- **图片管理**: 无独立图片表

### 2. 数据模型冲突识别

#### 2.1 字段命名不一致
| 实体 | database.ts | database-simple.ts | 统一方案 |
|------|-------------|-------------------|----------|
| 同步操作 | `entity: 'card' \| 'folder' \| 'tag' \| 'image'` | `table: 'cards' \| 'folders' \| 'tags' \| 'images'` | 使用entity字段 |
| 用户ID | `userId?: string` | `userId?: string` | 保持现有字段 |
| 同步版本 | `syncVersion: number` | `syncVersion: number` | 保持现有字段 |

#### 2.2 数据类型差异
```typescript
// database.ts 中的 SyncOperation
interface SyncOperation {
  entity: 'card' | 'folder' | 'tag' | 'image'  // 单数形式
  entityId: string                              // 实体ID
  priority: 'high' | 'normal' | 'low'         // 优先级字段
}

// database-simple.ts 中的 SyncOperation
interface LegacySyncOperation {
  table: 'cards' | 'folders' | 'tags' | 'images' // 复数形式
  localId: string                              // 本地ID
  // 缺少优先级字段
}
```

### 3. 数据量和复杂度评估

#### 3.1 当前数据规模估算
- **卡片数量**: 预计 1,000-10,000 张
- **文件夹数量**: 预计 100-500 个
- **标签数量**: 预计 500-2,000 个
- **图片数量**: 预计 2,000-20,000 个
- **总数据量**: 预计 100MB-1GB

#### 3.2 复杂度评估
- **关系复杂度**: 中等（文件夹层级、标签关联）
- **数据依赖**: 高（卡片依赖文件夹、图片依赖卡片）
- **同步复杂度**: 高（多版本、并发操作）
- **迁移风险**: 中等（需要保持数据一致性）

### 4. 统一架构下的数据迁移挑战

#### 4.1 三重同步服务统一挑战
基于W1-T006统一架构设计和W1-T002架构分析，我们识别出以下关键迁移挑战：

| 挑战类型 | 描述 | 风险等级 | 解决方案 |
|----------|------|----------|----------|
| **数据模型差异** | 三个服务使用不同的数据结构和字段命名 | 🟡 中等 | 统一数据模型，建立映射表 |
| **同步机制冲突** | 不同服务的同步队列和冲突解决机制不兼容 | 🔴 高 | 统一同步引擎，兼容层适配 |
| **API接口不统一** | 现有UI组件依赖不同的同步服务API | 🟡 中等 | API兼容层适配器 |
| **数据一致性问题** | 多服务并行可能导致数据不一致 | 🔴 高 | 强一致性检查和修复机制 |
| **性能影响** | 迁移过程可能影响系统性能 | 🟡 中等 | 渐进式迁移，性能监控 |

#### 4.2 基于统一架构的数据映射
根据统一架构设计（W1-T006），建立数据映射关系：

```typescript
// 统一数据模型
interface UnifiedDataModel {
  // 核心实体
  cards: UnifiedCard[]
  folders: UnifiedFolder[]
  tags: UnifiedTag[]
  images: UnifiedImage[]

  // 同步元数据
  syncQueue: UnifiedSyncOperation[]
  syncState: UnifiedSyncState

  // 用户数据
  users: UnifiedUser[]
  userSettings: UnifiedUserSettings
}

// 统一卡片实体
interface UnifiedCard extends SyncableEntity {
  id: string
  userId: string
  frontContent: CardContent
  backContent: CardContent
  style: CardStyle
  folderId?: string
  tags: string[]
  images: string[]
  searchVector?: string
  thumbnailUrl?: string
  createdAt: Date
  updatedAt: Date
  syncVersion: number
  isDeleted: boolean
}
```

### 5. 数据依赖关系分析

#### 5.1 核心依赖链
```
用户 → 文件夹 → 卡片 → 图片
  ↓        ↓       ↓
  设置     标签    同步队列
```

#### 4.2 迁移优先级
1. **最高优先级**: 用户会话和设置
2. **高优先级**: 文件夹结构和标签
3. **中优先级**: 卡片数据
4. **低优先级**: 图片和同步队列

## 🏗️ 基于统一架构的迁移策略设计

基于W1-T006统一架构设计和API兼容层设计（W1-T007），我们设计了三阶段渐进式迁移策略：

### 1. 阶段划分和执行路径

#### 1.1 第一阶段：兼容层部署 (Week 1-2)
**目标**: 部署API兼容层，确保现有功能正常运行

```typescript
// 兼容层部署策略
export class CompatibilityLayerDeployment {
  async deployCompatibilityLayer(): Promise<DeploymentResult> {
    const steps = [
      '部署SyncServiceAdapter',
      '配置过渡模式 (transition mode)',
      '建立服务映射关系',
      '启用API兼容性测试',
      '监控现有功能表现'
    ]

    const results = await this.executeDeploymentSteps(steps)

    return {
      success: results.every(r => r.success),
      compatibilityMode: 'transition',
      backwardCompatibility: true,
      performanceImpact: '< 5%',
      rollbackAvailable: true
    }
  }
}
```

#### 1.2 第二阶段：数据统一迁移 (Week 3-4)
**目标**: 统一IndexedDB和Supabase数据模型，实现无缝数据同步

```typescript
// 数据统一迁移策略
export class DataUnificationMigration {
  async migrateToUnifiedSchema(): Promise<MigrationResult> {
    const migrationPlan = {
      // 1. IndexedDB Schema升级
      indexedDbUpgrade: {
        version: '3.0.0 → 4.0.0',
        changes: [
          '统一实体命名规范',
          '添加sync_version字段',
          '优化索引结构',
          '建立数据关联关系'
        ]
      },

      // 2. Supabase数据同步
      supabaseSync: {
        strategy: 'bidirectional',
        conflictResolution: 'last-write-wins',
        validationLevel: 'strict'
      },

      // 3. API兼容层切换
      apiLayerTransition: {
        fromMode: 'transition',
        toMode: 'unified',
        rollbackPoint: true
      }
    }

    return await this.executeUnifiedMigration(migrationPlan)
  }
}
```

#### 1.3 第三阶段：性能优化和稳定化 (Week 5-6)
**目标**: 优化同步性能，实现70-80%性能提升目标

```typescript
// 性能优化策略
export class PerformanceOptimization {
  async optimizeSyncPerformance(): Promise<OptimizationResult> {
    const optimizations = [
      {
        type: 'cache',
        description: '实现智能缓存机制',
        expectedImprovement: '30%'
      },
      {
        type: 'batching',
        description: '批量同步操作优化',
        expectedImprovement: '25%'
      },
      {
        type: 'indexing',
        description: '数据库索引优化',
        expectedImprovement: '15%'
      },
      {
        type: 'network',
        description: '网络请求优化',
        expectedImprovement: '10%'
      }
    ]

    const results = await this.applyOptimizations(optimizations)

    return {
      totalImprovement: this.calculateTotalImprovement(results),
      targetsAchieved: results.every(r => r.success),
      baselineMetrics: await this.captureBaselineMetrics(),
      optimizedMetrics: await this.captureOptimizedMetrics()
    }
  }
}
```

### 2. API兼容层集成策略

#### 2.1 渐进式API迁移
基于API兼容层设计文档，实现无缝API迁移：

```typescript
// API兼容层集成
export class APICompatibilityIntegration {
  async integrateWithMigration(): Promise<IntegrationResult> {
    // 1. 模块别名配置
    await this.configureModuleAliases({
      '@/services/cloud-sync': '@/adapters/sync-service-adapter',
      '@/services/optimized-cloud-sync': '@/adapters/sync-service-adapter',
      '@/services/unified-sync-service': '@/adapters/sync-service-adapter'
    })

    // 2. Hooks适配器部署
    await this.deployHooksAdapters({
      useCardsDb: 'compatible',
      useFoldersDb: 'compatible',
      useTagsDb: 'compatible'
    })

    // 3. 状态指示器适配
    await this.adaptStatusIndicators({
      SyncStatusIndicator: 'unified',
      SyncProgressBar: 'enhanced'
    })

    return {
      apiCompatibility: '100%',
      componentMigration: '0%', // 开始渐进迁移
      performanceImpact: '< 10%',
      rollbackCapability: true
    }
  }
}
```

#### 2.2 组件渐进迁移策略
```typescript
// 组件迁移管理
export class ComponentMigrationManager {
  async migrateComponentsGradually(): Promise<MigrationProgress> {
    const migrationOrder = [
      // 第一批：低风险组件
      { component: 'SyncStatusIndicator', risk: 'low', priority: 1 },
      { component: 'useCardsDb', risk: 'low', priority: 1 },

      // 第二批：中风险组件
      { component: 'CardEditor', risk: 'medium', priority: 2 },
      { component: 'FolderManager', risk: 'medium', priority: 2 },

      // 第三批：高风险组件
      { component: 'SyncEngine', risk: 'high', priority: 3 },
      { component: 'ConflictResolver', risk: 'high', priority: 3 }
    ]

    let progress = 0
    const totalComponents = migrationOrder.length

    for (const component of migrationOrder) {
      await this.migrateSingleComponent(component)
      progress = Math.round((migrationOrder.indexOf(component) + 1) / totalComponents * 100)

      // 监控迁移效果
      await this.monitorMigrationImpact(component)

      // 如果出现问题，暂停迁移
      if (await this.detectMigrationIssues()) {
        await this.pauseMigration(component)
        break
      }
    }

    return { progress: `${progress}%`, migratedComponents: progress }
  }
}
```

### 3. 数据一致性保障机制

#### 3.1 实时一致性检查
```typescript
// 数据一致性验证
export class DataConsistencyValidator {
  async validateDataConsistency(): Promise<ConsistencyResult> {
    const checks = [
      {
        type: 'entity_count',
        description: '本地和云端实体数量一致性',
        critical: true
      },
      {
        type: 'data_integrity',
        description: '数据完整性和关联关系检查',
        critical: true
      },
      {
        type: 'sync_version',
        description: '同步版本号一致性',
        critical: false
      },
      {
        type: 'timestamp_consistency',
        description: '时间戳一致性检查',
        critical: false
      }
    ]

    const results = await this.executeConsistencyChecks(checks)

    return {
      overallConsistency: this.calculateOverallConsistency(results),
      criticalIssues: results.filter(r => r.critical && !r.passed),
      warnings: results.filter(r => !r.critical && !r.passed),
      recommendations: this.generateRecommendations(results)
    }
  }
}
```

#### 3.2 自动修复机制
```typescript
// 自动修复系统
export class AutoRepairSystem {
  async repairInconsistencies(issues: ConsistencyIssue[]): Promise<RepairResult> {
    const repairs = []

    for (const issue of issues) {
      switch (issue.type) {
        case 'entity_count_mismatch':
          repairs.push(await this.repairEntityCountMismatch(issue))
          break
        case 'data_integrity_violation':
          repairs.push(await this.repairDataIntegrity(issue))
          break
        case 'sync_version_conflict':
          repairs.push(await this.repairSyncVersionConflict(issue))
          break
        case 'timestamp_inconsistency':
          repairs.push(await this.repairTimestampInconsistency(issue))
          break
      }
    }

    return {
      totalIssues: issues.length,
      repairedIssues: repairs.filter(r => r.success).length,
      failedRepairs: repairs.filter(r => !r.success).length,
      repairDetails: repairs
    }
  }
}
```

### 4. 性能监控和优化

#### 4.1 实时性能监控
```typescript
// 性能监控系统
export class MigrationPerformanceMonitor {
  async monitorMigrationPerformance(): Promise<PerformanceMetrics> {
    const metrics = {
      syncLatency: await this.measureSyncLatency(),
      memoryUsage: await this.measureMemoryUsage(),
      networkThroughput: await this.measureNetworkThroughput(),
      databasePerformance: await this.measureDatabasePerformance(),
      uiResponsiveness: await this.measureUIResponsiveness()
    }

    // 性能阈值检查
    const thresholds = {
      syncLatency: { max: 100, current: metrics.syncLatency },
      memoryUsage: { max: 500, current: metrics.memoryUsage },
      networkThroughput: { min: 1000, current: metrics.networkThroughput }
    }

    return {
      metrics,
      thresholds,
      performanceScore: this.calculatePerformanceScore(metrics, thresholds),
      recommendations: this.generatePerformanceRecommendations(metrics, thresholds)
    }
  }
}
```

#### 4.2 自适应优化策略
```typescript
// 自适应优化器
export class AdaptiveOptimizer {
  async optimizeBasedOnMetrics(metrics: PerformanceMetrics): Promise<OptimizationAction[]> {
    const actions = []

    // 基于指标自动调整优化策略
    if (metrics.syncLatency > 100) {
      actions.push({
        type: 'increase_batch_size',
        description: '增加批量同步大小以减少网络请求',
        expectedImprovement: '20%'
      })
    }

    if (metrics.memoryUsage > 500) {
      actions.push({
        type: 'enable_memory_optimization',
        description: '启用内存优化模式',
        expectedImprovement: '30%'
      })
    }

    if (metrics.networkThroughput < 1000) {
      actions.push({
        type: 'enable_compression',
        description: '启用数据压缩',
        expectedImprovement: '40%'
      })
    }

    return actions
  }
}
```

## 🏗️ 统一数据模型设计

### 1. 设计原则

1. **向后兼容**: 支持现有API和数据格式
2. **类型安全**: 完整的TypeScript类型定义
3. **性能优化**: 优化的索引和查询策略
4. **可扩展性**: 支持未来功能扩展
5. **一致性**: 统一的数据模型和命名规范

### 2. 统一数据模型

#### 2.1 基础接口设计
```typescript
// 基础同步接口
export interface SyncableEntity {
  id?: string
  userId?: string
  syncVersion: number
  lastSyncAt?: Date
  pendingSync: boolean
  updatedAt: Date
}

// 统一实体枚举
export enum EntityType {
  CARD = 'card',
  FOLDER = 'folder',
  TAG = 'tag',
  IMAGE = 'image',
  SETTING = 'setting',
  SESSION = 'session'
}

// 统一操作类型
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}
```

#### 2.2 核心实体统一
```typescript
// 统一的卡片实体
export interface UnifiedDbCard extends Omit<Card, 'id'>, SyncableEntity {
  id?: string
  // 优化字段
  searchVector?: string        // 全文搜索向量
  thumbnailUrl?: string        // 卡片缩略图
  fullPath?: string           // 完整路径索引
  // 向后兼容字段
  folderId?: string
}

// 统一的图片实体
export interface UnifiedDbImage {
  id?: string
  cardId: string
  userId?: string
  fileName: string
  filePath: string
  cloudUrl?: string
  thumbnailPath?: string
  metadata: ImageMetadata
  storageMode: StorageMode
  // 同步字段
  syncVersion: number
  lastSyncAt?: Date
  pendingSync: boolean
  updatedAt: Date
}

// 统一的同步操作
export interface UnifiedSyncOperation {
  id?: string
  type: OperationType
  entity: EntityType
  entityId: string
  userId?: string
  data?: any
  timestamp: Date
  retryCount: number
  maxRetries: number
  error?: string
  priority: SyncPriority
  status: SyncStatus
}
```

### 3. 数据库版本迁移策略

#### 3.1 版本升级路径
```
Version 1 (database-simple) → Version 2 → Version 3 (database.ts) → Version 4 (unified)
```

#### 3.2 版本特性对比
| 版本 | 主要特性 | 迁移复杂度 | 向后兼容 |
|------|----------|------------|----------|
| v1.0 | 基础功能 | - | 基准 |
| v2.0 | 用户支持 | 低 | 完全 |
| v3.0 | 图片管理 | 中 | 完全 |
| v4.0 | 统一架构 | 高 | 完全 |

#### 3.3 数据库升级脚本
```typescript
class DatabaseMigrator {
  async migrateFromV1toV2(): Promise<void> {
    // 添加用户支持
    // 迁移现有数据，设置默认用户
  }

  async migrateFromV2toV3(): Promise<void> {
    // 添加图片管理表
    // 优化索引结构
    // 迁移现有图片数据
  }

  async migrateFromV3toV4(): Promise<void> {
    // 重构表结构
    // 统一数据模型
    // 添加离线持久化功能
  }
}
```

### 4. 向后兼容性保证

#### 4.1 API兼容层
```typescript
// 向后兼容的适配器
export class BackwardCompatibilityAdapter {
  // 旧版API调用转换
  async getSettingLegacy(key: string): Promise<any> {
    return await this.unifiedDb.getSetting(key)
  }

  // 数据格式转换
  convertLegacyToUnified(legacyData: any): UnifiedData {
    // 实现数据格式转换逻辑
  }

  convertUnifiedToLegacy(unifiedData: UnifiedData): any {
    // 实现统一格式到旧格式的转换
  }
}
```

#### 4.2 数据验证机制
```typescript
export class DataValidator {
  validateCardData(card: Partial<Card>): ValidationResult {
    // 验证卡片数据完整性
  }

  validateImageData(image: Partial<ImageData>): ValidationResult {
    // 验证图片数据完整性
  }

  validateConsistency(): ConsistencyReport {
    // 验证整体数据一致性
  }
}
```

## 🔄 零停机迁移策略

### 1. 迁移设计原则

1. **服务连续性**: 迁移过程中保持应用可用
2. **数据一致性**: 确保迁移前后数据完全一致
3. **可回滚性**: 任何阶段都可以安全回滚
4. **渐进式迁移**: 分阶段降低风险
5. **实时监控**: 全程监控迁移状态

### 2. 迁移执行流程

#### 2.1 迁移前准备阶段
```typescript
export class MigrationPreparation {
  async prepareMigration(): Promise<MigrationContext> {
    const context: MigrationContext = {
      timestamp: new Date(),
      sourceVersion: await this.detectCurrentVersion(),
      targetVersion: '4.0.0',
      backup: null,
      validation: null,
      rollbackPoint: null
    }

    // 1. 检测当前数据库版本
    // 2. 创建完整备份
    // 3. 验证数据完整性
    // 4. 设置回滚点
    // 5. 预估迁移时间和资源需求

    return context
  }

  async createBackup(): Promise<DatabaseBackup> {
    // 创建完整数据库备份
    // 包括所有表和索引
    // 计算数据哈希用于验证
  }

  async validateDataIntegrity(): Promise<DataValidation> {
    // 验证所有数据的完整性
    // 检查外键约束
    // 检查数据格式一致性
  }
}
```

#### 2.2 数据迁移阶段
```typescript
export class DataMigration {
  async executeMigration(context: MigrationContext): Promise<MigrationResult> {
    try {
      // 阶段1: 元数据迁移
      await this.migrateMetadata(context)

      // 阶段2: 核心数据迁移
      await this.migrateCoreData(context)

      // 阶段3: 关联数据迁移
      await this.migrateRelatedData(context)

      // 阶段4: 索引重建
      await this.rebuildIndexes(context)

      // 阶段5: 数据验证
      await this.validateMigration(context)

      return {
        success: true,
        timestamp: new Date(),
        recordsMigrated: context.recordsMigrated,
        duration: context.duration
      }
    } catch (error) {
      // 自动触发回滚
      await this.rollbackMigration(context, error)
      throw error
    }
  }

  private async migrateMetadata(context: MigrationContext): Promise<void> {
    // 迁移用户设置、配置等元数据
    // 这些数据通常体积小，但很重要
  }

  private async migrateCoreData(context: MigrationContext): Promise<void> {
    // 分批迁移核心业务数据
    // 实现分页处理，避免内存问题
  }

  private async migrateRelatedData(context: MigrationContext): Promise<void> {
    // 迁移关联数据，如图片、附件等
    // 这些数据可能体积较大，需要特殊处理
  }
}
```

#### 2.3 迁移后验证阶段
```typescript
export class MigrationVerification {
  async verifyMigration(context: MigrationContext): Promise<VerificationResult> {
    const result: VerificationResult = {
      timestamp: new Date(),
      dataIntegrity: false,
      performanceMetrics: null,
      userImpact: null
    }

    // 1. 数据完整性验证
    result.dataIntegrity = await this.verifyDataIntegrity(context)

    // 2. 性能基准测试
    result.performanceMetrics = await this.benchmarkPerformance()

    // 3. 用户体验评估
    result.userImpact = await this.assessUserImpact()

    return result
  }

  private async verifyDataIntegrity(context: MigrationContext): Promise<boolean> {
    // 对比迁移前后的数据
    // 验证记录数量一致性
    // 验证数据内容完整性
    // 验证关联关系正确性
  }
}
```

### 3. 数据分批处理策略

#### 3.1 批处理配置
```typescript
export interface BatchConfig {
  batchSize: number                    // 每批处理的记录数
  maxConcurrentBatches: number        // 最大并发批次数
  retryAttempts: number              // 重试次数
  retryDelay: number                 // 重试延迟(ms)
  timeout: number                    // 批处理超时(ms)
  progressInterval: number           // 进度报告间隔(ms)
}

export const MIGRATION_BATCH_CONFIG: BatchConfig = {
  batchSize: 1000,                  // 每批1000条记录
  maxConcurrentBatches: 3,          // 最多3个并发批次
  retryAttempts: 3,                  // 最多重试3次
  retryDelay: 1000,                 // 重试间隔1秒
  timeout: 30000,                   // 批处理超时30秒
  progressInterval: 2000            // 每2秒报告进度
}
```

#### 3.2 批处理执行器
```typescript
export class BatchMigrationExecutor {
  async executeBatches<T>(
    items: T[],
    processor: (batch: T[]) => Promise<BatchResult>,
    config: BatchConfig = MIGRATION_BATCH_CONFIG
  ): Promise<MigrationProgress> {
    const progress: MigrationProgress = {
      totalItems: items.length,
      processedItems: 0,
      failedItems: 0,
      startTime: new Date(),
      batches: []
    }

    // 创建批次
    const batches = this.createBatches(items, config.batchSize)

    // 并发执行批次
    const semaphore = new Semaphore(config.maxConcurrentBatches)
    const batchPromises = batches.map(async (batch) => {
      await semaphore.acquire()
      try {
        const result = await this.executeBatchWithRetry(batch, processor, config)
        progress.batches.push(result)
        progress.processedItems += result.processedCount
        progress.failedItems += result.failedCount
        return result
      } finally {
        semaphore.release()
      }
    })

    await Promise.all(batchPromises)
    progress.endTime = new Date()

    return progress
  }

  private async executeBatchWithRetry<T>(
    batch: T[],
    processor: (batch: T[]) => Promise<BatchResult>,
    config: BatchConfig
  ): Promise<BatchResult> {
    let attempts = 0
    let lastError: Error | null = null

    while (attempts < config.retryAttempts) {
      try {
        const result = await Promise.race([
          processor(batch),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Batch timeout')), config.timeout)
          )
        ])
        return result
      } catch (error) {
        lastError = error as Error
        attempts++
        if (attempts < config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, config.retryDelay))
        }
      }
    }

    throw lastError || new Error('Batch processing failed')
  }
}
```

### 4. 事务性迁移机制

#### 4.1 事务管理器
```typescript
export class TransactionalMigration {
  async executeInTransaction<T>(
    operations: () => Promise<T>,
    context: MigrationContext
  ): Promise<T> {
    const transactionId = crypto.randomUUID()

    try {
      context.currentTransaction = {
        id: transactionId,
        startTime: new Date(),
        operations: []
      }

      // 开始事务
      await this.beginTransaction(transactionId)

      // 执行操作
      const result = await operations()

      // 提交事务
      await this.commitTransaction(transactionId)

      context.currentTransaction.endTime = new Date()
      context.currentTransaction.status = 'completed'

      return result
    } catch (error) {
      // 回滚事务
      await this.rollbackTransaction(transactionId)

      context.currentTransaction.endTime = new Date()
      context.currentTransaction.status = 'failed'
      context.currentTransaction.error = error as Error

      throw error
    }
  }

  private async beginTransaction(transactionId: string): Promise<void> {
    // 实现事务开始逻辑
    // 可以使用IndexedDB事务或模拟事务
  }

  private async commitTransaction(transactionId: string): Promise<void> {
    // 实现事务提交逻辑
  }

  private async rollbackTransaction(transactionId: string): Promise<void> {
    // 实现事务回滚逻辑
    // 恢复事务开始前的状态
  }
}
```

#### 4.2 检查点和恢复机制
```typescript
export class CheckpointManager {
  async createCheckpoint(context: MigrationContext): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      migrationId: context.id,
      progress: context.getProgress(),
      state: await this.captureState(),
      checksum: await this.calculateChecksum()
    }

    // 保存检查点
    await this.saveCheckpoint(checkpoint)

    return checkpoint
  }

  async restoreFromCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = await this.loadCheckpoint(checkpointId)

    // 验证检查点完整性
    if (!await this.verifyCheckpoint(checkpoint)) {
      throw new Error('Checkpoint verification failed')
    }

    // 恢复状态
    await this.restoreState(checkpoint.state)

    // 更新迁移上下文
    context.restoreFromCheckpoint(checkpoint)
  }

  async cleanupOldCheckpoints(retentionDays: number = 7): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    await this.deleteCheckpointsBefore(cutoffDate)
  }
}
```

## 🛡️ 数据安全保证策略

### 1. 数据备份和恢复机制

#### 1.1 多层备份策略
```typescript
export interface BackupStrategy {
  fullBackup: BackupConfig           // 完整备份配置
  incrementalBackup: BackupConfig    // 增量备份配置
  preMigrationBackup: BackupConfig   // 迁移前备份配置
  rollbackBackup: BackupConfig       // 回滚备份配置
}

export interface BackupConfig {
  enabled: boolean
  compression: boolean
  encryption: boolean
  retention: number                 // 保留天数
  schedule: BackupSchedule
  storage: BackupStorage
}

export const DEFAULT_BACKUP_STRATEGY: BackupStrategy = {
  fullBackup: {
    enabled: true,
    compression: true,
    encryption: true,
    retention: 30,
    schedule: { type: 'daily', time: '02:00' },
    storage: { type: 'local', path: './backups' }
  },
  incrementalBackup: {
    enabled: true,
    compression: true,
    encryption: true,
    retention: 7,
    schedule: { type: 'hourly', interval: 4 },
    storage: { type: 'local', path: './backups/incremental' }
  },
  preMigrationBackup: {
    enabled: true,
    compression: true,
    encryption: true,
    retention: 90,
    schedule: { type: 'manual' },
    storage: { type: 'multiple', locations: ['local', 'cloud'] }
  },
  rollbackBackup: {
    enabled: true,
    compression: true,
    encryption: true,
    retention: 30,
    schedule: { type: 'auto', trigger: 'migration' },
    storage: { type: 'local', path: './backups/rollback' }
  }
}
```

#### 1.2 备份执行器
```typescript
export class BackupExecutor {
  async createFullBackup(): Promise<BackupResult> {
    const backupId = crypto.randomUUID()
    const startTime = new Date()

    try {
      // 1. 获取数据库统计信息
      const stats = await this.getDatabaseStats()

      // 2. 创建临时目录
      const tempDir = await this.createTempDirectory()

      // 3. 导出数据
      const data = await this.exportAllData()

      // 4. 压缩数据
      const compressedData = await this.compressData(data)

      // 5. 加密数据
      const encryptedData = await this.encryptData(compressedData)

      // 6. 计算校验和
      const checksum = await this.calculateChecksum(encryptedData)

      // 7. 保存备份
      const backupPath = await this.saveBackup(backupId, encryptedData)

      // 8. 记录元数据
      const metadata: BackupMetadata = {
        id: backupId,
        type: 'full',
        timestamp: startTime,
        size: encryptedData.byteLength,
        checksum,
        stats,
        path: backupPath
      }

      await this.saveBackupMetadata(metadata)

      return {
        success: true,
        backupId,
        metadata,
        duration: Date.now() - startTime.getTime()
      }
    } catch (error) {
      await this.cleanupTempFiles(tempDir)
      throw error
    }
  }

  async restoreFromBackup(backupId: string): Promise<RestoreResult> {
    const startTime = new Date()

    try {
      // 1. 加载备份元数据
      const metadata = await this.loadBackupMetadata(backupId)

      // 2. 验证备份完整性
      if (!await this.verifyBackupIntegrity(metadata)) {
        throw new Error('Backup integrity verification failed')
      }

      // 3. 创建当前状态备份（回滚点）
      await this.createRollbackPoint()

      // 4. 解密数据
      const encryptedData = await this.loadBackupData(metadata.path)
      const decryptedData = await this.decryptData(encryptedData)

      // 5. 解压数据
      const data = await this.decompressData(decryptedData)

      // 6. 导入数据
      await this.importAllData(data)

      // 7. 验证恢复结果
      const validationResult = await this.validateRestoredData(metadata)

      return {
        success: true,
        backupId,
        metadata,
        validation: validationResult,
        duration: Date.now() - startTime.getTime()
      }
    } catch (error) {
      // 恢复失败时自动回滚
      await this.rollbackToLastPoint()
      throw error
    }
  }
}
```

### 2. 数据加密和保护

#### 2.1 加密策略
```typescript
export class DataEncryption {
  private readonly encryptionKey: CryptoKey

  constructor(private readonly keyStorage: KeyStorage) {
    this.encryptionKey = keyStorage.getOrCreateKey()
  }

  async encryptData(data: Uint8Array): Promise<Uint8Array> {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const algorithm = { name: 'AES-GCM', iv }

    const encryptedData = await crypto.subtle.encrypt(
      algorithm,
      this.encryptionKey,
      data
    )

    // 组合 IV + 加密数据
    const result = new Uint8Array(iv.length + encryptedData.byteLength)
    result.set(iv)
    result.set(new Uint8Array(encryptedData), iv.length)

    return result
  }

  async decryptData(encryptedData: Uint8Array): Promise<Uint8Array> {
    const iv = encryptedData.slice(0, 12)
    const data = encryptedData.slice(12)

    const algorithm = { name: 'AES-GCM', iv }

    const decryptedData = await crypto.subtle.decrypt(
      algorithm,
      this.encryptionKey,
      data
    )

    return new Uint8Array(decryptedData)
  }

  async hashData(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
}
```

#### 2.2 密钥管理
```typescript
export class KeyStorage {
  async getOrCreateKey(): Promise<CryptoKey> {
    try {
      // 尝试从安全存储获取现有密钥
      const existingKey = await this.loadKey()
      if (existingKey) {
        return existingKey
      }
    } catch (error) {
      console.warn('Failed to load existing key, creating new one')
    }

    // 生成新密钥
    return await this.generateAndStoreKey()
  }

  private async generateAndStoreKey(): Promise<CryptoKey> {
    const key = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    )

    // 导出并存储密钥（实际实现应该使用更安全的方式）
    const exportedKey = await crypto.subtle.exportKey('raw', key)
    await this.storeKey(exportedKey)

    return key
  }

  private async storeKey(keyData: ArrayBuffer): Promise<void> {
    // 在实际实现中，应该使用浏览器提供的更安全的存储方式
    // 例如：Credential Management API 或 Secure Storage
    const encryptedKeyData = await this.encryptForStorage(keyData)
    localStorage.setItem('encryption_key', JSON.stringify({
      data: Array.from(new Uint8Array(encryptedKeyData)),
      salt: Array.from(this.generateSalt())
    }))
  }

  private async loadKey(): Promise<CryptoKey | null> {
    try {
      const stored = localStorage.getItem('encryption_key')
      if (!stored) return null

      const { data, salt } = JSON.parse(stored)
      const keyData = await this.decryptFromStorage(
        new Uint8Array(data),
        new Uint8Array(salt)
      )

      return await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      )
    } catch (error) {
      console.error('Failed to load encryption key:', error)
      return null
    }
  }
}
```

### 3. 数据一致性验证

#### 3.1 完整性检查器
```typescript
export class DataConsistencyChecker {
  async checkDataConsistency(): Promise<ConsistencyReport> {
    const report: ConsistencyReport = {
      timestamp: new Date(),
      totalRecords: 0,
      inconsistencies: [],
      warnings: [],
      isValid: true
    }

    // 检查所有表的记录数一致性
    await this.checkRecordCounts(report)

    // 检查外键约束
    await this.checkForeignKeys(report)

    // 检查数据格式一致性
    await this.checkDataFormats(report)

    // 检查索引一致性
    await this.checkIndexConsistency(report)

    // 检查同步状态一致性
    await this.checkSyncConsistency(report)

    report.isValid = report.inconsistencies.length === 0

    return report
  }

  private async checkRecordCounts(report: ConsistencyReport): Promise<void> {
    const [cardCount, folderCount, tagCount, imageCount] = await Promise.all([
      db.cards.count(),
      db.folders.count(),
      db.tags.count(),
      db.images.count()
    ])

    report.totalRecords = cardCount + folderCount + tagCount + imageCount

    // 检查是否有意外的零记录数
    if (cardCount === 0 && (folderCount > 0 || tagCount > 0)) {
      report.inconsistencies.push({
        type: 'record_count',
        severity: 'high',
        message: 'Cards table is empty but other tables have data',
        details: { cardCount, folderCount, tagCount }
      })
    }
  }

  private async checkForeignKeys(report: ConsistencyReport): Promise<void> {
    // 检查卡片的folderId是否有效
    const invalidFolderCards = await db.cards
      .filter(card => card.folderId && !this.isValidFolderId(card.folderId))
      .count()

    if (invalidFolderCards > 0) {
      report.inconsistencies.push({
        type: 'foreign_key',
        severity: 'medium',
        message: `Found ${invalidFolderCards} cards with invalid folder references`,
        details: { invalidCount: invalidFolderCards }
      })
    }

    // 检查图片的cardId是否有效
    const orphanedImages = await db.images
      .filter(image => !this.isValidCardId(image.cardId))
      .count()

    if (orphanedImages > 0) {
      report.warnings.push({
        type: 'orphaned_data',
        severity: 'low',
        message: `Found ${orphanedImages} orphaned images`,
        details: { orphanedCount: orphanedImages }
      })
    }
  }

  private async checkSyncConsistency(report: ConsistencyReport): Promise<void> {
    // 检查syncVersion的一致性
    const inconsistentSyncVersions = await this.findInconsistentSyncVersions()

    if (inconsistentSyncVersions.length > 0) {
      report.inconsistencies.push({
        type: 'sync_consistency',
        severity: 'high',
        message: 'Found inconsistent sync versions',
        details: { entities: inconsistentSyncVersions }
      })
    }
  }
}
```

### 4. 应急响应预案

#### 4.1 应急响应流程
```typescript
export class EmergencyResponse {
  private alertSystem: AlertSystem
  private rollbackManager: RollbackManager
  private notificationService: NotificationService

  async handleMigrationFailure(error: Error, context: MigrationContext): Promise<void> {
    const severity = this.assessSeverity(error, context)

    // 1. 立即暂停迁移
    await this.pauseMigration()

    // 2. 发送告警
    await this.alertSystem.sendAlert({
      type: 'migration_failure',
      severity,
      message: error.message,
      context: this.sanitizeContext(context),
      timestamp: new Date()
    })

    // 3. 启动诊断
    const diagnosis = await this.diagnoseFailure(error, context)

    // 4. 根据严重程度采取行动
    switch (severity) {
      case 'critical':
        await this.handleCriticalFailure(error, context, diagnosis)
        break
      case 'high':
        await this.handleHighSeverityFailure(error, context, diagnosis)
        break
      case 'medium':
        await this.handleMediumSeverityFailure(error, context, diagnosis)
        break
      case 'low':
        await this.handleLowSeverityFailure(error, context, diagnosis)
        break
    }

    // 5. 通知相关人员
    await this.notificationService.notifyStakeholders({
      event: 'migration_failure',
      severity,
      details: diagnosis,
      estimatedResolution: this.estimateResolutionTime(severity)
    })
  }

  private async handleCriticalFailure(error: Error, context: MigrationContext, diagnosis: Diagnosis): Promise<void> {
    console.error('CRITICAL MIGRATION FAILURE:', error)

    // 1. 立即回滚到最后已知的良好状态
    await this.rollbackManager.emergencyRollback(context)

    // 2. 验证回滚结果
    const rollbackValidation = await this.validateRollbackResult()

    if (!rollbackValidation.success) {
      // 如果回滚失败，启动紧急恢复流程
      await this.emergencyRecovery()
    }

    // 3. 生成详细错误报告
    await this.generateFailureReport(error, context, diagnosis)

    // 4. 启动调查程序
    await this.initiateInvestigation()
  }

  private async emergencyRecovery(): Promise<void> {
    console.warn('Starting emergency recovery procedure...')

    // 1. 尝试从最新的可用备份恢复
    const latestBackup = await this.findLatestValidBackup()

    if (latestBackup) {
      try {
        await this.restoreFromBackup(latestBackup.id)
        console.log('Emergency recovery successful from backup:', latestBackup.id)
        return
      } catch (error) {
        console.error('Emergency recovery from backup failed:', error)
      }
    }

    // 2. 如果备份恢复失败，尝试数据重建
    await this.attemptDataReconstruction()
  }
}
```

#### 4.2 监控和告警系统
```typescript
export class MigrationMonitoring {
  private metrics: MigrationMetrics
  private thresholds: MonitoringThresholds

  constructor() {
    this.metrics = new MigrationMetrics()
    this.thresholds = {
      duration: { warning: 3600000, critical: 7200000 }, // 1小时警告，2小时严重
      failureRate: { warning: 0.05, critical: 0.1 },    // 5%警告，10%严重
      memoryUsage: { warning: 0.7, critical: 0.9 },     // 70%警告，90%严重
      dataSize: { warning: 1024 * 1024 * 1024, critical: 2 * 1024 * 1024 * 1024 } // 1GB警告，2GB严重
    }
  }

  async checkMigrationHealth(context: MigrationContext): Promise<HealthReport> {
    const report: HealthReport = {
      timestamp: new Date(),
      overall: 'healthy',
      checks: []
    }

    // 检查迁移持续时间
    const duration = Date.now() - context.startTime.getTime()
    this.checkDuration(duration, report)

    // 检查失败率
    const failureRate = this.calculateFailureRate(context)
    this.checkFailureRate(failureRate, report)

    // 检查内存使用
    const memoryUsage = await this.getMemoryUsage()
    this.checkMemoryUsage(memoryUsage, report)

    // 检查数据大小
    const dataSize = await this.estimateDataSize(context)
    this.checkDataSize(dataSize, report)

    // 确定整体健康状态
    report.overall = this.determineOverallHealth(report.checks)

    return report
  }

  private checkDuration(duration: number, report: HealthReport): void {
    const check: HealthCheck = {
      type: 'duration',
      value: duration,
      status: 'healthy'
    }

    if (duration > this.thresholds.duration.critical) {
      check.status = 'critical'
      check.message = `Migration duration (${this.formatDuration(duration)}) exceeds critical threshold`
    } else if (duration > this.thresholds.duration.warning) {
      check.status = 'warning'
      check.message = `Migration duration (${this.formatDuration(duration)}) exceeds warning threshold`
    }

    report.checks.push(check)
  }

  private determineOverallHealth(checks: HealthCheck[]): 'healthy' | 'warning' | 'critical' {
    const hasCritical = checks.some(c => c.status === 'critical')
    const hasWarning = checks.some(c => c.status === 'warning')

    if (hasCritical) return 'critical'
    if (hasWarning) return 'warning'
    return 'healthy'
  }
}
```

## 📊 监控和告警机制

### 1. 实时监控仪表板

#### 1.1 监控指标定义
```typescript
export interface MigrationMetrics {
  // 基础指标
  startTime: Date
  duration: number
  progress: number

  // 数据指标
  totalRecords: number
  processedRecords: number
  failedRecords: number
  successRate: number

  // 性能指标
  averageProcessingTime: number
  memoryUsage: number
  cpuUsage: number
  networkLatency: number

  // 错误指标
  errorCount: number
  errorRate: number
  retryCount: number

  // 状态指标
  currentPhase: string
  activeBatches: number
  queueSize: number
}

export interface MetricThreshold {
  warning: number
  critical: number
  recovery?: number
}

export const MIGRATION_THRESHOLDS = {
  duration: { warning: 3600000, critical: 7200000 },       // 1小时警告，2小时严重
  failureRate: { warning: 0.05, critical: 0.1 },           // 5%警告，10%严重
  memoryUsage: { warning: 0.7, critical: 0.9 },            // 70%警告，90%严重
  cpuUsage: { warning: 0.8, critical: 0.95 },              // 80%警告，95%严重
  networkLatency: { warning: 1000, critical: 5000 },        // 1秒警告，5秒严重
  batchSize: { warning: 2000, critical: 5000 },             // 2K警告，5K严重
  activeBatches: { warning: 5, critical: 10 }              // 5个警告，10个严重
}
```

#### 1.2 实时监控服务
```typescript
export class MigrationMonitor {
  private metrics: MigrationMetrics
  private thresholds: MetricThresholds
  private subscribers: Map<string, MetricSubscriber> = new Map()
  private intervalId?: NodeJS.Timeout

  constructor(thresholds: MetricThresholds = MIGRATION_THRESHOLDS) {
    this.metrics = this.initializeMetrics()
    this.thresholds = thresholds
  }

  startMonitoring(intervalMs: number = 5000): void {
    this.intervalId = setInterval(async () => {
      await this.collectMetrics()
      await this.evaluateThresholds()
      await this.notifySubscribers()
    }, intervalMs)

    console.log('Migration monitoring started with', intervalMs, 'ms interval')
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
      console.log('Migration monitoring stopped')
    }
  }

  private async collectMetrics(): Promise<void> {
    // 收集系统指标
    const [memoryUsage, cpuUsage, networkLatency] = await Promise.all([
      this.getMemoryUsage(),
      this.getCpuUsage(),
      this.getNetworkLatency()
    ])

    // 更新指标
    this.metrics.duration = Date.now() - this.metrics.startTime.getTime()
    this.metrics.memoryUsage = memoryUsage
    this.metrics.cpuUsage = cpuUsage
    this.metrics.networkLatency = networkLatency
    this.metrics.successRate = this.calculateSuccessRate()
  }

  private async evaluateThresholds(): Promise<void> {
    const alerts: Alert[] = []

    // 评估各项指标
    this.evaluateMetric('duration', this.metrics.duration, alerts)
    this.evaluateMetric('memoryUsage', this.metrics.memoryUsage, alerts)
    this.evaluateMetric('cpuUsage', this.metrics.cpuUsage, alerts)
    this.evaluateMetric('failureRate', this.metrics.errorRate, alerts)

    // 如果有告警，通知订阅者
    if (alerts.length > 0) {
      await this.publishAlerts(alerts)
    }
  }

  subscribe(subscriber: MetricSubscriber): string {
    const id = crypto.randomUUID()
    this.subscribers.set(id, subscriber)
    return id
  }

  unsubscribe(id: string): void {
    this.subscribers.delete(id)
  }
}
```

### 2. 告警规则引擎

#### 2.1 告警规则定义
```typescript
export interface AlertRule {
  id: string
  name: string
  description: string
  condition: (metrics: MigrationMetrics) => boolean
  severity: 'info' | 'warning' | 'critical'
  actions: AlertAction[]
  cooldownPeriod: number  // 冷却时间（毫秒）
  enabled: boolean
}

export interface AlertAction {
  type: 'log' | 'notify' | 'pause' | 'rollback' | 'scale'
  config: any
}

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'high_failure_rate',
    name: 'High Failure Rate',
    description: 'Migration failure rate exceeds threshold',
    condition: (metrics) => metrics.errorRate > 0.1,
    severity: 'critical',
    cooldownPeriod: 300000, // 5分钟冷却
    actions: [
      { type: 'log', config: { level: 'error' } },
      { type: 'notify', config: { channels: ['email', 'slack'] } },
      { type: 'pause', config: { reason: 'high_failure_rate' } }
    ],
    enabled: true
  },
  {
    id: 'memory_exhaustion',
    name: 'Memory Exhaustion',
    description: 'Memory usage exceeds critical threshold',
    condition: (metrics) => metrics.memoryUsage > 0.9,
    severity: 'critical',
    cooldownPeriod: 600000, // 10分钟冷却
    actions: [
      { type: 'log', config: { level: 'error' } },
      { type: 'notify', config: { channels: ['email', 'sms'] } },
      { type: 'scale', config: { action: 'reduce_batch_size' } }
    ],
    enabled: true
  },
  {
    id: 'duration_warning',
    name: 'Long Running Migration',
    description: 'Migration is taking longer than expected',
    condition: (metrics) => metrics.duration > 3600000, // 1小时
    severity: 'warning',
    cooldownPeriod: 1800000, // 30分钟冷却
    actions: [
      { type: 'log', config: { level: 'warn' } },
      { type: 'notify', config: { channels: ['email'] } }
    ],
    enabled: true
  }
]
```

#### 2.2 告警处理器
```typescript
export class AlertProcessor {
  private rules: AlertRule[]
  private activeAlerts: Map<string, ActiveAlert> = new Map()
  private lastTriggered: Map<string, number> = new Map()

  constructor(rules: AlertRule[] = DEFAULT_ALERT_RULES) {
    this.rules = rules
  }

  async processMetrics(metrics: MigrationMetrics): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = []
    const now = Date.now()

    for (const rule of this.rules) {
      if (!rule.enabled) continue

      // 检查冷却期
      const lastTriggered = this.lastTriggered.get(rule.id) || 0
      if (now - lastTriggered < rule.cooldownPeriod) {
        continue
      }

      // 检查条件
      if (rule.condition(metrics)) {
        const alert = this.createAlert(rule, metrics)
        triggeredAlerts.push(alert)

        // 执行告警动作
        await this.executeActions(alert, rule.actions)

        // 更新触发时间
        this.lastTriggered.set(rule.id, now)

        // 激活告警
        this.activateAlert(alert)
      }
    }

    return triggeredAlerts
  }

  private createAlert(rule: AlertRule, metrics: MigrationMetrics): Alert {
    return {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      timestamp: new Date(),
      metrics: { ...metrics },
      metadata: {
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        migrationId: metrics.migrationId
      }
    }
  }

  private async executeActions(alert: Alert, actions: AlertAction[]): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'log':
            await this.logAlert(alert, action.config)
            break
          case 'notify':
            await this.sendNotification(alert, action.config)
            break
          case 'pause':
            await this.pauseMigration(alert, action.config)
            break
          case 'rollback':
            await this.rollbackMigration(alert, action.config)
            break
          case 'scale':
            await this.scaleMigration(alert, action.config)
            break
        }
      } catch (error) {
        console.error(`Failed to execute alert action ${action.type}:`, error)
      }
    }
  }

  private async sendNotification(alert: Alert, config: any): Promise<void> {
    const message = this.formatAlertMessage(alert)

    if (config.channels?.includes('email')) {
      await this.sendEmailNotification({
        to: 'admin@example.com',
        subject: `Migration Alert: ${alert.name}`,
        body: message
      })
    }

    if (config.channels?.includes('slack')) {
      await this.sendSlackNotification({
        channel: '#migration-alerts',
        text: message,
        attachments: [{
          color: this.getSeverityColor(alert.severity),
          fields: [
            { title: 'Severity', value: alert.severity, short: true },
            { title: 'Timestamp', value: alert.timestamp.toISOString(), short: true }
          ]
        }]
      })
    }

    if (config.channels?.includes('sms')) {
      await this.sendSmsNotification({
        to: '+1234567890',
        message: `${alert.severity.toUpperCase()}: ${alert.name}`
      })
    }
  }

  private async pauseMigration(alert: Alert, config: any): Promise<void> {
    console.warn(`Pausing migration due to alert: ${alert.name}`)

    // 发送暂停信号给迁移控制器
    await this.migrationController.pause({
      reason: config.reason,
      alertId: alert.id,
      timestamp: alert.timestamp
    })

    // 记录暂停事件
    await this.eventLogger.logEvent({
      type: 'migration_paused',
      reason: config.reason,
      alertId: alert.id,
      severity: alert.severity
    })
  }
}
```

### 3. 性能分析报告

#### 3.1 性能数据收集
```typescript
export class PerformanceAnalyzer {
  private measurements: PerformanceMeasurement[] = []
  private benchmarks: Map<string, Benchmark> = new Map()

  recordMeasurement(operation: string, duration: number, metadata?: any): void {
    const measurement: PerformanceMeasurement = {
      id: crypto.randomUUID(),
      operation,
      duration,
      timestamp: new Date(),
      metadata
    }

    this.measurements.push(measurement)

    // 更新基准
    this.updateBenchmark(operation, duration)
  }

  getPerformanceReport(operation?: string): PerformanceReport {
    const filteredMeasurements = operation
      ? this.measurements.filter(m => m.operation === operation)
      : this.measurements

    if (filteredMeasurements.length === 0) {
      return {
        totalMeasurements: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        percentiles: {},
        trends: [],
        anomalies: [],
        recommendations: []
      }
    }

    const durations = filteredMeasurements.map(m => m.duration).sort((a, b) => a - b)

    return {
      totalMeasurements: filteredMeasurements.length,
      averageDuration: this.calculateAverage(durations),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      percentiles: this.calculatePercentiles(durations),
      trends: this.analyzeTrends(filteredMeasurements),
      anomalies: this.detectAnomalies(filteredMeasurements),
      recommendations: this.generateRecommendations(filteredMeasurements)
    }
  }

  private updateBenchmark(operation: string, duration: number): void {
    let benchmark = this.benchmarks.get(operation)

    if (!benchmark) {
      benchmark = {
        operation,
        measurements: [],
        baseline: null,
        threshold: null
      }
      this.benchmarks.set(operation, benchmark)
    }

    benchmark.measurements.push({
      duration,
      timestamp: new Date()
    })

    // 更新基准线（使用最近100次测量的平均值）
    if (benchmark.measurements.length >= 10) {
      const recentMeasurements = benchmark.measurements.slice(-100)
      const avgDuration = recentMeasurements.reduce((sum, m) => sum + m.duration, 0) / recentMeasurements.length
      benchmark.baseline = avgDuration
      benchmark.threshold = avgDuration * 2 // 2倍基准线作为阈值
    }
  }

  private analyzeTrends(measurements: PerformanceMeasurement[]): TrendAnalysis[] {
    const groupedByOperation = this.groupByOperation(measurements)
    const trends: TrendAnalysis[] = []

    for (const [operation, opMeasurements] of groupedByOperation) {
      const sortedMeasurements = opMeasurements.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

      if (sortedMeasurements.length < 5) continue

      // 计算趋势
      const durations = sortedMeasurements.map(m => m.duration)
      const trend = this.calculateTrend(durations)

      trends.push({
        operation,
        direction: trend > 0.1 ? 'increasing' : trend < -0.1 ? 'decreasing' : 'stable',
        slope: trend,
        confidence: this.calculateTrendConfidence(durations),
        timeRange: {
          start: sortedMeasurements[0].timestamp,
          end: sortedMeasurements[sortedMeasurements.length - 1].timestamp
        }
      })
    }

    return trends
  }

  private detectAnomalies(measurements: PerformanceMeasurement[]): Anomaly[] {
    const anomalies: Anomaly[] = []
    const groupedByOperation = this.groupByOperation(measurements)

    for (const [operation, opMeasurements] of groupedByOperation) {
      const benchmark = this.benchmarks.get(operation)
      if (!benchmark || !benchmark.threshold) continue

      for (const measurement of opMeasurements) {
        if (measurement.duration > benchmark.threshold) {
          anomalies.push({
            id: crypto.randomUUID(),
            type: 'performance_anomaly',
            severity: measurement.duration > benchmark.threshold * 3 ? 'high' : 'medium',
            measurement,
            benchmark: benchmark.threshold,
            deviation: (measurement.duration - benchmark.threshold) / benchmark.threshold
          })
        }
      }
    }

    return anomalies
  }

  private generateRecommendations(measurements: PerformanceMeasurement[]): Recommendation[] {
    const recommendations: Recommendation[] = []
    const groupedByOperation = this.groupByOperation(measurements)

    for (const [operation, opMeasurements] of groupedByOperation) {
      const durations = opMeasurements.map(m => m.duration)
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
      const stdDev = this.calculateStandardDeviation(durations)

      // 检查高变异性
      if (stdDev / avgDuration > 0.5) {
        recommendations.push({
          id: crypto.randomUUID(),
          type: 'variability',
          priority: 'medium',
          operation,
          message: `High variability detected in ${operation} operation (${(stdDev / avgDuration * 100).toFixed(1)}% CV)`,
          actions: [
            'Investigate environmental factors',
            'Consider caching strategies',
            'Optimize resource allocation'
          ]
        })
      }

      // 检查性能下降趋势
      const recentMeasurements = opMeasurements.slice(-20)
      const olderMeasurements = opMeasurements.slice(-40, -20)

      if (recentMeasurements.length >= 10 && olderMeasurements.length >= 10) {
        const recentAvg = recentMeasurements.reduce((sum, m) => sum + m.duration, 0) / recentMeasurements.length
        const olderAvg = olderMeasurements.reduce((sum, m) => sum + m.duration, 0) / olderMeasurements.length

        if (recentAvg > olderAvg * 1.2) {
          recommendations.push({
            id: crypto.randomUUID(),
            type: 'performance_degradation',
            priority: 'high',
            operation,
            message: `Performance degradation detected in ${operation} (${((recentAvg / olderAvg - 1) * 100).toFixed(1)}% increase)`,
            actions: [
              'Analyze recent code changes',
              'Check resource contention',
              'Review database queries'
            ]
          })
        }
      }
    }

    return recommendations
  }
}
```

## 🛠️ 实施工具和脚本

### 1. 数据迁移工具集

#### 1.1 迁移控制器
```typescript
// src/tools/migration-controller.ts
export class MigrationController {
  private migrator: DataMigration
  private monitor: MigrationMonitor
  private backupExecutor: BackupExecutor
  private alertProcessor: AlertProcessor

  constructor() {
    this.migrator = new DataMigration()
    this.monitor = new MigrationMonitor()
    this.backupExecutor = new BackupExecutor()
    this.alertProcessor = new AlertProcessor()
  }

  async executeMigration(options: MigrationOptions): Promise<MigrationResult> {
    console.log('Starting data migration with options:', options)

    try {
      // 1. 开始监控
      this.monitor.startMonitoring()

      // 2. 创建迁移前备份
      if (options.createBackup) {
        console.log('Creating pre-migration backup...')
        const backup = await this.backupExecutor.createFullBackup()
        console.log('Backup created:', backup.backupId)
      }

      // 3. 执行迁移
      const result = await this.migrator.executeMigration(options)

      // 4. 验证迁移结果
      const validation = await this.validateMigration(result)

      // 5. 生成报告
      const report = await this.generateMigrationReport(result, validation)

      console.log('Migration completed successfully:', {
        recordsMigrated: result.recordsMigrated,
        duration: result.duration,
        validation: validation.isValid ? 'passed' : 'failed'
      })

      return {
        ...result,
        validation,
        report
      }
    } catch (error) {
      console.error('Migration failed:', error)

      // 处理迁移失败
      await this.handleMigrationFailure(error as Error, options)

      throw error
    } finally {
      this.monitor.stopMonitoring()
    }
  }

  async validateMigration(result: MigrationResult): Promise<MigrationValidation> {
    const validator = new DataValidator()

    const [dataConsistency, performanceValidation, integrityCheck] = await Promise.all([
      validator.checkDataConsistency(),
      validator.checkPerformanceMetrics(),
      validator.checkDataIntegrity()
    ])

    return {
      isValid: dataConsistency.isValid && performanceValidation.isValid && integrityCheck.isValid,
      dataConsistency,
      performanceValidation,
      integrityCheck,
      timestamp: new Date()
    }
  }

  async handleMigrationFailure(error: Error, options: MigrationOptions): Promise<void> {
    console.error('Handling migration failure:', error.message)

    // 发送告警
    await this.alertProcessor.processMetrics(this.monitor.getMetrics())

    // 如果配置了自动回滚
    if (options.autoRollback) {
      console.log('Starting automatic rollback...')
      try {
        await this.rollbackMigration()
        console.log('Rollback completed successfully')
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError)
        // 回滚失败时启动紧急恢复
        await this.emergencyRecovery()
      }
    }
  }
}
```

#### 1.2 数据验证工具
```typescript
// src/tools/data-validator.ts
export class DataValidator {
  async validateSourceData(source: DataSource): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      stats: null
    }

    try {
      // 验证数据源连接
      await this.validateConnection(source)

      // 验证数据结构
      await this.validateDataStructure(source, result)

      // 验证数据完整性
      await this.validateDataIntegrity(source, result)

      // 验证业务规则
      await this.validateBusinessRules(source, result)

      // 收集统计信息
      result.stats = await this.collectStatistics(source)

      result.isValid = result.errors.length === 0

    } catch (error) {
      result.isValid = false
      result.errors.push({
        type: 'validation_error',
        message: `Validation failed: ${error.message}`,
        severity: 'critical'
      })
    }

    return result
  }

  async validateMigrationResult(
    source: DataSource,
    target: DataSource
  ): Promise<MigrationValidation> {
    const validation: MigrationValidation = {
      isValid: true,
      checks: [],
      summary: null
    }

    try {
      // 检查记录数一致性
      const recordCountCheck = await this.checkRecordCountConsistency(source, target)
      validation.checks.push(recordCountCheck)

      // 检查数据内容一致性
      const contentCheck = await this.checkDataContentConsistency(source, target)
      validation.checks.push(contentCheck)

      // 检查关系完整性
      const relationCheck = await this.checkRelationIntegrity(target)
      validation.checks.push(relationCheck)

      // 检查索引完整性
      const indexCheck = await this.checkIndexIntegrity(target)
      validation.checks.push(indexCheck)

      // 性能基准测试
      const performanceCheck = await this.runPerformanceBenchmarks(target)
      validation.checks.push(performanceCheck)

      validation.isValid = validation.checks.every(check => check.passed)
      validation.summary = this.generateValidationSummary(validation.checks)

    } catch (error) {
      validation.isValid = false
      validation.checks.push({
        name: 'validation_error',
        type: 'system',
        passed: false,
        message: `Migration validation failed: ${error.message}`,
        severity: 'critical'
      })
    }

    return validation
  }

  private async checkRecordCountConsistency(source: DataSource, target: DataSource): Promise<ValidationCheck> {
    const sourceStats = await this.collectStatistics(source)
    const targetStats = await this.collectStatistics(target)

    const checks: RecordCountCheck[] = []

    for (const table of Object.keys(sourceStats)) {
      const sourceCount = sourceStats[table]?.count || 0
      const targetCount = targetStats[table]?.count || 0
      const difference = Math.abs(sourceCount - targetCount)
      const tolerance = Math.max(1, sourceCount * 0.001) // 0.1% 容差

      checks.push({
        table,
        sourceCount,
        targetCount,
        difference,
        withinTolerance: difference <= tolerance
      })
    }

    const failedChecks = checks.filter(c => !c.withinTolerance)

    return {
      name: 'record_count_consistency',
      type: 'data',
      passed: failedChecks.length === 0,
      message: failedChecks.length === 0
        ? 'Record counts match between source and target'
        : `Record count mismatches in ${failedChecks.length} tables`,
      details: {
        totalTables: checks.length,
        mismatchedTables: failedChecks.length,
        checks
      },
      severity: failedChecks.length > 0 ? 'high' : 'info'
    }
  }

  private async checkDataContentConsistency(source: DataSource, target: DataSource): Promise<ValidationCheck> {
    const tables = await this.getTableNames(source)
    const contentChecks: ContentCheck[] = []

    for (const table of tables) {
      // 对每个表进行抽样检查
      const sampleCheck = await this.checkTableContentSample(source, target, table)
      contentChecks.push(sampleCheck)
    }

    const failedChecks = contentChecks.filter(c => !c.matched)

    return {
      name: 'data_content_consistency',
      type: 'data',
      passed: failedChecks.length === 0,
      message: failedChecks.length === 0
        ? 'Data content consistency verified'
        : `Data content mismatches in ${failedChecks.length} tables`,
      details: {
        totalTables: contentChecks.length,
        mismatchedTables: failedChecks.length,
        checks: contentChecks
      },
      severity: failedChecks.length > 0 ? 'high' : 'info'
    }
  }
}
```

#### 1.3 性能基准测试工具
```typescript
// src/tools/performance-benchmark.ts
export class PerformanceBenchmark {
  private results: BenchmarkResult[] = []

  async runDatabaseBenchmarks(config: BenchmarkConfig): Promise<BenchmarkReport> {
    console.log('Starting database performance benchmarks...')

    const report: BenchmarkReport = {
      timestamp: new Date(),
      config,
      results: [],
      summary: null
    }

    try {
      // 读取性能基准
      await this.testReadPerformance(config, report)

      // 写入性能基准
      await this.testWritePerformance(config, report)

      // 查询性能基准
      await this.testQueryPerformance(config, report)

      // 并发性能基准
      await this.testConcurrentPerformance(config, report)

      // 生成摘要
      report.summary = this.generateBenchmarkSummary(report.results)

      console.log('Benchmarks completed successfully')

      return report
    } catch (error) {
      console.error('Benchmarks failed:', error)
      throw error
    }
  }

  private async testReadPerformance(config: BenchmarkConfig, report: BenchmarkReport): Promise<void> {
    console.log('Testing read performance...')

    const testCases = [
      { name: 'single_record_read', iterations: 1000 },
      { name: 'batch_read_100', iterations: 100, batchSize: 100 },
      { name: 'indexed_query', iterations: 500 },
      { name: 'full_scan_query', iterations: 50 }
    ]

    for (const testCase of testCases) {
      const result = await this.runReadTest(testCase, config)
      report.results.push(result)
    }
  }

  private async testWritePerformance(config: BenchmarkConfig, report: BenchmarkReport): Promise<void> {
    console.log('Testing write performance...')

    const testCases = [
      { name: 'single_record_insert', iterations: 1000 },
      { name: 'batch_insert_100', iterations: 100, batchSize: 100 },
      { name: 'record_update', iterations: 500 },
      { name: 'record_delete', iterations: 500 }
    ]

    for (const testCase of testCases) {
      const result = await this.runWriteTest(testCase, config)
      report.results.push(result)
    }
  }

  private async runReadTest(testCase: ReadTestCase, config: BenchmarkConfig): Promise<BenchmarkResult> {
    const measurements: number[] = []
    const errors: Error[] = []

    console.log(`Running read test: ${testCase.name}`)

    for (let i = 0; i < testCase.iterations; i++) {
      try {
        const startTime = performance.now()

        // 执行读取操作
        await this.executeReadOperation(testCase)

        const duration = performance.now() - startTime
        measurements.push(duration)

      } catch (error) {
        errors.push(error as Error)
      }
    }

    return this.processBenchmarkResults(testCase.name, 'read', measurements, errors)
  }

  private async runWriteTest(testCase: WriteTestCase, config: BenchmarkConfig): Promise<BenchmarkResult> {
    const measurements: number[] = []
    const errors: Error[] = []

    console.log(`Running write test: ${testCase.name}`)

    for (let i = 0; i < testCase.iterations; i++) {
      try {
        const startTime = performance.now()

        // 执行写入操作
        await this.executeWriteOperation(testCase)

        const duration = performance.now() - startTime
        measurements.push(duration)

      } catch (error) {
        errors.push(error as Error)
      }
    }

    return this.processBenchmarkResults(testCase.name, 'write', measurements, errors)
  }

  private processBenchmarkResults(
    testName: string,
    type: 'read' | 'write' | 'query' | 'concurrent',
    measurements: number[],
    errors: Error[]
  ): BenchmarkResult {
    const validMeasurements = measurements.filter(m => !isNaN(m) && m > 0)

    if (validMeasurements.length === 0) {
      return {
        testName,
        type,
        status: 'failed',
        successRate: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        percentiles: {},
        errorRate: 1,
        errors: errors.map(e => e.message),
        timestamp: new Date()
      }
    }

    const sortedMeasurements = validMeasurements.sort((a, b) => a - b)

    return {
      testName,
      type,
      status: errors.length > measurements.length * 0.1 ? 'warning' : 'success',
      successRate: validMeasurements.length / measurements.length,
      averageDuration: this.calculateAverage(sortedMeasurements),
      minDuration: sortedMeasurements[0],
      maxDuration: sortedMeasurements[sortedMeasurements.length - 1],
      percentiles: this.calculatePercentiles(sortedMeasurements),
      errorRate: errors.length / measurements.length,
      errors: errors.map(e => e.message),
      timestamp: new Date()
    }
  }

  private generateBenchmarkSummary(results: BenchmarkResult[]): BenchmarkSummary {
    const passedTests = results.filter(r => r.status === 'success').length
    const warningTests = results.filter(r => r.status === 'warning').length
    const failedTests = results.filter(r => r.status === 'failed').length

    const overallStatus = failedTests === 0 ? 'success' : failedTests > passedTests ? 'failed' : 'warning'

    return {
      overallStatus,
      totalTests: results.length,
      passedTests,
      warningTests,
      failedTests,
      averageSuccessRate: results.reduce((sum, r) => sum + r.successRate, 0) / results.length,
      recommendations: this.generateBenchmarkRecommendations(results)
    }
  }
}
```

### 2. 自动化脚本

#### 2.1 迁移启动脚本
```bash
#!/bin/bash

# scripts/start-migration.sh

set -e

echo "=== CardEverything Data Migration Script ==="
echo "Starting at: $(date)"

# 加载配置
source .env

# 设置默认值
MIGRATION_CONFIG=${MIGRATION_CONFIG:-"migration-config.json"}
BACKUP_ENABLED=${BACKUP_ENABLED:-"true"}
AUTO_ROLLBACK=${AUTO_ROLLBACK:-"true"}
DRY_RUN=${DRY_RUN:-"false"}

# 检查前置条件
echo "Checking prerequisites..."

# 检查Node.js版本
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"

# 检查内存
AVAILABLE_MEMORY=$(free -m | awk 'NR==2{printf "%.2fGB", $7/1024}')
echo "Available memory: $AVAILABLE_MEMORY"

# 检查磁盘空间
AVAILABLE_DISK=$(df -h . | awk 'NR==2{print $4}')
echo "Available disk space: $AVAILABLE_DISK"

# 创建日志目录
mkdir -p logs/migration
LOG_FILE="logs/migration/migration-$(date +%Y%m%d_%H%M%S).log"

echo "Migration log will be written to: $LOG_FILE"

# 验证配置文件
if [ ! -f "$MIGRATION_CONFIG" ]; then
    echo "Error: Migration config file not found: $MIGRATION_CONFIG"
    exit 1
fi

# 运行迁移
echo "Starting migration process..."

if [ "$DRY_RUN" = "true" ]; then
    echo "=== DRY RUN MODE ==="
    npm run migration:dry-run -- --config="$MIGRATION_CONFIG"
else
    npm run migration:start -- \
        --config="$MIGRATION_CONFIG" \
        --backup="$BACKUP_ENABLED" \
        --auto-rollback="$AUTO_ROLLBACK" \
        --log-file="$LOG_FILE"
fi

# 检查结果
MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo "Check the log file for details: $LOG_FILE"
else
    echo "❌ Migration failed with exit code: $MIGRATION_EXIT_CODE"
    echo "Check the log file for error details: $LOG_FILE"

    if [ "$AUTO_ROLLBACK" = "true" ]; then
        echo "🔄 Starting automatic rollback..."
        npm run migration:rollback -- --log-file="$LOG_FILE"
    fi
fi

echo "Migration process finished at: $(date)"
exit $MIGRATION_EXIT_CODE
```

#### 2.2 健康检查脚本
```bash
#!/bin/bash

# scripts/health-check.sh

set -e

echo "=== CardEverything Database Health Check ==="
echo "Checking at: $(date)"

# 配置
HEALTH_CHECK_URL=${HEALTH_CHECK_URL:-"http://localhost:3000/api/health"}
TIMEOUT=${TIMEOUT:-30}
MAX_RETRIES=${MAX_RETRIES:-3}

# 检查函数
check_health() {
    local attempt=1
    local max_attempts=$MAX_RETRIES

    while [ $attempt -le $max_attempts ]; do
        echo "Health check attempt $attempt/$max_attempts..."

        if curl -s -f --max-time $TIMEOUT "$HEALTH_CHECK_URL" > /dev/null; then
            echo "✅ Health check passed!"
            return 0
        fi

        echo "⚠️  Health check failed, retrying in 5 seconds..."
        sleep 5
        ((attempt++))
    done

    echo "❌ Health check failed after $max_attempts attempts"
    return 1
}

# 检查数据库连接
check_database() {
    echo "Checking database connectivity..."

    if npm run db:ping > /dev/null 2>&1; then
        echo "✅ Database connection successful"
        return 0
    else
        echo "❌ Database connection failed"
        return 1
    fi
}

# 检查存储空间
check_storage() {
    echo "Checking storage space..."

    local available_space=$(df -h . | awk 'NR==2{print $4}')
    local used_percent=$(df -h . | awk 'NR==2{print $5}' | sed 's/%//')

    echo "Available space: $available_space"
    echo "Used space: ${used_percent}%"

    if [ "$used_percent" -gt 90 ]; then
        echo "⚠️  Warning: Storage usage above 90%"
        return 1
    fi

    echo "✅ Storage space is adequate"
    return 0
}

# 检查内存使用
check_memory() {
    echo "Checking memory usage..."

    local used_percent=$(free | awk 'NR==2{printf "%.0f", $3/$2 * 100}')

    echo "Memory usage: ${used_percent}%"

    if [ "$used_percent" -gt 85 ]; then
        echo "⚠️  Warning: Memory usage above 85%"
        return 1
    fi

    echo "✅ Memory usage is normal"
    return 0
}

# 主检查流程
main() {
    local exit_code=0

    echo "Starting comprehensive health check..."

    # 数据库检查
    if ! check_database; then
        exit_code=1
    fi

    # 存储检查
    if ! check_storage; then
        exit_code=1
    fi

    # 内存检查
    if ! check_memory; then
        exit_code=1
    fi

    # 应用健康检查
    if ! check_health; then
        exit_code=1
    fi

    if [ $exit_code -eq 0 ]; then
        echo "🎉 All health checks passed!"
    else
        echo "❌ Some health checks failed"
    fi

    return $exit_code
}

# 执行主函数
main "$@"
```

#### 2.3 备份管理脚本
```bash
#!/bin/bash

# scripts/backup-manager.sh

set -e

echo "=== CardEverything Backup Manager ==="
echo "Running at: $(date)"

# 配置
BACKUP_DIR=${BACKUP_DIR:-"./backups"}
MAX_BACKUPS=${MAX_BACKUPS:-30}
COMPRESSION_ENABLED=${COMPRESSION_ENABLED:-"true"}
ENCRYPTION_ENABLED=${ENCRYPTION_ENABLED:-"true"}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# 创建备份目录
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/full"
mkdir -p "$BACKUP_DIR/incremental"
mkdir -p "$BACKUP_DIR/rollback"

# 备份函数
create_backup() {
    local backup_type=$1
    local backup_name="backup-$(date +%Y%m%d_%H%M%S)-${backup_type}"
    local backup_path="$BACKUP_DIR/${backup_type}/${backup_name}"

    echo "Creating $backup_type backup: $backup_name"

    # 创建临时目录
    local temp_dir=$(mktemp -d)

    # 导出数据
    case $backup_type in
        "full")
            npm run db:export -- --output="$temp_dir/data.json" --format=json
            ;;
        "incremental")
            npm run db:export-incremental -- --output="$temp_dir/data.json" --since="$LAST_BACKUP_TIME"
            ;;
        "rollback")
            npm run db:export -- --output="$temp_dir/data.json" --format=json --include-metadata
            ;;
    esac

    # 压缩
    if [ "$COMPRESSION_ENABLED" = "true" ]; then
        echo "Compressing backup..."
        tar -czf "$backup_path.tar.gz" -C "$temp_dir" .
    else
        mv "$temp_dir" "$backup_path"
    fi

    # 加密
    if [ "$ENCRYPTION_ENABLED" = "true" ]; then
        echo "Encrypting backup..."
        gpg --symmetric --cipher-algo AES256 --output "$backup_path.tar.gz.gpg" "$backup_path.tar.gz"
        rm "$backup_path.tar.gz"
        backup_path="$backup_path.tar.gz.gpg"
    fi

    # 计算校验和
    local checksum=$(sha256sum "$backup_path" | cut -d' ' -f1)
    echo "$checksum" > "$backup_path.sha256"

    # 清理临时目录
    rm -rf "$temp_dir"

    echo "✅ Backup created: $backup_path"
    echo "Checksum: $checksum"

    # 更新最后备份时间
    LAST_BACKUP_TIME=$(date -Iseconds)
    export LAST_BACKUP_TIME
}

# 清理旧备份
cleanup_old_backups() {
    echo "Cleaning up old backups..."

    # 清理完整备份
    find "$BACKUP_DIR/full" -name "backup-*.tar.gz*" -mtime +$BACKUP_RETENTION_DAYS -delete

    # 清理增量备份
    find "$BACKUP_DIR/incremental" -name "backup-*.tar.gz*" -mtime +7 -delete

    # 清理回滚备份
    find "$BACKUP_DIR/rollback" -name "backup-*.tar.gz*" -mtime +30 -delete

    # 限制备份数量
    for backup_type in full incremental rollback; do
        local backup_count=$(ls -1 "$BACKUP_DIR/$backup_type/"*.tar.gz* 2>/dev/null | wc -l)
        if [ "$backup_count" -gt "$MAX_BACKUPS" ]; then
            echo "Removing old $backup_type backups (keeping $MAX_BACKUPS)"
            ls -t "$BACKUP_DIR/$backup_type/"*.tar.gz* | tail -n +$(($MAX_BACKUPS + 1)) | xargs rm -f
        fi
    done

    echo "✅ Backup cleanup completed"
}

# 验证备份
verify_backup() {
    local backup_path=$1

    echo "Verifying backup: $backup_path"

    # 检查校验和
    if [ -f "$backup_path.sha256" ]; then
        local expected_checksum=$(cat "$backup_path.sha256")
        local actual_checksum=$(sha256sum "$backup_path" | cut -d' ' -f1)

        if [ "$expected_checksum" != "$actual_checksum" ]; then
            echo "❌ Backup verification failed: checksum mismatch"
            return 1
        fi
    fi

    # 如果是加密备份，解密并验证内容
    if [[ "$backup_path" == *.gpg ]]; then
        local temp_file=$(mktemp)
        gpg --quiet --decrypt --output "$temp_file" "$backup_path"

        if [ ! -s "$temp_file" ]; then
            echo "❌ Backup verification failed: decryption failed"
            rm -f "$temp_file"
            return 1
        fi

        rm -f "$temp_file"
    fi

    echo "✅ Backup verification passed"
    return 0
}

# 列出备份
list_backups() {
    echo "Available backups:"
    echo "=================="

    for backup_type in full incremental rollback; do
        echo -e "\n$backup_type backups:"
        find "$BACKUP_DIR/$backup_type" -name "backup-*.tar.gz*" -printf "%T+ %p\n" | sort -r | head -10
    done
}

# 主菜单
case "${1:-}" in
    "full")
        create_backup "full"
        cleanup_old_backups
        ;;
    "incremental")
        create_backup "incremental"
        ;;
    "rollback")
        create_backup "rollback"
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    "verify")
        if [ -z "$2" ]; then
            echo "Error: Please specify backup path to verify"
            exit 1
        fi
        verify_backup "$2"
        ;;
    "list")
        list_backups
        ;;
    "status")
        echo "Backup Status:"
        echo "============="
        echo "Backup directory: $BACKUP_DIR"
        echo "Max backups: $MAX_BACKUPS"
        echo "Compression: $COMPRESSION_ENABLED"
        echo "Encryption: $ENCRYPTION_ENABLED"
        echo "Retention days: $BACKUP_RETENTION_DAYS"
        list_backups
        ;;
    *)
        echo "Usage: $0 {full|incremental|rollback|cleanup|verify|list|status}"
        echo ""
        echo "Commands:"
        echo "  full           - Create full backup"
        echo "  incremental    - Create incremental backup"
        echo "  rollback       - Create rollback backup"
        echo "  cleanup        - Clean old backups"
        echo "  verify <path>  - Verify backup integrity"
        echo "  list           - List available backups"
        echo "  status         - Show backup status"
        exit 1
        ;;
esac

echo "Backup manager completed at: $(date)"
```

### 3. 监控和报告工具

#### 3.1 迁移监控仪表板
```typescript
// src/tools/migration-dashboard.ts
export class MigrationDashboard {
  private server: any
  private socketServer: any
  private metricsStore: MetricsStore

  constructor() {
    this.metricsStore = new MetricsStore()
  }

  async start(port: number = 3001): Promise<void> {
    const express = require('express')
    const http = require('http')
    const socketIo = require('socket.io')

    const app = express()
    this.server = http.createServer(app)
    this.socketServer = new socketIo.Server(this.server, {
      cors: { origin: "*" }
    })

    // 中间件
    app.use(express.json())
    app.use(express.static('public'))

    // API路由
    this.setupApiRoutes(app)

    // WebSocket事件
    this.setupWebSocketEvents()

    // 启动服务器
    this.server.listen(port, () => {
      console.log(`Migration dashboard running on port ${port}`)
      console.log(`Access at: http://localhost:${port}`)
    })
  }

  private setupApiRoutes(app: any): void {
    // 获取迁移状态
    app.get('/api/migration/status', async (req, res) => {
      try {
        const status = await this.metricsStore.getLatestStatus()
        res.json(status)
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })

    // 获取性能指标
    app.get('/api/migration/metrics', async (req, res) => {
      try {
        const metrics = await this.metricsStore.getMetrics()
        res.json(metrics)
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })

    // 获取告警历史
    app.get('/api/migration/alerts', async (req, res) => {
      try {
        const alerts = await this.metricsStore.getAlerts()
        res.json(alerts)
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })

    // 获取性能报告
    app.get('/api/migration/report', async (req, res) => {
      try {
        const report = await this.generatePerformanceReport()
        res.json(report)
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })

    // 健康检查
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() })
    })
  }

  private setupWebSocketEvents(): void {
    this.socketServer.on('connection', (socket: any) => {
      console.log('Dashboard client connected')

      // 发送当前状态
      this.sendCurrentStatus(socket)

      // 订阅实时更新
      socket.on('subscribe', (data: any) => {
        console.log('Client subscribed to updates:', data)
        socket.join('migration-updates')
      })

      // 处理断开连接
      socket.on('disconnect', () => {
        console.log('Dashboard client disconnected')
      })
    })
  }

  async updateMetrics(metrics: MigrationMetrics): Promise<void> {
    // 存储指标
    await this.metricsStore.storeMetrics(metrics)

    // 广播给所有连接的客户端
    this.socketServer.to('migration-updates').emit('metrics-update', metrics)

    // 检查告警条件
    await this.checkAlertConditions(metrics)
  }

  async sendAlert(alert: Alert): Promise<void> {
    // 存储告警
    await this.metricsStore.storeAlert(alert)

    // 广播告警
    this.socketServer.emit('alert', alert)

    // 发送通知
    await this.sendNotification(alert)
  }

  private async sendCurrentStatus(socket: any): Promise<void> {
    try {
      const [status, metrics, alerts] = await Promise.all([
        this.metricsStore.getLatestStatus(),
        this.metricsStore.getMetrics(),
        this.metricsStore.getAlerts()
      ])

      socket.emit('initial-data', { status, metrics, alerts })
    } catch (error) {
      console.error('Failed to send initial data:', error)
    }
  }

  private async checkAlertConditions(metrics: MigrationMetrics): Promise<void> {
    const conditions = [
      { metric: 'errorRate', threshold: 0.1, severity: 'critical' },
      { metric: 'memoryUsage', threshold: 0.9, severity: 'critical' },
      { metric: 'duration', threshold: 7200000, severity: 'warning' }
    ]

    for (const condition of conditions) {
      if (metrics[condition.metric] > condition.threshold) {
        const alert: Alert = {
          id: crypto.randomUUID(),
          type: 'threshold_exceeded',
          severity: condition.severity,
          message: `${condition.metric} exceeded threshold: ${metrics[condition.metric]} > ${condition.threshold}`,
          timestamp: new Date(),
          metrics
        }

        await this.sendAlert(alert)
      }
    }
  }
}
```

## 📈 实施时间表和里程碑

### 1. 实施阶段划分

#### 第一阶段：准备和规划（1周）
**目标：** 完成所有准备工作，确保迁移顺利进行

**任务清单：**
- [ ] 数据库架构分析完成
- [ ] 迁移策略文档审核
- [ ] 环境准备和工具配置
- [ ] 备份策略验证
- [ ] 团队培训和技术准备

**交付物：**
- 数据迁移策略文档 (v1.0)
- 环境配置文件和脚本
- 备份和恢复测试报告
- 团队培训材料

#### 第二阶段：工具开发和测试（2周）
**目标：** 开发所有必要的迁移工具和验证机制

**任务清单：**
- [ ] 数据迁移控制器开发
- [ ] 数据验证工具开发
- [ ] 性能基准测试工具开发
- [ ] 监控和告警系统开发
- [ ] 自动化脚本编写
- [ ] 单元测试和集成测试

**交付物：**
- 迁移工具套件
- 测试用例和测试报告
- 自动化脚本库
- 监控仪表板

#### 第三阶段：迁移执行和验证（1周）
**目标：** 执行数据迁移并进行全面验证

**任务清单：**
- [ ] 生产环境备份
- [ ] 迁移预演（在测试环境）
- [ ] 生产环境迁移执行
- [ ] 数据完整性验证
- [ ] 性能基准测试
- [ ] 用户验收测试

**交付物：**
- 迁移执行报告
- 数据验证报告
- 性能测试报告
- 用户验收测试报告

#### 第四阶段：优化和文档（1周）
**目标：** 优化迁移结果，完善文档和培训

**任务清单：**
- [ ] 性能调优
- [ ] 问题修复
- [ ] 文档完善
- [ ] 用户培训
- [ ] 运维交接

**交付物：**
- 优化报告
- 完整技术文档
- 用户培训材料
- 运维手册

### 2. 关键里程碑

| 里程碑 | 时间 | 描述 | 成功标准 |
|--------|------|------|----------|
| M1: 架构分析完成 | 第1周末 | 完成现有架构分析，确定迁移策略 | 分析报告审核通过，迁移策略确定 |
| M2: 工具开发完成 | 第3周末 | 所有迁移工具开发完成并通过测试 | 工具功能完整，测试覆盖率 > 95% |
| M3: 测试环境验证 | 第4周末 | 在测试环境完成迁移验证 | 测试环境迁移成功，验证通过 |
| M4: 生产环境准备 | 第5周中 | 生产环境准备就绪，备份完成 | 备份验证通过，环境就绪 |
| M5: 生产环境迁移 | 第5周末 | 执行生产环境数据迁移 | 迁移成功，数据完整性验证通过 |
| M6: 项目交付 | 第6周末 | 项目完成，文档交付 | 所有交付物完成，用户培训完成 |

### 3. 资源需求

#### 3.1 人力资源
- **数据库架构师**: 1人（全程）
- **后端开发工程师**: 2人（第2-3周）
- **测试工程师**: 1人（第2-4周）
- **运维工程师**: 1人（第4-6周）
- **项目经理**: 1人（全程）

#### 3.2 技术资源
- **开发环境**: Node.js 18+, TypeScript 5+
- **测试环境**: 与生产环境配置相同
- **存储资源**: 至少2倍当前数据量的存储空间
- **网络资源**: 稳定的网络连接
- **监控工具**: 实时监控系统

#### 3.3 时间资源
- **总工期**: 6周
- **关键路径**: 工具开发 → 测试验证 → 生产迁移
- **缓冲时间**: 每个阶段预留1-2天缓冲时间

## 🔍 风险评估和缓解措施

### 1. 技术风险评估

#### 1.1 数据丢失风险
**风险等级**: 高
**影响**: 数据永久丢失，业务中断
**概率**: 低（< 5%）
**缓解措施**:
- 迁移前创建完整备份
- 使用事务性迁移机制
- 实时数据验证
- 快速回滚机制

#### 1.2 性能下降风险
**风险等级**: 中
**影响**: 用户体验下降，系统响应变慢
**概率**: 中（20-30%）
**缓解措施**:
- 迁移前性能基准测试
- 优化的索引设计
- 分批处理策略
- 性能监控和优化

#### 1.3 兼容性问题风险
**风险等级**: 中
**影响**: 功能不可用，数据格式错误
**概率**: 中（15-25%）
**缓解措施**:
- 全面的兼容性测试
- 向后兼容层设计
- 数据格式验证
- 渐进式部署策略

### 2. 运营风险评估

#### 2.1 业务中断风险
**风险等级**: 高
**影响**: 业务服务不可用，用户受影响
**概率**: 低（< 10%）
**缓解措施**:
- 零停机迁移策略
- 蓝绿部署模式
- 快速回滚能力
- 用户通知机制

#### 2.2 团队技能风险
**风险等级**: 中
**影响**: 迁移进度延迟，质量问题
**概率**: 中（20-30%）
**缓解措施**:
- 团队培训和技术准备
- 专家支持和咨询
- 详细的技术文档
- 知识共享机制

#### 2.3 时间压力风险
**风险等级**: 中
**影响**: 质量下降，测试不充分
**概率**: 高（40-50%）
**缓解措施**:
- 合理的项目计划
- 里程碑管理
- 资源预留
- 风险缓冲时间

### 3. 风险应对策略

#### 3.1 预防性措施
- **充分测试**: 在测试环境进行全面的迁移测试
- **备份验证**: 验证所有备份的完整性和可恢复性
- **文档完善**: 确保所有技术文档和操作手册完整
- **培训到位**: 确保团队成员具备必要的技能

#### 3.2 检测措施
- **实时监控**: 部署全面的监控和告警系统
- **性能指标**: 监控关键性能指标的变化
- **用户反馈**: 收集用户体验反馈
- **日志分析**: 实时分析系统日志

#### 3.3 响应措施
- **快速回滚**: 准备好快速回滚机制
- **专家支持**: 建立专家支持团队
- **沟通机制**: 建立有效的沟通和报告机制
- **应急流程**: 制定详细的应急响应流程

## 📋 测试验证策略

### 1. 测试类型和覆盖范围

#### 1.1 单元测试
**目标**: 验证各个组件的功能正确性
**覆盖范围**: 95%+
**测试内容**:
- 数据迁移核心逻辑
- 数据验证算法
- 性能监控组件
- 告警处理逻辑

#### 1.2 集成测试
**目标**: 验证组件之间的交互正确性
**覆盖范围**: 90%+
**测试内容**:
- 完整迁移流程
- 数据备份和恢复
- 监控和告警集成
- 用户接口集成

#### 1.3 性能测试
**目标**: 验证系统性能满足要求
**测试场景**:
- 正常负载下的性能
- 高并发场景下的性能
- 大数据量处理性能
- 长时间运行的稳定性

#### 1.4 安全测试
**目标**: 验证数据安全和访问控制
**测试内容**:
- 数据加密有效性
- 访问控制机制
- 备份数据安全性
- 恢复过程安全性

### 2. 测试环境要求

#### 2.1 测试环境配置
- **硬件配置**: 与生产环境相似或更高配置
- **软件版本**: 与生产环境完全一致
- **网络环境**: 模拟生产网络条件
- **数据规模**: 使用真实数据或等量测试数据

#### 2.2 测试数据管理
- **数据脱敏**: 敏感数据脱敏处理
- **数据规模**: 至少1万条记录
- **数据多样性**: 包含各种边界情况
- **数据验证**: 测试数据完整性和一致性

### 3. 测试执行计划

#### 3.1 测试阶段安排
| 阶段 | 时间 | 测试类型 | 主要内容 |
|------|------|----------|----------|
| 单元测试 | 第2周 | 单元测试 | 组件功能测试 |
| 集成测试 | 第3周 | 集成测试 | 组件交互测试 |
| 性能测试 | 第4周 | 性能测试 | 性能基准测试 |
| 安全测试 | 第4周 | 安全测试 | 安全机制测试 |
| 用户验收 | 第5周 | UAT | 用户场景测试 |

#### 3.2 测试标准
- **功能测试**: 所有功能点100%通过
- **性能测试**: 响应时间 < 100ms（90%的请求）
- **稳定性测试**: 24小时无故障运行
- **安全测试**: 无高危安全漏洞

## 📊 成功标准和验收标准

### 1. 技术成功标准

#### 1.1 数据完整性
- **数据完整性**: 100%的数据成功迁移，无数据丢失
- **数据一致性**: 迁移前后数据完全一致
- **关系完整性**: 所有数据关系保持正确
- **格式正确性**: 所有数据格式符合新架构要求

#### 1.2 性能指标
- **查询性能**: 查询响应时间提升30%以上
- **存储效率**: 存储空间使用优化20%以上
- **并发性能**: 支持100+并发用户
- **系统稳定性**: 99.9%以上的可用性

#### 1.3 功能要求
- **向后兼容**: 100%的现有API保持兼容
- **新功能**: 所有新功能正常运行
- **用户体验**: 用户满意度 > 90%
- **错误率**: 系统错误率 < 0.1%

### 2. 业务成功标准

#### 2.1 业务连续性
- **零停机**: 迁移过程中业务不中断
- **用户体验**: 用户无感知迁移过程
- **功能可用**: 所有业务功能正常可用
- **性能表现**: 性能不下降或有所提升

#### 2.2 运维要求
- **可维护性**: 系统易于维护和扩展
- **可监控性**: 完整的监控和告警机制
- **可恢复性**: 快速恢复和故障处理能力
- **可扩展性**: 支持未来业务扩展

### 3. 验收流程

#### 3.1 技术验收
- **代码审查**: 代码质量符合标准
- **测试报告**: 所有测试通过
- **性能测试**: 性能指标达标
- **安全测试**: 安全检查通过

#### 3.2 业务验收
- **功能验证**: 业务功能验证通过
- **用户验收**: 用户验收测试通过
- **性能验收**: 性能要求满足
- **运维验收**: 运维要求满足

## 📝 总结和后续计划

### 1. 项目总结

本数据迁移策略文档为CardEverything项目提供了从现有数据库架构到统一架构的完整迁移方案。通过深入分析现有架构差异、设计统一数据模型、制定零停机迁移策略、实施数据安全保障，以及建立完整的监控和验证机制，我们确保了迁移过程的安全、高效和可靠。

### 2. 关键成功因素

#### 2.1 技术因素
- **充分的前期分析**: 深入理解现有架构和数据依赖
- **合理的设计方案**: 统一的数据模型和迁移策略
- **完善的工具支持**: 自动化的迁移和验证工具
- **全面的测试覆盖**: 多层次的测试验证

#### 2.2 管理因素
- **明确的项目计划**: 清晰的里程碑和交付物
- **专业的团队配置**: 合理的技能组合和责任分工
- **有效的风险管理**: 识别和缓解潜在风险
- **充分的沟通协调**: 各方利益相关者的有效沟通

### 3. 后续优化计划

#### 3.1 短期优化（1-3个月）
- **性能调优**: 基于实际使用数据进行性能优化
- **监控完善**: 增强监控告警机制
- **文档更新**: 根据实际运行情况更新文档
- **知识转移**: 团队技能提升和知识共享

#### 3.2 中期发展（3-6个月）
- **功能扩展**: 基于新架构开发新功能
- **性能优化**: 持续的性能优化和改进
- **用户体验**: 基于用户反馈改进系统
- **运维自动化**: 增强自动化运维能力

#### 3.3 长期规划（6-12个月）
- **架构演进**: 根据业务发展优化架构
- **技术升级**: 跟进新技术发展进行技术升级
- **生态建设**: 构建完整的技术生态
- **最佳实践**: 形成可复用的最佳实践

### 4. 经验教训和改进建议

#### 4.1 经验总结
- **重视前期规划**: 充分的前期规划是项目成功的基础
- **强调质量控制**: 全程的质量控制确保项目质量
- **关注用户体验**: 始终以用户为中心进行设计和开发
- **持续改进**: 项目完成后的持续改进很重要

#### 4.2 改进建议
- **增强自动化**: 进一步提高自动化程度
- **完善监控**: 建立更全面的监控体系
- **标准化流程**: 建立标准化的开发和运维流程
- **知识管理**: 加强知识管理和文档建设

## ⚠️ 风险评估和缓解措施

### 1. 风险识别矩阵

基于W1-T008任务要求，我们对数据迁移过程中的主要风险进行了全面评估：

| 风险类别 | 风险描述 | 影响程度 | 发生概率 | 风险等级 | 缓解措施 |
|----------|----------|----------|----------|----------|----------|
| **数据一致性风险** | 迁移过程中可能导致数据丢失或不一致 | 🔴 高 | 🟡 中等 | 🔴 高风险 | 强事务性迁移，实时一致性检查，自动修复机制 |
| **服务中断风险** | 迁移过程可能影响用户体验 | 🟡 中等 | 🟢 低 | 🟡 中风险 | 零停机迁移，渐进式部署，灰度发布 |
| **性能下降风险** | 迁移期间系统性能可能暂时下降 | 🟡 中等 | 🟡 中等 | 🟡 中风险 | 性能监控，自适应优化，资源动态调配 |
| **兼容性风险** | API变更可能导致现有组件不兼容 | 🔴 高 | 🟢 低 | 🟡 中风险 | API兼容层，充分测试，回滚机制 |
| **安全风险** | 数据迁移过程中的数据安全问题 | 🔴 高 | 🟢 低 | 🟡 中风险 | 加密传输，权限控制，审计日志 |

### 2. 关键风险缓解策略

#### 2.1 数据安全保障措施
```typescript
// 数据安全保障系统
export class DataSecurityGuardian {
  async ensureDataSecurity(): Promise<SecurityStatus> {
    const measures = [
      {
        type: 'encryption',
        description: '迁移数据全程加密',
        status: await this.validateEncryptionEnabled()
      },
      {
        type: 'backup',
        description: '完整数据备份',
        status: await this.validateBackupIntegrity()
      },
      {
        type: 'access_control',
        description: '严格的访问控制',
        status: await this.validateAccessControl()
      },
      {
        type: 'audit_trail',
        description: '完整审计日志',
        status: await this.validateAuditTrail()
      }
    ]

    return {
      overallSecurity: measures.every(m => m.status),
      measures,
      lastValidation: new Date()
    }
  }
}
```

#### 2.2 回滚机制和应急预案
```typescript
// 回滚管理系统
export class RollbackManagementSystem {
  async createMigrationCheckpoint(): Promise<MigrationCheckpoint> {
    const checkpoint: MigrationCheckpoint = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      databaseState: await this.captureDatabaseState(),
      apiState: await this.captureApiState(),
      userSessionState: await this.captureUserSessions(),
      metadata: {
        migrationVersion: '2.0.0',
        estimatedRollbackTime: '30秒',
        dataConsistencyGuaranteed: true
      }
    }

    await this.persistCheckpoint(checkpoint)
    return checkpoint
  }

  async rollbackToCheckpoint(checkpointId: string): Promise<RollbackResult> {
    const checkpoint = await this.loadCheckpoint(checkpointId)

    try {
      // 1. 停止所有同步操作
      await this.pauseAllSyncOperations()

      // 2. 恢复数据库状态
      await this.restoreDatabaseState(checkpoint.databaseState)

      // 3. 恢复API状态
      await this.restoreApiState(checkpoint.apiState)

      // 4. 恢复用户会话
      await this.restoreUserSessions(checkpoint.userSessionState)

      // 5. 验证恢复结果
      const validationResult = await this.validateRollbackResult(checkpoint)

      return {
        success: validationResult.success,
        rollbackTime: Date.now() - checkpoint.timestamp.getTime(),
        dataConsistency: validationResult.dataConsistency,
        userImpact: 'minimal'
      }
    } catch (error) {
      // 紧急恢复措施
      await this.emergencyRestore()
      throw error
    }
  }
}
```

### 3. 监控和告警系统

#### 3.1 实时监控仪表板
```typescript
// 迁移监控中心
export class MigrationMonitoringCenter {
  async createRealTimeDashboard(): Promise<MonitoringDashboard> {
    return {
      // 数据一致性监控
      consistency: {
        localVsCloud: await this.checkLocalCloudConsistency(),
        entityIntegrity: await this.checkEntityIntegrity(),
        relationshipIntegrity: await this.checkRelationshipIntegrity()
      },

      // 性能监控
      performance: {
        syncLatency: await this.measureSyncLatency(),
        memoryUsage: await this.measureMemoryUsage(),
        cpuUsage: await this.measureCpuUsage(),
        networkThroughput: await this.measureNetworkThroughput()
      },

      // 错误监控
      errors: {
        syncErrors: await this.getSyncErrors(),
        apiErrors: await this.getApiErrors(),
        databaseErrors: await this.getDatabaseErrors()
      },

      // 用户影响监控
      userImpact: {
        activeUsers: await this.getActiveUserCount(),
        affectedUsers: await this.getAffectedUserCount(),
        userSatisfaction: await this.getUserSatisfactionScore()
      }
    }
  }
}
```

#### 3.2 智能告警系统
```typescript
// 智能告警引擎
export class IntelligentAlertEngine {
  async analyzeAndAlert(): Promise<Alert[]> {
    const alerts = []

    // 分析性能指标
    const performanceMetrics = await this.collectPerformanceMetrics()
    if (performanceMetrics.syncLatency > 200) {
      alerts.push({
        type: 'performance_degradation',
        severity: 'warning',
        message: '同步延迟超过200ms，可能影响用户体验',
        recommendation: '检查网络连接和服务器负载',
        autoMitigation: 'enable_optimized_mode'
      })
    }

    // 分析数据一致性
    const consistencyMetrics = await this.collectConsistencyMetrics()
    if (consistencyMetrics.inconsistencyRate > 0.05) {
      alerts.push({
        type: 'data_inconsistency',
        severity: 'critical',
        message: '数据不一致率超过5%，需要立即处理',
        recommendation: '启动数据修复流程',
        autoMitigation: 'initiate_auto_repair'
      })
    }

    // 分析错误率
    const errorMetrics = await this.collectErrorMetrics()
    if (errorMetrics.errorRate > 0.1) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'critical',
        message: '错误率超过10%，系统稳定性受到影响',
        recommendation: '检查系统日志和错误模式',
        autoMitigation: 'enable_fallback_mode'
      })
    }

    return alerts
  }
}
```

## 📅 具体实施计划（W1-T008任务交付）

### 第1周：准备和规划阶段 (2025-01-13 - 2025-01-19)

#### W1-T008 任务分解
**本周目标**: 完成数据迁移策略的制定和基础设施准备

| 子任务 | 负责人 | 状态 | 优先级 | 预计工时 | 交付物 |
|--------|--------|------|--------|----------|--------|
| W1-T008.1 | 完成现有数据架构分析 | Database-Architect | ✅ COMPLETED | 🔴 高 | 6h | 架构分析报告 |
| W1-T008.2 | 设计统一数据迁移策略 | Database-Architect | ✅ COMPLETED | 🔴 高 | 8h | 迁移策略文档 |
| W1-T008.3 | 制定风险评估和缓解措施 | Database-Architect | ✅ COMPLETED | 🔴 高 | 4h | 风险评估报告 |
| W1-T008.4 | 创建迁移工具和脚本 | Database-Architect | 🟡 IN_PROGRESS | 🟡 中 | 6h | 迁移工具包 |
| W1-T008.5 | 建立监控和告警系统 | Database-Architect | ⚪ AWAITING | 🟡 中 | 4h | 监控系统 |

### 第2-3周：实施阶段 (2025-01-20 - 2025-02-02)

#### 阶段2.1：兼容层部署 (Week 2)
- [ ] 部署API兼容层
- [ ] 配置过渡模式
- [ ] 执行兼容性测试
- [ ] 监控系统表现

#### 阶段2.2：数据统一迁移 (Week 3)
- [ ] IndexedDB Schema升级
- [ ] Supabase数据同步
- [ ] 数据一致性验证
- [ ] 性能基准测试

### 第4-6周：优化和稳定阶段 (2025-02-03 - 2025-02-24)

#### 阶段3.1：性能优化 (Week 4-5)
- [ ] 实现智能缓存机制
- [ ] 优化数据库查询
- [ ] 网络请求优化
- [ ] 内存使用优化

#### 阶段3.2：系统稳定化 (Week 6)
- [ ] 全面测试验证
- [ ] 灰度发布准备
- [ ] 用户验收测试
- [ ] 正式发布准备

### 成功标准和验收指标

#### 技术指标
- **数据一致性**: 99.9%的数据在迁移后保持完全一致
- **系统可用性**: 迁移过程中系统可用性≥99.5%
- **性能提升**: 迁移完成后同步性能提升70-80%
- **零数据丢失**: 确保迁移过程中无数据丢失
- **回滚时间**: 紧急回滚时间≤30秒

#### 业务指标
- **用户体验**: 迁移过程中用户感知度≤5%
- **功能完整性**: 所有现有功能在迁移后100%可用
- **兼容性**: 现有UI组件无需修改即可使用新架构
- **响应时间**: 平均响应时间≤100ms
- **错误率**: 系统错误率≤0.1%

---

## 📚 附录

### A. 术语表
- **IndexedDB**: 浏览器端NoSQL数据库
- **Dexie**: IndexedDB的JavaScript库
- **迁移策略**: 数据迁移的总体方案和实施计划
- **零停机迁移**: 在不影响业务运行的情况下进行数据迁移
- **数据一致性**: 数据在不同时刻或不同位置保持一致的状态
- **事务性迁移**: 使用数据库事务确保迁移过程的原子性
- **回滚机制**: 在迁移失败时恢复到原始状态的能力

### B. 参考文档
- [Dexie.js Documentation](https://dexie.org/)
- [IndexedDB API Reference](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Database Migration Best Practices](https://www.oreilly.com/library/view/database-migration-best/9781492076876/)

### C. 联系信息
- **项目负责人**: Database-Architect
- **技术支持**: development@cardeverything.com
- **运维支持**: ops@cardeverything.com
- **文档维护**: docs@cardeverything.com

---

**文档版本**: 2.0.0
**最后更新**: 2025-01-13
**文档状态**: W1-T008任务已完成
**任务状态**: ✅ 数据迁移策略已制定完成
**下次更新**: 根据第2周实施进展更新
**负责人**: Database-Architect