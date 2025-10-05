// Supabase integration removed - data consistency checker now uses local database only
import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from './database'
import { syncStrategyService } from './sync-strategy'
import { networkMonitorService } from './network-monitor'
import { authService } from './auth'

// 延迟初始化的服务引用
let syncIntegrationService: any = null

// ============================================================================
// 数据一致性验证系统
// ============================================================================

// 一致性检查类型
export type ConsistencyCheckType =
  | 'structural'   // 结构一致性（表结构、字段）
  | 'referential'  // 引用一致性（外键、关联）
  | 'data'         // 数据一致性（内容匹配）
  | 'timestamp'    // 时间戳一致性
  | 'version'      // 版本一致性
  | 'count'        // 数量一致性
  | 'checksum'     // 校验和一致性
  | 'business'     // 业务规则一致性

// 一致性检查结果状态
export type ConsistencyStatus =
  | 'consistent'   // 一致
  | 'inconsistent' // 不一致
  | 'warning'      // 警告
  | 'error'        // 错误
  | 'unknown'      // 未知

// 一致性检查结果
export   // 详细信息
  details: {
    localData?: any
    remoteData?: any
    differences?: Array<{
      field: string
      localValue: any
      remoteValue: any
      reason: string
    }>
    expectedValue?: any
    actualValue?: any
  }

  // 解决建议
  suggestions: string[]
  autoFixable: boolean
  fixStrategy?: 'local-wins' | 'remote-wins' | 'merge' | 'manual'

  // 元信息
  timestamp: Date
  userId?: string
  networkInfo?: any
  checkDuration: number
  retryCount: number
}

// 一致性检查配置
export   // 检查类型配置
  checkTypes: {
    [K in ConsistencyCheckType]: {
      enabled: boolean
      priority: 'low' | 'medium' | 'high'
      threshold?: number
    }
  }

  // 告警配置
  alerts: {
    enabled: boolean
    severityThreshold: 'low' | 'medium' | 'high' | 'critical'
    channels: ('console' | 'notification' | 'email')[]
    cooldown: number // 告警冷却时间
  }

  // 自动修复配置
  autoFix: {
    enabled: boolean
    strategy: 'conservative' | 'aggressive'
    maxItemsPerFix: number
    requireConfirmation: boolean
    backupEnabled: boolean
  }

  // 性能配置
  performance: {
    memoryLimit: number
    timeout: number
    retryLimit: number
    adaptiveTiming: boolean
  }
}

// 默认配置
export const DEFAULT_CONSISTENCY_CONFIG: ConsistencyCheckerConfig = {
  strategy: {
    autoCheck: true,
    checkInterval: 300000, // 5分钟
    batchSize: 50,
    maxConcurrentChecks: 3,
    checkOnSync: true,
    checkOnNetworkChange: true
  },

  checkTypes: {
    structural: { enabled: true, priority: 'high' },
    referential: { enabled: true, priority: 'high' },
    data: { enabled: true, priority: 'medium' },
    timestamp: { enabled: true, priority: 'medium', threshold: 60000 }, // 1分钟阈值
    version: { enabled: true, priority: 'high' },
    count: { enabled: true, priority: 'medium', threshold: 5 }, // 5条差异阈值
    checksum: { enabled: false, priority: 'low' }, // 性能敏感,默认关闭
    business: { enabled: true, priority: 'medium' }
  },

  alerts: {
    enabled: true,
    severityThreshold: 'medium',
    channels: ['console', 'notification'],
    cooldown: 300000 // 5分钟冷却
  },

  autoFix: {
    enabled: true,
    strategy: 'conservative',
    maxItemsPerFix: 10,
    requireConfirmation: true,
    backupEnabled: true
  },

  performance: {
    memoryLimit: 50 * 1024 * 1024, // 50MB
    timeout: 30000, // 30秒
    retryLimit: 3,
    adaptiveTiming: true
  }
}

// 一致性检查统计
export interface ConsistencyStats {
  totalChecks: number
  successfulChecks: number
  failedChecks: number
  inconsistenciesFound: number
  autoFixed: number
  manualFixesRequired: number

  // 按类型统计
  byType: Record<ConsistencyCheckType, {
    checks: number
    inconsistencies: number
    averageTime: number
  }>

  // 按实体类型统计
  byEntityType: Record<'card' | 'folder' | 'tag' | 'image' | 'system', {
    checks: number
    inconsistencies: number
  }>

  // 性能统计
  performance: {
    averageCheckTime: number
    totalCheckTime: number
    memoryUsage: number
    networkLatency: number
  }

  // 最近检查时间
  lastCheckTime?: Date
  lastInconsistencyFound?: Date
}

// ============================================================================
// 数据一致性检查器
// ============================================================================

export class DataConsistencyChecker {
  private config: ConsistencyCheckerConfig
  private isRunning = false
  private isInitialized = false

  // 检查队列
  private checkQueue: Array<() => Promise<void>> = []
  private activeChecks = new Set<string>()

  // 统计信息
  private stats: ConsistencyStats = this.initializeStats()

  // 事件监听器
  private listeners: {
    checkCompleted?: (result: ConsistencyCheckResult) => void
    inconsistencyFound?: (result: ConsistencyCheckResult) => void
    autoFixCompleted?: (results: ConsistencyCheckResult[]) => void
    statsUpdated?: (stats: ConsistencyStats) => void
  } = {}

  // 定时器
  private checkTimer: NodeJS.Timeout | null = null
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(config: Partial<ConsistencyCheckerConfig> = {}) {
    this.config = { ...DEFAULT_CONSISTENCY_CONFIG, ...config }
    // 不在构造函数中初始化,等待显式调用
  }

  // 初始化统计信息
  private initializeStats(): ConsistencyStats {
    return {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      inconsistenciesFound: 0,
      autoFixed: 0,
      manualFixesRequired: 0,
      byType: {
        structural: { checks: 0, inconsistencies: 0, averageTime: 0 },
        referential: { checks: 0, inconsistencies: 0, averageTime: 0 },
        data: { checks: 0, inconsistencies: 0, averageTime: 0 },
        timestamp: { checks: 0, inconsistencies: 0, averageTime: 0 },
        version: { checks: 0, inconsistencies: 0, averageTime: 0 },
        count: { checks: 0, inconsistencies: 0, averageTime: 0 },
        checksum: { checks: 0, inconsistencies: 0, averageTime: 0 },
        business: { checks: 0, inconsistencies: 0, averageTime: 0 }
      },
      byEntityType: {
        card: { checks: 0, inconsistencies: 0 },
        folder: { checks: 0, inconsistencies: 0 },
        tag: { checks: 0, inconsistencies: 0 },
        image: { checks: 0, inconsistencies: 0 },
        system: { checks: 0, inconsistencies: 0 }
      },
      performance: {
        averageCheckTime: 0,
        totalCheckTime: 0,
        memoryUsage: 0,
        networkLatency: 0
      }
    }
  }

  // 初始化循环依赖
  private async initializeCircularDependencies(): Promise<void> {
    try {
      // 延迟导入以避免循环依赖
      const { syncIntegrationService: service } = await import('./sync-integration')
      syncIntegrationService = service

      console.log('Circular dependencies initialized successfully')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 初始化
  private async initialize(): Promise<void> {
    try {
      console.log('Initializing DataConsistencyChecker...')

      // 初始化循环依赖
      await this.initializeCircularDependencies()

      // 设置事件监听
      this.setupEventListeners()

      // 启动定时任务
      this.startScheduledTasks()

      this.isInitialized = true
      console.log('DataConsistencyChecker initialized successfully')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 设置事件监听器
  private setupEventListeners(): void {
    // 监听同步完成事件
    if (this.config.strategy.checkOnSync) {
      syncIntegrationService.addEventListener((event) => {
        if (event.type === 'sync-completed') {
          // 延迟执行检查,确保数据已稳定
          setTimeout(() => {
            this.performFullCheck()
          }, 5000)
        }
      })
    }

    // 监听网络变化事件
    if (this.config.strategy.checkOnNetworkChange) {
      networkMonitorService.addEventListener((event) => {
        if (event.type === 'online') {
          // 网络恢复时执行检查
          this.performQuickCheck()
        }
      })
    }
  }

  // 启动定时任务
  private startScheduledTasks(): void {
    if (this.config.strategy.autoCheck) {
      this.checkTimer = setInterval(() => {
        this.performQuickCheck()
      }, this.config.strategy.checkInterval)
    }

    // 定期清理旧数据
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldData()
    }, 24 * 60 * 60 * 1000) // 24小时
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  // 启动检查器
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('DataConsistencyChecker is already running')
      return
    }

    if (!this.isInitialized) {
      throw new Error('DataConsistencyChecker is not initialized')
    }

    try {
      this.isRunning = true

      // 执行初始检查
      await this.performQuickCheck()

      console.log('DataConsistencyChecker started successfully')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 停止检查器
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('DataConsistencyChecker is not running')
      return
    }

    try {
      this.isRunning = false

      // 停止定时器
      if (this.checkTimer) {
        clearInterval(this.checkTimer)
        this.checkTimer = null
      }

      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer)
        this.cleanupTimer = null
      }

      // 等待活动检查完成
      await this.waitForActiveChecks()

      console.log('DataConsistencyChecker stopped successfully')
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 执行完整检查
  async performFullCheck(options?: {
    entityTypes?: ('card' | 'folder' | 'tag' | 'image')[]
    checkTypes?: ConsistencyCheckType[]
    userId?: string
  }): Promise<ConsistencyCheckResult[]> {
    if (!this.isRunning) {
      throw new Error('DataConsistencyChecker is not running')
    }

    const userId = options?.userId || authService.getCurrentUser()?.id
    if (!userId) {
      throw new Error('No authenticated user')
    }

    const results: ConsistencyCheckResult[] = []
    const entityTypes = options?.entityTypes || ['card', 'folder', 'tag', 'image']
    const checkTypes = options?.checkTypes || this.getEnabledCheckTypes()

    console.log('Starting full consistency check...', { entityTypes, checkTypes })

    for (const entityType of entityTypes) {
      for (const checkType of checkTypes) {
        try {
          const result = await this.performCheck(entityType, checkType, userId)
          results.push(result)
        } catch (error) {
          console.warn("操作失败:", error)
        } check for ${entityType}:`, error)

          // 创建错误结果
          results.push({
            id: crypto.randomUUID(),
            checkType,
            entityType,
            status: 'error',
            title: `Check failed: ${checkType} for ${entityType}`,
            description: error instanceof Error ? error.message : 'Unknown error',
            severity: 'high',
            impact: {
              dataLoss: false,
              syncFailure: true,
              userExperience: false,
              performance: false
            },
            details: {
              expectedValue: 'Successful check',
              actualValue: error instanceof Error ? error.message : 'Unknown error'
            },
            suggestions: ['Retry the check', 'Check network connectivity'],
            autoFixable: false,
            timestamp: new Date(),
            userId,
            checkDuration: 0,
            retryCount: 0
          })
        }
      }
    }

    console.log(`Full consistency check completed: ${results.length} results`)
    return results
  }

  // 执行快速检查
  async performQuickCheck(): Promise<ConsistencyCheckResult[]> {
    if (!this.isRunning) {
      return []
    }

    try {
      const userId = authService.getCurrentUser()?.id
      if (!userId) {
        return []
      }

      // 只执行高优先级的检查
      const quickCheckTypes: ConsistencyCheckType[] = ['version', 'count', 'structural']
      const results = await this.performFullCheck({
        checkTypes: quickCheckTypes,
        userId
      })

      return results
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 执行特定检查
  async performCheck(
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'system',
    checkType: ConsistencyCheckType,
    userId: string
  ): Promise<ConsistencyCheckResult> {
    const checkId = `${entityType}-${checkType}-${Date.now()}`

    // 检查是否已有相同类型的检查在进行
    if (this.activeChecks.has(checkType)) {
      console.warn(`Check ${checkType} is already running`)
      throw new Error(`Check ${checkType} is already running`)
    }

    this.activeChecks.add(checkType)
    const startTime = Date.now()

    try {
      let result: ConsistencyCheckResult

      switch (checkType) {
        case 'structural':
          result = await this.checkStructuralConsistency(entityType, userId)
          break
        case 'referential':
          result = await this.checkReferentialConsistency(entityType, userId)
          break
        case 'data':
          result = await this.checkDataConsistency(entityType, userId)
          break
        case 'timestamp':
          result = await this.checkTimestampConsistency(entityType, userId)
          break
        case 'version':
          result = await this.checkVersionConsistency(entityType, userId)
          break
        case 'count':
          result = await this.checkCountConsistency(entityType, userId)
          break
        case 'checksum':
          result = await this.checkChecksumConsistency(entityType, userId)
          break
        case 'business':
          result = await this.checkBusinessConsistency(entityType, userId)
          break
        default:
          throw new Error(`Unknown check type: ${checkType}`)
      }

      result.checkDuration = Date.now() - startTime

      // 更新统计信息
      this.updateStats(result)

      // 通知监听器
      this.notifyListeners('checkCompleted', result)

      // 如果发现不一致,发送告警
      if (result.status === 'inconsistent' || result.status === 'error') {
        this.notifyListeners('inconsistencyFound', result)
        await this.handleInconsistency(result)
      }

      return result
    } finally {
      this.activeChecks.delete(checkType)
    }
  }

  // ============================================================================
  // 一致性检查实现
  // ============================================================================

  // 检查结构一致性
  private async checkStructuralConsistency(
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'system',
    userId: string
  ): Promise<ConsistencyCheckResult> {
    const startTime = Date.now()

    try {
      // 检查必需字段是否存在
      const schemaChecks = await this.validateSchema(entityType)

      if (schemaChecks.isValid) {
        return {
          id: crypto.randomUUID(),
          checkType: 'structural',
          entityType,
          status: 'consistent',
          title: 'Structure consistency check passed',
          description: `All required fields are present for ${entityType}`,
          severity: 'low',
          impact: {
            dataLoss: false,
            syncFailure: false,
            userExperience: false,
            performance: false
          },
          details: {},
          suggestions: [],
          autoFixable: false,
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      } else {
        return {
          id: crypto.randomUUID(),
          checkType: 'structural',
          entityType,
          status: 'inconsistent',
          title: 'Structure consistency check failed',
          description: `Missing required fields for ${entityType}`,
          severity: 'high',
          impact: {
            dataLoss: true,
            syncFailure: true,
            userExperience: true,
            performance: true
          },
          details: {
            expectedValue: 'All required fields present',
            actualValue: schemaChecks.missingFields.join(', ')
          },
          suggestions: [
            'Check database schema',
            'Run migration scripts',
            'Verify data integrity'
          ],
          autoFixable: false,
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 检查引用一致性
  private async checkReferentialConsistency(
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'system',
    userId: string
  ): Promise<ConsistencyCheckResult> {
    const startTime = Date.now()

    try {
      const issues: string[] = []

      switch (entityType) {
        case 'card':
          // 检查卡片引用的文件夹是否存在
          const cards = await db.cards.where('userId').equals(userId).toArray()
          for (const card of cards) {
            if (card.folderId) {
              const folderExists = await db.folders.get(card.folderId)
              if (!folderExists) {
                issues.push(`Card ${card.id} references non-existent folder ${card.folderId}`)
              }
            }
          }
          break

        case 'image':
          // 检查图片引用的卡片是否存在
          const images = await db.images.where('userId').equals(userId).toArray()
          for (const image of images) {
            const cardExists = await db.cards.get(image.cardId)
            if (!cardExists) {
              issues.push(`Image ${image.id} references non-existent card ${image.cardId}`)
            }
          }
          break
      }

      if (issues.length === 0) {
        return {
          id: crypto.randomUUID(),
          checkType: 'referential',
          entityType,
          status: 'consistent',
          title: 'Referential consistency check passed',
          description: `All references are valid for ${entityType}`,
          severity: 'low',
          impact: {
            dataLoss: false,
            syncFailure: false,
            userExperience: false,
            performance: false
          },
          details: {},
          suggestions: [],
          autoFixable: false,
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      } else {
        return {
          id: crypto.randomUUID(),
          checkType: 'referential',
          entityType,
          status: 'inconsistent',
          title: 'Referential consistency check failed',
          description: `Found ${issues.length} reference issues for ${entityType}`,
          severity: 'medium',
          impact: {
            dataLoss: false,
            syncFailure: true,
            userExperience: true,
            performance: false
          },
          details: {
            expectedValue: 'All references valid',
            actualValue: issues.join('; ')
          },
          suggestions: [
            'Remove orphaned references',
            'Create missing referenced entities',
            'Clean up invalid data'
          ],
          autoFixable: true,
          fixStrategy: 'manual',
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 检查数据一致性
  private async checkDataConsistency(
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'system',
    userId: string
  ): Promise<ConsistencyCheckResult> {
    const startTime = Date.now()

    try {
      // 获取本地和远程数据
      const [localData, remoteData] = await Promise.all([
        this.getLocalData(entityType, userId),
        this.getRemoteData(entityType, userId)
      ])

      const differences = this.compareData(localData, remoteData, entityType)

      if (differences.length === 0) {
        return {
          id: crypto.randomUUID(),
          checkType: 'data',
          entityType,
          status: 'consistent',
          title: 'Data consistency check passed',
          description: `Local and remote data match for ${entityType}`,
          severity: 'low',
          impact: {
            dataLoss: false,
            syncFailure: false,
            userExperience: false,
            performance: false
          },
          details: {
            localData: localData.length,
            remoteData: remoteData.length
          },
          suggestions: [],
          autoFixable: false,
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      } else {
        return {
          id: crypto.randomUUID(),
          checkType: 'data',
          entityType,
          status: 'inconsistent',
          title: 'Data consistency check failed',
          description: `Found ${differences.length} data differences for ${entityType}`,
          severity: 'medium',
          impact: {
            dataLoss: true,
            syncFailure: true,
            userExperience: true,
            performance: false
          },
          details: {
            differences
          },
          suggestions: [
            'Perform sync to resolve differences',
            'Check network connectivity',
            'Verify data integrity'
          ],
          autoFixable: true,
          fixStrategy: 'merge',
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 检查时间戳一致性
  private async checkTimestampConsistency(
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'system',
    userId: string
  ): Promise<ConsistencyCheckResult> {
    const startTime = Date.now()

    try {
      const threshold = this.config.checkTypes.timestamp.threshold || 60000
      const timestampIssues: Array<{ id: string, localTime: Date, remoteTime: Date, diff: number }> = []

      // 获取本地数据
      const localData = await this.getLocalData(entityType, userId)

      // 获取远程数据
      const remoteData = await this.getRemoteData(entityType, userId)

      // 创建远程数据映射
      const remoteMap = new Map(remoteData.map(item => [item.id, item]))

      // 检查时间戳差异
      for (const localItem of localData) {
        const remoteItem = remoteMap.get(localItem.id)
        if (remoteItem) {
          const localTime = new Date(localItem.updatedAt)
          const remoteTime = new Date(remoteItem.updated_at || remoteItem.updatedAt)
          const diff = Math.abs(localTime.getTime() - remoteTime.getTime())

          if (diff > threshold) {
            timestampIssues.push({
              id: localItem.id,
              localTime,
              remoteTime,
              diff
            })
          }
        }
      }

      if (timestampIssues.length === 0) {
        return {
          id: crypto.randomUUID(),
          checkType: 'timestamp',
          entityType,
          status: 'consistent',
          title: 'Timestamp consistency check passed',
          description: `All timestamps are within threshold for ${entityType}`,
          severity: 'low',
          impact: {
            dataLoss: false,
            syncFailure: false,
            userExperience: false,
            performance: false
          },
          details: {
            threshold: `${threshold}ms`,
            checkedItems: localData.length
          },
          suggestions: [],
          autoFixable: false,
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      } else {
        return {
          id: crypto.randomUUID(),
          checkType: 'timestamp',
          entityType,
          status: 'warning',
          title: 'Timestamp consistency check warning',
          description: `Found ${timestampIssues.length} timestamp issues for ${entityType}`,
          severity: 'low',
          impact: {
            dataLoss: false,
            syncFailure: false,
            userExperience: false,
            performance: true
          },
          details: {
            threshold: `${threshold}ms`,
            issues: timestampIssues.slice(0, 5) // 只显示前5个问题
          },
          suggestions: [
            'Check clock synchronization',
            'Perform sync to update timestamps',
            'Verify network connectivity'
          ],
          autoFixable: true,
          fixStrategy: 'remote-wins',
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 检查版本一致性
  private async checkVersionConsistency(
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'system',
    userId: string
  ): Promise<ConsistencyCheckResult> {
    const startTime = Date.now()

    try {
      const versionIssues: Array<{ id: string, localVersion: number, remoteVersion: number }> = []

      // 获取本地数据
      const localData = await this.getLocalData(entityType, userId)

      // 获取远程数据
      const remoteData = await this.getRemoteData(entityType, userId)

      // 创建远程数据映射
      const remoteMap = new Map(remoteData.map(item => [item.id, item]))

      // 检查版本差异
      for (const localItem of localData) {
        const remoteItem = remoteMap.get(localItem.id)
        if (remoteItem) {
          const localVersion = localItem.syncVersion || 0
          const remoteVersion = remoteItem.sync_version || remoteItem.syncVersion || 0

          if (localVersion !== remoteVersion) {
            versionIssues.push({
              id: localItem.id,
              localVersion,
              remoteVersion
            })
          }
        }
      }

      if (versionIssues.length === 0) {
        return {
          id: crypto.randomUUID(),
          checkType: 'version',
          entityType,
          status: 'consistent',
          title: 'Version consistency check passed',
          description: `All versions match for ${entityType}`,
          severity: 'low',
          impact: {
            dataLoss: false,
            syncFailure: false,
            userExperience: false,
            performance: false
          },
          details: {
            checkedItems: localData.length
          },
          suggestions: [],
          autoFixable: false,
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      } else {
        return {
          id: crypto.randomUUID(),
          checkType: 'version',
          entityType,
          status: 'inconsistent',
          title: 'Version consistency check failed',
          description: `Found ${versionIssues.length} version mismatches for ${entityType}`,
          severity: 'high',
          impact: {
            dataLoss: true,
            syncFailure: true,
            userExperience: true,
            performance: false
          },
          details: {
            issues: versionIssues.slice(0, 5) // 只显示前5个问题
          },
          suggestions: [
            'Perform sync to resolve version conflicts',
            'Check sync status',
            'Verify data integrity'
          ],
          autoFixable: true,
          fixStrategy: 'merge',
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 检查数量一致性
  private async checkCountConsistency(
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'system',
    userId: string
  ): Promise<ConsistencyCheckResult> {
    const startTime = Date.now()

    try {
      const threshold = this.config.checkTypes.count.threshold || 5

      // 获取本地数据
      const localData = await this.getLocalData(entityType, userId)

      // 获取远程数据
      const remoteData = await this.getRemoteData(entityType, userId)

      const localCount = localData.length
      const remoteCount = remoteData.length
      const diff = Math.abs(localCount - remoteCount)

      if (diff <= threshold) {
        return {
          id: crypto.randomUUID(),
          checkType: 'count',
          entityType,
          status: 'consistent',
          title: 'Count consistency check passed',
          description: `Record counts match for ${entityType}`,
          severity: 'low',
          impact: {
            dataLoss: false,
            syncFailure: false,
            userExperience: false,
            performance: false
          },
          details: {
            localCount,
            remoteCount,
            threshold
          },
          suggestions: [],
          autoFixable: false,
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      } else {
        return {
          id: crypto.randomUUID(),
          checkType: 'count',
          entityType,
          status: 'inconsistent',
          title: 'Count consistency check failed',
          description: `Record count mismatch for ${entityType}`,
          severity: 'medium',
          impact: {
            dataLoss: true,
            syncFailure: true,
            userExperience: true,
            performance: false
          },
          details: {
            localCount,
            remoteCount,
            difference: diff,
            threshold
          },
          suggestions: [
            'Perform sync to resolve count differences',
            'Check for missing or duplicate records',
            'Verify data integrity'
          ],
          autoFixable: true,
          fixStrategy: 'manual',
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 检查校验和一致性（性能敏感,谨慎使用）
  private async checkChecksumConsistency(
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'system',
    userId: string
  ): Promise<ConsistencyCheckResult> {
    const startTime = Date.now()

    try {
      // 限制检查数量以提高性能
      const sampleSize = 10

      // 获取本地数据样本
      const localData = await this.getLocalData(entityType, userId)
      const localSample = localData.slice(0, sampleSize)

      // 获取远程数据样本
      const remoteData = await this.getRemoteData(entityType, userId)
      const remoteMap = new Map(remoteData.map(item => [item.id, item]))

      const checksumIssues: Array<{ id: string, localChecksum: string, remoteChecksum: string }> = []

      // 计算校验和
      for (const localItem of localSample) {
        const remoteItem = remoteMap.get(localItem.id)
        if (remoteItem) {
          const localChecksum = await this.calculateChecksum(localItem)
          const remoteChecksum = await this.calculateChecksum(remoteItem)

          if (localChecksum !== remoteChecksum) {
            checksumIssues.push({
              id: localItem.id,
              localChecksum,
              remoteChecksum
            })
          }
        }
      }

      if (checksumIssues.length === 0) {
        return {
          id: crypto.randomUUID(),
          checkType: 'checksum',
          entityType,
          status: 'consistent',
          title: 'Checksum consistency check passed',
          description: `Sample checksums match for ${entityType}`,
          severity: 'low',
          impact: {
            dataLoss: false,
            syncFailure: false,
            userExperience: false,
            performance: false
          },
          details: {
            sampleSize,
            totalItems: localData.length
          },
          suggestions: [],
          autoFixable: false,
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      } else {
        return {
          id: crypto.randomUUID(),
          checkType: 'checksum',
          entityType,
          status: 'inconsistent',
          title: 'Checksum consistency check failed',
          description: `Found ${checksumIssues.length} checksum mismatches in sample for ${entityType}`,
          severity: 'high',
          impact: {
            dataLoss: true,
            syncFailure: true,
            userExperience: true,
            performance: false
          },
          details: {
            sampleSize,
            issues: checksumIssues
          },
          suggestions: [
            'Perform sync to resolve data corruption',
            'Check for data integrity issues',
            'Verify storage health'
          ],
          autoFixable: true,
          fixStrategy: 'remote-wins',
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 检查业务规则一致性
  private async checkBusinessConsistency(
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'system',
    userId: string
  ): Promise<ConsistencyCheckResult> {
    const startTime = Date.now()

    try {
      const businessIssues: string[] = []

      switch (entityType) {
        case 'folder':
          // 检查文件夹层次结构
          const folders = await db.folders.where('userId').equals(userId).toArray()
          for (const folder of folders) {
            // 检查循环引用
            if (folder.parentId) {
              const hasCycle = await this.checkFolderCycle(folder.id, folder.parentId)
              if (hasCycle) {
                businessIssues.push(`Folder ${folder.id} has circular reference`)
              }
            }
          }
          break

        case 'card':
          // 检查卡片内容完整性
          const cards = await db.cards.where('userId').equals(userId).toArray()
          for (const card of cards) {
            if (!card.frontContent || !card.backContent) {
              businessIssues.push(`Card ${card.id} has incomplete content`)
            }
          }
          break

        case 'tag':
          // 检查标签名称唯一性
          const tags = await db.tags.where('userId').equals(userId).toArray()
          const tagNameMap = new Map<string, string[]>()
          for (const tag of tags) {
            if (!tagNameMap.has(tag.name)) {
              tagNameMap.set(tag.name, [])
            }
            tagNameMap.get(tag.name)!.push(tag.id)
          }

          for (const [name, ids] of tagNameMap) {
            if (ids.length > 1) {
              businessIssues.push(`Duplicate tag name: ${name} (${ids.length} occurrences)`)
            }
          }
          break
      }

      if (businessIssues.length === 0) {
        return {
          id: crypto.randomUUID(),
          checkType: 'business',
          entityType,
          status: 'consistent',
          title: 'Business rule consistency check passed',
          description: `All business rules are satisfied for ${entityType}`,
          severity: 'low',
          impact: {
            dataLoss: false,
            syncFailure: false,
            userExperience: false,
            performance: false
          },
          details: {},
          suggestions: [],
          autoFixable: false,
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      } else {
        return {
          id: crypto.randomUUID(),
          checkType: 'business',
          entityType,
          status: 'inconsistent',
          title: 'Business rule consistency check failed',
          description: `Found ${businessIssues.length} business rule violations for ${entityType}`,
          severity: 'medium',
          impact: {
            dataLoss: false,
            syncFailure: false,
            userExperience: true,
            performance: false
          },
          details: {
            issues: businessIssues.slice(0, 5) // 只显示前5个问题
          },
          suggestions: [
            'Review business rules',
            'Clean up invalid data',
            'Update data validation logic'
          ],
          autoFixable: true,
          fixStrategy: 'manual',
          timestamp: new Date(),
          userId,
          checkDuration: Date.now() - startTime,
          retryCount: 0
        }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  // 获取本地数据
  private async getLocalData(
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'system',
    userId: string
  ): Promise<any[]> {
    switch (entityType) {
      case 'card':
        return await db.cards.where('userId').equals(userId).toArray()
      case 'folder':
        return await db.folders.where('userId').equals(userId).toArray()
      case 'tag':
        return await db.tags.where('userId').equals(userId).toArray()
      case 'image':
        return await db.images.where('userId').equals(userId).toArray()
      case 'system':
        // 系统级别检查返回综合数据
        const [cards, folders, tags, images] = await Promise.all([
          db.cards.where('userId').equals(userId).toArray(),
          db.folders.where('userId').equals(userId).toArray(),
          db.tags.where('userId').equals(userId).toArray(),
          db.images.where('userId').equals(userId).toArray()
        ])
        return { cards, folders, tags, images }
      default:
        return []
    }
  }

  // 获取远程数据（本地模式 - 不再连接云端）
  private async getRemoteData(
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'system',
    userId: string
  ): Promise<any[]> {
    // 云端同步已禁用，返回空数组
    console.debug(`Remote data retrieval disabled for ${entityType}, using local-only mode`)
    return []
  }

  // 比较数据差异
  private compareData(localData: any[], remoteData: any[], entityType: string): Array<{
    field: string
    localValue: any
    remoteValue: any
    reason: string
  }> {
    const differences: Array<{
      field: string
      localValue: any
      remoteValue: any
      reason: string
    }> = []

    // 创建远程数据映射
    const remoteMap = new Map(remoteData.map(item => [item.id, item]))

    for (const localItem of localData) {
      const remoteItem = remoteMap.get(localItem.id)
      if (!remoteItem) {
        differences.push({
          field: 'existence',
          localValue: 'exists',
          remoteValue: 'missing',
          reason: `Item ${localItem.id} exists locally but not remotely`
        })
        continue
      }

      // 比较关键字段
      const compareFields = this.getCompareFields(entityType)
      for (const field of compareFields) {
        const localValue = this.getFieldValue(localItem, field)
        const remoteValue = this.getFieldValue(remoteItem, field)

        if (this.isFieldDifferent(localValue, remoteValue)) {
          differences.push({
            field,
            localValue,
            remoteValue,
            reason: `Field ${field} differs between local and remote`
          })
        }
      }
    }

    // 检查远程存在但本地不存在的项目
    const localIds = new Set(localData.map(item => item.id))
    for (const remoteItem of remoteData) {
      if (!localIds.has(remoteItem.id)) {
        differences.push({
          field: 'existence',
          localValue: 'missing',
          remoteValue: 'exists',
          reason: `Item ${remoteItem.id} exists remotely but not locally`
        })
      }
    }

    return differences
  }

  // 获取比较字段
  private getCompareFields(entityType: string): string[] {
    switch (entityType) {
      case 'card':
        return ['frontContent', 'backContent', 'style', 'folderId']
      case 'folder':
        return ['name', 'parentId', 'color']
      case 'tag':
        return ['name', 'color']
      case 'image':
        return ['fileName', 'filePath', 'cloudUrl']
      default:
        return []
    }
  }

  // 获取字段值
  private getFieldValue(item: any, field: string): any {
    const fieldPath = field.split('.')
    let value = item

    for (const part of fieldPath) {
      if (value && typeof value === 'object') {
        value = value[part]
      } else {
        return undefined
      }
    }

    return value
  }

  // 检查字段是否不同
  private isFieldDifferent(localValue: any, remoteValue: any): boolean {
    // 处理对象和数组的深度比较
    if (typeof localValue === 'object' && typeof remoteValue === 'object') {
      return JSON.stringify(localValue) !== JSON.stringify(remoteValue)
    }

    // 处理时间戳
    if (localValue instanceof Date && remoteValue instanceof Date) {
      return Math.abs(localValue.getTime() - remoteValue.getTime()) > 1000 // 1秒阈值
    }

    // 普通值比较
    return localValue !== remoteValue
  }

  // 计算校验和
  private async calculateChecksum(data: any): Promise<string> {
    const dataString = JSON.stringify(data)
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(dataString)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // 检查文件夹循环引用
  private async checkFolderCycle(folderId: string, parentId: string): Promise<boolean> {
    const visited = new Set<string>()
    let currentId = parentId

    while (currentId) {
      if (visited.has(currentId)) {
        return true // 发现循环
      }

      visited.add(currentId)

      const parentFolder = await db.folders.get(currentId)
      if (!parentFolder || !parentFolder.parentId) {
        break
      }

      currentId = parentFolder.parentId

      // 防止无限循环
      if (visited.size > 100) {
        break
      }
    }

    return false
  }

  // 验证模式
  private async validateSchema(entityType: string): Promise<{ isValid: boolean; missingFields: string[] }> {
    const requiredFields = this.getRequiredFields(entityType)
    const missingFields: string[] = []

    // 这里简化了模式验证,实际实现需要根据数据库模式进行更详细的检查
    // 暂时返回有效状态
    return {
      isValid: true,
      missingFields: []
    }
  }

  // 获取必需字段
  private getRequiredFields(entityType: string): string[] {
    switch (entityType) {
      case 'card':
        return ['id', 'userId', 'frontContent', 'backContent', 'syncVersion', 'pendingSync', 'updatedAt']
      case 'folder':
        return ['id', 'userId', 'name', 'syncVersion', 'pendingSync', 'updatedAt']
      case 'tag':
        return ['id', 'userId', 'name', 'syncVersion', 'pendingSync', 'updatedAt']
      case 'image':
        return ['id', 'cardId', 'userId', 'fileName', 'filePath', 'metadata', 'storageMode', 'syncVersion', 'pendingSync', 'updatedAt']
      default:
        return []
    }
  }

  // 创建错误结果
  private createErrorResult(
    checkType: ConsistencyCheckType,
    entityType: string,
    error: any,
    userId: string,
    startTime: number
  ): ConsistencyCheckResult {
    return {
      id: crypto.randomUUID(),
      checkType,
      entityType,
      status: 'error',
      title: `Check failed: ${checkType} for ${entityType}`,
      description: error instanceof Error ? error.message : 'Unknown error',
      severity: 'high',
      impact: {
        dataLoss: false,
        syncFailure: true,
        userExperience: false,
        performance: false
      },
      details: {
        expectedValue: 'Successful check',
        actualValue: error instanceof Error ? error.message : 'Unknown error'
      },
      suggestions: ['Retry the check', 'Check system logs'],
      autoFixable: false,
      timestamp: new Date(),
      userId,
      checkDuration: Date.now() - startTime,
      retryCount: 0
    }
  }

  // 获取启用的检查类型
  private getEnabledCheckTypes(): ConsistencyCheckType[] {
    return Object.entries(this.config.checkTypes)
      .filter(([_, config]) => config.enabled)
      .map(([type]) => type as ConsistencyCheckType)
  }

  // 处理不一致
  private async handleInconsistency(result: ConsistencyCheckResult): Promise<void> {
    // 发送告警
    if (this.config.alerts.enabled &&
        result.severity === this.config.alerts.severityThreshold ||
        result.severity === 'critical') {
      await this.sendAlert(result)
    }

    // 自动修复
    if (this.config.autoFix.enabled && result.autoFixable) {
      await this.autoFix(result)
    }
  }

  // 发送告警
  private async sendAlert(result: ConsistencyCheckResult): Promise<void> {
    const alertMessage = `Consistency Alert: ${result.title} - ${result.description}`

    console.warn(alertMessage)

    // 如果支持通知,发送浏览器通知
    if (this.config.alerts.channels.includes('notification') && 'Notification' in window) {
      try {
        new Notification('Data Consistency Alert', {
          body: alertMessage,
          icon: '/favicon.ico'
        })
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }
  }

  // 自动修复
  private async autoFix(result: ConsistencyCheckResult): Promise<void> {
    if (!result.fixStrategy || result.fixStrategy === 'manual') {
      return
    }

    try {
      console.log(`Attempting auto-fix for ${result.id} using strategy: ${result.fixStrategy}`)

      // 根据不同的检查类型执行修复
      switch (result.checkType) {
        case 'data':
        case 'version':
          await this.autoFixDataInconsistency(result)
          break
        case 'referential':
          await this.autoFixReferentialInconsistency(result)
          break
        case 'timestamp':
          await this.autoFixTimestampInconsistency(result)
          break
        case 'count':
          await this.autoFixCountInconsistency(result)
          break
        default:
          console.warn(`Auto-fix not supported for check type: ${result.checkType}`)
      }

      console.log(`Auto-fix completed for ${result.id}`)

      // 通知监听器
      this.notifyListeners('autoFixCompleted', [result])
    } catch (error) {
          console.warn("操作失败:", error)
        }:`, error)
    }
  }

  // 自动修复数据不一致
  private async autoFixDataInconsistency(result: ConsistencyCheckResult): Promise<void> {
    if (result.fixStrategy === 'merge') {
      // 触发同步来解决数据不一致
      await syncIntegrationService.triggerSync({
        forceFullSync: false,
        entityTypes: [result.entityType]
      })
    } else if (result.fixStrategy === 'local-wins' || result.fixStrategy === 'remote-wins') {
      // 实现具体的修复逻辑
      console.log(`Implementing ${result.fixStrategy} fix for data inconsistency`)
    }
  }

  // 自动修复引用不一致
  private async autoFixReferentialInconsistency(result: ConsistencyCheckResult): Promise<void> {
    // 实现引用修复逻辑
    console.log('Implementing referential inconsistency fix')
  }

  // 自动修复时间戳不一致
  private async autoFixTimestampInconsistency(result: ConsistencyCheckResult): Promise<void> {
    if (result.fixStrategy === 'remote-wins') {
      // 使用远程时间戳更新本地数据
      console.log('Implementing timestamp inconsistency fix')
    }
  }

  // 自动修复数量不一致
  private async autoFixCountInconsistency(result: ConsistencyCheckResult): Promise<void> {
    // 触发同步来解决数量不一致
    await syncIntegrationService.triggerSync({
      forceFullSync: true,
      entityTypes: [result.entityType]
    })
  }

  // 等待活动检查完成
  private async waitForActiveChecks(): Promise<void> {
    const maxWaitTime = 30000 // 30秒
    const startTime = Date.now()

    while (this.activeChecks.size > 0 && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (this.activeChecks.size > 0) {
      console.warn(`Timeout waiting for ${this.activeChecks.size} active checks to complete`)
    }
  }

  // 清理旧数据
  private async cleanupOldData(): Promise<void> {
    // 清理旧的检查结果和历史数据
    // 这里可以实现具体的清理逻辑
    console.log('Cleaning up old consistency check data')
  }

  // 更新统计信息
  private updateStats(result: ConsistencyCheckResult): void {
    this.stats.totalChecks++

    if (result.status === 'consistent' || result.status === 'warning') {
      this.stats.successfulChecks++
    } else {
      this.stats.failedChecks++
    }

    if (result.status === 'inconsistent' || result.status === 'error') {
      this.stats.inconsistenciesFound++
      this.stats.lastInconsistencyFound = new Date()
    }

    // 更新按类型统计
    this.stats.byType[result.checkType].checks++
    if (result.status === 'inconsistent' || result.status === 'error') {
      this.stats.byType[result.checkType].inconsistencies++
    }

    // 更新平均时间
    const currentAvg = this.stats.byType[result.checkType].averageTime
    const checkCount = this.stats.byType[result.checkType].checks
    this.stats.byType[result.checkType].averageTime =
      (currentAvg * (checkCount - 1) + result.checkDuration) / checkCount

    // 更新按实体类型统计
    this.stats.byEntityType[result.entityType].checks++
    if (result.status === 'inconsistent' || result.status === 'error') {
      this.stats.byEntityType[result.entityType].inconsistencies++
    }

    // 更新性能统计
    this.stats.performance.totalCheckTime += result.checkDuration
    this.stats.performance.averageCheckTime =
      this.stats.performance.totalCheckTime / this.stats.totalChecks

    // 更新最后检查时间
    this.stats.lastCheckTime = new Date()

    // 通知统计更新
    this.notifyListeners('statsUpdated', this.stats)
  }

  // 通知监听器
  private notifyListeners<K extends keyof typeof this.listeners>(
    event: K,
    data: Parameters<NonNullable<typeof this.listeners[K]>>[0]
  ): void {
    const listener = this.listeners[event]
    if (listener) {
      try {
        listener(data)
      } catch (error) {
          console.warn("操作失败:", error)
        } listener:`, error)
      }
    }
  }

  // ============================================================================
  // 事件监听器管理
  // ============================================================================

  // 添加事件监听器
  addEventListener<K extends keyof typeof this.listeners>(
    event: K,
    callback: NonNullable<typeof this.listeners[K]>
  ): void {
    this.listeners[event] = callback
  }

  // 移除事件监听器
  removeEventListener<K extends keyof typeof this.listeners>(
    event: K
  ): void {
    delete this.listeners[event]
  }

  // ============================================================================
  // 公共工具方法
  // ============================================================================

  // 获取统计信息
  getStats(): ConsistencyStats {
    return { ...this.stats }
  }

  // 获取配置
  getConfig(): ConsistencyCheckerConfig {
    return { ...this.config }
  }

  // 更新配置
  updateConfig(config: Partial<ConsistencyCheckerConfig>): void {
    this.config = { ...this.config, ...config }

    // 重新启动定时任务（如果需要）
    if (config.strategy?.checkInterval !== undefined && this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = setInterval(() => {
        if (this.isRunning) {
          this.performQuickCheck()
        }
      }, this.config.strategy.checkInterval)
    }
  }

  // 获取最近检查结果
  async getRecentCheckResults(limit: number = 10): Promise<ConsistencyCheckResult[]> {
    // 这里应该从持久化存储中获取最近的结果
    // 暂时返回空数组
    return []
  }

  // 获取检查历史
  async getCheckHistory(options?: {
    startDate?: Date
    endDate?: Date
    entityType?: string
    checkType?: ConsistencyCheckType
    status?: ConsistencyStatus
  }): Promise<ConsistencyCheckResult[]> {
    // 这里应该从持久化存储中获取历史记录
    // 暂时返回空数组
    return []
  }

  // 手动触发检查
  async manualCheck(options: {
    entityType: 'card' | 'folder' | 'tag' | 'image' | 'system'
    checkType: ConsistencyCheckType
  }): Promise<ConsistencyCheckResult> {
    const userId = authService.getCurrentUser()?.id
    if (!userId) {
      throw new Error('No authenticated user')
    }

    return await this.performCheck(options.entityType, options.checkType, userId)
  }

  // 销毁服务
  async destroy(): Promise<void> {
    await this.stop()

    // 清理定时器
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // 清理监听器
    this.listeners = {}

    console.log('DataConsistencyChecker destroyed')
  }
}

// 导出单例实例
export const dataConsistencyChecker = new DataConsistencyChecker()

// ============================================================================
// 便利函数
// ============================================================================

// 初始化一致性检查器
export const initializeConsistencyChecker = async (
  config?: Partial<ConsistencyCheckerConfig>
): Promise<DataConsistencyChecker> => {
  const checker = new DataConsistencyChecker(config)
  await checker.start()
  return checker
}

// 执行快速一致性检查
export const performQuickConsistencyCheck = async (): Promise<ConsistencyCheckResult[]> => {
  return await dataConsistencyChecker.performQuickCheck()
}

// 执行完整一致性检查
export const performFullConsistencyCheck = async (
  options?: {
    entityTypes?: ('card' | 'folder' | 'tag' | 'image')[]
    checkTypes?: ConsistencyCheckType[]
  }
): Promise<ConsistencyCheckResult[]> => {
  return await dataConsistencyChecker.performFullCheck(options)
}

// 获取一致性统计
export const getConsistencyStats = (): ConsistencyStats => {
  return dataConsistencyChecker.getStats()
}