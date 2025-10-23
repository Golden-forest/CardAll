import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

// 开发环境下引入配置测试
if (import.meta.env.DEV) {
  import('./utils/config-test').then(module => {
    console.log('🔧 配置测试模块已加载');
  }).catch(error => {
    console.error('❌ 配置测试模块加载失败:', error);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)