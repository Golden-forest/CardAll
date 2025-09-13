/**
 * CardEverything Realtime 系统初始化和使用示例
 * 展示如何集成和使用完整的Realtime同步系统
 * 
 * Week 4 Task 5-8: 实时同步系统集成示例
 * 
 * 功能特性：
 * - 完整的Realtime系统初始化流程
 * - 系统配置和优化
 * - 事件监听和处理
 * - 性能监控和调试
 * - 多设备同步支持
 * 
 * @author Project-Brainstormer + Sync-System-Expert
 * @version Week 4.1
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createRealtimeSystemIntegration, RealtimeSystemConfig, RealtimeSystemStatus } from './realtime-system-integration'
import { createRealtimePerformanceOptimizer, PerformanceMetrics } from './realtime-performance-optimizer'
import { createRealtimeConnectionManager, ConnectionConfig } from './realtime-connection-manager'
import { OptimizedCloudSyncService } from '../sync/optimized-cloud-sync'

/**
 * Realtime系统配置示例
 */
export const realtimeConfig: RealtimeSystemConfig = {
  enabled: true,
  tables: ['cards', 'folders', 'tags', 'images'],
  strategy: {
    enabled: true,
    priority: 'high',
    batchSize: 5,
    batchInterval: 100,
    retryDelay: 1000,
    maxRetries: 3,
    compressionEnabled: true,
    networkAware: true,
    batteryOptimized: false
  },
  performance: {
    enabled: true,
    adaptiveStrategy: true,
    monitoringInterval: 5000,
    optimizationThreshold: 80
  },
  connection: {
    maxRetries: 5,
    retryDelay: 1000,
    heartbeatInterval: 30000,
    connectionTimeout: 10000
  },
  conflict: {
    autoResolve: true,
    strategy: 'smart-merge',
    maxRetries: 3
  },
  monitoring: {
    enabled: true,
    metricsCollection: true,
    healthChecks: true,
    alerting: true
  }
}

/**
 * 连接配置示例
 */
export const connectionConfig: ConnectionConfig = {
  maxRetries: 5,
  retryDelay: 1000,
  heartbeatInterval: 30000,
  connectionTimeout: 10000,
  healthCheckInterval: 5000,
  maxConnectionAge: 3600000,
  connectionPoolSize: 3,
  adaptiveRetry: true,
  exponentialBackoff: true,
  connectionCompression: true
}

/**
 * Realtime系统集成类
 */
export class RealtimeSystemExample {
  private realtimeSystem: any = null
  private performanceOptimizer: any = null
  private connectionManager: any = null
  private cloudSync: OptimizedCloudSyncService | null = null
  private isInitialized = false

  constructor(private supabase: SupabaseClient) {}

  /**
   * 初始化Realtime系统
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 开始初始化CardEverything Realtime系统...')

      // 1. 初始化云同步服务
      this.cloudSync = new OptimizedCloudSyncService()
      console.log('✅ 云同步服务初始化完成')

      // 2. 初始化连接管理器
      this.connectionManager = createRealtimeConnectionManager(
        this.supabase,
        connectionConfig
      )
      console.log('✅ 连接管理器初始化完成')

      // 3. 初始化Realtime系统集成
      this.realtimeSystem = createRealtimeSystemIntegration(
        this.supabase,
        realtimeConfig
      )
      
      // 设置系统事件监听
      this.setupSystemEventListeners()
      
      // 初始化系统
      await this.realtimeSystem.initialize()
      console.log('✅ Realtime系统集成初始化完成')

      // 4. 初始化性能优化器
      if (this.realtimeSystem.smartManager) {
        this.performanceOptimizer = createRealtimePerformanceOptimizer(
          this.realtimeSystem.smartManager,
          (strategy) => this.handleOptimizationNeeded(strategy)
        )
        console.log('✅ 性能优化器初始化完成')
      }

      this.isInitialized = true
      console.log('🎉 CardEverything Realtime系统初始化成功！')

      // 显示系统状态
      this.displaySystemStatus()

    } catch (error) {
      console.error('❌ Realtime系统初始化失败:', error)
      throw error
    }
  }

  /**
   * 设置系统事件监听
   */
  private setupSystemEventListeners(): void {
    if (!this.realtimeSystem) return

    // 监听系统启动事件
    this.realtimeSystem.onSystemEvent('system-started', (event: any) => {
      console.log('🎯 系统启动:', event.data)
    })

    // 监听连接变化事件
    this.realtimeSystem.onSystemEvent('connection-changed', (event: any) => {
      console.log('🔗 连接状态变化:', event.data)
    })

    // 监听性能优化事件
    this.realtimeSystem.onSystemEvent('performance-optimized', (event: any) => {
      console.log('⚡ 性能优化:', event.data)
    })

    // 监听冲突解决事件
    this.realtimeSystem.onSystemEvent('conflict-resolved', (event: any) => {
      console.log('🔧 冲突解决:', event.data)
    })

    // 监听同步完成事件
    this.realtimeSystem.onSystemEvent('sync-completed', (event: any) => {
      console.log('✅ 同步完成:', event.data)
    })

    // 监听错误事件
    this.realtimeSystem.onSystemEvent('error', (event: any) => {
      console.error('❌ 系统错误:', event.data)
    })

    // 监听警告事件
    this.realtimeSystem.onSystemEvent('warning', (event: any) => {
      console.warn('⚠️ 系统警告:', event.data)
    })

    // 监听连接管理器事件
    if (this.connectionManager) {
      this.connectionManager.on('connected', (data: any) => {
        console.log('🟢 Realtime连接建立:', data)
      })

      this.connectionManager.on('disconnected', (data: any) => {
        console.log('🔴 Realtime连接断开:', data)
      })

      this.connectionManager.on('reconnecting', (data: any) => {
        console.log('🔄 Realtime重连中:', data)
      })

      this.connectionManager.on('error', (data: any) => {
        console.error('❌ Realtime连接错误:', data)
      })
    }

    // 监听性能优化器事件
    if (this.performanceOptimizer) {
      this.performanceOptimizer.onOptimizationEvent('performance-issues', (issues: string[]) => {
        console.warn('⚠️ 性能问题检测:', issues)
      })

      this.performanceOptimizer.onOptimizationEvent('strategy-changed', (data: any) => {
        console.log('📊 策略切换:', data)
      })
    }
  }

  /**
   * 处理性能优化需求
   */
  private handleOptimizationNeeded(strategy: any): void {
    console.log('🎯 性能优化需求触发，切换到策略:', strategy.name)
    
    // 这里可以添加额外的优化逻辑
    // 例如：更新UI、通知用户等
  }

  /**
   * 显示系统状态
   */
  private displaySystemStatus(): void {
    if (!this.realtimeSystem) return

    const status = this.realtimeSystem.getSystemStatus()
    console.log('\n📊 Realtime系统状态:')
    console.log('=' .repeat(50))
    console.log(`初始化状态: ${status.initialized ? '✅ 已初始化' : '❌ 未初始化'}`)
    console.log(`连接状态: ${status.connected ? '🟢 已连接' : '🔴 未连接'}`)
    console.log(`健康状态: ${status.healthy ? '✅ 健康' : '❌ 异常'}`)
    console.log(`活跃连接: ${status.activeConnections}`)
    console.log(`处理事件数: ${status.totalEventsProcessed}`)
    console.log(`运行时间: ${Math.floor(status.uptime / 1000)}秒`)
    
    if (status.lastSyncTime) {
      console.log(`最后同步: ${status.lastSyncTime.toLocaleString()}`)
    }
    
    console.log(`冲突统计: 总计${status.conflicts.total}, 已解决${status.conflicts.resolved}, 待解决${status.conflicts.pending}`)
    console.log('=' .repeat(50))
  }

  /**
   * 手动触发同步
   */
  async triggerSync(): Promise<any> {
    if (!this.realtimeSystem) {
      throw new Error('Realtime系统未初始化')
    }

    console.log('🔄 手动触发同步...')
    const result = await this.realtimeSystem.triggerSync()
    console.log('✅ 同步完成:', result)
    return result
  }

  /**
   * 获取系统状态
   */
  getSystemStatus(): RealtimeSystemStatus | null {
    return this.realtimeSystem ? this.realtimeSystem.getSystemStatus() : null
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): string {
    if (!this.realtimeSystem) {
      return 'Realtime系统未初始化'
    }

    return this.realtimeSystem.getPerformanceReport()
  }

  /**
   * 获取连接状态报告
   */
  getConnectionReport(): string {
    if (!this.connectionManager) {
      return '连接管理器未初始化'
    }

    return this.connectionManager.exportConnectionReport()
  }

  /**
   * 获取性能优化建议
   */
  getOptimizationSuggestions(): string[] {
    if (!this.performanceOptimizer) {
      return []
    }

    return this.performanceOptimizer.getOptimizationSuggestions()
  }

  /**
   * 更新系统配置
   */
  updateSystemConfig(newConfig: Partial<RealtimeSystemConfig>): void {
    if (!this.realtimeSystem) {
      throw new Error('Realtime系统未初始化')
    }

    console.log('⚙️ 更新Realtime系统配置...')
    this.realtimeSystem.updateSystemConfig(newConfig)
    console.log('✅ 配置更新完成')
  }

  /**
   * 切换性能策略
   */
  setPerformanceStrategy(strategyName: string): boolean {
    if (!this.performanceOptimizer) {
      return false
    }

    const success = this.performanceOptimizer.setStrategy(strategyName)
    if (success) {
      console.log(`📊 性能策略切换到: ${strategyName}`)
    } else {
      console.warn(`⚠️ 未知的性能策略: ${strategyName}`)
    }
    return success
  }

  /**
   * 手动重连所有连接
   */
  async reconnectAll(): Promise<void> {
    if (!this.connectionManager) {
      throw new Error('连接管理器未初始化')
    }

    console.log('🔄 手动重连所有Realtime连接...')
    await this.connectionManager.reconnectAll()
    console.log('✅ 重连完成')
  }

  /**
   * 获取事件历史
   */
  getEventHistory(limit: number = 50): any[] {
    if (!this.realtimeSystem) {
      return []
    }

    return this.realtimeSystem.getEventHistory(limit)
  }

  /**
   * 监控系统健康状态
   */
  startHealthMonitoring(intervalMs: number = 10000): void {
    console.log(`🔍 开始健康监控，间隔: ${intervalMs}ms`)

    const monitor = setInterval(() => {
      if (this.realtimeSystem) {
        const status = this.realtimeSystem.getSystemStatus()
        
        if (!status.healthy) {
          console.warn('⚠️ 系统健康状态异常')
          
          // 获取详细的性能指标
          if (this.performanceOptimizer) {
            const metrics = this.performanceOptimizer.getCurrentMetrics()
            console.warn('性能指标:', metrics)
          }
          
          // 获取连接状态
          if (this.connectionManager) {
            const health = this.connectionManager.getHealth()
            console.warn('连接健康:', health)
          }
        }
      }
    }, intervalMs)

    // 返回清理函数
    return () => clearInterval(monitor)
  }

  /**
   * 演示功能
   */
  async demonstrateFeatures(): Promise<void> {
    if (!this.isInitialized) {
      console.log('❌ 系统未初始化，请先调用initialize()')
      return
    }

    console.log('\n🎪 开始Realtime系统功能演示...')
    console.log('=' .repeat(50))

    // 1. 显示当前状态
    console.log('\n1️⃣ 当前系统状态:')
    this.displaySystemStatus()

    // 2. 性能监控演示
    console.log('\n2️⃣ 性能监控演示:')
    if (this.performanceOptimizer) {
      const metrics = this.performanceOptimizer.getCurrentMetrics()
      console.log('当前性能指标:', metrics)
      
      const suggestions = this.getOptimizationSuggestions()
      if (suggestions.length > 0) {
        console.log('优化建议:', suggestions)
      }
    }

    // 3. 连接管理演示
    console.log('\n3️⃣ 连接管理演示:')
    if (this.connectionManager) {
      const stats = this.connectionManager.getStats()
      console.log('连接统计:', stats)
      
      const health = this.connectionManager.getHealth()
      console.log('连接健康:', health)
    }

    // 4. 策略切换演示
    console.log('\n4️⃣ 策略切换演示:')
    const strategies = ['high-performance', 'balanced', 'conservative', 'battery-saver']
    for (const strategy of strategies) {
      const success = this.setPerformanceStrategy(strategy)
      if (success) {
        // 等待一下让策略生效
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const currentMetrics = this.performanceOptimizer?.getCurrentMetrics()
        console.log(`策略 ${strategy}: 延迟=${currentMetrics?.latency?.toFixed(2)}ms, 吞吐量=${currentMetrics?.throughput?.toFixed(2)} events/s`)
      }
    }

    // 5. 同步演示
    console.log('\n5️⃣ 同步演示:')
    try {
      const syncResult = await this.triggerSync()
      console.log('同步结果:', syncResult)
    } catch (error) {
      console.error('同步演示失败:', error)
    }

    // 6. 事件历史演示
    console.log('\n6️⃣ 事件历史演示:')
    const recentEvents = this.getEventHistory(10)
    console.log('最近事件:', recentEvents.map(e => `${e.type} - ${e.timestamp.toLocaleTimeString()}`))

    console.log('\n🎉 Realtime系统功能演示完成!')
    console.log('=' .repeat(50))
  }

  /**
   * 清理资源
   */
  async destroy(): Promise<void> {
    console.log('🧹 清理Realtime系统资源...')

    if (this.realtimeSystem) {
      await this.realtimeSystem.destroy()
    }

    if (this.performanceOptimizer) {
      this.performanceOptimizer.destroy()
    }

    if (this.connectionManager) {
      this.connectionManager.destroy()
    }

    this.isInitialized = false
    console.log('✅ Realtime系统资源清理完成')
  }
}

/**
 * 使用示例函数
 */
export async function initRealtimeSystemExample(supabase: SupabaseClient): Promise<RealtimeSystemExample> {
  const realtimeSystem = new RealtimeSystemExample(supabase)
  
  try {
    // 初始化系统
    await realtimeSystem.initialize()
    
    // 启动健康监控
    const stopMonitoring = realtimeSystem.startHealthMonitoring()
    
    // 可选：运行功能演示
    // await realtimeSystem.demonstrateFeatures()
    
    console.log('🎯 Realtime系统示例已就绪!')
    
    return realtimeSystem
    
  } catch (error) {
    console.error('❌ Realtime系统示例初始化失败:', error)
    throw error
  }
}

/**
 * 快速开始示例
 */
export async function quickStartExample(): Promise<void> {
  try {
    // 这里需要传入实际的Supabase客户端
    // const supabase = createSupabaseClient()
    // const realtimeSystem = await initRealtimeSystemExample(supabase)
    
    console.log('🚀 快速开始示例 - 需要Supabase客户端')
    console.log('请参考上面的完整示例代码')
    
  } catch (error) {
    console.error('❌ 快速开始示例失败:', error)
  }
}

// 默认导出
export default RealtimeSystemExample