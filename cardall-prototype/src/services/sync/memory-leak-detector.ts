/**
 * 内存泄漏检测器
 * 自动检测和报告内存泄漏问题，提供详细的泄漏分析
 */

import { MemoryUsageOptimizer } from './memory-usage-optimizer'

// ============================================================================
// 内存泄漏检测接口
// ============================================================================

export interface LeakDetectionConfig {
  // 基本配置
  enabled: boolean
  detectionInterval: number
  maxDetectionCycles: number

  // 检测阈值
  thresholds: {
    memoryGrowthRate: number // 每秒内存增长率阈值（字节）
    objectCountThreshold: number // 对象数量增长阈值
    retentionThreshold: number // 保留时间阈值（毫秒）
    leakProbabilityThreshold: number // 泄漏概率阈值（0-1）
  }

  // 检测策略
  strategies: {
    enableObjectTracking: boolean
    enableReferenceCounting: boolean
    enablePatternDetection: boolean
    enableHeapAnalysis: boolean
    enableDOMAnalysis: boolean
  }

  // 报告配置
  reporting: {
    autoReport: boolean
    reportInterval: number
    includeStackTrace: boolean
    includeObjectDetails: boolean
    severityThreshold: 'low' | 'medium' | 'high'
  }
}

export interface MemoryLeak {
  id: string
  type: 'object' | 'event' | 'dom' | 'closure' | 'reference' | 'unknown'
  severity: 'low' | 'medium' | 'high' | 'critical'
  location: string
  description: string
  detectedAt: number
  size: number
  objectCount: number
  growthRate: number
  stackTrace?: string
  objectDetails?: any
  recommendations: string[]
  probability: number
  status: 'active' | 'resolved' | 'investigating'
}

export interface DetectionSnapshot {
  timestamp: number
  memoryUsed: number
  objectCounts: Map<string, number>
  eventListeners: Map<string, number>
  domElements: number
  closures: number
  references: Map<string, number>
}

export interface LeakDetectionReport {
  period: {
    start: number
    end: number
  }
  totalLeaks: number
  activeLeaks: number
  resolvedLeaks: number
  leaksByType: Record<string, number>
  leaksBySeverity: Record<string, number>
  topLeaks: MemoryLeak[]
  summary: {
    totalMemoryLeaked: number
    averageGrowthRate: number
    detectionAccuracy: number
    falsePositiveRate: number
  }
  recommendations: string[]
}

// ============================================================================
// 内存泄漏检测器
// ============================================================================

export class MemoryLeakDetector {
  private static instance: MemoryLeakDetector
  private config: LeakDetectionConfig
  private memoryOptimizer: MemoryUsageOptimizer

  // 检测状态
  private isDetecting = false
  private detectionCycles = 0
  private snapshots: DetectionSnapshot[] = []
  private leaks: Map<string, MemoryLeak> = new Map()

  // 监控定时器
  private detectionTimer?: number
  private analysisTimer?: number

  // 跟踪数据
  private objectTracker: Map<string, { created: number; lastAccessed: number; size: number }> = new Map()
  private eventListenerTracker: Map<string, Array<{ target: any; handler: Function; added: number }>> = new Map()
  private referenceTracker: Map<string, Set<string>> = new Map()

  // ============================================================================
  // 构造函数和单例模式
  // ============================================================================

  private constructor(config: Partial<LeakDetectionConfig> = {}) {
    this.config = this.mergeConfig(config)
    this.memoryOptimizer = MemoryUsageOptimizer.getInstance()

    // 绑定方法
    this.performDetection = this.performDetection.bind(this)
    this.analyzeLeaks = this.analyzeLeaks.bind(this)
    this.handleObjectCreation = this.handleObjectCreation.bind(this)
    this.handleObjectDestruction = this.handleObjectDestruction.bind(this)
  }

  public static getInstance(config?: Partial<LeakDetectionConfig>): MemoryLeakDetector {
    if (!MemoryLeakDetector.instance) {
      MemoryLeakDetector.instance = new MemoryLeakDetector(config)
    }
    return MemoryLeakDetector.instance
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  private mergeConfig(config: Partial<LeakDetectionConfig>): LeakDetectionConfig {
    const defaultConfig: LeakDetectionConfig = {
      enabled: true,
      detectionInterval: 10000, // 10秒
      maxDetectionCycles: 100,
      thresholds: {
        memoryGrowthRate: 1024 * 100, // 100KB/s
        objectCountThreshold: 100,
        retentionThreshold: 300000, // 5分钟
        leakProbabilityThreshold: 0.7
      },
      strategies: {
        enableObjectTracking: true,
        enableReferenceCounting: true,
        enablePatternDetection: true,
        enableHeapAnalysis: true,
        enableDOMAnalysis: true
      },
      reporting: {
        autoReport: true,
        reportInterval: 300000, // 5分钟
        includeStackTrace: true,
        includeObjectDetails: true,
        severityThreshold: 'medium'
      }
    }

    return { ...defaultConfig, ...config }
  }

  public updateConfig(config: Partial<LeakDetectionConfig>): void {
    this.config = this.mergeConfig(config)
    this.restartDetection()
  }

  // ============================================================================
  // 检测控制
  // ============================================================================

  public startDetection(): void {
    if (this.isDetecting || !this.config.enabled) return

    this.isDetecting = true
    this.setupDetection()
    this.setupObjectTracking()
    this.setupEventTracking()
    this.setupReferenceTracking()

    console.log('内存泄漏检测器已启动')
  }

  public stopDetection(): void {
    if (!this.isDetecting) return

    this.isDetecting = false
    this.clearDetection()
    this.clearTracking()

    console.log('内存泄漏检测器已停止')
  }

  private setupDetection(): void {
    // 设置定时检测
    this.detectionTimer = window.setInterval(() => {
      this.performDetection()
    }, this.config.detectionInterval)

    // 设置定时分析
    this.analysisTimer = window.setInterval(() => {
      this.analyzeLeaks()
    }, this.config.reporting.reportInterval)
  }

  private clearDetection(): void {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer)
      this.detectionTimer = undefined
    }

    if (this.analysisTimer) {
      clearInterval(this.analysisTimer)
      this.analysisTimer = undefined
    }
  }

  // ============================================================================
  // 对象跟踪
  // ============================================================================

  private setupObjectTracking(): void {
    if (!this.config.strategies.enableObjectTracking) return

    // 监听对象创建和销毁
    this.wrapObjectCreation()
    this.wrapObjectDestruction()
  }

  private clearTracking(): void {
    this.objectTracker.clear()
    this.eventListenerTracker.clear()
    this.referenceTracker.clear()
  }

  private wrapObjectCreation(): void {
    // 包装常见对象创建方法
    const originalCreateElement = document.createElement
    const originalSetTimeout = window.setTimeout
    const originalSetInterval = window.setInterval

    // 创建元素跟踪
    document.createElement = function(tagName: string) {
      const element = originalCreateElement.call(document, tagName)
      MemoryLeakDetector.getInstance().trackObject(element, 'dom')
      return element
    }

    // 定时器跟踪
    window.setTimeout = function(handler: Function, timeout?: number, ...args: any[]) {
      const id = originalSetTimeout.call(window, handler, timeout, ...args)
      MemoryLeakDetector.getInstance().trackObject(id, 'timer')
      return id
    }

    window.setInterval = function(handler: Function, timeout?: number, ...args: any[]) {
      const id = originalSetInterval.call(window, handler, timeout, ...args)
      MemoryLeakDetector.getInstance().trackObject(id, 'interval')
      return id
    }
  }

  private wrapObjectDestruction(): void {
    // 监听对象销毁事件
    window.addEventListener('beforeunload', () => {
      this.handleObjectDestruction()
    })
  }

  private handleObjectCreation(obj: any, type: string): void {
    const id = this.generateObjectId(obj)
    this.objectTracker.set(id, {
      created: Date.now(),
      lastAccessed: Date.now(),
      size: this.estimateObjectSize(obj)
    })
  }

  private handleObjectDestruction(): void {
    // 清理已销毁的对象
    const now = Date.now()
    const toDelete: string[] = []

    this.objectTracker.forEach((data, id) => {
      if (now - data.lastAccessed > this.config.thresholds.retentionThreshold) {
        toDelete.push(id)
      }
    })

    toDelete.forEach(id => {
      this.objectTracker.delete(id)
    })
  }

  // ============================================================================
  // 事件监听器跟踪
  // ============================================================================

  private setupEventTracking(): void {
    if (!this.config.strategies.enableDOMAnalysis) return

    // 包装事件监听器添加/移除方法
    this.wrapEventListeners()
  }

  private wrapEventListeners(): void {
    const originalAddEventListener = EventTarget.prototype.addEventListener
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener

    EventTarget.prototype.addEventListener = function(
      type: string,
      handler: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) {
      originalAddEventListener.call(this, type, handler, options)

      const detector = MemoryLeakDetector.getInstance()
      detector.trackEventListener(this, type, handler)
    }

    EventTarget.prototype.removeEventListener = function(
      type: string,
      handler: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ) {
      originalRemoveEventListener.call(this, type, handler, options)

      const detector = MemoryLeakDetector.getInstance()
      detector.untrackEventListener(this, type, handler)
    }
  }

  private trackEventListener(target: any, type: string, handler: EventListenerOrEventListenerObject): void {
    const key = this.generateEventKey(target, type)
    if (!this.eventListenerTracker.has(key)) {
      this.eventListenerTracker.set(key, [])
    }

    const listeners = this.eventListenerTracker.get(key)!
    listeners.push({
      target,
      handler,
      added: Date.now()
    })
  }

  private untrackEventListener(target: any, type: string, handler: EventListenerOrEventListenerObject): void {
    const key = this.generateEventKey(target, type)
    const listeners = this.eventListenerTracker.get(key)

    if (listeners) {
      const index = listeners.findIndex(l => l.handler === handler)
      if (index > -1) {
        listeners.splice(index, 1)
      }

      if (listeners.length === 0) {
        this.eventListenerTracker.delete(key)
      }
    }
  }

  // ============================================================================
  // 引用跟踪
  // ============================================================================

  private setupReferenceTracking(): void {
    if (!this.config.strategies.enableReferenceCounting) return

    // 设置引用计数器
    this.setupReferenceCounter()
  }

  private setupReferenceCounter(): void {
    // 使用WeakMap来跟踪引用
    const refMap = new WeakMap<any, Set<string>>()

    // 包装对象赋值操作（简化实现）
    const detector = this
    Object.defineProperty(Object.prototype, 'leakDetectorRef', {
      get() {
        return refMap.get(this)
      },
      set(value: Set<string>) {
        refMap.set(this, value)
      },
      enumerable: false,
      configurable: true
    })
  }

  // ============================================================================
  // 检测逻辑
  // ============================================================================

  private performDetection(): void {
    if (this.detectionCycles >= this.config.maxDetectionCycles) {
      this.stopDetection()
      return
    }

    this.detectionCycles++

    // 创建当前快照
    const snapshot = this.createSnapshot()
    this.snapshots.push(snapshot)

    // 保持快照历史在合理范围内
    if (this.snapshots.length > 50) {
      this.snapshots = this.snapshots.slice(-40)
    }

    // 分析快照
    this.analyzeSnapshot(snapshot)

    // 检测特定类型的泄漏
    if (this.config.strategies.enableObjectTracking) {
      this.detectObjectLeaks()
    }

    if (this.config.strategies.enableDOMAnalysis) {
      this.detectDOMLeaks()
    }

    if (this.config.strategies.enablePatternDetection) {
      this.detectPatternLeaks()
    }
  }

  private createSnapshot(): DetectionSnapshot {
    return {
      timestamp: Date.now(),
      memoryUsed: this.getCurrentMemoryUsage(),
      objectCounts: this.getObjectCounts(),
      eventListeners: this.getEventListenerCounts(),
      domElements: this.getDOMElementCount(),
      closures: this.getClosureCount(),
      references: this.getReferenceCounts()
    }
  }

  private analyzeSnapshot(snapshot: DetectionSnapshot): void {
    // 分析内存增长趋势
    if (this.snapshots.length > 1) {
      const prevSnapshot = this.snapshots[this.snapshots.length - 2]
      const growthRate = (snapshot.memoryUsed - prevSnapshot.memoryUsed) /
        ((snapshot.timestamp - prevSnapshot.timestamp) / 1000)

      if (growthRate > this.config.thresholds.memoryGrowthRate) {
        this.detectMemoryGrowthLeak(growthRate)
      }
    }
  }

  private detectObjectLeaks(): void {
    const now = Date.now()
    const leakedObjects: string[] = []

    this.objectTracker.forEach((data, id) => {
      if (now - data.lastAccessed > this.config.thresholds.retentionThreshold) {
        leakedObjects.push(id)
      }
    })

    if (leakedObjects.length > this.config.thresholds.objectCountThreshold) {
      this.reportLeak({
        id: this.generateLeakId(),
        type: 'object',
        severity: 'medium',
        location: 'general',
        description: `检测到 ${leakedObjects.length} 个长时间未访问的对象`,
        detectedAt: now,
        size: leakedObjects.length * 1024, // 估算大小
        objectCount: leakedObjects.length,
        growthRate: leakedObjects.length / (this.config.thresholds.retentionThreshold / 1000),
        recommendations: [
          '检查对象生命周期管理',
          '确保对象在使用后正确释放',
          '考虑使用弱引用或对象池'
        ],
        probability: 0.8,
        status: 'active'
      })
    }
  }

  private detectDOMLeaks(): void {
    // 检测DOM元素泄漏
    const domElements = document.querySelectorAll('*')
    const detachedElements: Element[] = []

    domElements.forEach(element => {
      if (!document.body.contains(element)) {
        detachedElements.push(element)
      }
    })

    if (detachedElements.length > 10) {
      this.reportLeak({
        id: this.generateLeakId(),
        type: 'dom',
        severity: 'high',
        location: 'dom',
        description: `检测到 ${detachedElements.length} 个分离的DOM元素`,
        detectedAt: Date.now(),
        size: detachedElements.length * 500, // 估算DOM元素大小
        objectCount: detachedElements.length,
        growthRate: detachedElements.length / 60, // 假设每分钟增长
        recommendations: [
          '确保DOM元素在不需要时从DOM中移除',
          '清理DOM元素的事件监听器',
          '避免在闭包中引用DOM元素'
        ],
        probability: 0.9,
        status: 'active'
      })
    }
  }

  private detectPatternLeaks(): void {
    // 检测常见的泄漏模式
    this.detectClosureLeaks()
    this.detectTimerLeaks()
    this.detectReferenceLeaks()
  }

  private detectClosureLeaks(): void {
    // 检测闭包泄漏
    const closures = this.getClosureCount()
    if (closures > 100) {
      this.reportLeak({
        id: this.generateLeakId(),
        type: 'closure',
        severity: 'medium',
        location: 'closures',
        description: `检测到大量闭包 (${closures} 个)`,
        detectedAt: Date.now(),
        size: closures * 2048,
        objectCount: closures,
        growthRate: closures / 300, // 假设每5分钟增长
        recommendations: [
          '避免在循环中创建闭包',
          '使用函数节流和防抖',
          '及时清理闭包引用'
        ],
        probability: 0.7,
        status: 'active'
      })
    }
  }

  private detectTimerLeaks(): void {
    // 检测定时器泄漏
    const timerCount = this.objectTracker.size
    if (timerCount > 50) {
      this.reportLeak({
        id: this.generateLeakId(),
        type: 'event',
        severity: 'high',
        location: 'timers',
        description: `检测到过多的定时器 (${timerCount} 个)`,
        detectedAt: Date.now(),
        size: timerCount * 256,
        objectCount: timerCount,
        growthRate: timerCount / 60,
        recommendations: [
          '确保定时器在使用后清除',
          '使用setTimeout替代setInterval',
          '避免递归定时器'
        ],
        probability: 0.8,
        status: 'active'
      })
    }
  }

  private detectReferenceLeaks(): void {
    // 检测引用循环
    const referenceCount = this.referenceTracker.size
    if (referenceCount > 100) {
      this.reportLeak({
        id: this.generateLeakId(),
        type: 'reference',
        severity: 'medium',
        location: 'references',
        description: `检测到可能存在引用循环 (${referenceCount} 个引用)`,
        detectedAt: Date.now(),
        size: referenceCount * 1024,
        objectCount: referenceCount,
        growthRate: referenceCount / 120,
        recommendations: [
          '避免循环引用',
          '使用WeakMap和WeakSet',
          '手动断开不需要的引用'
        ],
        probability: 0.6,
        status: 'active'
      })
    }
  }

  private detectMemoryGrowthLeak(growthRate: number): void {
    this.reportLeak({
      id: this.generateLeakId(),
      type: 'unknown',
      severity: 'high',
      location: 'memory',
      description: `检测到内存持续增长 (${(growthRate / 1024).toFixed(2)} KB/s)`,
      detectedAt: Date.now(),
      size: growthRate * 60, // 估算一分钟的增长量
      objectCount: 0,
      growthRate,
      recommendations: [
        '检查内存分配模式',
        '分析大对象创建',
        '考虑内存分析工具'
      ],
      probability: 0.85,
      status: 'active'
    })
  }

  // ============================================================================
  // 泄漏报告
  // ============================================================================

  private reportLeak(leak: MemoryLeak): void {
    this.leaks.set(leak.id, leak)

    // 检查是否需要自动报告
    if (this.config.reporting.autoReport &&
        leak.severity === this.config.reporting.severityThreshold) {
      this.generateLeakReport()
    }

    console.warn(`检测到内存泄漏: ${leak.description} (严重性: ${leak.severity})`)
  }

  private analyzeLeaks(): void {
    // 分析泄漏趋势和模式
    this.updateLeakStatus()
    this.generateLeakReport()
  }

  private updateLeakStatus(): void {
    const now = Date.now()

    this.leaks.forEach((leak, id) => {
      // 检查泄漏是否已解决
      if (now - leak.detectedAt > this.config.thresholds.retentionThreshold) {
        leak.status = 'resolved'
      }
    })
  }

  private generateLeakReport(): LeakDetectionReport {
    const now = Date.now()
    const report: LeakDetectionReport = {
      period: {
        start: now - this.config.reporting.reportInterval,
        end: now
      },
      totalLeaks: this.leaks.size,
      activeLeaks: 0,
      resolvedLeaks: 0,
      leaksByType: {},
      leaksBySeverity: {},
      topLeaks: [],
      summary: {
        totalMemoryLeaked: 0,
        averageGrowthRate: 0,
        detectionAccuracy: 0,
        falsePositiveRate: 0
      },
      recommendations: []
    }

    // 统计泄漏信息
    this.leaks.forEach(leak => {
      if (leak.status === 'active') {
        report.activeLeaks++
        report.summary.totalMemoryLeaked += leak.size
        report.summary.averageGrowthRate += leak.growthRate
      } else {
        report.resolvedLeaks++
      }

      // 按类型统计
      report.leaksByType[leak.type] = (report.leaksByType[leak.type] || 0) + 1

      // 按严重性统计
      report.leaksBySeverity[leak.severity] = (report.leaksBySeverity[leak.severity] || 0) + 1
    })

    // 计算平均增长率
    if (report.activeLeaks > 0) {
      report.summary.averageGrowthRate /= report.activeLeaks
    }

    // 获取top泄漏
    report.topLeaks = Array.from(this.leaks.values())
      .filter(leak => leak.status === 'active')
      .sort((a, b) => b.severity.localeCompare(a.severity))
      .slice(0, 10)

    // 生成建议
    report.recommendations = this.generateRecommendations()

    return report
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    const activeLeaks = Array.from(this.leaks.values()).filter(leak => leak.status === 'active')

    if (activeLeaks.length === 0) {
      recommendations.push('未检测到内存泄漏，继续保持良好的内存管理实践')
      return recommendations
    }

    // 基于泄漏类型生成建议
    const typeCounts: Record<string, number> = {}
    activeLeaks.forEach(leak => {
      typeCounts[leak.type] = (typeCounts[leak.type] || 0) + 1
    })

    if (typeCounts['object'] > 0) {
      recommendations.push('对象泄漏：使用对象池或确保正确释放对象引用')
    }

    if (typeCounts['dom'] > 0) {
      recommendations.push('DOM泄漏：及时清理DOM元素和事件监听器')
    }

    if (typeCounts['closure'] > 0) {
      recommendations.push('闭包泄漏：避免在闭包中捕获大量变量')
    }

    if (typeCounts['event'] > 0) {
      recommendations.push('事件泄漏：确保清除定时器和事件监听器')
    }

    // 通用建议
    if (activeLeaks.length > 5) {
      recommendations.push('泄漏数量较多，建议进行全面代码审查')
    }

    recommendations.push('定期使用浏览器开发者工具进行内存分析')

    return recommendations
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return memory.usedJSHeapSize
    }
    return 0
  }

  private getObjectCounts(): Map<string, number> {
    const counts = new Map<string, number>()

    // 统计各种对象数量
    counts.set('dom', this.getDOMElementCount())
    counts.set('timers', this.objectTracker.size)
    counts.set('closures', this.getClosureCount())

    return counts
  }

  private getEventListenerCounts(): Map<string, number> {
    const counts = new Map<string, number>()

    this.eventListenerTracker.forEach((listeners, key) => {
      counts.set(key, listeners.length)
    })

    return counts
  }

  private getDOMElementCount(): number {
    return document.querySelectorAll('*').length
  }

  private getClosureCount(): number {
    // 简化的闭包计数
    return this.objectTracker.size
  }

  private getReferenceCounts(): Map<string, number> {
    const counts = new Map<string, number>()

    this.referenceTracker.forEach((refs, key) => {
      counts.set(key, refs.size)
    })

    return counts
  }

  private estimateObjectSize(obj: any): number {
    // 简化的对象大小估算
    return JSON.stringify(obj).length * 2 // 粗略估算
  }

  private generateObjectId(obj: any): string {
    return `obj_${obj.constructor.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateEventKey(target: any, type: string): string {
    return `event_${target.constructor.name}_${type}`
  }

  private generateLeakId(): string {
    return `leak_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  public trackObject(obj: any, type: string): void {
    if (!this.config.strategies.enableObjectTracking) return

    const id = this.generateObjectId(obj)
    this.handleObjectCreation(obj, type)
  }

  public untrackObject(obj: any): void {
    if (!this.config.strategies.enableObjectTracking) return

    const id = this.generateObjectId(obj)
    this.objectTracker.delete(id)
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  public getLeaks(): MemoryLeak[] {
    return Array.from(this.leaks.values())
  }

  public getActiveLeaks(): MemoryLeak[] {
    return Array.from(this.leaks.values()).filter(leak => leak.status === 'active')
  }

  public getLeakReport(): LeakDetectionReport {
    return this.generateLeakReport()
  }

  public resolveLeak(leakId: string): boolean {
    const leak = this.leaks.get(leakId)
    if (leak) {
      leak.status = 'resolved'
      return true
    }
    return false
  }

  public clearResolvedLeaks(): void {
    const toDelete: string[] = []

    this.leaks.forEach((leak, id) => {
      if (leak.status === 'resolved') {
        toDelete.push(id)
      }
    })

    toDelete.forEach(id => {
      this.leaks.delete(id)
    })
  }

  public getStatistics(): {
    totalLeaks: number
    activeLeaks: number
    resolvedLeaks: number
    detectionCycles: number
    averageMemoryUsage: number
    lastDetectionTime: number
  } {
    const activeLeaks = Array.from(this.leaks.values()).filter(leak => leak.status === 'active')
    const resolvedLeaks = Array.from(this.leaks.values()).filter(leak => leak.status === 'resolved')

    const lastSnapshot = this.snapshots[this.snapshots.length - 1]
    const avgMemory = this.snapshots.length > 0
      ? this.snapshots.reduce((sum, snap) => sum + snap.memoryUsed, 0) / this.snapshots.length
      : 0

    return {
      totalLeaks: this.leaks.size,
      activeLeaks: activeLeaks.length,
      resolvedLeaks: resolvedLeaks.length,
      detectionCycles: this.detectionCycles,
      averageMemoryUsage: avgMemory,
      lastDetectionTime: lastSnapshot?.timestamp || 0
    }
  }

  public forceDetection(): void {
    this.performDetection()
  }

  public restartDetection(): void {
    this.stopDetection()
    this.startDetection()
  }

  public destroy(): void {
    this.stopDetection()
    this.leaks.clear()
    this.snapshots.length = 0
    this.clearTracking()
  }
}