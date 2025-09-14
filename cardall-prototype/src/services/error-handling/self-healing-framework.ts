/**
 * 自愈框架
 *
 * 实现智能自愈能力，包括：
 * - 错误模式识别和学习
 * - 自动根因分析
 * - 智能修复策略生成
 * - 自愈执行和验证
 * - 知识库管理
 * - 效果评估和优化
 */

import {
  UnifiedError,
  ErrorCategory,
  ErrorSeverity,
  ErrorContext,
  RecoveryResult,
  HealingRule,
  ErrorPattern,
  TimePattern,
  FrequencyPattern,
  HealingCondition,
  HealingAction
} from './types'
import { RecoveryStrategyManager } from './recovery-strategy-manager'
import { ErrorMonitoringService } from './error-monitoring-service'

// 自愈框架实现

// 自愈会话
export interface HealingSession {
  id: string
  triggerError: UnifiedError
  rule: HealingRule
  startTime: number
  endTime?: number
  status: 'active' | 'completed' | 'failed' | 'cancelled'
  actions: HealingExecution[]
  result?: HealingResult
  confidence: number
}

// 自愈执行
export interface HealingExecution {
  action: HealingAction
  startTime: number
  endTime?: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: any
  rollbackAttempted?: boolean
  rollbackResult?: any
}

// 自愈结果
export interface HealingResult {
  success: boolean
  actions: number
  successfulActions: number
  duration: number
  confidence: number
  effectiveness: number
  message: string
  details?: any
  recommendation?: string
}

// 自愈指标
export interface HealingMetrics {
  totalSessions: number
  successfulSessions: number
  failedSessions: number
  averageHealingTime: number
  successRate: number
  averageConfidence: number
  ruleEffectiveness: Map<string, number>
  patternDetectionRate: number
  autoResolutionRate: number
  falsePositiveRate: number
}

// 知识库条目
export interface KnowledgeEntry {
  id: string
  pattern: ErrorPattern
  solution: HealingSolution
  confidence: number
  usageCount: number
  successCount: number
  lastUsed: number
  created: number
  tags: string[]
}

// 自愈解决方案
export interface HealingSolution {
  description: string
  steps: HealingAction[]
  prerequisites: string[]
  sideEffects: string[]
  estimatedDuration: number
  successProbability: number
}

// 自愈模式
export interface HealingPattern {
  id: string
  name: string
  description: string
  errorPatterns: ErrorPattern[]
  solution: HealingSolution
  frequency: number
  confidence: number
  lastObserved: number
}

/**
 * 模式识别器
 */
export class PatternRecognizer {
  private patterns: Map<string, HealingPattern> = new Map()
  private recentErrors: UnifiedError[] = []
  private maxRecentErrors = 1000

  /**
   * 识别错误模式
   */
  public async recognizePattern(error: UnifiedError): Promise<HealingPattern | null> {
    // 添加到最近错误列表
    this.addToRecentErrors(error)

    // 分析单个错误模式
    const singlePattern = this.analyzeSingleError(error)

    // 分析时间序列模式
    const timeSeriesPattern = await this.analyzeTimeSeriesPattern(error)

    // 分析上下文模式
    const contextPattern = this.analyzeContextPattern(error)

    // 组合模式分析
    const combinedPattern = this.combinePatterns(
      singlePattern,
      timeSeriesPattern,
      contextPattern
    )

    // 查找匹配的已知模式
    const matchedPattern = this.findMatchingPattern(combinedPattern)

    if (matchedPattern) {
      matchedPattern.lastObserved = Date.now()
      return matchedPattern
    }

    // 创建新模式（如果符合条件）
    if (this.shouldCreateNewPattern(combinedPattern)) {
      return this.createNewPattern(combinedPattern)
    }

    return null
  }

  /**
   * 学习新模式
   */
  public async learnPattern(pattern: ErrorPattern, solution: HealingSolution): Promise<void> {
    const newPattern: HealingPattern = {
      id: this.generatePatternId(),
      name: `Learned Pattern ${Date.now()}`,
      description: `Automatically learned pattern for ${pattern.category} errors`,
      errorPatterns: [pattern],
      solution,
      frequency: 1,
      confidence: 0.5,
      lastObserved: Date.now()
    }

    this.patterns.set(newPattern.id, newPattern)
    console.log(`学习到新模式: ${newPattern.name}`)
  }

  /**
   * 获取所有模式
   */
  public getPatterns(): HealingPattern[] {
    return Array.from(this.patterns.values())
  }

  private addToRecentErrors(error: UnifiedError): void {
    this.recentErrors.push(error)

    // 保持最近1000个错误
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors = this.recentErrors.slice(-this.maxRecentErrors)
    }
  }

  private analyzeSingleError(error: UnifiedError): Partial<ErrorPattern> {
    return {
      category: error.category,
      severity: error.severity,
      errorCode: error.code,
      messagePattern: this.extractMessagePattern(error.message),
      stackPattern: this.extractStackPattern(error.stack)
    }
  }

  private async analyzeTimeSeriesPattern(error: UnifiedError): Promise<Partial<ErrorPattern>> {
    const now = Date.now()
    const timeWindow = 300000 // 5分钟窗口

    // 查找时间窗口内的相似错误
    const similarErrors = this.recentErrors.filter(e => {
      const timeDiff = now - e.timestamp
      return timeDiff <= timeWindow && e.category === error.category
    })

    if (similarErrors.length >= 3) {
      return {
        frequencyPattern: {
          count: similarErrors.length,
          timeWindow: timeWindow,
          threshold: 3
        }
      }
    }

    return {}
  }

  private analyzeContextPattern(error: UnifiedError): Partial<ErrorPattern> {
    if (error.context) {
      return {
        contextPattern: {
          operation: error.context.operation,
          component: error.context.component,
          environment: error.context.environment
        }
      }
    }
    return {}
  }

  private combinePatterns(
    single: Partial<ErrorPattern>,
    timeSeries: Partial<ErrorPattern>,
    context: Partial<ErrorPattern>
  ): Partial<ErrorPattern> {
    return {
      ...single,
      ...timeSeries,
      ...context
    }
  }

  private findMatchingPattern(pattern: Partial<ErrorPattern>): HealingPattern | null {
    for (const [id, existingPattern] of this.patterns) {
      if (this.patternsMatch(pattern, existingPattern.errorPatterns[0])) {
        return existingPattern
      }
    }
    return null
  }

  private patternsMatch(pattern1: Partial<ErrorPattern>, pattern2: ErrorPattern): boolean {
    // 简单的模式匹配逻辑
    return pattern1.category === pattern2.category &&
           pattern1.severity === pattern2.severity &&
           (!pattern1.errorCode || pattern1.errorCode === pattern2.errorCode)
  }

  private shouldCreateNewPattern(pattern: Partial<ErrorPattern>): boolean {
    // 简单的创建条件判断
    return pattern.frequencyPattern !== undefined &&
           pattern.frequencyPattern.count >= 5
  }

  private createNewPattern(pattern: Partial<ErrorPattern>): HealingPattern {
    const newPattern: HealingPattern = {
      id: this.generatePatternId(),
      name: `New Pattern ${Date.now()}`,
      description: `Discovered pattern for ${pattern.category} errors`,
      errorPatterns: [pattern as ErrorPattern],
      frequency: 1,
      confidence: 0.3,
      lastObserved: Date.now()
    }

    this.patterns.set(newPattern.id, newPattern)
    return newPattern
  }

  private extractMessagePattern(message: string): string | undefined {
    // 提取消息模式（简化实现）
    if (message.includes('timeout')) return 'timeout'
    if (message.includes('connection')) return 'connection'
    if (message.includes('permission')) return 'permission'
    return undefined
  }

  private extractStackPattern(stack: string | undefined): string | undefined {
    // 提取堆栈模式（简化实现）
    if (!stack) return undefined
    if (stack.includes('network')) return 'network'
    if (stack.includes('database')) return 'database'
    return undefined
  }

  private generatePatternId(): string {
    return `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * 根因分析器
 */
export class RootCauseAnalyzer {
  private knowledgeBase: Map<string, KnowledgeEntry> = new Map()

  /**
   * 分析错误根因
   */
  public async analyzeRootCause(error: UnifiedError): Promise<{
    rootCause: string
    confidence: number
    evidence: string[]
    recommendations: string[]
  }> {
    const evidence: string[] = []
    const recommendations: string[] = []

    // 基于错误类型分析
    const typeAnalysis = this.analyzeByErrorType(error)
    evidence.push(...typeAnalysis.evidence)
    recommendations.push(...typeAnalysis.recommendations)

    // 基于上下文分析
    const contextAnalysis = this.analyzeByContext(error)
    evidence.push(...contextAnalysis.evidence)
    recommendations.push(...contextAnalysis.recommendations)

    // 基于历史数据分析
    const historyAnalysis = await this.analyzeByHistory(error)
    evidence.push(...historyAnalysis.evidence)
    recommendations.push(...historyAnalysis.recommendations)

    // 查找知识库
    const knowledgeMatch = this.findKnowledgeMatch(error)
    if (knowledgeMatch) {
      evidence.push(`知识库匹配: ${knowledgeMatch.description}`)
      recommendations.push(...knowledgeMatch.solution.steps.map(step => step.description))
    }

    // 计算置信度
    const confidence = this.calculateConfidence(evidence.length, recommendations.length)

    // 生成根因描述
    const rootCause = this.generateRootCauseDescription(error, evidence, recommendations)

    return {
      rootCause,
      confidence,
      evidence,
      recommendations
    }
  }

  private analyzeByErrorType(error: UnifiedError): {
    evidence: string[]
    recommendations: string[]
  } {
    const evidence: string[] = []
    const recommendations: string[] = []

    switch (error.category) {
      case ErrorCategory.NETWORK:
        evidence.push('网络相关错误')
        recommendations.push('检查网络连接', '增加重试机制', '实施熔断器')
        break

      case ErrorCategory.DATA:
        evidence.push('数据相关错误')
        recommendations.push('验证数据完整性', '实施数据校验', '准备回滚方案')
        break

      case ErrorCategory.SYSTEM:
        evidence.push('系统相关错误')
        recommendations.push('检查系统资源', '重启相关服务', '监控系统性能')
        break

      case ErrorCategory.BUSINESS:
        evidence.push('业务逻辑错误')
        recommendations.push('检查业务规则', '验证输入参数', '更新业务逻辑')
        break

      default:
        evidence.push('未知错误类型')
        recommendations.push('需要进一步调查')
    }

    return { evidence, recommendations }
  }

  private analyzeByContext(error: UnifiedError): {
    evidence: string[]
    recommendations: string[]
  } {
    const evidence: string[] = []
    const recommendations: string[] = []

    if (error.context) {
      if (error.context.component) {
        evidence.push(`发生在组件: ${error.context.component}`)
        recommendations.push(`检查 ${error.context.component} 组件状态`)
      }

      if (error.context.operation) {
        evidence.push(`发生在操作: ${error.context.operation}`)
        recommendations.push(`验证 ${error.context.operation} 操作参数`)
      }

      if (error.context.environment) {
        evidence.push(`环境: ${error.context.environment}`)
        recommendations.push(`检查 ${error.context.environment} 环境配置`)
      }
    }

    return { evidence, recommendations }
  }

  private async analyzeByHistory(error: UnifiedError): Promise<{
    evidence: string[]
    recommendations: string[]
  }> {
    // 这里应该查询历史错误数据
    // 简化实现
    return {
      evidence: ['历史数据分析中...'],
      recommendations: ['分析历史错误模式']
    }
  }

  private findKnowledgeMatch(error: UnifiedError): KnowledgeEntry | null {
    for (const [id, entry] of this.knowledgeBase) {
      if (this.matchesKnowledgePattern(error, entry.pattern)) {
        entry.usageCount++
        entry.lastUsed = Date.now()
        return entry
      }
    }
    return null
  }

  private matchesKnowledgePattern(error: UnifiedError, pattern: ErrorPattern): boolean {
    return pattern.category === error.category &&
           pattern.severity === error.severity &&
           (!pattern.errorCode || pattern.errorCode === error.code)
  }

  private calculateConfidence(evidenceCount: number, recommendationCount: number): number {
    const baseConfidence = Math.min(evidenceCount * 0.2, 0.6)
    const recommendationBonus = Math.min(recommendationCount * 0.1, 0.3)
    return Math.min(baseConfidence + recommendationBonus, 0.9)
  }

  private generateRootCauseDescription(
    error: UnifiedError,
    evidence: string[],
    recommendations: string[]
  ): string {
    return `根因分析结果：
错误类型: ${error.category} (${error.severity})
主要证据: ${evidence.slice(0, 3).join(', ')}
建议措施: ${recommendations.slice(0, 2).join(', ')}`
  }
}

/**
 * 自愈框架主类
 */
export class SelfHealingFramework {
  private static instance: SelfHealingFramework
  private rules: Map<string, HealingRule> = new Map()
  private sessions: Map<string, HealingSession> = new Map()
  private metrics: HealingMetrics = this.initializeMetrics()
  private patternRecognizer: PatternRecognizer
  private rootCauseAnalyzer: RootCauseAnalyzer
  private recoveryManager: RecoveryStrategyManager
  private monitoringService: ErrorMonitoringService

  private constructor(
    recoveryManager: RecoveryStrategyManager,
    monitoringService: ErrorMonitoringService
  ) {
    this.recoveryManager = recoveryManager
    this.monitoringService = monitoringService
    this.patternRecognizer = new PatternRecognizer()
    this.rootCauseAnalyzer = new RootCauseAnalyzer()
    this.initializeDefaultRules()
  }

  public static getInstance(
    recoveryManager: RecoveryStrategyManager,
    monitoringService: ErrorMonitoringService
  ): SelfHealingFramework {
    if (!SelfHealingFramework.instance) {
      SelfHealingFramework.instance = new SelfHealingFramework(recoveryManager, monitoringService)
    }
    return SelfHealingFramework.instance
  }

  /**
   * 处理错误的自愈
   */
  public async handleSelfHealing(
    error: UnifiedError,
    context: ErrorContext
  ): Promise<HealingResult | null> {
    // 检查是否应该进行自愈
    if (!this.shouldSelfHeal(error)) {
      return null
    }

    // 创建自愈会话
    const sessionId = this.generateSessionId()
    const session: HealingSession = {
      id: sessionId,
      triggerError: error,
      rule: this.findMatchingRule(error)!, // 已经检查过存在匹配规则
      startTime: performance.now(),
      status: 'active',
      actions: [],
      confidence: 0
    }

    this.sessions.set(sessionId, session)
    this.metrics.totalSessions++

    try {
      // 模式识别
      const pattern = await this.patternRecognizer.recognizePattern(error)

      // 根因分析
      const rootCauseAnalysis = await this.rootCauseAnalyzer.analyzeRootCause(error)

      // 计算自愈置信度
      session.confidence = this.calculateHealingConfidence(error, pattern, rootCauseAnalysis)

      // 执行自愈动作
      const result = await this.executeHealingActions(session, rootCauseAnalysis)

      session.status = result.success ? 'completed' : 'failed'
      session.result = result

      this.updateMetrics(result)

      // 记录自愈结果
      await this.monitoringService.recordSelfHealing(error, result)

      return result
    } catch (healingError) {
      const result: HealingResult = {
        success: false,
        actions: 0,
        successfulActions: 0,
        duration: performance.now() - session.startTime,
        confidence: session.confidence,
        effectiveness: 0,
        message: '自愈过程发生错误',
        details: { error: healingError }
      }

      session.status = 'failed'
      session.result = result

      this.updateMetrics(result)

      return result
    } finally {
      session.endTime = performance.now()
      this.cleanupSession(sessionId)
    }
  }

  /**
   * 注册自愈规则
   */
  public registerRule(rule: HealingRule): void {
    this.rules.set(rule.id, rule)
    console.log(`已注册自愈规则: ${rule.name} (${rule.id})`)
  }

  /**
   * 取消注册自愈规则
   */
  public unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId)
    console.log(`已取消注册自愈规则: ${ruleId}`)
  }

  /**
   * 获取自愈指标
   */
  public getMetrics(): HealingMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取活跃的自愈会话
   */
  public getActiveSessions(): HealingSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.status === 'active')
  }

  /**
   * 学习新的自愈模式
   */
  public async learnFromError(error: UnifiedError, successfulRecovery: RecoveryResult): Promise<void> {
    // 分析成功的恢复模式
    if (successfulRecovery.success) {
      const pattern = await this.patternRecognizer.recognizePattern(error)

      if (pattern) {
        // 基于成功恢复创建新的自愈规则
        const newRule = this.createRuleFromRecovery(error, pattern, successfulRecovery)

        if (newRule) {
          this.registerRule(newRule)
          console.log(`从成功恢复中学习到新规则: ${newRule.name}`)
        }
      }
    }
  }

  private shouldSelfHeal(error: UnifiedError): boolean {
    // 检查是否有匹配的自愈规则
    const matchingRule = this.findMatchingRule(error)
    return matchingRule !== null
  }

  private findMatchingRule(error: UnifiedError): HealingRule | null {
    const matchingRules = Array.from(this.rules.values())
      .filter(rule => this.matchesRule(error, rule))
      .sort((a, b) => b.priority - a.priority)

    return matchingRules[0] || null
  }

  private matchesRule(error: UnifiedError, rule: HealingRule): boolean {
    // 检查冷却时间
    if (rule.lastApplied && Date.now() - rule.lastApplied < rule.cooldownPeriod) {
      return false
    }

    // 检查应用次数限制
    if (rule.applicationCount >= rule.maxApplications) {
      return false
    }

    // 检查错误模式匹配
    return this.matchesPattern(error, rule.pattern)
  }

  private matchesPattern(error: UnifiedError, pattern: ErrorPattern): boolean {
    return pattern.category === error.category &&
           pattern.severity === error.severity &&
           (!pattern.errorCode || pattern.errorCode === error.code) &&
           (!pattern.messagePattern ||
            error.message.toLowerCase().includes(pattern.messagePattern.toLowerCase()))
  }

  private calculateHealingConfidence(
    error: UnifiedError,
    pattern: HealingPattern | null,
    rootCauseAnalysis: any
  ): number {
    let confidence = 0.5 // 基础置信度

    // 模式匹配置信度
    if (pattern) {
      confidence += pattern.confidence * 0.3
    }

    // 根因分析置信度
    confidence += rootCauseAnalysis.confidence * 0.2

    // 错误严重度影响
    if (error.severity === ErrorSeverity.LOW) {
      confidence += 0.1
    } else if (error.severity === ErrorSeverity.CRITICAL) {
      confidence -= 0.1
    }

    return Math.max(0.1, Math.min(0.9, confidence))
  }

  private async executeHealingActions(
    session: HealingSession,
    rootCauseAnalysis: any
  ): Promise<HealingResult> {
    const startTime = performance.now()
    let successfulActions = 0

    for (const action of session.rule.actions) {
      const execution: HealingExecution = {
        action,
        startTime: performance.now(),
        status: 'pending'
      }

      session.actions.push(execution)

      try {
        execution.status = 'running'

        // 执行自愈动作
        const result = await this.executeAction(action, session.triggerError, rootCauseAnalysis)

        execution.endTime = performance.now()
        execution.status = 'completed'
        execution.result = result
        successfulActions++

      } catch (actionError) {
        execution.endTime = performance.now()
        execution.status = 'failed'
        execution.error = actionError

        // 尝试回滚
        if (action.rollback && action.rollbackAction) {
          try {
            execution.rollbackAttempted = true
            const rollbackResult = await this.executeAction(
              action.rollbackAction,
              session.triggerError,
              rootCauseAnalysis
            )
            execution.rollbackResult = rollbackResult
          } catch (rollbackError) {
            execution.rollbackResult = { error: rollbackError }
          }
        }
      }
    }

    const duration = performance.now() - startTime
    const effectiveness = successfulActions / session.rule.actions.length

    return {
      success: successfulActions > 0,
      actions: session.rule.actions.length,
      successfulActions,
      duration,
      confidence: session.confidence,
      effectiveness,
      message: `自愈完成，成功执行 ${successfulActions}/${session.rule.actions.length} 个动作`,
      details: {
        sessionId: session.id,
        ruleId: session.rule.id,
        rootCause: rootCauseAnalysis.rootCause
      }
    }
  }

  private async executeAction(
    action: HealingAction,
    error: UnifiedError,
    rootCauseAnalysis: any
  ): Promise<any> {
    switch (action.type) {
      case 'restart_service':
        return this.restartService(action.target, action.parameters)
      case 'clear_cache':
        return this.clearCache(action.target, action.parameters)
      case 'adjust_config':
        return this.adjustConfig(action.target, action.parameters)
      case 'retry_operation':
        return this.retryOperation(error, action.parameters)
      case 'rollback_data':
        return this.rollbackData(action.target, action.parameters)
      case 'custom':
        return this.executeCustomAction(action.target, action.parameters)
      default:
        throw new Error(`未知的自愈动作类型: ${action.type}`)
    }
  }

  private async restartService(serviceName: string, parameters: any): Promise<any> {
    console.log(`重启服务: ${serviceName}`)
    // 这里应该实现实际的服务重启逻辑
    return { success: true, service: serviceName }
  }

  private async clearCache(cacheName: string, parameters: any): Promise<any> {
    console.log(`清除缓存: ${cacheName}`)
    // 这里应该实现实际的缓存清除逻辑
    return { success: true, cache: cacheName }
  }

  private async adjustConfig(configName: string, parameters: any): Promise<any> {
    console.log(`调整配置: ${configName}`, parameters)
    // 这里应该实现实际的配置调整逻辑
    return { success: true, config: configName }
  }

  private async retryOperation(error: UnifiedError, parameters: any): Promise<any> {
    console.log('重试操作')
    // 使用恢复管理器进行重试
    const context: ErrorContext = {
      operation: parameters.operation,
      component: parameters.component,
      environment: parameters.environment,
      timestamp: Date.now()
    }

    return await this.recoveryManager.recover(error, context)
  }

  private async rollbackData(target: string, parameters: any): Promise<any> {
    console.log(`回滚数据: ${target}`)
    // 这里应该实现实际的数据回滚逻辑
    return { success: true, target }
  }

  private async executeCustomAction(target: string, parameters: any): Promise<any> {
    console.log(`执行自定义动作: ${target}`, parameters)
    // 这里应该实现自定义动作逻辑
    return { success: true, target }
  }

  private createRuleFromRecovery(
    error: UnifiedError,
    pattern: HealingPattern,
    recovery: RecoveryResult
  ): HealingRule | null {
    // 基于成功恢复创建新的自愈规则
    const rule: HealingRule = {
      id: this.generateRuleId(),
      name: `Learned Rule ${Date.now()}`,
      description: `从成功恢复中学习的规则`,
      pattern: pattern.errorPatterns[0],
      conditions: [],
      actions: this.convertRecoveryToActions(recovery),
      priority: 5,
      confidence: 0.6,
      maxApplications: 100,
      cooldownPeriod: 300000, // 5分钟
      successRate: 1.0,
      applicationCount: 0
    }

    return rule
  }

  private convertRecoveryToActions(recovery: RecoveryResult): HealingAction[] {
    // 将恢复结果转换为自愈动作
    // 简化实现
    return [
      {
        type: 'retry_operation',
        target: 'system',
        parameters: {},
        timeout: 30000
      }
    ]
  }

  private updateMetrics(result: HealingResult): void {
    if (result.success) {
      this.metrics.successfulSessions++
    } else {
      this.metrics.failedSessions++
    }

    // 更新平均自愈时间
    const totalTime = this.metrics.averageHealingTime * (this.metrics.totalSessions - 1) + result.duration
    this.metrics.averageHealingTime = totalTime / this.metrics.totalSessions

    // 更新成功率
    this.metrics.successRate = this.metrics.successfulSessions / this.metrics.totalSessions

    // 更新平均置信度
    const totalConfidence = this.metrics.averageConfidence * (this.metrics.totalSessions - 1) + result.confidence
    this.metrics.averageConfidence = totalConfidence / this.metrics.totalSessions

    // 更新自愈率
    this.metrics.autoResolutionRate = this.metrics.successRate
  }

  private initializeDefaultRules(): void {
    // 网络连接问题自愈规则
    const networkRule: HealingRule = {
      id: 'network-connection-heal',
      name: '网络连接自愈',
      description: '自动处理网络连接问题',
      pattern: {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        messagePattern: 'connection'
      },
      conditions: [],
      actions: [
        {
          type: 'retry_operation',
          target: 'network-service',
          parameters: { maxAttempts: 3, delay: 1000 },
          timeout: 10000,
          rollback: true,
          rollbackAction: {
            type: 'clear_cache',
            target: 'network-cache',
            parameters: {},
            timeout: 5000
          }
        }
      ],
      priority: 10,
      confidence: 0.8,
      maxApplications: 50,
      cooldownPeriod: 60000,
      successRate: 0.0,
      applicationCount: 0
    }

    // 系统资源问题自愈规则
    const systemRule: HealingRule = {
      id: 'system-resource-heal',
      name: '系统资源自愈',
      description: '自动处理系统资源问题',
      pattern: {
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        messagePattern: 'resource'
      },
      conditions: [],
      actions: [
        {
          type: 'clear_cache',
          target: 'system-cache',
          parameters: { clearAll: true },
          timeout: 15000
        },
        {
          type: 'adjust_config',
          target: 'memory-config',
          parameters: { limit: '50%' },
          timeout: 5000
        }
      ],
      priority: 8,
      confidence: 0.7,
      maxApplications: 30,
      cooldownPeriod: 300000,
      successRate: 0.0,
      applicationCount: 0
    }

    this.registerRule(networkRule)
    this.registerRule(systemRule)
  }

  private initializeMetrics(): HealingMetrics {
    return {
      totalSessions: 0,
      successfulSessions: 0,
      failedSessions: 0,
      averageHealingTime: 0,
      successRate: 0,
      averageConfidence: 0,
      ruleEffectiveness: new Map(),
      patternDetectionRate: 0,
      autoResolutionRate: 0,
      falsePositiveRate: 0
    }
  }

  private generateSessionId(): string {
    return `healing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private generateRuleId(): string {
    return `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session && session.endTime) {
      // 保留最近500个完成的会话
      const completedSessions = Array.from(this.sessions.values())
        .filter(s => s.endTime)
        .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))

      if (completedSessions.length > 500) {
        const toRemove = completedSessions.slice(500)
        toRemove.forEach(s => this.sessions.delete(s.id))
      }
    }
  }
}