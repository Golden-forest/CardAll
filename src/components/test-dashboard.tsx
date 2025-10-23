import React, { useState } from 'react'
import { Dashboard } from './dashboard'
import { DatabaseTest } from './database-test'
import { Button } from './ui/button'
import { Database, Home } from 'lucide-react'

export function TestDashboard() {
  const [showTest, setShowTest] = useState(false)

  return (
    <div>
      {/* 测试切换按钮 */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          onClick={() => setShowTest(!showTest)}
          variant="outline"
          size="sm"
          className="bg-white shadow-lg"
        >
          {showTest ? (
            <>
              <Home className="h-4 w-4 mr-2" />
              返回主页
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              数据库测试
            </>
          )}
        </Button>
      </div>

      {/* 内容区域 */}
      {showTest ? <DatabaseTest /> : <Dashboard />}
    </div>
  )
}