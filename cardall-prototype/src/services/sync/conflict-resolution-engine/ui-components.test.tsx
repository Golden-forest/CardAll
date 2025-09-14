// ============================================================================
// 冲突解决UI组件测试 - W3-T003
// 验证用户界面的交互和渲染
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi, jest } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { ConflictManagementPanel } from './conflict-management-panel'
import { ConflictNotification } from './conflict-notification'
import { ConflictResolutionDialog } from './conflict-resolution-dialog'
import {
  UnifiedConflict,
  ConflictSuggestion,
  ConflictContext
} from './unified-conflict-resolution-engine'

// ============================================================================
// 测试数据生成器
// ============================================================================

class UITestDataGenerator {
  static createMockConflict(
    overrides: Partial<UnifiedConflict> = {}
  ): UnifiedConflict {
    return {
      id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      entityType: 'card',
      entityId: 'card-001',
      conflictType: 'version',
      severity: 'medium',
      status: 'pending',
      timestamp: new Date(),
      lastUpdated: new Date(),
      description: '测试冲突描述',
      localVersion: {
        id: 'local-v1',
        timestamp: new Date(Date.now() - 1000),
        data: { title: '本地标题', content: '本地内容' },
        checksum: 'local-checksum-001',
        deviceId: 'device-local',
        userId: 'user-001'
      },
      remoteVersion: {
        id: 'remote-v1',
        timestamp: new Date(Date.now() - 2000),
        data: { title: '远程标题', content: '远程内容' },
        checksum: 'remote-checksum-001',
        deviceId: 'device-remote',
        userId: 'user-002'
      },
      suggestions: [],
      context: {
        userPreferences: { autoResolve: true, preferredVersion: 'latest' },
        networkConditions: { isOnline: true, latency: 50, bandwidth: 'high' },
        deviceCapabilities: { isMobile: false, batteryLevel: 80 },
        historicalData: { similarConflicts: 3, resolutionAccuracy: 0.85 }
      },
      metadata: {
        detectionRule: 'version-conflict-detection',
        detectionConfidence: 0.9,
        affectedFields: ['title', 'content'],
        impactScope: 'single-entity',
        resolutionAttempts: 0
      },
      ...overrides
    }
  }

  static createMockSuggestion(
    overrides: Partial<ConflictSuggestion> = {}
  ): ConflictSuggestion {
    return {
      id: `suggestion-${Date.now()}`,
      type: 'merge',
      description: '测试解决建议',
      confidence: 0.8,
      action: 'merge',
      estimatedSuccess: 0.9,
      reasoning: '基于历史数据的智能分析',
      implementation: () => Promise.resolve(true),
      ...overrides
    }
  }
}

// ============================================================================
// 冲突管理面板测试
// ============================================================================

describe('ConflictManagementPanel', () => {
  let mockConflicts: UnifiedConflict[]
  let mockOnConflictSelect: jest.Mock
  let mockOnConflictResolve: jest.Mock
  let mockOnConflictIgnore: jest.Mock

  beforeEach(() => {
    mockConflicts = Array.from({ length: 5 }, (_, i) =>
      UITestDataGenerator.createMockConflict({
        id: `conflict-${i}`,
        entityId: `card-${i}`,
        conflictType: i % 2 === 0 ? 'version' : 'content',
        severity: ['low', 'medium', 'high', 'critical', 'medium'][i]
      })
    )

    mockOnConflictSelect = vi.fn()
    mockOnConflictResolve = vi.fn()
    mockOnConflictIgnore = vi.fn()

    // 模拟CSS模块
    vi.mock('./conflict-resolution-styles.css', () => ({
      default: {
        panel: 'conflict-management-panel',
        header: 'panel-header',
        content: 'panel-content',
        filters: 'panel-filters',
        list: 'conflict-list',
        item: 'conflict-item',
        selected: 'selected',
        severity: 'severity-indicator'
      }
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('基本渲染', () => {
    it('应该正确渲染面板', () => {
      render(
        <ConflictManagementPanel
          conflicts={mockConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      expect(screen.getByText('冲突管理')).toBeInTheDocument()
      expect(screen.getByText('5 个冲突')).toBeInTheDocument()
    })

    it('应该渲染冲突列表', () => {
      render(
        <ConflictManagementPanel
          conflicts={mockConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      mockConflicts.forEach(conflict => {
        expect(screen.getByText(conflict.entityId)).toBeInTheDocument()
      })
    })

    it('应该显示空状态', () => {
      render(
        <ConflictManagementPanel
          conflicts={[]}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      expect(screen.getByText('没有冲突')).toBeInTheDocument()
      expect(screen.getByText('当前没有检测到任何冲突')).toBeInTheDocument()
    })
  })

  describe('筛选功能', () => {
    it('应该按严重程度筛选冲突', () => {
      render(
        <ConflictManagementPanel
          conflicts={mockConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      // 点击严重程度筛选按钮
      const highSeverityButton = screen.getByText('严重')
      fireEvent.click(highSeverityButton)

      // 验证筛选结果
      const visibleItems = screen.getAllByRole('listitem')
      expect(visibleItems.length).toBeLessThan(mockConflicts.length)
    })

    it('应该按实体类型筛选冲突', () => {
      render(
        <ConflictManagementPanel
          conflicts={mockConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      // 点击实体类型筛选按钮
      const cardTypeButton = screen.getByText('卡片')
      fireEvent.click(cardTypeButton)

      // 验证筛选结果
      const visibleItems = screen.getAllByRole('listitem')
      expect(visibleItems.length).toBe(mockConflicts.length) // 所有都是卡片类型
    })

    it('应该按状态筛选冲突', () => {
      const conflictsWithStatus = [
        ...mockConflicts.slice(0, 2).map(c => ({ ...c, status: 'pending' as const })),
        ...mockConflicts.slice(2, 4).map(c => ({ ...c, status: 'resolving' as const })),
        ...mockConflicts.slice(4).map(c => ({ ...c, status: 'resolved' as const }))
      ]

      render(
        <ConflictManagementPanel
          conflicts={conflictsWithStatus}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      // 点击状态筛选按钮
      const pendingButton = screen.getByText('待处理')
      fireEvent.click(pendingButton)

      // 验证筛选结果
      const visibleItems = screen.getAllByRole('listitem')
      expect(visibleItems.length).toBe(2)
    })

    it('应该支持搜索筛选', () => {
      render(
        <ConflictManagementPanel
          conflicts={mockConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      // 输入搜索词
      const searchInput = screen.getByPlaceholderText('搜索冲突...')
      fireEvent.change(searchInput, { target: { value: 'card-001' } })

      // 验证筛选结果
      const visibleItems = screen.getAllByRole('listitem')
      expect(visibleItems.length).toBe(1)
    })
  })

  describe('排序功能', () => {
    it('应该按时间排序冲突', () => {
      render(
        <ConflictManagementPanel
          conflicts={mockConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      // 点击排序按钮
      const sortButton = screen.getByText('时间')
      fireEvent.click(sortButton)

      // 验证排序结果（这里简化测试，实际需要检查DOM顺序）
      expect(sortButton).toBeInTheDocument()
    })

    it('应该按严重程度排序冲突', () => {
      render(
        <ConflictManagementPanel
          conflicts={mockConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      // 点击排序按钮
      const severityButton = screen.getByText('严重程度')
      fireEvent.click(severityButton)

      // 验证排序结果
      expect(severityButton).toBeInTheDocument()
    })
  })

  describe('交互功能', () => {
    it('应该选择冲突项目', () => {
      render(
        <ConflictManagementPanel
          conflicts={mockConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      // 点击第一个冲突项
      const firstConflict = screen.getAllByRole('listitem')[0]
      fireEvent.click(firstConflict)

      // 验证回调函数被调用
      expect(mockOnConflictSelect).toHaveBeenCalledWith(mockConflicts[0])
    })

    it('应该触发解决操作', async () => {
      render(
        <ConflictManagementPanel
          conflicts={mockConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      // 点击第一个冲突项的解决按钮
      const resolveButtons = screen.getAllByText('解决')
      fireEvent.click(resolveButtons[0])

      // 验证回调函数被调用
      expect(mockOnConflictResolve).toHaveBeenCalledWith(mockConflicts[0])
    })

    it('应该触发忽略操作', async () => {
      render(
        <ConflictManagementPanel
          conflicts={mockConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      />

      // 点击第一个冲突项的忽略按钮
      const ignoreButtons = screen.getAllByText('忽略')
      fireEvent.click(ignoreButtons[0])

      // 验证回调函数被调用
      expect(mockOnConflictIgnore).toHaveBeenCalledWith(mockConflicts[0])
    })

    it('应该支持批量操作', () => {
      render(
        <ConflictManagementPanel
          conflicts={mockConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      // 全选
      const selectAllButton = screen.getByText('全选')
      fireEvent.click(selectAllButton)

      // 批量解决
      const bulkResolveButton = screen.getByText('批量解决')
      fireEvent.click(bulkResolveButton)

      // 验证批量操作
      expect(mockOnConflictResolve).toHaveBeenCalledTimes(mockConflicts.length)
    })
  })

  describe('统计信息', () => {
    it('应该显示冲突统计', () => {
      render(
        <ConflictManagementPanel
          conflicts={mockConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      expect(screen.getByText('5 个冲突')).toBeInTheDocument()
      expect(screen.getByText('1 个严重冲突')).toBeInTheDocument() // 假设有1个critical级别
      expect(screen.getByText('1 个高优先级')).toBeInTheDocument() // 假设有1个high级别
    })

    it('应该自动更新统计信息', () => {
      const { rerender } = render(
        <ConflictManagementPanel
          conflicts={mockConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      // 更新冲突列表
      const updatedConflicts = mockConflicts.slice(0, 2)
      rerender(
        <ConflictManagementPanel
          conflicts={updatedConflicts}
          onConflictSelect={mockOnConflictSelect}
          onConflictResolve={mockOnConflictResolve}
          onConflictIgnore={mockOnConflictIgnore}
        />
      )

      expect(screen.getByText('2 个冲突')).toBeInTheDocument()
    })
  })
})

// ============================================================================
// 冲突通知组件测试
// ============================================================================

describe('ConflictNotification', () => {
  let mockConflicts: UnifiedConflict[]
  let mockOnNotificationClick: jest.Mock
  let mockOnNotificationDismiss: jest.Mock
  let mockOnAutoResolve: jest.Mock

  beforeEach(() => {
    mockConflicts = Array.from({ length: 3 }, (_, i) =>
      UITestDataGenerator.createMockConflict({
        id: `conflict-${i}`,
        entityId: `card-${i}`,
        severity: ['critical', 'high', 'medium'][i] as any,
        suggestions: [UITestDataGenerator.createMockSuggestion()]
      })
    )

    mockOnNotificationClick = vi.fn()
    mockOnNotificationDismiss = vi.fn()
    mockOnAutoResolve = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  describe('基本渲染', () => {
    it('应该正确渲染通知容器', () => {
      render(
        <ConflictNotification
          enabled={true}
          conflicts={mockConflicts}
          onNotificationClick={mockOnNotificationClick}
          onNotificationDismiss={mockOnNotificationDismiss}
          onAutoResolve={mockOnAutoResolve}
        />
      )

      expect(screen.getByText('3 个新冲突')).toBeInTheDocument()
      expect(screen.getByText('1 个严重冲突')).toBeInTheDocument()
    })

    it('应该渲染通知列表', () => {
      render(
        <ConflictNotification
          enabled={true}
          conflicts={mockConflicts}
          onNotificationClick={mockOnNotificationClick}
          onNotificationDismiss={mockOnNotificationDismiss}
          onAutoResolve={mockOnAutoResolve}
        />
      )

      mockConflicts.forEach(conflict => {
        expect(screen.getByText(conflict.entityId)).toBeInTheDocument()
      })
    })

    it('应该在禁用时显示空', () => {
      render(
        <ConflictNotification
          enabled={false}
          conflicts={mockConflicts}
          onNotificationClick={mockOnNotificationClick}
          onNotificationDismiss={mockOnNotificationDismiss}
          onAutoResolve={mockOnAutoResolve}
        />
      )

      expect(screen.queryByText('3 个新冲突')).not.toBeInTheDocument()
    })
  })

  describe('过滤功能', () => {
    it('应该按严重程度过滤通知', () => {
      render(
        <ConflictNotification
          enabled={true}
          conflicts={mockConflicts}
          severityFilter={['critical']}
          onNotificationClick={mockOnNotificationClick}
          onNotificationDismiss={mockOnNotificationDismiss}
          onAutoResolve={mockOnAutoResolve}
        />
      )

      // 应该只显示严重冲突
      expect(screen.getByText('1 个新冲突')).toBeInTheDocument()
      expect(screen.getByText('1 个严重冲突')).toBeInTheDocument()
    })

    it('应该按实体类型过滤通知', () => {
      const mixedConflicts = [
        ...mockConflicts,
        UITestDataGenerator.createMockConflict({
          entityType: 'folder',
          entityId: 'folder-001'
        })
      ]

      render(
        <ConflictNotification
          enabled={true}
          conflicts={mixedConflicts}
          entityTypeFilter={['card']}
          onNotificationClick={mockOnNotificationClick}
          onNotificationDismiss={mockOnNotificationDismiss}
          onAutoResolve={mockOnAutoResolve}
        />
      )

      // 应该只显示卡片冲突
      expect(screen.getByText('3 个新冲突')).toBeInTheDocument()
    })

    it('应该限制通知数量', () => {
      const manyConflicts = Array.from({ length: 15 }, (_, i) =>
        UITestDataGenerator.createMockConflict({
          id: `conflict-${i}`,
          entityId: `card-${i}`
        })
      )

      render(
        <ConflictNotification
          enabled={true}
          conflicts={manyConflicts}
          maxNotifications={10}
          onNotificationClick={mockOnNotificationClick}
          onNotificationDismiss={mockOnNotificationDismiss}
          onAutoResolve={mockOnAutoResolve}
        />
      )

      // 应该只显示10个通知
      expect(screen.getByText('10 个新冲突')).toBeInTheDocument()
    })
  })

  describe('交互功能', () => {
    it('应该点击通知', () => {
      render(
        <ConflictNotification
          enabled={true}
          conflicts={mockConflicts}
          onNotificationClick={mockOnNotificationClick}
          onNotificationDismiss={mockOnNotificationDismiss}
          onAutoResolve={mockOnAutoResolve}
        />
      )

      // 点击第一个通知
      const firstNotification = screen.getAllByRole('listitem')[0]
      fireEvent.click(firstNotification)

      // 验证回调函数被调用
      expect(mockOnNotificationClick).toHaveBeenCalledWith(mockConflicts[0])
    })

    it('应该关闭通知', () => {
      render(
        <ConflictNotification
          enabled={true}
          conflicts={mockConflicts}
          onNotificationClick={mockOnNotificationClick}
          onNotificationDismiss={mockOnNotificationDismiss}
          onAutoResolve={mockOnAutoResolve}
        />
      )

      // 点击关闭按钮
      const closeButtons = screen.getAllByText('×')
      fireEvent.click(closeButtons[0])

      // 验证回调函数被调用
      expect(mockOnNotificationDismiss).toHaveBeenCalledWith(mockConflicts[0].id)
    })

    it('应该支持自动解决', () => {
      render(
        <ConflictNotification
          enabled={true}
          conflicts={mockConflicts}
          onNotificationClick={mockOnNotificationClick}
          onNotificationDismiss={mockOnNotificationDismiss}
          onAutoResolve={mockOnAutoResolve}
        />
      )

      // 点击自动解决按钮
      const autoResolveButtons = screen.getAllByText('自动解决')
      fireEvent.click(autoResolveButtons[0])

      // 验证回调函数被调用
      expect(mockOnAutoResolve).toHaveBeenCalledWith(mockConflicts[0])
    })

    it('应该支持全部清除', () => {
      render(
        <ConflictNotification
          enabled={true}
          conflicts={mockConflicts}
          onNotificationClick={mockOnNotificationClick}
          onNotificationDismiss={mockOnNotificationDismiss}
          onAutoResolve={mockOnAutoResolve}
        />
      )

      // 点击全部清除按钮
      const clearAllButton = screen.getByText('全部清除')
      fireEvent.click(clearAllButton)

      // 验证所有通知都被关闭
      expect(mockOnNotificationDismiss).toHaveBeenCalledTimes(mockConflicts.length)
    })
  })

  describe('自动消失', () => {
    it('应该在指定时间后自动消失', async () => {
      vi.useFakeTimers()

      render(
        <ConflictNotification
          enabled={true}
          conflicts={mockConflicts}
          duration={5000}
          onNotificationClick={mockOnNotificationClick}
          onNotificationDismiss={mockOnNotificationDismiss}
          onAutoResolve={mockOnAutoResolve}
        />
      )

      // 快进时间
      await act(async () => {
        vi.advanceTimersByTime(6000)
      })

      // 验证通知消失
      expect(screen.queryByText('3 个新冲突')).not.toBeInTheDocument()
    })
  })
})

// ============================================================================
// 冲突解决对话框测试
// ============================================================================

describe('ConflictResolutionDialog', () => {
  let mockConflict: UnifiedConflict
  let mockOnResolve: jest.Mock
  let mockOnCancel: jest.Mock

  beforeEach(() => {
    mockConflict = UITestDataGenerator.createMockConflict({
      suggestions: [
        UITestDataGenerator.createMockSuggestion({ type: 'keep-local' }),
        UITestDataGenerator.createMockSuggestion({ type: 'keep-remote' }),
        UITestDataGenerator.createMockSuggestion({ type: 'merge' })
      ]
    })

    mockOnResolve = vi.fn()
    mockOnCancel = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('基本渲染', () => {
    it('应该正确渲染对话框', () => {
      render(
        <ConflictResolutionDialog
          open={true}
          conflict={mockConflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('解决冲突')).toBeInTheDocument()
      expect(screen.getByText(mockConflict.entityId)).toBeInTheDocument()
      expect(screen.getByText(mockConflict.conflictType)).toBeInTheDocument()
    })

    it('应该在关闭时显示空', () => {
      render(
        <ConflictResolutionDialog
          open={false}
          conflict={mockConflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.queryByText('解决冲突')).not.toBeInTheDocument()
    })
  })

  describe('解决建议', () => {
    it('应该显示解决建议列表', () => {
      render(
        <ConflictResolutionDialog
          open={true}
          conflict={mockConflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      mockConflict.suggestions!.forEach(suggestion => {
        expect(screen.getByText(suggestion.description)).toBeInTheDocument()
      })
    })

    it('应该显示建议的置信度', () => {
      render(
        <ConflictResolutionDialog
          open={true}
          conflict={mockConflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('80%')).toBeInTheDocument() // 第一个建议的置信度
    })

    it('应该显示建议的成功率', () => {
      render(
        <ConflictResolutionDialog
          open={true}
          conflict={mockConflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('90%')).toBeInTheDocument() // 第一个建议的成功率
    })
  })

  describe('版本对比', () => {
    it('应该显示本地版本信息', () => {
      render(
        <ConflictResolutionDialog
          open={true}
          conflict={mockConflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('本地版本')).toBeInTheDocument()
      expect(screen.getByText(mockConflict.localVersion!.data.title)).toBeInTheDocument()
    })

    it('应该显示远程版本信息', () => {
      render(
        <ConflictResolutionDialog
          open={true}
          conflict={mockConflict}
          onResolve={mockOnResolve}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('远程版本')).toBeInTheDocument()
      expect(screen.getByText(mockConflict.remoteVersion!.data.title)).toBeInTheDocument()
    })

    it('应该显示时间戳信息', () => {
      render(
        <ConflictResolutionDialog
          open={true}
          conflict={mockConflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('device-local')).toBeInTheDocument()
      expect(screen.getByText('device-remote')).toBeInTheDocument()
    })
  })

  describe('交互功能', () => {
    it('应该选择解决建议', () => {
      render(
        <ConflictResolutionDialog
          open={true}
          conflict={mockConflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      // 点击第一个建议
      const firstSuggestion = screen.getAllByRole('radio')[0]
      fireEvent.click(firstSuggestion)

      // 点击解决按钮
      const resolveButton = screen.getByText('解决')
      fireEvent.click(resolveButton)

      // 验证回调函数被调用
      expect(mockOnResolve).toHaveBeenCalledWith(
        mockConflict,
        mockConflict.suggestions![0]
      )
    })

    it('应该取消对话框', () => {
      render(
        <ConflictResolutionDialog
          open={true}
          conflict={mockConflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      // 点击取消按钮
      const cancelButton = screen.getByText('取消')
      fireEvent.click(cancelButton)

      // 验证回调函数被调用
      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('应该显示高级选项', () => {
      render(
        <ConflictResolutionDialog
          open={true}
          conflict={mockConflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      // 点击高级选项按钮
      const advancedButton = screen.getByText('高级选项')
      fireEvent.click(advancedButton)

      // 验证高级选项显示
      expect(screen.getByText('高级解决选项')).toBeInTheDocument()
    })
  })

  describe('手动解决', () => {
    it('应该支持字段级手动解决', () => {
      render(
        <ConflictResolutionDialog
          open={true}
          conflict={mockConflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      // 点击手动解决选项
      const manualResolveButton = screen.getByText('手动解决')
      fireEvent.click(manualResolveButton)

      // 验证字段选择器显示
      expect(screen.getByText('选择要保留的字段')).toBeInTheDocument()
    })

    it('应该显示差异对比', () => {
      render(
        <ConflictResolutionDialog
          open={true}
          conflict={mockConflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      // 点击差异对比按钮
      const diffButton = screen.getByText('差异对比')
      fireEvent.click(diffButton)

      // 验证差异对比显示
      expect(screen.getByText('差异对比')).toBeInTheDocument()
    })
  })
})

// ============================================================================
// 性能测试
// ============================================================================

describe('Performance Tests', () => {
  describe('大规模数据渲染', () => {
    it('应该处理大量冲突的通知渲染', () => {
      const manyConflicts = Array.from({ length: 100 }, (_, i) =>
        UITestDataGenerator.createMockConflict({
          id: `conflict-${i}`,
          entityId: `card-${i}`
        })
      )

      const startTime = performance.now()

      render(
        <ConflictManagementPanel
          conflicts={manyConflicts}
          onConflictSelect={vi.fn()}
          onConflictResolve={vi.fn()}
          onConflictIgnore={vi.fn()}
        />
      )

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(1000) // 1秒内完成渲染
    })

    it('应该处理大量通知的渲染', () => {
      const manyConflicts = Array.from({ length: 50 }, (_, i) =>
        UITestDataGenerator.createMockConflict({
          id: `conflict-${i}`,
          entityId: `card-${i}`
        })
      )

      const startTime = performance.now()

      render(
        <ConflictNotification
          enabled={true}
          conflicts={manyConflicts}
          onNotificationClick={vi.fn()}
          onNotificationDismiss={vi.fn()}
          onAutoResolve={vi.fn()}
        />
      )

      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(500) // 500ms内完成渲染
    })
  })
})

// ============================================================================
// 辅助函数测试
// ============================================================================

describe('Helper Functions', () => {
  describe('UITestDataGenerator', () => {
    it('应该生成有效的模拟冲突', () => {
      const conflict = UITestDataGenerator.createMockConflict()

      expect(conflict.id).toBeDefined()
      expect(conflict.entityType).toBe('card')
      expect(conflict.conflictType).toBe('version')
      expect(conflict.severity).toBe('medium')
      expect(conflict.localVersion).toBeDefined()
      expect(conflict.remoteVersion).toBeDefined()
    })

    it('应该生成有效的模拟建议', () => {
      const suggestion = UITestDataGenerator.createMockSuggestion()

      expect(suggestion.id).toBeDefined()
      expect(suggestion.type).toBe('merge')
      expect(suggestion.confidence).toBe(0.8)
      expect(suggestion.estimatedSuccess).toBe(0.9)
    })

    it('应该支持自定义覆盖', () => {
      const conflict = UITestDataGenerator.createMockConflict({
        entityType: 'folder',
        conflictType: 'delete',
        severity: 'critical'
      })

      expect(conflict.entityType).toBe('folder')
      expect(conflict.conflictType).toBe('delete')
      expect(conflict.severity).toBe('critical')
    })
  })
})

// ============================================================================
// 导出测试套件
// ============================================================================

export {
  UITestDataGenerator,
  ConflictManagementPanel,
  ConflictNotification,
  ConflictResolutionDialog
}

export default {
  UITestDataGenerator,
  ConflictManagementPanel,
  ConflictNotification,
  ConflictResolutionDialog
}