// 冲突检测和解决相关的类型定义

export interface ConflictBase {
  id: string
  type: ConflictType
  entityType: EntityType
  entityId: string
  timestamp: Date
  sourceDevice: string
  severity: ConflictSeverity
  status: ConflictStatus
  createdAt: Date
  resolvedAt?: Date
  resolvedBy?: string
  resolution?: ConflictResolution
}

export interface CardConflict extends ConflictBase {
  type: 'card_content' | 'card_style' | 'card_tags' | 'card_folder'
  entityType: 'card'
  entityId: string
  localVersion: CardVersion
  remoteVersion: CardVersion
  conflictFields: string[]
  suggestions?: ConflictSuggestion[]
}

export interface FolderConflict extends ConflictBase {
  type: 'folder_name' | 'folder_structure' | 'folder_parent'
  entityType: 'folder'
  entityId: string
  localVersion: FolderVersion
  remoteVersion: FolderVersion
  affectedCards: string[]
}

export interface TagConflict extends ConflictBase {
  type: 'tag_rename' | 'tag_delete' | 'tag_color'
  entityType: 'tag'
  entityId: string
  localVersion: TagVersion
  remoteVersion: TagVersion
  affectedCards: string[]
}

export interface CardVersion {
  content: {
    frontContent: {
      title: string
      text: string
      tags: string[]
      lastModified: Date
    }
    backContent: {
      title: string
      text: string
      tags: string[]
      lastModified: Date
    }
  }
  style: {
    type: 'solid' | 'gradient' | 'glass'
    backgroundColor?: string
    gradientColors?: string[]
    fontFamily: string
    fontSize: 'sm' | 'base' | 'lg' | 'xl'
    fontWeight: 'normal' | 'medium' | 'semibold' | 'bold'
    textColor: string
    borderRadius: string
    shadow: string
    borderWidth: number
  }
  folderId?: string
  isFlipped: boolean
  updatedAt: Date
  version: string
}

export interface FolderVersion {
  name: string
  color: string
  icon?: string
  parentId?: string
  cardIds: string[]
  isExpanded: boolean
  updatedAt: Date
  version: string
}

export interface TagVersion {
  name: string
  color: string
  count: number
  isHidden: boolean
  updatedAt: Date
  version: string
}

export interface ConflictSuggestion {
  type: 'keep_local' | 'keep_remote' | 'merge' | 'manual'
  confidence: number // 0-1
  reason: string
  preview?: any
}

export interface ConflictResolution {
  type: 'keep_local' | 'keep_remote' | 'merge' | 'manual'
  mergedData?: any
  reason?: string
  manualChanges?: ConflictManualChange[]
}

export interface ConflictManualChange {
  field: string
  value: any
  source: 'local' | 'remote' | 'custom'
}

export type ConflictType = 
  | 'card_content'
  | 'card_style' 
  | 'card_tags'
  | 'card_folder'
  | 'folder_name'
  | 'folder_structure'
  | 'folder_parent'
  | 'tag_rename'
  | 'tag_delete'
  | 'tag_color'

export type EntityType = 'card' | 'folder' | 'tag'

export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical'

export type ConflictStatus = 'pending' | 'reviewing' | 'resolved' | 'ignored'

// 冲突检测器接口
export interface ConflictDetector {
  detectConflicts(): Promise<ConflictBase[]>
  resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<boolean>
  getSuggestions(conflict: ConflictBase): Promise<ConflictSuggestion[]>
}

// 冲突统计信息
export interface ConflictStats {
  totalConflicts: number
  resolvedConflicts: number
  pendingConflicts: number
  conflictsByType: Record<ConflictType, number>
  conflictsBySeverity: Record<ConflictSeverity, number>
  averageResolutionTime: number
}