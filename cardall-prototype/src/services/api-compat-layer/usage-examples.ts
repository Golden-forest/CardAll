// ============================================================================
// API兼容层使用示例
// ============================================================================
// 创建时间：2025-09-13
// 功能：演示如何使用API兼容层进行无缝迁移
// ============================================================================

import { 
  apiCompatLayer, 
  syncServiceAdapter, 
  authServiceAdapter, 
  databaseAdapter,
  waitForApiCompatLayer,
  getApiCompatLayerStatus
} from './index'

// ============================================================================
// 基本使用示例
// ============================================================================

/**
 * 基本使用示例
 */
export class BasicUsageExample {
  async run(): Promise<void> {
    console.log('=== API兼容层基本使用示例 ===')
    
    // 1. 等待API兼容层就绪
    console.log('等待API兼容层就绪...')
    await waitForApiCompatLayer()
    console.log('API兼容层已就绪')
    
    // 2. 获取状态
    const status = getApiCompatLayerStatus()
    console.log('兼容层状态:', status)
    
    // 3. 使用同步服务（向后兼容）
    await this.useSyncService()
    
    // 4. 使用认证服务（向后兼容）
    await this.useAuthService()
    
    // 5. 使用数据库服务（向后兼容）
    await this.useDatabaseService()
  }
  
  private async useSyncService(): Promise<void> {
    console.log('\n--- 同步服务示例 ---')
    
    // 方法1：直接使用适配器（推荐）
    const syncStatus = await syncServiceAdapter.getCurrentStatus()
    console.log('同步状态:', syncStatus)
    
    // 方法2：通过兼容层访问（向后兼容）
    const cloudSyncService = apiCompatLayer.syncService
    const legacyStatus = await cloudSyncService.getCurrentStatus()
    console.log('兼容模式状态:', legacyStatus)
    
    // 添加状态监听器
    const unsubscribe = syncServiceAdapter.onStatusChange((status) => {
      console.log('同步状态变化:', status)
    })
    
    // 执行同步
    try {
      await syncServiceAdapter.performFullSync()
      console.log('完整同步完成')
    } catch (error) {
      console.error('同步失败:', error)
    }
    
    // 清理监听器
    unsubscribe()
  }
  
  private async useAuthService(): Promise<void> {
    console.log('\n--- 认证服务示例 ---')
    
    // 方法1：直接使用适配器（推荐）
    const isAuthenticated = await authServiceAdapter.isAuthenticated()
    console.log('用户是否已认证:', isAuthenticated)
    
    // 方法2：通过兼容层访问（向后兼容）
    const authService = apiCompatLayer.authService
    const authState = await authService.getAuthState()
    console.log('认证状态:', authState)
    
    // 添加认证状态监听器
    const unsubscribe = authServiceAdapter.onAuthStateChange((state) => {
      console.log('认证状态变化:', state)
    })
    
    // 清理监听器
    unsubscribe()
  }
  
  private async useDatabaseService(): Promise<void> {
    console.log('\n--- 数据库服务示例 ---')
    
    // 方法1：直接使用适配器（推荐）
    const cards = await databaseAdapter.getCards()
    console.log('获取到卡片数量:', cards.length)
    
    // 方法2：通过兼容层访问（向后兼容）
    const db = apiCompatLayer.database
    const folders = await db.folders.toArray()
    console.log('获取到文件夹数量:', folders.length)
    
    // 添加新卡片
    try {
      const newCard = {
        frontContent: {
          title: '示例卡片',
          text: '这是通过API兼容层创建的卡片'
        },
        backContent: {
          title: '卡片背面',
          text: '背面内容'
        },
        style: {
          type: 'solid',
          backgroundColor: '#3b82f6',
          textColor: '#ffffff'
        },
        isFlipped: false
      }
      
      const cardId = await databaseAdapter.addCard(newCard)
      console.log('新卡片ID:', cardId)
      
      // 获取刚创建的卡片
      const createdCard = await databaseAdapter.getCard(cardId)
      console.log('创建的卡片:', createdCard?.frontContent.title)
      
    } catch (error) {
      console.error('数据库操作失败:', error)
    }
  }
}

// ============================================================================
// 迁移示例
// ============================================================================

/**
 * 迁移示例：从旧API迁移到新API
 */
export class MigrationExample {
  async run(): Promise<void> {
    console.log('\n=== API兼容层迁移示例 ===')
    
    // 1. 旧代码（保持兼容）
    await this.legacyCodeExample()
    
    // 2. 新代码（推荐）
    await this.newCodeExample()
    
    // 3. 混合使用（平滑迁移）
    await this.mixedUsageExample()
  }
  
  /**
   * 旧代码示例（无需修改即可运行）
   */
  private async legacyCodeExample(): Promise<void> {
    console.log('\n--- 旧代码示例（无需修改） ---')
    
    // 这些是原有的API调用，现在通过兼容层工作
    const cloudSyncService = apiCompatLayer.syncService
    const authService = apiCompatLayer.authService
    const db = apiCompatLayer.database
    
    // 原有的同步调用
    const syncStatus = await cloudSyncService.getCurrentStatus()
    console.log('旧方式获取同步状态:', syncStatus.isOnline)
    
    // 原有的认证调用
    const authState = await authService.getAuthState()
    console.log('旧方式获取认证状态:', authState.user ? '已登录' : '未登录')
    
    // 原有的数据库调用
    const cards = await db.cards.toArray()
    console.log('旧方式获取卡片:', cards.length)
  }
  
  /**
   * 新代码示例（推荐使用）
   */
  private async newCodeExample(): Promise<void> {
    console.log('\n--- 新代码示例（推荐） ---')
    
    // 使用新的适配器API
    const syncStatus = await syncServiceAdapter.getCurrentStatus()
    console.log('新方式获取同步状态:', syncStatus.isOnline)
    
    const authState = await authServiceAdapter.getAuthState()
    console.log('新方式获取认证状态:', authState.user ? '已登录' : '未登录')
    
    const cards = await databaseAdapter.getCards()
    console.log('新方式获取卡片:', cards.length)
    
    // 使用新的批量操作
    const batchResult = await databaseAdapter.batchAddCards([
      {
        frontContent: { title: '批量卡片1', text: '内容1' },
        backContent: { title: '背面1', text: '背面内容1' },
        style: { type: 'solid', backgroundColor: '#10b981' },
        isFlipped: false
      },
      {
        frontContent: { title: '批量卡片2', text: '内容2' },
        backContent: { title: '背面2', text: '背面内容2' },
        style: { type: 'solid', backgroundColor: '#f59e0b' },
        isFlipped: false
      }
    ])
    
    console.log('批量添加结果:', batchResult)
  }
  
  /**
   * 混合使用示例（平滑迁移）
   */
  private async mixedUsageExample(): Promise<void> {
    console.log('\n--- 混合使用示例（平滑迁移） ---')
    
    // 逐步迁移：先迁移一个服务，保持其他服务不变
    const authService = apiCompatLayer.authService // 保持旧方式
    const syncStatus = await syncServiceAdapter.getCurrentStatus() // 使用新方式
    
    console.log('混合使用 - 认证（旧）+ 同步（新）')
    console.log('同步状态:', syncStatus.isOnline)
    console.log('认证服务类型:', authService.constructor.name)
  }
}

// ============================================================================
// 高级功能示例
// ============================================================================

/**
 * 高级功能示例
 */
export class AdvancedFeaturesExample {
  async run(): Promise<void> {
    console.log('\n=== 高级功能示例 ===')
    
    // 1. 性能监控
    await this.performanceMonitoringExample()
    
    // 2. 版本管理
    await this.versionManagementExample()
    
    // 3. 健康检查
    await this.healthCheckExample()
    
    // 4. 批量操作
    await this.batchOperationsExample()
  }
  
  /**
   * 性能监控示例
   */
  private async performanceMonitoringExample(): Promise<void> {
    console.log('\n--- 性能监控示例 ---')
    
    // 获取性能指标
    const metrics = apiCompatLayer.getMetrics()
    console.log('性能指标:', metrics)
    
    // 检查同步服务性能
    const syncMetrics = syncServiceAdapter.getMetrics()
    console.log('同步服务指标:', {
      totalCalls: syncMetrics.totalCalls,
      averageResponseTime: `${syncMetrics.averageResponseTime.toFixed(2)  }ms`,
      errorRate: `${syncMetrics.errorRate.toFixed(2)  }%`
    })
    
    // 检查数据库服务性能
    const dbMetrics = databaseAdapter.getMetrics()
    console.log('数据库服务指标:', {
      totalCalls: dbMetrics.totalCalls,
      averageResponseTime: `${dbMetrics.averageResponseTime.toFixed(2)  }ms`,
      errorRate: `${dbMetrics.errorRate.toFixed(2)  }%`
    })
  }
  
  /**
   * 版本管理示例
   */
  private async versionManagementExample(): Promise<void> {
    console.log('\n--- 版本管理示例 ---')
    
    const versionManager = apiCompatLayer.versionManager
    
    // 获取API版本信息
    const apiVersions = versionManager.getApiVersions()
    console.log('API版本信息:', Object.keys(apiVersions))
    
    // 检查API版本
    const isValid = versionManager.checkApiVersion('sync-service', '1.0.0', 'example')
    console.log('API版本检查:', isValid ? '有效' : '无效')
    
    // 获取迁移报告
    const migrationReport = versionManager.generateMigrationReport()
    console.log('迁移报告:', {
      deprecatedApis: migrationReport.deprecatedApis,
      imminentRemovals: migrationReport.imminentRemovals,
      recommendations: migrationReport.recommendations
    })
  }
  
  /**
   * 健康检查示例
   */
  private async healthCheckExample(): Promise<void> {
    console.log('\n--- 健康检查示例 ---')
    
    const health = await apiCompatLayer.healthCheck()
    console.log('健康检查结果:', {
      healthy: health.healthy,
      issues: health.issues,
      adapterCount: Object.keys(health.details).length
    })
    
    if (health.issues.length > 0) {
      console.warn('发现问题:', health.issues)
    }
  }
  
  /**
   * 批量操作示例
   */
  private async batchOperationsExample(): Promise<void> {
    console.log('\n--- 批量操作示例 ---')
    
    // 批量添加卡片
    const batchAddResult = await databaseAdapter.batchAddCards([
      {
        frontContent: { title: '批量卡片1', text: '批量内容1' },
        backContent: { title: '背面1', text: '背面内容1' },
        style: { type: 'solid', backgroundColor: '#8b5cf6' },
        isFlipped: false
      },
      {
        frontContent: { title: '批量卡片2', text: '批量内容2' },
        backContent: { title: '背面2', text: '背面内容2' },
        style: { type: 'solid', backgroundColor: '#ef4444' },
        isFlipped: false
      }
    ])
    
    console.log('批量添加结果:', batchAddResult)
    
    // 批量更新卡片
    if (batchAddResult.success && batchAddResult.processed > 0) {
      // 获取刚添加的卡片
      const cards = await databaseAdapter.getCards()
      const recentCards = cards.slice(-2)
      
      const batchUpdateResult = await databaseAdapter.batchUpdateCards(
        recentCards.map(card => ({
          id: card.id,
          updates: {
            frontContent: {
              ...card.frontContent,
              text: `${card.frontContent.text  } (已更新)`
            }
          }
        }))
      )
      
      console.log('批量更新结果:', batchUpdateResult)
    }
    
    // 搜索功能
    const searchResults = await databaseAdapter.searchCards('批量')
    console.log('搜索结果数量:', searchResults.length)
    
    // 获取统计信息
    const stats = await databaseAdapter.getStatistics()
    console.log('统计信息:', stats)
  }
}

// ============================================================================
// 错误处理示例
// ============================================================================

/**
 * 错误处理示例
 */
export class ErrorHandlingExample {
  async run(): Promise<void> {
    console.log('\n=== 错误处理示例 ===')
    
    // 1. 网络错误处理
    await this.networkErrorHandling()
    
    // 2. 认证错误处理
    await this.authErrorHandling()
    
    // 3. 数据库错误处理
    await this.databaseErrorHandling()
    
    // 4. 版本兼容性错误处理
    await this.versionErrorHandling()
  }
  
  /**
   * 网络错误处理
   */
  private async networkErrorHandling(): Promise<void> {
    console.log('\n--- 网络错误处理 ---')
    
    try {
      // 尝试在离线状态下同步
      await syncServiceAdapter.performFullSync()
    } catch (error) {
      console.log('网络错误处理:', error instanceof Error ? error.message : '未知错误')
      
      // 获取当前状态以提供更好的用户体验
      const status = await syncServiceAdapter.getCurrentStatus()
      console.log('当前状态:', {
        isOnline: status.isOnline,
        syncInProgress: status.syncInProgress,
        pendingOperations: status.pendingOperations
      })
    }
  }
  
  /**
   * 认证错误处理
   */
  private async authErrorHandling(): Promise<void> {
    console.log('\n--- 认证错误处理 ---')
    
    try {
      // 尝试使用无效凭据登录
      await authServiceAdapter.login('invalid@example.com', 'invalid-password')
    } catch (error) {
      console.log('认证错误处理:', error instanceof Error ? error.message : '未知错误')
    }
  }
  
  /**
   * 数据库错误处理
   */
  private async databaseErrorHandling(): Promise<void> {
    console.log('\n--- 数据库错误处理 ---')
    
    try {
      // 尝试获取不存在的卡片
      await databaseAdapter.getCard('non-existent-id')
    } catch (error) {
      console.log('数据库错误处理:', error instanceof Error ? error.message : '未知错误')
    }
  }
  
  /**
   * 版本兼容性错误处理
   */
  private async versionErrorHandling(): Promise<void> {
    console.log('\n--- 版本兼容性错误处理 ---')
    
    const versionManager = apiCompatLayer.versionManager
    
    try {
      // 检查不存在的API版本
      versionManager.checkApiVersion('non-existent-api', '1.0.0', 'example')
    } catch (error) {
      console.log('版本错误处理:', error instanceof Error ? error.message : '未知错误')
    }
  }
}

// ============================================================================
// 运行所有示例
// ============================================================================

/**
 * 运行所有使用示例
 */
export async function runAllExamples(): Promise<void> {
  console.log('开始运行API兼容层使用示例...')
  
  try {
    // 基本使用示例
    const basicExample = new BasicUsageExample()
    await basicExample.run()
    
    // 迁移示例
    const migrationExample = new MigrationExample()
    await migrationExample.run()
    
    // 高级功能示例
    const advancedExample = new AdvancedFeaturesExample()
    await advancedExample.run()
    
    // 错误处理示例
    const errorExample = new ErrorHandlingExample()
    await errorExample.run()
    
    console.log('\n所有示例运行完成!')
    
  } catch (error) {
    console.error('示例运行失败:', error)
  }
}

// ============================================================================
// 开发环境下的自动运行
// ============================================================================

// 在开发环境中自动运行示例
if (process.env.NODE_ENV === 'development') {
  console.log('检测到开发环境，将自动运行使用示例...')
  
  // 延迟运行以确保兼容层初始化完成
  setTimeout(async () => {
    try {
      await runAllExamples()
    } catch (error) {
      console.error('自动运行示例失败:', error)
    }
  }, 2000)
}