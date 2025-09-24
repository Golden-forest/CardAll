/**
 * 控制台数据库测试脚本
 * 可以在浏览器控制台中直接运行来检查数据库状态
 */

// 这个文件可以在浏览器控制台中执行：
// copy/paste the content below into browser console

export const runDatabaseTest = async () => {
  console.log('🚀 开始数据库状态检查...')

  try {
    // 动态导入所需的模块
    const { db } = await import('../services/database')
    const { dataSyncService } = await import('../services/data-sync-service')
    const { dbStatusChecker } = await import('./db-status-checker')

    // 1. 检查数据库连接
    console.log('\n📊 1. 检查数据库连接...')
    try {
      await db.tables.toArray()
      console.log('✅ 数据库连接正常')
    } catch (error) {
      console.error('❌ 数据库连接失败:', error)
      return
    }

    // 2. 检查文件夹数据
    console.log('\n📁 2. 检查文件夹数据...')
    try {
      const allFolders = await db.folders.toArray()
      const pendingFolders = await db.folders.filter(f => f.pendingSync).toArray()

      console.log(`📊 总文件夹数: ${allFolders.length}`)
      console.log(`📊 待同步文件夹: ${pendingFolders.length}`)

      if (allFolders.length > 0) {
        console.log('📋 文件夹列表:')
        allFolders.forEach((folder, index) => {
          console.log(`  ${index + 1}. ${folder.name} (ID: ${folder.id})`)
          console.log(`     待同步: ${folder.pendingSync}`)
          console.log(`     同步版本: ${folder.syncVersion}`)
          console.log(`     更新时间: ${folder.updatedAt.toLocaleString()}`)
          console.log(`     最后同步: ${folder.lastSyncAt?.toLocaleString() || '从未同步'}`)
        })
      } else {
        console.log('📭 数据库中没有文件夹')
      }
    } catch (error) {
      console.error('❌ 检查文件夹数据失败:', error)
    }

    // 3. 检查同步服务状态
    console.log('\n🔄 3. 检查同步服务状态...')
    try {
      const syncState = dataSyncService.getCurrentState()
      console.log('📊 同步服务状态:', syncState)

      const metrics = await dataSyncService.getMetrics()
      console.log('📊 同步指标:', {
        totalSessions: metrics.totalSessions,
        successfulSessions: metrics.successfulSessions,
        failedSessions: metrics.failedSessions,
        reliability: metrics.reliability,
        lastSyncTime: metrics.lastSyncTime?.toLocaleString() || '从未同步'
      })

      const pendingOps = await db.syncQueue.count()
      console.log('📊 待同步操作数:', pendingOps)
    } catch (error) {
      console.error('❌ 检查同步服务状态失败:', error)
    }

    // 4. 检查数据库健康状态
    console.log('\n💚 4. 检查数据库健康状态...')
    try {
      const health = await db.healthCheck()
      console.log('📊 健康状态:', health.isHealthy ? '✅ 健康' : '❌ 不健康')
      if (health.issues.length > 0) {
        console.log('⚠️ 发现的问题:')
        health.issues.forEach(issue => console.log(`   - ${issue}`))
      }
    } catch (error) {
      console.error('❌ 检查数据库健康状态失败:', error)
    }

    // 5. 测试文件夹持久化
    console.log('\n🧪 5. 测试文件夹持久化...')
    try {
      const persistenceTest = await dbStatusChecker.testFolderPersistence()
      console.log('📊 持久化测试结果:', persistenceTest ? '✅ 通过' : '❌ 失败')
    } catch (error) {
      console.error('❌ 文件夹持久化测试失败:', error)
    }

    // 6. 生成完整状态报告
    console.log('\n📋 6. 生成完整状态报告...')
    try {
      const status = await dbStatusChecker.checkDatabaseStatus()
      const report = dbStatusChecker.generateDetailedReport(status)
      console.log(report)
    } catch (error) {
      console.error('❌ 生成状态报告失败:', error)
    }

    console.log('\n✅ 数据库状态检查完成!')

  } catch (error) {
    console.error('❌ 数据库测试失败:', error)
  }
}

// 手动同步测试
export const testManualSync = async () => {
  console.log('🔄 开始手动同步测试...')

  try {
    const { dataSyncService } = await import('../services/data-sync-service')

    console.log('📊 执行前的状态...')
    const beforeState = dataSyncService.getCurrentState()
    console.log('同步状态:', beforeState)

    console.log('⏳ 开始强制同步...')
    const session = await dataSyncService.forceSync()

    console.log('✅ 同步完成!')
    console.log('📊 同步结果:', {
      state: session.state,
      processed: session.processed,
      successful: session.successful,
      failed: session.failed,
      conflicts: session.conflicts,
      duration: session.duration ? `${session.duration}ms` : '未知'
    })

  } catch (error) {
    console.error('❌ 手动同步失败:', error)
  }
}

// 监听同步状态变化
export const monitorSyncStatus = () => {
  console.log('👀 开始监听同步状态变化...')

  // 监听30秒
  const timeout = setTimeout(() => {
    console.log('⏰ 监听结束')
  }, 30000)

  try {
    import('../services/data-sync-service').then(({ dataSyncService }) => {
      const unsubscribe = dataSyncService.onSyncStatusChange((session) => {
        console.log('🔄 同步状态变化:', {
          state: session.state,
          processed: session.processed,
          successful: session.successful,
          failed: session.failed,
          conflicts: session.conflicts
        })
      })

      console.log('✅ 开始监听，将在30秒后自动停止')

      // 30秒后停止监听
      setTimeout(() => {
        unsubscribe()
        clearTimeout(timeout)
        console.log('👋 监听已停止')
      }, 30000)
    })
  } catch (error) {
    console.error('❌ 监听同步状态失败:', error)
    clearTimeout(timeout)
  }
}

// 检查浏览器存储状态
export const checkBrowserStorage = () => {
  console.log('💾 检查浏览器存储状态...')

  // 检查 IndexedDB
  console.log('\n📊 IndexedDB 数据库:')
  if ('indexedDB' in window) {
    const request = indexedDB.open('CardAllUnifiedDB_v3')

    request.onsuccess = function(event) {
      const db = (event.target as IDBOpenDBRequest).result
      console.log('✅ 数据库存在，版本:', db.version)
      console.log('📋 数据表:', Array.from(db.objectStoreNames))
      db.close()
    }

    request.onerror = function(event) {
      console.error('❌ 无法打开数据库:', (event.target as IDBOpenDBRequest).error)
    }

    request.onblocked = function() {
      console.warn('⚠️ 数据库打开被阻塞')
    }
  } else {
    console.error('❌ 浏览器不支持 IndexedDB')
  }

  // 检查 LocalStorage
  console.log('\n💿 LocalStorage:')
  console.log('📊 总大小:', JSON.stringify(localStorage).length, '字符')

  const appKeys = Object.keys(localStorage).filter(key =>
    key.includes('cardall') || key.includes('supabase') || key.includes('auth')
  )

  if (appKeys.length > 0) {
    console.log('📋 应用相关数据:')
    appKeys.forEach(key => {
      const value = localStorage.getItem(key)
      console.log(`  ${key}: ${value?.substring(0, 100)}${value && value.length > 100 ? '...' : ''}`)
    })
  } else {
    console.log('📭 没有找到应用相关数据')
  }

  // 检查 SessionStorage
  console.log('\n📄 SessionStorage:')
  console.log('📊 总大小:', JSON.stringify(sessionStorage).length, '字符')

  const sessionKeys = Object.keys(sessionStorage).filter(key =>
    key.includes('cardall') || key.includes('supabase') || key.includes('auth')
  )

  if (sessionKeys.length > 0) {
    console.log('📋 会话相关数据:')
    sessionKeys.forEach(key => {
      const value = sessionStorage.getItem(key)
      console.log(`  ${key}: ${value?.substring(0, 100)}${value && value.length > 100 ? '...' : ''}`)
    })
  } else {
    console.log('📭 没有找到会话相关数据')
  }
}

// 控制台使用说明
console.log(`
📋 CardAll 数据库调试工具使用说明:

1. 完整数据库检查:
   runDatabaseTest()

2. 手动同步测试:
   testManualSync()

3. 监听同步状态 (30秒):
   monitorSyncStatus()

4. 检查浏览器存储:
   checkBrowserStorage()

直接在浏览器控制台中粘贴并运行这些函数即可。
`)