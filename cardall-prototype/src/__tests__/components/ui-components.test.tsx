/**
 * UI组件测试
 *
 * 测试用户界面组件的功能和交互
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SyncStatusDisplay } from '@/components/sync/sync-status-display'
import { SyncStatusIndicator } from '@/components/sync/sync-status-indicator'
import { PerformanceMonitorPanel } from '@/components/performance/performance-monitor-panel'

// Mock 依赖服务
vi.mock('../../services/unified-sync-service', () => ({
  unifiedSyncService: {
    getStatus: vi.fn(),
    getConflicts: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    sync: vi.fn()
  }
}))

vi.mock('../../services/ui/performance-monitor', () => ({
  performanceMonitor: {
    getRealtimeMetrics: vi.fn(),
    getAlerts: vi.fn(),
    generateReport: vi.fn(),
    clearMetrics: vi.fn()
  }
}))

// Mock变量声明
let mockUnifiedSyncService: any
let mockPerformanceMonitor: any

describe('UI Components', () => {
  const mockSyncStatus = {
    isSyncing: false,
    currentSession: null,
    pendingOperations: 2,
    conflicts: 1,
    hasConflicts: true,
    lastSyncTime: new Date('2024-01-01T10:00:00'),
    networkStatus: { online: true },
    totalSyncs: 10,
    successfulSyncs: 8,
    failedSyncs: 2,
    conflictsArray: []
  }

  const mockPerformanceMetrics = {
    renderTime: 50,
    memoryUsage: 50 * 1024 * 1024,
    networkLatency: 100,
    conflictResolutionTime: 200,
    userSatisfaction: 85,
    errorRate: 0.01
  }

  beforeEach(() => {
    // 设置mock实例
    const unifiedSyncModule = require('../../services/unified-sync-service')
    const performanceModule = require('../../services/ui/performance-monitor')
    mockUnifiedSyncService = unifiedSyncModule.unifiedSyncService
    mockPerformanceMonitor = performanceModule.performanceMonitor

    vi.clearAllMocks()

    mockUnifiedSyncService.getStatus.mockReturnValue(mockSyncStatus)
    mockPerformanceMonitor.getRealtimeMetrics.mockReturnValue(mockPerformanceMetrics)
    mockPerformanceMonitor.getAlerts.mockReturnValue([])
  })

  describe('SyncStatusDisplay', () => {
    it('应该正确渲染同步状态显示', () => {
      render(<SyncStatusDisplay showDetails={true} />)

      expect(screen.getByText('同步状态')).toBeInTheDocument()
      expect(screen.getByText('在线')).toBeInTheDocument()
      expect(screen.getByText('2 待同步')).toBeInTheDocument()
    })

    it('应该显示详细统计信息', () => {
      render(<SyncStatusDisplay showDetails={true} />)

      expect(screen.getByText('操作统计')).toBeInTheDocument()
      expect(screen.getByText('性能指标')).toBeInTheDocument()
      expect(screen.getByText('同步状态')).toBeInTheDocument()
    })

    it('应该支持手动同步', async () => {
      render(<SyncStatusDisplay showDetails={true} />)

      const syncButton = screen.getByText('立即同步')
      fireEvent.click(syncButton)

      await waitFor(() => {
        expect(mockUnifiedSyncService.sync).toHaveBeenCalledWith({
          type: 'incremental',
          direction: 'bidirectional'
        })
      })
    })

    it('应该正确显示同步进度', () => {
      mockUnifiedSyncService.getStatus.mockReturnValue({
        ...mockSyncStatus,
        isSyncing: true,
        pendingOperations: 5
      })

      render(<SyncStatusDisplay showDetails={true} />)

      expect(screen.getByText('同步中...')).toBeInTheDocument()
      expect(screen.getByText('5 待同步')).toBeInTheDocument()
    })

    it('应该正确显示离线状态', () => {
      mockUnifiedSyncService.getStatus.mockReturnValue({
        ...mockSyncStatus,
        networkStatus: { online: false }
      })

      render(<SyncStatusDisplay showDetails={true} />)

      expect(screen.getByText('离线')).toBeInTheDocument()
    })

    it('应该支持展开/收起详情', () => {
      render(<SyncStatusDisplay showDetails={true} />)

      expect(screen.getByText('操作统计')).toBeInTheDocument()

      const toggleButton = screen.getByText('收起')
      fireEvent.click(toggleButton)

      expect(screen.queryByText('操作统计')).not.toBeInTheDocument()
    })

    it('应该显示最近操作记录', () => {
      render(<SyncStatusDisplay showDetails={true} />)

      expect(screen.getByText('最近操作')).toBeInTheDocument()
    })

    it('应该在同步中时禁用同步按钮', () => {
      mockUnifiedSyncService.getStatus.mockReturnValue({
        ...mockSyncStatus,
        isSyncing: true
      })

      render(<SyncStatusDisplay showDetails={true} />)

      const syncButton = screen.getByText('立即同步')
      expect(syncButton).toBeDisabled()
    })
  })

  describe('SyncStatusIndicator', () => {
    it('应该正确渲染同步状态指示器', () => {
      render(<SyncStatusIndicator showDetails={true} />)

      expect(screen.getByText('已同步')).toBeInTheDocument()
    })

    it('应该显示待同步数量', () => {
      render(<SyncStatusIndicator showDetails={true} />)

      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('应该显示冲突数量', () => {
      mockUnifiedSyncService.getStatus.mockReturnValue({
        ...mockSyncStatus,
        conflicts: 3,
        conflictsArray: [{}, {}, {}]
      })

      render(<SyncStatusIndicator showDetails={true} />)

      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('应该在同步中时显示动画', () => {
      mockUnifiedSyncService.getStatus.mockReturnValue({
        ...mockSyncStatus,
        isSyncing: true
      })

      render(<SyncStatusIndicator showDetails={true} />)

      const syncIcon = screen.getByRole('img', { hidden: true })
      expect(syncIcon).toHaveClass('animate-spin')
    })

    it('应该支持弹出详情', async () => {
      render(<SyncStatusIndicator showDetails={true} />)

      const indicator = screen.getByText('已同步').closest('div')
      fireEvent.click(indicator!)

      await waitFor(() => {
        expect(screen.getByText('同步状态')).toBeInTheDocument()
      })
    })

    it('应该紧凑模式显示', () => {
      render(<SyncStatusIndicator showDetails={false} />)

      expect(screen.getByText('已同步')).toBeInTheDocument()
      expect(screen.queryByText('同步状态')).not.toBeInTheDocument()
    })

    it('应该正确处理网络状态变化', async () => {
      const { rerender } = render(<SyncStatusIndicator showDetails={true} />)

      expect(screen.getByText('在线')).toBeInTheDocument()

      // 模拟网络状态变化
      mockUnifiedSyncService.getStatus.mockReturnValue({
        ...mockSyncStatus,
        networkStatus: { online: false }
      })

      rerender(<SyncStatusIndicator showDetails={true} />)

      expect(screen.getByText('离线')).toBeInTheDocument()
    })
  })

  describe('PerformanceMonitorPanel', () => {
    it('应该正确渲染性能监控面板', () => {
      render(<PerformanceMonitorPanel />)

      expect(screen.getByText('性能监控')).toBeInTheDocument()
    })

    it('应该显示性能健康状态', () => {
      render(<PerformanceMonitorPanel />)

      expect(screen.getByText('性能:')).toBeInTheDocument()
    })

    it('应该支持标签页切换', async () => {
      render(<PerformanceMonitorPanel />)

      // 默认显示概览标签
      expect(screen.getByText('概览')).toBeInTheDocument()

      // 切换到指标标签
      const metricsTab = screen.getByText('指标')
      fireEvent.click(metricsTab)

      expect(screen.getByText('实时性能指标')).toBeInTheDocument()

      // 切换到警报标签
      const alertsTab = screen.getByText('警报')
      fireEvent.click(alertsTab)

      expect(screen.getByText('性能警报')).toBeInTheDocument()

      // 切换到用户行为标签
      const actionsTab = screen.getByText('用户行为')
      fireEvent.click(actionsTab)

      expect(screen.getByText('用户行为历史')).toBeInTheDocument()
    })

    it('应该显示性能指标', () => {
      render(<PerformanceMonitorPanel />)

      expect(screen.getByText('渲染性能')).toBeInTheDocument()
      expect(screen.getByText('内存使用')).toBeInTheDocument()
      expect(screen.getByText('网络性能')).toBeInTheDocument()
      expect(screen.getByText('用户体验')).toBeInTheDocument()
    })

    it('应该显示性能警报', () => {
      mockPerformanceMonitor.getAlerts.mockReturnValue([
        {
          id: 'alert_1',
          type: 'warning',
          category: 'performance',
          message: '高内存使用警告',
          severity: 'medium',
          timestamp: new Date(),
          suggestions: ['检查内存泄漏', '优化数据结构']
        }
      ])

      render(<PerformanceMonitorPanel />)

      const alertsTab = screen.getByText('警报')
      fireEvent.click(alertsTab)

      expect(screen.getByText('高内存使用警告')).toBeInTheDocument()
      expect(screen.getByText('检查内存泄漏')).toBeInTheDocument()
    })

    it('应该支持刷新数据', async () => {
      render(<PerformanceMonitorPanel />)

      const refreshButton = screen.getByText('刷新')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(mockPerformanceMonitor.getRealtimeMetrics).toHaveBeenCalled()
      })
    })

    it('应该支持生成报告', async () => {
      const mockReport = {
        period: { start: new Date(), end: new Date() },
        metrics: [],
        userExperience: {
          averageTaskCompletionTime: 0,
          taskSuccessRate: 0.95,
          conflictResolutionSuccess: 0.9,
          interfaceResponsiveness: 85,
          satisfactionScore: 85
        },
        alerts: [],
        summary: {
          averagePerformance: 85,
          performanceTrend: 'stable',
          criticalIssues: 0,
          recommendations: []
        }
      }

      mockPerformanceMonitor.generateReport.mockReturnValue(mockReport)

      render(<PerformanceMonitorPanel />)

      const reportButton = screen.getByText('报告')
      fireEvent.click(reportButton)

      expect(mockPerformanceMonitor.generateReport).toHaveBeenCalled()
    })

    it('应该紧凑模式显示', () => {
      render(<PerformanceMonitorPanel compact={true} />)

      expect(screen.getByText('性能:')).toBeInTheDocument()
      expect(screen.queryByText('性能监控')).not.toBeInTheDocument()
    })

    it('应该显示性能健康评分', () => {
      render(<PerformanceMonitorPanel />)

      expect(screen.getByText(/100$/)).toBeInTheDocument()
    })

    it('应该显示性能问题', () => {
      // Mock 低健康评分
      mockPerformanceMonitor.getRealtimeMetrics.mockReturnValue({
        ...mockPerformanceMetrics,
        renderTime: 300,
        memoryUsage: 200 * 1024 * 1024,
        networkLatency: 3000,
        errorRate: 0.1
      })

      render(<PerformanceMonitorPanel />)

      expect(screen.getByText('性能问题')).toBeInTheDocument()
    })

    it('应该支持自动刷新', async () => {
      jest.useFakeTimers()

      render(<PerformanceMonitorPanel autoRefresh={true} />)

      // 触发自动刷新
      act(() => {
        jest.advanceTimersByTime(5000)
      })

      await waitFor(() => {
        expect(mockPerformanceMonitor.getRealtimeMetrics).toHaveBeenCalled()
      })

      jest.useRealTimers()
    })
  })

  describe('响应式设计', () => {
    it('应该在移动端正确显示', () => {
      // Mock 移动端视口
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      render(
        <div>
          <SyncStatusIndicator />
          <PerformanceMonitorPanel />
        </div>
      )

      // 检查响应式元素是否存在
      expect(screen.getByText('已同步')).toBeInTheDocument()
      expect(screen.getByText('性能:')).toBeInTheDocument()
    })

    it('应该在桌面端正确显示', () => {
      // Mock 桌面端视口
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920
      })

      render(
        <div>
          <SyncStatusDisplay showDetails={true} />
          <PerformanceMonitorPanel />
        </div>
      )

      // 检查桌面端元素是否存在
      expect(screen.getByText('同步状态')).toBeInTheDocument()
      expect(screen.getByText('性能监控')).toBeInTheDocument()
    })
  })

  describe('可访问性', () => {
    it('应该支持键盘导航', async () => {
      const user = userEvent.setup()
      render(<SyncStatusIndicator showDetails={true} />)

      const indicator = screen.getByText('已同步').closest('div')
      await user.tab()

      expect(indicator).toHaveFocus()
    })

    it('应该提供适当的ARIA标签', () => {
      render(<SyncStatusDisplay showDetails={true} />)

      const statusElement = screen.getByText('在线')
      expect(statusElement).toBeInTheDocument()
    })

    it('应该支持屏幕阅读器', () => {
      render(<PerformanceMonitorPanel />)

      const healthScore = screen.getByText(/100$/)
      expect(healthScore).toBeInTheDocument()
    })
  })

  describe('错误处理', () => {
    it('应该处理服务错误', () => {
      mockUnifiedSyncService.getStatus.mockImplementation(() => {
        throw new Error('服务错误')
      })

      expect(() => {
        render(<SyncStatusDisplay showDetails={true} />)
      }).not.toThrow()
    })

    it('应该处理性能监控错误', () => {
      mockPerformanceMonitor.getRealtimeMetrics.mockImplementation(() => {
        throw new Error('监控错误')
      })

      expect(() => {
        render(<PerformanceMonitorPanel />)
      }).not.toThrow()
    })

    it('应该在错误时显示默认状态', () => {
      mockUnifiedSyncService.getStatus.mockReturnValue(null)

      render(<SyncStatusIndicator showDetails={true} />)

      // 应该显示默认状态而不是错误
      expect(screen.getByText('已同步')).toBeInTheDocument()
    })
  })
})