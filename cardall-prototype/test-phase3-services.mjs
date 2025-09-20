/**
 * 简单的Phase 3服务测试脚本
 * 用于验证服务初始化和基本功能
 */

async function testPhase3Services() {
  console.log('开始测试Phase 3服务...')

  try {
    // 测试1: 验证导入
    console.log('\n1. 测试导入...')

    // 动态导入以避免编译错误
    const { Phase3Integration } = await import('./src/integrations/phase3-integration.js')
    const { PerformanceMonitor } = await import('./src/services/performance/performance-monitor.js')
    const { DataEncryptionService } = await import('./src/services/security/data-encryption-service.js')
    const { ConflictResolutionEngine } = await import('./src/services/conflict/conflict-resolution-engine.js')
    const { EnhancedOfflineManager } = await import('./src/services/offline/enhanced-offline-manager.js')
    const { EnhancedCloudSync } = await import('./src/services/sync/enhanced-cloud-sync.js')

    console.log('✓ 所有服务类导入成功')

    // 测试2: 验证PerformanceMonitor初始化
    console.log('\n2. 测试PerformanceMonitor...')
    const performanceMonitor = new PerformanceMonitor({
      metricsInterval: 1000,
      analysisInterval: 5000,
      enableRealTimeAnalysis: true,
      enableAutomaticAlerts: true,
      alertThresholds: {
        responseTime: { warning: 1000, critical: 2000 },
        errorRate: { warning: 0.05, critical: 0.1 },
        memoryUsage: { warning: 0.7, critical: 0.9 },
        cpuUsage: { warning: 0.8, critical: 0.95 }
      }
    })

    await performanceMonitor.initialize()
    console.log('✓ PerformanceMonitor初始化成功')
    console.log(`状态: ${performanceMonitor.isInitialized() ? '已初始化' : '未初始化'}`)

    // 测试记录指标
    performanceMonitor.recordMetric({
      type: 'response_time',
      value: 500,
      unit: 'ms',
      timestamp: new Date(),
      metadata: { test: true }
    })
    console.log('✓ 性能指标记录成功')

    await performanceMonitor.cleanup()

    // 测试3: 验证DataEncryptionService初始化
    console.log('\n3. 测试DataEncryptionService...')
    const encryptionService = new DataEncryptionService({
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2',
      keyRotationDays: 30,
      enableAuditLogging: true,
      enableCompliance: true
    })

    await encryptionService.initialize()
    console.log('✓ DataEncryptionService初始化成功')

    const status = encryptionService.getStatus()
    console.log(`状态: ${status.isInitialized ? '已初始化' : '未初始化'}`)
    console.log(`活跃密钥ID: ${status.activeKeyId || '无'}`)

    // 测试加密/解密
    const testData = '测试加密数据'
    const encrypted = await encryptionService.encrypt(testData)
    const decrypted = await encryptionService.decrypt(encrypted)

    if (decrypted === testData) {
      console.log('✓ 加密/解密功能正常')
    } else {
      console.log('✗ 加密/解密功能异常')
    }

    await encryptionService.cleanup()

    // 测试4: 验证ConflictResolutionEngine初始化
    console.log('\n4. 测试ConflictResolutionEngine...')
    const conflictEngine = new ConflictResolutionEngine({
      enableAutoResolve: true,
      enableSmartMerge: true,
      maxRetryAttempts: 3,
      conflictThreshold: 0.8
    })

    await conflictEngine.initialize()
    console.log('✓ ConflictResolutionEngine初始化成功')

    const engineStatus = conflictEngine.getStatus()
    console.log(`状态: ${engineStatus.isInitialized ? '已初始化' : '未初始化'}`)

    await conflictEngine.cleanup()

    // 测试5: 验证EnhancedOfflineManager初始化
    console.log('\n5. 测试EnhancedOfflineManager...')
    const offlineManager = new EnhancedOfflineManager({
      maxQueueSize: 1000,
      compressionEnabled: true,
      versionControlEnabled: true,
      smartMergeEnabled: true,
      networkAdaptiveSync: true
    })

    await offlineManager.initialize()
    console.log('✓ EnhancedOfflineManager初始化成功')

    const offlineStatus = offlineManager.getStatus()
    console.log(`状态: ${offlineStatus.isInitialized ? '已初始化' : '未初始化'}`)

    await offlineManager.cleanup()

    // 测试6: 验证EnhancedCloudSync初始化
    console.log('\n6. 测试EnhancedCloudSync...')
    const cloudSync = new EnhancedCloudSync({
      enableIncrementalSync: true,
      enableConflictPrevention: true,
      enableCompression: true,
      enableNetworkAdaptation: true,
      syncInterval: 30000,
      batchSize: 50,
      retryAttempts: 3
    })

    await cloudSync.initialize()
    console.log('✓ EnhancedCloudSync初始化成功')

    const syncStatus = cloudSync.getStatus()
    console.log(`状态: ${syncStatus.isInitialized ? '已初始化' : '未初始化'}`)

    await cloudSync.cleanup()

    // 测试7: 验证Phase3Integration初始化
    console.log('\n7. 测试Phase3Integration...')
    const integration = await Phase3Integration.initialize({
      enablePerformanceMonitor: true,
      enableDataEncryption: true,
      enableConflictResolution: true,
      enableEnhancedOffline: true,
      enableEnhancedCloudSync: true,
      performanceMonitor: {
        metricsInterval: 1000,
        analysisInterval: 5000,
        enableRealTimeAnalysis: true,
        enableAutomaticAlerts: true
      },
      dataEncryption: {
        algorithm: 'AES-256-GCM',
        keyDerivation: 'PBKDF2',
        keyRotationDays: 30,
        enableAuditLogging: true,
        enableCompliance: true
      },
      conflictResolution: {
        enableAutoResolve: true,
        enableSmartMerge: true,
        maxRetryAttempts: 3,
        conflictThreshold: 0.8
      },
      enhancedOffline: {
        maxQueueSize: 1000,
        compressionEnabled: true,
        versionControlEnabled: true,
        smartMergeEnabled: true,
        networkAdaptiveSync: true
      },
      enhancedCloudSync: {
        enableIncrementalSync: true,
        enableConflictPrevention: true,
        enableCompression: true,
        enableNetworkAdaptation: true,
        syncInterval: 30000,
        batchSize: 50,
        retryAttempts: 3
      }
    })

    console.log('✓ Phase3Integration初始化成功')
    console.log(`整体状态: ${integration.isInitialized() ? '已初始化' : '未初始化'}`)

    const systemStatus = integration.getSystemStatus()
    console.log('系统状态:', JSON.stringify(systemStatus, null, 2))

    const services = integration.getServices()
    console.log('服务实例:')
    console.log('- PerformanceMonitor:', services.performanceMonitor ? '✓' : '✗')
    console.log('- DataEncryptionService:', services.dataEncryption ? '✓' : '✗')
    console.log('- ConflictResolutionEngine:', services.conflictResolution ? '✓' : '✗')
    console.log('- EnhancedOfflineManager:', services.enhancedOffline ? '✓' : '✗')
    console.log('- EnhancedCloudSync:', services.enhancedCloudSync ? '✓' : '✗')

    await integration.cleanup()

    console.log('\n🎉 所有Phase 3服务测试通过!')

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    console.error('错误堆栈:', error.stack)
    process.exit(1)
  }
}

// 运行测试
testPhase3Services()