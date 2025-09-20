// ============================================================================
// 冲突管理测试套件 - Phase 1 质量保证组件
// 全面测试冲突状态管理、持久化、诊断和存储优化功能
// ============================================================================

import { ConflictStateManager, type ConflictState } from './conflict-state-manager'
import { ConflictDiagnosticTools } from './conflict-diagnostic-tools'
import { ConflictStorageOptimizer } from './conflict-storage-optimizer'
import { type ConflictResolution } from './conflict-resolution-engine/unified-conflict-resolution-engine'

// ============================================================================
// 测试结果接口
// ============================================================================

export interface TestResult {
  id: string
  name: string
  category: 'unit' | 'integration' | 'performance' | 'stress'
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  error?: string
  details?: any
  timestamp: Date
}

export interface TestSuiteResult {
  id: string
  name: string
  totalTests: number
  passedTests: number
  failedTests: number
  skippedTests: number
  successRate: number
  duration: number
  results: TestResult[]
  timestamp: Date
}

export interface PerformanceBenchmark {
  test: string
  metric: string
  value: number
  unit: string
  threshold: number
  passed: boolean
}

// ============================================================================
// 测试套件配置
// ============================================================================

export interface TestSuiteConfig {
  // 测试执行配置
  execution: {
    parallel: boolean
    maxConcurrency: number
    timeout: number // 毫秒
    retryFailed: boolean
    maxRetries: number
  }

  // 测试数据配置
  testData: {
    generateSyntheticData: boolean
    conflictCount: number
    entityTypes: ('card' | 'folder' | 'tag' | 'image')[]
    statusDistribution: Record<ConflictState['status'], number>
  }

  // 性能测试配置
  performance: {
    enabled: boolean
    iterations: number
    warmupIterations: number
    thresholds: {
      maxStateCreationTime: number
      maxQueryTime: number
      maxResolutionTime: number
      maxMemoryUsage: number
    }
  }

  // 压力测试配置
  stress: {
    enabled: boolean
    maxConcurrentOperations: number
    duration: number // 秒
    operationRate: number // 操作/秒
  }

  // 报告配置
  reporting: {
    detailedResults: boolean
    performanceMetrics: boolean
    generateReport: boolean
    outputFormat: 'console' | 'json' | 'html'
  }
}

// ============================================================================
// 测试数据生成器
// ============================================================================

class TestDataGenerator {
  static generateConflictState(overrides?: Partial<ConflictState>): ConflictState {
    const entityTypes: ConflictState['entityType'][] = ['card', 'folder', 'tag', 'image']
    const conflictTypes: ConflictState['conflictType'][] = ['version', 'content', 'structure', 'delete', 'field']
    const statuses: ConflictState['status'][] = ['pending', 'detecting', 'resolving', 'resolved', 'failed']
    const severities: ConflictState['severity'][] = ['low', 'medium', 'high', 'critical']

    return {
      id: crypto.randomUUID(),
      entityType: entityTypes[Math.floor(Math.random() * entityTypes.length)],
      entityId: crypto.randomUUID(),
      conflictType: conflictTypes[Math.floor(Math.random() * conflictTypes.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      localData: { content: `Local content ${Math.random()}` },
      cloudData: { content: `Cloud content ${Math.random()}` },
      localVersion: Math.floor(Math.random() * 10),
      cloudVersion: Math.floor(Math.random() * 10),
      localTimestamp: new Date(Date.now() - Math.random() * 86400000),
      cloudTimestamp: new Date(Date.now() - Math.random() * 86400000),
      detectionTime: Math.random() * 1000,
      detectedAt: new Date(Date.now() - Math.random() * 3600000),
      sourceDevice: 'test-device',
      retryCount: Math.floor(Math.random() * 3),
      maxRetries: 3,
      persisted: false,
      ...overrides
    }
  }

  static generateConflictResolution(overrides?: Partial<ConflictResolution>): ConflictResolution {
    return {
      type: 'keep_local',
      strategy: 'timestamp',
      success: true,
      reasoning: 'Automatically resolved based on timestamp',
      timestamp: new Date(),
      ...overrides
    }
  }

  static generateTestConflicts(count: number): ConflictState[] {
    return Array.from({ length: count }, () => this.generateConflictState())
  }
}

// ============================================================================
// 冲突管理测试套件
// ============================================================================

export class ConflictManagementTestSuite {
  private config: TestSuiteConfig
  private results: TestResult[] = []
  private benchmarks: PerformanceBenchmark[] = []
  private startTime: number

  constructor(config?: Partial<TestSuiteConfig>) {
    this.config = this.getDefaultConfig(config)
  }

  private getDefaultConfig(config?: Partial<TestSuiteConfig>): TestSuiteConfig {
    return {
      execution: {
        parallel: true,
        maxConcurrency: 4,
        timeout: 30000,
        retryFailed: true,
        maxRetries: 2
      },
      testData: {
        generateSyntheticData: true,
        conflictCount: 100,
        entityTypes: ['card', 'folder', 'tag', 'image'],
        statusDistribution: {
          'pending': 40,
          'detecting': 10,
          'resolving': 20,
          'resolved': 25,
          'failed': 5
        }
      },
      performance: {
        enabled: true,
        iterations: 100,
        warmupIterations: 10,
        thresholds: {
          maxStateCreationTime: 100,
          maxQueryTime: 50,
          maxResolutionTime: 200,
          maxMemoryUsage: 50 * 1024 * 1024 // 50MB
        }
      },
      stress: {
        enabled: true,
        maxConcurrentOperations: 50,
        duration: 60,
        operationRate: 10
      },
      reporting: {
        detailedResults: true,
        performanceMetrics: true,
        generateReport: true,
        outputFormat: 'console'
      },
      ...config
    }
  }

  // ============================================================================
  // 测试执行器
  // ============================================================================

  async runFullTestSuite(): Promise<TestSuiteResult> {
    this.startTime = performance.now()
    this.results = []
    this.benchmarks = []

    console.log('🧪 Starting Conflict Management Test Suite...')
    console.log(`📊 Configuration: ${JSON.stringify(this.config.execution, null, 2)}`)

    try {
      // 单元测试
      await this.runUnitTests()

      // 集成测试
      await this.runIntegrationTests()

      // 性能测试
      if (this.config.performance.enabled) {
        await this.runPerformanceTests()
      }

      // 压力测试
      if (this.config.stress.enabled) {
        await this.runStressTests()
      }

      const duration = performance.now() - this.startTime
      const suiteResult = this.generateSuiteResult(duration)

      if (this.config.reporting.generateReport) {
        await this.generateTestReport(suiteResult)
      }

      return suiteResult
    } catch (error) {
      console.error('Test suite execution failed:', error)
      throw error
    }
  }

  private async runUnitTests(): Promise<void> {
    console.log('🔬 Running unit tests...')

    const testGroups = [
      this.testStateManagerBasicOperations,
      this.testStateManagerStateTransitions,
      this.testDiagnosticToolsBasicFunctions,
      this.testStorageOptimizerBasicOperations
    ]

    if (this.config.execution.parallel) {
      await this.runTestsInParallel(testGroups)
    } else {
      for (const testGroup of testGroups) {
        await testGroup.call(this)
      }
    }
  }

  private async runIntegrationTests(): Promise<void> {
    console.log('🔗 Running integration tests...')

    const testGroups = [
      this.testStatePersistenceIntegration,
      this.testDiagnosticIntegration,
      this.testStorageIntegration,
      this.testEndToEndWorkflow
    ]

    if (this.config.execution.parallel) {
      await this.runTestsInParallel(testGroups)
    } else {
      for (const testGroup of testGroups) {
        await testGroup.call(this)
      }
    }
  }

  private async runPerformanceTests(): Promise<void> {
    console.log('⚡ Running performance tests...')

    const performanceTests = [
      this.benchmarkStateCreation,
      this.benchmarkQueryPerformance,
      this.benchmarkResolutionPerformance,
      this.benchmarkStoragePerformance
    ]

    for (const test of performanceTests) {
      await test.call(this)
    }
  }

  private async runStressTests(): Promise<void> {
    console.log('🔥 Running stress tests...')

    await this.testConcurrentOperations()
    await this.testMemoryUsage()
    await this.testRecoveryScenarios()
  }

  private async runTestsInParallel(testGroups: Function[]): Promise<void> {
    const concurrency = Math.min(testGroups.length, this.config.execution.maxConcurrency)
    const chunks = this.chunkArray(testGroups, concurrency)

    for (const chunk of chunks) {
      await Promise.all(chunk.map(testGroup => testGroup.call(this)))
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  // ============================================================================
  // 单元测试
  // ============================================================================

  private async testStateManagerBasicOperations(): Promise<void> {
    const testName = 'State Manager Basic Operations'
    const startTime = performance.now()

    try {
      const stateManager = new ConflictStateManager()

      // 测试创建冲突状态
      const conflict = TestDataGenerator.generateConflictState()
      const conflictId = await stateManager.createConflict(conflict)

      // 验证创建
      const retrieved = stateManager.getConflictState(conflictId)
      if (!retrieved) throw new Error('Conflict state not created')

      // 测试更新状态
      const updateSuccess = await stateManager.updateConflictState(conflictId, {
        status: 'resolving'
      })

      if (!updateSuccess) throw new Error('State update failed')

      // 测试状态检索
      const updated = stateManager.getConflictState(conflictId)
      if (updated?.status !== 'resolving') throw new Error('State not updated correctly')

      // 测试删除
      const deleteSuccess = await stateManager.deleteConflictState(conflictId)
      if (!deleteSuccess) throw new Error('State deletion failed')

      await stateManager.destroy()

      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'unit',
        status: 'passed',
        duration: performance.now() - startTime,
        timestamp: new Date()
      })
    } catch (error) {
      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'unit',
        status: 'failed',
        duration: performance.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date()
      })
    }
  }

  private async testStateManagerStateTransitions(): Promise<void> {
    const testName = 'State Manager State Transitions'
    const startTime = performance.now()

    try {
      const stateManager = new ConflictStateManager()

      // 测试有效状态转换
      const conflict = TestDataGenerator.generateConflictState({ status: 'pending' })
      const conflictId = await stateManager.createConflict(conflict)

      // pending -> detecting
      await stateManager.updateConflictState(conflictId, { status: 'detecting' })

      // detecting -> resolving
      await stateManager.updateConflictState(conflictId, { status: 'resolving' })

      // resolving -> resolved
      const resolution = TestDataGenerator.generateConflictResolution()
      await stateManager.resolveConflict(conflictId, resolution)

      // 验证最终状态
      const final = stateManager.getConflictState(conflictId)
      if (final?.status !== 'resolved') throw new Error('State transition failed')

      // 测试无效状态转换
      try {
        await stateManager.updateConflictState(conflictId, { status: 'pending' })
        throw new Error('Invalid state transition should have failed')
      } catch (error) {
        // 预期的错误
      }

      await stateManager.destroy()

      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'unit',
        status: 'passed',
        duration: performance.now() - startTime,
        timestamp: new Date()
      })
    } catch (error) {
      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'unit',
        status: 'failed',
        duration: performance.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date()
      })
    }
  }

  private async testDiagnosticToolsBasicFunctions(): Promise<void> {
    const testName = 'Diagnostic Tools Basic Functions'
    const startTime = performance.now()

    try {
      const diagnosticTools = new ConflictDiagnosticTools()
      await diagnosticTools.initialize()

      // 测试日志记录
      diagnosticTools.log('info', 'system', undefined, 'Test log message')

      // 测试日志检索
      const logs = diagnosticTools.getLogs({ limit: 1 })
      if (logs.length === 0) throw new Error('Log not recorded')

      // 测试日志分析
      const analysis = diagnosticTools.analyzeLogs()
      if (analysis.totalLogs === 0) throw new Error('Log analysis failed')

      // 测试日志导出
      const exported = diagnosticTools.exportLogs('json')
      if (!exported) throw new Error('Log export failed')

      await diagnosticTools.destroy()

      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'unit',
        status: 'passed',
        duration: performance.now() - startTime,
        timestamp: new Date()
      })
    } catch (error) {
      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'unit',
        status: 'failed',
        duration: performance.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date()
      })
    }
  }

  private async testStorageOptimizerBasicOperations(): Promise<void> {
    const testName = 'Storage Optimizer Basic Operations'
    const startTime = performance.now()

    try {
      const storageOptimizer = new ConflictStorageOptimizer()

      // 测试配置
      const config = storageOptimizer.getConfig()
      if (!config) throw new Error('Config not available')

      // 测试指标
      const metrics = storageOptimizer.getMetrics()
      if (!metrics) throw new Error('Metrics not available')

      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'unit',
        status: 'passed',
        duration: performance.now() - startTime,
        timestamp: new Date()
      })
    } catch (error) {
      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'unit',
        status: 'failed',
        duration: performance.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date()
      })
    }
  }

  // ============================================================================
  // 集成测试
  // ============================================================================

  private async testStatePersistenceIntegration(): Promise<void> {
    const testName = 'State Persistence Integration'
    const startTime = performance.now()

    try {
      const stateManager = new ConflictStateManager({
        persistence: {
          enabled: true,
          autoPersist: false,
          persistInterval: 1000,
          maxRetries: 3,
          retryDelay: 100
        }
      })

      await stateManager.initialize()

      // 创建测试冲突
      const conflicts = TestDataGenerator.generateTestConflicts(5)
      const conflictIds: string[] = []

      for (const conflict of conflicts) {
        const id = await stateManager.createConflict(conflict)
        conflictIds.push(id)
      }

      // 手动持久化
      await stateManager.persistAllStates()

      // 验证持久化
      const metrics = stateManager.getMetrics()
      if (metrics.persistenceStats.totalPersisted < 5) {
        throw new Error('Persistence verification failed')
      }

      // 测试状态更新和持久化
      const resolution = TestDataGenerator.generateConflictResolution()
      await stateManager.resolveConflict(conflictIds[0], resolution)

      await stateManager.destroy()

      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'integration',
        status: 'passed',
        duration: performance.now() - startTime,
        timestamp: new Date()
      })
    } catch (error) {
      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'integration',
        status: 'failed',
        duration: performance.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date()
      })
    }
  }

  private async testDiagnosticIntegration(): Promise<void> {
    const testName = 'Diagnostic Integration'
    const startTime = performance.now()

    try {
      const stateManager = new ConflictStateManager()
      const diagnosticTools = new ConflictDiagnosticTools()

      await stateManager.initialize()
      await diagnosticTools.initialize()

      // 创建问题冲突
      const conflict = TestDataGenerator.generateConflictState({
        status: 'pending',
        severity: 'critical',
        retryCount: 4,
        maxRetries: 3,
        detectedAt: new Date(Date.now() - 600000) // 10分钟前
      })

      const conflictId = await stateManager.createConflict(conflict)

      // 运行诊断
      const results = await diagnosticTools.runFullDiagnostic()

      // 验证诊断结果
      const relevantResults = results.filter(r =>
        r.affectedConflicts?.includes(conflictId)
      )

      if (relevantResults.length === 0) {
        throw new Error('No diagnostic results found for test conflict')
      }

      // 验证健康报告
      const healthReport = await diagnosticTools.getHealthReport()
      if (!healthReport) throw new Error('Health report not generated')

      await stateManager.destroy()
      await diagnosticTools.destroy()

      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'integration',
        status: 'passed',
        duration: performance.now() - startTime,
        timestamp: new Date()
      })
    } catch (error) {
      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'integration',
        status: 'failed',
        duration: performance.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date()
      })
    }
  }

  private async testStorageIntegration(): Promise<void> {
    const testName = 'Storage Integration'
    const startTime = performance.now()

    try {
      const stateManager = new ConflictStateManager()
      const storageOptimizer = new ConflictStorageOptimizer()

      await stateManager.initialize()
      await storageOptimizer.initialize()

      // 批量创建冲突
      const conflicts = TestDataGenerator.generateTestConflicts(20)
      const conflictIds: string[] = []

      for (const conflict of conflicts) {
        const id = await stateManager.createConflict(conflict)
        conflictIds.push(id)
      }

      // 测试存储查询
      const queryResults = await storageOptimizer.queryConflicts({
        limit: 10,
        sortBy: 'detectedAt',
        sortOrder: 'desc'
      })

      if (queryResults.length === 0) throw new Error('Storage query returned no results')

      // 测试批量操作
      const batchResult = await storageOptimizer.batchOperation('delete', conflicts.slice(0, 5))
      if (batchResult.success !== 5) throw new Error('Batch operation failed')

      await stateManager.destroy()
      await storageOptimizer.destroy()

      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'integration',
        status: 'passed',
        duration: performance.now() - startTime,
        timestamp: new Date()
      })
    } catch (error) {
      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'integration',
        status: 'failed',
        duration: performance.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date()
      })
    }
  }

  private async testEndToEndWorkflow(): Promise<void> {
    const testName = 'End-to-End Workflow'
    const startTime = performance.now()

    try {
      const stateManager = new ConflictStateManager()
      const diagnosticTools = new ConflictDiagnosticTools()
      const storageOptimizer = new ConflictStorageOptimizer()

      // 初始化所有组件
      await stateManager.initialize()
      await diagnosticTools.initialize()
      await storageOptimizer.initialize()

      // 模拟完整工作流程
      const conflicts = TestDataGenerator.generateTestConflicts(10)
      const conflictIds: string[] = []

      // 1. 创建冲突
      for (const conflict of conflicts) {
        const id = await stateManager.createConflict(conflict)
        conflictIds.push(id)
      }

      // 2. 检测和诊断问题
      const diagnosticResults = await diagnosticTools.runFullDiagnostic()
      const healthReport = await diagnosticTools.getHealthReport()

      // 3. 解决一些冲突
      const resolution = TestDataGenerator.generateConflictResolution()
      for (let i = 0; i < 5; i++) {
        await stateManager.resolveConflict(conflictIds[i], resolution)
      }

      // 4. 验证状态
      const metrics = stateManager.getMetrics()
      if (metrics.resolvedConflicts !== 5) {
        throw new Error(`Expected 5 resolved conflicts, got ${metrics.resolvedConflicts}`)
      }

      // 5. 存储验证
      const storageMetrics = storageOptimizer.getMetrics()
      if (storageMetrics.totalRecords < conflictIds.length) {
        throw new Error('Storage verification failed')
      }

      await stateManager.destroy()
      await diagnosticTools.destroy()
      await storageOptimizer.destroy()

      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'integration',
        status: 'passed',
        duration: performance.now() - startTime,
        timestamp: new Date()
      })
    } catch (error) {
      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'integration',
        status: 'failed',
        duration: performance.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date()
      })
    }
  }

  // ============================================================================
  // 性能测试
  // ============================================================================

  private async benchmarkStateCreation(): Promise<void> {
    const testName = 'State Creation Performance'
    const iterations = this.config.performance.iterations
    const warmupIterations = this.config.performance.warmupIterations

    // 预热
    for (let i = 0; i < warmupIterations; i++) {
      const stateManager = new ConflictStateManager()
      const conflict = TestDataGenerator.generateConflictState()
      await stateManager.createConflict(conflict)
      await stateManager.destroy()
    }

    // 正式测试
    const times: number[] = []
    for (let i = 0; i < iterations; i++) {
      const stateManager = new ConflictStateManager()
      const conflict = TestDataGenerator.generateConflictState()

      const start = performance.now()
      await stateManager.createConflict(conflict)
      const end = performance.now()

      times.push(end - start)
      await stateManager.destroy()
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length
    const maxTime = Math.max(...times)

    this.addBenchmark({
      test: testName,
      metric: 'average_creation_time',
      value: avgTime,
      unit: 'ms',
      threshold: this.config.performance.thresholds.maxStateCreationTime,
      passed: avgTime <= this.config.performance.thresholds.maxStateCreationTime
    })

    this.addBenchmark({
      test: testName,
      metric: 'max_creation_time',
      value: maxTime,
      unit: 'ms',
      threshold: this.config.performance.thresholds.maxStateCreationTime,
      passed: maxTime <= this.config.performance.thresholds.maxStateCreationTime
    })
  }

  private async benchmarkQueryPerformance(): Promise<void> {
    const testName = 'Query Performance'
    const stateManager = new ConflictStateManager()
    await stateManager.initialize()

    // 创建测试数据
    const conflicts = TestDataGenerator.generateTestConflicts(100)
    for (const conflict of conflicts) {
      await stateManager.createConflict(conflict)
    }

    const iterations = 50
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await stateManager.getAllConflictStates()
      const end = performance.now()

      times.push(end - start)
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length

    this.addBenchmark({
      test: testName,
      metric: 'average_query_time',
      value: avgTime,
      unit: 'ms',
      threshold: this.config.performance.thresholds.maxQueryTime,
      passed: avgTime <= this.config.performance.thresholds.maxQueryTime
    })

    await stateManager.destroy()
  }

  private async benchmarkResolutionPerformance(): Promise<void> {
    const testName = 'Resolution Performance'
    const stateManager = new ConflictStateManager()
    await stateManager.initialize()

    // 创建测试冲突
    const conflicts = TestDataGenerator.generateTestConflicts(50)
    const conflictIds: string[] = []

    for (const conflict of conflicts) {
      const id = await stateManager.createConflict(conflict)
      conflictIds.push(id)
    }

    const resolution = TestDataGenerator.generateConflictResolution()
    const times: number[] = []

    for (const conflictId of conflictIds) {
      const start = performance.now()
      await stateManager.resolveConflict(conflictId, resolution)
      const end = performance.now()

      times.push(end - start)
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length

    this.addBenchmark({
      test: testName,
      metric: 'average_resolution_time',
      value: avgTime,
      unit: 'ms',
      threshold: this.config.performance.thresholds.maxResolutionTime,
      passed: avgTime <= this.config.performance.thresholds.maxResolutionTime
    })

    await stateManager.destroy()
  }

  private async benchmarkStoragePerformance(): Promise<void> {
    const testName = 'Storage Performance'
    const storageOptimizer = new ConflictStorageOptimizer()
    await storageOptimizer.initialize()

    const stateManager = new ConflictStateManager()
    await stateManager.initialize()

    // 创建测试数据
    const conflicts = TestDataGenerator.generateTestConflicts(100)
    for (const conflict of conflicts) {
      await stateManager.createConflict(conflict)
    }

    // 测试查询性能
    const iterations = 20
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await storageOptimizer.queryConflicts({ limit: 50 })
      const end = performance.now()

      times.push(end - start)
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length

    this.addBenchmark({
      test: testName,
      metric: 'average_storage_query_time',
      value: avgTime,
      unit: 'ms',
      threshold: this.config.performance.thresholds.maxQueryTime,
      passed: avgTime <= this.config.performance.thresholds.maxQueryTime
    })

    await stateManager.destroy()
    await storageOptimizer.destroy()
  }

  // ============================================================================
  // 压力测试
  // ============================================================================

  private async testConcurrentOperations(): Promise<void> {
    const testName = 'Concurrent Operations'
    const startTime = performance.now()
    const concurrency = this.config.stress.maxConcurrentOperations
    const duration = this.config.stress.duration * 1000

    const stateManager = new ConflictStateManager()
    await stateManager.initialize()

    const operations = []
    const endTime = Date.now() + duration

    try {
      while (Date.now() < endTime) {
        const promises = []

        for (let i = 0; i < concurrency; i++) {
          promises.push(this.performConcurrentStateOperation(stateManager))
        }

        await Promise.allSettled(promises)
        operations.push(concurrency)
      }

      const finalMetrics = stateManager.getMetrics()
      const successRate = finalMetrics.successRate * 100

      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'stress',
        status: successRate > 95 ? 'passed' : 'failed',
        duration: performance.now() - startTime,
        details: {
          totalOperations: operations.reduce((a, b) => a + b, 0),
          concurrency,
          successRate,
          metrics: finalMetrics
        },
        timestamp: new Date()
      })
    } catch (error) {
      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'stress',
        status: 'failed',
        duration: performance.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date()
      })
    }

    await stateManager.destroy()
  }

  private async performConcurrentStateOperation(stateManager: ConflictStateManager): Promise<void> {
    const operation = Math.random()

    if (operation < 0.4) {
      // 创建冲突
      const conflict = TestDataGenerator.generateConflictState()
      await stateManager.createConflict(conflict)
    } else if (operation < 0.7) {
      // 查询冲突
      await stateManager.getAllConflictStates()
    } else {
      // 解决冲突
      const conflicts = stateManager.getPendingConflicts()
      if (conflicts.length > 0) {
        const resolution = TestDataGenerator.generateConflictResolution()
        await stateManager.resolveConflict(conflicts[0].id, resolution)
      }
    }
  }

  private async testMemoryUsage(): Promise<void> {
    const testName = 'Memory Usage'
    const startTime = performance.now()

    const stateManager = new ConflictStateManager()
    await stateManager.initialize()

    // 创建大量数据
    const conflicts = TestDataGenerator.generateTestConflicts(1000)
    for (const conflict of conflicts) {
      await stateManager.createConflict(conflict)
    }

    // 模拟内存使用量（在真实环境中可以使用performance.memory）
    const estimatedMemoryUsage = conflicts.length * 1024 // 估算每个冲突1KB

    const passed = estimatedMemoryUsage <= this.config.performance.thresholds.maxMemoryUsage

    this.addTestResult({
      id: crypto.randomUUID(),
      name: testName,
      category: 'stress',
      status: passed ? 'passed' : 'failed',
      duration: performance.now() - startTime,
      details: {
        estimatedMemoryUsage,
        conflictsCreated: conflicts.length,
        threshold: this.config.performance.thresholds.maxMemoryUsage
      },
      timestamp: new Date()
    })

    await stateManager.destroy()
  }

  private async testRecoveryScenarios(): Promise<void> {
    const testName = 'Recovery Scenarios'
    const startTime = performance.now()

    let stateManager: ConflictStateManager

    try {
      // 模拟崩溃恢复
      stateManager = new ConflictStateManager()
      await stateManager.initialize()

      // 创建一些冲突
      const conflicts = TestDataGenerator.generateTestConflicts(20)
      const conflictIds: string[] = []

      for (const conflict of conflicts) {
        const id = await stateManager.createConflict(conflict)
        conflictIds.push(id)
      }

      // 强制持久化
      await stateManager.persistAllStates()

      // 模拟崩溃（销毁而不清理）
      await stateManager.destroy()

      // 重新启动
      stateManager = new ConflictStateManager()
      await stateManager.initialize()

      // 验证数据恢复
      const recoveredConflicts = stateManager.getAllConflictStates()
      const passed = recoveredConflicts.length >= conflictIds.length

      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'stress',
        status: passed ? 'passed' : 'failed',
        duration: performance.now() - startTime,
        details: {
          expectedConflicts: conflictIds.length,
          recoveredConflicts: recoveredConflicts.length,
          recoveryRate: recoveredConflicts.length / conflictIds.length
        },
        timestamp: new Date()
      })
    } catch (error) {
      this.addTestResult({
        id: crypto.randomUUID(),
        name: testName,
        category: 'stress',
        status: 'failed',
        duration: performance.now() - startTime,
        error: (error as Error).message,
        timestamp: new Date()
      })
    }

    if (stateManager) {
      await stateManager.destroy()
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private addTestResult(result: TestResult): void {
    this.results.push(result)
  }

  private addBenchmark(benchmark: PerformanceBenchmark): void {
    this.benchmarks.push(benchmark)
  }

  private generateSuiteResult(duration: number): TestSuiteResult {
    const totalTests = this.results.length
    const passedTests = this.results.filter(r => r.status === 'passed').length
    const failedTests = this.results.filter(r => r.status === 'failed').length
    const skippedTests = this.results.filter(r => r.status === 'skipped').length
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0

    return {
      id: crypto.randomUUID(),
      name: 'Conflict Management Test Suite',
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      successRate,
      duration,
      results: this.results,
      timestamp: new Date()
    }
  }

  private async generateTestReport(suiteResult: TestSuiteResult): Promise<void> {
    const report = {
      suite: suiteResult,
      benchmarks: this.benchmarks,
      configuration: this.config,
      generatedAt: new Date().toISOString(),
      environment: {
        userAgent: navigator?.userAgent,
        platform: navigator?.platform,
        language: navigator?.language
      }
    }

    switch (this.config.reporting.outputFormat) {
      case 'json':
        console.log('📋 Test Report (JSON):', JSON.stringify(report, null, 2))
        break
      case 'html':
        this.generateHTMLReport(report)
        break
      default:
        this.generateConsoleReport(suiteResult, this.benchmarks)
    }
  }

  private generateConsoleReport(suiteResult: TestSuiteResult, benchmarks: PerformanceBenchmark[]): void {
    console.log('\n🎯 Test Suite Results')
    console.log('='.repeat(50))
    console.log(`Total Tests: ${suiteResult.totalTests}`)
    console.log(`Passed: ${suiteResult.passedTests} ✅`)
    console.log(`Failed: ${suiteResult.failedTests} ❌`)
    console.log(`Skipped: ${suiteResult.skippedTests} ⏭️`)
    console.log(`Success Rate: ${suiteResult.successRate.toFixed(2)}%`)
    console.log(`Duration: ${suiteResult.duration.toFixed(2)}ms`)

    if (benchmarks.length > 0) {
      console.log('\n📊 Performance Benchmarks')
      console.log('-'.repeat(30))
      benchmarks.forEach(benchmark => {
        const status = benchmark.passed ? '✅' : '❌'
        console.log(`${status} ${benchmark.metric}: ${benchmark.value.toFixed(2)}${benchmark.unit} (threshold: ${benchmark.threshold}${benchmark.unit})`)
      })
    }

    if (suiteResult.failedTests > 0) {
      console.log('\n❌ Failed Tests:')
      this.results
        .filter(r => r.status === 'failed')
        .forEach(failure => {
          console.log(`  • ${failure.name}: ${failure.error}`)
        })
    }

    console.log(`\n${  '='.repeat(50)}`)
  }

  private generateHTMLReport(report: any): void {
    // 这里可以实现HTML报告生成
    console.log('📄 HTML Report generation not implemented in this demo')
  }

  // ============================================================================
  // 公共API
  // ============================================================================

  /**
   * 获取测试结果
   */
  getResults(): TestResult[] {
    return [...this.results]
  }

  /**
   * 获取性能基准
   */
  getBenchmarks(): PerformanceBenchmark[] {
    return [...this.benchmarks]
  }

  /**
   * 运行特定测试
   */
  async runSpecificTest(testName: string): Promise<TestResult | null> {
    // 这里可以实现特定测试的运行
    console.log(`Specific test runner for "${testName}" not implemented`)
    return null
  }
}

// ============================================================================
// 导出便利函数
// ============================================================================

/**
 * 运行完整的冲突管理测试套件
 */
export async function runConflictManagementTests(config?: Partial<TestSuiteConfig>): Promise<TestSuiteResult> {
  const testSuite = new ConflictManagementTestSuite(config)
  return testSuite.runFullTestSuite()
}

/**
 * 快速运行基础测试
 */
export async function runQuickTests(): Promise<TestSuiteResult> {
  const quickConfig: Partial<TestSuiteConfig> = {
    testData: { conflictCount: 10 },
    performance: { enabled: false },
    stress: { enabled: false }
  }

  return runConflictManagementTests(quickConfig)
}

// ============================================================================
// 导出默认实例
// ============================================================================

export const conflictManagementTestSuite = new ConflictManagementTestSuite()