/**
 * 操作撤销/重做管理器
 * 提供完整的操作历史记录和撤销功能
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Toast, ToastDescription, ToastProvider, ToastViewport } from '@/components/ui/toast'

export interface UndoRedoAction {
  id: string
  type: 'create' | 'update' | 'delete' | 'move'
  entityType: 'card' | 'folder' | 'tag'
  entityId: string
  description: string
  timestamp: Date

  // 操作前的数据（用于撤销）
  before?: {
    data: Record<string, unknown>
    state: Record<string, unknown>
  }

  // 操作后的数据（用于重做）
  after?: {
    data: Record<string, unknown>
    state: Record<string, unknown>
  }

  // 自定义撤销/重做函数
  undo?: () => Promise<void>
  redo?: () => Promise<void>
}

export interface UndoRedoManagerProps {
  maxHistory?: number
  autoSave?: boolean
  onUndo?: (action: UndoRedoAction) => void
  onRedo?: (action: UndoRedoAction) => void
}

export function UndoRedoManager({
  maxHistory = 50,
  autoSave = true,
  onUndo,
  onRedo
}: UndoRedoManagerProps) {
  const [history, setHistory] = useState<UndoRedoAction[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [showHistory, setShowHistory] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // 从本地存储加载历史记录
  useEffect(() => {
    if (autoSave) {
      try {
        const saved = localStorage.getItem('cardall-undo-history')
        const savedIndex = localStorage.getItem('cardall-undo-current-index')

        if (saved) {
          const parsedHistory = JSON.parse(saved)
          const parsedIndex = savedIndex ? parseInt(savedIndex) : -1

          // 验证数据格式
          if (Array.isArray(parsedHistory) && parsedHistory.every(isValidAction)) {
            setHistory(parsedHistory)
            setCurrentIndex(parsedIndex)
          }
        }
      } catch (error) {
        console.warn('Failed to load undo history:', error)
      }
    }
  }, [autoSave])

  // 保存历史记录到本地存储
  useEffect(() => {
    if (autoSave) {
      try {
        localStorage.setItem('cardall-undo-history', JSON.stringify(history))
        localStorage.setItem('cardall-undo-current-index', currentIndex.toString())
      } catch (error) {
        console.warn('Failed to save undo history:', error)
      }
    }
  }, [history, currentIndex, autoSave])

  // 验证操作数据格式
  const isValidAction = (action: unknown): action is UndoRedoAction => {
    if (typeof action !== 'object' || action === null) return false
    const obj = action as UndoRedoAction

    return (
      typeof obj.id === 'string' &&
      typeof obj.type === 'string' &&
      typeof obj.entityType === 'string' &&
      typeof obj.entityId === 'string' &&
      typeof obj.description === 'string' &&
      obj.timestamp instanceof Date
    )
  }

  // 添加新的操作到历史记录
  const addAction = useCallback((action: Omit<UndoRedoAction, 'id' | 'timestamp'>) => {
    const newAction: UndoRedoAction = {
      ...action,
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    }

    setHistory(prev => {
      // 移除当前位置之后的所有操作
      const newHistory = prev.slice(0, currentIndex + 1)

      // 添加新操作
      newHistory.push(newAction)

      // 限制历史记录长度
      if (newHistory.length > maxHistory) {
        return newHistory.slice(-maxHistory)
      }

      return newHistory
    })

    setCurrentIndex(prev => prev + 1)

    // 显示操作成功提示
    showToast(`已执行: ${action.description}`, 'success')
  }, [currentIndex, maxHistory])

  // 撤销操作
  const undo = useCallback(async () => {
    if (currentIndex < 0) return

    const action = history[currentIndex]
    try {
      // 执行撤销操作
      if (action.undo) {
        await action.undo()
      } else {
        // 默认撤销逻辑
        await performDefaultUndo(action)
      }

      setCurrentIndex(prev => prev - 1)
      onUndo?.(action)
      showToast(`已撤销: ${action.description}`, 'success')
    } catch (error) {
      console.error('Undo failed:', error)
      showToast(`撤销失败: ${action.description}`, 'error')
    }
  }, [currentIndex, history, onUndo])

  // 重做操作
  const redo = useCallback(async () => {
    if (currentIndex >= history.length - 1) return

    const action = history[currentIndex + 1]
    try {
      // 执行重做操作
      if (action.redo) {
        await action.redo()
      } else {
        // 默认重做逻辑
        await performDefaultRedo(action)
      }

      setCurrentIndex(prev => prev + 1)
      onRedo?.(action)
      showToast(`已重做: ${action.description}`, 'success')
    } catch (error) {
      console.error('Redo failed:', error)
      showToast(`重做失败: ${action.description}`, 'error')
    }
  }, [currentIndex, history, onRedo])

  // 默认撤销逻辑
  const performDefaultUndo = async (action: UndoRedoAction) => {
    // 这里可以根据不同的操作类型执行默认的撤销逻辑
    console.log('Performing default undo for:', action)
  }

  // 默认重做逻辑
  const performDefaultRedo = async (action: UndoRedoAction) => {
    // 这里可以根据不同的操作类型执行默认的重做逻辑
    console.log('Performing default redo for:', action)
  }

  // 清除历史记录
  const clearHistory = () => {
    setHistory([])
    setCurrentIndex(-1)
    if (autoSave) {
      localStorage.removeItem('cardall-undo-history')
      localStorage.removeItem('cardall-undo-current-index')
    }
    showToast('已清除操作历史', 'success')
  }

  // 显示提示消息
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Z 撤销
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      }

      // Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y 重做
      if (
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z') ||
        ((event.ctrlKey || event.metaKey) && event.key === 'y')
      ) {
        event.preventDefault()
        redo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  const canUndo = currentIndex >= 0
  const canRedo = currentIndex < history.length - 1

  return (
    <ToastProvider>
      {/* 撤销/重做工具栏 */}
      <div className=\"fixed bottom-4 right-4 z-40 flex gap-2\">
        <Button
          variant=\"outline\"
          size=\"sm\"
          onClick={undo}
          disabled={!canUndo}
          className=\"shadow-lg\"
          aria-label=\"撤销操作\"
        >
          <span className=\"mr-2\">↶</span>
          撤销
          <kbd className=\"ml-2 px-1 py-0.5 bg-muted text-xs rounded\">Ctrl+Z</kbd>
        </Button>

        <Button
          variant=\"outline\"
          size=\"sm\"
          onClick={redo}
          disabled={!canRedo}
          className=\"shadow-lg\"
          aria-label=\"重做操作\"
        >
          <span className=\"mr-2\">↷</span>
          重做
          <kbd className=\"ml-2 px-1 py-0.5 bg-muted text-xs rounded\">Ctrl+Y</kbd>
        </Button>

        <Button
          variant=\"ghost\"
          size=\"sm\"
          onClick={() => setShowHistory(!showHistory)}
          className=\"shadow-lg\"
          aria-label=\"显示操作历史\"
        >
          <span className=\"mr-2\">📋</span>
          历史 ({history.length})
        </Button>
      </div>

      {/* 操作历史面板 */}
      {showHistory && (
        <>
          {/* 背景遮罩 */}
          <div
            className=\"fixed inset-0 bg-black bg-opacity-50 z-40\"
            onClick={() => setShowHistory(false)}
            role=\"presentation\"
            aria-hidden=\"true\"
          />

          {/* 历史面板 */}
          <div className=\"fixed top-4 left-4 z-50 w-96 max-h-[80vh] overflow-hidden flex flex-col\">
            <Card className=\"shadow-2xl\">
              <CardContent className=\"p-4\">
                <div className=\"flex justify-between items-center mb-4\">
                  <h3 className=\"font-medium text-lg\">操作历史</h3>
                  <div className=\"flex gap-2\">
                    <Button
                      variant=\"outline\"
                      size=\"sm\"
                      onClick={clearHistory}
                      disabled={history.length === 0}
                    >
                      清除
                    </Button>
                    <Button
                      variant=\"ghost\"
                      size=\"sm\"
                      onClick={() => setShowHistory(false)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>

                <div className=\"space-y-2 max-h-[60vh] overflow-y-auto\">
                  {history.length === 0 ? (
                    <div className=\"text-center text-muted-foreground py-8\">
                      暂无操作历史
                    </div>
                  ) : (
                    history.map((action, index) => (
                      <HistoryItem
                        key={action.id}
                        action={action}
                        isActive={index === currentIndex}
                        isFuture={index > currentIndex}
                        onClick={() => {
                          if (index <= currentIndex) {
                            setCurrentIndex(index - 1)
                          } else {
                            setCurrentIndex(index)
                          }
                        }}
                      />
                    ))
                  )}
                </div>

                <div className=\"mt-4 pt-4 border-t text-sm text-muted-foreground\">
                  <div className=\"flex justify-between\">
                    <span>总计: {history.length} 个操作</span>
                    <span>当前位置: {currentIndex + 1}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Toast 通知 */}
      {toast && (
        <div className=\"fixed top-4 right-4 z-50\">
          <div className={`p-4 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'
          }`}>
            <ToastDescription>{toast.message}</ToastDescription>
          </div>
        </div>
      )}

      <ToastViewport />
    </ToastProvider>
  )
}

// 历史记录项组件
function HistoryItem({
  action,
  isActive,
  isFuture,
  onClick
}: {
  action: UndoRedoAction
  isActive: boolean
  isFuture: boolean
  onClick: () => void
}) {
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create': return '➕'
      case 'update': return '✏️'
      case 'delete': return '🗑️'
      case 'move': return '📍'
      default: return '📝'
    }
  }

  const getActionColor = (type: string) => {
    switch (type) {
      case 'create': return 'bg-green-100 text-green-800'
      case 'update': return 'bg-blue-100 text-blue-800'
      case 'delete': return 'bg-red-100 text-red-800'
      case 'move': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'card': return '🃏'
      case 'folder': return '📁'
      case 'tag': return '🏷️'
      default: return '📄'
    }
  }

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
        isActive
          ? 'border-primary bg-primary/10'
          : isFuture
          ? 'border-dashed border-muted-foreground/30 opacity-60'
          : 'border-muted hover:border-primary/50'
      }`}
    >
      <div className=\"flex items-start gap-3\">
        <div className=\"flex flex-col items-center gap-1\">
          <span className=\"text-lg\">{getActionIcon(action.type)}</span>
          <Badge variant=\"secondary\" className={`text-xs ${getActionColor(action.type)}`}>
            {action.type}
          </Badge>
        </div>

        <div className=\"flex-1 min-w-0\">
          <div className=\"flex items-center gap-2 mb-1\">
            <span className=\"text-sm\">{getEntityIcon(action.entityType)}</span>
            <span className=\"font-medium text-sm truncate\">{action.description}</span>
          </div>

          <div className=\"text-xs text-muted-foreground\">
            {action.timestamp.toLocaleTimeString()}
          </div>

          {isActive && (
            <Badge variant=\"outline\" className=\"text-xs mt-1\">
              当前状态
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

// 操作创建工具函数
export const createUndoAction = (
  type: UndoRedoAction['type'],
  entityType: UndoRedoAction['entityType'],
  entityId: string,
  description: string,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
  undo?: () => Promise<void>,
  redo?: () => Promise<void>
): Omit<UndoRedoAction, 'id' | 'timestamp'> => ({
  type,
  entityType,
  entityId,
  description,
  before: before ? { data: before, state: {} } : undefined,
  after: after ? { data: after, state: {} } : undefined,
  undo,
  redo
})

// 撤销管理器 Hook
export function useUndoRedoManager() {
  const [actions, setActions] = useState<(() => void)[]>([])

  const addAction = useCallback((action: () => void) => {
    setActions(prev => [...prev, action])
  }, [])

  const executeActions = useCallback(async () => {
    for (const action of actions) {
      try {
        await action()
      } catch (error) {
        console.error('Failed to execute action:', error)
      }
    }
    setActions([])
  }, [actions])

  return {
    addAction,
    executeActions,
    hasPendingActions: actions.length > 0
  }
}