import React, { useState, useEffect } from 'react'
import {
  storageMonitorService,
  type StorageHealthStatus,
  type StorageStatistics,
  type DiagnosticReport,
  type StorageIssue,
  type StorageMetrics
} from '../services/storage-monitor'

interface StorageDiagnosticsPanelProps {
  isOpen: boolean
  onClose: () => void
}

// 健康状态颜色映射
const HealthColors = {
  excellent: 'text-green-600 bg-green-100',
  good: 'text-blue-600 bg-blue-100',
  fair: 'text-yellow-600 bg-yellow-100',
  poor: 'text-orange-600 bg-orange-100',
  critical: 'text-red-600 bg-red-100'
}

// 问题严重程度颜色映射
const SeverityColors = {
  critical: 'text-red-600 bg-red-100 border-red-200',
  high: 'text-orange-600 bg-orange-100 border-orange-200',
  medium: 'text-yellow-600 bg-yellow-100 border-yellow-200',
  low: 'text-blue-600 bg-blue-100 border-blue-200'
}

export const StorageDiagnosticsPanel: React.FC<StorageDiagnosticsPanelProps> = ({
  isOpen,
  onClose
}) => {
  const [healthStatus, setHealthStatus] = useState<StorageHealthStatus | null>(null)
  const [statistics, setStatistics] = useState<StorageStatistics | null>(null)
  const [currentMetrics, setCurrentMetrics] = useState<StorageMetrics | null>(null)
  const [issues, setIssues] = useState<StorageIssue[]>([])
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null)
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'issues' | 'diagnostics'>('overview')

  // 刷新数据
  const refreshData = async () => {
    try {
      setHealthStatus(storageMonitorService.getStorageHealth())
      setStatistics(storageMonitorService.getStatistics())
      setCurrentMetrics(storageMonitorService.getCurrentMetrics())
      setIssues(storageMonitorService.getIssues(false))
    } catch (error) {
      console.error('Failed to refresh storage diagnostics data:', error)
    }
  }

  // 运行诊断
  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true)
    try {
      const report = await storageMonitorService.runDiagnostics()
      setDiagnosticReport(report)
      // 刷新相关数据
      await refreshData()
    } catch (error) {
      console.error('Failed to run diagnostics:', error)
    } finally {
      setIsRunningDiagnostics(false)
    }
  }

  // 解决问题
  const resolveIssue = (issueId: string) => {
    if (storageMonitorService.resolveIssue(issueId)) {
      refreshData()
    }
  }

  // 导出数据
  const exportData = () => {
    try {
      const data = storageMonitorService.exportMonitoringData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cardall-storage-diagnostics-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export monitoring data:', error)
    }
  }

  // 自动刷新
  useEffect(() => {
    if (isOpen) {
      refreshData()
      const interval = setInterval(refreshData, 5000) // 每5秒刷新一次
      return () => clearInterval(interval)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className=\"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4\">
      <div className=\"bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col\">
        {/* 头部 */}
        <div className=\"p-6 border-b border-gray-200 flex justify-between items-center\">
          <div>
            <h2 className=\"text-2xl font-bold text-gray-900\">存储诊断面板</h2>
            <p className=\"text-gray-600 mt-1\">监控存储系统健康状态和性能</p>
          </div>
          <button
            onClick={onClose}
            className=\"text-gray-400 hover:text-gray-600 transition-colors\"
          >
            <svg className=\"w-6 h-6\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
              <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M6 18L18 6M6 6l12 12\" />
            </svg>
          </button>
        </div>

        {/* 标签页 */}
        <div className=\"flex border-b border-gray-200 bg-gray-50\">
          {[
            { id: 'overview', label: '概览' },
            { id: 'metrics', label: '性能指标' },
            { id: 'issues', label: '问题' },
            { id: 'diagnostics', label: '诊断报告' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div className=\"flex-1 overflow-y-auto p-6\">
          {/* 概览标签页 */}
          {activeTab === 'overview' && healthStatus && (
            <div className=\"space-y-6\">
              {/* 健康状态概览 */}
              <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4\">
                <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                  <div className=\"flex items-center justify-between\">
                    <div>
                      <p className=\"text-sm text-gray-600\">整体健康</p>
                      <p className={`text-lg font-semibold ${HealthColors[healthStatus.overall].split(' ')[0]}`}>
                        {healthStatus.overall === 'excellent' ? '优秀' :
                         healthStatus.overall === 'good' ? '良好' :
                         healthStatus.overall === 'fair' ? '一般' :
                         healthStatus.overall === 'poor' ? '较差' : '严重'}
                      </p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${HealthColors[healthStatus.overall].split(' ')[1]}`}></div>
                  </div>
                  <div className=\"mt-2\">
                    <div className=\"w-full bg-gray-200 rounded-full h-2\">
                      <div
                        className=\"bg-blue-600 h-2 rounded-full transition-all duration-300\"
                        style={{ width: `${healthStatus.score}%` }}
                      ></div>
                    </div>
                    <p className=\"text-xs text-gray-500 mt-1\">评分: {healthStatus.score.toFixed(0)}/100</p>
                  </div>
                </div>

                <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                  <div className=\"flex items-center justify-between\">
                    <div>
                      <p className=\"text-sm text-gray-600\">性能</p>
                      <p className=\"text-lg font-semibold text-blue-600\">
                        {healthStatus.performance.toFixed(0)}/100
                      </p>
                    </div>
                    <svg className=\"w-5 h-5 text-blue-600\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
                      <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M13 10V3L4 14h7v7l9-11h-7z\" />
                    </svg>
                  </div>
                </div>

                <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                  <div className=\"flex items-center justify-between\">
                    <div>
                      <p className=\"text-sm text-gray-600\">可靠性</p>
                      <p className=\"text-lg font-semibold text-green-600\">
                        {healthStatus.reliability.toFixed(0)}/100
                      </p>
                    </div>
                    <svg className=\"w-5 h-5 text-green-600\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
                      <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z\" />
                    </svg>
                  </div>
                </div>

                <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                  <div className=\"flex items-center justify-between\">
                    <div>
                      <p className=\"text-sm text-gray-600\">问题</p>
                      <p className=\"text-lg font-semibold text-red-600\">
                        {healthStatus.issues.critical + healthStatus.issues.warning}
                      </p>
                    </div>
                    <svg className=\"w-5 h-5 text-red-600\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
                      <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z\" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 统计信息 */}
              {statistics && (
                <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4\">
                  <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                    <h3 className=\"text-sm font-medium text-gray-900 mb-3\">数据统计</h3>
                    <div className=\"space-y-2\">
                      <div className=\"flex justify-between text-sm\">
                        <span className=\"text-gray-600\">卡片数量</span>
                        <span className=\"font-medium\">{statistics.totalCards}</span>
                      </div>
                      <div className=\"flex justify-between text-sm\">
                        <span className=\"text-gray-600\">文件夹数量</span>
                        <span className=\"font-medium\">{statistics.totalFolders}</span>
                      </div>
                      <div className=\"flex justify-between text-sm\">
                        <span className=\"text-gray-600\">标签数量</span>
                        <span className=\"font-medium\">{statistics.totalTags}</span>
                      </div>
                      <div className=\"flex justify-between text-sm\">
                        <span className=\"text-gray-600\">存储大小</span>
                        <span className=\"font-medium\">{(statistics.totalStorageSize / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                  </div>

                  <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                    <h3 className=\"text-sm font-medium text-gray-900 mb-3\">操作统计</h3>
                    <div className=\"space-y-2\">
                      <div className=\"flex justify-between text-sm\">
                        <span className=\"text-gray-600\">今日操作</span>
                        <span className=\"font-medium\">{statistics.operationsToday}</span>
                      </div>
                      <div className=\"flex justify-between text-sm\">
                        <span className=\"text-gray-600\">本周操作</span>
                        <span className=\"font-medium\">{statistics.operationsThisWeek}</span>
                      </div>
                      <div className=\"flex justify-between text-sm\">
                        <span className=\"text-gray-600\">平均响应时间</span>
                        <span className=\"font-medium\">{statistics.averageResponseTime.toFixed(0)}ms</span>
                      </div>
                      <div className=\"flex justify-between text-sm\">
                        <span className=\"text-gray-600\">错误趋势</span>
                        <span className={`font-medium ${
                          statistics.errorTrend === 'improving' ? 'text-green-600' :
                          statistics.errorTrend === 'declining' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {statistics.errorTrend === 'improving' ? '改善' :
                           statistics.errorTrend === 'declining' ? '恶化' : '稳定'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                    <h3 className=\"text-sm font-medium text-gray-900 mb-3\">建议</h3>
                    <div className=\"space-y-2\">
                      {healthStatus.recommendations.slice(0, 3).map((recommendation, index) => (
                        <div key={index} className=\"text-sm text-gray-600 flex items-start\">
                          <svg className=\"w-4 h-4 text-blue-600 mr-1 mt-0.5 flex-shrink-0\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
                            <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M9 5l7 7-7 7\" />
                          </svg>
                          <span>{recommendation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 性能指标标签页 */}
          {activeTab === 'metrics' && currentMetrics && (
            <div className=\"space-y-6\">
              <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
                {/* 操作性能 */}
                <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                  <h3 className=\"text-lg font-medium text-gray-900 mb-4\">操作性能</h3>
                  <div className=\"space-y-3\">
                    <div>
                      <div className=\"flex justify-between text-sm mb-1\">
                        <span className=\"text-gray-600\">平均读取时间</span>
                        <span className=\"font-medium\">{currentMetrics.averageReadTime.toFixed(0)}ms</span>
                      </div>
                      <div className=\"w-full bg-gray-200 rounded-full h-2\">
                        <div
                          className=\"bg-blue-600 h-2 rounded-full transition-all duration-300\"
                          style={{ width: `${Math.min(100, (currentMetrics.averageReadTime / 1000) * 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className=\"flex justify-between text-sm mb-1\">
                        <span className=\"text-gray-600\">平均写入时间</span>
                        <span className=\"font-medium\">{currentMetrics.averageWriteTime.toFixed(0)}ms</span>
                      </div>
                      <div className=\"w-full bg-gray-200 rounded-full h-2\">
                        <div
                          className=\"bg-green-600 h-2 rounded-full transition-all duration-300\"
                          style={{ width: `${Math.min(100, (currentMetrics.averageWriteTime / 2000) * 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className=\"flex justify-between text-sm mb-1\">
                        <span className=\"text-gray-600\">平均删除时间</span>
                        <span className=\"font-medium\">{currentMetrics.averageDeleteTime.toFixed(0)}ms</span>
                      </div>
                      <div className=\"w-full bg-gray-200 rounded-full h-2\">
                        <div
                          className=\"bg-purple-600 h-2 rounded-full transition-all duration-300\"
                          style={{ width: `${Math.min(100, (currentMetrics.averageDeleteTime / 1000) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 存储使用 */}
                <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                  <h3 className=\"text-lg font-medium text-gray-900 mb-4\">存储使用</h3>
                  <div className=\"space-y-3\">
                    <div>
                      <div className=\"flex justify-between text-sm mb-1\">
                        <span className=\"text-gray-600\">存储利用率</span>
                        <span className=\"font-medium\">{(currentMetrics.storageUtilization * 100).toFixed(1)}%</span>
                      </div>
                      <div className=\"w-full bg-gray-200 rounded-full h-2\">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            currentMetrics.storageUtilization > 0.8 ? 'bg-red-600' :
                            currentMetrics.storageUtilization > 0.6 ? 'bg-yellow-600' : 'bg-green-600'
                          }`}
                          style={{ width: `${currentMetrics.storageUtilization * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className=\"flex justify-between text-sm mb-1\">
                        <span className=\"text-gray-600\">压缩率</span>
                        <span className=\"font-medium\">{(currentMetrics.compressionRatio * 100).toFixed(1)}%</span>
                      </div>
                      <div className=\"w-full bg-gray-200 rounded-full h-2\">
                        <div
                          className=\"bg-indigo-600 h-2 rounded-full transition-all duration-300\"
                          style={{ width: `${currentMetrics.compressionRatio * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className=\"grid grid-cols-2 gap-4 mt-4\">
                      <div className=\"text-center\">
                        <p className=\"text-2xl font-bold text-blue-600\">
                          {(currentMetrics.localStorageSize / 1024).toFixed(1)}
                        </p>
                        <p className=\"text-sm text-gray-600\">Local Storage (KB)</p>
                      </div>
                      <div className=\"text-center\">
                        <p className=\"text-2xl font-bold text-green-600\">
                          {(currentMetrics.indexedDBUsage / 1024).toFixed(1)}
                        </p>
                        <p className=\"text-sm text-gray-600\">IndexedDB (KB)</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 错误和可靠性 */}
                <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                  <h3 className=\"text-lg font-medium text-gray-900 mb-4\">可靠性</h3>
                  <div className=\"space-y-3\">
                    <div>
                      <div className=\"flex justify-between text-sm mb-1\">
                        <span className=\"text-gray-600\">成功率</span>
                        <span className=\"font-medium\">{(currentMetrics.successRate * 100).toFixed(1)}%</span>
                      </div>
                      <div className=\"w-full bg-gray-200 rounded-full h-2\">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            currentMetrics.successRate > 0.95 ? 'bg-green-600' :
                            currentMetrics.successRate > 0.9 ? 'bg-yellow-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${currentMetrics.successRate * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className=\"flex justify-between text-sm mb-1\">
                        <span className=\"text-gray-600\">错误率</span>
                        <span className=\"font-medium\">{(currentMetrics.errorRate * 100).toFixed(1)}%</span>
                      </div>
                      <div className=\"w-full bg-gray-200 rounded-full h-2\">
                        <div
                          className=\"bg-red-600 h-2 rounded-full transition-all duration-300\"
                          style={{ width: `${currentMetrics.errorRate * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className=\"grid grid-cols-3 gap-4 mt-4 text-center\">
                      <div>
                        <p className=\"text-lg font-bold text-blue-600\">{currentMetrics.errorCount}</p>
                        <p className=\"text-sm text-gray-600\">错误次数</p>
                      </div>
                      <div>
                        <p className=\"text-lg font-bold text-yellow-600\">{currentMetrics.retryCount}</p>
                        <p className=\"text-sm text-gray-600\">重试次数</p>
                      </div>
                      <div>
                        <p className=\"text-lg font-bold text-green-600\">{currentMetrics.queueSize}</p>
                        <p className=\"text-sm text-gray-600\">队列大小</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 同步状态 */}
                <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                  <h3 className=\"text-lg font-medium text-gray-900 mb-4\">同步状态</h3>
                  <div className=\"space-y-3\">
                    <div>
                      <div className=\"flex justify-between text-sm mb-1\">
                        <span className=\"text-gray-600\">同步成功率</span>
                        <span className=\"font-medium\">{(currentMetrics.syncSuccessRate * 100).toFixed(1)}%</span>
                      </div>
                      <div className=\"w-full bg-gray-200 rounded-full h-2\">
                        <div
                          className=\"bg-teal-600 h-2 rounded-full transition-all duration-300\"
                          style={{ width: `${currentMetrics.syncSuccessRate * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className=\"grid grid-cols-2 gap-4 mt-4 text-center\">
                      <div>
                        <p className=\"text-lg font-bold text-blue-600\">{currentMetrics.syncOperations}</p>
                        <p className=\"text-sm text-gray-600\">同步操作</p>
                      </div>
                      <div>
                        <p className=\"text-lg font-bold text-red-600\">{currentMetrics.syncFailures}</p>
                        <p className=\"text-sm text-gray-600\">同步失败</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 问题标签页 */}
          {activeTab === 'issues' && (
            <div className=\"space-y-4\">
              <div className=\"flex justify-between items-center\">
                <h3 className=\"text-lg font-medium text-gray-900\">存储问题</h3>
                <span className=\"text-sm text-gray-600\">
                  {issues.filter(i => !i.resolved).length} 个未解决问题
                </span>
              </div>

              {issues.filter(i => !i.resolved).length === 0 ? (
                <div className=\"text-center py-8\">
                  <svg className=\"w-16 h-16 text-green-600 mx-auto mb-4\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
                    <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z\" />
                  </svg>
                  <p className=\"text-gray-600\">暂无存储问题</p>
                </div>
              ) : (
                <div className=\"space-y-3\">
                  {issues.filter(i => !i.resolved).map(issue => (
                    <div key={issue.id} className={`border rounded-lg p-4 ${SeverityColors[issue.severity]}`}>
                      <div className=\"flex justify-between items-start mb-2\">
                        <h4 className=\"font-medium text-gray-900\">{issue.title}</h4>
                        <div className=\"flex items-center space-x-2\">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                            issue.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                            issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {issue.severity === 'critical' ? '严重' :
                             issue.severity === 'high' ? '高' :
                             issue.severity === 'medium' ? '中等' : '低'}
                          </span>
                          <button
                            onClick={() => resolveIssue(issue.id)}
                            className=\"text-xs text-blue-600 hover:text-blue-800\"
                          >
                            解决
                          </button>
                        </div>
                      </div>
                      <p className=\"text-sm text-gray-600 mb-3\">{issue.description}</p>

                      {issue.suggestions.length > 0 && (
                        <div className=\"mb-3\">
                          <p className=\"text-xs text-gray-500 mb-1\">建议解决方案：</p>
                          <ul className=\"text-xs text-gray-600 space-y-1\">
                            {issue.suggestions.map((suggestion, index) => (
                              <li key={index} className=\"flex items-start\">
                                <svg className=\"w-3 h-3 text-blue-600 mr-1 mt-0.5 flex-shrink-0\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
                                  <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M9 5l7 7-7 7\" />
                                </svg>
                                <span>{suggestion}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className=\"flex justify-between items-center text-xs text-gray-500\">
                        <span>{new Date(issue.timestamp).toLocaleString('zh-CN')}</span>
                        <span className=\"capitalize\">{issue.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 诊断报告标签页 */}
          {activeTab === 'diagnostics' && (
            <div className=\"space-y-6\">
              <div className=\"flex justify-between items-center\">
                <h3 className=\"text-lg font-medium text-gray-900\">诊断报告</h3>
                <div className=\"flex space-x-2\">
                  <button
                    onClick={runDiagnostics}
                    disabled={isRunningDiagnostics}
                    className=\"px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed\"
                  >
                    {isRunningDiagnostics ? '运行中...' : '运行诊断'}
                  </button>
                  <button
                    onClick={exportData}
                    className=\"px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700\"
                  >
                    导出数据
                  </button>
                </div>
              </div>

              {diagnosticReport ? (
                <div className=\"space-y-6\">
                  {/* 报告摘要 */}
                  <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                    <h4 className=\"font-medium text-gray-900 mb-3\">诊断摘要</h4>
                    <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
                      <div className=\"text-center\">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          diagnosticReport.summary.overallHealth === 'excellent' ? 'bg-green-100 text-green-800' :
                          diagnosticReport.summary.overallHealth === 'good' ? 'bg-blue-100 text-blue-800' :
                          diagnosticReport.summary.overallHealth === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                          diagnosticReport.summary.overallHealth === 'poor' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {diagnosticReport.summary.overallHealth === 'excellent' ? '优秀' :
                           diagnosticReport.summary.overallHealth === 'good' ? '良好' :
                           diagnosticReport.summary.overallHealth === 'fair' ? '一般' :
                           diagnosticReport.summary.overallHealth === 'poor' ? '较差' : '严重'}
                        </div>
                        <p className=\"text-xs text-gray-500 mt-1\">整体健康</p>
                      </div>
                      <div className=\"text-center\">
                        <p className=\"text-lg font-bold text-red-600\">{diagnosticReport.summary.criticalIssues}</p>
                        <p className=\"text-xs text-gray-500\">严重问题</p>
                      </div>
                      <div className=\"text-center\">
                        <p className=\"text-lg font-bold text-orange-600\">{diagnosticReport.summary.totalIssues}</p>
                        <p className=\"text-xs text-gray-500\">总问题数</p>
                      </div>
                    </div>
                  </div>

                  {/* 分析结果 */}
                  <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">
                    <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                      <h4 className=\"font-medium text-gray-900 mb-3\">性能分析</h4>
                      <div className=\"space-y-2\">
                        <div className=\"flex justify-between text-sm\">
                          <span className=\"text-gray-600\">总体评分</span>
                          <span className=\"font-medium\">{diagnosticReport.analysis.performance.overallScore.toFixed(0)}/100</span>
                        </div>
                        <div className=\"text-xs text-gray-500\">
                          优势: {diagnosticReport.analysis.performance.strengths.join(', ') || '无'}
                        </div>
                        <div className=\"text-xs text-red-600\">
                          瓶颈: {diagnosticReport.analysis.performance.bottlenecks.join(', ') || '无'}
                        </div>
                      </div>
                    </div>

                    <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                      <h4 className=\"font-medium text-gray-900 mb-3\">可靠性分析</h4>
                      <div className=\"space-y-2\">
                        <div className=\"flex justify-between text-sm\">
                          <span className=\"text-gray-600\">成功率</span>
                          <span className=\"font-medium\">{(diagnosticReport.analysis.reliability.successRate * 100).toFixed(1)}%</span>
                        </div>
                        <div className=\"flex justify-between text-sm\">
                          <span className=\"text-gray-600\">错误率</span>
                          <span className=\"font-medium\">{(diagnosticReport.analysis.reliability.errorRate * 100).toFixed(1)}%</span>
                        </div>
                        <div className=\"text-xs text-gray-500\">
                          常见失败: {diagnosticReport.analysis.reliability.commonFailures.join(', ')}
                        </div>
                      </div>
                    </div>

                    <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                      <h4 className=\"font-medium text-gray-900 mb-3\">可用性分析</h4>
                      <div className=\"space-y-2\">
                        <div className=\"flex justify-between text-sm\">
                          <span className=\"text-gray-600\">可用性评分</span>
                          <span className=\"font-medium\">{diagnosticReport.analysis.availability.overallScore.toFixed(0)}/100</span>
                        </div>
                        <div className=\"flex justify-between text-sm\">
                          <span className=\"text-gray-600\">正常运行时间</span>
                          <span className=\"font-medium\">{(diagnosticReport.analysis.availability.uptime * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                      <h4 className=\"font-medium text-gray-900 mb-3\">效率分析</h4>
                      <div className=\"space-y-2\">
                        <div className=\"flex justify-between text-sm\">
                          <span className=\"text-gray-600\">总体效率</span>
                          <span className=\"font-medium\">{diagnosticReport.analysis.efficiency.overallScore.toFixed(0)}/100</span>
                        </div>
                        <div className=\"flex justify-between text-sm\">
                          <span className=\"text-gray-600\">压缩效率</span>
                          <span className=\"font-medium\">{(diagnosticReport.analysis.efficiency.compressionEfficiency * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 建议 */}
                  {diagnosticReport.recommendations.length > 0 && (
                    <div className=\"bg-white border border-gray-200 rounded-lg p-4\">
                      <h4 className=\"font-medium text-gray-900 mb-3\">优化建议</h4>
                      <div className=\"space-y-3\">
                        {diagnosticReport.recommendations.map(recommendation => (
                          <div key={recommendation.id} className=\"border-l-4 border-blue-500 pl-4 py-2\">
                            <div className=\"flex items-center justify-between mb-1\">
                              <h5 className=\"font-medium text-gray-900 text-sm\">{recommendation.title}</h5>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                recommendation.priority === 'high' ? 'bg-red-100 text-red-800' :
                                recommendation.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {recommendation.priority === 'high' ? '高优先级' :
                                 recommendation.priority === 'medium' ? '中优先级' : '低优先级'}
                              </span>
                            </div>
                            <p className=\"text-sm text-gray-600 mb-2\">{recommendation.description}</p>
                            <p className=\"text-xs text-gray-500\">预期效果: {recommendation.expectedOutcome}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 报告信息 */}
                  <div className=\"text-xs text-gray-500 text-center\">
                    报告生成时间: {new Date(diagnosticReport.timestamp).toLocaleString('zh-CN')} |
                    耗时: {diagnosticReport.duration}ms
                  </div>
                </div>
              ) : (
                <div className=\"text-center py-8\">
                  <svg className=\"w-16 h-16 text-gray-400 mx-auto mb-4\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
                    <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z\" />
                  </svg>
                  <p className=\"text-gray-600 mb-4\">暂无诊断报告</p>
                  <button
                    onClick={runDiagnostics}
                    disabled={isRunningDiagnostics}
                    className=\"px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed\"
                  >
                    {isRunningDiagnostics ? '运行中...' : '运行诊断'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className=\"border-t border-gray-200 p-4 bg-gray-50\">
          <div className=\"flex justify-between items-center\">
            <button
              onClick={refreshData}
              className=\"px-3 py-2 text-sm text-gray-600 hover:text-gray-800\"
            >
              刷新数据
            </button>
            <div className=\"flex space-x-2\">
              <button
                onClick={exportData}
                className=\"px-3 py-2 text-sm text-gray-600 hover:text-gray-800\"
              >
                导出监控数据
              </button>
              <button
                onClick={onClose}
                className=\"px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700\"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StorageDiagnosticsPanel