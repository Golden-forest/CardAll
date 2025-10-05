# SyncOrchestrator 实现指南

## 概述

SyncOrchestrator 是 CardAll 项目的统一同步编排器，旨在简化和优化现有的复杂同步系统。它提供了一个统一的接口来管理所有的同步操作，包括队列管理、冲突解决、网络状态处理和离线操作支持。

## 架构设计

### 核心组件

1. **SyncOrchestrator** - 主要的同步编排器
2. **SyncOrchestratorCompatLayer** - 向后兼容层
3. **SyncOrchestratorFactory** - 工厂模式实现
4. **SyncOrchestratorMigrator** - 迁移工具

### 设计原则

- **统一接口**: 提供单一的入口点来管理所有同步操作
- **队列驱动**: 使用优先级队列来管理同步任务
- **异步处理**: 支持异步同步操作，避免阻塞主线程
- **智能重试**: 实现指数退避重试机制
- **事件驱动**: 通过事件系统实现组件间通信
- **性能优化**: 批量处理、并发控制、缓存策略

## 主要特性

### 1. 统一同步接口

```typescript
// 创建同步操作
const operation: SyncOperation = {
  type: 'card',
  entity: card,
  direction: 'upload',
  priority: SyncPriority.High,
  timestamp: Date.now()
}

// 队列化操作
const taskId = await orchestrator.queueOperation(operation)
```

### 2. 智能队列管理

```typescript
// 获取队列状态
const queueStatus = orchestrator.getQueueStatus()
console.log(`Queue size: ${queueStatus.queueSize}`)
console.log(`Active tasks: ${queueStatus.activeTasks}`)

// 取消特定任务
await orchestrator.cancelTask(taskId)

// 取消所有任务
await orchestrator.cancelAllTasks()
```

### 3. 会话管理

```typescript
// 开始同步会话
const sessionId = await orchestrator.startSyncSession()

// 强制同步所有待处理操作
const result = await orchestrator.forceSync()
```

### 4. 性能监控

```typescript
// 获取同步状态
const state = orchestrator.getSyncState()
console.log(`Success rate: ${(state.metrics.successfulSyncs / state.metrics.totalSyncs * 100).toFixed(2)}%`)
console.log(`Average sync time: ${state.metrics.averageSyncTime.toFixed(2)}ms`)
```

## 使用方法

### 基础使用

```typescript
import { createDefaultSyncOrchestrator } from './services/sync-orchestrator-factory'

// 创建同步编排器
const orchestrator = createDefaultSyncOrchestrator({
  maxConcurrentSyncs: 3,
  batchSize: 10,
  enableDebugMode: true
})

// 初始化
await orchestrator.initialize()

// 同步操作
const taskId = await orchestrator.queueOperation({
  type: 'card',
  entity: card,
  direction: 'upload',
  priority: SyncPriority.Normal,
  timestamp: Date.now()
})
```

### 兼容层使用

```typescript
import { createSyncOrchestratorCompat } from './services/sync-orchestrator-compat'

// 创建兼容层
const compatLayer = createSyncOrchestratorCompat()

// 使用兼容接口
await compatLayer.syncCard(card, 'upload')
await compatLayer.syncCards(cards, 'upload')

// 获取状态
const status = compatLayer.getSyncStatus()
const queueStatus = compatLayer.getQueueStatus()
```

### 高级使用

```typescript
import { SyncOrchestrator } from './services/sync-orchestrator'

// 自定义配置
const config: SyncOrchestratorConfig = {
  maxConcurrentSyncs: 5,
  queueSizeLimit: 1000,
  retryAttempts: 5,
  retryDelay: 2000,
  batchSize: 20,
  enableDebugMode: true,
  enableMetrics: true
}

// 创建编排器
const orchestrator = new SyncOrchestrator(config)
await orchestrator.initialize()

// 设置事件监听
eventSystem.on(AppEvents.SYNC.COMPLETED, (data) => {
  console.log('Sync completed:', data)
})
```

## 配置选项

### 开发环境配置

```typescript
const developmentConfig = {
  maxConcurrentSyncs: 2,
  batchSize: 5,
  retryAttempts: 2,
  enableDebugMode: true,
  enableMetrics: true
}
```

### 生产环境配置

```typescript
const productionConfig = {
  maxConcurrentSyncs: 5,
  batchSize: 20,
  retryAttempts: 5,
  enableDebugMode: false,
  enableMetrics: true,
  offlineTimeout: 60000,
  networkQualityThreshold: 0.5
}
```

### 测试环境配置

```typescript
const testConfig = {
  maxConcurrentSyncs: 1,
  batchSize: 1,
  retryAttempts: 1,
  enableDebugMode: false,
  enableMetrics: false
}
```

## 迁移指南

### 兼容性迁移

```typescript
import { performCompatibilityMigration } from './services/sync-orchestrator-migration'

// 执行兼容性迁移
const result = await performCompatibilityMigration()
console.log('Migration result:', result)
```

### 渐进式迁移

```typescript
import { performProgressiveMigration } from './services/sync-orchestrator-migration'

// 执行渐进式迁移
const result = await performProgressiveMigration()
console.log('Migration result:', result)
```

### 完全迁移

```typescript
import { performCompleteMigration } from './services/sync-orchestrator-migration'

// 执行完全迁移
const result = await performCompleteMigration()
console.log('Migration result:', result)
```

## 性能优化

### 批量处理

```typescript
// 批量同步多个实体
const results = await compatLayer.syncCards(cards, 'upload')
```

### 并发控制

```typescript
// 配置并发数
const orchestrator = createDefaultSyncOrchestrator({
  maxConcurrentSyncs: 10
})
```

### 优先级管理

```typescript
// 设置高优先级
await orchestrator.queueOperation({
  type: 'card',
  entity: importantCard,
  direction: 'upload',
  priority: SyncPriority.High
})
```

## 错误处理

### 重试机制

```typescript
// 配置重试策略
const orchestrator = createDefaultSyncOrchestrator({
  retryAttempts: 5,
  retryDelay: 2000
})
```

### 错误监控

```typescript
// 监听同步失败事件
eventSystem.on(AppEvents.SYNC.FAILED, (data) => {
  console.error('Sync failed:', data.error)
  console.error('Operation:', data.operation)
})
```

### 错误恢复

```typescript
// 获取错误信息
const state = orchestrator.getSyncState()
console.log(`Error rate: ${(state.metrics.errorRate * 100).toFixed(2)}%`)
```

## 监控和调试

### 调试模式

```typescript
const orchestrator = createDefaultSyncOrchestrator({
  enableDebugMode: true
})
```

### 性能指标

```typescript
const metrics = orchestrator.getSyncState().metrics
console.log('Performance metrics:', metrics)
```

### 事件日志

```typescript
// 监听所有同步事件
eventSystem.on(AppEvents.SYNC.STARTED, (data) => {
  console.log('Sync started:', data)
})

eventSystem.on(AppEvents.SYNC.COMPLETED, (data) => {
  console.log('Sync completed:', data)
})
```

## 最佳实践

### 1. 初始化时机

```typescript
// 在应用启动时初始化
async function initializeApp() {
  const orchestrator = createDefaultSyncOrchestrator()
  await orchestrator.initialize()

  // 初始化其他组件
  // ...
}
```

### 2. 错误处理

```typescript
try {
  const result = await compatLayer.syncCard(card, 'upload')
  if (!result.success) {
    console.error('Sync failed:', result.error)
  }
} catch (error) {
  console.error('Sync error:', error)
}
```

### 3. 资源清理

```typescript
// 在应用关闭时清理
async function cleanupApp() {
  const orchestrator = getSyncOrchestrator()
  if (orchestrator) {
    await orchestrator.destroy()
  }
}
```

### 4. 性能优化

```typescript
// 使用批量操作
async function syncMultipleCards(cards: Card[]) {
  const compatLayer = createDefaultCompatLayer()
  return await compatLayer.syncCards(cards, 'upload')
}
```

## 故障排除

### 常见问题

1. **同步操作失败**
   - 检查网络连接
   - 验证认证状态
   - 查看错误日志

2. **队列积压**
   - 增加并发数
   - 检查网络质量
   - 优化批量大小

3. **性能问题**
   - 启用性能指标
   - 检查内存使用
   - 优化同步策略

### 调试步骤

1. 启用调试模式
2. 检查事件日志
3. 监控性能指标
4. 验证网络状态
5. 检查队列状态

## API 参考

### SyncOrchestrator

#### 方法

- `initialize()`: 初始化编排器
- `destroy()`: 销毁编排器
- `queueOperation(operation)`: 队列化同步操作
- `startSyncSession()`: 开始同步会话
- `forceSync()`: 强制同步
- `cancelTask(taskId)`: 取消任务
- `cancelAllTasks()`: 取消所有任务
- `getSyncState()`: 获取同步状态
- `getQueueStatus()`: 获取队列状态
- `clearSyncHistory()`: 清空历史

### SyncOrchestratorCompat

#### 方法

- `syncCard(card, direction)`: 同步卡片
- `syncCards(cards, direction)`: 批量同步卡片
- `syncFolder(folder, direction)`: 同步文件夹
- `syncFolders(folders, direction)`: 批量同步文件夹
- `syncTag(tag, direction)`: 同步标签
- `syncTags(tags, direction)`: 批量同步标签
- `syncImage(image, direction)`: 同步图片
- `syncImages(images, direction)`: 批量同步图片
- `startSync()`: 开始同步
- `stopSync()`: 停止同步
- `getSyncStatus()`: 获取同步状态
- `getQueueStatus()`: 获取队列状态

## 总结

SyncOrchestrator 提供了一个强大而灵活的同步解决方案，它：

1. **简化了复杂性**: 统一了多个同步服务的接口
2. **提高了性能**: 通过队列驱动和批量处理优化性能
3. **增强了可靠性**: 智能重试和错误处理机制
4. **保证了兼容性**: 提供了向后兼容层
5. **支持了监控**: 完整的性能监控和调试工具

通过使用 SyncOrchestrator，您可以显著简化同步逻辑的复杂性，同时提高应用的性能和可靠性。