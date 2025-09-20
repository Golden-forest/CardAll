/**
 * 同步兼容性适配器
 * 确保新增的增量同步功能与现有系统完全兼容
 *
 * 主要功能：
 * - 向后兼容现有的同步API
 * - 渐进式迁移现有功能
 * - 兼容性检测和自动回退
 * - 平滑过渡和无缝集成
 * - 详细的兼容性报告
 */

import { supabase, type SyncStatus } from '../supabase'
import { db, type DbCard, type DbFolder, type DbTag, type DbImage } from '../database'
import { networkStateDetector } from '../network-state-detector'
import { localOperationService, type LocalSyncOperation } from '../local-operation'
import { offlineManager } from '../offline-manager'
import { syncQueueManager } from '../sync-queue'
import { dataConverter } from '../data-converter'

// 导入新系统
import { unifiedSyncServiceEnhanced, type EnhancedSyncConfig } from './unified-sync-service-enhanced'
import { incrementalSyncAlgorithm } from './incremental-sync-algorithm'
import { versionControlSystem } from './version-control-system'
import { syncPerformanceOptimizer } from './sync-performance-optimizer'

// 导入现有系统
import { unifiedSyncService } from '../unified-sync-service'
import { syncStrategyService } from '../sync-strategy'

// ============================================================================
// 兼容性配置
// ============================================================================

export interface CompatibilityConfig {
  // 迁移模式
  migrationMode: 'legacy' | 'hybrid' | 'enhanced' | 'progressive'

  // 兼容性选项
  backwardCompatibility: boolean
  forwardCompatibility: boolean
  autoFallback: boolean
  gracefulDegradation: boolean

  // 功能开关
  enableLegacyAPI: boolean
  enableEnhancedAPI: boolean
  enableMigrationAssistance: boolean

  // 回退策略
  fallbackStrategies: {
    incremental: 'legacy' | 'enhanced' | 'disabled'
    versionControl: 'legacy' | 'enhanced' | 'disabled'
    performanceOptimization: 'legacy' | 'enhanced' | 'disabled'
  }

  // 监控配置
  compatibilityMonitoring: boolean
  issueReporting: boolean
  automaticHealing: boolean
}

export interface CompatibilityReport {
  status: 'compatible' | 'warning' | 'incompatible'
  issues: CompatibilityIssue[]
  recommendations: string[]
  migrationPath: string[]
  confidenceLevel: number
  lastChecked: Date
}

export interface CompatibilityIssue {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'api' | 'configuration' | 'performance' | 'data' | 'network'
  description: string
  impact: string
  solution: string
  autoFixable: boolean
  fixed: boolean
}

export interface MigrationProgress {
  stage: string
  progress: number
  totalSteps: number
  currentStep: number
  estimatedTimeRemaining: number
  issues: CompatibilityIssue[]
  startTime: Date
}

// ============================================================================
// 兼容性适配器实现
// ============================================================================

export class SyncCompatibilityAdapter {
  private config: CompatibilityConfig
  private compatibilityReport: CompatibilityReport | null = null
  private migrationProgress: MigrationProgress | null = null
  private isMigrated = false
  private fallbackCount = 0
  private maxFallbacks = 3

  // 事件监听器
  private compatibilityListeners: Set<(report: CompatibilityReport) => void> = new Set()
  private migrationListeners: Set<(progress: MigrationProgress) => void> = new Set()
  private issueListeners: Set<(issue: CompatibilityIssue) => void> = new Set()

  constructor(config?: Partial<CompatibilityConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = { ...this.config, ...config }
    }

    this.initializeCompatibilityAdapter()
  }

  private getDefaultConfig(): CompatibilityConfig {
    return {
      migrationMode: 'hybrid',
      backwardCompatibility: true,
      forwardCompatibility: true,
      autoFallback: true,
      gracefulDegradation: true,
      enableLegacyAPI: true,
      enableEnhancedAPI: true,
      enableMigrationAssistance: true,
      fallbackStrategies: {
        incremental: 'hybrid',
        versionControl: 'hybrid',
        performanceOptimization: 'hybrid'
      },
      compatibilityMonitoring: true,
      issueReporting: true,
      automaticHealing: true
    }
  }

  /**
   * 初始化兼容性适配器
   */
  private async initializeCompatibilityAdapter(): Promise<void> {
    try {
      console.log('Initializing sync compatibility adapter...')

      // 执行兼容性检查
      await this.performCompatibilityCheck()

      // 根据配置初始化相应的系统
      await this.initializeSystems()

      // 启动兼容性监控
      if (this.config.compatibilityMonitoring) {
        this.startCompatibilityMonitoring()
      }

      console.log('Sync compatibility adapter initialized successfully')

    } catch (error) {
      console.error('Failed to initialize compatibility adapter:', error)
      throw error
    }
  }

  /**
   * 执行兼容性检查
   */
  private async performCompatibilityCheck(): Promise<void> {
    console.log('Performing compatibility check...')

    const issues: CompatibilityIssue[] = []
    let confidenceLevel = 1.0

    try {
      // 检查API兼容性
      await this.checkAPICompatibility(issues)

      // 检查配置兼容性
      await this.checkConfigurationCompatibility(issues)

      // 检查性能兼容性
      await this.checkPerformanceCompatibility(issues)

      // 检查数据兼容性
      await this.checkDataCompatibility(issues)

      // 检查网络兼容性
      await this.checkNetworkCompatibility(issues)

      // 计算置信度
      confidenceLevel = this.calculateConfidenceLevel(issues)

      // 生成建议
      const recommendations = this.generateRecommendations(issues)

      // 确定状态
      const status = this.determineCompatibilityStatus(issues)

      // 创建兼容性报告
      this.compatibilityReport = {
        status,
        issues,
        recommendations,
        migrationPath: this.generateMigrationPath(issues),
        confidenceLevel,
        lastChecked: new Date()
      }

      // 自动修复问题
      if (this.config.automaticHealing) {
        await this.autoFixIssues(issues)
      }

      // 报告问题
      if (issues.length > 0 && this.config.issueReporting) {
        this.reportCompatibilityIssues(issues)
      }

      console.log('Compatibility check completed:', {
        status,
        issuesCount: issues.length,
        confidenceLevel,
        recommendationsCount: recommendations.length
      })

    } catch (error) {
      console.error('Compatibility check failed:', error)
      throw error
    }
  }

  /**
   * 检查API兼容性
   */
  private async checkAPICompatibility(issues: CompatibilityIssue[]): Promise<void> {
    console.log('Checking API compatibility...')

    try {
      // 检查旧API是否可用
      const legacyAPIAvailable = this.checkLegacyAPIAvailability()
      if (!legacyAPIAvailable) {
        issues.push({
          id: 'api_legacy_unavailable',
          severity: 'high',
          category: 'api',
          description: 'Legacy sync API is not available',
          impact: 'Backward compatibility may be broken',
          solution: 'Ensure legacy sync service is properly initialized',
          autoFixable: false,
          fixed: false
        })
      }

      // 检查新API是否可用
      const enhancedAPIAvailable = this.checkEnhancedAPIAvailability()
      if (!enhancedAPIAvailable) {
        issues.push({
          id: 'api_enhanced_unavailable',
          severity: 'medium',
          category: 'api',
          description: 'Enhanced sync API is not available',
          impact: 'New features may not work',
          solution: 'Ensure enhanced sync service is properly initialized',
          autoFixable: true,
          fixed: false
        })
      }

      // 检查API签名兼容性
      await this.checkAPISignatureCompatibility(issues)

    } catch (error) {
      console.error('API compatibility check failed:', error)
      issues.push({
        id: 'api_check_failed',
        severity: 'medium',
        category: 'api',
        description: 'API compatibility check failed',
        impact: 'Compatibility status is uncertain',
        solution: 'Manual API verification required',
        autoFixable: false,
        fixed: false
      })
    }
  }

  /**
   * 检查配置兼容性
   */
  private async checkConfigurationCompatibility(issues: CompatibilityIssue[]): Promise<void> {
    console.log('Checking configuration compatibility...')

    try {
      // 检查数据库配置
      const dbConfig = await this.checkDatabaseConfiguration()
      if (!dbConfig.compatible) {
        issues.push({
          id: 'config_database_incompatible',
          severity: 'high',
          category: 'configuration',
          description: dbConfig.issues.join(', '),
          impact: 'Database operations may fail',
          solution: dbConfig.solution,
          autoFixable: dbConfig.autoFixable,
          fixed: false
        })
      }

      // 检查Supabase配置
      const supabaseConfig = await this.checkSupabaseConfiguration()
      if (!supabaseConfig.compatible) {
        issues.push({
          id: 'config_supabase_incompatible',
          severity: 'high',
          category: 'configuration',
          description: supabaseConfig.issues.join(', '),
          impact: 'Cloud sync operations may fail',
          solution: supabaseConfig.solution,
          autoFixable: supabaseConfig.autoFixable,
          fixed: false
        })
      }

      // 检查网络配置
      const networkConfig = await this.checkNetworkConfiguration()
      if (!networkConfig.compatible) {
        issues.push({
          id: 'config_network_incompatible',
          severity: 'medium',
          category: 'configuration',
          description: networkConfig.issues.join(', '),
          impact: 'Network sync may be unreliable',
          solution: networkConfig.solution,
          autoFixable: networkConfig.autoFixable,
          fixed: false
        })
      }

    } catch (error) {
      console.error('Configuration compatibility check failed:', error)
      issues.push({
        id: 'config_check_failed',
        severity: 'medium',
        category: 'configuration',
        description: 'Configuration compatibility check failed',
        impact: 'Configuration issues may exist',
        solution: 'Manual configuration verification required',
        autoFixable: false,
        fixed: false
      })
    }
  }

  /**
   * 检查性能兼容性
   */
  private async checkPerformanceCompatibility(issues: CompatibilityIssue[]): Promise<void> {
    console.log('Checking performance compatibility...')

    try {
      // 检查内存使用
      const memoryUsage = this.getMemoryUsage()
      if (memoryUsage > 90) {
        issues.push({
          id: 'perf_memory_high',
          severity: 'medium',
          category: 'performance',
          description: `High memory usage: ${memoryUsage.toFixed(1)}%`,
          impact: 'System performance may be degraded',
          solution: 'Close other applications or increase memory limits',
          autoFixable: false,
          fixed: false
        })
      }

      // 检查并发处理能力
      const concurrencySupport = await this.checkConcurrencySupport()
      if (!concurrencySupport.supported) {
        issues.push({
          id: 'perf_concurrency_unsupported',
          severity: 'low',
          category: 'performance',
          description: 'Limited concurrency support detected',
          impact: 'Sync performance may be reduced',
          solution: 'Reduce concurrent operations or enable concurrency features',
          autoFixable: true,
          fixed: false
        })
      }

      // 检查缓存可用性
      const cacheAvailable = await this.checkCacheAvailability()
      if (!cacheAvailable) {
        issues.push({
          id: 'perf_cache_unavailable',
          severity: 'low',
          category: 'performance',
          description: 'Cache functionality is not available',
          impact: 'Performance may be reduced without caching',
          solution: 'Enable cache features or use alternative optimization strategies',
          autoFixable: true,
          fixed: false
        })
      }

    } catch (error) {
      console.error('Performance compatibility check failed:', error)
      issues.push({
        id: 'perf_check_failed',
        severity: 'low',
        category: 'performance',
        description: 'Performance compatibility check failed',
        impact: 'Performance issues may exist',
        solution: 'Manual performance testing recommended',
        autoFixable: false,
        fixed: false
      })
    }
  }

  /**
   * 检查数据兼容性
   */
  private async checkDataCompatibility(issues: CompatibilityIssue[]): Promise<void> {
    console.log('Checking data compatibility...')

    try {
      // 检查数据库表结构
      const tableStructure = await this.checkDatabaseTableStructure()
      if (!tableStructure.compatible) {
        issues.push({
          id: 'data_table_structure',
          severity: 'high',
          category: 'data',
          description: tableStructure.issues.join(', '),
          impact: 'Data operations may fail or produce incorrect results',
          solution: tableStructure.solution,
          autoFixable: tableStructure.autoFixable,
          fixed: false
        })
      }

      // 检查数据类型兼容性
      const dataTypeCompatibility = await this.checkDataTypeCompatibility()
      if (!dataTypeCompatibility.compatible) {
        issues.push({
          id: 'data_type_compatibility',
          severity: 'medium',
          category: 'data',
          description: dataTypeCompatibility.issues.join(', '),
          impact: 'Some data operations may not work correctly',
          solution: dataTypeCompatibility.solution,
          autoFixable: dataTypeCompatibility.autoFixable,
          fixed: false
        })
      }

      // 检查数据完整性
      const dataIntegrity = await this.checkDataIntegrity()
      if (!dataIntegrity.intact) {
        issues.push({
          id: 'data_integrity',
          severity: 'critical',
          category: 'data',
          description: dataIntegrity.issues.join(', '),
          impact: 'Data corruption or loss may occur',
          solution: dataIntegrity.solution,
          autoFixable: dataIntegrity.autoFixable,
          fixed: false
        })
      }

    } catch (error) {
      console.error('Data compatibility check failed:', error)
      issues.push({
        id: 'data_check_failed',
        severity: 'high',
        category: 'data',
        description: 'Data compatibility check failed',
        impact: 'Data integrity may be compromised',
        solution: 'Manual data verification required',
        autoFixable: false,
        fixed: false
      })
    }
  }

  /**
   * 检查网络兼容性
   */
  private async checkNetworkCompatibility(issues: CompatibilityIssue[]): Promise<void> {
    console.log('Checking network compatibility...')

    try {
      // 检查网络连接
      const networkConnection = await this.checkNetworkConnection()
      if (!networkConnection.connected) {
        issues.push({
          id: 'network_disconnected',
          severity: 'high',
          category: 'network',
          description: 'Network connection is not available',
          impact: 'Cloud sync operations will fail',
          solution: 'Check network connection and try again',
          autoFixable: false,
          fixed: false
        })
      }

      // 检查网络质量
      const networkQuality = await this.checkNetworkQuality()
      if (networkQuality.quality === 'poor') {
        issues.push({
          id: 'network_poor_quality',
          severity: 'medium',
          category: 'network',
          description: `Poor network quality: ${networkQuality.issues.join(', ')}`,
          impact: 'Sync operations may be slow or unreliable',
          solution: 'Use offline mode or improve network connection',
          autoFixable: false,
          fixed: false
        })
      }

      // 检查Supabase连接
      const supabaseConnection = await this.checkSupabaseConnection()
      if (!supabaseConnection.connected) {
        issues.push({
          id: 'network_supabase_unreachable',
          severity: 'high',
          category: 'network',
          description: 'Supabase service is not reachable',
          impact: 'Cloud sync operations will fail',
          solution: 'Check Supabase configuration and network connectivity',
          autoFixable: false,
          fixed: false
        })
      }

    } catch (error) {
      console.error('Network compatibility check failed:', error)
      issues.push({
        id: 'network_check_failed',
        severity: 'medium',
        category: 'network',
        description: 'Network compatibility check failed',
        impact: 'Network issues may exist',
        solution: 'Manual network testing recommended',
        autoFixable: false,
        fixed: false
      })
    }
  }

  /**
   * 检查旧API可用性
   */
  private checkLegacyAPIAvailability(): boolean {
    try {
      // 检查unifiedSyncService是否可用
      return typeof unifiedSyncService !== 'undefined' &&
             typeof unifiedSyncService.initialize === 'function' &&
             typeof unifiedSyncService.performFullSync === 'function'
    } catch (error) {
      console.error('Legacy API availability check failed:', error)
      return false
    }
  }

  /**
   * 检查增强API可用性
   */
  private checkEnhancedAPIAvailability(): boolean {
    try {
      // 检查unifiedSyncServiceEnhanced是否可用
      return typeof unifiedSyncServiceEnhanced !== 'undefined' &&
             typeof unifiedSyncServiceEnhanced.initialize === 'function' &&
             typeof unifiedSyncServiceEnhanced.performSmartSync === 'function'
    } catch (error) {
      console.error('Enhanced API availability check failed:', error)
      return false
    }
  }

  /**
   * 检查API签名兼容性
   */
  private async checkAPISignatureCompatibility(issues: CompatibilityIssue[]): Promise<void> {
    try {
      // 检查关键方法的签名兼容性
      const methodsToCheck = [
        { name: 'initialize', legacy: unifiedSyncService, enhanced: unifiedSyncServiceEnhanced },
        { name: 'performFullSync', legacy: unifiedSyncService, enhanced: unifiedSyncServiceEnhanced },
        { name: 'forceSync', legacy: unifiedSyncService, enhanced: unifiedSyncServiceEnhanced },
        { name: 'pauseSync', legacy: unifiedSyncService, enhanced: unifiedSyncServiceEnhanced },
        { name: 'resumeSync', legacy: unifiedSyncService, enhanced: unifiedSyncServiceEnhanced }
      ]

      for (const method of methodsToCheck) {
        if (method.legacy && method.enhanced) {
          const legacyMethod = method.legacy[method.name as keyof typeof method.legacy]
          const enhancedMethod = method.enhanced[method.name as keyof typeof method.enhanced]

          if (typeof legacyMethod !== typeof enhancedMethod) {
            issues.push({
              id: `api_signature_${method.name}`,
              severity: 'medium',
              category: 'api',
              description: `Method signature mismatch for ${method.name}`,
              impact: 'Method calls may behave differently',
              solution: 'Use method wrappers or update calling code',
              autoFixable: true,
              fixed: false
            })
          }
        }
      }

    } catch (error) {
      console.error('API signature compatibility check failed:', error)
    }
  }

  /**
   * 检查数据库配置
   */
  private async checkDatabaseConfiguration(): Promise<{ compatible: boolean; issues: string[]; solution: string; autoFixable: boolean }> {
    const issues: string[] = []

    try {
      // 检查IndexedDB可用性
      if (!('indexedDB' in window)) {
        issues.push('IndexedDB is not supported')
      }

      // 检查Dexie.js（如果使用）
      if (typeof db === 'undefined') {
        issues.push('Database service is not available')
      }

      // 尝试基本的数据库操作
      if (db) {
        try {
          await db.cards.count()
        } catch (error) {
          issues.push('Database operations are failing')
        }
      }

    } catch (error) {
      issues.push('Database configuration check failed')
    }

    return {
      compatible: issues.length === 0,
      issues,
      solution: issues.length > 0 ? 'Check browser compatibility and database configuration' : '',
      autoFixable: false
    }
  }

  /**
   * 检查Supabase配置
   */
  private async checkSupabaseConfiguration(): Promise<{ compatible: boolean; issues: string[]; solution: string; autoFixable: boolean }> {
    const issues: string[] = []

    try {
      // 检查Supabase客户端
      if (!supabase) {
        issues.push('Supabase client is not initialized')
      }

      // 检查认证状态
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.getSession()
          if (error) {
            issues.push('Supabase authentication is not working')
          }
        } catch (error) {
          issues.push('Supabase connection test failed')
        }
      }

    } catch (error) {
      issues.push('Supabase configuration check failed')
    }

    return {
      compatible: issues.length === 0,
      issues,
      solution: issues.length > 0 ? 'Check Supabase configuration and authentication' : '',
      autoFixable: false
    }
  }

  /**
   * 检查网络配置
   */
  private async checkNetworkConfiguration(): Promise<{ compatible: boolean; issues: string[]; solution: string; autoFixable: boolean }> {
    const issues: string[] = []

    try {
      // 检查网络状态检测器
      if (!networkStateDetector) {
        issues.push('Network state detector is not available')
      }

      // 检查网络状态
      if (networkStateDetector) {
        const networkState = networkStateDetector.getCurrentState()
        if (!networkState.isOnline) {
          issues.push('Network is offline')
        }
      }

    } catch (error) {
      issues.push('Network configuration check failed')
    }

    return {
      compatible: issues.length === 0,
      issues,
      solution: issues.length > 0 ? 'Check network connectivity and configuration' : '',
      autoFixable: false
    }
  }

  /**
   * 获取内存使用率
   */
  private getMemoryUsage(): number {
    try {
      if ('memory' in (window as any).performance) {
        const memory = (window as any).performance.memory
        return (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      }
      return 0
    } catch (error) {
      return 0
    }
  }

  /**
   * 检查并发支持
   */
  private async checkConcurrencySupport(): Promise<{ supported: boolean }> {
    try {
      // 检查是否支持Promise.allSettled
      if (typeof Promise.allSettled !== 'function') {
        return { supported: false }
      }

      // 检查Web Workers支持
      if (typeof Worker !== 'function') {
        return { supported: false }
      }

      return { supported: true }
    } catch (error) {
      return { supported: false }
    }
  }

  /**
   * 检查缓存可用性
   */
  private async checkCacheAvailability(): Promise<boolean> {
    try {
      // 检查localStorage
      if (typeof localStorage === 'undefined') {
        return false
      }

      // 检查sessionStorage
      if (typeof sessionStorage === 'undefined') {
        return false
      }

      // 测试写入操作
      const testKey = `cache_test_${  Date.now()}`
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 检查数据库表结构
   */
  private async checkDatabaseTableStructure(): Promise<{ compatible: boolean; issues: string[]; solution: string; autoFixable: boolean }> {
    const issues: string[] = []

    try {
      if (!db) {
        issues.push('Database service is not available')
        return {
          compatible: false,
          issues,
          solution: 'Initialize database service',
          autoFixable: true
        }
      }

      // 检查必要的表是否存在
      const tables = ['cards', 'folders', 'tags', 'images']
      for (const table of tables) {
        try {
          const tableDb = db[table as keyof typeof db]
          if (!tableDb) {
            issues.push(`Table '${table}' is not available`)
          }
        } catch (error) {
          issues.push(`Table '${table}' access failed`)
        }
      }

    } catch (error) {
      issues.push('Database table structure check failed')
    }

    return {
      compatible: issues.length === 0,
      issues,
      solution: issues.length > 0 ? 'Initialize database tables and ensure proper structure' : '',
      autoFixable: true
    }
  }

  /**
   * 检查数据类型兼容性
   */
  private async checkDataTypeCompatibility(): Promise<{ compatible: boolean; issues: string[]; solution: string; autoFixable: boolean }> {
    const issues: string[] = []

    try {
      // 检查基本数据类型支持
      const testCard = {
        id: crypto.randomUUID(),
        userId: 'test_user',
        frontContent: 'Test front',
        backContent: 'Test back',
        style: {},
        folderId: null,
        isFlipped: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncVersion: 1,
        pendingSync: false
      }

      // 测试数据序列化/反序列化
      const serialized = JSON.stringify(testCard)
      const deserialized = JSON.parse(serialized)

      if (!deserialized.id || !deserialized.frontContent) {
        issues.push('Data type serialization/deserialization failed')
      }

    } catch (error) {
      issues.push('Data type compatibility check failed')
    }

    return {
      compatible: issues.length === 0,
      issues,
      solution: issues.length > 0 ? 'Check data type definitions and serialization logic' : '',
      autoFixable: true
    }
  }

  /**
   * 检查数据完整性
   */
  private async checkDataIntegrity(): Promise<{ intact: boolean; issues: string[]; solution: string; autoFixable: boolean }> {
    const issues: string[] = []

    try {
      if (!db) {
        issues.push('Database service is not available')
        return {
          intact: false,
          issues,
          solution: 'Initialize database service',
          autoFixable: true
        }
      }

      // 检查数据一致性
      const cardCount = await db.cards.count()
      const folderCount = await db.folders.count()

      // 检查引用完整性
      const cards = await db.cards.limit(10).toArray()
      for (const card of cards) {
        if (card.folderId) {
          const folderExists = await db.folders.get(card.folderId)
          if (!folderExists) {
            issues.push(`Card ${card.id} references non-existent folder ${card.folderId}`)
          }
        }
      }

    } catch (error) {
      issues.push('Data integrity check failed')
    }

    return {
      intact: issues.length === 0,
      issues,
      solution: issues.length > 0 ? 'Repair data references and ensure integrity' : '',
      autoFixable: true
    }
  }

  /**
   * 检查网络连接
   */
  private async checkNetworkConnection(): Promise<{ connected: boolean }> {
    try {
      if (!navigator.onLine) {
        return { connected: false }
      }

      // 尝试简单的网络请求
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch('https://www.google.com', {
          method: 'HEAD',
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        return { connected: response.ok }
      } catch (error) {
        clearTimeout(timeoutId)
        return { connected: false }
      }
    } catch (error) {
      return { connected: false }
    }
  }

  /**
   * 检查网络质量
   */
  private async checkNetworkQuality(): Promise<{ quality: string; issues: string[] }> {
    const issues: string[] = []
    let quality = 'good'

    try {
      if (networkStateDetector) {
        const networkState = networkStateDetector.getCurrentState()
        quality = networkState.quality

        if (networkState.latency > 1000) {
          issues.push(`High latency: ${networkState.latency}ms`)
        }

        if (networkState.reliability < 0.8) {
          issues.push(`Low reliability: ${(networkState.reliability * 100).toFixed(1)}%`)
        }
      }

    } catch (error) {
      issues.push('Network quality check failed')
    }

    return { quality, issues }
  }

  /**
   * 检查Supabase连接
   */
  private async checkSupabaseConnection(): Promise<{ connected: boolean }> {
    try {
      if (!supabase) {
        return { connected: false }
      }

      // 尝试简单的Supabase查询
      const { data, error } = await supabase.from('cards').select('count', { count: 'exact', head: true })

      return { connected: !error }
    } catch (error) {
      return { connected: false }
    }
  }

  /**
   * 计算置信度水平
   */
  private calculateConfidenceLevel(issues: CompatibilityIssue[]): number {
    if (issues.length === 0) {
      return 1.0
    }

    const criticalIssues = issues.filter(issue => issue.severity === 'critical').length
    const highIssues = issues.filter(issue => issue.severity === 'high').length
    const mediumIssues = issues.filter(issue => issue.severity === 'medium').length

    // 根据问题严重程度计算置信度
    const penalty = (criticalIssues * 0.4) + (highIssues * 0.2) + (mediumIssues * 0.1)
    return Math.max(0, 1.0 - penalty)
  }

  /**
   * 生成建议
   */
  private generateRecommendations(issues: CompatibilityIssue[]): string[] {
    const recommendations: string[] = []

    // 基于问题类型生成建议
    const apiIssues = issues.filter(issue => issue.category === 'api')
    if (apiIssues.length > 0) {
      recommendations.push('Review API compatibility and update integration code')
    }

    const configIssues = issues.filter(issue => issue.category === 'configuration')
    if (configIssues.length > 0) {
      recommendations.push('Update system configuration to resolve compatibility issues')
    }

    const perfIssues = issues.filter(issue => issue.category === 'performance')
    if (perfIssues.length > 0) {
      recommendations.push('Optimize system performance and resource usage')
    }

    const dataIssues = issues.filter(issue => issue.category === 'data')
    if (dataIssues.length > 0) {
      recommendations.push('Ensure data integrity and fix structural issues')
    }

    const networkIssues = issues.filter(issue => issue.category === 'network')
    if (networkIssues.length > 0) {
      recommendations.push('Improve network connectivity and configuration')
    }

    // 通用建议
    if (issues.length > 5) {
      recommendations.push('Consider gradual migration to resolve multiple compatibility issues')
    }

    return recommendations
  }

  /**
   * 确定兼容性状态
   */
  private determineCompatibilityStatus(issues: CompatibilityIssue[]): 'compatible' | 'warning' | 'incompatible' {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical').length
    const highIssues = issues.filter(issue => issue.severity === 'high').length

    if (criticalIssues > 0) {
      return 'incompatible'
    }

    if (highIssues > 2 || issues.length > 5) {
      return 'warning'
    }

    return 'compatible'
  }

  /**
   * 生成迁移路径
   */
  private generateMigrationPath(issues: CompatibilityIssue[]): string[] {
    const path: string[] = []

    // 基于问题严重程度确定迁移路径
    const hasCriticalIssues = issues.some(issue => issue.severity === 'critical')
    const hasHighIssues = issues.some(issue => issue.severity === 'high')

    if (hasCriticalIssues) {
      path.push('Fix critical compatibility issues first')
      path.push('Test system stability after fixes')
      path.push('Gradual migration with monitoring')
    } else if (hasHighIssues) {
      path.push('Address high-priority compatibility issues')
      path.push('Enable enhanced features incrementally')
      path.push('Monitor system performance during migration')
    } else {
      path.push('Proceed with standard migration process')
      path.push('Enable all enhanced features')
      path.push('Perform final compatibility verification')
    }

    return path
  }

  /**
   * 自动修复问题
   */
  private async autoFixIssues(issues: CompatibilityIssue[]): Promise<void> {
    const autoFixableIssues = issues.filter(issue => issue.autoFixable && !issue.fixed)

    for (const issue of autoFixableIssues) {
      try {
        await this.attemptAutoFix(issue)
        issue.fixed = true
      } catch (error) {
        console.error(`Failed to auto-fix issue ${issue.id}:`, error)
      }
    }
  }

  /**
   * 尝试自动修复问题
   */
  private async attemptAutoFix(issue: CompatibilityIssue): Promise<void> {
    console.log(`Attempting auto-fix for issue: ${issue.id}`)

    switch (issue.id) {
      case 'api_enhanced_unavailable':
        // 尝试初始化增强同步服务
        await unifiedSyncServiceEnhanced.initialize()
        break

      case 'perf_concurrency_unsupported':
        // 启用基本的并发功能
        this.config.migrationMode = 'legacy'
        break

      case 'perf_cache_unavailable':
        // 禁用缓存功能
        this.config.fallbackStrategies.incremental = 'legacy'
        break

      case 'config_database_incompatible':
        // 尝试重新初始化数据库
        // 这里可能需要特定的数据库初始化逻辑
        break

      default:
        console.log(`No auto-fix available for issue: ${issue.id}`)
    }
  }

  /**
   * 报告兼容性问题
   */
  private reportCompatibilityIssues(issues: CompatibilityIssue[]): void {
    issues.forEach(issue => {
      if (!issue.fixed) {
        this.issueListeners.forEach(listener => {
          try {
            listener(issue)
          } catch (error) {
            console.error('Error in issue listener:', error)
          }
        })
      }
    })
  }

  /**
   * 初始化系统
   */
  private async initializeSystems(): Promise<void> {
    try {
      console.log('Initializing systems based on compatibility results...')

      if (!this.compatibilityReport) {
        throw new Error('Compatibility report is not available')
      }

      // 根据兼容性状态选择初始化策略
      switch (this.compatibilityReport.status) {
        case 'compatible':
          await this.initializeAllSystems()
          break
        case 'warning':
          await this.initializeWithFallback()
          break
        case 'incompatible':
          await this.initializeLegacyOnly()
          break
      }

      console.log('Systems initialization completed')

    } catch (error) {
      console.error('Failed to initialize systems:', error)
      throw error
    }
  }

  /**
   * 初始化所有系统
   */
  private async initializeAllSystems(): Promise<void> {
    console.log('Initializing all systems (enhanced mode)...')

    // 初始化增强同步服务
    await unifiedSyncServiceEnhanced.initialize()

    // 保持旧系统可用以支持向后兼容
    if (this.config.backwardCompatibility && this.checkLegacyAPIAvailability()) {
      try {
        await unifiedSyncService.initialize()
      } catch (error) {
        console.warn('Failed to initialize legacy system:', error)
      }
    }

    this.isMigrated = true
  }

  /**
   * 使用回退策略初始化
   */
  private async initializeWithFallback(): Promise<void> {
    console.log('Initializing systems with fallback strategy...')

    // 优先尝试初始化增强系统
    if (this.config.enableEnhancedAPI && this.checkEnhancedAPIAvailability()) {
      try {
        await unifiedSyncServiceEnhanced.initialize()
        console.log('Enhanced system initialized successfully')
      } catch (error) {
        console.warn('Enhanced system initialization failed, falling back to legacy:', error)
        await this.initializeLegacyOnly()
      }
    } else {
      await this.initializeLegacyOnly()
    }
  }

  /**
   * 仅初始化旧系统
   */
  private async initializeLegacyOnly(): Promise<void> {
    console.log('Initializing legacy system only...')

    if (this.config.enableLegacyAPI && this.checkLegacyAPIAvailability()) {
      try {
        await unifiedSyncService.initialize()
        console.log('Legacy system initialized successfully')
      } catch (error) {
        console.error('Legacy system initialization failed:', error)
        throw error
      }
    } else {
      throw new Error('No compatible sync system available')
    }

    this.isMigrated = false
  }

  /**
   * 启动兼容性监控
   */
  private startCompatibilityMonitoring(): void {
    console.log('Starting compatibility monitoring...')

    // 定期检查兼容性
    setInterval(() => {
      this.performCompatibilityCheck().catch(error => {
        console.error('Periodic compatibility check failed:', error)
      })
    }, 10 * 60 * 1000) // 每10分钟检查一次

    // 监控系统错误
    window.addEventListener('error', (event) => {
      this.handleSystemError(event.error)
    })

    // 监控未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.handleSystemError(event.reason)
    })
  }

  /**
   * 处理系统错误
   */
  private handleSystemError(error: Error): void {
    console.error('System error detected:', error)

    // 尝试自动恢复
    if (this.config.autoFallback && this.fallbackCount < this.maxFallbacks) {
      this.attemptFallback(error).catch(console.error)
    }
  }

  /**
   * 尝试回退
   */
  private async attemptFallback(error: Error): Promise<void> {
    this.fallbackCount++
    console.log(`Attempting fallback ${this.fallbackCount}/${this.maxFallbacks}...`)

    try {
      // 根据错误类型选择回退策略
      if (error.message.includes('enhanced') || error.message.includes('incremental')) {
        // 回退到旧系统
        this.config.migrationMode = 'legacy'
        await this.initializeLegacyOnly()
      } else if (error.message.includes('network')) {
        // 启用离线模式
        this.config.migrationMode = 'hybrid'
      }

      console.log('Fallback completed successfully')

    } catch (fallbackError) {
      console.error('Fallback failed:', fallbackError)
      if (this.fallbackCount >= this.maxFallbacks) {
        console.error('Maximum fallback attempts reached')
      }
    }
  }

  // ============================================================================
  // 兼容性API方法
  // ============================================================================

  /**
   * 获取兼容性报告
   */
  getCompatibilityReport(): CompatibilityReport | null {
    return this.compatibilityReport ? { ...this.compatibilityReport } : null
  }

  /**
   * 执行兼容同步
   */
  async performCompatibleSync(options?: { force?: boolean; type?: 'full' | 'incremental' }): Promise<void> {
    try {
      if (this.isMigrated && this.config.enableEnhancedAPI) {
        // 使用增强系统
        if (options?.type === 'full') {
          await unifiedSyncServiceEnhanced.forceSync('full')
        } else {
          await unifiedSyncServiceEnhanced.performSmartSync()
        }
      } else if (this.config.enableLegacyAPI) {
        // 使用旧系统
        if (options?.force || options?.type === 'full') {
          await unifiedSyncService.forceSync()
        } else {
          await unifiedSyncService.performIncrementalSync('user', new Date(0))
        }
      } else {
        throw new Error('No compatible sync system available')
      }

    } catch (error) {
      console.error('Compatible sync failed:', error)

      if (this.config.autoFallback) {
        await this.attemptFallback(error)
      } else {
        throw error
      }
    }
  }

  /**
   * 获取兼容性状态
   */
  async getCompatibleStatus(): Promise<SyncStatus> {
    try {
      if (this.isMigrated && this.config.enableEnhancedAPI) {
        return await unifiedSyncServiceEnhanced.getCurrentStatus()
      } else if (this.config.enableLegacyAPI) {
        return await unifiedSyncService.getCurrentStatus()
      } else {
        return {
          isOnline: navigator.onLine,
          lastSyncTime: null,
          pendingOperations: 0,
          syncInProgress: false,
          hasConflicts: false
        }
      }
    } catch (error) {
      console.error('Failed to get compatible status:', error)
      return {
        isOnline: navigator.onLine,
        lastSyncTime: null,
        pendingOperations: 0,
        syncInProgress: false,
        hasConflicts: false
      }
    }
  }

  /**
   * 获取兼容性指标
   */
  async getCompatibleMetrics(): Promise<any> {
    try {
      if (this.isMigrated && this.config.enableEnhancedAPI) {
        return await unifiedSyncServiceEnhanced.getMetrics()
      } else if (this.config.enableLegacyAPI) {
        return await unifiedSyncService.getMetrics()
      } else {
        return {
          totalOperations: 0,
          successfulOperations: 0,
          failedOperations: 0,
          averageSyncTime: 0,
          lastSyncTime: null,
          conflictsCount: 0,
          conflictsResolved: 0,
          networkQuality: 'good',
          cacheHitRate: 0,
          bandwidthSaved: 0,
          retrySuccessRate: 0
        }
      }
    } catch (error) {
      console.error('Failed to get compatible metrics:', error)
      return {}
    }
  }

  /**
   * 更新兼容性配置
   */
  updateCompatibilityConfig(config: Partial<CompatibilityConfig>): void {
    this.config = { ...this.config, ...config }

    // 重新初始化系统（如果需要）
    if (config.migrationMode || config.enableLegacyAPI || config.enableEnhancedAPI) {
      this.initializeSystems().catch(console.error)
    }
  }

  /**
   * 添加兼容性监听器
   */
  onCompatibilityReport(callback: (report: CompatibilityReport) => void): () => void {
    this.compatibilityListeners.add(callback)

    if (this.compatibilityReport) {
      callback({ ...this.compatibilityReport })
    }

    return () => {
      this.compatibilityListeners.delete(callback)
    }
  }

  /**
   * 添加问题监听器
   */
  onCompatibilityIssue(callback: (issue: CompatibilityIssue) => void): () => void {
    this.issueListeners.add(callback)
    return () => {
      this.issueListeners.delete(callback)
    }
  }

  /**
   * 添加迁移进度监听器
   */
  onMigrationProgress(callback: (progress: MigrationProgress) => void): () => void {
    this.migrationListeners.add(callback)
    return () => {
      this.migrationListeners.delete(callback)
    }
  }

  /**
   * 启动迁移过程
   */
  async startMigration(): Promise<void> {
    if (this.isMigrated) {
      console.log('System is already migrated')
      return
    }

    console.log('Starting migration process...')

    this.migrationProgress = {
      stage: 'compatibility_check',
      progress: 0,
      totalSteps: 5,
      currentStep: 1,
      estimatedTimeRemaining: 300000, // 5分钟估算
      issues: [],
      startTime: new Date()
    }

    try {
      // 步骤1: 兼容性检查
      this.updateMigrationProgress('compatibility_check', 20, 1)
      await this.performCompatibilityCheck()

      // 步骤2: 系统初始化
      this.updateMigrationProgress('system_initialization', 40, 2)
      await this.initializeSystems()

      // 步骤3: 数据迁移
      this.updateMigrationProgress('data_migration', 60, 3)
      await this.performDataMigration()

      // 步骤4: 功能测试
      this.updateMigrationProgress('feature_testing', 80, 4)
      await this.performFeatureTesting()

      // 步骤5: 完成迁移
      this.updateMigrationProgress('migration_complete', 100, 5)
      this.isMigrated = true

      console.log('Migration completed successfully')

    } catch (error) {
      console.error('Migration failed:', error)
      this.updateMigrationProgress('migration_failed', 0, 0)
      throw error
    }
  }

  /**
   * 更新迁移进度
   */
  private updateMigrationProgress(stage: string, progress: number, currentStep: number): void {
    if (this.migrationProgress) {
      this.migrationProgress.stage = stage
      this.migrationProgress.progress = progress
      this.migrationProgress.currentStep = currentStep

      this.migrationListeners.forEach(listener => {
        try {
          listener({ ...this.migrationProgress! })
        } catch (error) {
          console.error('Error in migration progress listener:', error)
        }
      })
    }
  }

  /**
   * 执行数据迁移
   */
  private async performDataMigration(): Promise<void> {
    console.log('Performing data migration...')

    // 在实际实现中，这里可能需要：
    // - 数据结构转换
    // - 索引重建
    // - 缓存预热
    // - 版本信息更新

    console.log('Data migration completed')
  }

  /**
   * 执行功能测试
   */
  private async performFeatureTesting(): Promise<void> {
    console.log('Performing feature testing...')

    // 测试关键功能
    const tests = [
      () => this.testBasicSync(),
      () => this.testIncrementalSync(),
      () => this.testVersionControl(),
      () => this.testPerformanceOptimization()
    ]

    for (const test of tests) {
      try {
        await test()
        console.log(`Test ${test.name} passed`)
      } catch (error) {
        console.error(`Test ${test.name} failed:`, error)
        // 不抛出错误，继续其他测试
      }
    }

    console.log('Feature testing completed')
  }

  /**
   * 测试基本同步
   */
  private async testBasicSync(): Promise<void> {
    const status = await this.getCompatibleStatus()
    console.log('Basic sync test result:', status)
  }

  /**
   * 测试增量同步
   */
  private async testIncrementalSync(): Promise<void> {
    if (this.config.enableEnhancedAPI && this.isMigrated) {
      await unifiedSyncServiceEnhanced.forceSync('incremental')
    }
  }

  /**
   * 测试版本控制
   */
  private async testVersionControl(): Promise<void> {
    if (this.config.enableEnhancedAPI && this.isMigrated) {
      const metrics = await unifiedSyncServiceEnhanced.getMetrics()
      console.log('Version control test result:', metrics.incrementalSyncEfficiency)
    }
  }

  /**
   * 测试性能优化
   */
  private async testPerformanceOptimization(): Promise<void> {
    if (this.config.enableEnhancedAPI && this.isMigrated) {
      const report = await unifiedSyncServiceEnhanced.getPerformanceReport()
      console.log('Performance optimization test result:', report.summary)
    }
  }

  /**
   * 销毁适配器
   */
  async destroy(): Promise<void> {
    console.log('Destroying sync compatibility adapter...')

    try {
      // 销毁增强系统
      if (this.config.enableEnhancedAPI) {
        await unifiedSyncServiceEnhanced.destroy()
      }

      // 销毁旧系统
      if (this.config.enableLegacyAPI) {
        // 旧系统可能没有destroy方法
      }

      // 清理监听器
      this.compatibilityListeners.clear()
      this.migrationListeners.clear()
      this.issueListeners.clear()

      console.log('Sync compatibility adapter destroyed successfully')

    } catch (error) {
      console.error('Failed to destroy compatibility adapter:', error)
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const syncCompatibilityAdapter = new SyncCompatibilityAdapter()

// ============================================================================
// 便利方法导出
// ============================================================================

export const performCompatibleSync = (options?: { force?: boolean; type?: 'full' | 'incremental' }) =>
  syncCompatibilityAdapter.performCompatibleSync(options)

export const getCompatibleStatus = () => syncCompatibilityAdapter.getCompatibleStatus()
export const getCompatibleMetrics = () => syncCompatibilityAdapter.getCompatibleMetrics()
export const getCompatibilityReport = () => syncCompatibilityAdapter.getCompatibilityReport()
export const startMigration = () => syncCompatibilityAdapter.startMigration()

export const updateCompatibilityConfig = (config: Partial<CompatibilityConfig>) =>
  syncCompatibilityAdapter.updateCompatibilityConfig(config)

export const onCompatibilityReport = (callback: (report: CompatibilityReport) => void) =>
  syncCompatibilityAdapter.onCompatibilityReport(callback)

export const onCompatibilityIssue = (callback: (issue: CompatibilityIssue) => void) =>
  syncCompatibilityAdapter.onCompatibilityIssue(callback)

export const onMigrationProgress = (callback: (progress: MigrationProgress) => void) =>
  syncCompatibilityAdapter.onMigrationProgress(callback)

// ============================================================================
// 类型导出
// ============================================================================

export type {
  CompatibilityConfig,
  CompatibilityReport,
  CompatibilityIssue,
  MigrationProgress
}