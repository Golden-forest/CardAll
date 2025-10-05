/**
 * 网络请求优化和智能缓存机制
 *
 * 提供全面的网络优化功能，包括请求合并、压缩、缓存和智能重试机制
 * 确保在各种网络条件下都能保持最佳的性能表现
 *
 * 核心功能：
 * - 智能请求合并和批处理
 * - 自适应数据压缩
 * - 多层缓存策略
 * - 网络感知优化
 * - 智能重试和错误恢复
 * - 带宽管理和流量控制
 * - 连接池优化
 */

import { performance } from './perf-utils'
import { networkStateDetector } from './network-state-detector'
import { supabase } from './supabase'
import { performanceMonitor } from './performance-monitor'
import { batchOptimizer } from './batch-optimizer'

// ============================================================================
// 类型定义
// ============================================================================

export interface NetworkRequest {
  id: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: any
  priority: 'low' | 'normal' | 'high' | 'critical'
  retryCount: number
  maxRetries: number
  timeout: number
  timestamp: number
  metadata?: {
    source: string
    cacheKey?: string
    compressible?: boolean
    batchable?: boolean
    dependencies?: string[]
  }
}

export interface NetworkResponse {
  request: NetworkRequest
  status: number
  statusText: string
  headers: Record<string, string>
  body: any
  duration: number
  cached: boolean
  compressed: boolean
  fromBatch: boolean
}

export interface CacheEntry {
  key: string
  data: any
  headers: Record<string, string>
  timestamp: number
  expiresAt: number
  size: number
  accessCount: number
  lastAccessed: number
  compressed: boolean
  compressionRatio?: number
}

export interface NetworkConfig {
  // 基础配置
  enableCompression: boolean
  enableCaching: boolean
  enableBatching: boolean
  enableRetry: boolean

  // 缓存配置
  cacheStrategy: 'memory-first' | 'cache-first' | 'network-first'
  defaultCacheTTL: number // 毫秒
  maxCacheSize: number // 字节
  maxCacheEntries: number
  enablePersistentCache: boolean

  // 批处理配置
  batchWindow: number // 毫秒
  maxBatchSize: number
  batchableMethods: string[]
  enableRequestDeduplication: boolean

  // 压缩配置
  compressionThreshold: number // 字节
  compressionAlgorithm: 'gzip' | 'deflate' | 'br' | 'none'
  enableAdaptiveCompression: boolean

  // 重试配置
  maxRetries: number
  retryDelay: number
  retryBackoffMultiplier: number
  enableExponentialBackoff: boolean
  retryableStatusCodes: number[]

  // 连接配置
  maxConcurrentRequests: number
  connectionTimeout: number
  keepAlive: boolean
  enableHttp2: boolean

  // 网络感知配置
  enableNetworkAwareness: boolean
  poorNetworkOptimizations: boolean
  offlineSupport: boolean

  // 性能监控
  enableMetrics: boolean
  enableDetailedLogging: boolean
}

export interface NetworkMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  cachedRequests: number
  batchedRequests: number
  compressedRequests: number

  averageResponseTime: number
  throughput: number // 请求/秒
  errorRate: number
  cacheHitRate: number
  compressionRatio: number
  batchEfficiency: number

  bandwidthUsed: number // 字节
  bandwidthSaved: number // 字节

  networkLatency: number
  connectionPoolUsage: number
  queueSize: number

  timestamp: number
}

export interface ConnectionPool {
  activeConnections: number
  idleConnections: number
  maxConnections: number
  totalConnections: number
  connectionReuseCount: number
}

// ============================================================================
// 网络优化器实现
// ============================================================================

export class NetworkOptimizer {
  private config: NetworkConfig
  private metrics: NetworkMetrics
  private requestQueue: NetworkRequest[] = []
  private activeRequests = new Map<string, AbortController>()
  private batchBuffer = new Map<string, NetworkRequest[]>()

  // 缓存系统
  private memoryCache = new Map<string, CacheEntry>()
  private persistentCache: IDBDatabase | null = null
  private cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0
  }

  // 连接池管理
  private connectionPool: ConnectionPool = {
    activeConnections: 0,
    idleConnections: 0,
    maxConnections: 10,
    totalConnections: 0,
    connectionReuseCount: 0
  }

  // 状态管理
  private isInitialized = false
  private isOnline = true
  private networkQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'good'

  // 定时器
  private batchTimer: NodeJS.Timeout | null = null
  private metricsTimer: NodeJS.Timeout | null = null
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(config?: Partial<NetworkConfig>) {
    this.config = this.getDefaultConfig()
    if (config) {
      this.config = { ...this.config, ...config }
    }

    this.metrics = this.getDefaultMetrics()
  }

  private getDefaultConfig(): NetworkConfig {
    return {
      // 基础配置
      enableCompression: true,
      enableCaching: true,
      enableBatching: true,
      enableRetry: true,

      // 缓存配置
      cacheStrategy: 'cache-first',
      defaultCacheTTL: 5 * 60 * 1000, // 5分钟
      maxCacheSize: 50 * 1024 * 1024, // 50MB
      maxCacheEntries: 1000,
      enablePersistentCache: true,

      // 批处理配置
      batchWindow: 100, // 100ms
      maxBatchSize: 10,
      batchableMethods: ['GET', 'POST'],
      enableRequestDeduplication: true,

      // 压缩配置
      compressionThreshold: 1024, // 1KB
      compressionAlgorithm: 'gzip',
      enableAdaptiveCompression: true,

      // 重试配置
      maxRetries: 3,
      retryDelay: 1000,
      retryBackoffMultiplier: 2,
      enableExponentialBackoff: true,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],

      // 连接配置
      maxConcurrentRequests: 6,
      connectionTimeout: 30000,
      keepAlive: true,
      enableHttp2: true,

      // 网络感知配置
      enableNetworkAwareness: true,
      poorNetworkOptimizations: true,
      offlineSupport: true,

      // 性能监控
      enableMetrics: true,
      enableDetailedLogging: false
    }
  }

  private getDefaultMetrics(): NetworkMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedRequests: 0,
      batchedRequests: 0,
      compressedRequests: 0,

      averageResponseTime: 0,
      throughput: 0,
      errorRate: 0,
      cacheHitRate: 0,
      compressionRatio: 1,
      batchEfficiency: 0,

      bandwidthUsed: 0,
      bandwidthSaved: 0,

      networkLatency: 0,
      connectionPoolUsage: 0,
      queueSize: 0,

      timestamp: Date.now()
    }
  }

  // ============================================================================
  // 初始化
  // ============================================================================

  /**
   * 初始化网络优化器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      // 初始化持久化缓存
      if (this.config.enablePersistentCache) {
        await this.initializePersistentCache()
      }

      // 检测网络状态
      this.updateNetworkStatus()

      // 启动定时器
      this.startTimers()

      // 监听网络状态变化
      this.setupNetworkListeners()

      this.isInitialized = true
      console.log('网络优化器初始化完成')

    } catch (error) {
      console.error('网络优化器初始化失败:', error)
      throw error
    }
  }

  /**
   * 初始化持久化缓存
   */
  private async initializePersistentCache(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('NetworkOptimizerCache', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.persistentCache = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' })
        }
      }
    })
  }

  /**
   * 更新网络状态
   */
  private updateNetworkStatus(): void {
    const networkState = networkStateDetector.getCurrentState()
    this.isOnline = networkState.online
    this.networkQuality = networkState.quality as any

    // 根据网络质量调整配置
    this.adjustConfigForNetwork()
  }

  /**
   * 根据网络调整配置
   */
  private adjustConfigForNetwork(): void {
    if (!this.config.enableNetworkAwareness) {
      return
    }

    switch (this.networkQuality) {
      case 'excellent':
        this.config.maxConcurrentRequests = 8
        this.config.batchWindow = 50
        this.config.maxBatchSize = 20
        break
      case 'good':
        this.config.maxConcurrentRequests = 6
        this.config.batchWindow = 100
        this.config.maxBatchSize = 10
        break
      case 'fair':
        this.config.maxConcurrentRequests = 4
        this.config.batchWindow = 200
        this.config.maxBatchSize = 5
        break
      case 'poor':
        this.config.maxConcurrentRequests = 2
        this.config.batchWindow = 500
        this.config.maxBatchSize = 3
        // 启用更多优化
        this.config.enableCompression = true
        this.config.enableCaching = true
        break
    }
  }

  /**
   * 启动定时器
   */
  private startTimers(): void {
    // 批处理定时器
    if (this.config.enableBatching) {
      this.batchTimer = setInterval(() => {
        this.processBatchedRequests()
      }, this.config.batchWindow)
    }

    // 指标收集定时器
    if (this.config.enableMetrics) {
      this.metricsTimer = setInterval(() => {
        this.collectMetrics()
      }, 10000) // 每10秒收集一次指标
    }

    // 缓存清理定时器
    this.cleanupTimer = setInterval(() => {
      this.cleanupCache()
    }, 60000) // 每分钟清理一次缓存
  }

  /**
   * 设置网络监听器
   */
  private setupNetworkListeners(): void {
    // 监听在线状态变化
    window.addEventListener('online', () => {
      this.isOnline = true
      this.processOfflineQueue()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })

    // 监听网络质量变化
    if (networkStateDetector.addEventListener) {
      networkStateDetector.addEventListener('qualityChange', (event: any) => {
        this.networkQuality = event.quality
        this.adjustConfigForNetwork()
      })
    }
  }

  // ============================================================================
  // 请求处理
  // ============================================================================

  /**
   * 发送网络请求
   */
  async request<T = any>(options: {
    url: string
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    headers?: Record<string, string>
    body?: any
    priority?: 'low' | 'normal' | 'high' | 'critical'
    cache?: boolean
    timeout?: number
    retries?: number
    metadata?: any
  }): Promise<NetworkResponse & { data: T }> {
    const request: NetworkRequest = {
      id: crypto.randomUUID(),
      url: options.url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
      priority: options.priority || 'normal',
      retryCount: 0,
      maxRetries: options.retries || this.config.maxRetries,
      timeout: options.timeout || this.config.connectionTimeout,
      timestamp: Date.now(),
      metadata: options.metadata || {}
    }

    try {
      // 性能监控开始
      const operationId = performanceMonitor.startOperation(`network-request-${request.method}`)

      // 检查缓存
      if (this.config.enableCaching && options.cache !== false) {
        const cachedResponse = await this.getFromCache(request)
        if (cachedResponse) {
          this.metrics.cachedRequests++
          performanceMonitor.endOperation(operationId, `network-request-${request.method}`)
          return { ...cachedResponse, data: cachedResponse.body }
        }
      }

      // 检查是否可以批处理
      if (this.config.enableBatching && this.canBatchRequest(request)) {
        const batchedResponse = await this.addToBatch(request)
        if (batchedResponse) {
          this.metrics.batchedRequests++
          performanceMonitor.endOperation(operationId, `network-request-${request.method}`)
          return { ...batchedResponse, data: batchedResponse.body }
        }
      }

      // 执行请求
      const response = await this.executeRequest(request)

      // 更新指标
      this.updateMetrics(request, response)

      // 缓存响应
      if (this.config.enableCaching && response.status === 200) {
        await this.setCache(request, response)
      }

      performanceMonitor.endOperation(operationId, `network-request-${request.method}`)
      return { ...response, data: response.body }

    } catch (error) {
      this.metrics.failedRequests++
      throw error
    }
  }

  /**
   * 执行单个请求
   */
  private async executeRequest(request: NetworkRequest): Promise<NetworkResponse> {
    const startTime = performance.now()

    try {
      // 检查并发限制
      await this.waitForConnectionSlot()

      // 创建 AbortController
      const controller = new AbortController()
      this.activeRequests.set(request.id, controller)

      // 准备请求选项
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: await this.prepareHeaders(request),
        signal: controller.signal,
        // 添加其他选项
        keepalive: this.config.keepAlive
      }

      // 处理请求体
      if (request.body && request.method !== 'GET') {
        const processedBody = await this.processRequestBody(request.body)
        fetchOptions.body = processedBody.data
        if (processedBody.compressed) {
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Content-Encoding': this.config.compressionAlgorithm
          }
        }
      }

      // 发送请求
      const response = await fetch(request.url, fetchOptions)

      // 处理响应
      const processedResponse = await this.processResponse(response, request)

      // 更新连接池状态
      this.connectionPool.activeConnections--
      this.connectionPool.idleConnections++
      this.activeRequests.delete(request.id)

      const duration = performance.now() - startTime

      return {
        request,
        status: response.status,
        statusText: response.statusText,
        headers: this.parseHeaders(response.headers),
        body: processedResponse.data,
        duration,
        cached: false,
        compressed: processedResponse.compressed,
        fromBatch: false
      }

    } catch (error) {
      this.activeRequests.delete(request.id)
      this.connectionPool.activeConnections--

      // 处理重试逻辑
      if (this.shouldRetry(request, error as Error)) {
        return this.retryRequest(request)
      }

      throw error
    }
  }

  /**
   * 等待连接槽位
   */
  private async waitForConnectionSlot(): Promise<void> {
    while (this.connectionPool.activeConnections >= this.config.maxConcurrentRequests) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    this.connectionPool.activeConnections++
    this.connectionPool.totalConnections++
  }

  /**
   * 准备请求头
   */
  private async prepareHeaders(request: NetworkRequest): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      ...request.headers,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'CardAll-Client/1.0'
    }

    // 添加网络优化头
    if (this.config.enableCompression) {
      headers['Accept-Encoding'] = 'gzip, deflate, br'
    }

    // 添加缓存头
    if (this.config.enableCaching) {
      headers['Cache-Control'] = 'max-age=' + Math.floor(this.config.defaultCacheTTL / 1000)
    }

    // 添加连接优化头
    if (this.config.keepAlive) {
      headers['Connection'] = 'keep-alive'
    }

    return headers
  }

  /**
   * 处理请求体
   */
  private async processRequestBody(body: any): Promise<{ data: any; compressed: boolean }> {
    if (!body) {
      return { data: null, compressed: false }
    }

    // 序列化数据
    const serializedData = typeof body === 'string' ? body : JSON.stringify(body)
    const dataSize = new Blob([serializedData]).size

    // 检查是否需要压缩
    if (this.config.enableCompression &&
        dataSize > this.config.compressionThreshold &&
        this.shouldCompressForNetwork()) {

      const compressedData = await this.compressData(serializedData)
      return {
        data: compressedData,
        compressed: true
      }
    }

    return {
      data: serializedData,
      compressed: false
    }
  }

  /**
   * 处理响应
   */
  private async processResponse(response: Response, request: NetworkRequest): Promise<{ data: any; compressed: boolean }> {
    const contentEncoding = response.headers.get('Content-Encoding')
    let data = await response.text()
    let compressed = false

    // 解压缩数据
    if (contentEncoding && this.config.enableCompression) {
      try {
        data = await this.decompressData(data, contentEncoding)
        compressed = true
      } catch (error) {
        console.warn('解压缩失败，使用原始数据:', error)
      }
    }

    // 解析JSON
    try {
      const jsonData = JSON.parse(data)
      return { data: jsonData, compressed }
    } catch {
      return { data, compressed }
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(request: NetworkRequest, error: Error): boolean {
    if (!this.config.enableRetry || request.retryCount >= request.maxRetries) {
      return false
    }

    // 检查错误类型
    if (error.name === 'AbortError') {
      return false
    }

    // 检查网络状态
    if (!this.isOnline && this.config.offlineSupport) {
      return true
    }

    return true
  }

  /**
   * 重试请求
   */
  private async retryRequest(request: NetworkRequest): Promise<NetworkResponse> {
    request.retryCount++

    // 计算重试延迟
    const delay = this.calculateRetryDelay(request.retryCount)
    await new Promise(resolve => setTimeout(resolve, delay))

    return this.executeRequest(request)
  }

  /**
   * 计算重试延迟
   */
  private calculateRetryDelay(retryCount: number): number {
    if (this.config.enableExponentialBackoff) {
      return this.config.retryDelay * Math.pow(this.config.retryBackoffMultiplier, retryCount - 1)
    }
    return this.config.retryDelay
  }

  /**
   * 判断是否应该压缩
   */
  private shouldCompressForNetwork(): boolean {
    if (!this.config.enableAdaptiveCompression) {
      return true
    }

    switch (this.networkQuality) {
      case 'excellent':
        return false // 网络好时不需要压缩
      case 'good':
        return true // 网络一般时选择性压缩
      case 'fair':
      case 'poor':
        return true // 网络差时总是压缩
      default:
        return true
    }
  }

  // ============================================================================
  // 缓存系统
  // ============================================================================

  /**
   * 从缓存获取数据
   */
  private async getFromCache(request: NetworkRequest): Promise<NetworkResponse | null> {
    const cacheKey = this.generateCacheKey(request)

    // 检查内存缓存
    const memoryEntry = this.memoryCache.get(cacheKey)
    if (memoryEntry && !this.isCacheExpired(memoryEntry)) {
      this.updateCacheAccess(memoryEntry)
      this.cacheStats.hits++
      return this.createResponseFromCacheEntry(memoryEntry, request)
    }

    // 检查持久化缓存
    if (this.persistentCache) {
      try {
        const persistentEntry = await this.getFromPersistentCache(cacheKey)
        if (persistentEntry && !this.isCacheExpired(persistentEntry)) {
          // 加载到内存缓存
          this.memoryCache.set(cacheKey, persistentEntry)
          this.updateCacheAccess(persistentEntry)
          this.cacheStats.hits++
          return this.createResponseFromCacheEntry(persistentEntry, request)
        }
      } catch (error) {
        console.warn('从持久化缓存获取数据失败:', error)
      }
    }

    this.cacheStats.misses++
    return null
  }

  /**
   * 设置缓存
   */
  private async setCache(request: NetworkRequest, response: NetworkResponse): Promise<void> {
    const cacheKey = this.generateCacheKey(request)
    const ttl = this.getCacheTTL(request, response)
    const expiresAt = Date.now() + ttl

    const cacheEntry: CacheEntry = {
      key: cacheKey,
      data: response.body,
      headers: response.headers,
      timestamp: Date.now(),
      expiresAt,
      size: this.estimateDataSize(response.body),
      accessCount: 1,
      lastAccessed: Date.now(),
      compressed: response.compressed,
      compressionRatio: response.compressed ? 0.7 : undefined
    }

    // 保存到内存缓存
    if (this.shouldStoreInMemory(cacheEntry)) {
      this.memoryCache.set(cacheKey, cacheEntry)
    }

    // 保存到持久化缓存
    if (this.persistentCache && this.shouldStoreInPersistentCache(cacheEntry)) {
      try {
        await this.setToPersistentCache(cacheEntry)
      } catch (error) {
        console.warn('保存到持久化缓存失败:', error)
      }
    }

    // 检查缓存大小限制
    this.enforceCacheLimits()
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(request: NetworkRequest): string {
    if (request.metadata?.cacheKey) {
      return request.metadata.cacheKey
    }

    const parts = [
      request.method,
      request.url,
      JSON.stringify(request.body || {}),
      JSON.stringify(request.headers || {})
    ]

    return btoa(parts.join('|')).replace(/[^a-zA-Z0-9]/g, '')
  }

  /**
   * 获取缓存TTL
   */
  private getCacheTTL(request: NetworkRequest, response: NetworkResponse): number {
    // 检查响应头中的缓存控制
    const cacheControl = response.headers['cache-control']
    if (cacheControl) {
      const maxAge = this.parseMaxAge(cacheControl)
      if (maxAge !== null) {
        return maxAge * 1000
      }
    }

    // 根据网络质量调整TTL
    let ttl = this.config.defaultCacheTTL
    switch (this.networkQuality) {
      case 'poor':
        ttl *= 3 // 网络差时延长缓存时间
        break
      case 'excellent':
        ttl *= 0.5 // 网络好时缩短缓存时间
        break
    }

    return ttl
  }

  /**
   * 解析Max-Age
   */
  private parseMaxAge(cacheControl: string): number | null {
    const matches = cacheControl.match(/max-age=(\d+)/)
    return matches ? parseInt(matches[1], 10) : null
  }

  /**
   * 检查缓存是否过期
   */
  private isCacheExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt
  }

  /**
   * 更新缓存访问信息
   */
  private updateCacheAccess(entry: CacheEntry): void {
    entry.accessCount++
    entry.lastAccessed = Date.now()
  }

  /**
   * 从缓存条目创建响应
   */
  private createResponseFromCacheEntry(entry: CacheEntry, request: NetworkRequest): NetworkResponse {
    return {
      request,
      status: 200,
      statusText: 'OK',
      headers: entry.headers,
      body: entry.data,
      duration: 0,
      cached: true,
      compressed: entry.compressed,
      fromBatch: false
    }
  }

  /**
   * 判断是否应该存储在内存中
   */
  private shouldStoreInMemory(entry: CacheEntry): boolean {
    // 检查大小限制
    if (entry.size > 1024 * 1024) { // 1MB
      return false
    }

    // 检查内存缓存大小
    const currentMemorySize = this.calculateMemoryCacheSize()
    return currentMemorySize + entry.size <= this.config.maxCacheSize * 0.5 // 最多使用50%的内存缓存配额
  }

  /**
   * 判断是否应该存储在持久化缓存中
   */
  private shouldStoreInPersistentCache(entry: CacheEntry): boolean {
    return entry.size <= 10 * 1024 * 1024 // 10MB
  }

  /**
   * 从持久化缓存获取数据
   */
  private async getFromPersistentCache(key: string): Promise<CacheEntry | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.persistentCache!.transaction(['cache'], 'readonly')
      const store = transaction.objectStore('cache')
      const request = store.get(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  /**
   * 设置持久化缓存
   */
  private async setToPersistentCache(entry: CacheEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.persistentCache!.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const request = store.put(entry)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  /**
   * 计算内存缓存大小
   */
  private calculateMemoryCacheSize(): number {
    let totalSize = 0
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size
    }
    return totalSize
  }

  /**
   * 强制执行缓存限制
   */
  private enforceCacheLimits(): void {
    // 检查条目数量限制
    if (this.memoryCache.size > this.config.maxCacheEntries) {
      this.evictLeastRecentlyUsed()
    }

    // 检查大小限制
    const currentSize = this.calculateMemoryCacheSize()
    if (currentSize > this.config.maxCacheSize) {
      this.evictBySize(currentSize - this.config.maxCacheSize)
    }
  }

  /**
   * 驱逐最少使用的缓存项
   */
  private evictLeastRecentlyUsed(): void {
    const entries = Array.from(this.memoryCache.entries())
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

    const toRemove = Math.floor(this.config.maxCacheEntries * 0.1) // 移除10%
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.memoryCache.delete(entries[i][0])
      this.cacheStats.evictions++
    }
  }

  /**
   * 按大小驱逐缓存
   */
  private evictBySize(sizeToFree: number): void {
    const entries = Array.from(this.memoryCache.entries())
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

    let freedSize = 0
    for (const [key, entry] of entries) {
      if (freedSize >= sizeToFree) {
        break
      }
      this.memoryCache.delete(key)
      freedSize += entry.size
      this.cacheStats.evictions++
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.memoryCache.delete(key)
      this.cacheStats.evictions++
    }
  }

  // ============================================================================
  // 批处理系统
  // ============================================================================

  /**
   * 判断请求是否可以批处理
   */
  private canBatchRequest(request: NetworkRequest): boolean {
    if (!this.config.enableBatching) {
      return false
    }

    // 检查方法
    if (!this.config.batchableMethods.includes(request.method)) {
      return false
    }

    // 检查优先级
    if (request.priority === 'critical') {
      return false
    }

    // 检查元数据
    if (request.metadata?.batchable === false) {
      return false
    }

    return true
  }

  /**
   * 添加到批处理
   */
  private async addToBatch(request: NetworkRequest): Promise<NetworkResponse | null> {
    const batchKey = this.generateBatchKey(request)

    if (!this.batchBuffer.has(batchKey)) {
      this.batchBuffer.set(batchKey, [])
    }

    const batch = this.batchBuffer.get(batchKey)!
    batch.push(request)

    // 检查批处理是否已满
    if (batch.length >= this.config.maxBatchSize) {
      return await this.processBatch(batchKey)
    }

    return null // 等待更多请求
  }

  /**
   * 生成批处理键
   */
  private generateBatchKey(request: NetworkRequest): string {
    // 简单的批处理键生成策略
    // 可以根据实际需求优化
    const url = new URL(request.url)
    return `${request.method}:${url.origin}${url.pathname}`
  }

  /**
   * 处理批处理请求
   */
  private async processBatchedRequests(): Promise<void> {
    for (const [batchKey, requests] of this.batchBuffer.entries()) {
      if (requests.length > 0) {
        await this.processBatch(batchKey)
      }
    }
  }

  /**
   * 处理单个批处理
   */
  private async processBatch(batchKey: string): Promise<NetworkResponse | null> {
    const requests = this.batchBuffer.get(batchKey)
    if (!requests || requests.length === 0) {
      return null
    }

    // 清空批处理缓冲区
    this.batchBuffer.delete(batchKey)

    try {
      // 合并请求
      const batchRequest = this.createBatchRequest(requests)

      // 执行批处理请求
      const batchResponse = await this.executeRequest(batchRequest)

      // 分发响应
      return this.distributeBatchResponse(batchResponse, requests)

    } catch (error) {
      // 批处理失败，单独处理每个请求
      console.warn('批处理失败，回退到单独处理:', error)

      // 单独处理每个请求
      for (const request of requests) {
        try {
          await this.executeRequest(request)
        } catch (singleError) {
          console.error('单独处理请求失败:', singleError)
        }
      }

      return null
    }
  }

  /**
   * 创建批处理请求
   */
  private createBatchRequest(requests: NetworkRequest[]): NetworkRequest {
    // 简化的批处理实现
    // 实际应用中可能需要更复杂的批处理逻辑
    const firstRequest = requests[0]

    return {
      ...firstRequest,
      id: crypto.randomUUID(),
      body: {
        batch: true,
        requests: requests.map(req => ({
          method: req.method,
          url: req.url,
          body: req.body,
          headers: req.headers
        }))
      },
      metadata: {
        ...firstRequest.metadata,
        batchable: true,
        originalRequests: requests.map(req => req.id)
      }
    }
  }

  /**
   * 分发批处理响应
   */
  private distributeBatchResponse(batchResponse: NetworkResponse, requests: NetworkRequest[]): NetworkResponse {
    // 简化的响应分发实现
    // 实际应用中需要根据API的批处理响应格式来处理
    return {
      ...batchResponse,
      fromBatch: true,
      request: requests[0] // 返回第一个请求作为代表
    }
  }

  // ============================================================================
  // 数据压缩
  // ============================================================================

  /**
   * 压缩数据
   */
  private async compressData(data: string): Promise<string> {
    // 简化的压缩实现
    // 在实际应用中应该使用专业的压缩库
    try {
      if ('CompressionStream' in window) {
        const stream = new CompressionStream('gzip')
        const writer = stream.writable.getWriter()
        const reader = stream.readable.getReader()

        writer.write(new TextEncoder().encode(data))
        writer.close()

        const chunks: Uint8Array[] = []
        let done = false

        while (!done) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone
          if (value) {
            chunks.push(value)
          }
        }

        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        const result = new Uint8Array(totalLength)
        let offset = 0

        for (const chunk of chunks) {
          result.set(chunk, offset)
          offset += chunk.length
        }

        return btoa(String.fromCharCode(...result))
      }
    } catch (error) {
      console.warn('压缩失败，使用原始数据:', error)
    }

    return data
  }

  /**
   * 解压缩数据
   */
  private async decompressData(data: string, encoding: string): Promise<string> {
    // 简化的解压缩实现
    // 在实际应用中应该使用专业的解压缩库
    try {
      if ('DecompressionStream' in window) {
        const compressedData = Uint8Array.from(atob(data), c => c.charCodeAt(0))

        const stream = new DecompressionStream(encoding as CompressionFormat)
        const writer = stream.writable.getWriter()
        const reader = stream.readable.getReader()

        writer.write(compressedData)
        writer.close()

        const chunks: Uint8Array[] = []
        let done = false

        while (!done) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone
          if (value) {
            chunks.push(value)
          }
        }

        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        const result = new Uint8Array(totalLength)
        let offset = 0

        for (const chunk of chunks) {
          result.set(chunk, offset)
          offset += chunk.length
        }

        return new TextDecoder().decode(result)
      }
    } catch (error) {
      console.warn('解压缩失败，使用原始数据:', error)
    }

    return data
  }

  // ============================================================================
  // 离线支持
  // ============================================================================

  /**
   * 处理离线队列
   */
  private async processOfflineQueue(): Promise<void> {
    if (!this.config.offlineSupport) {
      return
    }

    // 这里可以实现离线队列处理逻辑
    // 将离线时的请求重新发送
  }

  // ============================================================================
  // 指标收集和分析
  // ============================================================================

  /**
   * 更新指标
   */
  private updateMetrics(request: NetworkRequest, response: NetworkResponse): void {
    this.metrics.totalRequests++

    if (response.status >= 200 && response.status < 300) {
      this.metrics.successfulRequests++
    } else {
      this.metrics.failedRequests++
    }

    // 更新响应时间
    const totalResponseTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + response.duration
    this.metrics.averageResponseTime = totalResponseTime / this.metrics.totalRequests

    // 更新压缩指标
    if (response.compressed) {
      this.metrics.compressedRequests++
    }

    // 更新带宽使用
    const requestSize = this.estimateDataSize(request.body)
    const responseSize = this.estimateDataSize(response.body)
    this.metrics.bandwidthUsed += requestSize + responseSize

    // 计算节省的带宽
    if (response.compressed) {
      this.metrics.bandwidthSaved += responseSize * 0.3 // 假设压缩节省30%
    }

    // 更新队列大小
    this.metrics.queueSize = this.requestQueue.length

    // 更新连接池使用率
    this.metrics.connectionPoolUsage = this.connectionPool.activeConnections / this.connectionPool.maxConnections
  }

  /**
   * 收集指标
   */
  private collectMetrics(): void {
    if (!this.config.enableMetrics) {
      return
    }

    try {
      // 计算吞吐量
      const timeWindow = 10000 // 10秒
      const recentRequests = this.metrics.totalRequests
      this.metrics.throughput = recentRequests / (timeWindow / 1000)

      // 计算错误率
      this.metrics.errorRate = this.metrics.totalRequests > 0
        ? this.metrics.failedRequests / this.metrics.totalRequests
        : 0

      // 计算缓存命中率
      const totalCacheRequests = this.cacheStats.hits + this.cacheStats.misses
      this.metrics.cacheHitRate = totalCacheRequests > 0
        ? this.cacheStats.hits / totalCacheRequests
        : 0

      // 计算压缩比率
      if (this.metrics.compressedRequests > 0) {
        this.metrics.compressionRatio = 0.7 // 假设平均压缩比率为70%
      }

      // 计算批处理效率
      if (this.metrics.batchedRequests > 0) {
        this.metrics.batchEfficiency = this.metrics.batchedRequests / this.metrics.totalRequests
      }

      // 更新网络延迟
      this.metrics.networkLatency = this.metrics.averageResponseTime

      // 更新时间戳
      this.metrics.timestamp = Date.now()

    } catch (error) {
      console.warn('收集网络指标失败:', error)
    }
  }

  /**
   * 估算数据大小
   */
  private estimateDataSize(data: any): number {
    if (!data) {
      return 0
    }

    try {
      const jsonString = typeof data === 'string' ? data : JSON.stringify(data)
      return new Blob([jsonString]).size
    } catch (error) {
      return 1024 // 默认1KB
    }
  }

  /**
   * 解析响应头
   */
  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {}
    headers.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取当前指标
   */
  getMetrics(): NetworkMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    hits: number
    misses: number
    evictions: number
    hitRate: number
    memoryUsage: number
    entryCount: number
  } {
    const totalCacheRequests = this.cacheStats.hits + this.cacheStats.misses
    const hitRate = totalCacheRequests > 0 ? this.cacheStats.hits / totalCacheRequests : 0

    return {
      ...this.cacheStats,
      hitRate,
      memoryUsage: this.calculateMemoryCacheSize(),
      entryCount: this.memoryCache.size
    }
  }

  /**
   * 获取连接池状态
   */
  getConnectionPoolStatus(): ConnectionPool {
    return { ...this.connectionPool }
  }

  /**
   * 获取网络状态
   */
  getNetworkStatus(): {
    online: boolean
    quality: string
    config: Partial<NetworkConfig>
  } {
    return {
      online: this.isOnline,
      quality: this.networkQuality,
      config: {
        maxConcurrentRequests: this.config.maxConcurrentRequests,
        batchWindow: this.config.batchWindow,
        maxBatchSize: this.config.maxBatchSize
      }
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.memoryCache.clear()
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 }
  }

  /**
   * 取消请求
   */
  cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId)
    if (controller) {
      controller.abort()
      this.activeRequests.delete(requestId)
      return true
    }
    return false
  }

  /**
   * 取消所有请求
   */
  cancelAllRequests(): void {
    for (const [requestId, controller] of this.activeRequests.entries()) {
      controller.abort()
    }
    this.activeRequests.clear()
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...config }

    // 重新调整网络配置
    if (this.config.enableNetworkAwareness) {
      this.adjustConfigForNetwork()
    }
  }

  /**
   * 预热缓存
   */
  async warmupCache(urls: string[]): Promise<void> {
    if (!this.config.enableCaching) {
      return
    }

    const promises = urls.map(url =>
      this.request({ url, priority: 'low' }).catch(error => {
        console.warn(`预热缓存失败 ${url}:`, error)
      })
    )

    await Promise.allSettled(promises)
  }

  /**
   * 销毁网络优化器
   */
  destroy(): void {
    // 清理定时器
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
      this.batchTimer = null
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
      this.metricsTimer = null
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // 取消所有请求
    this.cancelAllRequests()

    // 清理缓存
    this.clearCache()

    // 重置状态
    this.requestQueue = []
    this.batchBuffer.clear()
    this.isInitialized = false
  }
}

// ============================================================================
// 单例实例和导出
// ============================================================================

export const networkOptimizer = new NetworkOptimizer()

// 便利方法导出
export const initializeNetworkOptimizer = () => networkOptimizer.initialize()
export const optimizedRequest = <T = any>(options: any) => networkOptimizer.request<T>(options)
export const getNetworkMetrics = () => networkOptimizer.getMetrics()
export const getNetworkCacheStats = () => networkOptimizer.getCacheStats()
export const getNetworkConnectionStatus = () => networkOptimizer.getConnectionPoolStatus()
export const getNetworkStatus = () => networkOptimizer.getNetworkStatus()

export const clearNetworkCache = () => networkOptimizer.clearCache()
export const cancelNetworkRequest = (requestId: string) => networkOptimizer.cancelRequest(requestId)
export const cancelAllNetworkRequests = () => networkOptimizer.cancelAllRequests()
export const updateNetworkConfig = (config: Partial<NetworkConfig>) => networkOptimizer.updateConfig(config)
export const warmupNetworkCache = (urls: string[]) => networkOptimizer.warmupCache(urls)
export const destroyNetworkOptimizer = () => networkOptimizer.destroy()

// 类型导出
export type {
  NetworkRequest,
  NetworkResponse,
  CacheEntry,
  NetworkConfig,
  NetworkMetrics,
  ConnectionPool
}