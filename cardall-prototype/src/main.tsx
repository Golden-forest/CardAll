import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { db } from './services/database-simple'
import { cloudSyncService } from './services/cloud-sync'
import { authService } from './services/auth'

// 初始化数据库和同步服务
const initializeApp = async () => {
  try {
    // 初始化数据库
    await db.open()
    console.log('✅ Database initialized')
    
    // 设置认证服务到云端同步服务
    cloudSyncService.setAuthService(authService)
    console.log('✅ Auth service connected to sync service')
    
    // 恢复同步队列
    await cloudSyncService.restoreSyncQueue()
    console.log('✅ Sync service restored')
    
    // 如果用户已登录，触发完整同步
    if (authService.isAuthenticated()) {
      console.log('🔄 User authenticated, starting full sync...')
      await cloudSyncService.performFullSync()
    }
    
    // 渲染应用
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  } catch (error) {
    console.error('❌ Failed to initialize app:', error)
    // 即使初始化失败也渲染应用，确保用户能使用
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  }
}

initializeApp()