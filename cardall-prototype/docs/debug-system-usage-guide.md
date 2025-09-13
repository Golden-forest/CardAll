# CardAll 调试诊断系统使用指南

## 快速开始

### 1. 初始化调试系统

```typescript
// 在应用启动时初始化
import { 
  initializeDebugSystem, 
  type DebugSystemConfig 
} from '@/services/debug-system-manager'

// 调试系统配置
const debugConfig: DebugSystemConfig = {
  enabled: true,
  level: DebugLevel.INFO,
  autoUpload: false, // 开发环境关闭自动上传
  enableConsoleLog: true,
  enableRemoteLogging: false,
  maxLogSize: 1000,
  logRetentionDays: 7,
  enableErrorRecovery: true,
  enableHealthMonitoring: true,
  enablePerformanceTracking: true,
  customTags: ['cardall', 'sync']
}

// 初始化调试系统
await initializeDebugSystem(debugConfig)
```

### 2. 在主应用中集成

```typescript
// src/App.tsx
import React, { useEffect } from 'react'
import { DebugPanelTrigger } from '@/components/debug/debug-panel'
import { smartErrorHandler, type ErrorNotificationSystem } from '@/services/smart-error-handler'

// 设置错误通知系统
const notificationSystem: ErrorNotificationSystem = {
  showNotification: (message) => {
    // 实现你的通知逻辑
    console.log('Notification:', message)
  },
  
  dismissNotification: (id) => {
    // 实现关闭通知逻辑
  },
  
  showProgressDialog: (title, message) => {
    // 返回进度控制器
    return {
      updateProgress: (progress, msg) => {},
      complete: (msg) => {},
      error: (msg) => {},
      cancel: () => {}
    }
  },
  
  showDialog: async (title, message, actions) => {
    // 实现对话框逻辑
    return 'cancel'
  }
}

function App() {
  useEffect(() => {
    // 初始化错误处理器
    smartErrorHandler.initialize(notificationSystem)
  }, [])

  return (
    <div className=\"App\">
      {/* 你的应用内容 */}
      
      {/* 调试面板触发器（仅在开发环境显示） */}
      {process.env.NODE_ENV === 'development' && <DebugPanelTrigger />}
    </div>
  )
}
```

## 基本使用

### 1. 记录调试事件

```typescript
import { debugManager, DebugLevel, DebugEventType } from '@/services/debug-system'

// 记录信息事件
debugManager.logEvent(
  DebugLevel.INFO,
  DebugEventType.APP_ERROR,
  'user_action',
  'User clicked sync button',
  { buttonId: 'sync-button', timestamp: Date.now() }
)

// 记录错误事件
try {
  await someOperation()
} catch (error) {
  debugManager.logError(error, 'data_operation', {
    operation: 'save_card',
    cardId: '123'
  })
}

// 记录性能问题
debugManager.logPerformanceIssue(
  'card_render',
  1200, // 实际耗时
  500,   // 阈值
  { cardCount: 100, component: 'CardGrid' }
)
```

### 2. 处理同步错误

```typescript
import { 
  handleSyncSmartError, 
  cloudSyncService,
  type SyncOperation 
} from '@/services/smart-error-handler'

// 在同步操作中包装错误处理
const safeSyncOperation = async (operation: SyncOperation) => {
  try {
    await cloudSyncService.executeOperation(operation)
  } catch (error) {
    const result = await handleSyncSmartError(error, operation)
    
    if (!result.success) {
      // 处理恢复失败的情况
      console.error('Sync recovery failed:', result)
    }
    
    return result.success
  }
}
```

### 3. 健康检查和诊断

```typescript
import { 
  performSystemHealthCheck, 
  collectSystemMetrics,
  syncDiagnostics 
} from '@/services/debug-system-manager'

// 执行健康检查
const health = await performSystemHealthCheck()
console.log('System health:', health.overall)

// 收集系统指标
const metrics = await collectSystemMetrics()
console.log('System metrics:', metrics)

// 生成诊断报告
const report = await syncDiagnostics.generateDiagnosticReport()
console.log('Diagnostic report:', report.summary)
```

## 高级使用

### 1. 自定义错误处理策略

```typescript
import { smartErrorHandler, ErrorHandlingStrategy } from '@/services/smart-error-handler'

// 处理特定类型的错误
smartErrorHandler.handleError(error, {
  category: 'payment',
  component: 'checkout',
  severity: 'high',
  userId: 'user123'
}, {
  maxRetries: 3,
  timeout: 30000,
  fallbackStrategy: ErrorHandlingStrategy.FALLBACK_TO_OFFLINE
})
```

### 2. 批量错误处理

```typescript
// 处理多个相关错误
const errors = [
  { error: new Error('Network timeout'), context: { category: 'sync' } },
  { error: new Error('Auth failed'), context: { category: 'auth' } }
]

const batchResult = await smartErrorHandler.handleBatchErrors(errors)
console.log('Batch result:', batchResult.summary)
```

### 3. 预测性维护

```typescript
// 获取错误预测
const prediction = await syncDiagnostics.predictPotentialIssues()
prediction.predictions.forEach(pred => {
  if (pred.likelihood > 0.8) {
    console.warn('High likelihood issue predicted:', pred.description)
    // 采取预防措施
  }
})
```

### 4. 自定义诊断计划

```typescript
import { syncDiagnostics, type ErrorRecoveryPlan } from '@/services/sync-diagnostics'

// 创建自定义恢复计划
const customRecoveryPlan: ErrorRecoveryPlan = {
  id: 'custom_recovery',
  errorType: 'custom_error',
  description: 'Custom error recovery',
  steps: [
    {
      id: 'step1',
      name: 'Initial recovery',
      description: 'First recovery step',
      type: 'automatic',
      execute: async () => {
        // 实现恢复逻辑
        return true
      }
    }
  ],
  estimatedTime: 5000,
  successRate: 0.9,
  userIntervention: false,
  rollbackAvailable: true
}

// 添加到诊断系统
// syncDiagnostics.addRecoveryPlan(customRecoveryPlan)
```

## 开发者工具

### 1. 控制台调试命令

初始化后，调试工具会暴露到 `window.debug` 对象：

```javascript
// 在浏览器控制台中可用

// 查看系统状态
debug.system.healthCheck()
debug.system.getMetrics()
debug.system.getConfig()

// 日志操作
debug.log('info', 'Test message', { data: 'test' })
debug.error(new Error('Test error'))

// 同步操作
debug.syncStatus()
debug.forceSync()

// 诊断操作
debug.diagnose()
debug.predict()
```

### 2. 调试面板

调试面板提供了可视化的调试界面：

- **概览标签**: 显示系统健康状态、错误统计、性能指标
- **事件标签**: 查看和过滤调试事件，支持导出日志
- **诊断标签**: 查看详细的诊断报告和建议
- **操作标签**: 执行诊断操作和系统维护

### 3. 性能监控

```typescript
// 监控特定操作的性能
const performanceMonitor = debugManager.getPerformanceMonitor()

const monitoredOperation = performanceMonitor.monitorSyncPerformance(async () => {
  // 你的操作代码
  await someLongRunningOperation()
})

await monitoredOperation()
```

## 生产环境配置

### 1. 生产环境调试配置

```typescript
const productionDebugConfig: DebugSystemConfig = {
  enabled: true,
  level: DebugLevel.ERROR, // 只记录错误级别
  autoUpload: true,        // 启用自动上传
  enableConsoleLog: false,  // 生产环境关闭控制台日志
  enableRemoteLogging: true,
  maxLogSize: 500,         // 限制日志大小
  logRetentionDays: 3,     // 保留3天日志
  enableErrorRecovery: true,
  enableHealthMonitoring: true,
  enablePerformanceTracking: false, // 生产环境关闭性能跟踪
  customTags: ['cardall', 'production']
}
```

### 2. 错误上报配置

```typescript
// 配置远程错误上报
updateDebugConfig({
  autoUpload: true,
  enableRemoteLogging: true,
  uploadInterval: 2 * 60 * 1000, // 2分钟上传一次
  filters: {
    types: [
      DebugEventType.APP_ERROR,
      DebugEventType.SYNC_FAILED,
      DebugEventType.AUTH_ERROR
    ]
  }
})
```

## 最佳实践

### 1. 错误分类和处理

```typescript
// 网络错误处理
const handleNetworkError = async (error: Error, context: any) => {
  await smartErrorHandler.handleError(error, {
    category: 'network',
    component: 'api_client',
    severity: 'medium',
    ...context
  }, {
    maxRetries: 3,
    fallbackStrategy: ErrorHandlingStrategy.AUTO_RETRY
  })
}

// 数据错误处理
const handleDataError = async (error: Error, context: any) => {
  await smartErrorHandler.handleError(error, {
    category: 'data',
    component: 'database',
    severity: 'high',
    ...context
  }, {
    maxRetries: 1,
    fallbackStrategy: ErrorHandlingStrategy.USE_CACHE
  })
}
```

### 2. 性能监控

```typescript
// 关键操作性能监控
const monitorCriticalOperation = async (operation: () => Promise<any>, name: string) => {
  const startTime = performance.now()
  
  try {
    const result = await operation()
    const duration = performance.now() - startTime
    
    // 记录性能指标
    debugManager.logEvent(
      DebugLevel.INFO,
      DebugEventType.PERF_SLOW,
      'performance',
      `Operation ${name} completed`,
      { duration, operation: name }
    )
    
    return result
  } catch (error) {
    const duration = performance.now() - startTime
    debugManager.logError(error, 'performance', { duration, operation: name })
    throw error
  }
}
```

### 3. 用户操作追踪

```typescript
// 追踪用户操作
const trackUserAction = (action: string, details?: any) => {
  debugManager.logEvent(
    DebugLevel.INFO,
    DebugEventType.APP_ERROR,
    'user_action',
    `User performed: ${action}`,
    {
      action,
      timestamp: Date.now(),
      userId: getCurrentUserId(),
      ...details
    }
  )
}

// 使用示例
trackUserAction('create_card', { 
  cardType: 'text', 
  folderId: 'folder123' 
})
trackUserAction('sync_data', { 
  syncType: 'full', 
  recordCount: 150 
})
```

## 故障排除

### 1. 常见问题

**问题**: 调试系统未初始化
```typescript
// 确保在应用启动时调用初始化
// 检查初始化顺序
await initializeDebugSystem(config)
```

**问题**: 日志过多影响性能
```typescript
// 调整日志级别和大小限制
updateDebugConfig({
  level: DebugLevel.WARN,
  maxLogSize: 500
})
```

**问题**: 错误恢复不工作
```typescript
// 检查错误通知系统是否正确配置
smartErrorHandler.initialize(notificationSystem)
```

### 2. 调试技巧

**启用详细日志**
```typescript
// 临时启用详细调试
updateDebugConfig({
  level: DebugLevel.DEBUG,
  enableConsoleLog: true
})
```

**导出调试信息**
```typescript
// 导出完整的调试报告
const metrics = await collectSystemMetrics()
const health = await performSystemHealthCheck()
const report = await syncDiagnostics.generateDiagnosticReport()

const debugInfo = {
  timestamp: new Date().toISOString(),
  metrics,
  health,
  report,
  userAgent: navigator.userAgent
}

console.log('Debug info:', JSON.stringify(debugInfo, null, 2))
```

## 集成示例

### 完整的集成示例

```typescript
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { 
  initializeDebugSystem, 
  updateDebugConfig 
} from '@/services/debug-system-manager'

// 环境特定的调试配置
const getDebugConfig = () => {
  if (process.env.NODE_ENV === 'development') {
    return {
      enabled: true,
      level: DebugLevel.DEBUG,
      autoUpload: false,
      enableConsoleLog: true,
      enableRemoteLogging: false
    }
  } else {
    return {
      enabled: true,
      level: DebugLevel.ERROR,
      autoUpload: true,
      enableConsoleLog: false,
      enableRemoteLogging: true
    }
  }
}

// 初始化应用
const initializeApp = async () => {
  try {
    // 初始化调试系统
    await initializeDebugSystem(getDebugConfig())
    
    // 渲染应用
    const root = ReactDOM.createRoot(
      document.getElementById('root') as HTMLElement
    )
    
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
    
  } catch (error) {
    console.error('Failed to initialize app:', error)
  }
}

// 启动应用
initializeApp()
```

这个调试诊断系统为CardAll项目提供了完整的错误处理、诊断分析和故障排除能力。通过合理配置和使用，可以大大提高应用的稳定性和可维护性。