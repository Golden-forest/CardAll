// ============================================================================
// 断点续传和错误恢复机制
// 
// 为小型数据集提供可靠的断点续传和智能错误恢复
// 支持会话恢复、数据校验、自动重试等功能
// ============================================================================

import { intelligentBatchUploadService, type BatchGroup, type BatchUploadItem } from './intelligent-batch-upload'
import { uploadQueueManager } from './upload-queue-manager'
import { networkStateDetector } from './network-state-detector'
import { dataCompressionOptimizer } from './data-compression-optimizer'

// 会话状态
export interface SessionState {
  id: string
  startTime: Date
  endTime?: Date
  status: 'active' | 'paused' | 'completed' | 'failed' | 'resuming'
  
  // 上传进度
  totalItems: number
  processedItems: number
  failedItems: number
  remainingItems: number
  
  // 数据完整性
  checksums: Map<string, string> // item_id -> checksum
  uploadedBlocks: Set<string> // 已上传的数据块
  pendingBlocks: Set<string> // 待上传的数据块
  
  // 重试信息
  retryCount: number
  lastRetryTime?: Date
  maxRetries: number
  
  // 网络状态
  networkSnapshot: NetworkSnapshot
  
  // 元数据
  metadata: {
    totalSize: number
    uploadedSize: number
    compressionRatio: number
    estimatedTimeRemaining: number
  }
}

// 网络快照
export interface NetworkSnapshot {
  isOnline: boolean
  quality: string
  downlink: number
  rtt: number
  effectiveType: string
  timestamp: Date
}

// 数据块
export interface DataBlock {
  id: string
  itemId: string
  sequence: number
  data: any
  size: number
  checksum: string
  compressed: boolean
  uploaded: boolean
  retryCount: number
  lastAttempt?: Date
}

// 恢复策略
export interface RecoveryStrategy {
  name: string
  description: string
  canRecover: (error: any, context: RecoveryContext) => boolean
  recover: (context: RecoveryContext) => Promise<RecoveryResult>
}

// 恢复上下文
export interface RecoveryContext {
  error: any
  session: SessionState
  failedBlocks: DataBlock[]
  networkState: NetworkSnapshot
  timestamp: Date
  retryCount: number
}

// 恢复结果
export interface RecoveryResult {
  success: boolean
  action: 'retry' | 'skip' | 'abort' | 'rebuild'
  recoveredItems: string[]
  message: string
  details?: any
}

// 错误分类
export interface ErrorClassification {
  type: 'network' | 'validation' | 'server' | 'client' | 'timeout' | 'unknown'
  severity: 'low' | 'medium' | 'high' | 'critical'
  retryable: boolean
  recoveryStrategy: string
  
  // 错误详情
  code?: string
  message: string
  context?: any
}

// 数据完整性验证
export interface IntegrityValidation {
  itemId: string
  checksum: string
  algorithm: string
  validated: boolean
  validationTime: Date
  errors: IntegrityError[]
}

// 完整性错误
export interface IntegrityError {
  type: 'checksum_mismatch' | 'data_corruption' | 'missing_block' | 'invalid_format'
  description: string
  severity: 'warning' | 'error' | 'critical'
  recoverable: boolean
}

// 断点续传配置
export interface ResumableUploadConfig {
  // 会话管理
  sessionTimeout: number // 会话超时时间（毫秒）
  maxSessionAge: number // 最大会话年龄（毫秒）
  
  // 数据块设置
  blockSize: number // 数据块大小（字节）
  maxBlocksPerItem: number // 每个项目的最大块数
  
  // 重试设置
  maxRetries: number
  retryDelay: number
  retryBackoff: number
  retryJitter: number
  
  // 验证设置
  checksumAlgorithm: 'md5' | 'sha1' | 'sha256' | 'crc32'
  enableValidation: boolean
  validationLevel: 'basic' | 'strict' | 'comprehensive'
  
  // 恢复设置
  autoRecovery: boolean
  recoveryStrategies: string[]
  maxRecoveryAttempts: number
  
  // 持久化设置
  persistSession: boolean
  persistInterval: number
}

class ResumableUploadService {
  private activeSessions: Map<string, SessionState> = new Map()
  private sessionHistory: SessionState[] = []
  private dataBlocks: Map<string, DataBlock[]> = new Map()
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map()
  
  private config: ResumableUploadConfig
  private validationService: IntegrityValidationService
  
  private persistenceInterval: NodeJS.Timeout | null = null
  private recoveryInterval: NodeJS.Timeout | null = null

  constructor() {
    this.config = this.getDefaultConfig()
    this.validationService = new IntegrityValidationService()
    
    this.initialize()
  }

  // 获取默认配置
  private getDefaultConfig(): ResumableUploadConfig {
    return {
      sessionTimeout: 30 * 60 * 1000, // 30分钟
      maxSessionAge: 24 * 60 * 60 * 1000, // 24小时
      blockSize: 65536, // 64KB
      maxBlocksPerItem: 100,
      maxRetries: 5,
      retryDelay: 1000,
      retryBackoff: 2,
      retryJitter: 0.1,
      checksumAlgorithm: 'sha256',
      enableValidation: true,
      validationLevel: 'strict',
      autoRecovery: true,
      recoveryStrategies: ['network-retry', 'data-rebuild', 'session-restart'],
      maxRecoveryAttempts: 3,
      persistSession: true,
      persistInterval: 5000 // 5秒
    }
  }

  // 初始化服务
  private async initialize() {
    // 初始化恢复策略
    this.initializeRecoveryStrategies()
    
    // 恢复未完成的会话
    await this.restoreSessions()
    
    // 启动持久化
    if (this.config.persistSession) {
      this.startPersistence()
    }
    
    // 启动恢复监控
    this.startRecoveryMonitoring()
    
    // 监听网络状态
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this),
      onNetworkError: this.handleNetworkError.bind(this)
    })
    
    console.log('Resumable upload service initialized')
  }

  // 初始化恢复策略
  private initializeRecoveryStrategies() {
    // 网络重试策略
    this.recoveryStrategies.set('network-retry', {
      name: 'Network Retry',
      description: '网络错误重试策略',
      canRecover: (error, context) => {
        return this.classifyError(error).type === 'network' && 
               context.retryCount < this.config.maxRetries
      },
      recover: async (context) => {
        const delay = this.calculateRetryDelay(context.retryCount)
        await new Promise(resolve => setTimeout(resolve, delay))
        
        return {
          success: true,
          action: 'retry',
          recoveredItems: context.failedBlocks.map(block => block.itemId),
          message: `Network retry scheduled after ${delay}ms`
        }
      }
    })

    // 数据重建策略
    this.recoveryStrategies.set('data-rebuild', {
      name: 'Data Rebuild',
      description: '数据重建和重新分块策略',
      canRecover: (error, context) => {
        const classification = this.classifyError(error)
        return classification.type === 'validation' && classification.recoverable
      },
      recover: async (context) => {
        // 重新分块数据
        for (const block of context.failedBlocks) {
          const newBlocks = await this.rebuildDataBlock(block)
          this.dataBlocks.set(block.itemId, newBlocks)
        }
        
        return {
          success: true,
          action: 'rebuild',
          recoveredItems: context.failedBlocks.map(block => block.itemId),
          message: 'Data blocks rebuilt successfully'
        }
      }
    })

    // 会话重启策略
    this.recoveryStrategies.set('session-restart', {
      name: 'Session Restart',
      description: '会话重启策略',
      canRecover: (error, context) => {
        return context.retryCount >= this.config.maxRetries &&
               this.classifyError(error).severity !== 'critical'
      },
      recover: async (context) => {
        // 重新创建会话
        const newSession = await this.restartSession(context.session)
        
        return {
          success: true,
          action: 'retry',
          recoveredItems: Array.from(newSession.checksums.keys()),
          message: 'Session restarted successfully'
        }
      }
    })

    // 跳过策略
    this.recoveryStrategies.set('skip-item', {
      name: 'Skip Item',
      description: '跳过失败项目策略',
      canRecover: (error, context) => {
        const classification = this.classifyError(error)
        return classification.severity === 'low' && !classification.retryable
      },
      recover: async (context) => {
        return {
          success: true,
          action: 'skip',
          recoveredItems: [],
          message: 'Failed item skipped'
        }
      }
    })
  }

  // 启动持久化
  private startPersistence() {
    if (this.persistenceInterval) {
      clearInterval(this.persistenceInterval)
    }

    this.persistenceInterval = setInterval(() => {
      this.persistSessionState()
    }, this.config.persistInterval)
  }

  // 启动恢复监控
  private startRecoveryMonitoring() {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval)
    }

    this.recoveryInterval = setInterval(() => {
      this.monitorAndRecover()
    }, 10000) // 每10秒检查一次
  }

  // 处理网络状态变化
  private handleNetworkStateChange(state: any) {
    // 网络恢复时检查是否有需要恢复的会话
    if (state.isOnline && state.canSync) {
      this.checkRecoverableSessions()
    }
  }

  // 处理网络错误
  private handleNetworkError(error: any, context?: string) {
    console.warn('Network error in resumable upload:', error.message, context)
    
    // 触发恢复检查
    this.monitorAndRecover()
  }

  // 创建新的上传会话
  async createUploadSession(items: BatchUploadItem[]): Promise<string> {
    const sessionId = crypto.randomUUID()
    const networkState = networkStateDetector.getCurrentState()
    
    // 计算总大小和分块
    const { totalSize, blocks } = await this.createDataBlocks(items)
    
    const session: SessionState = {
      id: sessionId,
      startTime: new Date(),
      status: 'active',
      totalItems: items.length,
      processedItems: 0,
      failedItems: 0,
      remainingItems: items.length,
      checksums: new Map(),
      uploadedBlocks: new Set(),
      pendingBlocks: new Set(blocks.map(block => block.id)),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      networkSnapshot: {
        isOnline: networkState.isOnline,
        quality: networkState.quality,
        downlink: networkState.downlink || 0,
        rtt: networkState.rtt || 0,
        effectiveType: networkState.effectiveType || 'unknown',
        timestamp: new Date()
      },
      metadata: {
        totalSize,
        uploadedSize: 0,
        compressionRatio: 0,
        estimatedTimeRemaining: 0
      }
    }

    // 存储数据块
    for (const block of blocks) {
      this.dataBlocks.set(block.id, [block])
    }

    // 存储会话
    this.activeSessions.set(sessionId, session)
    
    // 计算校验和
    await this.calculateChecksums(session, items)
    
    console.log(`Created upload session: ${sessionId} with ${items.length} items`)
    
    return sessionId
  }

  // 创建数据块
  private async createDataBlocks(items: BatchUploadItem[]): Promise<{ totalSize: number; blocks: DataBlock[] }> {
    const blocks: DataBlock[] = []
    let totalSize = 0
    let sequence = 0

    for (const item of items) {
      const itemData = JSON.stringify(item.data)
      const itemSize = new Blob([itemData]).size
      totalSize += itemSize

      // 根据大小决定是否分块
      if (itemSize > this.config.blockSize) {
        // 分块处理
        const blockCount = Math.ceil(itemSize / this.config.blockSize)
        
        for (let i = 0; i < blockCount; i++) {
          const start = i * this.config.blockSize
          const end = Math.min(start + this.config.blockSize, itemSize)
          const blockData = itemData.substring(start, end)
          
          const block: DataBlock = {
            id: `${item.id}-block-${i}`,
            itemId: item.id,
            sequence: i,
            data: blockData,
            size: end - start,
            checksum: await this.calculateChecksum(blockData),
            compressed: false,
            uploaded: false,
            retryCount: 0
          }
          
          blocks.push(block)
        }
      } else {
        // 单块处理
        const block: DataBlock = {
          id: `${item.id}-block-0`,
          itemId: item.id,
          sequence: 0,
          data: itemData,
          size: itemSize,
          checksum: await this.calculateChecksum(itemData),
          compressed: false,
          uploaded: false,
          retryCount: 0
        }
        
        blocks.push(block)
      }
    }

    return { totalSize, blocks }
  }

  // 计算校验和
  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    
    switch (this.config.checksumAlgorithm) {
      case 'sha256':
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        
      case 'md5':
        // MD5 可能不被支持，使用 SHA-256 作为替代
        const md5Buffer = await crypto.subtle.digest('SHA-256', dataBuffer)
        const md5Array = Array.from(new Uint8Array(md5Buffer))
        return md5Array.map(b => b.toString(16).padStart(2, '0')).join('')
        
      case 'sha1':
        const sha1Buffer = await crypto.subtle.digest('SHA-1', dataBuffer)
        const sha1Array = Array.from(new Uint8Array(sha1Buffer))
        return sha1Array.map(b => b.toString(16).padStart(2, '0')).join('')
        
      case 'crc32':
        // 简单的 CRC32 实现
        return this.simpleCRC32(data)
        
      default:
        return data.length.toString() // 简单的校验
    }
  }

  // 简单的 CRC32 实现
  private simpleCRC32(data: string): string {
    let crc = 0xFFFFFFFF
    const table = new Array(256)
    
    // 生成 CRC32 表
    for (let i = 0; i < 256; i++) {
      let crc = i
      for (let j = 0; j < 8; j++) {
        crc = crc & 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1
      }
      table[i] = crc
    }
    
    // 计算 CRC32
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ data.charCodeAt(i)) & 0xFF]
    }
    
    return (crc ^ 0xFFFFFFFF).toString(16)
  }

  // 计算会话校验和
  private async calculateChecksums(session: SessionState, items: BatchUploadItem[]) {
    for (const item of items) {
      const checksum = await this.calculateChecksum(JSON.stringify(item.data))
      session.checksums.set(item.id, checksum)
    }
  }

  // 上传数据块
  async uploadDataBlock(sessionId: string, blockId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const blocks = this.dataBlocks.get(blockId)
    if (!blocks || blocks.length === 0) {
      throw new Error('Block not found')
    }

    const block = blocks[0]
    if (block.uploaded) {
      return true
    }

    try {
      // 验证数据完整性
      if (this.config.enableValidation) {
        const isValid = await this.validateBlock(block)
        if (!isValid) {
          throw new Error('Data validation failed')
        }
      }

      // 执行上传
      const success = await this.performBlockUpload(block, session)
      
      if (success) {
        // 更新状态
        block.uploaded = true
        block.lastAttempt = new Date()
        session.uploadedBlocks.add(blockId)
        session.pendingBlocks.delete(blockId)
        
        // 更新元数据
        session.metadata.uploadedSize += block.size
        session.processedItems++
        
        // 检查是否完成
        if (session.pendingBlocks.size === 0) {
          await this.completeSession(sessionId)
        }
        
        return true
      } else {
        throw new Error('Upload failed')
      }
      
    } catch (error) {
      // 处理上传失败
      block.retryCount++
      block.lastAttempt = new Date()
      
      session.failedItems++
      session.retryCount++
      
      // 记录错误
      console.error(`Block upload failed: ${blockId}`, error)
      
      // 触发恢复
      if (this.config.autoRecovery) {
        await this.attemptRecovery(session, block, error)
      }
      
      return false
    }
  }

  // 验证数据块
  private async validateBlock(block: DataBlock): Promise<boolean> {
    const validation = await this.validationService.validateBlock(block)
    return validation.validated
  }

  // 执行数据块上传
  private async performBlockUpload(block: DataBlock, session: SessionState): Promise<boolean> {
    try {
      // 这里集成实际的上传逻辑
      // 模拟上传过程
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500))
      
      // 模拟网络问题
      if (Math.random() < 0.1) { // 10% 失败率
        throw new Error('Network error during upload')
      }
      
      return true
      
    } catch (error) {
      console.warn('Block upload failed:', error)
      throw error
    }
  }

  // 完成会话
  private async completeSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId)
    if (!session) return

    session.status = 'completed'
    session.endTime = new Date()
    
    // 最终验证
    if (this.config.enableValidation) {
      const isValid = await this.validateSession(session)
      if (!isValid) {
        session.status = 'failed'
        throw new Error('Session validation failed')
      }
    }

    // 移动到历史记录
    this.sessionHistory.push(session)
    this.activeSessions.delete(sessionId)
    
    // 清理数据块
    this.cleanupSessionData(sessionId)
    
    console.log(`Upload session completed: ${sessionId}`)
  }

  // 验证会话
  private async validateSession(session: SessionState): Promise<boolean> {
    // 检查所有数据块是否已上传
    if (session.pendingBlocks.size > 0) {
      return false
    }
    
    // 验证数据完整性
    for (const [itemId, checksum] of session.checksums) {
      const isValid = await this.validationService.validateItem(itemId, checksum)
      if (!isValid) {
        return false
      }
    }
    
    return true
  }

  // 尝试恢复
  private async attemptRecovery(session: SessionState, block: DataBlock, error: any) {
    const classification = this.classifyError(error)
    
    // 选择恢复策略
    const strategyName = classification.recoveryStrategy
    const strategy = this.recoveryStrategies.get(strategyName)
    
    if (!strategy) {
      console.warn(`No recovery strategy found for: ${strategyName}`)
      return
    }
    
    // 检查是否可以恢复
    const context: RecoveryContext = {
      error,
      session,
      failedBlocks: [block],
      networkState: session.networkSnapshot,
      timestamp: new Date(),
      retryCount: session.retryCount
    }
    
    if (!strategy.canRecover(error, context)) {
      console.warn('Recovery not possible for this error')
      return
    }
    
    // 执行恢复
    try {
      const result = await strategy.recover(context)
      console.log(`Recovery result: ${result.message}`)
      
      if (result.success) {
        // 根据恢复结果执行相应操作
        switch (result.action) {
          case 'retry':
            // 重新安排上传
            setTimeout(() => {
              this.uploadDataBlock(session.id, block.id)
            }, 1000)
            break
            
          case 'skip':
            // 跳过此块
            session.pendingBlocks.delete(block.id)
            break
            
          case 'rebuild':
            // 数据已重建，重新上传
            setTimeout(() => {
              this.uploadDataBlock(session.id, block.id)
            }, 1000)
            break
        }
      }
      
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError)
    }
  }

  // 分类错误
  private classifyError(error: any): ErrorClassification {
    const message = error.message?.toLowerCase() || ''
    
    // 网络错误
    if (message.includes('network') || 
        message.includes('connection') || 
        message.includes('timeout') ||
        message.includes('offline')) {
      return {
        type: 'network',
        severity: 'medium',
        retryable: true,
        recoveryStrategy: 'network-retry',
        message: error.message
      }
    }
    
    // 验证错误
    if (message.includes('validation') || 
        message.includes('checksum') || 
        message.includes('corruption')) {
      return {
        type: 'validation',
        severity: 'high',
        retryable: true,
        recoveryStrategy: 'data-rebuild',
        message: error.message
      }
    }
    
    // 服务器错误
    if (message.includes('server') || 
        message.includes('500') || 
        message.includes('502')) {
      return {
        type: 'server',
        severity: 'high',
        retryable: true,
        recoveryStrategy: 'network-retry',
        message: error.message
      }
    }
    
    // 客户端错误
    if (message.includes('client') || 
        message.includes('400') || 
        message.includes('401')) {
      return {
        type: 'client',
        severity: 'medium',
        retryable: false,
        recoveryStrategy: 'skip-item',
        message: error.message
      }
    }
    
    // 未知错误
    return {
      type: 'unknown',
      severity: 'medium',
      retryable: true,
      recoveryStrategy: 'network-retry',
      message: error.message
    }
  }

  // 计算重试延迟
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.retryDelay
    const backoff = Math.pow(this.config.retryBackoff, retryCount)
    const jitter = 1 + (Math.random() - 0.5) * this.config.retryJitter
    
    return Math.min(baseDelay * backoff * jitter, 60000) // 最大60秒
  }

  // 重建数据块
  private async rebuildDataBlock(block: DataBlock): Promise<DataBlock[]> {
    // 重新压缩数据
    const compressionResult = await dataCompressionOptimizer.compressData(block.data)
    
    // 创建新的数据块
    const newBlock: DataBlock = {
      ...block,
      data: compressionResult.success ? compressionResult.original : block.data,
      checksum: await this.calculateChecksum(JSON.stringify(block.data)),
      compressed: compressionResult.success,
      retryCount: 0
    }
    
    return [newBlock]
  }

  // 重启会话
  private async restartSession(oldSession: SessionState): Promise<SessionState> {
    // 创建新的会话
    const newSessionId = crypto.randomUUID()
    const newSession: SessionState = {
      ...oldSession,
      id: newSessionId,
      startTime: new Date(),
      status: 'active',
      retryCount: 0,
      processedItems: 0,
      failedItems: 0,
      uploadedBlocks: new Set(),
      pendingBlocks: new Set(oldSession.pendingBlocks),
      networkSnapshot: networkStateDetector.getCurrentState()
    }
    
    // 更新会话映射
    this.activeSessions.delete(oldSession.id)
    this.activeSessions.set(newSessionId, newSession)
    
    return newSession
  }

  // 监控和恢复
  private async monitorAndRecover() {
    for (const session of this.activeSessions.values()) {
      // 检查会话超时
      if (this.isSessionTimeout(session)) {
        await this.handleSessionTimeout(session)
        continue
      }
      
      // 检查失败的会话
      if (session.status === 'failed' && session.retryCount < session.maxRetries) {
        await this.retryFailedSession(session)
      }
    }
  }

  // 检查会话是否超时
  private isSessionTimeout(session: SessionState): boolean {
    const now = Date.now()
    const sessionAge = now - session.startTime.getTime()
    
    return sessionAge > this.config.sessionTimeout
  }

  // 处理会话超时
  private async handleSessionTimeout(session: SessionState) {
    console.log(`Session timeout: ${session.id}`)
    
    if (session.retryCount < session.maxRetries) {
      // 重试会话
      await this.retryFailedSession(session)
    } else {
      // 标记为失败
      session.status = 'failed'
      session.endTime = new Date()
      
      // 移动到历史记录
      this.sessionHistory.push(session)
      this.activeSessions.delete(session.id)
      
      // 清理数据
      this.cleanupSessionData(session.id)
    }
  }

  // 重试失败的会话
  private async retryFailedSession(session: SessionState) {
    session.status = 'resuming'
    session.retryCount++
    session.lastRetryTime = new Date()
    
    // 重新上传未完成的块
    const pendingBlocks = Array.from(session.pendingBlocks)
    
    for (const blockId of pendingBlocks) {
      const blocks = this.dataBlocks.get(blockId)
      if (blocks && blocks.length > 0) {
        const block = blocks[0]
        block.retryCount = 0
        
        // 延迟重试
        setTimeout(() => {
          this.uploadDataBlock(session.id, blockId)
        }, this.calculateRetryDelay(session.retryCount))
      }
    }
  }

  // 检查可恢复的会话
  private async checkRecoverableSessions() {
    for (const session of this.activeSessions.values()) {
      if (session.status === 'paused' || session.status === 'failed') {
        await this.retryFailedSession(session)
      }
    }
  }

  // 恢复会话状态
  private async restoreSessions() {
    try {
      const stored = localStorage.getItem('cardall_resumable_sessions')
      if (stored) {
        const sessions = JSON.parse(stored)
        
        for (const sessionData of sessions) {
          const session: SessionState = {
            ...sessionData,
            startTime: new Date(sessionData.startTime),
            endTime: sessionData.endTime ? new Date(sessionData.endTime) : undefined,
            lastRetryTime: sessionData.lastRetryTime ? new Date(sessionData.lastRetryTime) : undefined,
            checksums: new Map(sessionData.checksums),
            uploadedBlocks: new Set(sessionData.uploadedBlocks),
            pendingBlocks: new Set(sessionData.pendingBlocks),
            networkSnapshot: {
              ...sessionData.networkSnapshot,
              timestamp: new Date(sessionData.networkSnapshot.timestamp)
            }
          }
          
          // 检查会话是否仍然有效
          if (this.isValidSession(session)) {
            this.activeSessions.set(session.id, session)
            console.log(`Restored session: ${session.id}`)
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore sessions:', error)
    }
  }

  // 检查会话是否有效
  private isValidSession(session: SessionState): boolean {
    const now = Date.now()
    const sessionAge = now - session.startTime.getTime()
    
    return sessionAge < this.config.maxSessionAge && 
           session.status !== 'completed'
  }

  // 持久化会话状态
  private async persistSessionState() {
    try {
      const sessions = Array.from(this.activeSessions.values()).map(session => ({
        ...session,
        checksums: Array.from(session.checksums.entries()),
        uploadedBlocks: Array.from(session.uploadedBlocks),
        pendingBlocks: Array.from(session.pendingBlocks)
      }))
      
      localStorage.setItem('cardall_resumable_sessions', JSON.stringify(sessions))
    } catch (error) {
      console.error('Failed to persist sessions:', error)
    }
  }

  // 清理会话数据
  private cleanupSessionData(sessionId: string) {
    // 清理数据块
    for (const [blockId, blocks] of this.dataBlocks.entries()) {
      if (blocks[0]?.itemId?.startsWith(sessionId)) {
        this.dataBlocks.delete(blockId)
      }
    }
  }

  // 获取会话状态
  getSessionStatus(sessionId: string): SessionState | null {
    return this.activeSessions.get(sessionId) || null
  }

  // 获取所有活跃会话
  getActiveSessions(): SessionState[] {
    return Array.from(this.activeSessions.values())
  }

  // 获取恢复统计
  getRecoveryStats() {
    const totalSessions = this.sessionHistory.length
    const successfulSessions = this.sessionHistory.filter(s => s.status === 'completed').length
    const failedSessions = this.sessionHistory.filter(s => s.status === 'failed').length
    
    const successRate = totalSessions > 0 ? successfulSessions / totalSessions : 0
    
    return {
      totalSessions,
      successfulSessions,
      failedSessions,
      successRate,
      averageRetries: this.sessionHistory.reduce((sum, s) => sum + s.retryCount, 0) / Math.max(1, totalSessions),
      activeSessions: this.activeSessions.size
    }
  }

  // 取消会话
  async cancelSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId)
    if (!session) return

    session.status = 'failed'
    session.endTime = new Date()
    
    // 移动到历史记录
    this.sessionHistory.push(session)
    this.activeSessions.delete(sessionId)
    
    // 清理数据
    this.cleanupSessionData(sessionId)
    
    console.log(`Session cancelled: ${sessionId}`)
  }

  // 暂停会话
  async pauseSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId)
    if (!session) return

    session.status = 'paused'
    console.log(`Session paused: ${sessionId}`)
  }

  // 恢复会话
  async resumeSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId)
    if (!session) return

    session.status = 'active'
    console.log(`Session resumed: ${sessionId}`)
    
    // 开始重新上传
    await this.retryFailedSession(session)
  }

  // 更新配置
  updateConfig(newConfig: Partial<ResumableUploadConfig>) {
    this.config = { ...this.config, ...newConfig }
    console.log('Resumable upload config updated')
  }

  // 销毁服务
  destroy() {
    if (this.persistenceInterval) {
      clearInterval(this.persistenceInterval)
    }
    
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval)
    }
    
    this.persistSessionState()
    
    console.log('Resumable upload service destroyed')
  }
}

// 数据完整性验证服务
class IntegrityValidationService {
  async validateBlock(block: DataBlock): Promise<IntegrityValidation> {
    const errors: IntegrityError[] = []
    let validated = true

    // 验证校验和
    const currentChecksum = await this.calculateChecksum(block.data)
    if (currentChecksum !== block.checksum) {
      errors.push({
        type: 'checksum_mismatch',
        description: 'Block checksum mismatch',
        severity: 'error',
        recoverable: true
      })
      validated = false
    }

    // 验证数据格式
    try {
      JSON.parse(block.data)
    } catch (error) {
      errors.push({
        type: 'invalid_format',
        description: 'Invalid data format',
        severity: 'error',
        recoverable: false
      })
      validated = false
    }

    return {
      itemId: block.itemId,
      checksum: currentChecksum,
      algorithm: 'sha256',
      validated,
      validationTime: new Date(),
      errors
    }
  }

  async validateItem(itemId: string, expectedChecksum: string): Promise<boolean> {
    // 这里需要实现项目级别的验证
    // 可以从存储中检索项目数据并验证校验和
    return true
  }

  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

// 导出服务实例
export const resumableUploadService = new ResumableUploadService()

// 导出类型
export type {
  SessionState,
  NetworkSnapshot,
  DataBlock,
  RecoveryStrategy,
  RecoveryContext,
  RecoveryResult,
  ErrorClassification,
  IntegrityValidation,
  IntegrityError,
  ResumableUploadConfig
}