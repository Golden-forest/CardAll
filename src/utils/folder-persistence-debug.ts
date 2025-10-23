/**
 * 文件夹持久化调试工具
 * 用于诊断和修复文件夹数据持久化问题
 */

export class FolderPersistenceDebugger {
  private static instance: FolderPersistenceDebugger

  private constructor() {}

  public static getInstance(): FolderPersistenceDebugger {
    if (!FolderPersistenceDebugger.instance) {
      FolderPersistenceDebugger.instance = new FolderPersistenceDebugger()
    }
    return FolderPersistenceDebugger.instance
  }

  /**
   * 获取当前存储状态信息
   */
  async getStorageStatus(): Promise<{
    indexedDB: {
      folders: number
      hasData: boolean
      lastUpdated?: Date
    }
    localStorage: {
      hasFolders: boolean
      hasBackup: boolean
      hasMigrationFlag: boolean
      hasRestoreFlag: boolean
    }
    migration: {
      completed: boolean
      needsRestore: boolean
    }
  }> {
    try {
      // 检查IndexedDB状态
      const dbFolders = await db.folders.toArray()
      const indexedDBStatus = {
        folders: dbFolders.length,
        hasData: dbFolders.length > 0,
        lastUpdated: dbFolders.length > 0 ? new Date(Math.max(...dbFolders.map(f => f.updatedAt.getTime()))) : undefined
      }

      // 检查localStorage状态
      const localStorageStatus = {
        hasFolders: !!localStorage.getItem('cardall_folders'),
        hasBackup: !!localStorage.getItem('cardall_folders_backup'),
        hasMigrationFlag: !!localStorage.getItem('cardall_folder_migration_complete'),
        hasRestoreFlag: !!localStorage.getItem('cardall_folder_data_needs_restore')
      }

      // 检查迁移状态
      const migrationStatus = {
        completed: localStorageStatus.hasMigrationFlag,
        needsRestore: localStorageStatus.hasRestoreFlag
      }

      return {
        indexedDB: indexedDBStatus,
        localStorage: localStorageStatus,
        migration: migrationStatus
      }
    } catch (error) {
      console.error('获取存储状态失败:', error)
      throw error
    }
  }

  /**
   * 清理所有存储数据（谨慎使用）
   */
  async clearAllStorage(): Promise<void> {
    if (!confirm('确定要清理所有文件夹数据吗？此操作不可恢复！')) {
      return
    }

    try {
      console.log('开始清理所有存储数据...')

      // 清空IndexedDB
      await db.folders.clear()
      console.log('IndexedDB数据已清空')

      // 清理localStorage相关数据
      const keysToRemove = [
        'cardall_folders',
        'cardall_folders_backup',
        'cardall_folder_migration_complete',
        'cardall_folder_data_needs_restore',
        'cardall_folders_repair_backup'
      ]

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
      })

      console.log('localStorage数据已清理')
      console.log('所有存储数据清理完成')
    } catch (error) {
      console.error('清理存储数据失败:', error)
      throw error
    }
  }

  /**
   * 强制重新迁移数据
   */
  async forceMigration(): Promise<void> {
    try {
      console.log('开始强制重新迁移数据...')

      // 清理迁移标记
      localStorage.removeItem('cardall_folder_migration_complete')

      // 获取当前内存中的数据作为源数据
      const currentFolders = await db.folders.toArray()

      if (currentFolders.length > 0) {
        console.log('使用IndexedDB中的数据进行迁移')
        // 将数据保存到localStorage作为迁移源
        localStorage.setItem('cardall_folders', JSON.stringify({
          version: '1.0',
          timestamp: Date.now(),
          data: currentFolders,
          meta: {
            encrypted: false,
            compressed: false
          }
        }))
      }

      console.log('强制迁移准备完成，请刷新页面以执行迁移')
    } catch (error) {
      console.error('强制迁移失败:', error)
      throw error
    }
  }

  /**
   * 创建数据快照
   */
  async createSnapshot(): Promise<string> {
    try {
      const snapshot = {
        timestamp: new Date().toISOString(),
        indexedDB: await db.folders.toArray(),
        localStorage: {
          folders: localStorage.getItem('cardall_folders'),
          backup: localStorage.getItem('cardall_folders_backup'),
          migrationComplete: localStorage.getItem('cardall_folder_migration_complete'),
          needsRestore: localStorage.getItem('cardall_folder_data_needs_restore')
        }
      }

      const snapshotId = `snapshot_${Date.now()}`
      localStorage.setItem(`folder_snapshot_${snapshotId}`, JSON.stringify(snapshot))

      console.log(`数据快照已创建: ${snapshotId}`)
      return snapshotId
    } catch (error) {
      console.error('创建数据快照失败:', error)
      throw error
    }
  }

  /**
   * 恢复数据快照
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    try {
      const snapshotData = localStorage.getItem(`folder_snapshot_${snapshotId}`)
      if (!snapshotData) {
        throw new Error(`快照 ${snapshotId} 不存在`)
      }

      const snapshot = JSON.parse(snapshotData)

      // 恢复IndexedDB数据
      await db.folders.clear()
      if (snapshot.indexedDB.length > 0) {
        await db.folders.bulkAdd(snapshot.indexedDB)
      }

      // 恢复localStorage数据
      Object.entries(snapshot.localStorage).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          localStorage.setItem(`cardall_${key.replace('localStorage.', '')}`, value)
        }
      })

      console.log(`数据快照已恢复: ${snapshotId}`)
    } catch (error) {
      console.error('恢复数据快照失败:', error)
      throw error
    }
  }

  /**
   * 验证数据完整性
   */
  async verifyDataIntegrity(): Promise<{
    isValid: boolean
    issues: string[]
    suggestions: string[]
  }> {
    const issues: string[] = []
    const suggestions: string[] = []

    try {
      // 检查IndexedDB数据完整性
      const dbFolders = await db.folders.toArray()

      // 检查ID唯一性
      const ids = new Set()
      const duplicateIds = new Set()
      dbFolders.forEach(folder => {
        if (ids.has(folder.id)) {
          duplicateIds.add(folder.id)
        } else {
          ids.add(folder.id)
        }
      })

      if (duplicateIds.size > 0) {
        issues.push(`发现重复的文件夹ID: ${Array.from(duplicateIds).join(', ')}`)
      }

      // 检查文件夹引用完整性
      const folderIds = new Set(dbFolders.map(f => f.id))
      const invalidParentIds = dbFolders
        .filter(f => f.parentId && !folderIds.has(f.parentId))
        .map(f => f.id)

      if (invalidParentIds.length > 0) {
        issues.push(`发现无效的父文件夹引用: ${invalidParentIds.join(', ')}`)
        suggestions.push('检查文件夹的parentId字段是否正确')
      }

      // 检查必填字段
      const requiredFields = ['id', 'name', 'color', 'icon', 'createdAt', 'updatedAt']
      const missingFields = dbFolders
        .filter(folder => requiredFields.some(field => !folder[field as keyof typeof folder]))
        .map(f => f.id)

      if (missingFields.length > 0) {
        issues.push(`发现缺少必填字段的文件夹: ${missingFields.join(', ')}`)
      }

      // 检查日期格式
      const invalidDates = dbFolders
        .filter(folder => {
          const createdAt = new Date(folder.createdAt)
          const updatedAt = new Date(folder.updatedAt)
          return isNaN(createdAt.getTime()) || isNaN(updatedAt.getTime())
        })
        .map(f => f.id)

      if (invalidDates.length > 0) {
        issues.push(`发现无效日期格式的文件夹: ${invalidDates.join(', ')}`)
      }

      // 检查localStorage和IndexedDB的数据一致性
      const localStorageFolders = localStorage.getItem('cardall_folders')
      if (localStorageFolders) {
        try {
          const parsed = JSON.parse(localStorageFolders)
          if (Array.isArray(parsed.data)) {
            const localStorageCount = parsed.data.length
            const indexedDBCount = dbFolders.length

            if (Math.abs(localStorageCount - indexedDBCount) > 1) {
              issues.push(`localStorage和IndexedDB中的文件夹数量不一致: ${localStorageCount} vs ${indexedDBCount}`)
              suggestions.push('建议重新执行数据迁移')
            }
          }
        } catch (error) {
          issues.push('localStorage中的文件夹数据格式无效')
        }
      }

      // 检查迁移状态
      const migrationComplete = localStorage.getItem('cardall_folder_migration_complete')
      const needsRestore = localStorage.getItem('cardall_folder_data_needs_restore')

      if (!migrationComplete && dbFolders.length > 0) {
        issues.push('IndexedDB中有数据但迁移未标记为完成')
        suggestions.push('建议手动标记迁移完成')
      }

      if (needsRestore) {
        issues.push('发现需要恢复的数据标记')
        suggestions.push('建议执行数据恢复操作')
      }

      const isValid = issues.length === 0

      console.log('数据完整性检查完成:', {
        isValid,
        issuesCount: issues.length,
        suggestionsCount: suggestions.length
      })

      return {
        isValid,
        issues,
        suggestions
      }
    } catch (error) {
      console.error('数据完整性检查失败:', error)
      return {
        isValid: false,
        issues: ['数据完整性检查失败'],
        suggestions: ['请检查数据库连接是否正常']
      }
    }
  }

  /**
   * 生成诊断报告
   */
  async generateDiagnosticReport(): Promise<string> {
    try {
      const status = await this.getStorageStatus()
      const integrity = await this.verifyDataIntegrity()

      const report = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        storageStatus: status,
        dataIntegrity: integrity,
        recommendations: this.generateRecommendations(status, integrity)
      }

      const reportJson = JSON.stringify(report, null, 2)
      console.log('诊断报告已生成:', reportJson)

      return reportJson
    } catch (error) {
      console.error('生成诊断报告失败:', error)
      throw error
    }
  }

  /**
   * 生成修复建议
   */
  private generateRecommendations(
    status: any,
    integrity: any
  ): string[] {
    const recommendations: string[] = []

    if (!status.migration.completed && status.indexedDB.hasData) {
      recommendations.push('手动标记迁移完成以避免重复迁移')
    }

    if (status.migration.needsRestore) {
      recommendations.push('执行数据恢复操作以恢复丢失的数据')
    }

    if (status.localStorage.hasFolders && !status.migration.needsRestore) {
      recommendations.push('清理localStorage中的旧数据以避免混淆')
    }

    if (!integrity.isValid) {
      recommendations.push('根据数据完整性检查结果修复发现的问题')
    }

    if (status.indexedDB.folders === 0) {
      recommendations.push('检查是否有默认数据需要初始化')
    }

    return recommendations
  }
}

// 导出调试工具实例
export const folderDebugger = FolderPersistenceDebugger.getInstance()

// 导出便捷函数
export const debugFolderPersistence = {
  getStatus: () => folderDebugger.getStorageStatus(),
  clearStorage: () => folderDebugger.clearAllStorage(),
  forceMigration: () => folderDebugger.forceMigration(),
  createSnapshot: () => folderDebugger.createSnapshot(),
  restoreSnapshot: (id: string) => folderDebugger.restoreSnapshot(id),
  verifyIntegrity: () => folderDebugger.verifyDataIntegrity(),
  generateReport: () => folderDebugger.generateDiagnosticReport()
}