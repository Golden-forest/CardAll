/**
 * 完整工作流集成测试
 *
 * 测试从数据同步到冲突解决再到性能监控的完整流程
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConflictPanel } from '@/components/conflict/conflict-panel'
import { unifiedSyncService } from '@/services/core/sync/unified-sync.service'
import { performanceMonitor } from '@/services/ui/performance-monitor'

// Mock 所有依赖服务
jest.mock('@/services/core/sync/unified-sync.service', () => ({
  unifiedSyncService: {
    getStatus: jest.fn(),
    getConflicts: jest.fn(),
    getConflict: jest.fn(),
    resolveConflict: jest.fn(),
    autoResolveConflicts: jest.fn(),
    sync: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  }
}))

jest.mock('@/services/ui/performance-monitor', () => ({
  performanceMonitor: {
    startConflictDetection: jest.fn(),
    startConflictResolution: jest.fn(),
    startBatchOperation: jest.fn(),
    trackUserInteraction: jest.fn(),
    getRealtimeMetrics: jest.fn(),
    getAlerts: jest.fn(),
    generateReport: jest.fn(),
    clearMetrics: jest.fn()
  }
}))

jest.mock('@/hooks/use-performance-monitor', () => ({
  usePerformanceMonitor: () => ({
    startConflictDetection: jest.fn(),
    startConflictResolution: jest.fn(),
    startBatchOperation: jest.fn(),
    trackUserInteraction: jest.fn(),
    getPerformanceReport: jest.fn(),
    getRealtimeMetrics: jest.fn(),
    getPerformanceAlerts: jest.fn(),
    getUserActionHistory: jest.fn(),
    getPerformanceStats: jest.fn(),
    clearPerformanceData: jest.fn(),
    getPerformanceHealth: jest.fn(),
    stats: {
      averageRenderTime: 50,
      averageMemoryUsage: 50 * 1024 * 1024,
      averageNetworkLatency: 100,
      conflictResolutionTime: 200,
      userSatisfaction: 85,
      errorRate: 0.01,
      totalOperations: 10,
      successfulOperations: 9
    },
    isMonitoring: true
  })
}))

describe('Complete Workflow Integration', () => {
  const mockConflicts = [
    {
      id: 'conflict_1',
      type: 'card_content',
      entityType: 'card',
      entityId: 'card_1',
      timestamp: new Date('2024-01-01T10:00:00'),
      sourceDevice: 'device_1',
      severity: 'high' as const,
      status: 'pending' as const,
      createdAt: new Date('2024-01-01T10:00:00'),
      localVersion: {
        content: {
          frontContent: { title: '本地标题', content: '本地内容' },
          backContent: { title: '背面本地', content: '背面内容' }
        }
      },
      remoteVersion: {
        content: {
          frontContent: { title: '远程标题', content: '远程内容' },
          backContent: { title: '背面远程', content: '背面内容' }
        }
      },
      conflictFields: ['title', 'content']
    }
  ]

  const mockSyncStatus = {
    isSyncing: false,
    currentSession: null,
    pendingOperations: 1,
    conflicts: 1,
    hasConflicts: true,
    lastSyncTime: new Date('2024-01-01T09:00:00'),
    networkStatus: { online: true },
    totalSyncs: 10,
    successfulSyncs: 8,
    failedSyncs: 2,
    conflictsArray: mockConflicts
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
    jest.clearAllMocks()

    ;(unifiedSyncService.getStatus as jest.Mock).mockReturnValue(mockSyncStatus)
    ;(unifiedSyncService.getConflicts as jest.Mock).mockReturnValue(mockConflicts)
    ;(unifiedSyncService.getConflict as jest.Mock).mockImplementation((id) =>
      mockConflicts.find(c => c.id === id)
    )
    ;(unifiedSyncService.resolveConflict as jest.Mock).mockResolvedValue(true)
    ;(unifiedSyncService.autoResolveConflicts as jest.Mock).mockResolvedValue(1)
    ;(performanceMonitor.getRealtimeMetrics as jest.Mock).mockReturnValue(mockPerformanceMetrics)
    ;(performanceMonitor.getAlerts as jest.Mock).mockReturnValue([])
  })

  describe('完整冲突解决工作流', () => {
    it('应该完成从检测到解决的完整流程', async () => {
      // 1. 初始化系统
      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 2. 检测到冲突
      expect(screen.getByText('冲突管理中心')).toBeInTheDocument()
      expect(screen.getByText('1 待解决')).toBeInTheDocument()
      expect(screen.getByText('本地标题')).toBeInTheDocument()
      expect(screen.getByText('远程标题')).toBeInTheDocument()

      // 3. 查看冲突详情
      const viewDetailButton = screen.getByText('查看详情')
      fireEvent.click(viewDetailButton)

      await waitFor(() => {
        expect(screen.getByText('冲突详情')).toBeInTheDocument()
      })

      // 4. 解决冲突
      const resolveButton = screen.getByText('保留本地')
      fireEvent.click(resolveButton)

      await waitFor(() => {
        expect(unifiedSyncService.resolveConflict).toHaveBeenCalledWith(
          'conflict_1',
          'local',
          undefined
        )
        expect(performanceMonitor.startConflictResolution).toHaveBeenCalled()
        expect(performanceMonitor.trackUserInteraction).toHaveBeenCalledWith(
          'resolve_conflict',
          expect.any(Number),
          true
        )
      })

      // 5. 验证性能监控
      expect(performanceMonitor.getRealtimeMetrics).toHaveBeenCalled()
    })

    it('应该处理批量冲突解决', async () => {
      // 添加多个冲突
      const multipleConflicts = [
        ...mockConflicts,
        {
          id: 'conflict_2',
          type: 'folder_name',
          entityType: 'folder',
          entityId: 'folder_1',
          timestamp: new Date('2024-01-01T11:00:00'),
          sourceDevice: 'device_2',
          severity: 'medium' as const,
          status: 'pending' as const,
          createdAt: new Date('2024-01-01T11:00:00'),
          localVersion: { name: '本地文件夹名' },
          remoteVersion: { name: '远程文件夹名' }
        }
      ]

      ;(unifiedSyncService.getConflicts as jest.Mock).mockReturnValue(multipleConflicts)

      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 1. 选择多个冲突
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])
      fireEvent.click(checkboxes[1])

      expect(screen.getByText('已选择 2 个冲突')).toBeInTheDocument()

      // 2. 批量解决
      const batchResolveButton = screen.getByText('批量保留本地')
      fireEvent.click(batchResolveButton)

      await waitFor(() => {
        expect(unifiedSyncService.resolveConflict).toHaveBeenCalledTimes(2)
        expect(performanceMonitor.startBatchOperation).toHaveBeenCalled()
      })
    })

    it('应该支持自动解决冲突', async () => {
      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 模拟自动解决功能
      const autoResolveButton = screen.getByText('自动解决')
      fireEvent.click(autoResolveButton)

      await waitFor(() => {
        expect(unifiedSyncService.autoResolveConflicts).toHaveBeenCalled()
      })
    })
  })

  describe('实时同步状态监控', () => {
    it('应该实时更新同步状态', async () => {
      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 初始状态
      expect(screen.getByText('在线')).toBeInTheDocument()
      expect(screen.getByText('1 待解决')).toBeInTheDocument()

      // 模拟同步开始
      act(() => {
        (unifiedSyncService.getStatus as jest.Mock).mockReturnValue({
          ...mockSyncStatus,
          isSyncing: true,
          pendingOperations: 3
        })
      })

      // 重新渲染以反映状态变化
      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      expect(screen.getByText('同步中...')).toBeInTheDocument()
      expect(screen.getByText('3 待同步')).toBeInTheDocument()

      // 模拟同步完成
      act(() => {
        (unifiedSyncService.getStatus as jest.Mock).mockReturnValue({
          ...mockSyncStatus,
          isSyncing: false,
          pendingOperations: 0,
          lastSyncTime: new Date()
        })
      })

      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      expect(screen.getByText('已同步')).toBeInTheDocument()
    })

    it('应该处理网络状态变化', async () => {
      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 模拟网络断开
      act(() => {
        (unifiedSyncService.getStatus as jest.Mock).mockReturnValue({
          ...mockSyncStatus,
          networkStatus: { online: false }
        })
      })

      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      expect(screen.getByText('离线')).toBeInTheDocument()

      // 模拟网络恢复
      act(() => {
        (unifiedSyncService.getStatus as jest.Mock).mockReturnValue({
          ...mockSyncStatus,
          networkStatus: { online: true }
        })
      })

      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      expect(screen.getByText('在线')).toBeInTheDocument()
    })
  })

  describe('性能监控集成', () => {
    it('应该在所有操作中跟踪性能', async () => {
      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 1. 冲突检测性能跟踪
      const detectButton = screen.getByText('检测冲突')
      fireEvent.click(detectButton)

      await waitFor(() => {
        expect(performanceMonitor.startConflictDetection).toHaveBeenCalled()
      })

      // 2. 冲突解决性能跟踪
      const resolveButton = screen.getByText('保留本地')
      fireEvent.click(resolveButton)

      await waitFor(() => {
        expect(performanceMonitor.startConflictResolution).toHaveBeenCalled()
        expect(performanceMonitor.trackUserInteraction).toHaveBeenCalledWith(
          'resolve_conflict',
          expect.any(Number),
          true
        )
      })

      // 3. 批量操作性能跟踪
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])

      const batchResolveButton = screen.getByText('批量保留本地')
      fireEvent.click(batchResolveButton)

      await waitFor(() => {
        expect(performanceMonitor.startBatchOperation).toHaveBeenCalled()
      })
    })

    it('应该收集性能指标', async () => {
      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 触发性能指标收集
      const refreshButton = screen.getByText('刷新')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(performanceMonitor.getRealtimeMetrics).toHaveBeenCalled()
      })

      // 验证性能指标被正确获取
      expect(performanceMonitor.getRealtimeMetrics()).toHaveBeenCalledWith()
    })
  })

  describe('错误处理和恢复', () => {
    it('应该处理同步错误', async () => {
      (unifiedSyncService.resolveConflict as jest.Mock).mockRejectedValue(
        new Error('网络连接失败')
      )

      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      const resolveButton = screen.getByText('保留本地')
      fireEvent.click(resolveButton)

      await waitFor(() => {
        expect(screen.getByText('网络连接失败')).toBeInTheDocument()
      })

      // 验证错误被正确跟踪
      expect(performanceMonitor.trackUserInteraction).toHaveBeenCalledWith(
        'resolve_conflict',
        expect.any(Number),
        false
      )
    })

    it('应该处理服务不可用', async () => {
      (unifiedSyncService.getStatus as jest.Mock).mockImplementation(() => {
        throw new Error('服务不可用')
      })

      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 应该优雅地处理错误，不崩溃
      expect(screen.getByText('冲突管理中心')).toBeInTheDocument()
    })

    it('应该支持重试机制', async () => {
      let attemptCount = 0
      ;(unifiedSyncService.resolveConflict as jest.Mock).mockImplementation(() => {
        attemptCount++
        if (attemptCount <= 2) {
          return Promise.reject(new Error('临时错误'))
        }
        return Promise.resolve(true)
      })

      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 第一次尝试
      const resolveButton = screen.getByText('保留本地')
      fireEvent.click(resolveButton)

      await waitFor(() => {
        expect(screen.getByText('临时错误')).toBeInTheDocument()
      })

      // 重试按钮
      const retryButton = screen.getByText('重试')
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(attemptCount).toBe(3)
        expect(unifiedSyncService.resolveConflict).toHaveBeenCalledTimes(3)
      })
    })
  })

  describe('用户体验优化', () => {
    it('应该提供流畅的交互体验', async () => {
      const user = userEvent.setup()
      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 1. 搜索功能
      const searchInput = screen.getByPlaceholderText('搜索冲突...')
      await user.type(searchInput, '标题')

      expect(screen.getByText('本地标题')).toBeInTheDocument()
      expect(screen.queryByText('本地文件夹名')).not.toBeInTheDocument()

      // 2. 过滤功能
      await user.clear(searchInput)
      const highPriorityButton = screen.getByText('高优先级')
      await user.click(highPriorityButton)

      expect(screen.getByText('本地标题')).toBeInTheDocument()

      // 3. 详情查看
      const viewDetailButton = screen.getByText('查看详情')
      await user.click(viewDetailButton)

      expect(screen.getByText('冲突详情')).toBeInTheDocument()

      // 4. 关闭详情
      const closeButton = screen.getByText('×')
      await user.click(closeButton)

      expect(screen.queryByText('冲突详情')).not.toBeInTheDocument()
    })

    it('应该提供实时反馈', async () => {
      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 开始操作时显示加载状态
      const resolveButton = screen.getByText('保留本地')
      fireEvent.click(resolveButton)

      // 应该显示处理中状态
      expect(screen.getByText('处理中...')).toBeInTheDocument()

      // 操作完成后更新状态
      await waitFor(() => {
        expect(screen.queryByText('处理中...')).not.toBeInTheDocument()
      })
    })

    it('应该支持键盘导航', async () => {
      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 使用Tab键导航
      const user = userEvent.setup()
      await user.tab()

      // 第一个可聚焦元素应该是关闭按钮
      const closeButton = screen.getByText('×')
      expect(closeButton).toHaveFocus()

      // 继续Tab导航
      await user.tab()
      const searchInput = screen.getByPlaceholderText('搜索冲突...')
      expect(searchInput).toHaveFocus()

      // 使用Enter键激活
      await user.keyboard('{Enter}')
      expect(searchInput).toHaveFocus()
    })
  })

  describe('数据一致性', () => {
    it('应该保持数据状态一致性', async () => {
      const { rerender } = render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 初始状态
      expect(screen.getByText('1 待解决')).toBeInTheDocument()

      // 模拟冲突被解决
      act(() => {
        (unifiedSyncService.getConflicts as jest.Mock).mockReturnValue([])
      })

      rerender(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 状态应该更新
      expect(screen.getByText('暂无冲突')).toBeInTheDocument()
    })

    it('应该正确处理并发操作', async () => {
      render(<ConflictPanel isOpen={true} onClose={jest.fn()} />)

      // 模拟并发操作
      const resolveButton = screen.getByText('保留本地')

      // 同时点击多个操作
      fireEvent.click(resolveButton)
      fireEvent.click(resolveButton)

      // 应该只处理一次
      await waitFor(() => {
        expect(unifiedSyncService.resolveConflict).toHaveBeenCalledTimes(1)
      })
    })
  })
})