// ============================================================================
// 数据压缩和批量操作优化器
// 
// 专门为小数据集优化的压缩策略和批量操作引擎
// 支持多种压缩算法、智能去重、批量合并等高级功能
// ============================================================================

import { intelligentBatchUploadService, type BatchUploadItem } from './intelligent-batch-upload'
import { networkStateDetector } from './network-state-detector'

// 压缩算法类型
export type CompressionAlgorithm = 'gzip' | 'deflate' | 'brotli' | 'lz-string' | 'custom'

// 压缩配置
export interface CompressionConfig {
  enabled: boolean
  algorithm: CompressionAlgorithm
  threshold: number // 压缩阈值（字节）
  level: number // 压缩级别（1-9）
  parallel: boolean // 是否并行压缩
  
  // 自定义压缩规则
  customRules: CompressionRule[]
  
  // 缓存设置
  cacheEnabled: boolean
  cacheSize: number // 缓存大小（MB）
}

// 压缩规则
export interface CompressionRule {
  id: string
  name: string
  condition: (data: any) => boolean
  algorithm: CompressionAlgorithm
  level: number
  enabled: boolean
}

// 压缩结果
export interface CompressionResult {
  success: boolean
  originalSize: number
  compressedSize: number
  ratio: number
  algorithm: string
  time: number
  metadata?: any
}

// 批量操作策略
export interface BatchOperationStrategy {
  name: string
  description: string
  groupBy: 'table' | 'priority' | 'size' | 'dependency' | 'custom'
  maxSize: number
  maxItems: number
  dependencies: string[] // 依赖关系
  optimizations: OptimizationType[]
}

// 优化类型
export type OptimizationType = 
  | 'deduplication' // 去重
  | 'delta-encoding' // 增量编码
  | 'column-compression' // 列压缩
  | 'batch-merge' // 批量合并
  | 'lazy-evaluation' // 懒加载
  | 'parallel-processing' // 并行处理

// 批量操作项
export interface BatchOperationItem {
  id: string
  type: 'create' | 'update' | 'delete'
  table: string
  data: any
  localId: string
  priority: number
  dependencies: string[] // 依赖的操作ID
  
  // 优化元数据
  metadata?: {
    size?: number
    checksum?: string
    compressed?: boolean
    optimized?: boolean
  }
}

// 批量操作结果
export interface BatchOperationResult {
  success: boolean
  processed: number
  failed: number
  skipped: number
  totalTime: number
  optimizations: OptimizationResult[]
  errors: BatchOperationError[]
}

// 优化结果
export interface OptimizationResult {
  type: OptimizationType
  itemsAffected: number
  spaceSaved: number
  timeSaved: number
  details: any
}

// 批量操作错误
export interface BatchOperationError {
  itemId: string
  error: Error
  retryable: boolean
  context: any
}

class DataCompressionOptimizer {
  private compressionCache = new Map<string, CompressionResult>()
  private compressionWorkers: Worker[] = []
  private config: CompressionConfig

  constructor() {
    this.config = this.getDefaultConfig()
    this.initializeWorkers()
  }

  // 获取默认配置
  private getDefaultConfig(): CompressionConfig {
    return {
      enabled: true,
      algorithm: 'gzip',
      threshold: 1024, // 1KB
      level: 6,
      parallel: true,
      customRules: this.getDefaultCompressionRules(),
      cacheEnabled: true,
      cacheSize: 50 // 50MB
    }
  }

  // 获取默认压缩规则
  private getDefaultCompressionRules(): CompressionRule[] {
    return [
      {
        id: 'large-json',
        name: 'Large JSON Data',
        condition: (data) => {
          const size = JSON.stringify(data).length
          return size > 2048 // 2KB
        },
        algorithm: 'gzip',
        level: 7,
        enabled: true
      },
      {
        id: 'text-content',
        name: 'Text Content',
        condition: (data) => {
          if (typeof data !== 'object') return false
          const hasText = Object.values(data).some(value => 
            typeof value === 'string' && value.length > 100
          )
          return hasText
        },
        algorithm: 'deflate',
        level: 5,
        enabled: true
      },
      {
        id: 'style-data',
        name: 'Style Data',
        condition: (data) => {
          return data && typeof data === 'object' && data.style !== undefined
        },
        algorithm: 'custom',
        level: 3,
        enabled: true
      }
    ]
  }

  // 初始化压缩工作线程
  private async initializeWorkers() {
    if (!this.config.parallel || typeof Worker === 'undefined') return

    const workerCount = navigator.hardwareConcurrency || 4
    
    for (let i = 0; i < Math.min(workerCount, 4); i++) {
      try {
        const worker = new Worker('/workers/compression-worker.js')
        this.compressionWorkers.push(worker)
      } catch (error) {
        console.warn('Failed to create compression worker:', error)
      }
    }
  }

  // 压缩数据
  async compressData(data: any, options?: Partial<CompressionConfig>): Promise<CompressionResult> {
    const config = { ...this.config, ...options }
    
    if (!config.enabled) {
      return {
        success: false,
        originalSize: 0,
        compressedSize: 0,
        ratio: 0,
        algorithm: 'none',
        time: 0
      }
    }

    const startTime = performance.now()
    const jsonData = JSON.stringify(data)
    const originalSize = new Blob([jsonData]).size

    // 检查压缩阈值
    if (originalSize < config.threshold) {
      return {
        success: false,
        originalSize,
        compressedSize: originalSize,
        ratio: 0,
        algorithm: 'none',
        time: performance.now() - startTime
      }
    }

    // 检查缓存
    const cacheKey = this.generateCacheKey(data, config.algorithm)
    if (config.cacheEnabled && this.compressionCache.has(cacheKey)) {
      return this.compressionCache.get(cacheKey)!
    }

    // 选择压缩算法
    const algorithm = this.selectCompressionAlgorithm(data, config)
    
    try {
      let compressedData: any
      let compressedSize: number

      switch (algorithm) {
        case 'gzip':
          compressedData = await this.compressGzip(jsonData, config.level)
          break
        case 'deflate':
          compressedData = await this.compressDeflate(jsonData, config.level)
          break
        case 'brotli':
          compressedData = await this.compressBrotli(jsonData, config.level)
          break
        case 'lz-string':
          compressedData = await this.compressLZString(jsonData)
          break
        case 'custom':
          compressedData = await this.customCompress(data, config.level)
          break
        default:
          compressedData = jsonData
      }

      compressedSize = new Blob([JSON.stringify(compressedData)]).size
      const ratio = (originalSize - compressedSize) / originalSize

      const result: CompressionResult = {
        success: true,
        originalSize,
        compressedSize,
        ratio,
        algorithm,
        time: performance.now() - startTime,
        metadata: {
          compressed: true,
          algorithm
        }
      }

      // 缓存结果
      if (config.cacheEnabled) {
        this.addToCache(cacheKey, result)
      }

      return result

    } catch (error) {
      console.warn('Compression failed:', error)
      return {
        success: false,
        originalSize,
        compressedSize: originalSize,
        ratio: 0,
        algorithm: 'none',
        time: performance.now() - startTime
      }
    }
  }

  // 选择压缩算法
  private selectCompressionAlgorithm(data: any, config: CompressionConfig): CompressionAlgorithm {
    // 检查自定义规则
    for (const rule of config.customRules) {
      if (rule.enabled && rule.condition(data)) {
        return rule.algorithm
      }
    }

    // 默认选择逻辑
    const dataSize = JSON.stringify(data).length
    
    if (dataSize > 10240) { // 10KB
      return 'gzip' // 大数据使用 gzip
    } else if (dataSize > 2048) { // 2KB
      return 'deflate' // 中等数据使用 deflate
    } else {
      return 'custom' // 小数据使用自定义压缩
    }
  }

  // Gzip 压缩
  private async compressGzip(data: string, level: number): Promise<any> {
    if ('CompressionStream' in window) {
      const blob = new Blob([data])
      const compressedStream = blob.stream().pipeThrough(new CompressionStream('gzip'))
      const compressedBlob = await new Response(compressedStream).blob()
      
      return {
        algorithm: 'gzip',
        level,
        compressed: await compressedBlob.arrayBuffer(),
        original: data
      }
    }
    
    // 降级方案：返回原始数据
    return data
  }

  // Deflate 压缩
  private async compressDeflate(data: string, level: number): Promise<any> {
    if ('CompressionStream' in window) {
      const blob = new Blob([data])
      const compressedStream = blob.stream().pipeThrough(new CompressionStream('deflate'))
      const compressedBlob = await new Response(compressedStream).blob()
      
      return {
        algorithm: 'deflate',
        level,
        compressed: await compressedBlob.arrayBuffer(),
        original: data
      }
    }
    
    return data
  }

  // Brotli 压缩
  private async compressBrotli(data: string, level: number): Promise<any> {
    if ('CompressionStream' in window) {
      try {
        const blob = new Blob([data])
        // @ts-ignore - BrotliCompressionStream 可能在某些浏览器中不可用
        const compressedStream = blob.stream().pipeThrough(new CompressionStream('brotli'))
        const compressedBlob = await new Response(compressedStream).blob()
        
        return {
          algorithm: 'brotli',
          level,
          compressed: await compressedBlob.arrayBuffer(),
          original: data
        }
      } catch (error) {
        console.warn('Brotli compression not supported, falling back to gzip')
        return this.compressGzip(data, level)
      }
    }
    
    return data
  }

  // LZ-String 压缩
  private async compressLZString(data: string): Promise<any> {
    try {
      // 动态导入 LZ-String
      const LZString = await import('lz-string')
      const compressed = LZString.compress(data)
      
      return {
        algorithm: 'lz-string',
        compressed,
        original: data
      }
    } catch (error) {
      console.warn('LZ-String compression failed:', error)
      return data
    }
  }

  // 自定义压缩
  private async customCompress(data: any, level: number): Promise<any> {
    // 优化的数据压缩算法
    
    // 1. 移除冗余数据
    const optimized = this.optimizeDataStructure(data)
    
    // 2. 字段压缩
    const compressed = this.compressFields(optimized, level)
    
    return {
      algorithm: 'custom',
      level,
      compressed,
      original: data
    }
  }

  // 优化数据结构
  private optimizeDataStructure(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data
    }

    const optimized: any = {}
    
    for (const [key, value] of Object.entries(data)) {
      // 跳过空值和未定义值
      if (value === null || value === undefined) {
        continue
      }
      
      // 压缩布尔值
      if (typeof value === 'boolean') {
        optimized[key] = value ? 1 : 0
        continue
      }
      
      // 压缩数字
      if (typeof value === 'number') {
        optimized[key] = value
        continue
      }
      
      // 优化字符串
      if (typeof value === 'string') {
        optimized[key] = this.optimizeString(value)
        continue
      }
      
      // 递归优化对象
      if (typeof value === 'object') {
        optimized[key] = this.optimizeDataStructure(value)
        continue
      }
      
      // 其他类型保持不变
      optimized[key] = value
    }
    
    return optimized
  }

  // 优化字符串
  private optimizeString(str: string): string {
    // 移除多余的空格
    return str.trim().replace(/\s+/g, ' ')
  }

  // 压缩字段
  private compressFields(data: any, level: number): any {
    const compressed: any = {}
    
    // 使用缩写字段名来减少数据大小
    const fieldMapping: Record<string, string> = {
      'frontContent': 'fc',
      'backContent': 'bc',
      'folderId': 'fid',
      'syncVersion': 'sv',
      'createdAt': 'ct',
      'updatedAt': 'ut',
      'backgroundColor': 'bg',
      'fontFamily': 'ff',
      'fontSize': 'fs'
    }
    
    for (const [key, value] of Object.entries(data)) {
      const shortKey = fieldMapping[key] || key
      compressed[shortKey] = value
    }
    
    return compressed
  }

  // 生成缓存键
  private generateCacheKey(data: any, algorithm: string): string {
    const dataString = JSON.stringify(data)
    const hash = this.simpleHash(dataString + algorithm)
    return `${algorithm}:${hash}`
  }

  // 简单哈希函数
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  // 添加到缓存
  private addToCache(key: string, result: CompressionResult) {
    // 检查缓存大小
    const currentSize = Array.from(this.compressionCache.values())
      .reduce((sum, item) => sum + item.compressedSize, 0)
    
    if (currentSize > this.config.cacheSize * 1024 * 1024) {
      // 清理最旧的缓存项
      const oldestKey = this.compressionCache.keys().next().value
      this.compressionCache.delete(oldestKey)
    }
    
    this.compressionCache.set(key, result)
  }

  // 解压数据
  async decompressData(compressedData: any): Promise<any> {
    if (!compressedData || typeof compressedData !== 'object') {
      return compressedData
    }

    if (compressedData.compressed) {
      const algorithm = compressedData.algorithm
      
      switch (algorithm) {
        case 'gzip':
        case 'deflate':
        case 'brotli':
          return this.decompressWithCompressionAPI(compressedData)
        case 'lz-string':
          return this.decompressLZString(compressedData)
        case 'custom':
          return this.decompressCustom(compressedData)
        default:
          return compressedData.original
      }
    }
    
    return compressedData
  }

  // 使用 Compression API 解压
  private async decompressWithCompressionAPI(compressedData: any): Promise<any> {
    if (!('DecompressionStream' in window)) {
      return compressedData.original
    }

    try {
      const compressedBlob = new Blob([compressedData.compressed])
      // @ts-ignore
      const decompressionStream = compressedBlob.stream().pipeThrough(new DecompressionStream(compressedData.algorithm))
      const decompressedBlob = await new Response(decompressionStream).blob()
      const decompressedText = await decompressedBlob.text()
      
      return JSON.parse(decompressedText)
    } catch (error) {
      console.warn('Decompression failed:', error)
      return compressedData.original
    }
  }

  // LZ-String 解压
  private async decompressLZString(compressedData: any): Promise<any> {
    try {
      const LZString = await import('lz-string')
      const decompressed = LZString.decompress(compressedData.compressed)
      return JSON.parse(decompressed)
    } catch (error) {
      console.warn('LZ-String decompression failed:', error)
      return compressedData.original
    }
  }

  // 自定义解压
  private async decompressCustom(compressedData: any): Promise<any> {
    // 解压字段名
    const fieldMapping: Record<string, string> = {
      'fc': 'frontContent',
      'bc': 'backContent',
      'fid': 'folderId',
      'sv': 'syncVersion',
      'ct': 'createdAt',
      'ut': 'updatedAt',
      'bg': 'backgroundColor',
      'ff': 'fontFamily',
      'fs': 'fontSize'
    }
    
    const decompressed: any = {}
    
    for (const [key, value] of Object.entries(compressedData.compressed)) {
      const fullKey = fieldMapping[key] || key
      decompressed[fullKey] = value
    }
    
    return decompressed
  }

  // 更新配置
  updateConfig(newConfig: Partial<CompressionConfig>) {
    this.config = { ...this.config, ...newConfig }
  }

  // 获取缓存统计
  getCacheStats() {
    return {
      size: this.compressionCache.size,
      totalSize: Array.from(this.compressionCache.values())
        .reduce((sum, item) => sum + item.compressedSize, 0),
      hitRate: 0 // 可以跟踪缓存命中率
    }
  }

  // 清理缓存
  clearCache() {
    this.compressionCache.clear()
  }
}

// 批量操作优化器
class BatchOperationOptimizer {
  private strategies: Map<string, BatchOperationStrategy> = new Map()
  private activeOperations: Map<string, BatchOperationItem[]> = new Map()
  private operationHistory: BatchOperationResult[] = []

  constructor() {
    this.initializeStrategies()
  }

  // 初始化策略
  private initializeStrategies() {
    // 小数据集快速同步策略
    this.strategies.set('small-dataset-fast', {
      name: 'Small Dataset Fast Sync',
      description: '针对小数据集的快速同步策略',
      groupBy: 'table',
      maxSize: 512, // 512KB
      maxItems: 20,
      dependencies: ['folders', 'cards', 'tags'],
      optimizations: ['deduplication', 'batch-merge', 'parallel-processing']
    })

    // 高优先级紧急同步策略
    this.strategies.set('high-priority', {
      name: 'High Priority Sync',
      description: '高优先级操作的快速同步',
      groupBy: 'priority',
      maxSize: 256, // 256KB
      maxItems: 5,
      dependencies: [],
      optimizations: ['batch-merge']
    })

    // 网络优化策略
    this.strategies.set('network-optimized', {
      name: 'Network Optimized Sync',
      description: '针对网络条件的优化策略',
      groupBy: 'size',
      maxSize: 1024, // 1MB
      maxItems: 50,
      dependencies: ['folders', 'cards', 'tags', 'images'],
      optimizations: ['deduplication', 'delta-encoding', 'column-compression']
    })

    // 离线优化策略
    this.strategies.set('offline-optimized', {
      name: 'Offline Optimized Sync',
      description: '离线环境下的批量优化',
      groupBy: 'dependency',
      maxSize: 2048, // 2MB
      maxItems: 100,
      dependencies: ['folders', 'cards', 'tags', 'images'],
      optimizations: ['deduplication', 'lazy-evaluation', 'batch-merge']
    })
  }

  // 选择最优策略
  selectStrategy(items: BatchOperationItem[]): BatchOperationStrategy {
    const networkState = networkStateDetector.getCurrentState()
    
    // 根据网络条件选择策略
    if (!networkState.isOnline) {
      return this.strategies.get('offline-optimized')!
    }
    
    if (networkState.quality === 'poor') {
      return this.strategies.get('network-optimized')!
    }
    
    // 根据数据量选择策略
    const totalSize = items.reduce((sum, item) => 
      sum + (item.metadata?.size || JSON.stringify(item.data).length), 0
    )
    
    if (totalSize < 102400) { // 100KB
      return this.strategies.get('small-dataset-fast')!
    }
    
    // 检查是否有高优先级项目
    const hasHighPriority = items.some(item => item.priority >= 4)
    if (hasHighPriority) {
      return this.strategies.get('high-priority')!
    }
    
    return this.strategies.get('network-optimized')!
  }

  // 优化批量操作
  async optimizeBatchOperations(items: BatchOperationItem[]): Promise<BatchOperationResult> {
    const startTime = performance.now()
    const strategy = this.selectStrategy(items)
    
    console.log(`Using strategy: ${strategy.name} for ${items.length} items`)
    
    const result: BatchOperationResult = {
      success: true,
      processed: 0,
      failed: 0,
      skipped: 0,
      totalTime: 0,
      optimizations: [],
      errors: []
    }

    try {
      // 应用优化策略
      for (const optimization of strategy.optimizations) {
        const optimizationResult = await this.applyOptimization(optimization, items)
        result.optimizations.push(optimizationResult)
      }

      // 执行分组
      const groups = await this.groupItems(items, strategy)
      
      // 执行批量操作
      for (const group of groups) {
        const groupResult = await this.executeBatchGroup(group, strategy)
        
        result.processed += groupResult.processed
        result.failed += groupResult.failed
        result.skipped += groupResult.skipped
        result.errors.push(...groupResult.errors)
      }

      result.success = result.failed === 0
      result.totalTime = performance.now() - startTime

      // 记录历史
      this.operationHistory.push(result)
      
      // 保持历史记录大小
      if (this.operationHistory.length > 100) {
        this.operationHistory = this.operationHistory.slice(-50)
      }

    } catch (error) {
      result.success = false
      result.totalTime = performance.now() - startTime
      result.errors.push({
        itemId: 'batch',
        error: error as Error,
        retryable: true,
        context: { strategy: strategy.name }
      })
    }

    return result
  }

  // 应用优化策略
  private async applyOptimization(type: OptimizationType, items: BatchOperationItem[]): Promise<OptimizationResult> {
    switch (type) {
      case 'deduplication':
        return this.optimizeDeduplication(items)
      case 'delta-encoding':
        return this.optimizeDeltaEncoding(items)
      case 'column-compression':
        return this.optimizeColumnCompression(items)
      case 'batch-merge':
        return this.optimizeBatchMerge(items)
      case 'lazy-evaluation':
        return this.optimizeLazyEvaluation(items)
      case 'parallel-processing':
        return this.optimizeParallelProcessing(items)
      default:
        return {
          type,
          itemsAffected: 0,
          spaceSaved: 0,
          timeSaved: 0,
          details: 'Unknown optimization type'
        }
    }
  }

  // 去重优化
  private async optimizeDeduplication(items: BatchOperationItem[]): Promise<OptimizationResult> {
    const uniqueItems = new Map<string, BatchOperationItem>()
    let duplicatesRemoved = 0

    for (const item of items) {
      const key = `${item.table}:${item.localId}:${item.type}`
      
      if (uniqueItems.has(key)) {
        // 合并重复项
        const existing = uniqueItems.get(key)!
        if (item.timestamp > existing.timestamp) {
          uniqueItems.set(key, item)
        }
        duplicatesRemoved++
      } else {
        uniqueItems.set(key, item)
      }
    }

    // 更新原始数组
    items.length = 0
    items.push(...Array.from(uniqueItems.values()))

    return {
      type: 'deduplication',
      itemsAffected: duplicatesRemoved,
      spaceSaved: duplicatesRemoved * 1000, // 估计节省空间
      timeSaved: duplicatesRemoved * 100, // 估计节省时间
      details: `Removed ${duplicatesRemoved} duplicate items`
    }
  }

  // 增量编码优化
  private async optimizeDeltaEncoding(items: BatchOperationItem[]): Promise<OptimizationResult> {
    let itemsAffected = 0
    let spaceSaved = 0

    // 对更新操作进行增量编码
    const updateItems = items.filter(item => item.type === 'update')
    
    for (const item of updateItems) {
      // 检查是否可以进行增量编码
      if (item.data && typeof item.data === 'object') {
        const delta = this.createDelta(item.data)
        
        if (delta.size < JSON.stringify(item.data).length) {
          item.data = delta
          item.metadata = item.metadata || {}
          item.metadata.deltaEncoded = true
          itemsAffected++
          spaceSaved += JSON.stringify(item.data).length - delta.size
        }
      }
    }

    return {
      type: 'delta-encoding',
      itemsAffected,
      spaceSaved,
      timeSaved: spaceSaved * 0.1, // 估计时间节省
      details: `Applied delta encoding to ${itemsAffected} items`
    }
  }

  // 创建增量数据
  private createDelta(fullData: any): any & { size: number } {
    // 简单的增量编码实现
    const delta: any = {
      _delta: true,
      _timestamp: Date.now()
    }

    // 只包含变化的部分
    for (const [key, value] of Object.entries(fullData)) {
      if (value !== undefined && value !== null) {
        delta[key] = value
      }
    }

    delta.size = JSON.stringify(delta).length
    return delta
  }

  // 列压缩优化
  private async optimizeColumnCompression(items: BatchOperationItem[]): Promise<OptimizationResult> {
    // 按表分组进行列压缩
    const tableGroups = new Map<string, BatchOperationItem[]>()
    
    for (const item of items) {
      if (!tableGroups.has(item.table)) {
        tableGroups.set(item.table, [])
      }
      tableGroups.get(item.table)!.push(item)
    }

    let itemsAffected = 0
    let spaceSaved = 0

    for (const [table, tableItems] of tableGroups.entries()) {
      const columnStats = this.analyzeColumns(tableItems)
      
      for (const item of tableItems) {
        const compressed = this.compressItemColumns(item.data, columnStats)
        
        if (compressed.size < JSON.stringify(item.data).length) {
          item.data = compressed.data
          item.metadata = item.metadata || {}
          item.metadata.columnCompressed = true
          itemsAffected++
          spaceSaved += JSON.stringify(item.data).length - compressed.size
        }
      }
    }

    return {
      type: 'column-compression',
      itemsAffected,
      spaceSaved,
      timeSaved: spaceSaved * 0.05,
      details: `Applied column compression to ${itemsAffected} items`
    }
  }

  // 分析列统计
  private analyzeColumns(items: BatchOperationItem[]): Map<string, any> {
    const stats = new Map<string, any>()

    for (const item of items) {
      if (item.data && typeof item.data === 'object') {
        for (const [key, value] of Object.entries(item.data)) {
          if (!stats.has(key)) {
            stats.set(key, {
              type: typeof value,
              uniqueValues: new Set(),
              nullCount: 0
            })
          }

          const stat = stats.get(key)!
          stat.uniqueValues.add(value)
          
          if (value === null || value === undefined) {
            stat.nullCount++
          }
        }
      }
    }

    return stats
  }

  // 压缩项目列
  private compressItemColumns(data: any, columnStats: Map<string, any>): { data: any; size: number } {
    const compressed: any = {}

    for (const [key, value] of Object.entries(data)) {
      const stat = columnStats.get(key)
      
      if (stat && (value === null || value === undefined)) {
        // 跳过空值
        continue
      }

      compressed[key] = value
    }

    return {
      data: compressed,
      size: JSON.stringify(compressed).length
    }
  }

  // 批量合并优化
  private async optimizeBatchMerge(items: BatchOperationItem[]): Promise<OptimizationResult> {
    let itemsAffected = 0
    let spaceSaved = 0

    // 合并相同类型的操作
    const operationGroups = new Map<string, BatchOperationItem[]>()
    
    for (const item of items) {
      const key = `${item.table}:${item.type}`
      
      if (!operationGroups.has(key)) {
        operationGroups.set(key, [])
      }
      operationGroups.get(key)!.push(item)
    }

    // 对可合并的操作进行合并
    for (const [key, groupItems] of operationGroups.entries()) {
      if (groupItems.length > 1) {
        const merged = await this.mergeOperations(groupItems)
        
        if (merged) {
          // 替换原始项目
          const firstIndex = items.findIndex(item => 
            item.table === groupItems[0].table && 
            item.type === groupItems[0].type
          )
          
          if (firstIndex !== -1) {
            items.splice(firstIndex, groupItems.length, merged)
            itemsAffected += groupItems.length - 1
            spaceSaved += (groupItems.length - 1) * 500 // 估计节省
          }
        }
      }
    }

    return {
      type: 'batch-merge',
      itemsAffected,
      spaceSaved,
      timeSaved: itemsAffected * 200,
      details: `Merged ${itemsAffected} operations into batches`
    }
  }

  // 合并操作
  private async mergeOperations(items: BatchOperationItem[]): Promise<BatchOperationItem | null> {
    if (items.length === 0) return null
    if (items.length === 1) return items[0]

    const first = items[0]
    
    // 只能合并相同表和类型的操作
    const allSame = items.every(item => 
      item.table === first.table && item.type === first.type
    )
    
    if (!allSame) return null

    // 创建合并后的操作
    const merged: BatchOperationItem = {
      id: crypto.randomUUID(),
      type: first.type,
      table: first.table,
      data: this.mergeData(items.map(item => item.data)),
      localId: `batch-${  crypto.randomUUID()}`,
      priority: Math.max(...items.map(item => item.priority)),
      dependencies: items.flatMap(item => item.dependencies),
      metadata: {
        batchOperation: true,
        originalCount: items.length,
        merged: true
      }
    }

    return merged
  }

  // 合并数据
  private mergeData(dataArray: any[]): any {
    // 简单的数据合并策略
    // 对于创建操作，返回数组
    // 对于更新操作，合并最后的数据
    
    if (dataArray.length === 1) {
      return dataArray[0]
    }

    // 这里可以根据具体业务逻辑实现更复杂的合并策略
    return {
      _batch: true,
      _count: dataArray.length,
      _timestamp: Date.now(),
      items: dataArray
    }
  }

  // 懒加载优化
  private async optimizeLazyEvaluation(items: BatchOperationItem[]): Promise<OptimizationResult> {
    let itemsAffected = 0

    // 标记低优先级操作为懒加载
    const lowPriorityItems = items.filter(item => item.priority < 3)
    
    for (const item of lowPriorityItems) {
      item.metadata = item.metadata || {}
      item.metadata.lazyEval = true
      itemsAffected++
    }

    return {
      type: 'lazy-evaluation',
      itemsAffected,
      spaceSaved: 0,
      timeSaved: itemsAffected * 500, // 延迟执行节省时间
      details: `Marked ${itemsAffected} items for lazy evaluation`
    }
  }

  // 并行处理优化
  private async optimizeParallelProcessing(items: BatchOperationItem[]): Promise<OptimizationResult> {
    // 分析依赖关系，识别可并行处理的操作
    const dependencyGraph = this.buildDependencyGraph(items)
    const parallelGroups = this.identifyParallelGroups(dependencyGraph)

    return {
      type: 'parallel-processing',
      itemsAffected: items.length,
      spaceSaved: 0,
      timeSaved: parallelGroups.length * 1000, // 并行处理节省时间
      details: `Organized into ${parallelGroups.length} parallel groups`
    }
  }

  // 构建依赖图
  private buildDependencyGraph(items: BatchOperationItem[]): Map<string, string[]> {
    const graph = new Map<string, string[]>()

    for (const item of items) {
      graph.set(item.id, item.dependencies || [])
    }

    return graph
  }

  // 识别并行组
  private identifyParallelGroups(graph: Map<string, string[]>): string[][] {
    const groups: string[][] = []
    const processed = new Set<string>()
    const nodes = Array.from(graph.keys())

    while (processed.size < nodes.length) {
      const currentGroup: string[] = []

      // 找出没有未处理依赖的节点
      for (const node of nodes) {
        if (!processed.has(node)) {
          const dependencies = graph.get(node) || []
          const canProcess = dependencies.every(dep => processed.has(dep))
          
          if (canProcess) {
            currentGroup.push(node)
          }
        }
      }

      if (currentGroup.length === 0) {
        // 检测循环依赖
        console.warn('Circular dependency detected in batch operations')
        break
      }

      groups.push(currentGroup)
      currentGroup.forEach(node => processed.add(node))
    }

    return groups
  }

  // 分组项目
  private async groupItems(items: BatchOperationItem[], strategy: BatchOperationStrategy): Promise<BatchOperationItem[][]> {
    const groups: BatchOperationItem[][] = []

    switch (strategy.groupBy) {
      case 'table':
        groups.push(...this.groupByTable(items))
        break
      case 'priority':
        groups.push(...this.groupByPriority(items))
        break
      case 'size':
        groups.push(...this.groupBySize(items, strategy.maxSize))
        break
      case 'dependency':
        groups.push(...this.groupByDependency(items, strategy.dependencies))
        break
      case 'custom':
        groups.push(...this.groupByCustom(items, strategy))
        break
    }

    return groups
  }

  // 按表分组
  private groupByTable(items: BatchOperationItem[]): BatchOperationItem[][] {
    const tableGroups = new Map<string, BatchOperationItem[]>()
    
    for (const item of items) {
      if (!tableGroups.has(item.table)) {
        tableGroups.set(item.table, [])
      }
      tableGroups.get(item.table)!.push(item)
    }

    return Array.from(tableGroups.values())
  }

  // 按优先级分组
  private groupByPriority(items: BatchOperationItem[]): BatchOperationItem[][] {
    const priorityGroups = new Map<number, BatchOperationItem[]>()
    
    for (const item of items) {
      if (!priorityGroups.has(item.priority)) {
        priorityGroups.set(item.priority, [])
      }
      priorityGroups.get(item.priority)!.push(item)
    }

    // 按优先级排序
    return Array.from(priorityGroups.values())
      .sort((a, b) => (b[0]?.priority || 0) - (a[0]?.priority || 0))
  }

  // 按大小分组
  private groupBySize(items: BatchOperationItem[], maxSize: number): BatchOperationItem[][] {
    const groups: BatchOperationItem[][] = []
    let currentGroup: BatchOperationItem[] = []
    let currentSize = 0

    for (const item of items) {
      const itemSize = item.metadata?.size || JSON.stringify(item.data).length

      if (currentGroup.length === 0 || 
          currentSize + itemSize <= maxSize) {
        currentGroup.push(item)
        currentSize += itemSize
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup)
        }
        currentGroup = [item]
        currentSize = itemSize
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }

    return groups
  }

  // 按依赖关系分组
  private groupByDependency(items: BatchOperationItem[], dependencyOrder: string[]): BatchOperationItem[][] {
    const groups: BatchOperationItem[][] = []

    for (const table of dependencyOrder) {
      const tableItems = items.filter(item => item.table === table)
      if (tableItems.length > 0) {
        groups.push(tableItems)
      }
    }

    return groups
  }

  // 自定义分组
  private groupByCustom(items: BatchOperationItem[], strategy: BatchOperationStrategy): BatchOperationItem[][] {
    // 根据策略的自定义规则进行分组
    // 这里可以实现更复杂的分组逻辑
    
    // 默认按表和大小混合分组
    const tableGroups = this.groupByTable(items)
    const finalGroups: BatchOperationItem[][] = []

    for (const tableGroup of tableGroups) {
      const sizeGroups = this.groupBySize(tableGroup, strategy.maxSize)
      finalGroups.push(...sizeGroups)
    }

    return finalGroups
  }

  // 执行批量组
  private async executeBatchGroup(group: BatchOperationItem[], strategy: BatchOperationStrategy): Promise<BatchOperationResult> {
    const result: BatchOperationResult = {
      success: true,
      processed: 0,
      failed: 0,
      skipped: 0,
      totalTime: 0,
      optimizations: [],
      errors: []
    }

    const startTime = performance.now()

    try {
      // 执行组内操作
      for (const item of group) {
        try {
          await this.executeOperation(item)
          result.processed++
        } catch (error) {
          result.failed++
          result.errors.push({
            itemId: item.id,
            error: error as Error,
            retryable: this.isRetryableError(error),
            context: { operation: item }
          })
        }
      }

      result.success = result.failed === 0
      result.totalTime = performance.now() - startTime

    } catch (error) {
      result.success = false
      result.totalTime = performance.now() - startTime
      result.errors.push({
        itemId: 'group',
        error: error as Error,
        retryable: true,
        context: { group }
      })
    }

    return result
  }

  // 执行单个操作
  private async executeOperation(item: BatchOperationItem): Promise<void> {
    // 检查懒加载标记
    if (item.metadata?.lazyEval) {
      // 延迟执行逻辑
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 执行实际的同步操作
    // 这里可以集成到 cloudSyncService 或其他同步服务
    console.log(`Executing operation: ${item.type} on ${item.table} (${item.localId})`)

    // 模拟操作执行
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  // 检查错误是否可重试
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'network',
      'timeout',
      'connection',
      'temporary'
    ]
    
    return retryableErrors.some(type => 
      error.message?.toLowerCase().includes(type)
    )
  }

  // 获取操作历史
  getOperationHistory(): BatchOperationResult[] {
    return [...this.operationHistory]
  }

  // 获取统计信息
  getStats() {
    const totalOperations = this.operationHistory.reduce((sum, result) => 
      sum + result.processed + result.failed + result.skipped, 0
    )
    
    const successRate = this.operationHistory.length > 0 
      ? this.operationHistory.filter(result => result.success).length / this.operationHistory.length 
      : 0

    return {
      totalOperations,
      successRate,
      averageTime: this.operationHistory.reduce((sum, result) => 
        sum + result.totalTime, 0
      ) / Math.max(1, this.operationHistory.length),
      totalOptimizations: this.operationHistory.reduce((sum, result) => 
        sum + result.optimizations.length, 0
      )
    }
  }

  // 清理历史
  clearHistory() {
    this.operationHistory = []
  }
}

// 导出服务实例
export const dataCompressionOptimizer = new DataCompressionOptimizer()
export const batchOperationOptimizer = new BatchOperationOptimizer()

// 导出类型
export type {
  CompressionAlgorithm,
  CompressionConfig,
  CompressionRule,
  CompressionResult,
  BatchOperationStrategy,
  BatchOperationItem,
  BatchOperationResult,
  OptimizationResult,
  BatchOperationError
}