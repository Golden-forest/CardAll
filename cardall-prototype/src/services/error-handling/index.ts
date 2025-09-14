/**
 * CardEverything 错误处理系统
 * 统一错误处理和恢复机制的模块导出
 */

// 类型定义
export * from './types'

// 核心错误处理器
export * from './unified-error-handler'

// 错误监控服务
export * from './error-monitoring-service'

// 恢复策略管理器
export * from './recovery-strategy-manager'

// 自愈框架
export * from './self-healing-framework'

// 错误处理服务
export * from './error-handling-service'

// 同步错误集成
export * from './sync-error-integration'

// 集成指南
export * from './error-handling-integration'

// 便捷导出
import { errorHandlingService } from './error-handling-service'
import { syncErrorHandler } from './sync-error-integration'
import { unifiedErrorHandler } from './unified-error-handler'

// 主要服务实例
export {
  errorHandlingService,
  syncErrorHandler,
  unifiedErrorHandler
}

// 默认导出
export default {
  errorHandlingService,
  syncErrorHandler,
  unifiedErrorHandler
}