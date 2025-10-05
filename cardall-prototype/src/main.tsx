import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { appInitService } from './services/app-init'
// import { SyncDebugUtils } from './services/sync-debug-utils' // 已删除调试工具

function AppRoot() {
  // 在后台执行轻量级初始化，不阻塞界面显示
  useEffect(() => {
    const performBackgroundInit = async () => {
      try {
        console.log('执行后台服务初始化...')
        await appInitService.initializeServices()
        console.log('后台服务初始化完成')
      } catch (error) {
        console.warn('后台初始化出现警告，但不影响应用使用:', error)
      }
    }

    // 异步执行初始化，不等待
    performBackgroundInit()
  }, [])

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
)

// 开发环境下暴露调试接口
if (process.env.NODE_ENV === 'development') {
  // 调试工具已移除，保留接口以防万一
  console.log('CardAll Debug: sync-debug-utils 工具已移除')

  console.log(`
🛠️  CardAll Debug Interface:
   - 调试工具已简化，请使用浏览器开发者工具进行调试
   - 保留了核心同步功能，移除了冗余的调试接口
  `)
}