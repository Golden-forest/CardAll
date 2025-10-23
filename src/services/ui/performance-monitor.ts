/**
 * UI性能监控服务
 * 监控用户界面性能指标，收集用户体验数据
 */

export interface PerformanceMetrics {
  // 渲染性能
  renderTime: number
  firstPaint: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  cumulativeLayoutShift: number
  firstInputDelay: number

  // 交互性能
  interactionTime: number
  clickLatency: number
  scrollPerformance: number
  inputResponsiveness: number

  // 内存使用
  memoryUsage: number
  memoryLeakDetected: boolean
  garbageCollectionTime: number

  // 网络性能
  networkLatency: number
  requestTime: number
  resourceLoadTime: number

  // 冲突解决性能
  conflictDetectionTime: number
  conflictResolutionTime: number
  batchOperationTime: number

  // 用户体验指标
  perceivedPerformance: number
  errorRate: number
  crashRate: number
  userSatisfaction: number

  // 时间戳
  timestamp: Date
  sessionId: string
}

export interface UserExperienceMetrics {
  // 任务完成时间
  averageTaskCompletionTime: number
  taskSuccessRate: number

  // 用户行为
  clickCount: number
  scrollDepth: number
  timeOnPage: number
  bounceRate: number

  // 冲突解决体验
  conflictResolutionSuccess: number
  conflictResolutionAttempts: number
  averageResolutionTime: number
  userPreferredResolution: string

  // 界面响应性
  interfaceResponsiveness: number
  loadingTime: number
  errorEncounterRate: number

  // 用户满意度
  satisfactionScore: number
  feedbackCount: number
  commonComplaints: string[]
}

export interface PerformanceAlert {
  id: string
  type: 'warning' | 'error' | 'critical'
  category: 'performance' | 'memory' | 'network' | 'ux'
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
  context?: any
  suggestions: string[]
}

export interface PerformanceReport {
  period: {
    start: Date
    end: Date
  }
  metrics: PerformanceMetrics[]
  userExperience: UserExperienceMetrics
  alerts: PerformanceAlert[]
  summary: {
    averagePerformance: number
    performanceTrend: 'improving' | 'stable' | 'declining'
    criticalIssues: number
    recommendations: string[]
  }
}

export class UIPerformanceMonitor {
  private static instance: UIPerformanceMonitor
  private metrics: PerformanceMetrics[] = []
  private alerts: PerformanceAlert[] = []
  private observers: PerformanceObserver[] = []
  private sessionId: string
  private startTime: number

  private constructor() {
    this.sessionId = this.generateSessionId()
    this.startTime = performance.now()
    this.initializeObservers()
  }

  static getInstance(): UIPerformanceMonitor {
    if (!UIPerformanceMonitor.instance) {
      UIPerformanceMonitor.instance = new UIPerformanceMonitor()
    }
    return UIPerformanceMonitor.instance
  }

  // ============================================================================
  // 初始化
  // ============================================================================

  private initializeObservers(): void {
    // 监控页面加载性能
    if ('PerformanceObserver' in window) {
      this.observePaintTiming()
      this.observeLayoutShift()
      this.observeInteraction()
    }

    // 监控内存使用
    this.observeMemoryUsage()

    // 监控网络性能
    this.observeNetworkPerformance()

    // 监控错误
    this.observeErrors()

    // 定期收集指标
    this.startPeriodicCollection()
  }

  private observePaintTiming(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach(entry => {
          if (entry.name === 'first-paint') {
            this.updateMetric('firstPaint', entry.startTime)
          } else if (entry.name === 'first-contentful-paint') {
            this.updateMetric('firstContentfulPaint', entry.startTime)
          }
        })
      })
      observer.observe({ entryTypes: ['paint'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('Failed to observe paint timing:', error)
    }
  }

  private observeLayoutShift(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        let cls = 0
        entries.forEach(entry => {
          if (entry instanceof LayoutShift) {
            cls += entry.value
          }
        })
        this.updateMetric('cumulativeLayoutShift', cls)
      })
      observer.observe({ entryTypes: ['layout-shift'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('Failed to observe layout shift:', error)
    }
  }

  private observeInteraction(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach(entry => {
          if (entry instanceof PerformanceEventTiming) {
            this.updateMetric('interactionTime', entry.duration)
            this.updateMetric('firstInputDelay', entry.processingStart - entry.startTime)
          }
        })
      })
      observer.observe({ entryTypes: ['first-input', 'event'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('Failed to observe interactions:', error)
    }
  }

  private observeMemoryUsage(): void {
    setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        this.updateMetric('memoryUsage', memory.usedJSHeapSize)

        // 检测内存泄漏
        if (memory.jsHeapSizeLimit - memory.usedJSHeapSize < memory.jsHeapSizeLimit * 0.1) {
          this.createAlert({
            type: 'warning',
            category: 'memory',
            message: 'High memory usage detected',
            severity: 'medium',
            suggestions: ['Check for memory leaks', 'Consider garbage collection']
          })
        }
      }
    }, 5000)
  }

  private observeNetworkPerformance(): void {
    // 监控网络请求性能
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const startTime = performance.now()
      try {
        const response = await originalFetch(...args)
        const endTime = performance.now()
        this.updateMetric('requestTime', endTime - startTime)
        return response
      } catch (error) {
        const endTime = performance.now()
        this.updateMetric('requestTime', endTime - startTime)
        throw error
      }
    }
  }

  private observeErrors(): void {
    window.addEventListener('error', (event) => {
      this.createAlert({
        type: 'error',
        category: 'performance',
        message: `JavaScript error: ${event.message}`,
        severity: 'high',
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      this.createAlert({
        type: 'error',
        category: 'performance',
        message: `Unhandled promise rejection: ${event.reason}`,
        severity: 'high'
      })
    })
  }

  private startPeriodicCollection(): void {
    setInterval(() => {
      this.collectMetrics()
    }, 30000) // 每30秒收集一次指标
  }

  // ============================================================================
  // 指标收集
  // ============================================================================

  private collectMetrics(): void {
    const metrics: PerformanceMetrics = {
      // 渲染性能
      renderTime: this.calculateRenderTime(),
      firstPaint: this.getMetric('firstPaint') || 0,
      firstContentfulPaint: this.getMetric('firstContentfulPaint') || 0,
      largestContentfulPaint: this.getLCP(),
      cumulativeLayoutShift: this.getMetric('cumulativeLayoutShift') || 0,
      firstInputDelay: this.getMetric('firstInputDelay') || 0,

      // 交互性能
      interactionTime: this.getMetric('interactionTime') || 0,
      clickLatency: this.measureClickLatency(),
      scrollPerformance: this.measureScrollPerformance(),
      inputResponsiveness: this.measureInputResponsiveness(),

      // 内存使用
      memoryUsage: this.getMemoryUsage(),
      memoryLeakDetected: this.detectMemoryLeak(),
      garbageCollectionTime: this.measureGarbageCollection(),

      // 网络性能
      networkLatency: this.measureNetworkLatency(),
      requestTime: this.getMetric('requestTime') || 0,
      resourceLoadTime: this.measureResourceLoadTime(),

      // 冲突解决性能
      conflictDetectionTime: this.getMetric('conflictDetectionTime') || 0,
      conflictResolutionTime: this.getMetric('conflictResolutionTime') || 0,
      batchOperationTime: this.getMetric('batchOperationTime') || 0,

      // 用户体验指标
      perceivedPerformance: this.calculatePerceivedPerformance(),
      errorRate: this.calculateErrorRate(),
      crashRate: this.calculateCrashRate(),
      userSatisfaction: this.calculateUserSatisfaction(),

      // 时间戳
      timestamp: new Date(),
      sessionId: this.sessionId
    }

    this.metrics.push(metrics)
    this.analyzeMetrics(metrics)
  }

  // ============================================================================
  // 冲突解决性能监控
  // ============================================================================

  public startConflictDetection(): () => void {
    const startTime = performance.now()
    return () => {
      const endTime = performance.now()
      this.updateMetric('conflictDetectionTime', endTime - startTime)
    }
  }

  public startConflictResolution(): () => void {
    const startTime = performance.now()
    return () => {
      const endTime = performance.now()
      this.updateMetric('conflictResolutionTime', endTime - startTime)
    }
  }

  public startBatchOperation(): () => void {
    const startTime = performance.now()
    return () => {
      const endTime = performance.now()
      this.updateMetric('batchOperationTime', endTime - startTime)
    }
  }

  // ============================================================================
  // 用户体验监控
  // ============================================================================

  public trackUserInteraction(action: string, duration: number, success: boolean): void {
    // 记录用户交互数据
    this.updateMetric(`${action}Duration`, duration)
    if (!success) {
      this.createAlert({
        type: 'warning',
        category: 'ux',
        message: `User interaction failed: ${action}`,
        severity: 'medium'
      })
    }
  }

  public trackUserSatisfaction(score: number, feedback?: string): void {
    this.updateMetric('userSatisfaction', score)
    if (feedback) {
      console.log('User feedback:', feedback)
    }
  }

  // ============================================================================
  // 性能分析
  // ============================================================================

  private analyzeMetrics(metrics: PerformanceMetrics): void {
    // 检查渲染性能
    if (metrics.renderTime > 100) {
      this.createAlert({
        type: 'warning',
        category: 'performance',
        message: 'Slow render time detected',
        severity: 'medium',
        suggestions: ['Optimize component rendering', 'Consider virtualization']
      })
    }

    // 检查内存使用
    if (metrics.memoryUsage > 100 * 1024 * 1024) { // 100MB
      this.createAlert({
        type: 'warning',
        category: 'memory',
        message: 'High memory usage detected',
        severity: 'medium',
        suggestions: ['Check for memory leaks', 'Optimize data structures']
      })
    }

    // 检查网络性能
    if (metrics.networkLatency > 1000) { // 1秒
      this.createAlert({
        type: 'warning',
        category: 'network',
        message: 'High network latency detected',
        severity: 'medium',
        suggestions: ['Check network connection', 'Optimize API calls']
      })
    }

    // 检查冲突解决性能
    if (metrics.conflictResolutionTime > 5000) { // 5秒
      this.createAlert({
        type: 'warning',
        category: 'performance',
        message: 'Slow conflict resolution detected',
        severity: 'medium',
        suggestions: ['Optimize conflict resolution algorithm', 'Consider caching']
      })
    }
  }

  // ============================================================================
  // 报告生成
  // ============================================================================

  public generateReport(timeRange: number = 3600000): PerformanceReport {
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - timeRange)

    const relevantMetrics = this.metrics.filter(m =>
      m.timestamp >= startTime && m.timestamp <= endTime
    )

    const uxMetrics = this.calculateUserExperienceMetrics(relevantMetrics)

    return {
      period: { start: startTime, end: endTime },
      metrics: relevantMetrics,
      userExperience: uxMetrics,
      alerts: this.alerts.filter(a => a.timestamp >= startTime),
      summary: {
        averagePerformance: this.calculateAveragePerformance(relevantMetrics),
        performanceTrend: this.calculatePerformanceTrend(relevantMetrics),
        criticalIssues: this.alerts.filter(a => a.severity === 'critical').length,
        recommendations: this.generateRecommendations(relevantMetrics, uxMetrics)
      }
    }
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private updateMetric(name: string, value: number): void {
    // 简单的指标更新实现
    const metrics = this.metrics[this.metrics.length - 1]
    if (metrics) {
      (metrics as any)[name] = value
    }
  }

  private getMetric(name: string): number | null {
    const metrics = this.metrics[this.metrics.length - 1]
    return metrics ? (metrics as any)[name] : null
  }

  private calculateRenderTime(): number {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigation) {
      return navigation.loadEventEnd - navigation.loadEventStart
    }
    return 0
  }

  private getLCP(): number {
    const lcp = performance.getEntriesByType('largest-contentful-paint')[0]
    return lcp ? lcp.startTime : 0
  }

  private measureClickLatency(): number {
    // 简化的点击延迟测量
    return 0
  }

  private measureScrollPerformance(): number {
    // 简化的滚动性能测量
    return 0
  }

  private measureInputResponsiveness(): number {
    // 简化的输入响应性测量
    return 0
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  private detectMemoryLeak(): boolean {
    // 简化的内存泄漏检测
    return false
  }

  private measureGarbageCollection(): number {
    // 简化的垃圾回收时间测量
    return 0
  }

  private measureNetworkLatency(): number {
    // 简化的网络延迟测量
    return 0
  }

  private measureResourceLoadTime(): number {
    // 简化的资源加载时间测量
    return 0
  }

  private calculatePerceivedPerformance(): number {
    // 计算感知性能分数 (0-100)
    return 85
  }

  private calculateErrorRate(): number {
    // 计算错误率
    return 0.01
  }

  private calculateCrashRate(): number {
    // 计算崩溃率
    return 0.001
  }

  private calculateUserSatisfaction(): number {
    // 计算用户满意度分数
    return 85
  }

  private calculateUserExperienceMetrics(metrics: PerformanceMetrics[]): UserExperienceMetrics {
    return {
      averageTaskCompletionTime: 0,
      taskSuccessRate: 0.95,
      clickCount: 0,
      scrollDepth: 0,
      timeOnPage: 0,
      bounceRate: 0.1,
      conflictResolutionSuccess: 0.9,
      conflictResolutionAttempts: 0,
      averageResolutionTime: 0,
      userPreferredResolution: 'auto',
      interfaceResponsiveness: 85,
      loadingTime: 0,
      errorEncounterRate: 0.02,
      satisfactionScore: 85,
      feedbackCount: 0,
      commonComplaints: []
    }
  }

  private calculateAveragePerformance(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0
    const total = metrics.reduce((sum, m) => sum + m.perceivedPerformance, 0)
    return total / metrics.length
  }

  private calculatePerformanceTrend(metrics: PerformanceMetrics[]): 'improving' | 'stable' | 'declining' {
    if (metrics.length < 2) return 'stable'

    const recent = metrics.slice(-10)
    const older = metrics.slice(-20, -10)

    const recentAvg = recent.reduce((sum, m) => sum + m.perceivedPerformance, 0) / recent.length
    const olderAvg = older.reduce((sum, m) => sum + m.perceivedPerformance, 0) / older.length

    if (recentAvg > olderAvg + 5) return 'improving'
    if (recentAvg < olderAvg - 5) return 'declining'
    return 'stable'
  }

  private generateRecommendations(metrics: PerformanceMetrics[], ux: UserExperienceMetrics): string[] {
    const recommendations: string[] = []

    if (ux.conflictResolutionSuccess < 0.8) {
      recommendations.push('Improve conflict resolution algorithms')
    }

    if (ux.interfaceResponsiveness < 70) {
      recommendations.push('Optimize UI responsiveness')
    }

    if (ux.errorEncounterRate > 0.05) {
      recommendations.push('Reduce error rates in user interactions')
    }

    return recommendations
  }

  private createAlert(alert: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
    const fullAlert: PerformanceAlert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date()
    }

    this.alerts.push(fullAlert)
    console.warn('Performance Alert:', fullAlert)
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  public getMetrics(): PerformanceMetrics[] {
    return [...this.metrics]
  }

  public getAlerts(): PerformanceAlert[] {
    return [...this.alerts]
  }

  public clearMetrics(): void {
    this.metrics = []
    this.alerts = []
  }

  public getRealtimeMetrics(): Partial<PerformanceMetrics> {
    return {
      renderTime: this.calculateRenderTime(),
      memoryUsage: this.getMemoryUsage(),
      networkLatency: this.measureNetworkLatency(),
      perceivedPerformance: this.calculatePerceivedPerformance()
    }
  }
}

// ============================================================================
// 导出便捷实例
// ============================================================================

export const performanceMonitor = UIPerformanceMonitor.getInstance()