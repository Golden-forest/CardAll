# 错误处理系统集成指南

## 概述

CardEverything 项目的统一错误处理架构提供了全面的错误处理、恢复和自愈能力。本指南说明如何集成和使用错误处理系统。

## 系统架构

### 核心组件

1. **UnifiedErrorHandler** - 统一错误处理器
2. **ErrorMonitoringService** - 错误监控服务
3. **RecoveryStrategyManager** - 恢复策略管理器
4. **SelfHealingFramework** - 自愈框架

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    应用层 (Application Layer)                │
├─────────────────────────────────────────────────────────────┤
│  组件 A  │  组件 B  │  组件 C  │  同步服务  │  网络服务  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   错误处理层 (Error Handling)               │
├─────────────────────────────────────────────────────────────┤
│          UnifiedErrorHandler (统一错误处理器)              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │分类器   │  │处理器   │  │记录器   │  │恢复器   │     │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   恢复策略层 (Recovery)                     │
├─────────────────────────────────────────────────────────────┤
│    重试策略   │   熔断器   │   数据回滚   │   降级模式   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   自愈框架层 (Self-Healing)                 │
├─────────────────────────────────────────────────────────────┤
│  模式识别   │  根因分析   │  自愈执行   │  知识学习   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   监控告警层 (Monitoring)                   │
├─────────────────────────────────────────────────────────────┤
│   实时监控   │   告警规则   │   健康检查   │   指标收集   │
└─────────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 初始化错误处理系统

```typescript
// src/services/error-handling/index.ts
import { UnifiedErrorHandler } from './unified-error-handler'
import { ErrorMonitoringService } from './error-monitoring-service'
import { RecoveryStrategyManager } from './recovery-strategy-manager'
import { SelfHealingFramework } from './self-healing-framework'

export class ErrorHandlingSystem {
  private static instance: ErrorHandlingSystem
  private errorHandler: UnifiedErrorHandler
  private monitoringService: ErrorMonitoringService
  private recoveryManager: RecoveryStrategyManager
  private selfHealingFramework: SelfHealingFramework

  private constructor() {
    // 初始化监控服务
    this.monitoringService = ErrorMonitoringService.getInstance()

    // 初始化恢复管理器
    this.recoveryManager = RecoveryStrategyManager.getInstance(this.monitoringService)

    // 初始化自愈框架
    this.selfHealingFramework = SelfHealingFramework.getInstance(
      this.recoveryManager,
      this.monitoringService
    )

    // 初始化统一错误处理器
    this.errorHandler = UnifiedErrorHandler.getInstance(
      this.monitoringService,
      this.recoveryManager,
      this.selfHealingFramework
    )

    // 配置错误处理器
    this.configureErrorHandler()
  }

  public static getInstance(): ErrorHandlingSystem {
    if (!ErrorHandlingSystem.instance) {
      ErrorHandlingSystem.instance = new ErrorHandlingSystem()
    }
    return ErrorHandlingSystem.instance
  }

  public getErrorHandler(): UnifiedErrorHandler {
    return this.errorHandler
  }

  public getMonitoringService(): ErrorMonitoringService {
    return this.monitoringService
  }

  public getRecoveryManager(): RecoveryStrategyManager {
    return this.recoveryManager
  }

  public getSelfHealingFramework(): SelfHealingFramework {
    return this.selfHealingFramework
  }

  private configureErrorHandler(): void {
    // 注册自定义错误处理器
    this.errorHandler.registerHandler({
      canHandle: (error) => error.category === ErrorCategory.NETWORK,
      handle: async (error, context) => {
        // 自定义网络错误处理逻辑
        console.log('处理网络错误:', error.message)
        return { success: true, action: 'network-handled' }
      }
    })

    // 配置监控告警规则
    this.monitoringService.addAlertRule({
      id: 'high-error-rate',
      name: '高错误率告警',
      condition: {
        type: 'error_rate',
        operator: 'greater_than',
        value: 0.1,
        timeWindow: 300000
      },
      severity: AlertSeverity.HIGH,
      channels: ['console', 'notification'],
      message: '系统错误率超过10%',
      cooldownPeriod: 300000
    })
  }
}

// 导出单例实例
export const errorHandlingSystem = ErrorHandlingSystem.getInstance()
```

### 2. 在组件中使用错误处理

```typescript
// src/components/CardEditor.tsx
import { errorHandlingSystem } from '../services/error-handling'

export function CardEditor() {
  const handleSave = async () => {
    try {
      await saveCardData()
    } catch (error) {
      const context = {
        component: 'CardEditor',
        operation: 'save',
        environment: process.env.NODE_ENV,
        timestamp: Date.now()
      }

      const result = await errorHandlingSystem.getErrorHandler().handleError(error, context)

      if (!result.success) {
        // 处理错误恢复失败的情况
        showErrorMessage('保存失败，请稍后重试')
      }
    }
  }

  return <div>...</div>
}
```

### 3. 在同步服务中使用

```typescript
// src/services/sync/optimized-cloud-sync.ts
import { errorHandlingSystem } from '../error-handling'

export class OptimizedCloudSync {
  async performSync(): Promise<SyncResult> {
    try {
      // 创建同步检查点
      const checkpoint = errorHandlingSystem.getRecoveryManager().createCheckpoint(
        'cloud-sync',
        { lastSyncTime: Date.now() },
        { type: 'incremental' },
        true
      )

      const result = await this.executeSync()

      return result
    } catch (error) {
      const context = {
        component: 'OptimizedCloudSync',
        operation: 'performSync',
        environment: process.env.NODE_ENV,
        timestamp: Date.now()
      }

      return await errorHandlingSystem.getErrorHandler().handleError(error, context)
    }
  }
}
```

## 配置选项

### 错误处理器配置

```typescript
// 错误处理器配置
const errorHandlerConfig = {
  // 最大错误重试次数
  maxRetries: 3,

  // 错误日志保留时间（毫秒）
  logRetentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7天

  // 启用自愈功能
  enableSelfHealing: true,

  // 自愈置信度阈值
  selfHealingConfidenceThreshold: 0.6,

  // 监控采样率
  monitoringSampleRate: 1.0
}
```

### 监控服务配置

```typescript
// 监控服务配置
const monitoringConfig = {
  // 监控数据保留时间
  retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30天

  // 告警规则
  alertRules: [
    {
      id: 'critical-error-alert',
      name: '严重错误告警',
      condition: {
        type: 'error_count',
        operator: 'greater_than',
        value: 5,
        timeWindow: 300000
      },
      severity: AlertSeverity.CRITICAL,
      channels: ['console', 'notification', 'email'],
      cooldownPeriod: 600000
    }
  ],

  // 健康检查间隔
  healthCheckInterval: 60000,

  // 指标聚合间隔
  metricsAggregationInterval: 300000
}
```

### 恢复策略配置

```typescript
// 恢复策略配置
const recoveryConfig = {
  // 重试配置
  retry: {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true
  },

  // 熔断器配置
  circuitBreaker: {
    threshold: 5,
    timeout: 60000
  },

  // 回滚配置
  rollback: {
    enabled: true,
    maxVersions: 10,
    autoRollback: true,
    rollbackTimeout: 30000
  },

  // 降级配置
  fallback: {
    enabled: true,
    autoSwitch: true,
    healthCheckInterval: 30000
  }
}
```

## 自定义扩展

### 1. 注册自定义错误处理器

```typescript
// 注册自定义错误处理器
errorHandlingSystem.getErrorHandler().registerHandler({
  canHandle: (error) => {
    return error.category === ErrorCategory.BUSINESS &&
           error.code === 'INSUFFICIENT_BALANCE'
  },

  handle: async (error, context) => {
    // 处理余额不足错误
    console.log('处理余额不足错误:', error.message)

    // 提示用户充值
    showNotification('余额不足，请先充值')

    return {
      success: true,
      action: 'balance-check',
      message: '已提示用户充值'
    }
  }
})
```

### 2. 添加自定义恢复策略

```typescript
// 自定义恢复策略
class CustomRecoveryStrategy implements RecoveryStrategy {
  public readonly id = 'custom-strategy'
  public readonly name = '自定义恢复策略'
  public readonly description = '处理特定业务错误的恢复策略'
  public readonly priority = 10
  public readonly maxAttempts = 1
  public readonly cooldownPeriod = 0

  public canHandle(error: UnifiedError): boolean {
    return error.category === ErrorCategory.BUSINESS &&
           error.code === 'PAYMENT_FAILED'
  }

  public async execute(error: UnifiedError, context: ErrorContext): Promise<RecoveryResult> {
    // 实现自定义恢复逻辑
    const result = await this.retryPayment(error, context)

    return {
      success: result.success,
      strategy: this.id,
      duration: result.duration,
      attempts: 1,
      message: result.message,
      nextAction: result.success ? 'continue' : 'fallback'
    }
  }

  private async retryPayment(error: UnifiedError, context: ErrorContext): Promise<any> {
    // 重试支付逻辑
    return { success: true, duration: 1000, message: '支付重试成功' }
  }
}

// 注册自定义策略
errorHandlingSystem.getRecoveryManager().registerStrategy(new CustomRecoveryStrategy())
```

### 3. 添加自愈规则

```typescript
// 添加自愈规则
const healingRule: HealingRule = {
  id: 'payment-healing-rule',
  name: '支付问题自愈',
  description: '自动处理支付相关问题的自愈规则',
  pattern: {
    category: ErrorCategory.BUSINESS,
    severity: ErrorSeverity.MEDIUM,
    errorCode: 'PAYMENT_FAILED'
  },
  conditions: [],
  actions: [
    {
      type: 'retry_operation',
      target: 'payment-service',
      parameters: { maxAttempts: 3 },
      timeout: 30000
    },
    {
      type: 'adjust_config',
      target: 'payment-gateway',
      parameters: { timeout: 60000 },
      timeout: 5000
    }
  ],
  priority: 15,
  confidence: 0.8,
  maxApplications: 100,
  cooldownPeriod: 300000,
  successRate: 0.0,
  applicationCount: 0
}

errorHandlingSystem.getSelfHealingFramework().registerRule(healingRule)
```

## 监控和诊断

### 1. 查看错误指标

```typescript
// 获取错误指标
const metrics = errorHandlingSystem.getMonitoringService().getMetrics()

console.log('错误指标:', {
  totalErrors: metrics.totalErrors,
  errorRate: metrics.errorRate,
  averageRecoveryTime: metrics.averageRecoveryTime,
  successRate: metrics.successRate
})
```

### 2. 查看恢复指标

```typescript
// 获取恢复指标
const recoveryMetrics = errorHandlingSystem.getRecoveryManager().getMetrics()

console.log('恢复指标:', {
  totalRecoveries: recoveryMetrics.totalRecoveries,
  successfulRecoveries: recoveryMetrics.successfulRecoveries,
  successRate: recoveryMetrics.successRate,
  averageRecoveryTime: recoveryMetrics.averageRecoveryTime
})
```

### 3. 查看自愈指标

```typescript
// 获取自愈指标
const healingMetrics = errorHandlingSystem.getSelfHealingFramework().getMetrics()

console.log('自愈指标:', {
  totalSessions: healingMetrics.totalSessions,
  successfulSessions: healingMetrics.successfulSessions,
  successRate: healingMetrics.successRate,
  averageHealingTime: healingMetrics.averageHealingTime
})
```

## 最佳实践

### 1. 错误处理最佳实践

```typescript
// 1. 始终提供上下文信息
const context = {
  component: 'UserService',
  operation: 'createUser',
  environment: process.env.NODE_ENV,
  timestamp: Date.now(),
  userId: '123',
  additionalInfo: { source: 'web-app' }
}

// 2. 使用特定错误类型
class UserCreationError extends Error {
  constructor(message: string, public readonly details: any) {
    super(message)
    this.name = 'UserCreationError'
  }
}

// 3. 适当处理错误
try {
  await createUser(userData)
} catch (error) {
  const result = await errorHandlingSystem.getErrorHandler().handleError(error, context)

  if (!result.success) {
    // 记录未处理的错误
    console.error('未处理的错误:', error)
    // 通知用户
    showUserFriendlyMessage('操作失败，请稍后重试')
  }
}
```

### 2. 恢复策略最佳实践

```typescript
// 1. 创建检查点
const checkpoint = errorHandlingSystem.getRecoveryManager().createCheckpoint(
  'data-migration',
  { sourceData, targetSchema },
  { type: 'migration', version: '2.0' },
  true
)

// 2. 实现幂等操作
class IdempotentOperation {
  async execute(operationId: string, data: any): Promise<any> {
    // 检查是否已执行
    if (await this.isExecuted(operationId)) {
      return await this.getResult(operationId)
    }

    // 执行操作
    const result = await this.performOperation(data)

    // 记录结果
    await this.recordExecution(operationId, result)

    return result
  }
}

// 3. 实现优雅降级
class DegradingService {
  async processData(data: any): Promise<any> {
    try {
      return await this.processWithFullFeatures(data)
    } catch (error) {
      // 降级到基本功能
      return await this.processWithBasicFeatures(data)
    }
  }
}
```

### 3. 自愈框架最佳实践

```typescript
// 1. 定义清晰的自愈规则
const healingRule: HealingRule = {
  id: 'database-connection-heal',
  name: '数据库连接自愈',
  description: '自动恢复数据库连接问题',
  pattern: {
    category: ErrorCategory.SYSTEM,
    severity: ErrorSeverity.HIGH,
    errorCode: 'DB_CONNECTION_FAILED'
  },
  conditions: [
    {
      type: 'error_count',
      operator: 'greater_than',
      value: 3,
      timeWindow: 300000,
      weight: 1.0
    }
  ],
  actions: [
    {
      type: 'restart_service',
      target: 'database-connection-pool',
      parameters: { graceful: true },
      timeout: 30000,
      rollback: false
    }
  ],
  priority: 20,
  confidence: 0.9,
  maxApplications: 10,
  cooldownPeriod: 300000,
  successRate: 0.0,
  applicationCount: 0
}

// 2. 监控自愈效果
const healingMetrics = errorHandlingSystem.getSelfHealingFramework().getMetrics()

// 分析自愈效果
if (healingMetrics.successRate < 0.7) {
  console.warn('自愈成功率较低，需要优化规则')
}

// 3. 学习和优化
// 定期分析自愈结果，优化规则和策略
```

## 性能优化

### 1. 异步处理

```typescript
// 使用异步处理避免阻塞主线程
async function handleAsyncError(error: Error, context: ErrorContext) {
  // 非阻塞错误处理
  setTimeout(async () => {
    await errorHandlingSystem.getErrorHandler().handleError(error, context)
  }, 0)
}
```

### 2. 批量处理

```typescript
// 批量处理错误
class ErrorBatchProcessor {
  private errors: Array<{ error: Error; context: ErrorContext }> = []
  private batchSize = 10
  private flushInterval = 5000

  constructor() {
    setInterval(() => this.flush(), this.flushInterval)
  }

  addError(error: Error, context: ErrorContext) {
    this.errors.push({ error, context })

    if (this.errors.length >= this.batchSize) {
      this.flush()
    }
  }

  private async flush() {
    if (this.errors.length === 0) return

    const batch = this.errors.splice(0, this.batchSize)

    // 批量处理错误
    await Promise.allSettled(
      batch.map(({ error, context }) =>
        errorHandlingSystem.getErrorHandler().handleError(error, context)
      )
    )
  }
}
```

### 3. 内存管理

```typescript
// 定期清理内存
class MemoryManager {
  private cleanupInterval = 60000 // 1分钟

  constructor() {
    setInterval(() => this.cleanup(), this.cleanupInterval)
  }

  private cleanup() {
    // 清理错误日志
    errorHandlingSystem.getMonitoringService().cleanup()

    // 清理会话数据
    errorHandlingSystem.getRecoveryManager().cleanup()

    // 清理自愈会话
    errorHandlingSystem.getSelfHealingFramework().cleanup()
  }
}
```

## 故障排除

### 1. 常见问题

**问题：错误处理器未捕获错误**
```typescript
// 确保正确使用 try-catch
try {
  await riskyOperation()
} catch (error) {
  await errorHandlingSystem.getErrorHandler().handleError(error, context)
}
```

**问题：恢复策略不生效**
```typescript
// 检查策略是否正确注册
console.log('已注册的策略:',
  errorHandlingSystem.getRecoveryManager().getStrategies()
)

// 检查错误类型是否匹配
console.log('错误分类:', error.category)
```

**问题：自愈规则未触发**
```typescript
// 检查规则配置
console.log('自愈规则:',
  errorHandlingSystem.getSelfHealingFramework().getRules()
)

// 检查冷却时间
console.log('最后应用时间:', rule.lastApplied)
```

### 2. 调试模式

```typescript
// 启用调试模式
const debugConfig = {
  enabled: true,
  logLevel: 'debug',
  detailedLogging: true
}

// 在开发环境中启用详细日志
if (process.env.NODE_ENV === 'development') {
  errorHandlingSystem.getMonitoringService().enableDebugMode(debugConfig)
}
```

### 3. 测试错误处理

```typescript
// 测试错误处理
async function testErrorHandling() {
  const testError = new Error('测试错误')

  const context = {
    component: 'TestComponent',
    operation: 'test',
    environment: 'test',
    timestamp: Date.now()
  }

  const result = await errorHandlingSystem.getErrorHandler().handleError(testError, context)

  console.log('测试结果:', result)
}
```

## 总结

CardEverything 项目的统一错误处理架构提供了：

1. **全面的错误处理** - 统一的错误分类、处理和恢复机制
2. **智能恢复** - 多种恢复策略和自愈能力
3. **实时监控** - 完整的监控告警和健康检查
4. **可扩展性** - 易于自定义和扩展的架构
5. **高性能** - 异步处理和内存优化

通过正确使用这个错误处理系统，可以大大提高应用的稳定性和可靠性。