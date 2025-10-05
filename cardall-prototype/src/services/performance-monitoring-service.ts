// ============================================================================
// 性能监控和测试验证服务
// 
// 专门为小型数据集批量上传提供全面的性能监控和测试验证
// 支持实时监控、性能分析、自动化测试、基准测试等功能
// ============================================================================

import { intelligentBatchUploadService, type BatchUploadStats } from './intelligent-batch-upload'
import { uploadQueueManager, type QueueStats } from './upload-queue-manager'
import { resumableUploadService } from './resumable-upload-service'
import { networkStateDetector } from './network-state-detector'
import { dataCompressionOptimizer } from './data-compression-optimizer'

// 性能指标
export // 监控配置
export // 告警阈值
export // 性能目标
export // 性能告警
export // 测试用例
export // 测试数据
export // 网络条件
export // 系统负载
export // 预期结果
export // 测试结果
export // 测试检查
export // 测试错误
export // 测试分析
export // 性能分析
export // 可靠性分析
export // 效率分析
export // 基准测试结果
export   // 排名
  rank: number
  score: number
}

class PerformanceMonitoringService {
  private metrics: PerformanceMetrics[] = []
  private alerts: PerformanceAlert[] = []
  private activeTests: Map<string, TestCase> = new Map()
  private testHistory: TestCase[] = []
  private benchmarks: BenchmarkResult[] = []
  
  private config: MonitoringConfig
  private monitoringInterval: NodeJS.Timeout | null = null
  private testInterval: NodeJS.Timeout | null = null

  constructor() {
    this.config = this.getDefaultConfig()
    this.initialize()
  }

  // 获取默认配置
  private getDefaultConfig(): MonitoringConfig {
    return {
      sampleInterval: 1000, // 1秒
      maxSamples: 1000,
      enableAlerts: true,
      alertThresholds: {
        maxUploadTime: 30000, // 30秒
        maxResponseTime: 5000, // 5秒
        maxErrorRate: 0.05, // 5%
        maxRetryRate: 0.1, // 10%
        maxCpuUsage: 80, // 80%
        maxMemoryUsage: 85, // 85%
        maxBandwidthUsage: 90, // 90%
        maxQueueSize: 100,
        maxProcessingTime: 10000 // 10秒
      },
      performanceTargets: {
        minCompressionRatio: 0.3, // 30%
        maxNetworkRequests: 50,
        targetSuccessRate: 0.95, // 95%
        maxUploadTime: 20000, // 20秒
        minThroughput: 100, // KB/s
        maxCpuUsage: 70,
        maxMemoryUsage: 75
      },
      collectNetworkMetrics: true,
      collectResourceMetrics: true,
      collectQueueMetrics: true,
      persistMetrics: true,
      retentionPeriod: 7 * 24 * 60 * 60 * 1000 // 7天
    }
  }

  // 初始化监控服务
  private initialize() {
    // 启动监控
    this.startMonitoring()
    
    // 启动定期测试
    this.startPeriodicTesting()
    
    // 恢复历史数据
    this.restoreMetrics()
    
    // 监听系统事件
    this.setupEventListeners()
    
    console.log('Performance monitoring service initialized')
  }

  // 设置事件监听器
  private setupEventListeners() {
    // 监听批量上传事件
    if (typeof intelligentBatchUploadService['on'] === 'function') {
      // @ts-ignore
      intelligentBatchUploadService.on('uploadStart', this.handleUploadStart.bind(this))
      // @ts-ignore
      intelligentBatchUploadService.on('uploadComplete', this.handleUploadComplete.bind(this))
      // @ts-ignore
      intelligentBatchUploadService.on('uploadError', this.handleUploadError.bind(this))
    }
    
    // 监听网络状态变化
    networkStateDetector.addListener({
      onNetworkStateChanged: this.handleNetworkStateChange.bind(this)
    })
  }

  // 处理上传开始
  private handleUploadStart(event: any) {
    const currentMetrics = this.getCurrentMetrics()
    currentMetrics.uploadStartTime = new Date()
    this.recordMetrics(currentMetrics)
  }

  // 处理上传完成
  private handleUploadComplete(event: any) {
    const currentMetrics = this.getCurrentMetrics()
    currentMetrics.uploadEndTime = new Date()
    currentMetrics.totalUploadTime = currentMetrics.uploadEndTime.getTime() - currentMetrics.uploadStartTime!.getTime()
    this.recordMetrics(currentMetrics)
    
    // 触发性能分析
    this.analyzePerformance(currentMetrics)
  }

  // 处理上传错误
  private handleUploadError(event: any) {
    const currentMetrics = this.getCurrentMetrics()
    currentMetrics.errorCount++
    this.recordMetrics(currentMetrics)
    
    // 检查是否需要告警
    this.checkErrorAlerts(currentMetrics)
  }

  // 处理网络状态变化
  private handleNetworkStateChange(state: any) {
    const currentMetrics = this.getCurrentMetrics()
    currentMetrics.bandwidthUtilization = state.downlink * 1024 || 0
    currentMetrics.latency = state.rtt || 0
    this.recordMetrics(currentMetrics)
  }

  // 启动监控
  private startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
      this.checkAlerts()
      this.cleanupOldData()
    }, this.config.sampleInterval)
  }

  // 启动定期测试
  private startPeriodicTesting() {
    if (this.testInterval) {
      clearInterval(this.testInterval)
    }

    // 每小时运行一次性能测试
    this.testInterval = setInterval(() => {
      this.runPerformanceTests()
    }, 60 * 60 * 1000)
  }

  // 收集性能指标
  private collectMetrics() {
    const metrics = this.getCurrentMetrics()
    this.recordMetrics(metrics)
  }

  // 获取当前性能指标
  private getCurrentMetrics(): PerformanceMetrics {
    const networkState = networkStateDetector.getCurrentState()
    const batchStats = intelligentBatchUploadService.getBatchStats()
    const queueStats = uploadQueueManager.getQueueStats()
    
    return {
      timestamp: new Date(),
      uploadStartTime: undefined,
      uploadEndTime: undefined,
      totalUploadTime: 0,
      totalDataSize: batchStats.totalSize,
      compressedDataSize: batchStats.compressedSize,
      compressionRatio: batchStats.compressionRatio,
      actualTransferSize: batchStats.totalSize - batchStats.compressedSize,
      networkRequests: batchStats.networkRequests,
      averageResponseTime: this.calculateAverageResponseTime(),
      bandwidthUtilization: networkState.downlink * 1024 || 0,
      latency: networkState.rtt || 0,
      cpuUsage: this.estimateCPUUsage(),
      memoryUsage: this.estimateMemoryUsage(),
      storageUsage: this.estimateStorageUsage(),
      queueSize: queueStats.queueSize,
      processingTime: queueStats.averageProcessingTime,
      waitingTime: this.calculateWaitingTime(),
      errorCount: this.calculateErrorCount(),
      retryCount: batchStats.retryCount,
      successRate: queueStats.successRate,
      batchEfficiency: this.calculateBatchEfficiency(),
      overheadRatio: this.calculateOverheadRatio()
    }
  }

  // 计算平均响应时间
  private calculateAverageResponseTime(): number {
    // 简化的响应时间计算
    return this.metrics.length > 0 
      ? this.metrics.slice(-10).reduce((sum, m) => sum + m.latency, 0) / Math.min(10, this.metrics.length)
      : 0
  }

  // 计算等待时间
  private calculateWaitingTime(): number {
    const queueStats = uploadQueueManager.getQueueStats()
    return queueStats.averageProcessingTime * 0.3 // 估算等待时间
  }

  // 计算错误数量
  private calculateErrorCount(): number {
    return this.alerts.filter(alert => !alert.resolved).length
  }

  // 计算批量效率
  private calculateBatchEfficiency(): number {
    const batchStats = intelligentBatchUploadService.getBatchStats()
    if (batchStats.totalItems === 0) return 1
    
    const efficiency = batchStats.networkRequests / batchStats.totalItems
    return Math.max(0, 1 - efficiency) // 越接近1越好
  }

  // 计算开销比例
  private calculateOverheadRatio(): number {
    const currentMetrics = this.getCurrentMetrics()
    if (currentMetrics.totalDataSize === 0) return 0
    
    return (currentMetrics.actualTransferSize - currentMetrics.compressedDataSize) / currentMetrics.totalDataSize
  }

  // 估算CPU使用率
  private estimateCPUUsage(): number {
    if (!window.performance) return 0
    
    try {
      // @ts-ignore
      if (performance.memory) {
        // 简单的CPU使用率估算
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        if (navigation) {
          const loadTime = navigation.loadEventEnd - navigation.loadEventStart
          const totalTime = navigation.loadEventEnd - navigation.startTime
          return Math.min(100, (loadTime / totalTime) * 100)
        }
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    
    return 0
  }

  // 估算内存使用率
  private estimateMemoryUsage(): number {
    if (!window.performance) return 0
    
    try {
      // @ts-ignore
      if (performance.memory) {
        // @ts-ignore
        const used = performance.memory.usedJSHeapSize
        // @ts-ignore
        const total = performance.memory.totalJSHeapSize
        return Math.min(100, (used / total) * 100)
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    
    return 0
  }

  // 估算存储使用率
  private estimateStorageUsage(): number {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        return navigator.storage.estimate().then(estimate => {
          if (estimate.quota && estimate.usage) {
            return (estimate.usage / estimate.quota) * 100
          }
          return 0
        })
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
    
    return 0
  }

  // 记录性能指标
  private recordMetrics(metrics: PerformanceMetrics) {
    this.metrics.push(metrics)
    
    // 保持指标数量限制
    if (this.metrics.length > this.config.maxSamples) {
      this.metrics = this.metrics.slice(-this.config.maxSamples)
    }
    
    // 持久化指标
    if (this.config.persistMetrics) {
      this.persistMetrics()
    }
  }

  // 检查告警
  private checkAlerts() {
    if (!this.config.enableAlerts) return
    
    const currentMetrics = this.getCurrentMetrics()
    const thresholds = this.config.alertThresholds
    
    // 检查各种阈值
    this.checkThresholdAlerts(currentMetrics, thresholds)
  }

  // 检查阈值告警
  private checkThresholdAlerts(metrics: PerformanceMetrics, thresholds: AlertThresholds) {
    // 检查上传时间
    if (metrics.totalUploadTime > thresholds.maxUploadTime) {
      this.createAlert('error', 'performance', 
        `Upload time exceeded threshold: ${metrics.totalUploadTime}ms > ${thresholds.maxUploadTime}ms`,
        metrics.totalUploadTime, thresholds.maxUploadTime
      )
    }
    
    // 检查响应时间
    if (metrics.averageResponseTime > thresholds.maxResponseTime) {
      this.createAlert('warning', 'network',
        `Response time exceeded threshold: ${metrics.averageResponseTime}ms > ${thresholds.maxResponseTime}ms`,
        metrics.averageResponseTime, thresholds.maxResponseTime
      )
    }
    
    // 检查CPU使用率
    if (metrics.cpuUsage > thresholds.maxCpuUsage) {
      this.createAlert('warning', 'resource',
        `CPU usage exceeded threshold: ${metrics.cpuUsage}% > ${thresholds.maxCpuUsage}%`,
        metrics.cpuUsage, thresholds.maxCpuUsage
      )
    }
    
    // 检查内存使用率
    if (metrics.memoryUsage > thresholds.maxMemoryUsage) {
      this.createAlert('warning', 'resource',
        `Memory usage exceeded threshold: ${metrics.memoryUsage}% > ${thresholds.maxMemoryUsage}%`,
        metrics.memoryUsage, thresholds.maxMemoryUsage
      )
    }
    
    // 检查队列大小
    if (metrics.queueSize > thresholds.maxQueueSize) {
      this.createAlert('warning', 'queue',
        `Queue size exceeded threshold: ${metrics.queueSize} > ${thresholds.maxQueueSize}`,
        metrics.queueSize, thresholds.maxQueueSize
      )
    }
  }

  // 检查错误告警
  private checkErrorAlerts(metrics: PerformanceMetrics) {
    const thresholds = this.config.alertThresholds
    
    // 检查错误率
    const errorRate = metrics.errorCount / Math.max(1, metrics.networkRequests)
    if (errorRate > thresholds.maxErrorRate) {
      this.createAlert('error', 'performance',
        `Error rate exceeded threshold: ${(errorRate * 100).toFixed(2)}% > ${(thresholds.maxErrorRate * 100).toFixed(2)}%`,
        errorRate, thresholds.maxErrorRate
      )
    }
    
    // 检查重试率
    const retryRate = metrics.retryCount / Math.max(1, metrics.networkRequests)
    if (retryRate > thresholds.maxRetryRate) {
      this.createAlert('warning', 'performance',
        `Retry rate exceeded threshold: ${(retryRate * 100).toFixed(2)}% > ${(thresholds.maxRetryRate * 100).toFixed(2)}%`,
        retryRate, thresholds.maxRetryRate
      )
    }
  }

  // 创建告警
  private createAlert(type: PerformanceAlert['type'], category: PerformanceAlert['category'], 
    message: string, value: number, threshold: number) {
    
    const alert: PerformanceAlert = {
      id: crypto.randomUUID(),
      type,
      category,
      message,
      value,
      threshold,
      timestamp: new Date(),
      resolved: false,
      context: this.getCurrentMetrics(),
      suggestions: this.generateSuggestions(type, category, value, threshold)
    }
    
    this.alerts.push(alert)
    
    // 记录告警
    console.warn(`Performance Alert: ${message}`)
    
    // 触发告警处理
    this.handleAlert(alert)
  }

  // 生成建议
  private generateSuggestions(type: PerformanceAlert['type'], category: PerformanceAlert['category'], 
    value: number, threshold: number): string[] {
    
    const suggestions: string[] = []
    
    switch (category) {
      case 'performance':
        if (type === 'error') {
          suggestions.push('检查网络连接')
          suggestions.push('减少批量大小')
          suggestions.push('增加重试次数')
        } else {
          suggestions.push('优化上传策略')
          suggestions.push('检查系统资源')
        }
        break
        
      case 'resource':
        suggestions.push('关闭不必要的应用程序')
        suggestions.push('增加系统内存')
        suggestions.push('优化代码性能')
        break
        
      case 'network':
        suggestions.push('检查网络带宽')
        suggestions.push('使用数据压缩')
        suggestions.push('调整上传时间')
        break
        
      case 'queue':
        suggestions.push('增加处理线程')
        suggestions.push('优化队列算法')
        suggestions.push('清理积压项目')
        break
    }
    
    return suggestions
  }

  // 处理告警
  private handleAlert(alert: PerformanceAlert) {
    // 根据告警类型执行相应操作
    switch (alert.type) {
      case 'critical':
        // 立即停止上传
        this.emergencyStop()
        break
        
      case 'error':
        // 记录错误并通知
        this.notifyError(alert)
        break
        
      case 'warning':
        // 调整参数
        this.adjustParameters(alert)
        break
    }
  }

  // 紧急停止
  private emergencyStop() {
    console.log('Emergency stop triggered by critical alert')
    
    // 停止所有上传
    // @ts-ignore
    if (intelligentBatchUploadService.pauseBatchUpload) {
      // @ts-ignore
      intelligentBatchUploadService.pauseBatchUpload()
    }
  }

  // 通知错误
  private notifyError(alert: PerformanceAlert) {
    // 这里可以实现错误通知逻辑
    console.error('Performance error notification:', alert.message)
  }

  // 调整参数
  private adjustParameters(alert: PerformanceAlert) {
    // 根据告警类型调整系统参数
    if (alert.category === 'resource') {
      // 减少并行上传
      const currentConfig = uploadQueueManager.getConfig()
      uploadQueueManager.updateConfig({
        ...currentConfig,
        maxParallelUploads: Math.max(1, Math.floor(currentConfig.maxParallelUploads * 0.8))
      })
    }
  }

  // 分析性能
  private analyzePerformance(metrics: PerformanceMetrics) {
    const analysis = this.performPerformanceAnalysis(metrics)
    
    // 记录分析结果
    console.log('Performance Analysis:', analysis)
    
    // 如果性能不佳,提供建议
    if (analysis.overallScore < 70) {
      this.generatePerformanceRecommendations(analysis)
    }
  }

  // 执行性能分析
  private performPerformanceAnalysis(metrics: PerformanceMetrics): PerformanceAnalysis {
    const targets = this.config.performanceTargets
    
    // 计算各维度得分
    const speedScore = this.calculateSpeedScore(metrics, targets)
    const efficiencyScore = this.calculateEfficiencyScore(metrics, targets)
    const reliabilityScore = this.calculateReliabilityScore(metrics, targets)
    const resourceScore = this.calculateResourceScore(metrics, targets)
    
    const overallScore = (speedScore + efficiencyScore + reliabilityScore + resourceScore) / 4
    
    // 识别瓶颈和优势
    const bottleneck = this.identifyBottleneck(metrics, targets)
    const strength = this.identifyStrength(metrics, targets)
    const improvement = this.suggestImprovement(metrics, targets)
    
    return {
      overallScore,
      speedScore,
      efficiencyScore,
      reliabilityScore,
      resourceScore,
      bottleneck,
      strength,
      improvement
    }
  }

  // 计算速度得分
  private calculateSpeedScore(metrics: PerformanceMetrics, targets: PerformanceTargets): number {
    const uploadTimeScore = Math.max(0, 100 - (metrics.totalUploadTime / targets.maxUploadTime) * 100)
    const throughputScore = Math.min(100, (metrics.bandwidthUtilization / targets.minThroughput) * 100)
    
    return (uploadTimeScore + throughputScore) / 2
  }

  // 计算效率得分
  private calculateEfficiencyScore(metrics: PerformanceMetrics, targets: PerformanceTargets): number {
    const compressionScore = Math.min(100, (metrics.compressionRatio / targets.minCompressionRatio) * 100)
    const requestScore = Math.max(0, 100 - (metrics.networkRequests / targets.maxNetworkRequests) * 100)
    
    return (compressionScore + requestScore) / 2
  }

  // 计算可靠性得分
  private calculateReliabilityScore(metrics: PerformanceMetrics, targets: PerformanceTargets): number {
    const successScore = metrics.successRate * 100
    const errorScore = Math.max(0, 100 - (metrics.errorCount / Math.max(1, metrics.networkRequests)) * 100)
    
    return (successScore + errorScore) / 2
  }

  // 计算资源得分
  private calculateResourceScore(metrics: PerformanceMetrics, targets: PerformanceTargets): number {
    const cpuScore = Math.max(0, 100 - (metrics.cpuUsage / targets.maxCpuUsage) * 100)
    const memoryScore = Math.max(0, 100 - (metrics.memoryUsage / targets.maxMemoryUsage) * 100)
    
    return (cpuScore + memoryScore) / 2
  }

  // 识别瓶颈
  private identifyBottleneck(metrics: PerformanceMetrics, targets: PerformanceTargets): string {
    if (metrics.totalUploadTime > targets.maxUploadTime) {
      return 'Upload speed'
    }
    if (metrics.cpuUsage > targets.maxCpuUsage) {
      return 'CPU usage'
    }
    if (metrics.memoryUsage > targets.maxMemoryUsage) {
      return 'Memory usage'
    }
    if (metrics.compressionRatio < targets.minCompressionRatio) {
      return 'Compression efficiency'
    }
    return 'Network bandwidth'
  }

  // 识别优势
  private identifyStrength(metrics: PerformanceMetrics, targets: PerformanceTargets): string {
    if (metrics.successRate > targets.targetSuccessRate) {
      return 'High success rate'
    }
    if (metrics.compressionRatio > targets.minCompressionRatio * 1.5) {
      return 'Excellent compression'
    }
    if (metrics.cpuUsage < targets.maxCpuUsage * 0.7) {
      return 'Low CPU usage'
    }
    return 'Stable performance'
  }

  // 建议改进
  private suggestImprovement(metrics: PerformanceMetrics, targets: PerformanceTargets): string {
    if (metrics.totalUploadTime > targets.maxUploadTime) {
      return 'Increase compression level or reduce batch size'
    }
    if (metrics.networkRequests > targets.maxNetworkRequests) {
      return 'Implement better batching strategy'
    }
    if (metrics.errorCount > 0) {
      return 'Improve error handling and retry logic'
    }
    return 'System is performing well'
  }

  // 生成性能建议
  private generatePerformanceRecommendations(analysis: PerformanceAnalysis) {
    const recommendations: string[] = []
    
    if (analysis.overallScore < 50) {
      recommendations.push('Consider upgrading hardware or network connection')
      recommendations.push('Review and optimize upload algorithms')
    } else if (analysis.overallScore < 70) {
      recommendations.push('Optimize compression settings')
      recommendations.push('Adjust batch sizes and parallel uploads')
    }
    
    if (analysis.speedScore < 70) {
      recommendations.push('Increase network bandwidth or optimize data transfer')
    }
    
    if (analysis.efficiencyScore < 70) {
      recommendations.push('Improve compression algorithms')
      recommendations.push('Reduce overhead in batch processing')
    }
    
    console.log('Performance Recommendations:', recommendations)
  }

  // 运行性能测试
  async runPerformanceTests(): Promise<TestResult[]> {
    const testCases = this.createTestCases()
    const results: TestResult[] = []
    
    for (const testCase of testCases) {
      try {
        const result = await this.executeTestCase(testCase)
        results.push(result)
      } catch (error) {
          console.warn("操作失败:", error)
        }`, error)
      }
    }
    
    return results
  }

  // 创建测试用例
  private createTestCases(): TestCase[] {
    return [
      {
        id: 'small-dataset-test',
        name: 'Small Dataset Performance Test',
        description: 'Test performance with small dataset (9 cards, 8 folders, 13 tags)',
        category: 'performance',
        testData: {
          items: this.generateTestData(30), // 30个项目
          size: 50000, // 50KB
          compressionRatio: 0.3,
          networkConditions: {
            quality: 'good',
            bandwidth: 1000, // 1MB/s
            latency: 50,
            packetLoss: 0
          },
          systemLoad: {
            cpu: 30,
            memory: 50,
            storage: 40
          }
        },
        expectedResults: {
          maxUploadTime: 5000,
          minCompressionRatio: 0.3,
          maxNetworkRequests: 10,
          minSuccessRate: 0.95,
          maxCpuUsage: 50,
          maxMemoryUsage: 60,
          minThroughput: 100
        },
        timeout: 30000,
        retryCount: 3,
        status: 'pending'
      },
      {
        id: 'large-dataset-test',
        name: 'Large Dataset Performance Test',
        description: 'Test performance with large dataset',
        category: 'scalability',
        testData: {
          items: this.generateTestData(1000), // 1000个项目
          size: 1000000, // 1MB
          compressionRatio: 0.5,
          networkConditions: {
            quality: 'fair',
            bandwidth: 500, // 500KB/s
            latency: 100,
            packetLoss: 1
          },
          systemLoad: {
            cpu: 60,
            memory: 70,
            storage: 50
          }
        },
        expectedResults: {
          maxUploadTime: 60000,
          minCompressionRatio: 0.4,
          maxNetworkRequests: 50,
          minSuccessRate: 0.90,
          maxCpuUsage: 70,
          maxMemoryUsage: 80,
          minThroughput: 50
        },
        timeout: 120000,
        retryCount: 3,
        status: 'pending'
      },
      {
        id: 'poor-network-test',
        name: 'Poor Network Conditions Test',
        description: 'Test performance under poor network conditions',
        category: 'reliability',
        testData: {
          items: this.generateTestData(100),
          size: 200000, // 200KB
          compressionRatio: 0.4,
          networkConditions: {
            quality: 'poor',
            bandwidth: 100, // 100KB/s
            latency: 500,
            packetLoss: 5
          },
          systemLoad: {
            cpu: 40,
            memory: 60,
            storage: 45
          }
        },
        expectedResults: {
          maxUploadTime: 120000,
          minCompressionRatio: 0.4,
          maxNetworkRequests: 30,
          minSuccessRate: 0.85,
          maxCpuUsage: 60,
          maxMemoryUsage: 70,
          minThroughput: 20
        },
        timeout: 180000,
        retryCount: 5,
        status: 'pending'
      }
    ]
  }

  // 生成测试数据
  private generateTestData(count: number): any[] {
    const items = []
    
    for (let i = 0; i < count; i++) {
      items.push({
        id: `test-item-${i}`,
        type: ['create', 'update', 'delete'][Math.floor(Math.random() * 3)],
        table: ['cards', 'folders', 'tags'][Math.floor(Math.random() * 3)],
        data: {
          frontContent: `Test front content ${i}`,
          backContent: `Test back content ${i}`,
          style: {
            backgroundColor: `#${Math.floor(Math.random()*16777215).toString(16)}`,
            fontSize: 16 + Math.random() * 8
          },
          timestamp: new Date().toISOString()
        },
        localId: `test-local-${i}`,
        priority: Math.floor(Math.random() * 5) + 1,
        size: 1000 + Math.random() * 5000
      })
    }
    
    return items
  }

  // 执行测试用例
  private async executeTestCase(testCase: TestCase): Promise<TestResult> {
    testCase.status = 'running'
    testCase.startTime = new Date()
    
    console.log(`Executing test case: ${testCase.name}`)
    
    try {
      // 模拟网络条件
      await this.simulateNetworkConditions(testCase.testData.networkConditions)
      
      // 执行上传测试
      const startTime = performance.now()
      
      for (const item of testCase.testData.items) {
        await intelligentBatchUploadService.addBatchUploadItem({
          type: item.type,
          table: item.table,
          data: item.data,
          localId: item.localId
        })
      }
      
      // 等待上传完成
      await this.waitForUploadCompletion(testCase.timeout)
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // 收集实际结果
      const actualResults = this.getCurrentMetrics()
      
      // 验证结果
      const validation = this.validateTestResults(testCase.expectedResults, actualResults)
      
      // 生成分析结果
      const analysis = this.analyzeTestResults(actualResults, testCase.expectedResults)
      
      const result: TestResult = {
        success: validation.passed,
        duration,
        actualResults,
        passedChecks: validation.passed,
        failedChecks: validation.failed,
        errors: validation.errors,
        analysis
      }
      
      testCase.result = result
      testCase.status = result.success ? 'passed' : 'failed'
      testCase.endTime = new Date()
      
      // 添加到历史记录
      this.testHistory.push(testCase)
      
      console.log(`Test case ${testCase.name} ${result.success ? 'passed' : 'failed'}`)
      
      return result
      
    } catch (error) {
          console.warn("操作失败:", error)
        }
        }],
        analysis: {
          performance: {
            overallScore: 0,
            speedScore: 0,
            efficiencyScore: 0,
            reliabilityScore: 0,
            resourceScore: 0,
            bottleneck: 'Test execution failed',
            strength: 'N/A',
            improvement: 'Fix test execution issues'
          },
          reliability: {
            successRate: 0,
            errorRate: 1,
            retryRate: 0,
            recoveryRate: 0,
            stability: 0,
            consistency: 0
          },
          efficiency: {
            compressionEfficiency: 0,
            networkEfficiency: 0,
            queueEfficiency: 0,
            resourceEfficiency: 0,
            overallEfficiency: 0
          },
          recommendations: ['Fix test execution issues']
        }
      }
      
      testCase.result = result
      testCase.status = 'failed'
      testCase.endTime = new Date()
      
      this.testHistory.push(testCase)
      
      return result
    }
  }

  // 模拟网络条件
  private async simulateNetworkConditions(conditions: NetworkConditions) {
    // 这里可以实现网络条件模拟
    // 在实际环境中,这可能需要使用 Service Worker 或其他技术
    console.log(`Simulating network conditions: ${conditions.quality}`)
    
    // 简单的延迟模拟
    await new Promise(resolve => setTimeout(resolve, conditions.latency))
  }

  // 等待上传完成
  private async waitForUploadCompletion(timeout: number): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      const status = uploadQueueManager.getUploadStatus()
      
      if (status.queueSize === 0 && status.activeUploads === 0) {
        return
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    throw new Error('Upload completion timeout')
  }

  // 验证测试结果
  private validateTestResults(expected: ExpectedResults, actual: PerformanceMetrics) {
    const passed: TestCheck[] = []
    const failed: TestCheck[] = []
    const errors: TestError[] = []
    
    // 验证上传时间
    const uploadTimeCheck: TestCheck = {
      name: 'Upload Time',
      description: 'Upload time should be within expected limits',
      passed: actual.totalUploadTime <= expected.maxUploadTime,
      actualValue: actual.totalUploadTime,
      expectedValue: expected.maxUploadTime
    }
    
    if (uploadTimeCheck.passed) {
      passed.push(uploadTimeCheck)
    } else {
      failed.push(uploadTimeCheck)
    }
    
    // 验证压缩率
    const compressionCheck: TestCheck = {
      name: 'Compression Ratio',
      description: 'Compression ratio should meet minimum requirements',
      passed: actual.compressionRatio >= expected.minCompressionRatio,
      actualValue: actual.compressionRatio,
      expectedValue: expected.minCompressionRatio
    }
    
    if (compressionCheck.passed) {
      passed.push(compressionCheck)
    } else {
      failed.push(compressionCheck)
    }
    
    // 验证成功率
    const successRateCheck: TestCheck = {
      name: 'Success Rate',
      description: 'Success rate should meet minimum requirements',
      passed: actual.successRate >= expected.minSuccessRate,
      actualValue: actual.successRate,
      expectedValue: expected.minSuccessRate
    }
    
    if (successRateCheck.passed) {
      passed.push(successRateCheck)
    } else {
      failed.push(successRateCheck)
    }
    
    return { passed, failed, errors }
  }

  // 分析测试结果
  private analyzeTestResults(actual: PerformanceMetrics, expected: ExpectedResults): TestAnalysis {
    return {
      performance: this.performPerformanceAnalysis(actual),
      reliability: {
        successRate: actual.successRate,
        errorRate: actual.errorCount / Math.max(1, actual.networkRequests),
        retryRate: actual.retryCount / Math.max(1, actual.networkRequests),
        recoveryRate: 1 - (actual.errorCount / Math.max(1, actual.networkRequests)),
        stability: actual.successRate > 0.9 ? 1 : 0.5,
        consistency: actual.successRate
      },
      efficiency: {
        compressionEfficiency: actual.compressionRatio,
        networkEfficiency: actual.networkRequests / Math.max(1, actual.totalDataSize / 1000),
        queueEfficiency: actual.batchEfficiency,
        resourceEfficiency: 1 - (actual.cpuUsage + actual.memoryUsage) / 200,
        overallEfficiency: (actual.compressionRatio + actual.batchEfficiency) / 2
      },
      recommendations: this.generateTestRecommendations(actual, expected)
    }
  }

  // 生成测试建议
  private generateTestRecommendations(actual: PerformanceMetrics, expected: ExpectedResults): string[] {
    const recommendations: string[] = []
    
    if (actual.totalUploadTime > expected.maxUploadTime) {
      recommendations.push('Consider increasing network bandwidth or optimizing data compression')
    }
    
    if (actual.compressionRatio < expected.minCompressionRatio) {
      recommendations.push('Improve compression algorithms or enable more aggressive compression')
    }
    
    if (actual.successRate < expected.minSuccessRate) {
      recommendations.push('Enhance error handling and retry mechanisms')
    }
    
    if (actual.cpuUsage > expected.maxCpuUsage) {
      recommendations.push('Optimize CPU usage or upgrade hardware')
    }
    
    return recommendations
  }

  // 清理旧数据
  private cleanupOldData() {
    const now = Date.now()
    const retentionPeriod = this.config.retentionPeriod
    
    // 清理旧指标
    this.metrics = this.metrics.filter(metric => 
      now - metric.timestamp.getTime() < retentionPeriod
    )
    
    // 清理已解决的告警
    this.alerts = this.alerts.filter(alert => 
      !alert.resolved && (now - alert.timestamp.getTime() < retentionPeriod)
    )
    
    // 清理测试历史
    this.testHistory = this.testHistory.filter(test => 
      !test.endTime || (now - test.endTime.getTime() < retentionPeriod)
    )
  }

  // 持久化指标
  private persistMetrics() {
    try {
      const data = {
        metrics: this.metrics,
        alerts: this.alerts,
        testHistory: this.testHistory,
        benchmarks: this.benchmarks,
        timestamp: new Date().toISOString()
      }
      
      localStorage.setItem('cardall_performance_metrics', JSON.stringify(data))
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 恢复指标
  private restoreMetrics() {
    try {
      const stored = localStorage.getItem('cardall_performance_metrics')
      if (stored) {
        const data = JSON.parse(stored)
        
        this.metrics = data.metrics || []
        this.alerts = data.alerts || []
        this.testHistory = data.testHistory || []
        this.benchmarks = data.benchmarks || []
        
        // 转换时间戳
        this.metrics = this.metrics.map((metric: any) => ({
          ...metric,
          timestamp: new Date(metric.timestamp),
          uploadStartTime: metric.uploadStartTime ? new Date(metric.uploadStartTime) : undefined,
          uploadEndTime: metric.uploadEndTime ? new Date(metric.uploadEndTime) : undefined
        }))
        
        this.alerts = this.alerts.map((alert: any) => ({
          ...alert,
          timestamp: new Date(alert.timestamp)
        }))
        
        console.log(`Restored ${this.metrics.length} metrics, ${this.alerts.length} alerts`)
      }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 获取性能统计
  getPerformanceStats() {
    const latestMetrics = this.metrics.slice(-100) // 最近100个样本
    
    return {
      totalSamples: this.metrics.length,
      averageUploadTime: this.calculateAverage(latestMetrics.map(m => m.totalUploadTime)),
      averageCompressionRatio: this.calculateAverage(latestMetrics.map(m => m.compressionRatio)),
      averageSuccessRate: this.calculateAverage(latestMetrics.map(m => m.successRate)),
      averageCpuUsage: this.calculateAverage(latestMetrics.map(m => m.cpuUsage)),
      averageMemoryUsage: this.calculateAverage(latestMetrics.map(m => m.memoryUsage)),
      totalAlerts: this.alerts.length,
      unresolvedAlerts: this.alerts.filter(a => !a.resolved).length,
      testsRun: this.testHistory.length,
      testPassRate: this.testHistory.length > 0 
        ? this.testHistory.filter(t => t.status === 'passed').length / this.testHistory.length 
        : 0
    }
  }

  // 计算平均值
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  // 获取当前性能状态
  getCurrentPerformanceStatus() {
    const currentMetrics = this.getCurrentMetrics()
    const stats = this.getPerformanceStats()
    
    return {
      current: currentMetrics,
      stats,
      alerts: this.alerts.filter(a => !a.resolved),
      health: this.calculateSystemHealth(currentMetrics),
      recommendations: this.generateCurrentRecommendations(currentMetrics)
    }
  }

  // 计算系统健康度
  private calculateSystemHealth(metrics: PerformanceMetrics): 'excellent' | 'good' | 'fair' | 'poor' {
    const analysis = this.performPerformanceAnalysis(metrics)
    
    if (analysis.overallScore >= 90) return 'excellent'
    if (analysis.overallScore >= 75) return 'good'
    if (analysis.overallScore >= 60) return 'fair'
    return 'poor'
  }

  // 生成当前建议
  private generateCurrentRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = []
    
    if (metrics.cpuUsage > 70) {
      recommendations.push('High CPU usage detected - consider optimizing performance')
    }
    
    if (metrics.memoryUsage > 80) {
      recommendations.push('High memory usage - consider closing unnecessary applications')
    }
    
    if (metrics.successRate < 0.9) {
      recommendations.push('Low success rate - check network connection and error handling')
    }
    
    if (metrics.compressionRatio < 0.2) {
      recommendations.push('Low compression efficiency - consider enabling compression')
    }
    
    return recommendations
  }

  // 解决告警
  resolveAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      console.log(`Alert resolved: ${alert.message}`)
    }
  }

  // 获取测试历史
  getTestHistory(): TestCase[] {
    return [...this.testHistory]
  }

  // 获取性能趋势
  getPerformanceTrends(hours: number = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff)
    
    return {
      uploadTime: this.calculateTrend(recentMetrics.map(m => m.totalUploadTime)),
      compressionRatio: this.calculateTrend(recentMetrics.map(m => m.compressionRatio)),
      successRate: this.calculateTrend(recentMetrics.map(m => m.successRate)),
      cpuUsage: this.calculateTrend(recentMetrics.map(m => m.cpuUsage)),
      memoryUsage: this.calculateTrend(recentMetrics.map(m => m.memoryUsage))
    }
  }

  // 计算趋势
  private calculateTrend(values: number[]): 'improving' | 'stable' | 'declining' {
    if (values.length < 2) return 'stable'
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2))
    const secondHalf = values.slice(Math.floor(values.length / 2))
    
    const firstAvg = this.calculateAverage(firstHalf)
    const secondAvg = this.calculateAverage(secondHalf)
    
    const change = (secondAvg - firstAvg) / firstAvg
    
    if (change > 0.05) return 'improving'
    if (change < -0.05) return 'declining'
    return 'stable'
  }

  // 更新配置
  updateConfig(newConfig: Partial<MonitoringConfig>) {
    this.config = { ...this.config, ...newConfig }
    console.log('Performance monitoring config updated')
  }

  // 导出性能报告
  exportPerformanceReport(): any {
    return {
      timestamp: new Date(),
      stats: this.getPerformanceStats(),
      currentStatus: this.getCurrentPerformanceStatus(),
      trends: this.getPerformanceTrends(),
      alerts: this.alerts,
      testResults: this.testHistory
    }
  }

  // 销毁服务
  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
    
    if (this.testInterval) {
      clearInterval(this.testInterval)
    }
    
    this.persistMetrics()
    
    console.log('Performance monitoring service destroyed')
  }
}

// 导出服务实例
export const performanceMonitoringService = new PerformanceMonitoringService()

// 导出类型
export type {
  PerformanceMetrics,
  MonitoringConfig,
  AlertThresholds,
  PerformanceTargets,
  PerformanceAlert,
  TestCase,
  TestData,
  NetworkConditions,
  SystemLoad,
  ExpectedResults,
  TestResult,
  TestCheck,
  TestError,
  TestAnalysis,
  PerformanceAnalysis,
  ReliabilityAnalysis,
  EfficiencyAnalysis,
  BenchmarkResult
}