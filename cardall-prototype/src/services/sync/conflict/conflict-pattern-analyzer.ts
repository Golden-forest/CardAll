// 冲突模式分析器
// Phase 2: 智能解决策略优化 - Debug-Specialist支持任务

import { type ConflictInfo, type SyncOperation } from '../types/sync-types'
import { type OptimizedConflictResolution } from './optimized-conflict-resolver'
import { type PerformanceMetrics } from './strategy-performance-monitor'

export interface ConflictPattern {
  patternId: string
  name: string
  description: string
  category: PatternCategory
  severity: PatternSeverity
  frequency: number
  successRate: number
  averageResolutionTime: number
  confidenceDistribution: {
    high: number
    medium: number
    low: number
  }
  commonTriggers: PatternTrigger[]
  recommendedStrategies: string[]
  preventionMeasures: string[]
  lastDetected: Date
  firstDetected: Date
  trend: 'increasing' | 'stable' | 'decreasing'
  impact: {
    userExperience: number
    systemPerformance: number
    dataIntegrity: number
  }
}

export interface PatternTrigger {
  type: 'network' | 'timing' | 'user_behavior' | 'system_load' | 'data_complexity'
  condition: string
  threshold: number
  frequency: number
}

export interface PatternCluster {
  clusterId: string
  patterns: ConflictPattern[]
  commonCharacteristics: string[]
  clusterSeverity: PatternSeverity
  recommendedAction: 'monitor' | 'optimize' | 'urgent_fix'
  impactScore: number
}

export interface PatternPrediction {
  patternId: string
  probability: number
  confidence: number
  timeWindow: {
    start: Date
    end: Date
  }
  contributingFactors: {
    factor: string
    weight: number
    value: number
  }[]
  recommendedPrevention: string
}

export interface PatternInsight {
  insightId: string
  type: 'trend' | 'anomaly' | 'correlation' | 'recommendation'
  title: string
  description: string
  significance: number
  data: any
  actionable: boolean
  recommendations: string[]
  generatedAt: Date
}

export type PatternCategory =
  | 'network_related'
  | 'timing_related'
  | 'user_behavior_related'
  | 'data_structure_related'
  | 'system_load_related'
  | 'concurrent_access'
  | 'data_consistency'

export type PatternSeverity = 'low' | 'medium' | 'high' | 'critical'

export class ConflictPatternAnalyzer {
  private patterns: Map<string, ConflictPattern> = new Map()
  private clusters: Map<string, PatternCluster> = new Map()
  private insights: PatternInsight[] = []
  private history: ConflictInfo[] = []
  private metrics: PerformanceMetrics[] = []

  constructor() {
    this.initializeKnownPatterns()
    this.startPeriodicAnalysis()
  }

  /**
   * 分析冲突模式
   */
  async analyzeConflict(conflict: ConflictInfo, resolution: OptimizedConflictResolution, metrics: PerformanceMetrics): Promise<void> {
    // 记录历史
    this.history.push({
      ...conflict,
      timestamp: new Date()
    })

    this.metrics.push(metrics)

    // 识别模式
    const identifiedPatterns = await this.identifyPatterns(conflict, resolution, metrics)

    // 更新模式统计
    for (const pattern of identifiedPatterns) {
      await this.updatePattern(pattern, conflict, resolution, metrics)
    }

    // 检查新模式
    await this.detectNewPatterns(conflict, resolution, metrics)

    // 更新模式聚类
    await this.updatePatternClustering()

    // 生成洞察
    await this.generateInsights()

    // 保持历史记录在合理范围内
    if (this.history.length > 1000) {
      this.history = this.history.slice(-1000)
    }
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  /**
   * 获取所有冲突模式
   */
  getPatterns(): ConflictPattern[] {
    return Array.from(this.patterns.values()).sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * 获取模式聚类
   */
  getPatternClusters(): PatternCluster[] {
    return Array.from(this.clusters.values()).sort((a, b) => b.impactScore - a.impactScore)
  }

  /**
   * 获取模式洞察
   */
  getInsights(): PatternInsight[] {
    return this.insights.sort((a, b) => b.significance - a.significance)
  }

  /**
   * 预测冲突模式
   */
  async predictPatterns(context: {
    networkQuality: any
    timeOfDay: number
    dayOfWeek: number
    systemLoad: number
    recentActivity: number
  }): Promise<PatternPrediction[]> {
    const predictions: PatternPrediction[] = []

    for (const pattern of this.patterns.values()) {
      const prediction = await this.predictSinglePattern(pattern, context)
      if (prediction.probability > 0.3) { // 只返回有意义的预测
        predictions.push(prediction)
      }
    }

    return predictions.sort((a, b) => b.probability - a.probability)
  }

  /**
   * 获取模式统计
   */
  getPatternStatistics(): {
    totalPatterns: number
    activePatterns: number
    patternDistribution: Record<PatternCategory, number>
    severityDistribution: Record<PatternSeverity, number>
    trendAnalysis: {
      increasing: number
      stable: number
      decreasing: number
    }
    impactSummary: {
      highImpact: number
      mediumImpact: number
      lowImpact: number
    }
  } {
    const patterns = this.getPatterns()

    const patternDistribution: Record<PatternCategory, number> = {
      network_related: 0,
      timing_related: 0,
      user_behavior_related: 0,
      data_structure_related: 0,
      system_load_related: 0,
      concurrent_access: 0,
      data_consistency: 0
    }

    const severityDistribution: Record<PatternSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }

    const trendAnalysis = {
      increasing: 0,
      stable: 0,
      decreasing: 0
    }

    let highImpact = 0
    let mediumImpact = 0
    let lowImpact = 0

    patterns.forEach(pattern => {
      patternDistribution[pattern.category]++
      severityDistribution[pattern.severity]++
      trendAnalysis[pattern.trend]++

      const impactScore = (pattern.impact.userExperience + pattern.impact.systemPerformance + pattern.impact.dataIntegrity) / 3
      if (impactScore > 0.7) highImpact++
      else if (impactScore > 0.4) mediumImpact++
      else lowImpact++
    })

    return {
      totalPatterns: patterns.length,
      activePatterns: patterns.filter(p => p.frequency > 0).length,
      patternDistribution,
      severityDistribution,
      trendAnalysis,
      impactSummary: {
        highImpact,
        mediumImpact,
        lowImpact
      }
    }
  }

  /**
   * 获取模式建议
   */
  getPatternRecommendations(): {
    immediate: string[]
    shortTerm: string[]
    longTerm: string[]
    monitoring: string[]
  } {
    const patterns = this.getPatterns()
    const clusters = this.getPatternClusters()

    const immediate: string[] = []
    const shortTerm: string[] = []
    const longTerm: string[] = []
    const monitoring: string[] = []

    // 分析关键模式
    patterns.forEach(pattern => {
      if (pattern.severity === 'critical' && pattern.frequency > 10) {
        immediate.push(`紧急处理关键模式: ${pattern.name} (频率: ${pattern.frequency})`)
      }

      if (pattern.trend === 'increasing' && pattern.frequency > 5) {
        shortTerm.push(`关注增长趋势模式: ${pattern.name} (增长中)`)
      }

      if (pattern.successRate < 0.5 && pattern.frequency > 3) {
        shortTerm.push(`优化低效模式: ${pattern.name} (成功率: ${(pattern.successRate * 100).toFixed(1)}%)`)
      }
    })

    // 分析聚类
    clusters.forEach(cluster => {
      if (cluster.recommendedAction === 'urgent_fix') {
        immediate.push(`紧急修复模式集群: ${cluster.clusterId}`)
      } else if (cluster.recommendedAction === 'optimize') {
        shortTerm.push(`优化模式集群: ${cluster.clusterId}`)
      } else {
        monitoring.push(`监控模式集群: ${cluster.clusterId}`)
      }
    })

    // 系统级建议
    if (patterns.filter(p => p.category === 'network_related').length > 3) {
      longTerm.push('实施网络优化策略，减少网络相关冲突')
    }

    if (patterns.filter(p => p.category === 'concurrent_access').length > 2) {
      longTerm.push('改进并发访问控制机制')
    }

    return {
      immediate,
      shortTerm,
      longTerm,
      monitoring
    }
  }

  // 私有方法实现

  private initializeKnownPatterns(): void {
    // 初始化已知的冲突模式
    const knownPatterns: Omit<ConflictPattern, 'patternId' | 'frequency' | 'successRate' | 'averageResolutionTime' | 'lastDetected' | 'firstDetected' | 'trend'>[] = [
      {
        name: '并发修改冲突',
        description: '用户在不同设备上同时修改同一内容',
        category: 'concurrent_access',
        severity: 'high',
        confidenceDistribution: { high: 0.3, medium: 0.4, low: 0.3 },
        commonTriggers: [
          { type: 'timing', condition: 'time_diff < 1000', threshold: 1000, frequency: 0.8 },
          { type: 'user_behavior', condition: 'multiple_devices', threshold: 2, frequency: 0.9 }
        ],
        recommendedStrategies: ['enhanced-timestamp', 'smart-content-diff'],
        preventionMeasures: ['实时同步', '操作锁定', '冲突预防检测'],
        impact: {
         用户体验: 0.8,
         系统性能: 0.6,
         数据完整性: 0.9
        }
      },
      {
        name: '网络中断冲突',
        description: '网络连接中断导致的同步冲突',
        category: 'network_related',
        severity: 'medium',
        confidenceDistribution: { high: 0.2, medium: 0.5, low: 0.3 },
        commonTriggers: [
          { type: 'network', condition: 'reliability < 0.5', threshold: 0.5, frequency: 0.9 },
          { type: 'timing', condition: 'latency > 5000', threshold: 5000, frequency: 0.7 }
        ],
        recommendedStrategies: ['enhanced-network', 'enhanced-timestamp'],
        preventionMeasures: ['网络状态监控', '离线模式优化', '自动重试机制'],
        impact: {
         用户体验: 0.7,
         系统性能: 0.8,
         数据完整性: 0.6
        }
      },
      {
        name: '数据结构冲突',
        description: '文件夹结构或标签结构变化导致的冲突',
        category: 'data_structure_related',
        severity: 'high',
        confidenceDistribution: { high: 0.4, medium: 0.4, low: 0.2 },
        commonTriggers: [
          { type: 'data_complexity', condition: 'hierarchy_depth > 3', threshold: 3, frequency: 0.6 },
          { type: 'user_behavior', condition: 'bulk_operations', threshold: 10, frequency: 0.7 }
        ],
        recommendedStrategies: ['enhanced-hierarchy', 'context-aware'],
        preventionMeasures: ['结构验证', '批量操作优化', '冲突检测前置'],
        impact: {
         用户体验: 0.9,
         系统性能: 0.5,
         数据完整性: 0.8
        }
      },
      {
        name: '时序冲突',
        description: '操作时间顺序异常导致的冲突',
        category: 'timing_related',
        severity: 'medium',
        confidenceDistribution: { high: 0.5, medium: 0.3, low: 0.2 },
        commonTriggers: [
          { type: 'timing', condition: 'clock_skew > 5000', threshold: 5000, frequency: 0.8 },
          { type: 'system_load', condition: 'high_load', threshold: 0.8, frequency: 0.5 }
        ],
        recommendedStrategies: ['enhanced-timestamp', 'context-aware'],
        preventionMeasures: ['时间同步', '负载均衡', '队列优化'],
        impact: {
         用户体验: 0.6,
         系统性能: 0.7,
         数据完整性: 0.7
        }
      }
    ]

    knownPatterns.forEach(pattern => {
      this.patterns.set(this.generatePatternId(pattern), {
        ...pattern,
        patternId: this.generatePatternId(pattern),
        frequency: 0,
        successRate: 0,
        averageResolutionTime: 0,
        lastDetected: new Date(),
        firstDetected: new Date(),
        trend: 'stable'
      })
    })
  }

  private async identifyPatterns(
    conflict: ConflictInfo,
    resolution: OptimizedConflictResolution,
    metrics: PerformanceMetrics
  ): Promise<ConflictPattern[]> {
    const identifiedPatterns: ConflictPattern[] = []

    // 基于冲突特征识别模式
    for (const pattern of this.patterns.values()) {
      if (this.matchesPattern(conflict, resolution, metrics, pattern)) {
        identifiedPatterns.push(pattern)
      }
    }

    return identifiedPatterns
  }

  private matchesPattern(
    conflict: ConflictInfo,
    resolution: OptimizedConflictResolution,
    metrics: PerformanceMetrics,
    pattern: ConflictPattern
  ): boolean {
    // 检查触发条件
    const triggers = pattern.commonTriggers

    for (const trigger of triggers) {
      switch (trigger.type) {
        case 'network':
          if (trigger.condition.includes('reliability')) {
            if (metrics.networkQuality.reliability < trigger.threshold) {
              return true
            }
          }
          if (trigger.condition.includes('latency')) {
            if (metrics.networkQuality.latency > trigger.threshold) {
              return true
            }
          }
          break

        case 'timing':
          if (trigger.condition.includes('time_diff')) {
            const localTime = new Date(conflict.localData.updatedAt).getTime()
            const cloudTime = new Date(conflict.cloudData.updatedAt).getTime()
            const timeDiff = Math.abs(localTime - cloudTime)
            if (timeDiff < trigger.threshold) {
              return true
            }
          }
          break

        case 'user_behavior':
          if (trigger.condition.includes('fallback_chain')) {
            if (metrics.fallbackChain.length > trigger.threshold) {
              return true
            }
          }
          break

        case 'data_complexity':
          if (trigger.condition.includes('hierarchy_depth')) {
            // 简化的复杂度检查
            if (conflict.entityType === 'folder' && conflict.localData.parentId) {
              return true
            }
          }
          break

        case 'system_load':
          // 系统负载检查（简化）
          if (metrics.resolutionTime > trigger.threshold * 1000) {
            return true
          }
          break
      }
    }

    return false
  }

  private async updatePattern(
    pattern: ConflictPattern,
    conflict: ConflictInfo,
    resolution: OptimizedConflictResolution,
    metrics: PerformanceMetrics
  ): Promise<void> {
    // 更新模式统计
    pattern.frequency++
    pattern.lastDetected = new Date()

    // 更新成功率
    const previousTotal = pattern.frequency - 1
    const success = resolution.confidence >= 0.5
    pattern.successRate = (pattern.successRate * previousTotal + (success ? 1 : 0)) / pattern.frequency

    // 更新平均解决时间
    pattern.averageResolutionTime = (
      pattern.averageResolutionTime * previousTotal + metrics.resolutionTime
    ) / pattern.frequency

    // 更新置信度分布
    if (resolution.confidence >= 0.7) {
      pattern.confidenceDistribution.high++
    } else if (resolution.confidence >= 0.5) {
      pattern.confidenceDistribution.medium++
    } else {
      pattern.confidenceDistribution.low++
    }

    // 更新趋势
    pattern.trend = this.calculatePatternTrend(pattern)

    // 更新模式影响
    this.updatePatternImpact(pattern, conflict, resolution)
  }

  private calculatePatternTrend(pattern: ConflictPattern): 'increasing' | 'stable' | 'decreasing' {
    // 简化的趋势计算
    const recentConflicts = this.history.filter(h => {
      const conflictTime = new Date(h.timestamp).getTime()
      const lastWeek = Date.now() - 7 * 24 * 60 * 60 * 1000
      return conflictTime > lastWeek
    }).length

    const totalConflicts = pattern.frequency

    if (recentConflicts > totalConflicts * 0.5) {
      return 'increasing'
    } else if (recentConflicts < totalConflicts * 0.2) {
      return 'decreasing'
    } else {
      return 'stable'
    }
  }

  private updatePatternImpact(pattern: ConflictPattern, conflict: ConflictInfo, resolution: OptimizedConflictResolution): void {
    // 基于解决时间和用户确认需求更新影响
    const timeImpact = Math.min(1, resolution.estimatedTime / 30)
    const confirmationImpact = resolution.requiresUserConfirmation ? 0.8 : 0.2
    const complexityImpact = resolution.fallbackChain.length > 2 ? 0.7 : 0.3

    pattern.impact.userExperience = (timeImpact + confirmationImpact) / 2
    pattern.impact.systemPerformance = complexityImpact
    pattern.impact.dataIntegrity = resolution.confidence < 0.5 ? 0.8 : 0.3
  }

  private async detectNewPatterns(
    conflict: ConflictInfo,
    resolution: OptimizedConflictResolution,
    metrics: PerformanceMetrics
  ): Promise<void> {
    // 检查是否为新的模式
    const isNewPattern = !Array.from(this.patterns.values()).some(p =>
      this.matchesPattern(conflict, resolution, metrics, p)
    )

    if (isNewPattern && this.history.length > 10) {
      const similarConflicts = this.findSimilarConflicts(conflict)

      if (similarConflicts.length >= 3) {
        const newPattern = this.createNewPattern(conflict, resolution, metrics, similarConflicts)
        this.patterns.set(newPattern.patternId, newPattern)

        console.log(`🔍 检测到新的冲突模式: ${newPattern.name}`)
      }
    }
  }

  private findSimilarConflicts(conflict: ConflictInfo): ConflictInfo[] {
    // 查找相似冲突
    return this.history.filter(h =>
      h.entityType === conflict.entityType &&
      h.conflictType === conflict.conflictType &&
      Math.abs(new Date(h.timestamp).getTime() - Date.now()) < 24 * 60 * 60 * 1000 // 24小时内
    )
  }

  private createNewPattern(
    conflict: ConflictInfo,
    resolution: OptimizedConflictResolution,
    metrics: PerformanceMetrics,
    similarConflicts: ConflictInfo[]
  ): ConflictPattern {
    const now = new Date()
    const patternId = `pattern-${now.getTime()}-${Math.random().toString(36).substr(2, 6)}`

    return {
      patternId,
      name: `${conflict.entityType}_${conflict.conflictType}_模式`,
      description: `自动检测到的${conflict.entityType}${conflict.conflictType}冲突模式`,
      category: this.categorizePattern(conflict, resolution, metrics),
      severity: this.assessPatternSeverity(conflict, resolution, metrics),
      frequency: similarConflicts.length,
      successRate: similarConflicts.filter(c => resolution.confidence >= 0.5).length / similarConflicts.length,
      averageResolutionTime: metrics.resolutionTime,
      confidenceDistribution: {
        high: resolution.confidence >= 0.7 ? 1 : 0,
        medium: resolution.confidence >= 0.5 && resolution.confidence < 0.7 ? 1 : 0,
        low: resolution.confidence < 0.5 ? 1 : 0
      },
      commonTriggers: this.identifyTriggers(conflict, resolution, metrics),
      recommendedStrategies: [resolution.strategy],
      preventionMeasures: this.suggestPreventionMeasures(conflict, resolution),
      lastDetected: now,
      firstDetected: now,
      trend: 'stable',
      impact: {
       用户体验: this.calculateUserExperienceImpact(resolution),
       系统性能: this.calculateSystemPerformanceImpact(metrics),
       数据完整性: this.calculateDataIntegrityImpact(resolution)
      }
    }
  }

  private categorizePattern(
    conflict: ConflictInfo,
    resolution: OptimizedConflictResolution,
    metrics: PerformanceMetrics
  ): PatternCategory {
    if (metrics.networkQuality.reliability < 0.5) {
      return 'network_related'
    }

    if (resolution.fallbackChain.includes('enhanced-timestamp')) {
      return 'timing_related'
    }

    if (conflict.entityType === 'folder') {
      return 'data_structure_related'
    }

    if (resolution.fallbackChain.length > 3) {
      return 'concurrent_access'
    }

    return 'data_consistency'
  }

  private assessPatternSeverity(
    conflict: ConflictInfo,
    resolution: OptimizedConflictResolution,
    metrics: PerformanceMetrics
  ): PatternSeverity {
    const impact = (
      this.calculateUserExperienceImpact(resolution) +
      this.calculateSystemPerformanceImpact(metrics) +
      this.calculateDataIntegrityImpact(resolution)
    ) / 3

    if (impact > 0.8) return 'critical'
    if (impact > 0.6) return 'high'
    if (impact > 0.4) return 'medium'
    return 'low'
  }

  private identifyTriggers(
    conflict: ConflictInfo,
    resolution: OptimizedConflictResolution,
    metrics: PerformanceMetrics
  ): PatternTrigger[] {
    const triggers: PatternTrigger[] = []

    // 网络触发器
    if (metrics.networkQuality.reliability < 0.5) {
      triggers.push({
        type: 'network',
        condition: 'reliability < 0.5',
        threshold: 0.5,
        frequency: 0.8
      })
    }

    // 时间触发器
    const localTime = new Date(conflict.localData.updatedAt).getTime()
    const cloudTime = new Date(conflict.cloudData.updatedAt).getTime()
    const timeDiff = Math.abs(localTime - cloudTime)

    if (timeDiff < 1000) {
      triggers.push({
        type: 'timing',
        condition: 'time_diff < 1000',
        threshold: 1000,
        frequency: 0.9
      })
    }

    // 用户行为触发器
    if (resolution.fallbackChain.length > 2) {
      triggers.push({
        type: 'user_behavior',
        condition: 'long_fallback_chain',
        threshold: 2,
        frequency: 0.7
      })
    }

    return triggers
  }

  private suggestPreventionMeasures(
    conflict: ConflictInfo,
    resolution: OptimizedConflictResolution
  ): string[] {
    const measures: string[] = []

    if (resolution.fallbackChain.includes('enhanced-network')) {
      measures.push('网络状态监控', '离线模式优化')
    }

    if (resolution.fallbackChain.includes('enhanced-timestamp')) {
      measures.push('时间同步机制', '操作队列优化')
    }

    if (conflict.entityType === 'folder') {
      measures.push('文件夹结构验证', '批量操作优化')
    }

    if (resolution.requiresUserConfirmation) {
      measures.push('冲突预防检测', '用户操作引导')
    }

    return measures
  }

  private calculateUserExperienceImpact(resolution: OptimizedConflictResolution): number {
    const timeImpact = Math.min(1, resolution.estimatedTime / 30)
    const confirmationImpact = resolution.requiresUserConfirmation ? 0.8 : 0.2
    return (timeImpact + confirmationImpact) / 2
  }

  private calculateSystemPerformanceImpact(metrics: PerformanceMetrics): number {
    return Math.min(1, metrics.resolutionTime / 10000)
  }

  private calculateDataIntegrityImpact(resolution: OptimizedConflictResolution): number {
    return resolution.confidence < 0.5 ? 0.8 : 0.3
  }

  private async updatePatternClustering(): Promise<void> {
    // 基于模式特征进行聚类分析
    const patterns = Array.from(this.patterns.values())
    const clusters: Map<string, ConflictPattern[]> = new Map()

    patterns.forEach(pattern => {
      const clusterKey = this.generateClusterKey(pattern)
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, [])
      }
      clusters.get(clusterKey)!.push(pattern)
    })

    // 更新聚类
    this.clusters.clear()
    clusters.forEach((clusterPatterns, clusterKey) => {
      if (clusterPatterns.length > 1) {
        this.clusters.set(clusterKey, {
          clusterId: clusterKey,
          patterns: clusterPatterns,
          commonCharacteristics: this.extractCommonCharacteristics(clusterPatterns),
          clusterSeverity: this.assessClusterSeverity(clusterPatterns),
          recommendedAction: this.recommendClusterAction(clusterPatterns),
          impactScore: this.calculateClusterImpact(clusterPatterns)
        })
      }
    })
  }

  private generateClusterKey(pattern: ConflictPattern): string {
    return `${pattern.category}_${pattern.severity}_${pattern.trend}`
  }

  private extractCommonCharacteristics(patterns: ConflictPattern[]): string[] {
    const characteristics: string[] = []

    // 提取共同类别
    const categories = new Set(patterns.map(p => p.category))
    if (categories.size === 1) {
      characteristics.add(`类别: ${Array.from(categories)[0]}`)
    }

    // 提取共同严重程度
    const severities = new Set(patterns.map(p => p.severity))
    if (severities.size === 1) {
      characteristics.add(`严重程度: ${Array.from(severities)[0]}`)
    }

    // 提取共同趋势
    const trends = new Set(patterns.map(p => p.trend))
    if (trends.size === 1) {
      characteristics.add(`趋势: ${Array.from(trends)[0]}`)
    }

    return Array.from(characteristics)
  }

  private assessClusterSeverity(patterns: ConflictPattern[]): PatternSeverity {
    const severityCounts = patterns.reduce((acc, p) => {
      acc[p.severity] = (acc[p.severity] || 0) + 1
      return acc
    }, {} as Record<PatternSeverity, number>)

    if (severityCounts.critical > 0) return 'critical'
    if (severityCounts.high > patterns.length * 0.5) return 'high'
    if (severityCounts.medium > patterns.length * 0.5) return 'medium'
    return 'low'
  }

  private recommendClusterAction(patterns: ConflictPattern[]): 'monitor' | 'optimize' | 'urgent_fix' {
    const hasCritical = patterns.some(p => p.severity === 'critical')
    const hasIncreasing = patterns.some(p => p.trend === 'increasing')
    const avgSuccessRate = patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length

    if (hasCritical && hasIncreasing) return 'urgent_fix'
    if (avgSuccessRate < 0.5) return 'optimize'
    return 'monitor'
  }

  private calculateClusterImpact(patterns: ConflictPattern[]): number {
    const totalImpact = patterns.reduce((sum, p) => {
      const patternImpact = (p.impact.userExperience + p.impact.systemPerformance + p.impact.dataIntegrity) / 3
      return sum + patternImpact * p.frequency
    }, 0)

    const totalFrequency = patterns.reduce((sum, p) => sum + p.frequency, 0)
    return totalFrequency > 0 ? totalImpact / totalFrequency : 0
  }

  private async generateInsights(): Promise<void> {
    const newInsights: PatternInsight[] = []

    // 生成趋势洞察
    const trendInsight = this.generateTrendInsight()
    if (trendInsight) newInsights.push(trendInsight)

    // 生成异常洞察
    const anomalyInsight = this.generateAnomalyInsight()
    if (anomalyInsight) newInsights.push(anomalyInsight)

    // 生成相关性洞察
    const correlationInsight = this.generateCorrelationInsight()
    if (correlationInsight) newInsights.push(correlationInsight)

    // 生成建议洞察
    const recommendationInsight = this.generateRecommendationInsight()
    if (recommendationInsight) newInsights.push(recommendationInsight)

    // 更新洞察列表
    this.insights = [...this.insights.filter(i => Date.now() - i.generatedAt.getTime() < 24 * 60 * 60 * 1000), ...newInsights]
    this.insights.sort((a, b) => b.significance - a.significance)
  }

  private generateTrendInsight(): PatternInsight | null {
    const patterns = this.getPatterns()
    const increasingPatterns = patterns.filter(p => p.trend === 'increasing' && p.frequency > 3)

    if (increasingPatterns.length > 2) {
      return {
        insightId: `trend-${Date.now()}`,
        type: 'trend',
        title: '多个冲突模式呈增长趋势',
        description: `检测到 ${increasingPatterns.length} 个冲突模式频率正在增加，需要关注`,
        significance: increasingPatterns.length * 0.3,
        data: {
          patterns: increasingPatterns.map(p => ({ name: p.name, frequency: p.frequency }))
        },
        actionable: true,
        recommendations: [
          '分析增长原因',
          '实施预防措施',
          '加强监控'
        ],
        generatedAt: new Date()
      }
    }

    return null
  }

  private generateAnomalyInsight(): PatternInsight | null {
    const patterns = this.getPatterns()
    const lowSuccessPatterns = patterns.filter(p => p.successRate < 0.3 && p.frequency > 5)

    if (lowSuccessPatterns.length > 0) {
      return {
        insightId: `anomaly-${Date.now()}`,
        type: 'anomaly',
        title: '检测到低成功率模式',
        description: `发现 ${lowSuccessPatterns.length} 个成功率低于30%的冲突模式`,
        significance: 0.8,
        data: {
          patterns: lowSuccessPatterns.map(p => ({ name: p.name, successRate: p.successRate }))
        },
        actionable: true,
        recommendations: [
          '优化解决策略',
          '改进检测机制',
          '考虑替代方案'
        ],
        generatedAt: new Date()
      }
    }

    return null
  }

  private generateCorrelationInsight(): PatternInsight | null {
    // 检查网络质量与解决成功率的相关性
    const networkPoorConflicts = this.metrics.filter(m => m.networkQuality.reliability < 0.5)
    const networkGoodConflicts = this.metrics.filter(m => m.networkQuality.reliability >= 0.5)

    if (networkPoorConflicts.length > 5 && networkGoodConflicts.length > 5) {
      const poorSuccessRate = networkPoorConflicts.filter(m => m.success).length / networkPoorConflicts.length
      const goodSuccessRate = networkGoodConflicts.filter(m => m.success).length / networkGoodConflicts.length

      if (Math.abs(poorSuccessRate - goodSuccessRate) > 0.3) {
        return {
          insightId: `correlation-${Date.now()}`,
          type: 'correlation',
          title: '网络质量与解决成功率强相关',
          description: `网络质量差时成功率为${(poorSuccessRate * 100).toFixed(1)}%，良好时为${(goodSuccessRate * 100).toFixed(1)}%`,
          significance: 0.7,
          data: {
            poorSuccessRate,
            goodSuccessRate,
            difference: Math.abs(poorSuccessRate - goodSuccessRate)
          },
          actionable: true,
          recommendations: [
            '优化网络感知策略',
            '改善网络质量',
            '增强离线处理能力'
          ],
          generatedAt: new Date()
        }
      }
    }

    return null
  }

  private generateRecommendationInsight(): PatternInsight | null {
    const patterns = this.getPatterns()
    const preventablePatterns = patterns.filter(p => p.preventionMeasures.length > 2 && p.frequency > 5)

    if (preventablePatterns.length > 2) {
      return {
        insightId: `recommendation-${Date.now()}`,
        type: 'recommendation',
        title: '建议实施预防措施',
        description: `发现 ${preventablePatterns.length} 个高频率可预防冲突模式`,
        significance: 0.6,
        data: {
          patterns: preventablePatterns.map(p => ({ name: p.name, frequency: p.frequency, measures: p.preventionMeasures }))
        },
        actionable: true,
        recommendations: [
          '优先实施预防措施',
          '建立预防机制',
          '定期评估效果'
        ],
        generatedAt: new Date()
      }
    }

    return null
  }

  private async predictSinglePattern(pattern: ConflictPattern, context: any): Promise<PatternPrediction> {
    // 基于上下文预测模式发生概率
    let probability = 0.1 // 基础概率
    const contributingFactors: { factor: string; weight: number; value: number }[] = []

    // 网络质量影响
    if (pattern.category === 'network_related') {
      const networkImpact = 1 - context.networkQuality.reliability
      probability += networkImpact * 0.4
      contributingFactors.push({
        factor: '网络质量',
        weight: 0.4,
        value: networkImpact
      })
    }

    // 时间影响
    if (pattern.category === 'timing_related') {
      const timeImpact = context.systemLoad > 0.7 ? 0.3 : 0.1
      probability += timeImpact
      contributingFactors.push({
        factor: '系统负载',
        weight: 0.3,
        value: timeImpact
      })
    }

    // 活动频率影响
    const activityImpact = Math.min(1, context.recentActivity / 10)
    probability += activityImpact * 0.2
    contributingFactors.push({
      factor: '活动频率',
      weight: 0.2,
      value: activityImpact
    })

    // 历史频率调整
    const frequencyFactor = Math.min(1, pattern.frequency / 20)
    probability += frequencyFactor * 0.3
    contributingFactors.push({
      factor: '历史频率',
      weight: 0.3,
      value: frequencyFactor
    })

    return {
      patternId: pattern.patternId,
      probability: Math.min(1, probability),
      confidence: Math.min(0.9, 0.3 + pattern.successRate * 0.6),
      timeWindow: {
        start: new Date(),
        end: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时窗口
      },
      contributingFactors,
      recommendedPrevention: pattern.preventionMeasures[0] || '监控该模式'
    }
  }

  private generatePatternId(pattern: Omit<ConflictPattern, 'patternId'>): string {
    return pattern.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  private startPeriodicAnalysis(): void {
    // 每小时执行一次周期性分析
    setInterval(() => {
      this.performPeriodicAnalysis()
    }, 60 * 60 * 1000)
  }

  private performPeriodicAnalysis(): void {
    // 清理过期数据
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    this.history = this.history.filter(h => new Date(h.timestamp).getTime() > oneMonthAgo)
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > oneMonthAgo)

    // 更新模式聚类
    this.updatePatternClustering()

    // 生成新的洞察
    this.generateInsights()

    console.log('🔍 Periodic pattern analysis completed')
  }
}

// 导出单例实例
export const conflictPatternAnalyzer = new ConflictPatternAnalyzer()