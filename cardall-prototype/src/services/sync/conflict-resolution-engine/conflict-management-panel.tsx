// ============================================================================
// 冲突管理面板组件 - W3-T003
// 提供统一的冲突处理界面，支持自动解决和手动解决
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import {
  UnifiedConflict,
  ConflictResolution,
  ConflictContext,
  ConflictEngineMetrics,
  ConflictEngineHealth,
  ConflictSuggestion,
  UserDecision
} from './unified-conflict-resolution-engine'
import { ConflictDetector } from './conflict-detector'
import { ConflictResolver } from './conflict-resolver'

// ============================================================================
// 组件 Props 接口
// ============================================================================

interface ConflictManagementPanelProps {
  // 基础配置
  isVisible?: boolean
  onClose?: () => void
  autoRefresh?: boolean
  refreshInterval?: number

  // 冲突解决配置
  autoResolveEnabled?: boolean
  autoResolveThreshold?: number
  userPreferences?: {
    defaultResolution: 'local' | 'cloud' | 'merge' | 'ask'
    showNotifications: boolean
    batchProcessing: boolean
  }

  // 回调函数
  onConflictResolved?: (conflict: UnifiedConflict, resolution: ConflictResolution) => void
  onConflictIgnored?: (conflict: UnifiedConflict) => void
  onSettingsChanged?: (settings: ConflictSettings) => void

  // 样式配置
  className?: string
  theme?: 'light' | 'dark'
}

interface ConflictSettings {
  autoResolveEnabled: boolean
  autoResolveThreshold: number
  notificationsEnabled: boolean
  batchProcessingEnabled: boolean
  maxConcurrentResolutions: number
}

// ============================================================================
// 主组件
// ============================================================================

export const ConflictManagementPanel: React.FC<ConflictManagementPanelProps> = ({
  isVisible = true,
  onClose,
  autoRefresh = true,
  refreshInterval = 30000,
  autoResolveEnabled = true,
  autoResolveThreshold = 0.8,
  userPreferences,
  onConflictResolved,
  onConflictIgnored,
  onSettingsChanged,
  className = '',
  theme = 'light'
}) => {
  // 状态管理
  const [conflicts, setConflicts] = useState<UnifiedConflict[]>([])
  const [selectedConflict, setSelectedConflict] = useState<UnifiedConflict | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [metrics, setMetrics] = useState<ConflictEngineMetrics | null>(null)
  const [health, setHealth] = useState<ConflictEngineHealth | null>(null)
  const [settings, setSettings] = useState<ConflictSettings>({
    autoResolveEnabled,
    autoResolveThreshold,
    notificationsEnabled: userPreferences?.showNotifications ?? true,
    batchProcessingEnabled: userPreferences?.batchProcessing ?? true,
    maxConcurrentResolutions: 3
  })

  // 过滤器状态
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | 'pending' | 'resolving' | 'resolved' | 'manual_required',
    severity: 'all' as 'all' | 'low' | 'medium' | 'high' | 'critical',
    entityType: 'all' as 'all' | 'card' | 'folder' | 'tag' | 'image',
    search: ''
  })

  // 冲突检测器和解决器实例
  const [detector] = useState(() => new ConflictDetector())
  const [resolver] = useState(() => new ConflictResolver())

  // ============================================================================
  // 数据加载和刷新
  // ============================================================================

  const loadConflicts = useCallback(async () => {
    try {
      setIsProcessing(true)

      // 模拟从冲突检测器加载冲突
      // 在实际实现中，这里会调用实际的API或服务
      const mockConflicts: UnifiedConflict[] = []
      setConflicts(mockConflicts)

      // 加载指标和健康状态
      const mockMetrics: ConflictEngineMetrics = {
        totalConflicts: 0,
        resolvedConflicts: 0,
        pendingConflicts: 0,
        manualRequiredConflicts: 0,
        averageDetectionTime: 0,
        averageResolutionTime: 0,
        successRate: 1,
        autoResolveRate: 0,
        conflictsByType: {},
        conflictsByEntity: {},
        resolutionsByStrategy: {},
        conflictsByHour: {},
        conflictsByDay: {},
        detectionErrors: 0,
        resolutionErrors: 0,
        timeoutErrors: 0,
        memoryUsage: 0,
        cacheHitRate: 0,
        cpuUsage: 0
      }

      const mockHealth: ConflictEngineHealth = {
        status: 'healthy',
        score: 100,
        issues: [],
        lastCheck: new Date(),
        detection: { status: 'healthy', latency: 0, successRate: 1, errorRate: 0 },
        resolution: { status: 'healthy', latency: 0, successRate: 1, errorRate: 0 },
        cache: { status: 'healthy', latency: 0, successRate: 1, errorRate: 0 },
        ml: { status: 'healthy', latency: 0, successRate: 1, errorRate: 0 }
      }

      setMetrics(mockMetrics)
      setHealth(mockHealth)
    } catch (error) {
      console.error('加载冲突失败:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [detector])

  // 自动刷新
  useEffect(() => {
    if (isVisible && autoRefresh) {
      loadConflicts()
      const interval = setInterval(loadConflicts, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [isVisible, autoRefresh, refreshInterval, loadConflicts])

  // ============================================================================
  // 冲突处理函数
  // ============================================================================

  const handleResolveConflict = async (
    conflict: UnifiedConflict,
    resolution: ConflictResolution
  ) => {
    try {
      setIsProcessing(true)

      // 调用冲突解决器
      const context: ConflictContext = {
        userId: 'current-user',
        deviceId: 'current-device',
        networkQuality: 'good',
        timeOfDay: 'normal',
        userActivity: 'active',
        syncHistory: {
          totalConflicts: 0,
          resolvedConflicts: 0,
          averageResolutionTime: 0,
          commonStrategies: {},
          conflictPatterns: []
        },
        userPreferences: {
          defaultResolution: settings.autoResolveEnabled ? 'merge' : 'ask',
          entityPreferences: {},
          autoResolveThreshold: settings.autoResolveThreshold,
          notificationPreference: settings.notificationsEnabled ? 'immediate' : 'none',
          preferredStrategies: []
        }
      }

      const result = await resolver.resolveConflict(conflict, context, {
        autoResolve: settings.autoResolveEnabled,
        userDecision: {
          type: 'accept',
          customChanges: resolution.manualChanges
        }
      })

      if (result.success) {
        // 更新冲突状态
        setConflicts(prev => prev.map(c =>
          c.id === conflict.id
            ? { ...c, status: 'resolved', resolution: result.resolution, resolvedAt: new Date() }
            : c
        ))

        // 触发回调
        onConflictResolved?.(conflict, result.resolution!)

        // 刷新数据
        loadConflicts()
      }
    } catch (error) {
      console.error('解决冲突失败:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleIgnoreConflict = async (conflict: UnifiedConflict) => {
    try {
      setIsProcessing(true)

      // 更新冲突状态为已忽略
      setConflicts(prev => prev.map(c =>
        c.id === conflict.id
          ? { ...c, status: 'resolved', resolvedAt: new Date(), resolvedBy: 'user' }
          : c
      ))

      // 触发回调
      onConflictIgnored?.(conflict)

      // 刷新数据
      loadConflicts()
    } catch (error) {
      console.error('忽略冲突失败:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAutoResolve = async () => {
    try {
      setIsProcessing(true)

      const pendingConflicts = conflicts.filter(c => c.status === 'pending')
      const context: ConflictContext = {
        userId: 'current-user',
        deviceId: 'current-device',
        networkQuality: 'good',
        timeOfDay: 'normal',
        userActivity: 'active',
        syncHistory: {
          totalConflicts: conflicts.length,
          resolvedConflicts: conflicts.filter(c => c.status === 'resolved').length,
          averageResolutionTime: metrics?.averageResolutionTime || 0,
          commonStrategies: metrics?.resolutionsByStrategy || {},
          conflictPatterns: []
        },
        userPreferences: {
          defaultResolution: 'merge',
          entityPreferences: {},
          autoResolveThreshold: settings.autoResolveThreshold,
          notificationPreference: 'immediate',
          preferredStrategies: []
        }
      }

      // 批量解决冲突
      for (const conflict of pendingConflicts) {
        if (conflict.severity === 'critical' || !settings.autoResolveEnabled) {
          continue
        }

        const result = await resolver.resolveConflict(conflict, context, {
          autoResolve: true
        })

        if (result.success) {
          setConflicts(prev => prev.map(c =>
            c.id === conflict.id
              ? { ...c, status: 'resolved', resolution: result.resolution, resolvedAt: new Date() }
              : c
          ))
        }
      }

      // 刷新数据
      loadConflicts()
    } catch (error) {
      console.error('自动解决失败:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // ============================================================================
  // 设置处理函数
  // ============================================================================

  const handleSettingsChange = (newSettings: Partial<ConflictSettings>) => {
    const updatedSettings = { ...settings, ...newSettings }
    setSettings(updatedSettings)
    onSettingsChanged?.(updatedSettings)
  }

  // ============================================================================
  // 过滤和搜索
  // ============================================================================

  const filteredConflicts = conflicts.filter(conflict => {
    if (filters.status !== 'all' && conflict.status !== filters.status) return false
    if (filters.severity !== 'all' && conflict.severity !== filters.severity) return false
    if (filters.entityType !== 'all' && conflict.entityType !== filters.entityType) return false
    if (filters.search && !conflict.entityId.toLowerCase().includes(filters.search.toLowerCase())) return false
    return true
  })

  // ============================================================================
  // 渲染函数
  // ============================================================================

  if (!isVisible) return null

  return (
    <div className={`conflict-management-panel ${theme} ${className}`}>
      <div className="panel-header">
        <h2>冲突管理中心</h2>
        <div className="header-actions">
          <button onClick={loadConflicts} disabled={isProcessing}>
            刷新
          </button>
          <button onClick={handleAutoResolve} disabled={isProcessing || !settings.autoResolveEnabled}>
            自动解决
          </button>
          <button onClick={onClose}>
            关闭
          </button>
        </div>
      </div>

      {/* 状态概览 */}
      <div className="status-overview">
        <div className="status-cards">
          <div className="status-card">
            <h3>待处理</h3>
            <div className="value">{metrics?.pendingConflicts || 0}</div>
          </div>
          <div className="status-card">
            <h3>需手动处理</h3>
            <div className="value">{metrics?.manualRequiredConflicts || 0}</div>
          </div>
          <div className="status-card">
            <h3>已解决</h3>
            <div className="value">{metrics?.resolvedConflicts || 0}</div>
          </div>
          <div className="status-card">
            <h3>成功率</h3>
            <div className="value">{((metrics?.successRate || 0) * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="filters">
        <div className="filter-group">
          <label>状态:</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
          >
            <option value="all">全部</option>
            <option value="pending">待处理</option>
            <option value="resolving">处理中</option>
            <option value="resolved">已解决</option>
            <option value="manual_required">需手动处理</option>
          </select>
        </div>

        <div className="filter-group">
          <label>严重程度:</label>
          <select
            value={filters.severity}
            onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value as any }))}
          >
            <option value="all">全部</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="critical">严重</option>
          </select>
        </div>

        <div className="filter-group">
          <label>实体类型:</label>
          <select
            value={filters.entityType}
            onChange={(e) => setFilters(prev => ({ ...prev, entityType: e.target.value as any }))}
          >
            <option value="all">全部</option>
            <option value="card">卡片</option>
            <option value="folder">文件夹</option>
            <option value="tag">标签</option>
            <option value="image">图片</option>
          </select>
        </div>

        <div className="filter-group">
          <label>搜索:</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            placeholder="搜索冲突..."
          />
        </div>
      </div>

      {/* 冲突列表 */}
      <div className="conflict-list">
        {isProcessing ? (
          <div className="loading">处理中...</div>
        ) : filteredConflicts.length === 0 ? (
          <div className="empty-state">没有找到冲突</div>
        ) : (
          filteredConflicts.map(conflict => (
            <ConflictItem
              key={conflict.id}
              conflict={conflict}
              isSelected={selectedConflict?.id === conflict.id}
              onSelect={() => setSelectedConflict(conflict)}
              onResolve={handleResolveConflict}
              onIgnore={handleIgnoreConflict}
            />
          ))
        )}
      </div>

      {/* 冲突详情面板 */}
      {selectedConflict && (
        <ConflictDetailPanel
          conflict={selectedConflict}
          onClose={() => setSelectedConflict(null)}
          onResolve={handleResolveConflict}
          onIgnore={handleIgnoreConflict}
        />
      )}

      {/* 设置面板 */}
      <div className="settings-section">
        <h3>设置</h3>
        <div className="settings-grid">
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.autoResolveEnabled}
                onChange={(e) => handleSettingsChange({ autoResolveEnabled: e.target.checked })}
              />
              启用自动解决
            </label>
          </div>

          <div className="setting-item">
            <label>
              自动解决阈值:
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.autoResolveThreshold}
                onChange={(e) => handleSettingsChange({ autoResolveThreshold: parseFloat(e.target.value) })}
              />
              {settings.autoResolveThreshold}
            </label>
          </div>

          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => handleSettingsChange({ notificationsEnabled: e.target.checked })}
              />
              启用通知
            </label>
          </div>

          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.batchProcessingEnabled}
                onChange={(e) => handleSettingsChange({ batchProcessingEnabled: e.target.checked })}
              />
              批量处理
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 冲突项组件
// ============================================================================

interface ConflictItemProps {
  conflict: UnifiedConflict
  isSelected: boolean
  onSelect: () => void
  onResolve: (conflict: UnifiedConflict, resolution: ConflictResolution) => void
  onIgnore: (conflict: UnifiedConflict) => void
}

const ConflictItem: React.FC<ConflictItemProps> = ({
  conflict,
  isSelected,
  onSelect,
  onResolve,
  onIgnore
}) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ff4444'
      case 'high': return '#ff8800'
      case 'medium': return '#ffaa00'
      case 'low': return '#00aa00'
      default: return '#666666'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return '#00aa00'
      case 'resolving': return '#0088ff'
      case 'manual_required': return '#ff4444'
      case 'pending': return '#ffaa00'
      default: return '#666666'
    }
  }

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'card': return '📄'
      case 'folder': return '📁'
      case 'tag': return '🏷️'
      case 'image': return '🖼️'
      default: return '❓'
    }
  }

  return (
    <div
      className={`conflict-item ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="conflict-header">
        <div className="entity-info">
          <span className="entity-icon">{getEntityIcon(conflict.entityType)}</span>
          <span className="entity-id">{conflict.entityId}</span>
        </div>

        <div className="conflict-badges">
          <span
            className="severity-badge"
            style={{ backgroundColor: getSeverityColor(conflict.severity) }}
          >
            {conflict.severity}
          </span>
          <span
            className="status-badge"
            style={{ backgroundColor: getStatusColor(conflict.status) }}
          >
            {conflict.status}
          </span>
        </div>
      </div>

      <div className="conflict-details">
        <div className="conflict-type">{conflict.conflictType}</div>
        <div className="conflict-time">
          {conflict.detectedAt.toLocaleString()}
        </div>
      </div>

      <div className="conflict-actions">
        {conflict.status === 'pending' && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onResolve(conflict, { type: 'keep_local', strategy: 'manual', success: true, timestamp: new Date() })
              }}
            >
              保留本地
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onResolve(conflict, { type: 'keep_cloud', strategy: 'manual', success: true, timestamp: new Date() })
              }}
            >
              保留云端
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onIgnore(conflict)
              }}
            >
              忽略
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// 冲突详情面板组件
// ============================================================================

interface ConflictDetailPanelProps {
  conflict: UnifiedConflict
  onClose: () => void
  onResolve: (conflict: UnifiedConflict, resolution: ConflictResolution) => void
  onIgnore: (conflict: UnifiedConflict) => void
}

const ConflictDetailPanel: React.FC<ConflictDetailPanelProps> = ({
  conflict,
  onClose,
  onResolve,
  onIgnore
}) => {
  const [selectedSuggestion, setSelectedSuggestion] = useState<ConflictSuggestion | null>(null)
  const [customResolution, setCustomResolution] = useState<ConflictResolution | null>(null)

  const handleApplySuggestion = (suggestion: ConflictSuggestion) => {
    const resolution: ConflictResolution = {
      type: suggestion.type,
      strategy: 'suggestion_based',
      reasoning: suggestion.reasoning,
      success: true,
      timestamp: new Date()
    }

    if (suggestion.type === 'merge' && suggestion.mergeStrategy) {
      resolution.mergedData = suggestion.preview
    }

    onResolve(conflict, resolution)
    onClose()
  }

  const handleManualResolve = () => {
    if (customResolution) {
      onResolve(conflict, customResolution)
      onClose()
    }
  }

  return (
    <div className="conflict-detail-panel">
      <div className="detail-header">
        <h3>冲突详情</h3>
        <button onClick={onClose}>关闭</button>
      </div>

      <div className="detail-content">
        <div className="conflict-info">
          <div className="info-row">
            <label>实体类型:</label>
            <span>{conflict.entityType}</span>
          </div>
          <div className="info-row">
            <label>冲突类型:</label>
            <span>{conflict.conflictType}</span>
          </div>
          <div className="info-row">
            <label>严重程度:</label>
            <span>{conflict.severity}</span>
          </div>
          <div className="info-row">
            <label>检测时间:</label>
            <span>{conflict.detectedAt.toLocaleString()}</span>
          </div>
        </div>

        <div className="conflict-data">
          <div className="data-comparison">
            <div className="local-data">
              <h4>本地版本</h4>
              <pre>{JSON.stringify(conflict.localData, null, 2)}</pre>
            </div>
            <div className="cloud-data">
              <h4>云端版本</h4>
              <pre>{JSON.stringify(conflict.cloudData, null, 2)}</pre>
            </div>
          </div>
        </div>

        {conflict.suggestions && conflict.suggestions.length > 0 && (
          <div className="suggestions">
            <h4>建议解决方案</h4>
            <div className="suggestion-list">
              {conflict.suggestions.map(suggestion => (
                <div
                  key={suggestion.id}
                  className={`suggestion-item ${selectedSuggestion?.id === suggestion.id ? 'selected' : ''}`}
                  onClick={() => setSelectedSuggestion(suggestion)}
                >
                  <div className="suggestion-header">
                    <span className="suggestion-type">{suggestion.type}</span>
                    <span className="suggestion-confidence">
                      置信度: {(suggestion.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="suggestion-description">
                    {suggestion.description}
                  </div>
                  <div className="suggestion-reasoning">
                    {suggestion.reasoning}
                  </div>
                  {selectedSuggestion?.id === suggestion.id && (
                    <button onClick={() => handleApplySuggestion(suggestion)}>
                      应用此建议
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="manual-resolution">
          <h4>手动解决</h4>
          <div className="resolution-options">
            <button
              onClick={() => setCustomResolution({
                type: 'keep_local',
                strategy: 'manual',
                success: true,
                timestamp: new Date()
              })}
            >
              保留本地版本
            </button>
            <button
              onClick={() => setCustomResolution({
                type: 'keep_cloud',
                strategy: 'manual',
                success: true,
                timestamp: new Date()
              })}
            >
              保留云端版本
            </button>
            <button
              onClick={() => setCustomResolution({
                type: 'merge',
                strategy: 'manual',
                success: true,
                timestamp: new Date()
              })}
            >
              合并版本
            </button>
          </div>

          {customResolution && (
            <div className="custom-resolution-actions">
              <button onClick={handleManualResolve}>
                应用解决方案
              </button>
              <button onClick={() => setCustomResolution(null)}>
                取消
              </button>
            </div>
          )}
        </div>

        <div className="detail-actions">
          <button onClick={() => onIgnore(conflict)}>
            忽略冲突
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 导出组件
// ============================================================================

export default ConflictManagementPanel