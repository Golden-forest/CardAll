import { useState, useCallback, useEffect } from 'react'
import { Card, CardAction, CardFilter, ViewSettings } from '@/types/card'
import { DataConverterAdapter } from '@/services/data-converter-adapter'
import { UniversalStorageAdapter } from '@/services/universal-storage-adapter'

// 错误类型定义 - 细粒度分类
export enum CardErrorType {
  // 初始化错误
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',

  // 存储错误 - 细分为临时性和永久性
  STORAGE_QUOTA_ERROR = 'STORAGE_QUOTA_ERROR',          // 存储空间不足（永久）
  STORAGE_PERMISSION_ERROR = 'STORAGE_PERMISSION_ERROR', // 存储权限问题（永久）
  STORAGE_CORRUPTION_ERROR = 'STORAGE_CORRUPTION_ERROR', // 数据损坏（可恢复）
  STORAGE_TEMPORARY_ERROR = 'STORAGE_TEMPORARY_ERROR',   // 临时存储错误（可恢复）

  // 验证错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  VALIDATION_STRUCTURE_ERROR = 'VALIDATION_STRUCTURE_ERROR', // 结构验证失败
  VALIDATION_DATA_ERROR = 'VALIDATION_DATA_ERROR',           // 数据验证失败

  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_OFFLINE_ERROR = 'NETWORK_OFFLINE_ERROR',         // 离线状态（临时）
  NETWORK_TIMEOUT_ERROR = 'NETWORK_TIMEOUT_ERROR',         // 超时（临时）
  NETWORK_SERVER_ERROR = 'NETWORK_SERVER_ERROR',           // 服务器错误（临时）

  // 迁移错误
  MIGRATION_ERROR = 'MIGRATION_ERROR',
  MIGRATION_LEGACY_ERROR = 'MIGRATION_LEGACY_ERROR',       // 旧版本迁移失败
  MIGRATION_VERSION_ERROR = 'MIGRATION_VERSION_ERROR',     // 版本兼容性问题

  // 未知错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface CardError {
  type: CardErrorType
  message: string
  details?: any
  timestamp: Date
  recoverable: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'  // 错误严重程度
  userMessage?: string  // 用户友好的错误消息
  retryCount?: number   // 重试次数
  maxRetries?: number   // 最大重试次数
}

// 错误恢复策略
export interface ErrorRecoveryStrategy {
  canRecover: boolean
  recover: () => Promise<void>
  fallback?: () => void
  shouldUseMock?: boolean  // 是否在恢复失败时使用mock数据
  maxRetries?: number       // 最大重试次数
  retryDelay?: number      // 重试延迟（毫秒）
}

export class CardErrorHandler {
  private static instance: CardErrorHandler
  private errorListeners: ((error: CardError) => void)[] = []
  private recoveryStrategies: Map<CardErrorType, ErrorRecoveryStrategy> = new Map()

  static getInstance(): CardErrorHandler {
    if (!CardErrorHandler.instance) {
      CardErrorHandler.instance = new CardErrorHandler()
    }
    return CardErrorHandler.instance
  }

  // 注册错误监听器
  onError(callback: (error: CardError) => void): () => void {
    this.errorListeners.push(callback)
    return () => {
      const index = this.errorListeners.indexOf(callback)
      if (index > -1) {
        this.errorListeners.splice(index, 1)
      }
    }
  }

  // 注册恢复策略
  registerRecoveryStrategy(errorType: CardErrorType, strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.set(errorType, strategy)
  }

  // 处理错误
  async handleError(error: unknown, context?: string): Promise<CardError> {
    const cardError = this.normalizeError(error, context)

    // 通知所有监听器
    this.errorListeners.forEach(listener => listener(cardError))

    // 尝试自动恢复
    const strategy = this.recoveryStrategies.get(cardError.type)
    if (strategy?.canRecover) {
      try {
        await strategy.recover()
      } catch (recoveryError) {
        console.error('错误恢复失败:', recoveryError)
      }
    }

    return cardError
  }

  // 标准化错误
  private normalizeError(error: unknown, context?: string): CardError {
    if (error instanceof Error) {
      const errorType = this.classifyError(error)
      const severity = this.getSeverity(errorType)
      const recoverable = this.isRecoverable(error)

      return {
        type: errorType,
        message: context ? `${context}: ${error.message}` : error.message,
        details: error.stack,
        timestamp: new Date(),
        recoverable,
        severity,
        userMessage: this.getUserMessage(errorType),
        retryCount: 0,
        maxRetries: this.getMaxRetries(errorType)
      }
    }

    return {
      type: CardErrorType.UNKNOWN_ERROR,
      message: context ? `${context}: 未知错误` : '未知错误',
      details: error,
      timestamp: new Date(),
      recoverable: false,
      severity: 'critical',
      userMessage: '发生了未知错误，请联系技术支持',
      retryCount: 0,
      maxRetries: 0
    }
  }

  // 错误分类 - 增强版
  private classifyError(error: Error): CardErrorType {
    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ''

    // 存储错误分类 - 增强版
    if (message.includes('storage') || message.includes('localstorage') || message.includes('indexeddb')) {
      if (message.includes('quota') || message.includes('exceeded') || message.includes('full') || message.includes('quota exceeded')) {
        return CardErrorType.STORAGE_QUOTA_ERROR
      }
      if (message.includes('permission') || message.includes('access denied') || message.includes('security') || message.includes('security error')) {
        return CardErrorType.STORAGE_PERMISSION_ERROR
      }
      if (message.includes('corruption') || message.includes('corrupted') || message.includes('invalid data') || message.includes('data error')) {
        return CardErrorType.STORAGE_CORRUPTION_ERROR
      }
      if (message.includes('read-only') || message.includes('readonly') || message.includes('blocked')) {
        return CardErrorType.STORAGE_PERMISSION_ERROR
      }
      return CardErrorType.STORAGE_TEMPORARY_ERROR
    }

    // 网络错误分类 - 增强版
    if (message.includes('network') || message.includes('fetch') || message.includes('ajax') || message.includes('xhr')) {
      if (message.includes('offline') || message.includes('no internet') || message.includes('connection') || message.includes('networkerror')) {
        return CardErrorType.NETWORK_OFFLINE_ERROR
      }
      if (message.includes('timeout') || message.includes('timed out') || message.includes('timeout error')) {
        return CardErrorType.NETWORK_TIMEOUT_ERROR
      }
      if (message.includes('server') || message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504') || message.includes('bad gateway')) {
        return CardErrorType.NETWORK_SERVER_ERROR
      }
      if (message.includes('cors') || message.includes('cross-origin') || message.includes('origin')) {
        return CardErrorType.NETWORK_SERVER_ERROR
      }
      return CardErrorType.NETWORK_ERROR
    }

    // 验证错误分类 - 增强版
    if (message.includes('validation') || message.includes('invalid') || message.includes('schema') || message.includes('type error')) {
      if (message.includes('structure') || message.includes('format') || message.includes('unexpected token') || message.includes('syntax error')) {
        return CardErrorType.VALIDATION_STRUCTURE_ERROR
      }
      if (message.includes('required') || message.includes('missing') || message.includes('undefined') || message.includes('null')) {
        return CardErrorType.VALIDATION_DATA_ERROR
      }
      return CardErrorType.VALIDATION_ERROR
    }

    // 迁移错误分类 - 增强版
    if (message.includes('migration') || message.includes('migrate') || message.includes('upgrade')) {
      if (message.includes('legacy') || message.includes('old version') || message.includes('version mismatch')) {
        return CardErrorType.MIGRATION_LEGACY_ERROR
      }
      if (message.includes('version') || message.includes('compatibility') || message.includes('incompatible')) {
        return CardErrorType.MIGRATION_VERSION_ERROR
      }
      return CardErrorType.MIGRATION_ERROR
    }

    // 初始化错误 - 增强版
    if (message.includes('initialization') || message.includes('init') || message.includes('setup') || message.includes('configuration')) {
      return CardErrorType.INITIALIZATION_ERROR
    }

    // 基于堆栈信息的额外分类
    if (stack.includes('indexeddb') || stack.includes('idb')) {
      if (message.includes('version') || message.includes('upgrade')) {
        return CardErrorType.MIGRATION_VERSION_ERROR
      }
      return CardErrorType.STORAGE_TEMPORARY_ERROR
    }

    // 数据库特定错误
    if (message.includes('database') || message.includes('db') || message.includes('transaction')) {
      if (message.includes('constraint') || message.includes('unique')) {
        return CardErrorType.VALIDATION_DATA_ERROR
      }
      return CardErrorType.STORAGE_TEMPORARY_ERROR
    }

    // 内存和性能错误
    if (message.includes('memory') || message.includes('heap') || message.includes('out of memory')) {
      return CardErrorType.STORAGE_QUOTA_ERROR
    }

    // 文件系统错误
    if (message.includes('file') || message.includes('directory') || message.includes('filesystem')) {
      return CardErrorType.STORAGE_TEMPORARY_ERROR
    }

    return CardErrorType.UNKNOWN_ERROR
  }

  // 判断是否可恢复 - 增强版
  private isRecoverable(error: Error): boolean {
    const message = error.message.toLowerCase()
    const unrecoverableKeywords = [
      'quota', 'permission', 'access denied', 'security', 'critical',
      'readonly', 'blocked', 'insufficient', 'not supported'
    ]

    const isUnrecoverable = unrecoverableKeywords.some(keyword => message.includes(keyword))

    // 特殊情况处理
    if (message.includes('temporary') || message.includes('transient')) {
      return true // 临时错误总是可恢复的
    }

    if (message.includes('network') && !message.includes('offline')) {
      return true // 大多数网络错误是可恢复的
    }

    if (message.includes('timeout')) {
      return true // 超时错误通常是可恢复的
    }

    return !isUnrecoverable
  }

  // 获取错误严重程度 - 增强版
  private getSeverity(errorType: CardErrorType): 'low' | 'medium' | 'high' | 'critical' {
    switch (errorType) {
      // 关键错误 - 影响核心功能
      case CardErrorType.STORAGE_QUOTA_ERROR:
      case CardErrorType.STORAGE_PERMISSION_ERROR:
      case CardErrorType.VALIDATION_STRUCTURE_ERROR:
      case CardErrorType.MIGRATION_VERSION_ERROR:
      case CardErrorType.UNKNOWN_ERROR:
        return 'critical'

      // 高级错误 - 影响重要功能但应用仍可运行
      case CardErrorType.INITIALIZATION_ERROR:
      case CardErrorType.STORAGE_CORRUPTION_ERROR:
      case CardErrorType.NETWORK_SERVER_ERROR:
        return 'high'

      // 中级错误 - 影响部分功能
      case CardErrorType.VALIDATION_DATA_ERROR:
      case CardErrorType.MIGRATION_LEGACY_ERROR:
      case CardErrorType.MIGRATION_ERROR:
        return 'medium'

      // 低级错误 - 临时性问题或用户可自行解决
      case CardErrorType.STORAGE_TEMPORARY_ERROR:
      case CardErrorType.NETWORK_OFFLINE_ERROR:
      case CardErrorType.NETWORK_TIMEOUT_ERROR:
      case CardErrorType.NETWORK_ERROR:
      case CardErrorType.VALIDATION_ERROR:
        return 'low'

      default:
        return 'low'
    }
  }

  // 获取用户友好的错误消息 - 增强版
  private getUserMessage(errorType: CardErrorType): string {
    switch (errorType) {
      case CardErrorType.STORAGE_QUOTA_ERROR:
        return '存储空间已满。请清理一些旧的卡片或使用浏览器的存储管理功能释放空间。'

      case CardErrorType.STORAGE_PERMISSION_ERROR:
        return '无法访问存储。请检查浏览器隐私设置，确保允许网站使用本地存储。'

      case CardErrorType.STORAGE_CORRUPTION_ERROR:
        return '检测到数据损坏。系统正在自动修复，请稍候...'

      case CardErrorType.STORAGE_TEMPORARY_ERROR:
        return '存储暂时不可用。系统正在重试，请稍等片刻...'

      case CardErrorType.NETWORK_OFFLINE_ERROR:
        return '网络连接已断开。请检查您的网络连接，连接后系统会自动同步。'

      case CardErrorType.NETWORK_TIMEOUT_ERROR:
        return '网络响应超时。请检查网络连接并稍后重试。'

      case CardErrorType.NETWORK_SERVER_ERROR:
        return '服务器暂时不可用。请稍后重试，或联系技术支持。'

      case CardErrorType.VALIDATION_STRUCTURE_ERROR:
        return '数据格式有问题。系统正在尝试自动修复...'

      case CardErrorType.VALIDATION_DATA_ERROR:
        return '数据内容验证失败。系统正在清理无效数据...'

      case CardErrorType.MIGRATION_LEGACY_ERROR:
        return '旧版本数据迁移失败。部分数据可能需要手动重新输入。'

      case CardErrorType.MIGRATION_VERSION_ERROR:
        return '版本兼容性问题。请更新应用到最新版本。'

      case CardErrorType.INITIALIZATION_ERROR:
        return '系统初始化失败。请刷新页面重试，如持续出现问题请清除浏览器数据。'

      case CardErrorType.UNKNOWN_ERROR:
        return '发生了未知错误。请刷新页面重试，如问题持续请联系技术支持。'

      case CardErrorType.NETWORK_ERROR:
        return '网络连接出现问题。请检查网络设置后重试。'

      case CardErrorType.VALIDATION_ERROR:
        return '数据验证出现问题。系统正在处理...'

      case CardErrorType.MIGRATION_ERROR:
        return '数据迁移过程中出现问题。系统正在尝试解决...'

      default:
        return '发生了错误，请稍后重试。'
    }
  }

  // 获取最大重试次数 - 增强版
  private getMaxRetries(errorType: CardErrorType): number {
    switch (errorType) {
      // 临时性错误 - 较多重试次数
      case CardErrorType.STORAGE_TEMPORARY_ERROR:
      case CardErrorType.NETWORK_TIMEOUT_ERROR:
      case CardErrorType.NETWORK_OFFLINE_ERROR:
      case CardErrorType.NETWORK_ERROR:
        return 5 // 增加到5次，给更多恢复时间

      // 可恢复的错误 - 中等重试次数
      case CardErrorType.STORAGE_CORRUPTION_ERROR:
      case CardErrorType.VALIDATION_DATA_ERROR:
      case CardErrorType.NETWORK_SERVER_ERROR:
        return 3

      // 需要谨慎处理的错误 - 较少重试次数
      case CardErrorType.VALIDATION_STRUCTURE_ERROR:
      case CardErrorType.MIGRATION_LEGACY_ERROR:
      case CardErrorType.MIGRATION_ERROR:
      case CardErrorType.INITIALIZATION_ERROR:
        return 2

      // 严重错误 - 最少重试次数
      case CardErrorType.STORAGE_QUOTA_ERROR:
      case CardErrorType.STORAGE_PERMISSION_ERROR:
      case CardErrorType.MIGRATION_VERSION_ERROR:
        return 1

      // 未知错误 - 给予一定机会
      case CardErrorType.UNKNOWN_ERROR:
      case CardErrorType.VALIDATION_ERROR:
        return 2

      default:
        return 0
    }
  }
}

// 辅助函数：检查存储可用性
const checkStorageAvailability = async (): Promise<boolean> => {
  try {
    // 测试localStorage
    const testKey = `_storage_test_${Date.now()}`
    localStorage.setItem(testKey, 'test')
    localStorage.removeItem(testKey)

    // 测试IndexedDB（如果可用）
    if ('indexedDB' in window) {
      const request = indexedDB.open('_storage_test_db', 1)
      await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      indexedDB.deleteDatabase('_storage_test_db')
    }

    return true
  } catch (error) {
    console.error('存储可用性检查失败:', error)
    return false
  }
}

// 辅助函数：清理存储空间
const cleanupStorageSpace = async (): Promise<void> => {
  try {
    // 清理过期的错误历史
    const errorHistoryKey = 'card_error_history'
    const errorHistory = localStorage.getItem(errorHistoryKey)
    if (errorHistory) {
      const errors = JSON.parse(errorHistory)
      const recentErrors = errors.slice(-20) // 保留最近20个错误
      localStorage.setItem(errorHistoryKey, JSON.stringify(recentErrors))
    }

    // 清理临时数据
    const tempKeys = Object.keys(localStorage).filter(key =>
      key.startsWith('_temp_') || key.startsWith('_cache_')
    )
    tempKeys.forEach(key => localStorage.removeItem(key))

    console.log(`清理了 ${tempKeys.length} 个临时项`)
  } catch (error) {
    console.error('存储空间清理失败:', error)
    throw error
  }
}

// 辅助函数：压缩存储的数据
const compressStoredData = async (): Promise<void> => {
  try {
    // 压缩卡片数据
    const cardsData = localStorage.getItem('cards')
    if (cardsData) {
      const cards = JSON.parse(cardsData)
      // 移除不必要的字段以减少存储空间
      const compressedCards = cards.map((card: any) => ({
        id: card.id,
        frontContent: {
          title: card.frontContent.title,
          text: card.frontContent.text,
          tags: card.frontContent.tags,
          lastModified: card.frontContent.lastModified
        },
        backContent: {
          title: card.backContent.title,
          text: card.backContent.text,
          tags: card.backContent.tags,
          lastModified: card.backContent.lastModified
        },
        style: card.style,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt
      }))
      localStorage.setItem('cards', JSON.stringify(compressedCards))
    }

    console.log('数据压缩完成')
  } catch (error) {
    console.error('数据压缩失败:', error)
    throw error
  }
}

// 辅助函数：修复localStorage数据
const repairLocalStorageData = async (): Promise<Card[]> => {
  try {
    const savedData = localStorage.getItem('cards')
    if (!savedData) return []

    const parsed = JSON.parse(savedData)
    if (!Array.isArray(parsed)) return []

    const repairedData = parsed.map((item: any) => {
      // 修复缺失的字段
      const repaired: any = {
        id: item.id || Date.now().toString(),
        frontContent: {
          title: item.frontContent?.title || '未命名卡片',
          text: item.frontContent?.text || '',
          images: item.frontContent?.images || [],
          tags: item.frontContent?.tags || [],
          lastModified: item.frontContent?.lastModified ? new Date(item.frontContent.lastModified) : new Date()
        },
        backContent: {
          title: item.backContent?.title || '背面',
          text: item.backContent?.text || '',
          images: item.backContent?.images || [],
          tags: item.backContent?.tags || [],
          lastModified: item.backContent?.lastModified ? new Date(item.backContent.lastModified) : new Date()
        },
        style: item.style || {
          type: 'solid',
          backgroundColor: '#f8fafc',
          fontFamily: 'system-ui',
          fontSize: 'base',
          fontWeight: 'normal',
          textColor: '#1f2937',
          borderRadius: 'xl',
          shadow: 'md',
          borderWidth: 0
        },
        isFlipped: item.isFlipped || false,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
      }

      // 修复folderId（如果存在）
      if (item.folderId) {
        repaired.folderId = item.folderId
      }

      return repaired
    })

    // 保存修复后的数据
    localStorage.setItem('cards', JSON.stringify(repairedData))

    return repairedData
  } catch (error) {
    console.error('localStorage数据修复失败:', error)
    return []
  }
}

// 辅助函数：从IndexedDB恢复数据
const recoverFromIndexedDB = async (): Promise<Card[]> => {
  try {
    if (!('indexedDB' in window)) return []

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CardAllDB', 1)

      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['cards'], 'readonly')
        const store = transaction.objectStore('cards')
        const getAll = store.getAll()

        getAll.onsuccess = () => {
          const cards = getAll.result || []
          db.close()
          resolve(cards)
        }

        getAll.onerror = () => {
          db.close()
          reject(getAll.error)
        }
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('IndexedDB数据恢复失败:', error)
    return []
  }
}

// 辅助函数：从浏览器缓存恢复数据
const recoverFromBrowserCache = async (): Promise<Card[]> => {
  try {
    if ('caches' in window) {
      const cache = await caches.open('cardall-data')
      const response = await cache.match('/cards-data')
      if (response) {
        const data = await response.json()
        return data.cards || []
      }
    }
    return []
  } catch (error) {
    console.error('浏览器缓存恢复失败:', error)
    return []
  }
}

// 辅助函数：验证卡片结构
const validateCardStructure = (card: any): boolean => {
  try {
    return (
      card &&
      typeof card.id === 'string' &&
      card.frontContent &&
      typeof card.frontContent.title === 'string' &&
      card.backContent &&
      typeof card.backContent.title === 'string' &&
      card.style &&
      card.createdAt &&
      card.updatedAt
    )
  } catch (error) {
    return false
  }
}

// 辅助函数：修复无效卡片
const repairInvalidCards = async (invalidCards: any[]): Promise<Card[]> => {
  return invalidCards.map(card => {
    // 基本结构修复
    const repaired: any = {
      id: card.id || Date.now().toString(),
      frontContent: {
        title: card.frontContent?.title || '修复的卡片',
        text: card.frontContent?.text || '',
        images: Array.isArray(card.frontContent?.images) ? card.frontContent.images : [],
        tags: Array.isArray(card.frontContent?.tags) ? card.frontContent.tags : [],
        lastModified: card.frontContent?.lastModified ? new Date(card.frontContent.lastModified) : new Date()
      },
      backContent: {
        title: card.backContent?.title || '背面',
        text: card.backContent?.text || '',
        images: Array.isArray(card.backContent?.images) ? card.backContent.images : [],
        tags: Array.isArray(card.backContent?.tags) ? card.backContent.tags : [],
        lastModified: card.backContent?.lastModified ? new Date(card.backContent.lastModified) : new Date()
      },
      style: card.style || {
        type: 'solid',
        backgroundColor: '#f8fafc',
        fontFamily: 'system-ui',
        fontSize: 'base',
        fontWeight: 'normal',
        textColor: '#1f2937',
        borderRadius: 'xl',
        shadow: 'md',
        borderWidth: 0
      },
      isFlipped: typeof card.isFlipped === 'boolean' ? card.isFlipped : false,
      createdAt: card.createdAt ? new Date(card.createdAt) : new Date(),
      updatedAt: new Date()
    }

    // 修复folderId（如果存在）
    if (card.folderId) {
      repaired.folderId = card.folderId
    }

    return repaired
  })
}

// 辅助函数：测试网络连接
const testNetworkConnection = async (): Promise<{ success: boolean; latency?: number }> => {
  try {
    const startTime = Date.now()
    const response = await fetch('/api/health', {
      method: 'HEAD',
      cache: 'no-cache'
    })
    const latency = Date.now() - startTime

    return {
      success: response.ok,
      latency
    }
  } catch (error) {
    // 如果health端点不可用，尝试fetch一个简单的资源
    try {
      const startTime = Date.now()
      const response = await fetch('/', {
        method: 'HEAD',
        cache: 'no-cache'
      })
      const latency = Date.now() - startTime

      return {
        success: response.ok,
        latency
      }
    } catch (fallbackError) {
      return { success: false }
    }
  }
}

// 辅助函数：测试服务器连接
const testServerConnection = async (): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await fetch('/api/status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      return { success: true, message: data.message || '服务器正常' }
    } else {
      return { success: false, message: `服务器响应错误: ${response.status}` }
    }
  } catch (error) {
    return { success: false, message: '无法连接到服务器' }
  }
}

// Mock data for development (only used when no data exists)
const mockCards: Card[] = [
  {
    id: '1',
    frontContent: {
      title: 'React Best Practices',
      text: 'Key principles for writing maintainable React code including component composition, state management, and performance optimization.',
      images: [],
      tags: ['react', 'frontend', 'best-practices'],
      lastModified: new Date()
    },
    backContent: {
      title: 'Implementation Details',
      text: 'Use functional components with hooks, implement proper error boundaries, optimize with React.memo and useMemo for expensive calculations.',
      images: [],
      tags: ['react', 'frontend', 'best-practices'],
      lastModified: new Date()
    },
    style: {
      type: 'solid',
      backgroundColor: '#f8fafc',
      fontFamily: 'system-ui',
      fontSize: 'base',
      fontWeight: 'normal',
      textColor: '#1f2937',
      borderRadius: 'xl',
      shadow: 'md',
      borderWidth: 0
    },
    isFlipped: false,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: '2',
    frontContent: {
      title: 'TypeScript Tips',
      text: 'Advanced TypeScript patterns for better type safety and developer experience in large applications.',
      images: [],
      tags: ['typescript', 'types', 'development'],
      lastModified: new Date()
    },
    backContent: {
      title: 'Advanced Patterns',
      text: 'Utility types, conditional types, mapped types, and template literal types for complex type transformations.',
      images: [],
      tags: ['typescript', 'types', 'development'],
      lastModified: new Date()
    },
    style: {
      type: 'gradient',
      gradientColors: ['#667eea', '#764ba2'],
      gradientDirection: 'to-br',
      fontFamily: 'system-ui',
      fontSize: 'base',
      fontWeight: 'medium',
      textColor: '#ffffff',
      borderRadius: 'xl',
      shadow: 'lg',
      borderWidth: 0
    },
    isFlipped: false,
    createdAt: new Date('2024-01-16'),
    updatedAt: new Date('2024-01-16')
  }
]

export function useCards() {
  const [cards, setCards] = useState<Card[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [filter, setFilter] = useState<CardFilter>({
    searchTerm: '',
    tags: []
  })
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    layout: 'grid',
    cardSize: 'medium',
    showTags: true,
    showDates: false,
    sortBy: 'updated',
    sortOrder: 'desc'
  })
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])
  const [error, setError] = useState<CardError | null>(null)
  const [errorHistory, setErrorHistory] = useState<CardError[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [recoveryAttempted, setRecoveryAttempted] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  // 初始化错误处理器和存储适配器
  const errorHandler = CardErrorHandler.getInstance()
  const universalStorageAdapter = UniversalStorageAdapter.getInstance()

  // 设置错误监听器和数据变更监听器
  useEffect(() => {
    const unsubscribe = errorHandler.onError((cardError) => {
      setError(cardError)
      setErrorHistory(prev => [...prev.slice(-9), cardError]) // 保留最近10个错误

      // 根据错误严重程度显示用户友好的消息
      if (cardError.userMessage) {
        switch (cardError.severity) {
          case 'critical':
            console.error('严重错误:', cardError.userMessage)
            break
          case 'high':
            console.warn('高级别错误:', cardError.userMessage)
            break
          case 'medium':
            console.warn('中等级别错误:', cardError.userMessage)
            break
          case 'low':
            console.info('低级别错误:', cardError.userMessage)
            break
        }
      }
    })

    // 注册细粒度恢复策略 - 增强版
    // 临时存储错误恢复策略 - 增强版
    errorHandler.registerRecoveryStrategy(CardErrorType.STORAGE_TEMPORARY_ERROR, {
      canRecover: true,
      maxRetries: 3,
      retryDelay: 1000,
      recover: async () => {
        console.log('尝试恢复临时存储错误...')
        try {
          // 检查存储状态
          const storageAvailable = await checkStorageAvailability()
          if (!storageAvailable) {
            throw new Error('存储不可用')
          }

          // 尝试清理存储空间
          await cleanupStorageSpace()

          // 等待存储系统恢复
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          console.error('临时存储恢复失败:', error)
          throw error
        }
      },
      fallback: () => {
        console.log('临时存储恢复失败，使用空数据')
        setCards([])
      },
      shouldUseMock: false // 不使用mock数据
    })

    // 数据损坏恢复策略 - 增强版
    errorHandler.registerRecoveryStrategy(CardErrorType.STORAGE_CORRUPTION_ERROR, {
      canRecover: true,
      maxRetries: 2,
      retryDelay: 500,
      recover: async () => {
        console.log('尝试修复数据损坏...')
        try {
          // 多重数据恢复策略
          let recoveredData: Card[] = []

          // 策略1: 从localStorage修复
          const localStorageData = await repairLocalStorageData()
          if (localStorageData.length > 0) {
            recoveredData = localStorageData
          }

          // 策略2: 从IndexedDB恢复（如果可用）
          if (recoveredData.length === 0) {
            const indexedDBData = await recoverFromIndexedDB()
            if (indexedDBData.length > 0) {
              recoveredData = indexedDBData
            }
          }

          // 策略3: 从浏览器缓存恢复
          if (recoveredData.length === 0) {
            const cacheData = await recoverFromBrowserCache()
            if (cacheData.length > 0) {
              recoveredData = cacheData
            }
          }

          if (recoveredData.length > 0) {
            setCards(recoveredData)
            console.log(`成功恢复 ${recoveredData.length} 张卡片`)
          } else {
            throw new Error('无法从任何来源恢复数据')
          }
        } catch (error) {
          console.error('数据修复失败:', error)
          throw error
        }
      },
      fallback: () => {
        console.log('数据修复失败，使用空数据')
        setCards([])
      },
      shouldUseMock: false // 不使用mock数据
    })

    // 数据验证错误恢复策略 - 增强版
    errorHandler.registerRecoveryStrategy(CardErrorType.VALIDATION_DATA_ERROR, {
      canRecover: true,
      maxRetries: 2,
      retryDelay: 300,
      recover: async () => {
        console.log('尝试修复数据验证错误...')
        try {
          // 智能数据验证和修复
          const invalidCards = cards.filter(card => !validateCardStructure(card))

          if (invalidCards.length > 0) {
            console.log(`发现 ${invalidCards.length} 张无效卡片，尝试修复...`)
            const repairedCards = await repairInvalidCards(invalidCards)

            // 更新卡片列表
            setCards(prevCards =>
              prevCards.map(card => {
                const repairedCard = repairedCards.find(rc => rc.id === card.id)
                return repairedCard || card
              })
            )

            console.log(`成功修复 ${repairedCards.length} 张卡片`)
          }
        } catch (error) {
          console.error('数据验证修复失败:', error)
          throw error
        }
      },
      fallback: () => {
        console.log('数据验证修复失败，移除无效卡片')
        setCards(prevCards => prevCards.filter(card => validateCardStructure(card)))
      },
      shouldUseMock: false // 不使用mock数据
    })

    // 网络超时恢复策略 - 增强版
    errorHandler.registerRecoveryStrategy(CardErrorType.NETWORK_TIMEOUT_ERROR, {
      canRecover: true,
      maxRetries: 3,
      retryDelay: 2000,
      recover: async () => {
        console.log('网络超时恢复策略...')
        try {
          // 检查网络连接
          const isOnline = navigator.onLine
          if (!isOnline) {
            throw new Error('网络离线')
          }

          // 测试网络连接
          const networkTest = await testNetworkConnection()
          if (!networkTest.success) {
            throw new Error('网络连接测试失败')
          }

          console.log('网络连接已恢复')
        } catch (error) {
          console.error('网络恢复失败:', error)
          throw error
        }
      },
      shouldUseMock: false // 不使用mock数据
    })

    // 网络离线恢复策略 - 增强版
    errorHandler.registerRecoveryStrategy(CardErrorType.NETWORK_OFFLINE_ERROR, {
      canRecover: true,
      maxRetries: 3,
      retryDelay: 3000,
      recover: async () => {
        console.log('网络离线恢复策略...')
        try {
          // 等待网络恢复
          let attempts = 0
          const maxAttempts = 10

          while (attempts < maxAttempts) {
            if (navigator.onLine) {
              // 测试网络连接
              const testResult = await testNetworkConnection()
              if (testResult.success) {
                console.log('网络连接已恢复')
                return
              }
            }
            attempts++
            await new Promise(resolve => setTimeout(resolve, 1000))
          }

          throw new Error('网络连接未在预期时间内恢复')
        } catch (error) {
          console.error('网络离线恢复失败:', error)
          throw error
        }
      },
      shouldUseMock: false // 不使用mock数据
    })

    // 存储配额错误恢复策略
    errorHandler.registerRecoveryStrategy(CardErrorType.STORAGE_QUOTA_ERROR, {
      canRecover: true,
      maxRetries: 1,
      retryDelay: 1000,
      recover: async () => {
        console.log('存储配额错误恢复策略...')
        try {
          // 清理不必要的存储空间
          await cleanupStorageSpace()

          // 压缩数据
          await compressStoredData()

          console.log('存储空间清理完成')
        } catch (error) {
          console.error('存储配额恢复失败:', error)
          throw error
        }
      },
      fallback: () => {
        console.log('存储空间不足，建议清理数据或使用云端同步')
        // 显示用户友好的提示
        alert('存储空间不足，请清理一些数据或使用云端同步功能')
      },
      shouldUseMock: false // 不使用mock数据
    })

    // 初始化错误恢复策略
    errorHandler.registerRecoveryStrategy(CardErrorType.INITIALIZATION_ERROR, {
      canRecover: true,
      maxRetries: 2,
      retryDelay: 1000,
      recover: async () => {
        console.log('初始化错误恢复策略...')
        try {
          // 重新初始化存储适配器
          await universalStorageAdapter.reinitialize()

          // 重新加载数据
          await reloadData()

          console.log('初始化恢复成功')
        } catch (error) {
          console.error('初始化恢复失败:', error)
          throw error
        }
      },
      shouldUseMock: false // 不使用mock数据
    })

    // 服务器错误恢复策略
    errorHandler.registerRecoveryStrategy(CardErrorType.NETWORK_SERVER_ERROR, {
      canRecover: true,
      maxRetries: 3,
      retryDelay: 2000,
      recover: async () => {
        console.log('服务器错误恢复策略...')
        try {
          // 等待服务器恢复
          await new Promise(resolve => setTimeout(resolve, 2000))

          // 测试服务器连接
          const serverTest = await testServerConnection()
          if (!serverTest.success) {
            throw new Error('服务器仍然不可用')
          }

          console.log('服务器连接已恢复')
        } catch (error) {
          console.error('服务器恢复失败:', error)
          throw error
        }
      },
      shouldUseMock: false // 不使用mock数据
    })

    // 设置数据变更监听器
    const handleStorageChange = async (event: any) => {
      console.log('存储数据变更:', event)

      // 如果是外部变更，重新加载数据
      if (event.type === 'cardsChanged' && event.data?.externalChange) {
        console.log('检测到外部数据变更，重新加载...')
        await reloadData()
      }

      // 更新同步时间
      if (event.type === 'cardsChanged') {
        setLastSyncTime(new Date())
      }
    }

    // 注册存储事件监听器
    universalStorageAdapter.addEventListener('cardsChanged', handleStorageChange)
    universalStorageAdapter.addEventListener('cardCreated', handleStorageChange)
    universalStorageAdapter.addEventListener('cardUpdated', handleStorageChange)
    universalStorageAdapter.addEventListener('cardDeleted', handleStorageChange)

    return () => {
      unsubscribe()
      // 清理存储事件监听器
      universalStorageAdapter.removeEventListener('cardsChanged', handleStorageChange)
      universalStorageAdapter.removeEventListener('cardCreated', handleStorageChange)
      universalStorageAdapter.removeEventListener('cardUpdated', handleStorageChange)
      universalStorageAdapter.removeEventListener('cardDeleted', handleStorageChange)
    }
  }, [universalStorageAdapter])

  // 重新加载数据 - 优化版：增强可靠性和性能
  const reloadData = useCallback(async () => {
    setIsLoading(true)
    try {
      // 使用UniversalStorageAdapter加载数据，添加重试机制
      let savedCards: Card[] = []
      let loadAttempts = 0
      const maxLoadAttempts = 3

      while (loadAttempts < maxLoadAttempts) {
        try {
          savedCards = await universalStorageAdapter.getCards()
          break // 成功则退出重试循环
        } catch (loadError) {
          loadAttempts++
          if (loadAttempts === maxLoadAttempts) {
            throw loadError // 最后一次尝试失败则抛出错误
          }
          console.warn(`第 ${loadAttempts} 次加载失败，等待重试...`)
          await new Promise(resolve => setTimeout(resolve, 1000 * loadAttempts)) // 递增延迟
        }
      }

      if (savedCards.length > 0) {
        // 验证数据完整性
        const validCards = savedCards.filter(validateCardStructure)
        if (validCards.length !== savedCards.length) {
          console.warn(`发现 ${savedCards.length - validCards.length} 张无效卡片，已过滤`)
        }

        setCards(validCards)
        console.log(`成功加载 ${validCards.length} 张有效卡片 (使用 ${universalStorageAdapter.getStorageMode()} 存储模式)`)
      } else {
        // 没有数据时不使用mock数据，保持空数组
        console.log('没有找到数据，使用空数组')
        setCards([])
      }

      setIsInitialized(true)
    } catch (loadError) {
      console.error('加载数据失败:', loadError)
      await errorHandler.handleError(loadError, '加载卡片数据失败')

      // 如果UniversalStorageAdapter失败，尝试回退到DataConverterAdapter
      try {
        console.log('尝试回退到DataConverterAdapter...')
        const fallbackCards = DataConverterAdapter.loadFromLocalStorage()

        if (fallbackCards.length > 0) {
          // 验证回退数据的完整性
          const validFallbackCards = fallbackCards.filter(validateCardStructure)
          setCards(validFallbackCards)
          console.log(`回退加载成功：${validFallbackCards.length} 张有效卡片`)
        } else {
          setCards([])
        }
      } catch (fallbackError) {
        console.error('回退加载也失败:', fallbackError)
        await errorHandler.handleError(fallbackError, '回退加载失败')
        setCards([])
      }

      setIsInitialized(true) // 即使失败也标记为已初始化，避免无限循环
    } finally {
      setIsLoading(false)
    }
  }, [errorHandler])

  // 错误恢复函数 - 增强版
  const recoverFromError = useCallback(async () => {
    if (!error || !error.recoverable) return

    setIsLoading(true)
    setRecoveryAttempted(true)

    try {
      const strategy = errorHandler['recoveryStrategies'].get(error.type)
      if (strategy?.canRecover) {
        // 增强的重试逻辑
        const maxRetries = strategy.maxRetries || error.maxRetries || 1
        const retryDelay = strategy.retryDelay || 1000
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`尝试恢复 ${error.type} - 第 ${attempt} 次`)
            await strategy.recover()

            // 成功恢复后重新加载数据
            await reloadData()
            setError(null)
            console.log(`错误恢复成功：${error.type}`)
            break // 成功则退出重试循环
          } catch (recoveryError) {
            lastError = recoveryError as Error
            console.error(`恢复失败，第 ${attempt} 次尝试:`, recoveryError)

            if (attempt < maxRetries) {
              const exponentialDelay = retryDelay * Math.pow(2, attempt - 1) // 指数退避
              console.log(`等待 ${exponentialDelay}ms 后重试...`)
              await new Promise(resolve => setTimeout(resolve, exponentialDelay))
            }
          }
        }

        // 如果所有重试都失败，执行fallback
        if (lastError && strategy.fallback) {
          console.log('所有恢复尝试失败，执行fallback策略')
          strategy.fallback()
        }

        // 仅在绝对必要时使用mock数据（最后手段）
        if (error && strategy.shouldUseMock && cards.length === 0) {
          console.warn('所有恢复策略失败，使用mock数据作为最后手段')
          setCards(mockCards)
          setError(null)
        }
      } else {
        console.warn(`错误类型 ${error.type} 没有可用的恢复策略`)
      }
    } catch (recoveryError) {
      console.error('错误恢复过程中发生异常:', recoveryError)
      const fallback = errorHandler['recoveryStrategies'].get(error.type)?.fallback
      if (fallback) {
        fallback()
      }
    } finally {
      setIsLoading(false)
    }
  }, [error, errorHandler, cards.length, reloadData])

  // Filter and sort cards
  const filteredCards = useCallback(() => {
    const filtered = cards.filter(card => {
      // Search term filter
      if (filter.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase()
        const matchesTitle = card.frontContent.title.toLowerCase().includes(searchLower) ||
                           card.backContent.title.toLowerCase().includes(searchLower)
        const matchesText = card.frontContent.text.toLowerCase().includes(searchLower) ||
                          card.backContent.text.toLowerCase().includes(searchLower)
        const matchesTags = [...card.frontContent.tags, ...card.backContent.tags]
                          .some(tag => tag.toLowerCase().includes(searchLower))
        
        if (!matchesTitle && !matchesText && !matchesTags) return false
      }

      // Tags filter
      if (filter.tags.length > 0) {
        const cardTags = [...card.frontContent.tags, ...card.backContent.tags]
        if (!filter.tags.some(tag => cardTags.includes(tag))) return false
      }

      // Folder filter
      if (filter.folderId && card.folderId !== filter.folderId) return false

      // Date range filter
      if (filter.dateRange) {
        const cardDate = new Date(card.updatedAt)
        if (cardDate < filter.dateRange.start || cardDate > filter.dateRange.end) return false
      }

      // Style type filter
      if (filter.styleType && card.style.type !== filter.styleType) return false

      // Has images filter
      if (filter.hasImages !== undefined) {
        const hasImages = card.frontContent.images.length > 0 || card.backContent.images.length > 0
        if (hasImages !== filter.hasImages) return false
      }

      return true
    })

    // Sort cards
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (viewSettings.sortBy) {
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'updated':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        case 'title':
          comparison = a.frontContent.title.localeCompare(b.frontContent.title)
          break
        default:
          comparison = 0
      }

      return viewSettings.sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [cards, filter, viewSettings])

  // Card actions
  const dispatch = useCallback((action: CardAction) => {
    setCards(prevCards => {
      switch (action.type) {
        case 'CREATE_CARD': {
          const newCard: Card = {
            ...action.payload,
            id: Date.now().toString(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
          return [...prevCards, newCard]
        }

        case 'UPDATE_CARD':
          return prevCards.map(card =>
            card.id === action.payload.id
              ? { ...card, ...action.payload.updates, updatedAt: new Date() }
              : card
          )

        case 'DELETE_CARD':
          return prevCards.filter(card => card.id !== action.payload)

        case 'FLIP_CARD':
          return prevCards.map(card =>
            card.id === action.payload
              ? { ...card, isFlipped: !card.isFlipped, updatedAt: new Date() }
              : card
          )

        case 'SELECT_CARD':
          setSelectedCardIds(prev => 
            prev.includes(action.payload) 
              ? prev.filter(id => id !== action.payload)
              : [...prev, action.payload]
          )
          return prevCards

        case 'DESELECT_ALL':
          setSelectedCardIds([])
          return prevCards

        case 'DUPLICATE_CARD': {
          const cardToDuplicate = prevCards.find(card => card.id === action.payload)
          if (!cardToDuplicate) return prevCards

          const duplicatedCard: Card = {
            ...cardToDuplicate,
            id: Date.now().toString(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
          return [...prevCards, duplicatedCard]
        }

        case 'MOVE_TO_FOLDER': {
          const updatedCards = prevCards.map(card =>
            card.id === action.payload.cardId
              ? { ...card, folderId: action.payload.folderId, updatedAt: new Date() }
              : card
          )
          return updatedCards
        }

        default:
          return prevCards
      }
    })
  }, [])

  // Utility functions
  const getCardById = useCallback((id: string) => {
    return cards.find(card => card.id === id)
  }, [cards])

  const getSelectedCards = useCallback(() => {
    return cards.filter(card => selectedCardIds.includes(card.id))
  }, [cards, selectedCardIds])

  const getAllTags = useCallback(() => {
    const tagSet = new Set<string>()
    cards.forEach(card => {
      card.frontContent.tags.forEach(tag => tagSet.add(tag))
      card.backContent.tags.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [cards])

  // Update tags across all cards (for rename/delete operations)
  const updateTagsInAllCards = useCallback((oldTagName: string, newTagName?: string) => {
    setCards(prevCards => {
      return prevCards.map(card => {
        const updateTags = (tags: string[]) => {
          if (newTagName) {
            // Rename tag
            return tags.map(tag => tag === oldTagName ? newTagName : tag)
          } else {
            // Delete tag
            return tags.filter(tag => tag !== oldTagName)
          }
        }

        const frontTags = updateTags(card.frontContent.tags)
        const backTags = updateTags(card.backContent.tags)

        // Only update if tags actually changed
        if (
          JSON.stringify(frontTags) !== JSON.stringify(card.frontContent.tags) ||
          JSON.stringify(backTags) !== JSON.stringify(card.backContent.tags)
        ) {
          return {
            ...card,
            frontContent: {
              ...card.frontContent,
              tags: frontTags,
              lastModified: new Date()
            },
            backContent: {
              ...card.backContent,
              tags: backTags,
              lastModified: new Date()
            },
            updatedAt: new Date()
          }
        }

        return card
      })
    })
  }, [])

  // Get cards that use a specific tag
  const getCardsWithTag = useCallback((tagName: string) => {
    return cards.filter(card => 
      card.frontContent.tags.includes(tagName) || 
      card.backContent.tags.includes(tagName)
    )
  }, [cards])

  // Load data from persistent storage on mount
  useEffect(() => {
    if (isInitialized) return

    const loadData = async () => {
      setIsLoading(true)
      try {
        // 优先使用UniversalStorageAdapter加载和验证数据
        const savedCards = await universalStorageAdapter.getCards()

        if (savedCards.length > 0) {
          setCards(savedCards)
          console.log(`成功加载 ${savedCards.length} 张卡片 (使用 ${universalStorageAdapter.getStorageMode()} 存储模式)`)
        } else {
          // 没有数据时尝试从localStorage加载数据（兼容性）
          try {
            console.log('尝试从localStorage加载数据...')
            const localStorageCards = DataConverterAdapter.loadFromLocalStorage()
            if (localStorageCards.length > 0) {
              setCards(localStorageCards)
              console.log(`从localStorage加载 ${localStorageCards.length} 张卡片`)
              // 自动迁移到UniversalStorageAdapter
              await universalStorageAdapter.saveCards(localStorageCards)
              console.log('数据已迁移到UniversalStorageAdapter')
            } else {
              console.log('没有找到数据，使用空数组')
              setCards([])
            }
          } catch (localStorageError) {
            console.warn('从localStorage加载失败:', localStorageError)
            setCards([])
          }
        }

        setIsInitialized(true)
      } catch (error) {
        console.error('加载卡片数据失败:', error)
        await errorHandler.handleError(error, '加载卡片数据失败')

        // 尝试恢复
        await recoverFromError()
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isInitialized, errorHandler, recoverFromError, universalStorageAdapter])

  // 优化的Auto-save机制：智能保存，避免频繁写入
  useEffect(() => {
    if (!isInitialized || isLoading) return

    // 防抖保存：避免频繁保存操作
    const saveTimer = setTimeout(async () => {
      try {
        // 保存前验证数据完整性
        const invalidCards = cards.filter(card => !validateCardStructure(card))
        if (invalidCards.length > 0) {
          console.warn(`发现 ${invalidCards.length} 张无效卡片，保存前尝试修复...`)
          const repairedCards = await repairInvalidCards(invalidCards)
          if (repairedCards.length > 0) {
            setCards(prevCards =>
              prevCards.map(card => {
                const repairedCard = repairedCards.find(rc => rc.id === card.id)
                return repairedCard || card
              })
            )
          }
        }

        // 优先使用UniversalStorageAdapter进行保存，添加重试机制
        let saveAttempts = 0
        const maxSaveAttempts = 2

        while (saveAttempts < maxSaveAttempts) {
          try {
            await universalStorageAdapter.saveCards(cards)
            console.log(`自动保存成功：${cards.length} 张卡片 (使用 ${universalStorageAdapter.getStorageMode()} 存储模式)`)
            break
          } catch (saveError) {
            saveAttempts++
            if (saveAttempts === maxSaveAttempts) {
              throw saveError
            }
            console.warn(`第 ${saveAttempts} 次保存失败，等待重试...`)
            await new Promise(resolve => setTimeout(resolve, 500 * saveAttempts))
          }
        }
      } catch (error) {
        console.error('保存卡片到持久化存储失败:', error)
        await errorHandler.handleError(error, '保存卡片数据失败')

        // 尝试回退到DataConverterAdapter
        try {
          console.log('尝试回退到DataConverterAdapter...')
          DataConverterAdapter.saveToLocalStorage(cards)
          console.log('回退保存成功')
        } catch (fallbackError) {
          console.error('回退保存也失败:', fallbackError)
          await errorHandler.handleError(fallbackError, '回退保存失败')
        }
      }
    }, 2000) // 增加到2秒延迟，避免频繁保存

    return () => clearTimeout(saveTimer)
  }, [cards, isInitialized, isLoading, errorHandler, universalStorageAdapter])

  // 智能错误预防和监控
  const errorPrevention = {
    // 预防性检查
    performPreventiveChecks: async (): Promise<boolean> => {
      try {
        // 检查存储空间
        const storageAvailable = await checkStorageAvailability()
        if (!storageAvailable) {
          console.warn('存储空间检查失败，可能即将出现问题')
          return false
        }

        // 检查网络连接
        if (navigator.onLine) {
          const networkTest = await testNetworkConnection()
          if (!networkTest.success) {
            console.warn('网络连接不稳定，可能影响数据同步')
          }
        }

        // 检查数据完整性
        const invalidCards = cards.filter(card => !validateCardStructure(card))
        if (invalidCards.length > 0) {
          console.warn(`发现 ${invalidCards.length} 张无效卡片，建议修复`)
        }

        return true
      } catch (error) {
        console.error('预防性检查失败:', error)
        return false
      }
    },

    // 错误趋势分析
    analyzeErrorTrends: (): { trend: 'improving' | 'stable' | 'worsening'; suggestions: string[] } => {
      const recentErrors = errorHistory.slice(-10) // 最近10个错误
      const olderErrors = errorHistory.slice(-20, -10) // 之前的10个错误

      if (recentErrors.length === 0) {
        return { trend: 'improving', suggestions: ['错误率正常，继续保持'] }
      }

      // 分析错误类型分布
      const errorTypeCount = new Map<string, number>()
      recentErrors.forEach(error => {
        const count = errorTypeCount.get(error.type) || 0
        errorTypeCount.set(error.type, count + 1)
      })

      // 生成建议
      const suggestions: string[] = []
      errorTypeCount.forEach((count, type) => {
        if (count > 2) {
          switch (type) {
            case 'STORAGE_TEMPORARY_ERROR':
              suggestions.push('频繁的存储临时错误，建议检查存储设备')
              break
            case 'NETWORK_TIMEOUT_ERROR':
              suggestions.push('网络超时频繁，建议检查网络连接')
              break
            case 'VALIDATION_DATA_ERROR':
              suggestions.push('数据验证错误增多，建议检查数据源')
              break
          }
        }
      })

      // 判断趋势
      const recentErrorRate = recentErrors.length
      const olderErrorRate = olderErrors.length

      let trend: 'improving' | 'stable' | 'worsening' = 'stable'
      if (recentErrorRate < olderErrorRate) {
        trend = 'improving'
      } else if (recentErrorRate > olderErrorRate) {
        trend = 'worsening'
      }

      if (suggestions.length === 0) {
        suggestions.push('系统运行正常，继续保持')
      }

      return { trend, suggestions }
    },

    // 自动维护任务
    runMaintenanceTasks: async (): Promise<void> => {
      try {
        console.log('开始运行维护任务...')

        // 清理过期错误历史
        if (errorHistory.length > 50) {
          setErrorHistory(prev => prev.slice(-30))
          console.log('清理了错误历史记录')
        }

        // 压缩数据（如果存储空间紧张）
        const storageAvailable = await checkStorageAvailability()
        if (!storageAvailable) {
          await compressStoredData()
          console.log('执行了数据压缩')
        }

        // 验证数据完整性
        const invalidCards = cards.filter(card => !validateCardStructure(card))
        if (invalidCards.length > 0) {
          const repairedCards = await repairInvalidCards(invalidCards)
          if (repairedCards.length > 0) {
            console.log(`修复了 ${repairedCards.length} 张无效卡片`)
          }
        }

        console.log('维护任务完成')
      } catch (error) {
        console.error('维护任务执行失败:', error)
      }
    }
  }

  // 增强的数据变更监听系统
  const [dataChangeListeners, setDataChangeListeners] = useState<Set<Function>>(new Set())

  // 注册数据变更监听器
  const onDataChange = useCallback((callback: Function) => {
    setDataChangeListeners(prev => new Set(prev).add(callback))
    return () => {
      setDataChangeListeners(prev => {
        const newSet = new Set(prev)
        newSet.delete(callback)
        return newSet
      })
    }
  }, [])

  // 通知所有数据变更监听器
  const notifyDataChange = useCallback((changeType: string, data?: any) => {
    dataChangeListeners.forEach(callback => {
      try {
        callback(changeType, data)
      } catch (error) {
        console.error('数据变更监听器执行失败:', error)
      }
    })
  }, [dataChangeListeners])

  // 优化的数据加载函数
  const loadCards = useCallback(async (forceReload = false): Promise<Card[]> => {
    if (!forceReload && isInitialized && cards.length > 0) {
      return cards // 如果已初始化且有数据，直接返回
    }

    setIsLoading(true)
    try {
      let loadedCards: Card[] = []

      // 尝试从UniversalStorageAdapter加载
      try {
        loadedCards = await universalStorageAdapter.getCards()
        if (loadedCards.length > 0) {
          console.log(`从UniversalStorageAdapter加载 ${loadedCards.length} 张卡片`)
        }
      } catch (error) {
        console.warn('UniversalStorageAdapter加载失败，尝试回退:', error)
      }

      // 如果UniversalStorageAdapter没有数据，尝试localStorage
      if (loadedCards.length === 0) {
        try {
          const localStorageCards = DataConverterAdapter.loadFromLocalStorage()
          if (localStorageCards.length > 0) {
            loadedCards = localStorageCards
            console.log(`从localStorage加载 ${localStorageCards.length} 张卡片`)
            // 自动迁移到UniversalStorageAdapter
            await universalStorageAdapter.saveCards(localStorageCards)
          }
        } catch (error) {
          console.warn('localStorage加载失败:', error)
        }
      }

      // 验证数据完整性
      const validCards = loadedCards.filter(validateCardStructure)
      if (validCards.length !== loadedCards.length) {
        console.warn(`过滤了 ${loadedCards.length - validCards.length} 张无效卡片`)
      }

      setCards(validCards)
      setIsInitialized(true)
      notifyDataChange('cardsLoaded', { cardCount: validCards.length })

      return validCards
    } catch (error) {
      console.error('加载卡片失败:', error)
      await errorHandler.handleError(error, 'loadCards失败')
      setCards([])
      setIsInitialized(true)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [isInitialized, cards.length, universalStorageAdapter, errorHandler, notifyDataChange])

  // 优化的数据保存函数
  const saveCards = useCallback(async (cardsToSave: Card[] = cards): Promise<boolean> => {
    try {
      // 保存前验证数据
      const invalidCards = cardsToSave.filter(card => !validateCardStructure(card))
      if (invalidCards.length > 0) {
        console.warn(`保存前发现 ${invalidCards.length} 张无效卡片`)
      }

      const validCards = cardsToSave.filter(validateCardStructure)

      // 使用UniversalStorageAdapter保存
      const success = await universalStorageAdapter.saveCards(validCards)
      if (success) {
        console.log(`成功保存 ${validCards.length} 张卡片`)
        notifyDataChange('cardsSaved', { cardCount: validCards.length })
        return true
      }
      return false
    } catch (error) {
      console.error('保存卡片失败:', error)
      await errorHandler.handleError(error, 'saveCards失败')

      // 尝试回退保存
      try {
        DataConverterAdapter.saveToLocalStorage(cardsToSave)
        console.log('回退保存成功')
        return true
      } catch (fallbackError) {
        console.error('回退保存失败:', fallbackError)
        return false
      }
    }
  }, [cards, universalStorageAdapter, errorHandler, notifyDataChange])

  // 批量操作优化
  const performBatchOperation = useCallback(async (
    operations: Array<() => Promise<void>>,
    description: string
  ): Promise<boolean> => {
    setIsLoading(true)
    try {
      console.log(`开始批量操作: ${description}`)

      // 执行所有操作
      for (let i = 0; i < operations.length; i++) {
        try {
          await operations[i]()
        } catch (error) {
          console.error(`批量操作第 ${i + 1} 步失败:`, error)
          throw error
        }
      }

      // 批量操作完成后保存
      await saveCards()
      console.log(`批量操作完成: ${description}`)
      notifyDataChange('batchOperationCompleted', { description, operationCount: operations.length })
      return true
    } catch (error) {
      console.error(`批量操作失败: ${description}`, error)
      await errorHandler.handleError(error, `批量操作失败: ${description}`)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [saveCards, errorHandler, notifyDataChange])

  // 定期维护和错误预防
  useEffect(() => {
    if (!isInitialized) return

    // 每5分钟运行一次维护任务
    const maintenanceInterval = setInterval(async () => {
      try {
        await errorPrevention.runMaintenanceTasks()
      } catch (error) {
        console.error('定期维护任务失败:', error)
      }
    }, 5 * 60 * 1000) // 5分钟

    // 每30秒运行一次预防性检查
    const preventiveCheckInterval = setInterval(async () => {
      try {
        await errorPrevention.performPreventiveChecks()
      } catch (error) {
        console.error('预防性检查失败:', error)
      }
    }, 30 * 1000) // 30秒

    return () => {
      clearInterval(maintenanceInterval)
      clearInterval(preventiveCheckInterval)
    }
  }, [isInitialized, errorPrevention])

  // 增强的错误恢复函数
  const enhancedRecoverFromError = useCallback(async () => {
    if (!error || !error.recoverable) return false

    console.log('开始增强的错误恢复流程...')
    setIsLoading(true)

    try {
      const strategy = errorHandler['recoveryStrategies'].get(error.type)
      if (strategy?.canRecover) {
        // 执行恢复策略
        await strategy.recover()

        // 恢复后重新加载数据
        await reloadData()
        setError(null)
        console.log('错误恢复成功')
        return true
      }

      return false
    } catch (recoveryError) {
      console.error('错误恢复失败:', recoveryError)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [error, errorHandler, reloadData])

  // 获取错误严重程度信息
  const getErrorSeverityInfo = useCallback(() => {
    if (!error) return null
    switch (error.severity) {
      case 'critical':
        return { level: 'critical', message: '严重错误，需要立即关注' }
      case 'high':
        return { level: 'high', message: '高级别错误，建议尽快处理' }
      case 'medium':
        return { level: 'medium', message: '中等级别错误，可以稍后处理' }
      case 'low':
        return { level: 'low', message: '低级别错误，可以忽略' }
      default:
        return null
    }
  }, [error])

  // 获取用户友好的错误消息
  const getUserErrorMessage = useCallback(() => {
    if (!error) return null
    return error.userMessage || error.message
  }, [error])

  // 开发环境辅助函数：仅在明确要求时使用mock数据
  const useMockDataForDevelopment = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('开发环境：使用mock数据（仅在调试时使用）')
      setCards(mockCards)
    }
  }, [])

  return {
    cards: filteredCards(),
    allCards: cards,
    filter,
    setFilter,
    viewSettings,
    setViewSettings,
    selectedCardIds,
    dispatch,
    getCardById,
    getSelectedCards,
    getAllTags,
    updateTagsInAllCards,
    getCardsWithTag,
    isInitialized,
    // 错误处理相关
    error,
    errorHistory,
    isLoading,
    recoveryAttempted,
    recoverFromError,
    reloadData,
    clearError: () => setError(null),
    clearErrorHistory: () => setErrorHistory([]),
    // 数据同步相关
    lastSyncTime,
    // 用户友好的错误信息
    getUserErrorMessage,
    getErrorSeverityInfo,
    // 智能错误预防和监控
    errorPrevention,
    // 增强的数据操作函数
    loadCards,
    saveCards,
    onDataChange,
    performBatchOperation,
    enhancedRecoverFromError,
    // 开发环境辅助函数
    useMockDataForDevelopment
  }
}