// 数据一致性检查器 - 确保本地数据和云端数据的一致性
import { db } from './database-simple'
import { authService } from './auth'
import { cloudSyncService } from './cloud-sync'
import { syncLockManager } from './sync-lock-manager'
import { toast } from '@/hooks/use-toast'

interface ConsistencyCheckResult {
  id: string
  timestamp: Date
  checks: {
    folders: {
      total: number
      inconsistencies: number
      details: Array<{
        type: 'orphaned_card' | 'missing_folder' | 'invalid_parent' | 'data_corruption'
        folderId?: string
        cardId?: string
        description: string
        severity: 'low' | 'medium' | 'high'
      }>
    }
    cards: {
      total: number
      inconsistencies: number
      details: Array<{
        type: 'orphaned_tag' | 'missing_card' | 'invalid_data' | 'data_corruption'
        cardId?: string
        tagId?: string
        description: string
        severity: 'low' | 'medium' | 'high'
      }>
    }
    tags: {
      total: number
      inconsistencies: number
      details: Array<{
        type: 'orphaned_tag' | 'duplicate_tag' | 'invalid_data'
        tagId?: string
        description: string
        severity: 'low' | 'medium' | 'high'
      }>
    }
  }
  summary: {
    totalInconsistencies: number
    highSeverityIssues: number
    autoFixed: number
    requiresManualAction: number
  }
}

interface DataRepairOptions {
  autoFix: boolean
  backupBeforeRepair: boolean
  notifyUser: boolean
}

export class DataConsistencyChecker {
  private static instance: DataConsistencyChecker
  private isChecking = false
  private lastCheckTime: Date | null = null
  private checkHistory: ConsistencyCheckResult[] = []

  static getInstance(): DataConsistencyChecker {
    if (!DataConsistencyChecker.instance) {
      DataConsistencyChecker.instance = new DataConsistencyChecker()
    }
    return DataConsistencyChecker.instance
  }

  // 执行完整的数据一致性检查
  async performFullCheck(options: DataRepairOptions = {
    autoFix: true,
    backupBeforeRepair: true,
    notifyUser: true
  }): Promise<ConsistencyCheckResult> {
    if (this.isChecking) {
      throw new Error('Consistency check already in progress')
    }

    const lockAcquired = await syncLockManager.acquireLocalLock()
    if (!lockAcquired) {
      throw new Error('Failed to acquire local lock for consistency check')
    }

    this.isChecking = true
    const checkId = `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      console.log('🔍 Starting data consistency check:', checkId)
      
      const result: ConsistencyCheckResult = {
        id: checkId,
        timestamp: new Date(),
        checks: {
          folders: await this.checkFolders(),
          cards: await this.checkCards(),
          tags: await this.checkTags()
        },
        summary: {
          totalInconsistencies: 0,
          highSeverityIssues: 0,
          autoFixed: 0,
          requiresManualAction: 0
        }
      }

      // 计算摘要
      result.summary.totalInconsistencies = 
        result.checks.folders.inconsistencies + 
        result.checks.cards.inconsistencies + 
        result.checks.tags.inconsistencies
      
      result.summary.highSeverityIssues = 
        result.checks.folders.details.filter(d => d.severity === 'high').length +
        result.checks.cards.details.filter(d => d.severity === 'high').length +
        result.checks.tags.details.filter(d => d.severity === 'high').length

      // 自动修复
      if (options.autoFix && result.summary.totalInconsistencies > 0) {
        const repairResult = await this.repairInconsistencies(result, options)
        result.summary.autoFixed = repairResult.autoFixed
        result.summary.requiresManualAction = repairResult.requiresManualAction
      }

      // 记录检查历史
      this.checkHistory.push(result)
      if (this.checkHistory.length > 50) {
        this.checkHistory = this.checkHistory.slice(-50)
      }

      this.lastCheckTime = new Date()
      console.log('✅ Data consistency check completed:', result)

      // 通知用户
      if (options.notifyUser) {
        this.notifyUserAboutCheckResult(result)
      }

      return result
    } catch (error) {
      console.error('❌ Data consistency check failed:', error)
      throw error
    } finally {
      this.isChecking = false
      syncLockManager.releaseLocalLock()
    }
  }

  // 检查文件夹一致性
  private async checkFolders() {
    const folders = await db.folders.toArray()
    const cards = await db.cards.toArray()
    const details: ConsistencyCheckResult['checks']['folders']['details'] = []

    console.log(`🔍 Checking ${folders.length} folders for consistency`)

    // 检查孤立的卡片引用
    const allFolderIds = new Set(folders.map(f => f.id))
    for (const card of cards) {
      if (card.folderId && !allFolderIds.has(card.folderId)) {
        details.push({
          type: 'orphaned_card',
          cardId: card.id,
          description: `卡片 "${card.title}" 引用了不存在的文件夹 "${card.folderId}"`,
          severity: 'medium'
        })
      }
    }

    // 检查无效的父文件夹引用
    for (const folder of folders) {
      if (folder.parentId && !allFolderIds.has(folder.parentId)) {
        details.push({
          type: 'invalid_parent',
          folderId: folder.id,
          description: `文件夹 "${folder.name}" 引用了不存在的父文件夹 "${folder.parentId}"`,
          severity: 'high'
        })
      }
    }

    // 检查循环引用
    const visited = new Set<string>()
    for (const folder of folders) {
      if (this.hasCircularReference(folder, folders, visited)) {
        details.push({
          type: 'invalid_parent',
          folderId: folder.id,
          description: `文件夹 "${folder.name}" 存在循环引用`,
          severity: 'high'
        })
      }
    }

    // 检查数据完整性
    for (const folder of folders) {
      if (!folder.name || folder.name.trim() === '') {
        details.push({
          type: 'data_corruption',
          folderId: folder.id,
          description: `文件夹 "${folder.id}" 缺少名称`,
          severity: 'high'
        })
      }
    }

    console.log(`📊 Folder consistency check: ${details.length} issues found`)
    return {
      total: folders.length,
      inconsistencies: details.length,
      details
    }
  }

  // 检查卡片一致性
  private async checkCards() {
    const cards = await db.cards.toArray()
    const tags = await db.tags.toArray()
    const details: ConsistencyCheckResult['checks']['cards']['details'] = []

    console.log(`🔍 Checking ${cards.length} cards for consistency`)

    // 检查孤立的标签引用
    const allTagIds = new Set(tags.map(t => t.id))
    for (const card of cards) {
      if (card.tagIds) {
        for (const tagId of card.tagIds) {
          if (!allTagIds.has(tagId)) {
            details.push({
              type: 'orphaned_tag',
              cardId: card.id,
              tagId,
              description: `卡片 "${card.title}" 引用了不存在的标签 "${tagId}"`,
              severity: 'low'
            })
          }
        }
      }
    }

    // 检查数据完整性
    for (const card of cards) {
      if (!card.title || card.title.trim() === '') {
        details.push({
          type: 'data_corruption',
          cardId: card.id,
          description: `卡片 "${card.id}" 缺少标题`,
          severity: 'high'
        })
      }

      // 检查无效的创建/更新时间
      if (card.createdAt && isNaN(new Date(card.createdAt).getTime())) {
        details.push({
          type: 'invalid_data',
          cardId: card.id,
          description: `卡片 "${card.title}" 有无效的创建时间`,
          severity: 'medium'
        })
      }
    }

    console.log(`📊 Card consistency check: ${details.length} issues found`)
    return {
      total: cards.length,
      inconsistencies: details.length,
      details
    }
  }

  // 检查标签一致性
  private async checkTags() {
    const tags = await db.tags.toArray()
    const details: ConsistencyCheckResult['checks']['tags']['details'] = []

    console.log(`🔍 Checking ${tags.length} tags for consistency`)

    // 检查重复标签
    const tagNameMap = new Map<string, string[]>()
    for (const tag of tags) {
      const normalizedName = tag.name.toLowerCase().trim()
      if (!tagNameMap.has(normalizedName)) {
        tagNameMap.set(normalizedName, [])
      }
      tagNameMap.get(normalizedName)!.push(tag.id)
    }

    for (const [name, ids] of tagNameMap) {
      if (ids.length > 1) {
        details.push({
          type: 'duplicate_tag',
          description: `发现重复的标签名称 "${name}" (${ids.length} 个)`,
          severity: 'medium'
        })
      }
    }

    // 检查数据完整性
    for (const tag of tags) {
      if (!tag.name || tag.name.trim() === '') {
        details.push({
          type: 'invalid_data',
          tagId: tag.id,
          description: `标签 "${tag.id}" 缺少名称`,
          severity: 'high'
        })
      }
    }

    console.log(`📊 Tag consistency check: ${details.length} issues found`)
    return {
      total: tags.length,
      inconsistencies: details.length,
      details
    }
  }

  // 检查循环引用
  private hasCircularReference(folder: any, allFolders: any[], visited: Set<string>, path: string[] = []): boolean {
    if (visited.has(folder.id)) {
      return path.includes(folder.id)
    }

    visited.add(folder.id)
    path.push(folder.id)

    if (folder.parentId) {
      const parent = allFolders.find(f => f.id === folder.parentId)
      if (parent && this.hasCircularReference(parent, allFolders, visited, path)) {
        return true
      }
    }

    path.pop()
    return false
  }

  // 修复不一致性
  private async repairInconsistencies(result: ConsistencyCheckResult, options: DataRepairOptions) {
    let autoFixed = 0
    let requiresManualAction = 0

    console.log('🔧 Starting auto-repair of inconsistencies')

    // 创建备份
    if (options.backupBeforeRepair) {
      await this.createBackup()
    }

    // 修复文件夹问题
    for (const issue of result.checks.folders.details) {
      if (issue.type === 'invalid_parent' && issue.severity === 'high') {
        try {
          if (issue.folderId) {
            await db.folders.update(issue.folderId, { parentId: null })
            console.log(`✅ Fixed invalid parent reference for folder ${issue.folderId}`)
            autoFixed++
          }
        } catch (error) {
          console.error(`Failed to fix folder ${issue.folderId}:`, error)
          requiresManualAction++
        }
      }
    }

    // 修复卡片问题
    for (const issue of result.checks.cards.details) {
      if (issue.type === 'orphaned_tag' && issue.severity === 'low') {
        try {
          if (issue.cardId && issue.tagId) {
            const card = await db.cards.get(issue.cardId)
            if (card && card.tagIds) {
              const updatedTagIds = card.tagIds.filter(id => id !== issue.tagId)
              await db.cards.update(issue.cardId, { tagIds: updatedTagIds })
              console.log(`✅ Fixed orphaned tag reference for card ${issue.cardId}`)
              autoFixed++
            }
          }
        } catch (error) {
          console.error(`Failed to fix card ${issue.cardId}:`, error)
          requiresManualAction++
        }
      }
    }

    console.log(`🔧 Repair completed: ${autoFixed} auto-fixed, ${requiresManualAction} require manual action`)
    return { autoFixed, requiresManualAction }
  }

  // 创建数据备份
  private async createBackup(): Promise<void> {
    try {
      const backup = {
        timestamp: new Date().toISOString(),
        folders: await db.folders.toArray(),
        cards: await db.cards.toArray(),
        tags: await db.tags.toArray(),
        syncQueue: await db.syncQueue.toArray()
      }

      // 保存到localStorage作为简单备份
      const backupKey = `cardall_backup_${Date.now()}`
      localStorage.setItem(backupKey, JSON.stringify(backup))
      
      // 清理旧备份（保留最近5个）
      const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('cardall_backup_'))
      if (backupKeys.length > 5) {
        const keysToDelete = backupKeys.slice(0, -5)
        keysToDelete.forEach(key => localStorage.removeItem(key))
      }

      console.log('💾 Data backup created successfully')
    } catch (error) {
      console.error('Failed to create backup:', error)
      throw error
    }
  }

  // 通知用户检查结果
  private notifyUserAboutCheckResult(result: ConsistencyCheckResult) {
    const { totalInconsistencies, highSeverityIssues, autoFixed } = result.summary

    if (totalInconsistencies === 0) {
      toast({
        title: "数据一致性检查完成",
        description: "未发现任何数据问题，您的数据完全一致",
      })
      return
    }

    let description = `发现 ${totalInconsistencies} 个数据问题`
    if (highSeverityIssues > 0) {
      description += `，其中 ${highSeverityIssues} 个严重问题`
    }
    if (autoFixed > 0) {
      description += `，已自动修复 ${autoFixed} 个`
    }

    toast({
      title: "数据一致性检查完成",
      description,
      variant: highSeverityIssues > 0 ? "destructive" : "default"
    })
  }

  // 获取检查历史
  getCheckHistory(): ConsistencyCheckResult[] {
    return [...this.checkHistory]
  }

  // 获取最后检查时间
  getLastCheckTime(): Date | null {
    return this.lastCheckTime
  }

  // 清理检查历史
  clearCheckHistory(): void {
    this.checkHistory = []
    console.log('🧹 Check history cleared')
  }

  // 获取系统状态
  getSystemStatus(): {
    isChecking: boolean
    lastCheckTime: Date | null
    totalChecks: number
    recentIssues: number
  } {
    const recentChecks = this.checkHistory.slice(-5)
    const recentIssues = recentChecks.reduce((sum, check) => sum + check.summary.totalInconsistencies, 0)

    return {
      isChecking: this.isChecking,
      lastCheckTime: this.lastCheckTime,
      totalChecks: this.checkHistory.length,
      recentIssues
    }
  }
}

// 导出单例实例
export const dataConsistencyChecker = DataConsistencyChecker.getInstance()