import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AppInitialization } from './components/app-initialization'
import { InitializationResult } from './services/app-init'

// 开发环境下引入配置测试
if (import.meta.env.DEV) {
  import('./utils/config-test').then(module => {
    console.log('🔧 配置测试模块已加载');
  }).catch(error => {
    console.error('❌ 配置测试模块加载失败:', error);
  });
}

function AppRoot() {
  const [initializationState, setInitializationState] = useState<{
    isInitialized: boolean
    hasError: boolean
    error?: string
    canSkip: boolean
  }>({
    isInitialized: false,
    hasError: false,
    canSkip: false
  })

  const handleInitializationComplete = (result: InitializationResult) => {
    console.log('应用初始化完成:', result)
    setInitializationState({
      isInitialized: true,
      hasError: false,
      canSkip: false
    })
  }

  const handleInitializationError = (error: string) => {
    console.error('应用初始化失败:', error)
    setInitializationState(prev => ({
      ...prev,
      hasError: true,
      error,
      canSkip: true // 允许用户跳过初始化，使用降级模式
    }))
  }

  const handleSkipInitialization = () => {
    console.warn('用户选择跳过初始化，应用将以降级模式运行')
    setInitializationState({
      isInitialized: true,
      hasError: true,
      canSkip: false,
      error: '应用以降级模式运行，某些功能可能不可用'
    })
  }

  // 如果未初始化或有错误且不能跳过，显示初始化界面
  if (!initializationState.isInitialized || (initializationState.hasError && !initializationState.canSkip)) {
    return (
      <AppInitialization
        onInitialized={handleInitializationComplete}
        onError={handleInitializationError}
        onSkipInitialization={initializationState.canSkip ? handleSkipInitialization : undefined}
      />
    )
  }

  // 如果有错误但已跳过，传递错误状态到App组件
  if (initializationState.hasError) {
    return <App initializationError={initializationState.error} />
  }

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
)