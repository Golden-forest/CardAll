# CardAll 架构设计文档

## 概述

CardAll 采用了现代化的离线优先架构设计，经过 v5.6.5 版本的重构优化，实现了简洁高效的服务层架构。本文档详细描述了系统的架构设计、技术选型和实现细节。

## 架构演进

### 重构前 (v5.6.3 之前)
- 服务文件数量：199个
- 架构复杂度高
- 代码重复较多
- 维护成本高

### 重构后 (v5.6.5)
- 服务文件数量：减少 40%
- 架构清晰简洁
- 功能高度整合
- 维护成本降低

## 核心架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    用户界面层 (UI Layer)                      │
├─────────────────────────────────────────────────────────────┤
│  React Components │ Context API │ Custom Hooks │ Utils      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    业务逻辑层 (Service Layer)                 │
├─────────────────────────────────────────────────────────────┤
│ UnifiedSyncService │ NetworkManager │ ConflictResolver      │
│ DataSyncService   │ Auth Service   │ Database Service      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    数据存储层 (Data Layer)                    │
├─────────────────────────────────────────────────────────────┤
│      Dexie (IndexedDB)      │        Supabase (Cloud)      │
│    - 离线数据存储           │      - 在线数据同步          │
│    - 本地缓存               │      - 用户认证              │
│    - 队列管理               │      - 实时同步              │
└─────────────────────────────────────────────────────────────┘
```

## 核心服务层

### 1. UnifiedSyncService (统一同步服务)

**职责**: 作为同步系统的核心协调器，整合所有同步相关功能。

**主要功能**:
- 同步操作管理
- 网络状态感知
- 冲突解决协调
- 事件系统集成

**核心方法**:
```typescript
class UnifiedSyncService {
  // 初始化服务
  async initialize(): Promise<void>

  // 同步操作
  async performFullSync(): Promise<SyncResult>
  async performIncrementalSync(): Promise<SyncResult>
  async addOperation(operation: UnifiedSyncOperation): Promise<string>

  // 状态管理
  async getStatus(): Promise<SyncStatus>
  async getMetrics(): Promise<SyncMetrics>
  onStatusChange(callback: (status: SyncStatus) => void): () => void
}
```

**设计特点**:
- 单例模式确保全局唯一
- 事件驱动架构
- 依赖注入机制
- 完整的错误处理

### 2. NetworkManager (网络管理器)

**职责**: 智能网络状态检测和同步策略管理。

**主要功能**:
- 网络状态监控
- 连接质量评估
- 同步策略选择
- 离线/在线切换

**核心接口**:
```typescript
interface NetworkManager {
  startMonitoring(): void
  getCurrentStatus(): UnifiedNetworkStatus
  addListener(listener: NetworkListener): void
  getOptimalSyncStrategy(): SyncStrategy
}
```

**智能策略**:
- **Excellent**: 1分钟间隔，全量同步
- **Good**: 2分钟间隔，增量同步
- **Fair**: 5分钟间隔，谨慎同步
- **Poor**: 10分钟间隔，最小同步

### 3. ConflictResolver (冲突解决器)

**职责**: 智能数据冲突检测和解决。

**解决策略**:
1. **时间戳策略**: 基于 updated_at 字段
2. **用户选择策略**: 提供用户界面选择
3. **智能合并策略**: 字段级别的智能合并
4. **优先级策略**: 基于数据优先级

**工作流程**:
```
检测冲突 → 分析冲突类型 → 选择解决策略 → 执行解决 → 验证结果
```

### 4. DataSyncService (数据同步服务)

**职责**: 核心数据同步引擎，处理实际的数据传输。

**主要特性**:
- 双向同步支持
- 批量操作优化
- 数据一致性验证
- 性能监控

**同步模式**:
```typescript
enum SyncDirection {
  UP = 'up',           // 本地到云端
  DOWN = 'down',       // 云端到本地
  BIDIRECTIONAL = 'bidirectional'  // 双向同步
}
```

## 数据架构

### 本地数据库 (Dexie)

**表结构**:
```typescript
interface DbCard {
  id: string
  title: string
  content: string
  folderId: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
  userId: string
  pendingSync: boolean
}

interface DbFolder {
  id: string
  name: string
  parentId: string | null
  isExpanded: boolean
  createdAt: Date
  updatedAt: Date
  userId: string
  pendingSync: boolean
}

interface DbTag {
  id: string
  name: string
  color: string
  createdAt: Date
  updatedAt: Date
  userId: string
  pendingSync: boolean
}
```

**索引策略**:
- 用户ID索引 (快速过滤)
- 更新时间索引 (增量同步)
- 同步状态索引 (队列管理)

### 云端数据库 (Supabase)

**表结构**: 与本地数据库结构保持一致，增加云端特定字段：

```sql
-- cards 表
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  folder_id UUID REFERENCES folders(id),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  version INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ
);

-- folders 表
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id),
  is_expanded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  version INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ
);

-- tags 表
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  version INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ
);
```

## 同步机制

### 同步流程

#### 1. 全量同步 (Full Sync)
```typescript
async performFullSync(): Promise<SyncResult> {
  // 1. 预同步验证
  const preValidation = await syncValidationService.preSyncValidation()

  // 2. 执行同步
  const syncSession = await dataSyncService.performFullSync('bidirectional')

  // 3. 后同步验证
  const postValidation = await syncValidationService.postSyncValidation(syncSession)

  return {
    success: syncSession.state === 'completed',
    validationResult: postValidation,
    syncTime: syncSession.duration,
    operationsProcessed: syncSession.processed
  }
}
```

#### 2. 增量同步 (Incremental Sync)
```typescript
async performIncrementalSync(): Promise<SyncResult> {
  // 1. 快速健康检查
  const healthCheck = await syncValidationService.quickHealthCheck()

  // 2. 处理本地队列
  const localResult = await this.processLocalSyncQueue()

  // 3. 检查云端更新
  const cloudResult = await this.checkCloudUpdates()

  // 4. 轻量级验证
  const validation = await syncValidationService.validateSyncConsistency()

  return {
    success: true,
    operationsProcessed: localResult + cloudResult,
    validationResult: validation
  }
}
```

### 冲突解决机制

#### 冲突检测
```typescript
interface ConflictDetection {
  // 版本冲突
  versionConflict: boolean

  // 时间戳冲突
  timestampConflict: boolean

  // 内容冲突
  contentConflict: boolean

  // 结构冲突
  structureConflict: boolean
}
```

#### 解决策略
1. **自动解决**: 基于预定义规则
2. **用户选择**: 提供选择界面
3. **智能合并**: 字段级别合并
4. **标记为冲突**: 等待手动处理

## 性能优化

### 1. 代码分割
- 路由级别的代码分割
- 组件级别的懒加载
- 服务模块的按需加载

### 2. 数据优化
- 虚拟滚动 (大量数据)
- 图片懒加载
- 数据缓存策略
- 增量同步算法

### 3. 网络优化
- 请求合并
- 批量操作
- 压缩传输
- 智能重试机制

### 4. 缓存策略
```typescript
interface CacheStrategy {
  // 内存缓存
  memoryCache: {
    maxSize: 100 * 1024 * 1024, // 100MB
    ttl: 30 * 60 * 1000         // 30分钟
  }

  // 本地存储缓存
  localStorageCache: {
    maxSize: 50 * 1024 * 1024,  // 50MB
    ttl: 24 * 60 * 60 * 1000    // 24小时
  }

  // 索引DB缓存
  indexedDBCache: {
    maxSize: 200 * 1024 * 1024, // 200MB
    ttl: 7 * 24 * 60 * 60 * 1000 // 7天
  }
}
```

## 错误处理

### 错误分类
```typescript
enum ErrorCategory {
  NETWORK = 'network',           // 网络错误
  AUTHENTICATION = 'auth',       // 认证错误
  VALIDATION = 'validation',     // 验证错误
  CONFLICT = 'conflict',         // 冲突错误
  SYSTEM = 'system'             // 系统错误
}

enum ErrorSeverity {
  LOW = 'low',                   // 低级错误
  MEDIUM = 'medium',             // 中级错误
  HIGH = 'high',                 // 高级错误
  CRITICAL = 'critical'          // 严重错误
}
```

### 重试策略
```typescript
interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
  retryCondition: (error: Error) => boolean
}
```

## 安全设计

### 1. 认证机制
- Supabase Auth 集成
- JWT Token 管理
- 会话持久化
- 自动刷新机制

### 2. 数据安全
- 传输层加密 (HTTPS)
- 本地数据加密 (可选)
- 敏感信息脱敏
- 数据完整性校验

### 3. 权限控制
```typescript
interface UserPermissions {
  read: boolean
  write: boolean
  delete: boolean
  share: boolean
  admin: boolean
}
```

## 监控和诊断

### 性能监控
```typescript
interface PerformanceMetrics {
  // 同步性能
  syncMetrics: {
    averageSyncTime: number
    successRate: number
    conflictRate: number
    throughput: number
  }

  // 网络性能
  networkMetrics: {
    latency: number
    bandwidth: number
    packetLoss: number
    connectionQuality: number
  }

  // 应用性能
  appMetrics: {
    memoryUsage: number
    cpuUsage: number
    renderTime: number
    interactionDelay: number
  }
}
```

### 诊断工具
- 健康检查接口
- 同步状态报告
- 错误日志收集
- 性能分析工具

## 部署架构

### 生产环境
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CDN (静态资源)  │    │  Web App (Vercel) │    │  Supabase (后端)  │
│                 │    │                 │    │                 │
│ - 静态文件       │    │ - React App     │    │ - PostgreSQL     │
│ - 缓存策略       │    │ - API Routes    │    │ - Auth Service   │
│ - 全球分发       │    │ - Edge Functions │    │ - Realtime       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 开发环境
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   本地开发服务器   │    │  Supabase CLI    │    │   本地数据库      │
│                 │    │                 │    │                 │
│ - Vite Dev      │    │ - 本地模拟       │    │ - Docker         │
│ - HMR           │    │ - 数据迁移       │    │ - 测试数据       │
│ - 开发工具       │    │ - 环境管理       │    │ - 备份恢复       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 扩展性设计

### 1. 模块化架构
- 服务模块独立
- 接口标准化
- 插件机制支持
- 版本兼容性

### 2. 数据扩展
- 字段扩展机制
- 表结构演进
- 数据迁移工具
- 向后兼容性

### 3. 功能扩展
- 组件库扩展
- 主题系统
- 国际化支持
- 第三方集成

## 总结

CardAll 的架构设计体现了以下核心原则：

1. **简洁性**: 通过重构简化架构，减少复杂性
2. **可靠性**: 完善的错误处理和恢复机制
3. **性能**: 多层次的性能优化策略
4. **可扩展性**: 模块化设计支持功能扩展
5. **用户体验**: 离线优先的流畅体验

这种架构设计确保了系统的稳定性、可维护性和可扩展性，为用户提供高质量的知识管理体验。