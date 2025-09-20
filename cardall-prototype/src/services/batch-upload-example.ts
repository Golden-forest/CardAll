// ============================================================================
// 智能批量上传使用示例和测试
// 
// 展示如何使用集成后的批量上传系统
// 包含实际的使用场景和测试用例
// ============================================================================

import { cloudSyncBatchUploadIntegration } from './cloud-sync-batch-upload-integration'
import { cloudSyncService } from './cloud-sync'
import { performanceMonitoringService } from './performance-monitoring-service'
import { networkStateDetector } from './network-state-detector'

// 使用示例类
class BatchUploadExample {
  private initialized = false

  constructor() {
    this.initialize()
  }

  // 初始化示例
  private async initialize() {
    try {
      console.log('Initializing batch upload example...')
      
      // 初始化集成服务
      await cloudSyncBatchUploadIntegration.initialize()
      
      // 设置认证服务（模拟）
      this.setupAuthService()
      
      this.initialized = true
      console.log('Batch upload example initialized successfully')
      
    } catch (error) {
      console.error('Failed to initialize batch upload example:', error)
    }
  }

  // 设置认证服务（模拟）
  private setupAuthService() {
    // 创建模拟认证服务
    const mockAuthService = {
      isAuthenticated: () => true,
      getCurrentUser: () => ({
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser'
      }),
      onAuthStateChange: (callback: Function) => {
        // 模拟认证状态变化
        callback({ user: { id: 'user-123' } })
      }
    }

    // 设置到CloudSyncService
    cloudSyncService.setAuthService(mockAuthService)
  }

  // 示例1：基本批量上传
  async example1_BasicBatchUpload() {
    if (!this.initialized) {
      console.error('Batch upload example not initialized')
      return
    }

    console.log('\\n=== 示例1：基本批量上传 ===')
    
    try {
      // 创建多个同步操作
      const operations = [
        {
          type: 'create' as const,
          table: 'cards' as const,
          data: {
            frontContent: 'What is the capital of France?',
            backContent: 'Paris',
            style: { backgroundColor: '#3b82f6', fontSize: 16 },
            folderId: 'folder-1',
            syncVersion: 1
          },
          localId: 'card-1'
        },
        {
          type: 'create' as const,
          table: 'cards' as const,
          data: {
            frontContent: 'What is 2+2?',
            backContent: '4',
            style: { backgroundColor: '#10b981', fontSize: 14 },
            folderId: 'folder-1',
            syncVersion: 1
          },
          localId: 'card-2'
        },
        {
          type: 'update' as const,
          table: 'folders' as const,
          data: {
            name: 'Mathematics',
            parentId: null,
            syncVersion: 2
          },
          localId: 'folder-1'
        }
      ]

      console.log(`Creating ${operations.length} operations...`)

      // 使用批量上传
      await cloudSyncService.queueBatchUpload(operations)

      console.log('Batch upload queued successfully')

      // 检查状态
      const status = cloudSyncService.getBatchUploadStatus()
      console.log('Batch upload status:', {
        activeSessions: status.activeSessions.length,
        totalUploads: status.stats.totalUploads,
        integrationEnabled: status.integrationEnabled
      })

    } catch (error) {
      console.error('Basic batch upload failed:', error)
    }
  }

  // 示例2：智能批量上传（自动分组和压缩）
  async example2_IntelligentBatchUpload() {
    if (!this.initialized) {
      console.error('Batch upload example not initialized')
      return
    }

    console.log('\\n=== 示例2：智能批量上传 ===')
    
    try {
      // 创建大量操作来测试智能分组
      const operations = []
      
      // 创建卡片
      for (let i = 0; i < 10; i++) {
        operations.push({
          type: 'create' as const,
          table: 'cards' as const,
          data: {
            frontContent: `Question ${i + 1}`,
            backContent: `Answer ${i + 1}`,
            style: {
              backgroundColor: `#${Math.floor(Math.random()*16777215).toString(16)}`,
              fontSize: 14 + Math.random() * 4
            },
            folderId: `folder-${Math.floor(i / 5) + 1}`,
            syncVersion: 1
          },
          localId: `card-auto-${i}`
        })
      }

      // 创建文件夹
      for (let i = 0; i < 3; i++) {
        operations.push({
          type: 'create' as const,
          table: 'folders' as const,
          data: {
            name: `Category ${i + 1}`,
            parentId: null,
            syncVersion: 1
          },
          localId: `folder-auto-${i}`
        })
      }

      // 创建标签
      for (let i = 0; i < 5; i++) {
        operations.push({
          type: 'create' as const,
          table: 'tags' as const,
          data: {
            name: `Tag ${i + 1}`,
            color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
            syncVersion: 1
          },
          localId: `tag-auto-${i}`
        })
      }

      console.log(`Created ${operations.length} operations for intelligent batching`)

      // 使用智能批量上传
      await cloudSyncService.queueBatchUpload(operations)

      // 检查批量状态
      const batchStatus = cloudSyncService.getBatchUploadStatus()
      console.log('Intelligent batch upload status:', {
        activeSessions: batchStatus.activeSessions.length,
        services: batchStatus.services,
        stats: batchStatus.stats
      })

      // 等待一段时间让上传完成
      await this.delay(5000)

      // 检查性能指标
      const performanceReport = cloudSyncBatchUploadIntegration.getPerformanceReport()
      console.log('Performance metrics:', performanceReport.stats)

    } catch (error) {
      console.error('Intelligent batch upload failed:', error)
    }
  }

  // 示例3：网络适应和错误恢复
  async example3_NetworkAdaptation() {
    if (!this.initialized) {
      console.error('Batch upload example not initialized')
      return
    }

    console.log('\\n=== 示例3：网络适应和错误恢复 ===')
    
    try {
      // 获取当前网络状态
      const networkState = networkStateDetector.getCurrentState()
      console.log('Current network state:', {
        quality: networkState.quality,
        bandwidth: networkState.downlink,
        latency: networkState.rtt,
        canSync: networkState.canSync
      })

      // 创建操作
      const operations = [
        {
          type: 'create' as const,
          table: 'cards' as const,
          data: {
            frontContent: 'Network test card',
            backContent: 'Testing network adaptation',
            style: { backgroundColor: '#f59e0b', fontSize: 16 },
            folderId: 'network-folder',
            syncVersion: 1
          },
          localId: 'network-card-1'
        },
        {
          type: 'create' as const,
          table: 'images' as const,
          data: {
            cardId: 'network-card-1',
            fileName: 'test-image.jpg',
            filePath: '/images/test.jpg',
            cloudUrl: 'https://example.com/test.jpg',
            metadata: { size: 1024, type: 'image/jpeg' },
            syncVersion: 1
          },
          localId: 'network-image-1'
        }
      ]

      console.log('Creating operations to test network adaptation...')

      // 使用批量上传
      await cloudSyncService.queueBatchUpload(operations)

      // 监控上传过程
      const startTime = Date.now()
      const maxWaitTime = 30000 // 30秒

      while (Date.now() - startTime < maxWaitTime) {
        const status = cloudSyncService.getBatchUploadStatus()
        const uploadStatus = uploadQueueManager.getUploadStatus()
        
        console.log('Upload progress:', {
          queueSize: uploadStatus.queueSize,
          activeUploads: uploadStatus.activeUploads,
          completedItems: uploadStatus.completedItems,
          networkState: networkStateDetector.getCurrentState().quality
        })

        if (uploadStatus.queueSize === 0) {
          console.log('Upload completed successfully')
          break
        }

        await this.delay(2000)
      }

      // 检查错误恢复机制
      const diagnosticResults = await cloudSyncBatchUploadIntegration.runDiagnosticTests()
      console.log('Diagnostic results:', diagnosticResults)

    } catch (error) {
      console.error('Network adaptation test failed:', error)
    }
  }

  // 示例4：性能监控和分析
  async example4_PerformanceMonitoring() {
    if (!this.initialized) {
      console.error('Batch upload example not initialized')
      return
    }

    console.log('\\n=== 示例4：性能监控和分析 ===')
    
    try {
      // 运行性能测试
      console.log('Running performance tests...')
      const testResults = await performanceMonitoringService.runPerformanceTests()
      
      console.log('Performance test results:')
      testResults.forEach((result, index) => {
        console.log(`Test ${index + 1}: ${result.success ? 'PASSED' : 'FAILED'}`)
        console.log(`  Duration: ${result.duration.toFixed(2)}ms`)
        console.log(`  Success rate: ${(result.actualResults.successRate * 100).toFixed(1)}%`)
        console.log(`  Compression ratio: ${(result.actualResults.compressionRatio * 100).toFixed(1)}%`)
        console.log(`  Network requests: ${result.actualResults.networkRequests}`)
        
        if (!result.success) {
          console.log(`  Errors: ${result.errors.length}`)
          result.errors.forEach(error => {
            console.log(`    - ${error.message}`)
          })
        }
      })

      // 获取性能趋势
      const trends = performanceMonitoringService.getPerformanceTrends(1) // 1小时
      console.log('\\nPerformance trends (last 1 hour):')
      console.log('Upload time trend:', trends.uploadTime)
      console.log('Compression ratio trend:', trends.compressionRatio)
      console.log('Success rate trend:', trends.successRate)

      // 获取当前状态
      const currentStatus = performanceMonitoringService.getCurrentPerformanceStatus()
      console.log('\\nCurrent system status:')
      console.log('Health:', currentStatus.health)
      console.log('CPU usage:', `${currentStatus.current.cpuUsage.toFixed(1)}%`)
      console.log('Memory usage:', `${currentStatus.current.memoryUsage.toFixed(1)}%`)
      console.log('Active alerts:', currentStatus.alerts.length)

      if (currentStatus.recommendations.length > 0) {
        console.log('\\nRecommendations:')
        currentStatus.recommendations.forEach(rec => {
          console.log(`  - ${rec}`)
        })
      }

    } catch (error) {
      console.error('Performance monitoring test failed:', error)
    }
  }

  // 示例5：断点续传和会话管理
  async example5_ResumableUpload() {
    if (!this.initialized) {
      console.error('Batch upload example not initialized')
      return
    }

    console.log('\\n=== 示例5：断点续传和会话管理 ===')
    
    try {
      // 创建大量数据来测试断点续传
      const operations = []
      
      for (let i = 0; i < 50; i++) {
        operations.push({
          type: 'create' as const,
          table: 'cards' as const,
          data: {
            frontContent: `Large dataset card ${i}`,
            backContent: `Answer ${i}`,
            style: {
              backgroundColor: `#${Math.floor(Math.random()*16777215).toString(16)}`,
              fontSize: 14 + Math.random() * 6
            },
            folderId: 'large-folder',
            syncVersion: 1
          },
          localId: `large-card-${i}`
        })
      }

      console.log(`Created ${operations.length} operations for resumable upload test`)

      // 启动批量上传会话
      const sessionId = await cloudSyncService.queueBatchUpload(operations)
      console.log(`Started resumable upload session: ${sessionId}`)

      // 等待一段时间后模拟中断
      await this.delay(3000)

      // 检查会话状态
      const status = cloudSyncBatchUploadIntegration.getBatchUploadStatus()
      const activeSession = status.activeSessions.find(s => s.id === sessionId)
      
      if (activeSession) {
        console.log('Active session status:', {
          status: activeSession.status,
          items: activeSession.items.length,
          progress: activeSession.performance
        })

        // 暂停会话
        console.log('Pausing session...')
        await cloudSyncBatchUploadIntegration.pauseBatchUploadSession(sessionId)

        // 等待一段时间
        await this.delay(2000)

        // 恢复会话
        console.log('Resuming session...')
        await cloudSyncBatchUploadIntegration.resumeBatchUploadSession(sessionId)

        // 等待完成
        await this.delay(10000)

        // 检查最终状态
        const finalStatus = cloudSyncBatchUploadIntegration.getBatchUploadStatus()
        console.log('Final session status:', finalStatus.stats)
      }

    } catch (error) {
      console.error('Resumable upload test failed:', error)
    }
  }

  // 示例6：配置优化和调优
  async example6_ConfigurationOptimization() {
    if (!this.initialized) {
      console.error('Batch upload example not initialized')
      return
    }

    console.log('\\n=== 示例6：配置优化和调优 ===')
    
    try {
      // 获取当前配置
      const currentConfig = cloudSyncBatchUploadIntegration.getIntegrationStatus()
      console.log('Current configuration:', currentConfig.config)

      // 测试不同配置
      const configs = [
        {
          name: 'High Performance',
          config: {
            enableIntelligentBatching: true,
            enableCompression: true,
            enableQueueManagement: true,
            enableResumableUpload: true,
            maxBatchSize: 2048, // 2MB
            maxItemsPerBatch: 100,
            compressionThreshold: 5, // 5KB
            adaptiveSizing: true
          }
        },
        {
          name: 'Network Optimized',
          config: {
            enableIntelligentBatching: true,
            enableCompression: true,
            enableQueueManagement: true,
            enableResumableUpload: true,
            maxBatchSize: 512, // 512KB
            maxItemsPerBatch: 25,
            compressionThreshold: 10, // 10KB
            adaptiveSizing: true
          }
        },
        {
          name: 'Resource Conservative',
          config: {
            enableIntelligentBatching: true,
            enableCompression: false,
            enableQueueManagement: true,
            enableResumableUpload: false,
            maxBatchSize: 256, // 256KB
            maxItemsPerBatch: 10,
            compressionThreshold: 50, // 50KB
            adaptiveSizing: false
          }
        }
      ]

      for (const testConfig of configs) {
        console.log(`\\nTesting configuration: ${testConfig.name}`)
        
        // 更新配置
        cloudSyncBatchUploadIntegration.updateConfig(testConfig.config)
        
        // 创建测试数据
        const operations = [
          {
            type: 'create' as const,
            table: 'cards' as const,
            data: {
              frontContent: `Config test card`,
              backContent: `Testing ${testConfig.name}`,
              style: { backgroundColor: '#8b5cf6', fontSize: 16 },
              folderId: 'config-folder',
              syncVersion: 1
            },
            localId: `config-card-${testConfig.name}`
          }
        ]

        // 测试上传
        const startTime = Date.now()
        await cloudSyncService.queueBatchUpload(operations)
        
        // 等待完成
        await this.delay(3000)
        
        const endTime = Date.now()
        const duration = endTime - startTime
        
        console.log(`${testConfig.name} completed in ${duration}ms`)
        
        // 获取性能指标
        const performanceReport = cloudSyncBatchUploadIntegration.getPerformanceReport()
        console.log(`Performance:`, {
          uploadTime: duration,
          compressionRatio: `${(performanceReport.stats?.compressionRatio * 100 || 0).toFixed(1)  }%`,
          networkRequests: performanceReport.stats?.networkRequests || 0
        })
      }

      // 恢复默认配置
      cloudSyncBatchUploadIntegration.updateConfig(currentConfig.config)
      console.log('\\nRestored default configuration')

    } catch (error) {
      console.error('Configuration optimization test failed:', error)
    }
  }

  // 运行所有示例
  async runAllExamples() {
    console.log('🚀 Starting all batch upload examples...')
    
    try {
      await this.example1_BasicBatchUpload()
      await this.example2_IntelligentBatchUpload()
      await this.example3_NetworkAdaptation()
      await this.example4_PerformanceMonitoring()
      await this.example5_ResumableUpload()
      await this.example6_ConfigurationOptimization()
      
      console.log('\\n✅ All examples completed successfully!')
      
    } catch (error) {
      console.error('\\n❌ Examples failed:', error)
    }
  }

  // 延迟函数
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 测试函数
export async function runBatchUploadTests() {
  console.log('🧪 Starting batch upload tests...')
  
  const example = new BatchUploadExample()
  
  try {
    // 运行所有示例作为测试
    await example.runAllExamples()
    
    // 运行额外的诊断测试
    console.log('\\n🔍 Running diagnostic tests...')
    const diagnosticResults = await cloudSyncBatchUploadIntegration.runDiagnosticTests()
    console.log('Diagnostic test results:', diagnosticResults)
    
    // 生成最终报告
    console.log('\\n📊 Generating final report...')
    const finalReport = {
      timestamp: new Date(),
      integration: cloudSyncBatchUploadIntegration.getIntegrationStatus(),
      performance: performanceMonitoringService.getCurrentPerformanceStatus(),
      network: networkStateDetector.getCurrentState(),
      diagnostics: diagnosticResults
    }
    
    console.log('📋 Final Test Report:')
    console.log(JSON.stringify(finalReport, null, 2))
    
    console.log('\\n✅ All tests completed successfully!')
    
    return finalReport
    
  } catch (error) {
    console.error('\\n❌ Tests failed:', error)
    throw error
  }
}

// 导出示例类
export { BatchUploadExample }

// 如果在浏览器环境中运行，自动初始化
if (typeof window !== 'undefined') {
  // 等待DOM加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const example = new BatchUploadExample()
      console.log('Batch upload example initialized in browser environment')
    })
  } else {
    const example = new BatchUploadExample()
    console.log('Batch upload example initialized in browser environment')
  }
}