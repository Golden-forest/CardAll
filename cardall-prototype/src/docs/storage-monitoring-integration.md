# 存储监控功能集成指南

本文档介绍如何将存储监控和诊断功能集成到 CardAll 应用中，确保数据持久化的可靠性和可观察性。

## 概述

存储监控系统提供以下功能：
- 实时存储操作监控
- 性能指标收集和分析
- 健康状态评估
- 错误检测和告警
- 自动诊断和优化建议
- 用户友好的诊断界面

## 核心组件

### 1. 存储监控服务 (`storage-monitor.ts`)

主要功能：
- 实时监控存储操作
- 收集性能指标
- 健康状态评估
- 错误检测和告警
- 数据导出

```typescript
import {
  storageMonitorService,
  startStorageMonitoring,
  recordStorageOperation,
  getStorageHealth
} from '../services/storage-monitor'

// 启动监控
startStorageMonitoring()

// 记录操作
recordStorageOperation('write', 'save_card', duration, success, dataSize)

// 获取健康状态
const health = getStorageHealth()
```

### 2. 诊断面板组件 (`storage-diagnostics-panel.tsx`)

完整的诊断界面，包含：
- 健康状态概览
- 性能指标展示
- 问题列表和管理
- 详细诊断报告

```typescript
import StorageDiagnosticsPanel from '../components/storage-diagnostics-panel'

// 使用方法
<StorageDiagnosticsPanel
  isOpen={isPanelOpen}
  onClose={() => setIsPanelOpen(false)}
/>
```

### 3. 工具栏组件 (`storage-diagnostics-toolbar.tsx`)

简洁的工具栏，包含：
- 健康状态指示器
- 监控控制按钮
- 快速诊断按钮

```typescript
import StorageDiagnosticsToolbar from '../components/storage-diagnostics-toolbar'

// 使用方法
<StorageDiagnosticsToolbar />
```

## 集成步骤

### 步骤 1: 在应用初始化时启动监控

修改 `src/main.tsx` 或应用初始化文件：

```typescript
import { startStorageMonitoring } from './services/storage-monitor'

// 在应用启动时启动监控
const initializeApp = async () => {
  // 其他初始化逻辑...

  // 启动存储监控
  startStorageMonitoring()

  // 继续其他初始化...
}
```

### 步骤 2: 在存储操作中记录事件

修改存储相关的服务，在关键操作中记录事件：

```typescript
// 在 UniversalStorageAdapter 中
export class UniversalStorageAdapter implements StorageAdapter {
  async saveCard(card: Card): Promise<Card> {
    const startTime = performance.now()

    try {
      // 原有的保存逻辑...
      const result = await this.actualSaveCard(card)

      const duration = performance.now() - startTime
      recordStorageOperation('write', 'save_card', duration, true, JSON.stringify(card).length)

      return result
    } catch (error) {
      const duration = performance.now() - startTime
      recordStorageOperation('write', 'save_card', duration, false, 0, error.message)
      throw error
    }
  }
}
```

### 步骤 3: 在UI中添加诊断工具栏

在应用的主要界面中添加工具栏：

```typescript
// 在 App.tsx 或主要布局组件中
import StorageDiagnosticsToolbar from './components/storage-diagnostics-toolbar'

function App() {
  return (
    <div className=\"app\">
      <header>
        {/* 其他头部内容 */}
        <StorageDiagnosticsToolbar />
      </header>

      {/* 应用内容 */}
    </div>
  )
}
```

### 步骤 4: 添加诊断面板入口

在设置或帮助菜单中添加诊断面板入口：

```typescript
import StorageDiagnosticsPanel from './components/storage-diagnostics-panel'

function SettingsPage() {
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false)

  return (
    <div>
      <button onClick={() => setIsDiagnosticsOpen(true)}>
        存储诊断
      </button>

      <StorageDiagnosticsPanel
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />
    </div>
  )
}
```

## 监控的操作类型

### 需要监控的关键操作

1. **数据读取操作**
   - 读取卡片
   - 读取文件夹
   - 读取标签
   - 读取设置

2. **数据写入操作**
   - 保存卡片
   - 保存文件夹
   - 保存标签
   - 更新设置

3. **数据删除操作**
   - 删除卡片
   - 删除文件夹
   - 删除标签

4. **同步操作**
   - 数据同步
   - 备份操作
   - 恢复操作

### 操作记录示例

```typescript
// 读取操作
recordStorageOperation(
  'read',              // 操作类型
  'read_cards',        // 操作名称
  duration,            // 操作耗时
  true,                // 是否成功
  totalSize,           // 数据大小（可选）
  undefined,           // 错误信息（可选）
  { cardCount: 10 }    // 上下文信息（可选）
)

// 写入操作
recordStorageOperation(
  'write',
  'save_card',
  duration,
  success,
  JSON.stringify(card).length,
  error ? error.message : undefined,
  { cardId: card.id }
)

// 错误操作
recordStorageOperation(
  'error',
  'storage_quota_exceeded',
  0,
  false,
  0,
  'Storage quota exceeded',
  { quota: 5000000, usage: 4800000 }
)
```

## 配置选项

### 监控配置

```typescript
const config = {
  enabled: true,                    // 启用监控
  sampleInterval: 5000,             // 采样间隔（毫秒）
  maxSamples: 1000,                // 最大样本数
  retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 数据保留期

  alertsEnabled: true,              // 启用告警
  alertThresholds: {                // 告警阈值
    maxResponseTime: 1000,         // 最大响应时间
    maxOperationTime: 5000,         // 最大操作时间
    minSuccessRate: 0.95,          // 最小成功率
    maxStorageUsage: 0.8,          // 最大存储使用率
    maxErrorRate: 0.05,            // 最大错误率
    maxQueueSize: 100              // 最大队列大小
  },

  autoDiagnostics: true,           // 自动诊断
  diagnosticInterval: 30 * 60 * 1000, // 诊断间隔

  generateReports: true,           // 生成报告
  reportInterval: 60 * 60 * 1000,  // 报告间隔

  collectDetailedMetrics: false,   // 收集详细指标
  anonymizeData: true              // 数据匿名化
}

storageMonitorService.updateConfig(config)
```

### 隐私设置

监控系统支持隐私保护：

```typescript
// 匿名化数据
storageMonitorService.updateConfig({
  collectDetailedMetrics: false,  // 不收集详细指标
  anonymizeData: true             // 匿名化数据
})

// 禁用监控
storageMonitorService.updateConfig({
  enabled: false
})
```

## 最佳实践

### 1. 性能考虑

- **避免过度监控**：只监控关键操作，避免性能影响
- **合理采样**：使用适当的采样间隔，避免频繁数据收集
- **批量处理**：对于批量操作，记录总体指标而非每个子操作

```typescript
// 好的做法：批量操作记录
async function saveMultipleCards(cards: Card[]) {
  const startTime = performance.now()

  try {
    await Promise.all(cards.map(card => this.saveCard(card)))

    const duration = performance.now() - startTime
    recordStorageOperation('write', 'save_multiple_cards', duration, true, JSON.stringify(cards).length)
  } catch (error) {
    const duration = performance.now() - startTime
    recordStorageOperation('write', 'save_multiple_cards', duration, false, 0, error.message)
  }
}
```

### 2. 错误处理

- **完整记录**：记录错误时的上下文信息
- **分类处理**：区分临时性和永久性错误
- **恢复跟踪**：记录错误恢复情况

```typescript
try {
  const result = await storageOperation()
  recordStorageOperation('write', operationName, duration, true, dataSize)
} catch (error) {
  // 记录详细错误信息
  recordStorageOperation('write', operationName, duration, false, 0, error.message, {
    errorType: error.constructor.name,
    retryable: isRetryableError(error),
    stack: error.stack
  })

  // 根据错误类型处理
  if (isRetryableError(error)) {
    // 重试逻辑
  } else {
    // 用户通知
  }
}
```

### 3. 数据保护

- **敏感信息过滤**：不记录敏感的用户数据
- **数据最小化**：只记录必要的监控数据
- **用户控制**：提供隐私设置选项

```typescript
// 过滤敏感信息
function sanitizeData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  const sanitized = { ...data }

  // 移除敏感字段
  const sensitiveFields = ['password', 'token', 'secret', 'key']
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  })

  return sanitized
}
```

## 监控指标说明

### 核心指标

1. **性能指标**
   - 操作响应时间
   - 吞吐量（操作/秒）
   - 数据传输大小
   - 压缩效率

2. **可靠性指标**
   - 成功率
   - 错误率
   - 重试次数
   - 恢复时间

3. **可用性指标**
   - 存储使用率
   - 队列大小
   - 系统可用性
   - 故障时间

4. **效率指标**
   - 存储效率
   - 缓存命中率
   - 资源利用率
   - 操作效率

### 告警规则

系统会根据以下规则触发告警：

- **性能告警**：操作响应时间超过阈值
- **可靠性告警**：错误率超过阈值
- **可用性告警**：存储使用率过高
- **容量告警**：队列积压过多

## 故障排除

### 常见问题

1. **监控数据不准确**
   - 检查操作记录是否完整
   - 验证时间戳是否正确
   - 确认数据大小计算

2. **性能影响过大**
   - 减少采样频率
   - 禁用详细指标收集
   - 优化事件记录逻辑

3. **告警过于频繁**
   - 调整告警阈值
   - 实现告警冷却机制
   - 优化告警规则

### 调试方法

```typescript
// 启用调试日志
storageMonitorService.updateConfig({
  collectDetailedMetrics: true
})

// 导出调试数据
const debugData = storageMonitorService.exportMonitoringData()
console.log('Debug data:', debugData)

// 手动触发诊断
const report = await storageMonitorService.runDiagnostics()
console.log('Diagnostic report:', report)
```

## 扩展功能

### 自定义指标

```typescript
// 添加自定义指标
storageMonitorService.recordCustomMetric('custom_metric_name', value, {
  category: 'performance',
  unit: 'milliseconds'
})
```

### 自定义告警

```typescript
// 添加自定义告警规则
storageMonitorService.addAlertRule({
  id: 'custom_alert',
  name: 'Custom Alert',
  condition: {
    metric: 'custom_metric',
    operator: 'gt',
    value: threshold
  },
  actions: [
    { type: 'notify', params: { message: 'Custom alert triggered' } }
  ]
})
```

### 第三方集成

```typescript
// 集成到现有监控系统
function integrateWithExistingMonitoring() {
  const health = getStorageHealth()

  // 发送到现有监控系统
  sendToMonitoringSystem({
    service: 'storage',
    health: health.overall,
    score: health.score,
    metrics: health
  })
}
```

## 总结

存储监控系统为 CardAll 应用提供了全面的存储操作可观察性。通过正确集成和配置，可以：

1. **提前发现问题**：通过实时监控和告警
2. **快速诊断问题**：通过详细的诊断信息
3. **优化性能**：通过性能指标分析
4. **提升用户体验**：通过可靠的存储操作

请根据应用的具体需求和用户反馈，调整监控配置和功能。