import { initializeDatabase } from './database'
import { migrationService } from './migration'
import { fileSystemService } from './file-system'
import { authService } from './auth'
import { initializeAllServices } from './service-factory-enhanced'
import { initializeSyncService, safeInitializeSyncService } from './sync-initialization-utils'

/**
 * 优化的重试配置 - 修复BUG-004初始化超时问题
 */
const RETRY_CONFIG = {
  MAX_RETRIES: 2, // 减少重试次数
  INITIAL_DELAY: 300, // 减少到300ms
  MAX_DELAY: 5000, // 减少到5秒
  BACKOFF_FACTOR: 1.5, // 减少退避因子
  FAST_INIT_TIMEOUT: 3000 // 快速初始化超时
}

/**
 * 增强版轻量级应用初始化服务
 * 在后台执行必要的服务初始化,不阻塞用户界面
 */
class AppInitializationServiceEnhanced {
  private initializationPromises: Map<string, Promise<any>> = new Map()
  private retryCounts: Map<string, number> = new Map()
  private isInitialized = false
  private initializationError: Error | null = null

  /**
   * 带重试的服务初始化方法
   */
  private async initializeWithRetry<T>(
    serviceName: string,
    initializationFn: () => Promise<T>,
    isCritical = false
  ): Promise<T> {
    const retryKey = `${serviceName}_init`
    let currentRetry = this.retryCounts.get(retryKey) || 0

    while (currentRetry <= RETRY_CONFIG.MAX_RETRIES) {
      try {
        console.log(`🔄 初始化 ${serviceName} (尝试 ${currentRetry + 1}/${RETRY_CONFIG.MAX_RETRIES + 1})...`)
        const result = await initializationFn()
        console.log(`✅ ${serviceName} 初始化成功`)
        this.retryCounts.delete(retryKey)
        return result
      } catch (error) {
          console.warn("操作失败:", error)
        } 初始化失败,已达到最大重试次数`)
          if (isCritical) {
            throw error
          }
          console.warn(`⚠️ 非关键服务 ${serviceName} 初始化失败,继续执行`)
          return null as T
        }

        const delay = Math.min(
          RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_FACTOR, currentRetry - 1),
          RETRY_CONFIG.MAX_DELAY
        )

        console.log(`⏳ ${serviceName} 初始化失败,${delay}ms 后重试...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw new Error(`${serviceName} initialization failed after retries`)
  }

  /**
   * 初始化核心服务
   */
  private async initializeCoreServices(): Promise<void> {
    console.log('🎯 开始初始化核心服务...')

    // 1. 数据库初始化（最关键）
    await this.initializeWithRetry(
      'database',
      () => initializeDatabase(),
      true
    )

    // 2. 认证服务初始化
    await this.initializeWithRetry(
      'auth',
      () => authService.initialize(),
      true
    )

    // 3. 增强版统一同步服务初始化
    await this.initializeWithRetry(
      'unifiedSync',
      () => unifiedSyncServiceEnhanced.initialize(),
      true
    )

    // 4. 文件系统初始化
    await this.initializeWithRetry(
      'filesystem',
      () => fileSystemService.initialize(),
      false
    )

    console.log('🎉 核心服务初始化完成')
  }

  /**
   * 初始化扩展服务
   */
  private async initializeExtendedServices(): Promise<void> {
    console.log('🔧 开始初始化扩展服务...')

    // 使用增强版服务工厂初始化其他服务
    await this.initializeWithRetry(
      'serviceFactory',
      () => initializeAllServices(),
      false
    )

    console.log('🎉 扩展服务初始化完成')
  }

  /**
   * 执行数据迁移
   */
  private async performMigration(): Promise<void> {
    console.log('📦 开始数据迁移...')

    await this.initializeWithRetry(
      'migration',
      () => migrationService.runMigrations(),
      false
    )

    console.log('✅ 数据迁移完成')
  }

  /**
   * 快速初始化（仅核心服务）
   */
  private async performFastInitialization(): Promise<void> {
    console.log('⚡ 执行快速初始化...')

    const startTime = performance.now()

    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Fast initialization timeout')), RETRY_CONFIG.FAST_INIT_TIMEOUT)
      })

      // 执行快速初始化
      const initPromise = this.initializeCoreServices()

      await Promise.race([initPromise, timeoutPromise])

      const duration = performance.now() - startTime
      console.log(`⚡ 快速初始化完成,耗时: ${duration.toFixed(0)}ms`)

    } catch (error) {
          console.warn("操作失败:", error)
        }ms`, error)
      throw error
    }
  }

  /**
   * 主初始化方法
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📱 应用已经初始化')
      return
    }

    if (this.initializationError) {
      console.warn('⚠️ 之前初始化失败,重新尝试...')
      this.initializationError = null
    }

    const startTime = performance.now()

    try {
      console.log('🚀 开始增强版应用初始化...')

      // 1. 快速初始化核心服务
      await this.performFastInitialization()

      // 2. 标记为已初始化（允许用户交互）
      this.isInitialized = true
      console.log('✅ 核心初始化完成,应用已可用')

      // 3. 在后台初始化扩展服务
      this.initializeExtendedServices().catch(error => {
        console.error('❌ 扩展服务初始化失败:', error)
      })

      // 4. 在后台执行数据迁移
      this.performMigration().catch(error => {
        console.error('❌ 数据迁移失败:', error)
      })

      const totalTime = performance.now() - startTime
      console.log(`🎉 增强版应用初始化完成,总耗时: ${totalTime.toFixed(0)}ms`)

    } catch (error) {
          console.warn("操作失败:", error)
        }ms`, error)
      this.initializationError = error as Error
      throw error
    }
  }

  /**
   * 安全初始化（带错误恢复）
   */
  async safeInitialize(): Promise<void> {
    try {
      await this.initialize()
    } catch (error) {
          console.warn("操作失败:", error)
        } catch (error) { console.warn("操作失败:", error) }
    }
  }

  /**
   * 获取初始化状态
   */
  getStatus(): {
    isInitialized: boolean
    hasError: boolean
    error: Error | null
    pendingServices: string[]
  } {
    return {
      isInitialized: this.isInitialized,
      hasError: !!this.initializationError,
      error: this.initializationError,
      pendingServices: Array.from(this.initializationPromises.keys())
    }
  }

  /**
   * 重置初始化状态
   */
  reset(): void {
    this.isInitialized = false
    this.initializationError = null
    this.initializationPromises.clear()
    this.retryCounts.clear()
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

const appInitializationServiceEnhanced = new AppInitializationServiceEnhanced()

// ============================================================================
// 公共API
// ============================================================================

/**
 * 初始化应用
 */
export async function initializeApp(): Promise<void> {
  await appInitializationServiceEnhanced.initialize()
}

/**
 * 安全初始化应用
 */
export async function safeInitializeApp(): Promise<void> {
  await appInitializationServiceEnhanced.safeInitialize()
}

/**
 * 获取初始化状态
 */
export function getAppInitializationStatus() {
  return appInitializationServiceEnhanced.getStatus()
}

/**
 * 重置初始化状态
 */
export function resetAppInitialization(): void {
  appInitializationServiceEnhanced.reset()
}

// ============================================================================
// 默认导出
// ============================================================================

export default appInitializationServiceEnhanced