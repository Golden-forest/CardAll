// 本地备份功能的类型定义

export interface BackupMetadata {
  id: string
  name: string
  description?: string
  createdAt: Date
  size: number // 备份文件大小（字节）
  compressedSize: number // 压缩后大小
  version: string // 备份格式版本
  cardCount: number
  folderCount: number
  tagCount: number
  imageCount: number
  isAutoBackup: boolean
  isCompressed: boolean
  encryptionEnabled: boolean
  checksum: string // 数据校验和
  tags: string[] // 备份标签
}

export interface BackupData {
  metadata: BackupMetadata
  cards: any[]
  folders: any[]
  tags: any[]
  images: any[]
  settings: Record<string, any>
  exportTime: Date
  appVersion: string
}

export interface BackupOptions {
  name?: string
  description?: string
  includeImages: boolean
  includeSettings: boolean
  compress: boolean
  encrypt: boolean
  password?: string
  tags?: string[]
}

export interface BackupSchedule {
  id: string
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  timeOfDay: string // HH:MM 格式
  lastRun?: Date
  nextRun?: Date
  maxBackups: number // 保留的最大备份数量
  includeImages: boolean
  compress: boolean
  encrypt: boolean
  name: string
}

export interface BackupProgress {
  stage: 'preparing' | 'collecting' | 'processing' | 'compressing' | 'encrypting' | 'saving' | 'completed' | 'error'
  progress: number // 0-100
  message: string
  details?: any
  startTime: Date
  estimatedTimeRemaining?: number
}

export interface ImportOptions {
  strategy: 'replace' | 'merge' | 'skip-existing'
  importImages: boolean
  importSettings: boolean
  preserveIds: boolean
  validateData: boolean
  createBackup: boolean
  password?: string
  selectedTypes?: ('cards' | 'folders' | 'tags' | 'images' | 'settings')[]
}

export interface ImportResult {
  success: boolean
  totalItems: number
  importedItems: {
    cards: number
    folders: number
    tags: number
    images: number
    settings: number
  }
  skippedItems: {
    cards: number
    folders: number
    tags: number
    images: number
  }
  errors: string[]
  warnings: string[]
  duration: number
  createdBackup?: string
}

export interface DataIntegrityIssue {
  type: 'orphaned-card' | 'orphaned-folder' | 'orphaned-tag' | 'missing-image' | 'invalid-reference' | 'corrupted-data'
  severity: 'low' | 'medium' | 'high' | 'critical'
  entityId: string
  entityType: 'card' | 'folder' | 'tag' | 'image'
  description: string
  suggestedAction: 'delete' | 'repair' | 'manual-review' | 'ignore'
  details?: any
}

export interface IntegrityCheckResult {
  isValid: boolean
  totalEntities: {
    cards: number
    folders: number
    tags: number
    images: number
  }
  issues: DataIntegrityIssue[]
  checkTime: Date
  recommendations: string[]
  autoFixable: boolean
}

export interface BackupStorageStats {
  totalBackups: number
  totalSize: number
  oldestBackup?: Date
  newestBackup?: Date
  autoBackupCount: number
  manualBackupCount: number
  compressedSize: number
  compressionRatio: number
}