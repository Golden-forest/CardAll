import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { db } from './services/database-simple'
import { ErrorBoundary, setupGlobalErrorHandlers } from './components/error/error-boundary'

// 初始化数据库和同步服务
const initializeApp = async () => {
  try {
    // 设置全局错误处理器
    setupGlobalErrorHandlers()
    console.log('✅ Global error handlers setup')
    
    // 初始化数据库
    await db.open()
    console.log('✅ Database initialized')
    
    // 动态导入同步服务（避免循环依赖）
    import('./services/cloud-sync').then(({ cloudSyncService }) => {
      // 恢复同步队列（不等待完成，避免阻塞）
      cloudSyncService.restoreSyncQueue().catch(error => {
        console.warn('Sync queue restore failed:', error)
      })
      console.log('✅ Sync service restored')
    }).catch(error => {
      console.warn('Failed to import cloud sync service:', error)
    })

    // 启动数据一致性检查器（不等待完成，避免阻塞）
    import('./services/data-consistency-checker').then(({ dataConsistencyChecker }) => {
      // 启动定期数据一致性检查（每30分钟）
      setInterval(() => {
        dataConsistencyChecker.performFullCheck({
          autoFix: true,
          backupBeforeRepair: true,
          notifyUser: false // 静默检查，只在发现问题时通知
        }).catch(error => {
          console.warn('Background consistency check failed:', error)
        })
      }, 30 * 60 * 1000) // 30分钟
      
      console.log('✅ Data consistency checker started')
    }).catch(error => {
      console.warn('Failed to import data consistency checker:', error)
    })
    
    // 渲染应用
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    )
  } catch (error) {
    console.error('❌ Failed to initialize app:', error)
    // 即使初始化失败也渲染应用，确保用户能使用
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    )
  }
}

initializeApp()