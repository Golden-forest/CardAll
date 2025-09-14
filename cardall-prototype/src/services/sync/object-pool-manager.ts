/**
 * 对象池管理器
 * 高效管理对象生命周期，减少内存分配和垃圾回收开销
 */

import { MemoryUsageOptimizer } from './memory-usage-optimizer'

// ============================================================================
// 对象池接口
// ============================================================================

export interface ObjectPoolConfig<T = any> {
  // 基本配置
  name: string
  maxSize: number
  minSize: number
  initialSize: number

  // 工厂函数
  factory: () => T
  reset?: (obj: T) => void
  destroy?: (obj: T) => void

  // 动态调整配置
  growthFactor: number
  shrinkFactor: number
  shrinkThreshold: number
  growThreshold: number

  // 监控配置
  enableMonitoring: boolean
  enableStatistics: boolean
}

export interface PoolStatistics {
  name: string
  totalCreated: number
  totalAcquired: number
  totalReleased: number
  totalDestroyed: number
  currentSize: number
  availableSize: number
  activeSize: number
  hitRate: number
  missRate: number
  averageLifetime: number
  memoryUsage: number
  lastActivity: number
}

export interface PoolMetrics {
  totalPools: number
  totalObjects: number
  activeObjects: number
  availableObjects: number
  totalMemory: number
  efficiency: number
  topPools: PoolStatistics[]
  globalHitRate: number
  globalMissRate: number
}

// ============================================================================
// 对象池实现
// ============================================================================

export class ObjectPool<T = any> {
  private config: ObjectPoolConfig<T>
  private pool: T[] = []
  private activeObjects: Set<T> = new Set()
  private statistics: PoolStatistics
  private createdAt: number = Date.now()
  private lastActivity: number = Date.now()

  // 监控和统计
  private acquisitionTimes: Map<T, number> = new Map()
  private creationTimes: Map<T, number> = new Map()

  constructor(config: ObjectPoolConfig<T>) {
    this.config = { ...this.getDefaultConfig(), ...config }
    this.statistics = this.initializeStatistics()

    // 初始化池
    this.initializePool()

    // 设置监控
    if (this.config.enableMonitoring) {
      this.startMonitoring()
    }
  }

  private getDefaultConfig(): Partial<ObjectPoolConfig<T>> {
    return {
      maxSize: 1000,
      minSize: 10,
      initialSize: 50,
      growthFactor: 1.5,
      shrinkFactor: 0.8,
      shrinkThreshold: 0.7,
      growThreshold: 0.8,
      enableMonitoring: true,
      enableStatistics: true
    }
  }

  private initializeStatistics(): PoolStatistics {
    return {
      name: this.config.name,
      totalCreated: 0,
      totalAcquired: 0,
      totalReleased: 0,
      totalDestroyed: 0,
      currentSize: 0,
      availableSize: 0,
      activeSize: 0,
      hitRate: 0,
      missRate: 0,
      averageLifetime: 0,
      memoryUsage: 0,
      lastActivity: Date.now()
    }
  }

  private initializePool(): void {
    for (let i = 0; i < this.config.initialSize; i++) {
      const obj = this.createObject()
      this.pool.push(obj)
    }
    this.updateStatistics()
  }

  // ============================================================================
  // 核心操作
  // ============================================================================

  public acquire(): T {
    this.lastActivity = Date.now()

    let obj: T

    if (this.pool.length > 0) {
      // 从池中获取对象
      obj = this.pool.pop()!
      this.statistics.hitRate = this.calculateHitRate(true)
    } else {
      // 创建新对象
      obj = this.createObject()
      this.statistics.missRate = this.calculateHitRate(false)
    }

    // 重置对象状态
    if (this.config.reset) {
      this.config.reset(obj)
    }

    // 记录获取信息
    this.activeObjects.add(obj)
    this.acquisitionTimes.set(obj, Date.now())
    this.statistics.totalAcquired++

    this.updateStatistics()

    return obj
  }

  public release(obj: T): void {
    this.lastActivity = Date.now()

    if (!this.activeObjects.has(obj)) {
      console.warn(`尝试释放未从池中获取的对象: ${this.config.name}`)
      return
    }

    // 从活跃对象中移除
    this.activeObjects.delete(obj)
    this.acquisitionTimes.delete(obj)

    // 计算生命周期
    const createTime = this.creationTimes.get(obj)
    if (createTime) {
      const lifetime = Date.now() - createTime
      this.updateAverageLifetime(lifetime)
    }

    // 检查池大小
    if (this.pool.length < this.config.maxSize) {
      // 重置对象状态
      if (this.config.reset) {
        this.config.reset(obj)
      }

      // 返回到池中
      this.pool.push(obj)
      this.statistics.totalReleased++
    } else {
      // 销毁对象
      this.destroyObject(obj)
    }

    this.updateStatistics()

    // 检查是否需要收缩池
    this.checkPoolSize()
  }

  // ============================================================================
  // 对象生命周期管理
  // ============================================================================

  private createObject(): T {
    const obj = this.config.factory()
    this.creationTimes.set(obj, Date.now())
    this.statistics.totalCreated++
    this.statistics.currentSize++
    return obj
  }

  private destroyObject(obj: T): void {
    if (this.config.destroy) {
      this.config.destroy(obj)
    }
    this.creationTimes.delete(obj)
    this.statistics.totalDestroyed++
    this.statistics.currentSize--
  }

  private resetObject(obj: T): void {
    if (this.config.reset) {
      this.config.reset(obj)
    }
  }

  // ============================================================================
  // 池大小管理
  // ============================================================================

  private checkPoolSize(): void {
    const usageRatio = this.activeObjects.size / this.config.maxSize

    if (usageRatio > this.config.growThreshold) {
      this.growPool()
    } else if (usageRatio < this.config.shrinkThreshold) {
      this.shrinkPool()
    }
  }

  private growPool(): void {
    const currentSize = this.pool.length + this.activeObjects.size
    if (currentSize >= this.config.maxSize) return

    const targetSize = Math.min(
      Math.floor(currentSize * this.config.growthFactor),
      this.config.maxSize
    )

    const objectsToAdd = targetSize - currentSize
    for (let i = 0; i < objectsToAdd; i++) {
      const obj = this.createObject()
      this.pool.push(obj)
    }

    console.log(`对象池 ${this.config.name} 增长到 ${targetSize} 个对象`)
  }

  private shrinkPool(): void {
    const currentSize = this.pool.length + this.activeObjects.size
    if (currentSize <= this.config.minSize) return

    const targetSize = Math.max(
      Math.floor(currentSize * this.config.shrinkFactor),
      this.config.minSize
    )

    const objectsToRemove = this.pool.length - (targetSize - this.activeObjects.size)
    for (let i = 0; i < objectsToRemove && this.pool.length > 0; i++) {
      const obj = this.pool.pop()!
      this.destroyObject(obj)
    }

    console.log(`对象池 ${this.config.name} 收缩到 ${targetSize} 个对象`)
  }

  // ============================================================================
  // 统计和监控
  // ============================================================================

  private updateStatistics(): void {
    this.statistics.currentSize = this.pool.length + this.activeObjects.size
    this.statistics.availableSize = this.pool.length
    this.statistics.activeSize = this.activeObjects.size
    this.statistics.memoryUsage = this.estimateMemoryUsage()
    this.statistics.lastActivity = Date.now()
  }

  private calculateHitRate(hit: boolean): number {
    const total = this.statistics.totalAcquired
    if (total === 0) return 0

    if (hit) {
      return (this.statistics.hitRate * (total - 1) + 1) / total
    } else {
      return (this.statistics.hitRate * (total - 1)) / total
    }
  }

  private updateAverageLifetime(lifetime: number): void {
    const totalCreated = this.statistics.totalCreated
    if (totalCreated === 0) return

    this.statistics.averageLifetime =
      (this.statistics.averageLifetime * (totalCreated - 1) + lifetime) / totalCreated
  }

  private estimateMemoryUsage(): number {
    // 估算内存使用量
    // 这是一个简化的实现，实际应用中可以根据对象类型进行更精确的计算
    const avgObjectSize = 1024 // 假设平均对象大小为1KB
    return this.statistics.currentSize * avgObjectSize
  }

  private startMonitoring(): void {
    // 设置定时器来监控池状态
    setInterval(() => {
      this.checkPoolHealth()
    }, 30000) // 每30秒检查一次
  }

  private checkPoolHealth(): void {
    // 检查池的健康状态
    const efficiency = this.statistics.totalAcquired > 0
      ? this.statistics.hitRate / (this.statistics.hitRate + this.statistics.missRate)
      : 0

    if (efficiency < 0.5) {
      console.warn(`对象池 ${this.config.name} 效率较低: ${(efficiency * 100).toFixed(1)}%`)
    }

    // 检查内存使用
    if (this.statistics.memoryUsage > 10 * 1024 * 1024) { // 10MB
      console.warn(`对象池 ${this.config.name} 内存使用过高: ${this.statistics.memoryUsage} bytes`)
    }
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  public getStatistics(): PoolStatistics {
    return { ...this.statistics }
  }

  public getSize(): number {
    return this.pool.length + this.activeObjects.size
  }

  public getAvailableSize(): number {
    return this.pool.length
  }

  public getActiveSize(): number {
    return this.activeObjects.size
  }

  public getHitRate(): number {
    return this.statistics.hitRate
  }

  public getEfficiency(): number {
    const total = this.statistics.hitRate + this.statistics.missRate
    return total > 0 ? this.statistics.hitRate / total : 0
  }

  public clear(): void {
    // 销毁所有池中的对象
    while (this.pool.length > 0) {
      const obj = this.pool.pop()!
      this.destroyObject(obj)
    }

    // 销毁所有活跃对象
    this.activeObjects.forEach(obj => {
      this.destroyObject(obj)
    })
    this.activeObjects.clear()

    // 重新初始化池
    this.initializePool()
  }

  public resize(newSize: number): void {
    this.config.maxSize = newSize
    this.config.minSize = Math.floor(newSize * 0.1)

    // 调整池大小
    this.checkPoolSize()
  }

  public destroy(): void {
    // 销毁所有对象
    this.clear()

    // 清理数据结构
    this.acquisitionTimes.clear()
    this.creationTimes.clear()
    this.activeObjects.clear()
  }
}

// ============================================================================
// 对象池管理器
// ============================================================================

export class ObjectPoolManager {
  private static instance: ObjectPoolManager
  private pools: Map<string, ObjectPool<any>> = new Map()
  private memoryOptimizer: MemoryUsageOptimizer
  private config: {
    defaultMaxSize: number
    defaultMinSize: number
    defaultInitialSize: number
    enableAutoCleanup: boolean
    cleanupInterval: number
    enableGlobalMonitoring: boolean
  }

  // ============================================================================
  // 构造函数和单例模式
  // ============================================================================

  private constructor() {
    this.config = {
      defaultMaxSize: 1000,
      defaultMinSize: 10,
      defaultInitialSize: 50,
      enableAutoCleanup: true,
      cleanupInterval: 300000, // 5分钟
      enableGlobalMonitoring: true
    }

    this.memoryOptimizer = MemoryUsageOptimizer.getInstance()

    // 设置自动清理
    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup()
    }

    // 设置全局监控
    if (this.config.enableGlobalMonitoring) {
      this.startGlobalMonitoring()
    }
  }

  public static getInstance(): ObjectPoolManager {
    if (!ObjectPoolManager.instance) {
      ObjectPoolManager.instance = new ObjectPoolManager()
    }
    return ObjectPoolManager.instance
  }

  // ============================================================================
  // 池管理
  // ============================================================================

  public createPool<T>(config: ObjectPoolConfig<T>): string {
    const poolId = config.name || `pool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 应用默认配置
    const finalConfig = {
      ...config,
      name: poolId,
      maxSize: config.maxSize || this.config.defaultMaxSize,
      minSize: config.minSize || this.config.defaultMinSize,
      initialSize: config.initialSize || this.config.defaultInitialSize
    }

    const pool = new ObjectPool<T>(finalConfig)
    this.pools.set(poolId, pool)

    console.log(`创建对象池: ${poolId}`)
    return poolId
  }

  public getPool<T>(poolId: string): ObjectPool<T> | null {
    return this.pools.get(poolId) as ObjectPool<T> || null
  }

  public removePool(poolId: string): boolean {
    const pool = this.pools.get(poolId)
    if (pool) {
      pool.destroy()
      this.pools.delete(poolId)
      console.log(`移除对象池: ${poolId}`)
      return true
    }
    return false
  }

  public acquire<T>(poolId: string): T | null {
    const pool = this.getPool<T>(poolId)
    return pool ? pool.acquire() : null
  }

  public release<T>(poolId: string, obj: T): boolean {
    const pool = this.getPool<T>(poolId)
    if (pool) {
      pool.release(obj)
      return true
    }
    return false
  }

  // ============================================================================
  // 自动清理和监控
  // ============================================================================

  private startAutoCleanup(): void {
    setInterval(() => {
      this.performAutoCleanup()
    }, this.config.cleanupInterval)
  }

  private performAutoCleanup(): void {
    const memoryPressure = this.memoryOptimizer.getMemoryPressureLevel()

    this.pools.forEach((pool, poolId) => {
      const stats = pool.getStatistics()

      // 基于内存压力清理
      if (memoryPressure === 'high' || memoryPressure === 'critical') {
        pool.resize(Math.floor(stats.currentSize * 0.7))
      }

      // 清理长时间未使用的池
      const inactiveTime = Date.now() - stats.lastActivity
      if (inactiveTime > 600000) { // 10分钟未使用
        if (stats.activeSize === 0) {
          this.removePool(poolId)
        }
      }
    })
  }

  private startGlobalMonitoring(): void {
    setInterval(() => {
      this.monitorGlobalMetrics()
    }, 60000) // 每分钟监控一次
  }

  private monitorGlobalMetrics(): void {
    const metrics = this.getGlobalMetrics()

    // 记录到性能监控系统
    this.memoryOptimizer.forceGC()

    console.log('全局对象池指标:', {
      totalPools: metrics.totalPools,
      totalObjects: metrics.totalObjects,
      efficiency: metrics.efficiency.toFixed(2)
    })
  }

  // ============================================================================
  // 全局指标和统计
  // ============================================================================

  public getGlobalMetrics(): PoolMetrics {
    let totalObjects = 0
    let activeObjects = 0
    let availableObjects = 0
    let totalMemory = 0
    let totalHits = 0
    let totalMisses = 0
    const topPools: PoolStatistics[] = []

    this.pools.forEach(pool => {
      const stats = pool.getStatistics()
      totalObjects += stats.currentSize
      activeObjects += stats.activeSize
      availableObjects += stats.availableSize
      totalMemory += stats.memoryUsage
      totalHits += stats.totalAcquired - stats.totalCreated
      totalMisses += stats.totalCreated

      topPools.push(stats)
    })

    // 按使用率排序
    topPools.sort((a, b) => b.totalAcquired - a.totalAcquired)
    topPools.splice(5) // 只保留前5个

    const globalHitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0
    const globalMissRate = 1 - globalHitRate

    return {
      totalPools: this.pools.size,
      totalObjects,
      activeObjects,
      availableObjects,
      totalMemory,
      efficiency: globalHitRate,
      topPools,
      globalHitRate,
      globalMissRate
    }
  }

  public getPoolStatistics(poolId: string): PoolStatistics | null {
    const pool = this.pools.get(poolId)
    return pool ? pool.getStatistics() : null
  }

  public getAllStatistics(): Map<string, PoolStatistics> {
    const stats = new Map<string, PoolStatistics>()
    this.pools.forEach((pool, poolId) => {
      stats.set(poolId, pool.getStatistics())
    })
    return stats
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  public getPools(): string[] {
    return Array.from(this.pools.keys())
  }

  public clearAll(): void {
    this.pools.forEach(pool => pool.destroy())
    this.pools.clear()
  }

  public optimizeForMemoryPressure(): void {
    const memoryPressure = this.memoryOptimizer.getMemoryPressureLevel()

    this.pools.forEach(pool => {
      const stats = pool.getStatistics()

      switch (memoryPressure) {
        case 'high':
          pool.resize(Math.floor(stats.currentSize * 0.8))
          break
        case 'critical':
          pool.resize(Math.floor(stats.currentSize * 0.5))
          break
      }
    })
  }

  public getPoolReport(): {
    summary: PoolMetrics
    details: Array<{
      id: string
      stats: PoolStatistics
    }>
    recommendations: string[]
  } {
    const summary = this.getGlobalMetrics()
    const details = Array.from(this.pools.entries()).map(([id, pool]) => ({
      id,
      stats: pool.getStatistics()
    }))

    const recommendations: string[] = []

    if (summary.efficiency < 0.5) {
      recommendations.push('多个对象池效率较低，建议调整池大小或创建策略')
    }

    if (summary.totalMemory > 100 * 1024 * 1024) { // 100MB
      recommendations.push('对象池内存使用过高，建议清理未使用的池')
    }

    if (summary.totalPools > 20) {
      recommendations.push('对象池数量过多，建议合并相似类型的池')
    }

    return {
      summary,
      details,
      recommendations
    }
  }

  public destroy(): void {
    this.clearAll()
  }
}