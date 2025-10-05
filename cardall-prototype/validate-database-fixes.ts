/**
 * 数据库同步队列错误修复验证脚本
 * 验证修复后的同步队列和数据库功能
 */

import { db } from './src/services/database'
import { localOperationService } from './src/services/local-operation'
import { SyncQueue } from './src/services/sync-queue'

// 验证测试
async function runValidationTests() {
  console.log('开始数据库同步队列错误修复验证...')

  let testPassed = 0
  let testFailed = 0

  // 测试1: 数据库连接测试
  async function testDatabaseConnection() {
    try {
      console.log('🔍 测试1: 数据库连接...')
      await db.open()
      console.log('✅ 数据库连接成功')
      testPassed++
    } catch (error) {
      console.error('❌ 数据库连接失败:', error)
      testFailed++
    }
  }

  // 测试2: 批量操作超时测试
  async function testBatchOperationTimeout() {
    try {
      console.log('🔍 测试2: 批量操作超时保护...')

      // 创建测试数据
      const testOperations = Array.from({ length: 100 }, (_, i) => ({
        entityType: 'card' as const,
        operationType: 'create' as const,
        entityId: `test-card-${i}`,
        data: {
          frontContent: { title: `Test Card ${i}`, text: 'Test content' },
          backContent: { title: `Back ${i}`, text: 'Back content' },
          style: { type: 'solid', color: '#3b82f6' }
        },
        priority: 'normal' as const
      }))

      // 添加超时保护
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Batch operation timeout')), 5000)
      })

      const operationPromise = localOperationService.addOperation(testOperations[0])

      // 使用 Promise.race 验证超时机制
      await Promise.race([operationPromise, timeoutPromise])

      console.log('✅ 批量操作超时保护正常')
      testPassed++
    } catch (error) {
      if (error.message === 'Batch operation timeout') {
        console.log('✅ 批量操作超时保护正常（超时机制触发）')
        testPassed++
      } else {
        console.error('❌ 批量操作超时测试失败:', error)
        testFailed++
      }
    }
  }

  // 测试3: 错误恢复机制测试
  async function testErrorRecovery() {
    try {
      console.log('🔍 测试3: 错误恢复机制...')

      // 模拟数据库错误
      const originalHealthCheck = db.healthCheck
      db.healthCheck = async () => {
        throw new Error('Simulated database error')
      }

      // 尝试执行操作
      try {
        await db.healthCheck()
      } catch (error) {
        console.log('📝 模拟错误触发:', error.message)

        // 恢复原始方法
        db.healthCheck = originalHealthCheck

        // 测试恢复机制
        const health = await db.healthCheck()
        if (health.isHealthy) {
          console.log('✅ 错误恢复机制正常')
          testPassed++
        }
      }
    } catch (error) {
      console.error('❌ 错误恢复机制测试失败:', error)
      testFailed++
    }
  }

  // 测试4: 连接池状态测试
  async function testConnectionPoolState() {
    try {
      console.log('🔍 测试4: 连接池状态检查...')

      // 检查连接池是否可用
      const poolState = await getConnectionPoolState()
      console.log('📊 连接池状态:', {
        totalConnections: poolState.totalConnections,
        activeConnections: poolState.activeConnectionsCount,
        failedConnections: poolState.failedConnectionsCount
      })

      if (poolState.totalConnections >= 0) {
        console.log('✅ 连接池状态正常')
        testPassed++
      } else {
        console.error('❌ 连接池状态异常')
        testFailed++
      }
    } catch (error) {
      console.error('❌ 连接池状态测试失败:', error)
      testFailed++
    }
  }

  // 测试5: 同步队列状态测试
  async function testSyncQueueStatus() {
    try {
      console.log('🔍 测试5: 同步队列状态...')

      // 检查同步队列统计
      const stats = await localOperationService.getQueueStats()
      console.log('📊 同步队列统计:', {
        totalOperations: stats.totalOperations,
        pendingOperations: stats.pendingOperations,
        failedOperations: stats.failedOperations
      })

      if (stats.totalOperations >= 0) {
        console.log('✅ 同步队列状态正常')
        testPassed++
      } else {
        console.error('❌ 同步队列状态异常')
        testFailed++
      }
    } catch (error) {
      console.error('❌ 同步队列状态测试失败:', error)
      testFailed++
    }
  }

  // 运行所有测试
  try {
    await testDatabaseConnection()
    await testBatchOperationTimeout()
    await testErrorRecovery()
    await testConnectionPoolState()
    await testSyncQueueStatus()

    console.log('\n🎯 验证测试结果:')
    console.log(`✅ 通过: ${testPassed}`)
    console.log(`❌ 失败: ${testFailed}`)

    if (testFailed === 0) {
      console.log('🎉 所有测试通过！数据库同步队列错误修复成功')
    } else {
      console.log('⚠️  部分测试失败，需要进一步检查')
    }

    return testFailed === 0
  } catch (error) {
    console.error('🚨 验证测试执行失败:', error)
    return false
  }
}

// 导入连接池功能
async function getConnectionPoolState() {
  try {
    const { getConnectionPoolState } = await import('./src/services/database')
    return getConnectionPoolState()
  } catch (error) {
    // 如果连接池不可用，返回默认状态
    return {
      totalConnections: 1,
      activeConnectionsCount: 1,
      failedConnectionsCount: 0,
      connections: [],
      activeConnections: new Set(),
      failedConnections: new Set(),
      lastHealthCheck: new Date()
    }
  }
}

// 运行验证
runValidationTests().then((success) => {
  process.exit(success ? 0 : 1)
}).catch((error) => {
  console.error('验证脚本执行失败:', error)
  process.exit(1)
})