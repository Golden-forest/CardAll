// ============================================================================
// 冲突通知组件 - W3-T003
// 提供实时的冲突通知和提醒功能
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import { UnifiedConflict, ConflictSuggestion } from './unified-conflict-resolution-engine'

// ============================================================================
// 组件 Props 接口
// ============================================================================

interface ConflictNotificationProps {
  // 通知配置
  enabled?: boolean
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  maxNotifications?: number
  duration?: number

  // 过滤器
  severityFilter?: ('low' | 'medium' | 'high' | 'critical')[]
  entityTypeFilter?: ('card' | 'folder' | 'tag' | 'image')[]

  // 回调函数
  onNotificationClick?: (conflict: UnifiedConflict) => void
  onNotificationDismiss?: (conflictId: string) => void
  onAutoResolve?: (conflict: UnifiedConflict) => void

  // 样式配置
  theme?: 'light' | 'dark'
  soundEnabled?: boolean
  vibrationEnabled?: boolean
}

interface NotificationItem {
  id: string
  conflict: UnifiedConflict
  timestamp: Date
  isRead: boolean
  isDismissed: boolean
  actions: NotificationAction[]
}

interface NotificationAction {
  id: string
  label: string
  type: 'resolve' | 'ignore' | 'view_details' | 'auto_resolve'
  handler: () => void
}

// ============================================================================
// 主组件
// ============================================================================

export const ConflictNotification: React.FC<ConflictNotificationProps> = ({
  enabled = true,
  position = 'top-right',
  maxNotifications = 10,
  duration = 5000,
  severityFilter = ['high', 'critical'],
  entityTypeFilter = ['card', 'folder'],
  onNotificationClick,
  onNotificationDismiss,
  onAutoResolve,
  theme = 'light',
  soundEnabled = false,
  vibrationEnabled = false
}) => {
  // 状态管理
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [conflictStream, setConflictStream] = useState<UnifiedConflict[]>([])

  // ============================================================================
  // 冲突流处理
  // ============================================================================

  const processConflictStream = useCallback((newConflicts: UnifiedConflict[]) => {
    if (!enabled) return

    const filteredConflicts = newConflicts.filter(conflict => {
      // 严重程度过滤
      if (severityFilter.length > 0 && !severityFilter.includes(conflict.severity)) {
        return false
      }

      // 实体类型过滤
      if (entityTypeFilter.length > 0 && !entityTypeFilter.includes(conflict.entityType)) {
        return false
      }

      // 避免重复通知
      const existingNotification = notifications.find(n => n.conflict.id === conflict.id)
      if (existingNotification) {
        return false
      }

      return true
    })

    filteredConflicts.forEach(conflict => {
      const notification: NotificationItem = {
        id: `notification-${conflict.id}-${Date.now()}`,
        conflict,
        timestamp: new Date(),
        isRead: false,
        isDismissed: false,
        actions: createNotificationActions(conflict)
      }

      setNotifications(prev => {
        // 保持最大数量限制
        const updated = [...prev, notification]
        return updated.slice(-maxNotifications)
      })

      // 播放通知声音
      if (soundEnabled) {
        playNotificationSound(conflict.severity)
      }

      // 触发振动
      if (vibrationEnabled) {
        triggerVibration(conflict.severity)
      }
    })
  }, [enabled, severityFilter, entityTypeFilter, notifications, maxNotifications, soundEnabled, vibrationEnabled])

  // ============================================================================
  // 通知动作创建
  // ============================================================================

  const createNotificationActions = (conflict: UnifiedConflict): NotificationAction[] => {
    const actions: NotificationAction[] = []

    // 自动解决动作（仅在置信度高时显示）
    if (conflict.suggestions && conflict.suggestions.length > 0) {
      const bestSuggestion = conflict.suggestions[0]
      if (bestSuggestion.confidence > 0.8) {
        actions.push({
          id: 'auto_resolve',
          label: '自动解决',
          type: 'auto_resolve',
          handler: () => handleAutoResolve(conflict)
        })
      }
    }

    // 快速解决动作
    actions.push({
      id: 'resolve_keep_local',
      label: '保留本地',
      type: 'resolve',
      handler: () => handleQuickResolve(conflict, 'keep_local')
    })

    actions.push({
      id: 'resolve_keep_cloud',
      label: '保留云端',
      type: 'resolve',
      handler: () => handleQuickResolve(conflict, 'keep_cloud')
    })

    // 查看详情动作
    actions.push({
      id: 'view_details',
      label: '查看详情',
      type: 'view_details',
      handler: () => handleViewDetails(conflict)
    })

    // 忽略动作
    actions.push({
      id: 'ignore',
      label: '忽略',
      type: 'ignore',
      handler: () => handleIgnoreConflict(conflict.id)
    })

    return actions
  }

  // ============================================================================
  // 事件处理函数
  // ============================================================================

  const handleAutoResolve = (conflict: UnifiedConflict) => {
    onAutoResolve?.(conflict)
    dismissNotification(conflict.id)
  }

  const handleQuickResolve = (conflict: UnifiedConflict, resolutionType: 'keep_local' | 'keep_cloud') => {
    // 这里应该调用实际的解决API
    console.log(`快速解决冲突 ${conflict.id}: ${resolutionType}`)
    dismissNotification(conflict.id)
  }

  const handleViewDetails = (conflict: UnifiedConflict) => {
    onNotificationClick?.(conflict)
    markAsRead(conflict.id)
  }

  const handleIgnoreConflict = (conflictId: string) => {
    onNotificationDismiss?.(conflictId)
    dismissNotification(conflictId)
  }

  const handleNotificationClick = (notification: NotificationItem) => {
    onNotificationClick?.(notification.conflict)
    markAsRead(notification.id)
  }

  const dismissNotification = (conflictId: string) => {
    setNotifications(prev => prev.map(n =>
      n.conflict.id === conflictId ? { ...n, isDismissed: true } : n
    ))

    // 延迟移除通知
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.conflict.id !== conflictId))
    }, 300)
  }

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => prev.map(n =>
      n.id === notificationId ? { ...n, isRead: true } : n
    ))
  }

  const dismissAll = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isDismissed: true })))

    setTimeout(() => {
      setNotifications([])
    }, 300)
  }

  // ============================================================================
  // 音频和振动反馈
  // ============================================================================

  const playNotificationSound = (severity: string) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // 根据严重程度设置不同的音调
      switch (severity) {
        case 'critical':
          oscillator.frequency.value = 800
          gainNode.gain.value = 0.3
          break
        case 'high':
          oscillator.frequency.value = 600
          gainNode.gain.value = 0.2
          break
        case 'medium':
          oscillator.frequency.value = 400
          gainNode.gain.value = 0.1
          break
        default:
          oscillator.frequency.value = 300
          gainNode.gain.value = 0.05
      }

      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.2)
    } catch (error) {
      console.warn('无法播放通知声音:', error)
    }
  }

  const triggerVibration = (severity: string) => {
    if ('vibrate' in navigator) {
      const patterns = {
        critical: [200, 100, 200],
        high: [200, 50],
        medium: [100],
        low: [50]
      }

      navigator.vibrate(patterns[severity as keyof typeof patterns] || [100])
    }
  }

  // ============================================================================
  // 自动清理和过期处理
  // ============================================================================

  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      const now = Date.now()
      setNotifications(prev => {
        const updated = prev.filter(notification => {
          const age = now - notification.timestamp.getTime()
          return age < duration || !notification.isDismissed
        })
        return updated
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [enabled, duration])

  // ============================================================================
  // 模拟冲突流（在实际实现中应该从事件总线或WebSocket接收）
  // ============================================================================

  useEffect(() => {
    if (!enabled) return

    // 模拟冲突检测事件
    const mockConflictDetection = setInterval(() => {
      // 这里只是演示，实际应该从冲突检测器接收事件
    }, 30000)

    return () => clearInterval(mockConflictDetection)
  }, [enabled])

  // ============================================================================
  // 渲染函数
  // ============================================================================

  if (!enabled || notifications.length === 0) return null

  const visibleNotifications = notifications.filter(n => !n.isDismissed)

  return (
    <div className={`conflict-notification-container ${position} ${theme}`}>
      {/* 通知头部 */}
      <div className="notification-header">
        <div className="header-info">
          <span className="notification-count">
            {visibleNotifications.length} 个新冲突
          </span>
          <span className="notification-summary">
            {visibleNotifications.filter(n => n.conflict.severity === 'critical').length} 个严重冲突
          </span>
        </div>
        <button className="dismiss-all-btn" onClick={dismissAll}>
          全部清除
        </button>
      </div>

      {/* 通知列表 */}
      <div className="notification-list">
        {visibleNotifications.map(notification => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onClick={() => handleNotificationClick(notification)}
            onDismiss={() => dismissNotification(notification.conflict.id)}
            onAction={action => action.handler()}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// 通知卡片组件
// ============================================================================

interface NotificationCardProps {
  notification: NotificationItem
  onClick: () => void
  onDismiss: () => void
  onAction: (action: NotificationAction) => void
}

const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  onClick,
  onDismiss,
  onAction
}) => {
  const { conflict, timestamp, isRead, actions } = notification

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ff4444'
      case 'high': return '#ff8800'
      case 'medium': return '#ffaa00'
      case 'low': return '#00aa00'
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

  const getTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    return `${Math.floor(diff / 86400000)} 天前`
  }

  return (
    <div
      className={`notification-card ${isRead ? 'read' : 'unread'} ${conflict.severity}`}
      onClick={onClick}
    >
      {/* 通知头部 */}
      <div className="card-header">
        <div className="entity-info">
          <span className="entity-icon">{getEntityIcon(conflict.entityType)}</span>
          <div className="entity-details">
            <span className="entity-type">{conflict.entityType}</span>
            <span className="entity-id">{conflict.entityId}</span>
          </div>
        </div>

        <div className="severity-indicator">
          <div
            className="severity-dot"
            style={{ backgroundColor: getSeverityColor(conflict.severity) }}
          />
          <span className="severity-text">{conflict.severity}</span>
        </div>

        <button
          className="dismiss-btn"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
        >
          ×
        </button>
      </div>

      {/* 通知内容 */}
      <div className="card-content">
        <div className="conflict-type">{conflict.conflictType}</div>
        <div className="conflict-description">
          {getConflictDescription(conflict)}
        </div>
        <div className="notification-time">
          {getTimeAgo(timestamp)}
        </div>
      </div>

      {/* 快速操作 */}
      <div className="card-actions">
        {actions.slice(0, 3).map(action => (
          <button
            key={action.id}
            className={`action-btn ${action.type}`}
            onClick={(e) => {
              e.stopPropagation()
              onAction(action)
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* 建议预览 */}
      {conflict.suggestions && conflict.suggestions.length > 0 && (
        <div className="suggestion-preview">
          <div className="preview-title">建议:</div>
          <div className="preview-content">
            {conflict.suggestions[0].description}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 辅助函数
// ============================================================================

const getConflictDescription = (conflict: UnifiedConflict): string => {
  const typeDescriptions = {
    version: '版本冲突',
    content: '内容冲突',
    structure: '结构冲突',
    delete: '删除冲突',
    field: '字段冲突'
  }

  const entityDescriptions = {
    card: '卡片',
    folder: '文件夹',
    tag: '标签',
    image: '图片'
  }

  return `${entityDescriptions[conflict.entityType]} ${typeDescriptions[conflict.conflictType]}`
}

// ============================================================================
// 导出组件
// ============================================================================

export default ConflictNotification