import React from 'react'
import ReactDOM from 'react-dom/client'

function SimpleTest() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>简单连接测试</h1>
      <p>这是一个没有使用任何Context的简单页面</p>
      <div id="test-result">正在测试...</div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SimpleTest />
  </React.StrictMode>,
)