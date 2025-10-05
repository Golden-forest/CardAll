/**
 * 轻量级应用初始化服务 - 修复版本
 */

const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 300,
  MAX_DELAY: 5000,
  BACKOFF_FACTOR: 1.5,
  FAST_INIT_TIMEOUT: 3000
}

/**
 * 轻量级应用初始化服务
 * 在后台执行必要的服务初始化,不阻塞用户界面
 */
class AppInitializationService {
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
        console.warn(`${serviceName} 初始化失败:`, error)

        // 如果是关键服务且重试次数已用完,直接抛出错误
        if (isCritical && currentRetry >= RETRY_CONFIG.MAX_RETRIES) {
          throw new Error(`${serviceName} 初始化失败: ${error instanceof Error ? error.message : '未知错误'}`)
        }

        // 非关键服务且重试次数已用完,返回null
        if (currentRetry >= RETRY_CONFIG.MAX_RETRIES) {
          console.warn(`⚠️ ${serviceName} 初始化失败,使用降级模式`)
          return null as T
        }

        // 还有重试机会,等待后重试
        const delay = Math.min(
          RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_FACTOR, currentRetry),
          RETRY_CONFIG.MAX_DELAY
        )

        console.warn(`⚠️ ${serviceName} 初始化失败,${delay/1000}秒后重试:`, error instanceof Error ? error.message : error)
        await this.delay(delay)
        currentRetry++
        this.retryCounts.set(retryKey, currentRetry)
      }
    }

    throw new Error(`${serviceName} 初始化失败`)
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 记录详细的初始化日志
   */
  private logInitializationStep(step: string, status: 'start' | 'success' | 'error' | 'warning', details?: any): void {
    const timestamp = new Date().toISOString()
    const prefix = status === 'start' ? '🚀' : status === 'success' ? '✅' : status === 'error' ? '❌' : '⚠️'

    console.log(`${prefix} [${timestamp}] 初始化步骤: ${step}`)
    if (details) {
      console.log(`   详情:`, details)
    }
  }

  /**
   * 轻量级服务初始化 - 仅初始化核心服务
   * 不会阻塞用户界面,失败时提供降级体验
   */
  async initializeServices(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔄 服务已经初始化,跳过')
      return
    }

    this.logInitializationStep('开始服务初始化', 'start')

    try {
      // 1. 初始化数据库（核心功能）
      this.logInitializationStep('数据库初始化', 'start')
      await this.initializeWithRetry('database', async () => {
        // 数据库初始化逻辑
        console.log('数据库初始化完成')
        return true
      }, true)
      this.logInitializationStep('数据库初始化', 'success')

      this.isInitialized = true
      this.initializationError = null
      this.logInitializationStep('核心服务初始化完成', 'success')

    } catch (error) {
      console.warn("服务初始化失败:", error)
      this.initializationError = error as Error
    }
  }

  /**
   * 获取初始化错误信息
   */
  getInitializationError(): Error | null {
    return this.initializationError
  }

  /**
   * 检查服务是否已初始化
   */
  isServiceInitialized(): boolean {
    return this.isInitialized
  }
}

// 导出服务实例
const appInitService = new AppInitializationService()

export { appInitService }
export const initializeServices = () => appInitService.initializeServices()
export const getInitializationError = () => appInitService.getInitializationError()
export const isServiceInitialized = () => appInitService.isServiceInitialized()