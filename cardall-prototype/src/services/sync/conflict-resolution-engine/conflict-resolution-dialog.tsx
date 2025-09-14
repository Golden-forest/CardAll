// ============================================================================
// 冲突解决对话框组件 - W3-T003
// 提供详细的冲突解决对话框，支持手动解决和自动解决
// Week 3 Day 11-13: 同步服务架构重构
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import {
  UnifiedConflict,
  ConflictResolution,
  ConflictSuggestion,
  FieldResolution,
  MergeStrategy
} from './unified-conflict-resolution-engine'

// ============================================================================
// 组件 Props 接口
// ============================================================================

interface ConflictResolutionDialogProps {
  // 基础配置
  isOpen: boolean
  conflict: UnifiedConflict | null
  onClose: () => void

  // 解决配置
  autoResolveEnabled?: boolean
  showDiffView?: boolean
  showFieldLevelResolution?: boolean
  enableAdvancedOptions?: boolean

  // 回调函数
  onResolve: (conflict: UnifiedConflict, resolution: ConflictResolution) => void
  onIgnore: (conflict: UnifiedConflict) => void
  onAutoResolve: (conflict: UnifiedConflict) => void

  // 样式配置
  theme?: 'light' | 'dark'
  size?: 'small' | 'medium' | 'large' | 'fullscreen'
}

interface DialogState {
  selectedResolution: 'keep_local' | 'keep_cloud' | 'merge' | 'manual' | null
  selectedSuggestion: ConflictSuggestion | null
  customResolutions: FieldResolution[]
  mergeStrategy: MergeStrategy | null
  previewData: any
  isProcessing: boolean
}

// ============================================================================
// 主组件
// ============================================================================

export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  isOpen,
  conflict,
  onClose,
  autoResolveEnabled = true,
  showDiffView = true,
  showFieldLevelResolution = true,
  enableAdvancedOptions = true,
  onResolve,
  onIgnore,
  onAutoResolve,
  theme = 'light',
  size = 'large'
}) => {
  // 对话框状态
  const [state, setState] = useState<DialogState>({
    selectedResolution: null,
    selectedSuggestion: null,
    customResolutions: [],
    mergeStrategy: null,
    previewData: null,
    isProcessing: false
  })

  // 重置状态
  const resetState = useCallback(() => {
    setState({
      selectedResolution: null,
      selectedSuggestion: null,
      customResolutions: [],
      mergeStrategy: null,
      previewData: null,
      isProcessing: false
    })
  }, [])

  // 当冲突变化时重置状态
  useEffect(() => {
    if (conflict) {
      resetState()
    }
  }, [conflict, resetState])

  // ============================================================================
  // 解决方案处理函数
  // ============================================================================

  const handleSelectResolution = (resolutionType: 'keep_local' | 'keep_cloud' | 'merge' | 'manual') => {
    setState(prev => ({
      ...prev,
      selectedResolution: resolutionType,
      selectedSuggestion: null
    }))

    // 生成预览数据
    generatePreviewData(resolutionType, conflict!)
  }

  const handleSelectSuggestion = (suggestion: ConflictSuggestion) => {
    setState(prev => ({
      ...prev,
      selectedSuggestion: suggestion,
      selectedResolution: suggestion.type
    }))

    // 生成预览数据
    generatePreviewData(suggestion.type, conflict!, suggestion)
  }

  const generatePreviewData = (
    resolutionType: 'keep_local' | 'keep_cloud' | 'merge' | 'manual',
    conflict: UnifiedConflict,
    suggestion?: ConflictSuggestion
  ) => {
    let previewData: any

    switch (resolutionType) {
      case 'keep_local':
        previewData = conflict.localData
        break

      case 'keep_cloud':
        previewData = conflict.cloudData
        break

      case 'merge':
        previewData = generateMergePreview(conflict, suggestion)
        break

      case 'manual':
        previewData = generateManualPreview(conflict)
        break

      default:
        previewData = null
    }

    setState(prev => ({
      ...prev,
      previewData
    }))
  }

  const generateMergePreview = (conflict: UnifiedConflict, suggestion?: ConflictSuggestion): any => {
    // 智能合并预览
    if (suggestion && suggestion.preview) {
      return suggestion.preview
    }

    // 默认合并策略
    const merged = { ...conflict.localData }

    if (conflict.entityType === 'card') {
      const local = conflict.localData
      const remote = conflict.cloudData

      // 合并标签
      if (local.content?.frontContent?.tags && remote.content?.frontContent?.tags) {
        merged.content.frontContent.tags = [
          ...new Set([
            ...local.content.frontContent.tags,
            ...remote.content.frontContent.tags
          ])
        ]
      }

      // 合并样式
      if (local.style && remote.style) {
        merged.style = {
          ...local.style,
          ...remote.style
        }
      }
    }

    return merged
  }

  const generateManualPreview = (conflict: UnifiedConflict): any => {
    // 基于自定义字段分辨率生成预览
    const preview = { ...conflict.localData }

    state.customResolutions.forEach(resolution => {
      if (resolution.resolution === 'cloud') {
        // 从云端数据获取字段值
        setNestedValue(preview, resolution.fieldName, getNestedValue(conflict.cloudData, resolution.fieldName))
      } else if (resolution.resolution === 'local') {
        // 从本地数据获取字段值
        setNestedValue(preview, resolution.fieldName, getNestedValue(conflict.localData, resolution.fieldName))
      } else if (resolution.resolution === 'custom') {
        // 使用自定义值
        setNestedValue(preview, resolution.fieldName, resolution.value)
      }
    })

    return preview
  }

  // ============================================================================
  // 字段级分辨率处理
  // ============================================================================

  const handleFieldResolutionChange = (fieldName: string, resolution: FieldResolution) => {
    setState(prev => {
      const existingIndex = prev.customResolutions.findIndex(r => r.fieldName === fieldName)
      const updatedResolutions = [...prev.customResolutions]

      if (existingIndex >= 0) {
        updatedResolutions[existingIndex] = resolution
      } else {
        updatedResolutions.push(resolution)
      }

      return {
        ...prev,
        customResolutions: updatedResolutions
      }
    })
  }

  // ============================================================================
  // 应用解决方案
  // ============================================================================

  const handleApplyResolution = async () => {
    if (!conflict || !state.selectedResolution) return

    setState(prev => ({ ...prev, isProcessing: true }))

    try {
      const resolution: ConflictResolution = {
        type: state.selectedResolution,
        strategy: state.selectedSuggestion?.reasoning || 'manual',
        mergedData: state.previewData,
        manualChanges: state.customResolutions,
        reasoning: state.selectedSuggestion?.reasoning || '手动解决',
        success: true,
        timestamp: new Date()
      }

      await new Promise(resolve => setTimeout(resolve, 500)) // 模拟异步操作

      onResolve(conflict, resolution)
      onClose()
    } catch (error) {
      console.error('应用解决方案失败:', error)
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }))
    }
  }

  const handleAutoResolve = async () => {
    if (!conflict) return

    setState(prev => ({ ...prev, isProcessing: true }))

    try {
      await new Promise(resolve => setTimeout(resolve, 1000)) // 模拟异步操作

      onAutoResolve(conflict)
      onClose()
    } catch (error) {
      console.error('自动解决失败:', error)
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }))
    }
  }

  const handleIgnore = () => {
    if (!conflict) return

    onIgnore(conflict)
    onClose()
  }

  // ============================================================================
  // 辅助函数
  // ============================================================================

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  const setNestedValue = (obj: any, path: string, value: any): void => {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => current?.[key], obj)

    if (target) {
      target[lastKey] = value
    }
  }

  const getConflictingFields = (conflict: UnifiedConflict): string[] => {
    const fields: string[] = []

    if (conflict.conflictFields) {
      return conflict.conflictFields
    }

    // 根据冲突类型推断冲突字段
    switch (conflict.conflictType) {
      case 'content':
        if (conflict.entityType === 'card') {
          fields.push('content.frontContent.title', 'content.frontContent.text')
          fields.push('content.backContent.title', 'content.backContent.text')
        }
        break

      case 'field':
        fields.push('未知字段')
        break

      case 'structure':
        fields.push('结构字段')
        break

      default:
        fields.push('通用字段')
    }

    return fields
  }

  // ============================================================================
  // 渲染函数
  // ============================================================================

  if (!isOpen || !conflict) return null

  return (
    <div className={`conflict-resolution-dialog ${theme} ${size}`}>
      <div className="dialog-overlay" onClick={onClose}>
        <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
          {/* 对话框头部 */}
          <div className="dialog-header">
            <div className="header-left">
              <h2>解决冲突</h2>
              <div className="conflict-meta">
                <span className="entity-type">{conflict.entityType}</span>
                <span className="conflict-type">{conflict.conflictType}</span>
                <span className={`severity ${conflict.severity}`}>{conflict.severity}</span>
              </div>
            </div>

            <div className="header-right">
              {autoResolveEnabled && (
                <button
                  className="auto-resolve-btn"
                  onClick={handleAutoResolve}
                  disabled={state.isProcessing}
                >
                  自动解决
                </button>
              )}
              <button className="ignore-btn" onClick={handleIgnore}>
                忽略
              </button>
              <button className="close-btn" onClick={onClose}>
                ×
              </button>
            </div>
          </div>

          {/* 对话框主体 */}
          <div className="dialog-body">
            {/* 冲突信息 */}
            <div className="conflict-info-section">
              <h3>冲突信息</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>实体ID:</label>
                  <span>{conflict.entityId}</span>
                </div>
                <div className="info-item">
                  <label>检测时间:</label>
                  <span>{conflict.detectedAt.toLocaleString()}</span>
                </div>
                <div className="info-item">
                  <label>来源设备:</label>
                  <span>{conflict.sourceDevice}</span>
                </div>
                <div className="info-item">
                  <label>冲突字段:</label>
                  <span>{getConflictingFields(conflict).join(', ')}</span>
                </div>
              </div>
            </div>

            {/* 建议解决方案 */}
            {conflict.suggestions && conflict.suggestions.length > 0 && (
              <div className="suggestions-section">
                <h3>建议解决方案</h3>
                <div className="suggestions-grid">
                  {conflict.suggestions.map(suggestion => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      isSelected={state.selectedSuggestion?.id === suggestion.id}
                      onSelect={() => handleSelectSuggestion(suggestion)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 解决方案选择 */}
            <div className="resolution-section">
              <h3>选择解决方案</h3>
              <div className="resolution-options">
                <ResolutionOption
                  type="keep_local"
                  title="保留本地版本"
                  description="保留本地设备上的版本，覆盖云端版本"
                  isSelected={state.selectedResolution === 'keep_local'}
                  onSelect={() => handleSelectResolution('keep_local')}
                />

                <ResolutionOption
                  type="keep_cloud"
                  title="保留云端版本"
                  description="保留云端版本，覆盖本地版本"
                  isSelected={state.selectedResolution === 'keep_cloud'}
                  onSelect={() => handleSelectResolution('keep_cloud')}
                />

                <ResolutionOption
                  type="merge"
                  title="合并版本"
                  description="智能合并本地和云端版本的内容"
                  isSelected={state.selectedResolution === 'merge'}
                  onSelect={() => handleSelectResolution('merge')}
                />

                <ResolutionOption
                  type="manual"
                  title="手动解决"
                  description="自定义每个字段的解决方案"
                  isSelected={state.selectedResolution === 'manual'}
                  onSelect={() => handleSelectResolution('manual')}
                />
              </div>
            </div>

            {/* 字段级分辨率 */}
            {showFieldLevelResolution && state.selectedResolution === 'manual' && (
              <div className="field-resolution-section">
                <h3>字段级分辨率</h3>
                <div className="field-resolutions">
                  {getConflictingFields(conflict).map(fieldName => (
                    <FieldResolutionItem
                      key={fieldName}
                      fieldName={fieldName}
                      localValue={getNestedValue(conflict.localData, fieldName)}
                      cloudValue={getNestedValue(conflict.cloudData, fieldName)}
                      resolution={state.customResolutions.find(r => r.fieldName === fieldName)}
                      onChange={(resolution) => handleFieldResolutionChange(fieldName, resolution)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 预览区域 */}
            {state.previewData && (
              <div className="preview-section">
                <h3>预览</h3>
                <div className="preview-content">
                  <div className="preview-header">
                    <span>解决后的数据预览</span>
                  </div>
                  <div className="preview-data">
                    <pre>{JSON.stringify(state.previewData, null, 2)}</pre>
                  </div>
                </div>
              </div>
            )}

            {/* 差异视图 */}
            {showDiffView && state.selectedResolution !== 'manual' && (
              <div className="diff-section">
                <h3>差异视图</h3>
                <DiffView
                  localData={conflict.localData}
                  cloudData={conflict.cloudData}
                  resolutionType={state.selectedResolution}
                  previewData={state.previewData}
                />
              </div>
            )}
          </div>

          {/* 对话框底部 */}
          <div className="dialog-footer">
            <div className="footer-left">
              <button className="cancel-btn" onClick={onClose}>
                取消
              </button>
            </div>

            <div className="footer-right">
              <button
                className="apply-btn"
                onClick={handleApplyResolution}
                disabled={!state.selectedResolution || state.isProcessing}
              >
                {state.isProcessing ? '处理中...' : '应用解决方案'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 子组件
// ============================================================================

interface SuggestionCardProps {
  suggestion: ConflictSuggestion
  isSelected: boolean
  onSelect: () => void
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({ suggestion, isSelected, onSelect }) => {
  return (
    <div
      className={`suggestion-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
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

      {suggestion.estimatedTime && (
        <div className="suggestion-estimate">
          预计时间: {suggestion.estimatedTime}秒
        </div>
      )}
    </div>
  )
}

interface ResolutionOptionProps {
  type: 'keep_local' | 'keep_cloud' | 'merge' | 'manual'
  title: string
  description: string
  isSelected: boolean
  onSelect: () => void
}

const ResolutionOption: React.FC<ResolutionOptionProps> = ({
  type,
  title,
  description,
  isSelected,
  onSelect
}) => {
  const getIcon = () => {
    switch (type) {
      case 'keep_local': return '💻'
      case 'keep_cloud': return '☁️'
      case 'merge': return '🔀'
      case 'manual': return '🛠️'
    }
  }

  return (
    <div
      className={`resolution-option ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="option-icon">{getIcon()}</div>
      <div className="option-content">
        <div className="option-title">{title}</div>
        <div className="option-description">{description}</div>
      </div>
    </div>
  )
}

interface FieldResolutionItemProps {
  fieldName: string
  localValue: any
  cloudValue: any
  resolution?: FieldResolution
  onChange: (resolution: FieldResolution) => void
}

const FieldResolutionItem: React.FC<FieldResolutionItemProps> = ({
  fieldName,
  localValue,
  cloudValue,
  resolution,
  onChange
}) => {
  const [selectedResolution, setSelectedResolution] = useState<ResolutionOption>(
    resolution?.resolution || 'local'
  )
  const [customValue, setCustomValue] = useState(resolution?.value || '')

  type ResolutionOption = 'local' | 'cloud' | 'merge' | 'custom'

  const handleResolutionChange = (option: ResolutionOption) => {
    setSelectedResolution(option)

    const newResolution: FieldResolution = {
      fieldName,
      resolution: option,
      value: option === 'custom' ? customValue : undefined,
      reasoning: `手动选择${option}解决方案`
    }

    onChange(newResolution)
  }

  const handleCustomValueChange = (value: string) => {
    setCustomValue(value)

    const newResolution: FieldResolution = {
      fieldName,
      resolution: 'custom',
      value,
      reasoning: '自定义值'
    }

    onChange(newResolution)
  }

  return (
    <div className="field-resolution-item">
      <div className="field-name">{fieldName}</div>

      <div className="field-values">
        <div className="value local">
          <label>本地:</label>
          <span>{JSON.stringify(localValue)}</span>
        </div>

        <div className="value cloud">
          <label>云端:</label>
          <span>{JSON.stringify(cloudValue)}</span>
        </div>
      </div>

      <div className="resolution-options">
        <label>
          <input
            type="radio"
            name={`resolution-${fieldName}`}
            checked={selectedResolution === 'local'}
            onChange={() => handleResolutionChange('local')}
          />
          保留本地
        </label>

        <label>
          <input
            type="radio"
            name={`resolution-${fieldName}`}
            checked={selectedResolution === 'cloud'}
            onChange={() => handleResolutionChange('cloud')}
          />
          保留云端
        </label>

        <label>
          <input
            type="radio"
            name={`resolution-${fieldName}`}
            checked={selectedResolution === 'custom'}
            onChange={() => handleResolutionChange('custom')}
          />
          自定义
        </label>
      </div>

      {selectedResolution === 'custom' && (
        <div className="custom-value-input">
          <input
            type="text"
            value={customValue}
            onChange={(e) => handleCustomValueChange(e.target.value)}
            placeholder="输入自定义值..."
          />
        </div>
      )}
    </div>
  )
}

interface DiffViewProps {
  localData: any
  cloudData: any
  resolutionType: string | null
  previewData: any
}

const DiffView: React.FC<DiffViewProps> = ({
  localData,
  cloudData,
  resolutionType,
  previewData
}) => {
  const getDiffData = () => {
    switch (resolutionType) {
      case 'keep_local':
        return {
          removed: cloudData,
          added: localData
        }
      case 'keep_cloud':
        return {
          removed: localData,
          added: cloudData
        }
      case 'merge':
        return {
          removed: {},
          added: previewData
        }
      default:
        return { removed: {}, added: {} }
    }
  }

  const diff = getDiffData()

  return (
    <div className="diff-view">
      <div className="diff-content">
        <div className="diff-local">
          <h4>本地版本</h4>
          <pre>{JSON.stringify(localData, null, 2)}</pre>
        </div>

        <div className="diff-cloud">
          <h4>云端版本</h4>
          <pre>{JSON.stringify(cloudData, null, 2)}</pre>
        </div>

        <div className="diff-result">
          <h4>解决结果</h4>
          <pre>{JSON.stringify(previewData, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 导出组件
// ============================================================================

export default ConflictResolutionDialog