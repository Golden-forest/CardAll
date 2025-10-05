import { getDatabase } from './database'
import { BackupMetadata, BackupData, BackupOptions, BackupProgress } from '@/types/backup'
import { Card, Folder, Tag } from '@/types/card'

export class SimpleBackupService {
  private db = getDatabase()

  // 创建备份
  async createBackup(options: BackupOptions = {
    includeImages: true,
    includeSettings: true,
    compress: false,
    encrypt: false
  }, onProgress?: (progress: BackupProgress) => void): Promise<string> {
    const startTime = new Date()
    const backupId = crypto.randomUUID()

    try {
      // 准备阶段
      onProgress?.({
        stage: 'preparing',
        progress: 0,
        message: '正在准备备份...',
        startTime,
        estimatedTimeRemaining: 0
      })

      // 收集数据阶段
      onProgress?.({
        stage: 'collecting',
        progress: 20,
        message: '正在收集数据...',
        startTime,
        estimatedTimeRemaining: 30
      })

      const [cards, folders, tags, images, settings] = await Promise.all([
        this.collectCards(),
        this.collectFolders(),
        this.collectTags(),
        options.includeImages ? this.collectImages() : [],
        options.includeSettings ? this.collectSettings() : {}
      ])

      // 处理数据阶段
      onProgress?.({
        stage: 'processing',
        progress: 60,
        message: '正在处理数据...',
        startTime,
        estimatedTimeRemaining: 15
      })

      const backupData: BackupData = {
        metadata: {
          id: backupId,
          name: options.name || `备份_${new Date().toISOString().split('T')[0]}`,
          description: options.description,
          createdAt: new Date(),
          size: 0,
          compressedSize: 0,
          version: '1.0.0',
          cardCount: cards.length,
          folderCount: folders.length,
          tagCount: tags.length,
          imageCount: images.length,
          isAutoBackup: false,
          isCompressed: false,
          encryptionEnabled: false,
          checksum: '',
          tags: options.tags || []
        },
        cards,
        folders,
        tags,
        images,
        settings,
        exportTime: new Date(),
        appVersion: '1.0.0-local'
      })

      // 计算数据大小
      const dataSize = this.calculateDataSize(backupData)
      backupData.metadata.size = dataSize
      backupData.metadata.compressedSize = dataSize

      // 计算校验和
      backupData.metadata.checksum = await this.calculateChecksum(backupData)

      // 保存阶段
      onProgress?.({
        stage: 'saving',
        progress: 90,
        message: '正在保存备份...',
        startTime,
        estimatedTimeRemaining: 5
      })

      await this.saveBackup(backupData)

      // 完成
      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: '备份创建完成',
        startTime,
        estimatedTimeRemaining: 0
      })

      console.log(`备份创建成功: ${backupId}`)
      return backupId

    } catch (error) {
      console.error('创建备份失败:', error)
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: `备份失败: ${error}`,
        startTime,
        estimatedTimeRemaining: 0,
        details: error
      })
      throw error
    }
  }

  // 收集卡片数据
  private async collectCards(): Promise<any[]> {
    try {
      const cards = await this.db.cards.toArray()
      return cards.map(card => ({
        ...card,
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.updatedAt.toISOString()
      }))
    } catch (error) {
      console.warn('收集卡片数据失败:', error)
      return []
    }
  }

  // 收集文件夹数据
  private async collectFolders(): Promise<any[]> {
    try {
      const folders = await this.db.folders.toArray()
      return folders.map(folder => ({
        ...folder,
        createdAt: folder.createdAt.toISOString(),
        updatedAt: folder.updatedAt.toISOString()
      }))
    } catch (error) {
      console.warn('收集文件夹数据失败:', error)
      return []
    }
  }

  // 收集标签数据
  private async collectTags(): Promise<any[]> {
    try {
      const tags = await this.db.tags.toArray()
      return tags.map(tag => ({
        ...tag,
        createdAt: tag.createdAt.toISOString()
      }))
    } catch (error) {
      console.warn('收集标签数据失败:', error)
      return []
    }
  }

  // 收集图片数据
  private async collectImages(): Promise<any[]> {
    try {
      const images = await this.db.images.toArray()
      return images.map(image => ({
        ...image,
        createdAt: image.createdAt.toISOString(),
        updatedAt: image.updatedAt.toISOString()
      }))
    } catch (error) {
      console.warn('收集图片数据失败:', error)
      return []
    }
  }

  // 收集设置数据
  private async collectSettings(): Promise<Record<string, any>> {
    try {
      const settings = await this.db.settings.toArray()
      const settingsMap: Record<string, any> = {}

      settings.forEach(setting => {
        settingsMap[setting.key] = setting.value
      })

      return settingsMap
    } catch (error) {
      console.warn('收集设置数据失败:', error)
      return {}
    }
  }

  // 计算数据大小
  private calculateDataSize(data: any): number {
    try {
      const jsonString = JSON.stringify(data)
      return new Blob([jsonString]).size
    } catch (error) {
      console.warn('计算数据大小失败:', error)
      return 0
    }
  }

  // 计算校验和
  private async calculateChecksum(data: any): Promise<string> {
    try {
      const jsonString = JSON.stringify(data)
      const encoder = new TextEncoder()
      const dataUint8Array = encoder.encode(jsonString)
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataUint8Array)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
      console.warn('计算校验和失败:', error)
      return ''
    }
  }

  // 保存备份
  private async saveBackup(data: BackupData): Promise<void> {
    try {
      const key = `backup_${data.metadata.id}`

      // 使用localStorage存储备份元数据
      const metadataKey = `backup_meta_${data.metadata.id}`
      localStorage.setItem(metadataKey, JSON.stringify(data.metadata))

      // 使用IndexedDB存储完整备份数据
      await this.db.settings.add({
        key,
        value: data,
        scope: 'global',
        updatedAt: new Date()
      })

      // 更新备份列表
      await this.updateBackupList(data.metadata.id)
    } catch (error) {
      console.error('保存备份失败:', error)
      throw error
    }
  }

  // 更新备份列表
  private async updateBackupList(backupId: string): Promise<void> {
    try {
      const listKey = 'backup_list'
      const existingList = await this.db.settings.where('key').equals(listKey).first()
      let backupList: string[] = []

      if (existingList?.value) {
        backupList = existingList.value
      }

      // 添加新备份ID到开头
      backupList.unshift(backupId)

      // 限制备份列表长度
      if (backupList.length > 20) {
        const toRemove = backupList.splice(20)
        for (const id of toRemove) {
          localStorage.removeItem(`backup_meta_${id}`)
          await this.db.settings.where('key').equals(`backup_${id}`).delete()
        }
      }

      // 保存更新后的列表
      if (existingList) {
        await this.db.settings.update(existingList.id!, { value: backupList })
      } else {
        await this.db.settings.add({
          key: listKey,
          value: backupList,
          scope: 'global',
          updatedAt: new Date()
        })
      }
    } catch (error) {
      console.warn('更新备份列表失败:', error)
    }
  }

  // 获取备份列表
  async getBackupList(): Promise<BackupMetadata[]> {
    try {
      const listKey = 'backup_list'
      const listRecord = await this.db.settings.where('key').equals(listKey).first()

      if (!listRecord?.value) {
        return []
      }

      const backupIds: string[] = listRecord.value
      const backups: BackupMetadata[] = []

      for (const id of backupIds) {
        const metadataKey = `backup_meta_${id}`
        const metadataString = localStorage.getItem(metadataKey)

        if (metadataString) {
          try {
            const metadata = JSON.parse(metadataString)
            metadata.createdAt = new Date(metadata.createdAt)
            backups.push(metadata)
          } catch (error) {
            console.warn(`解析备份元数据失败: ${id}`, error)
          }
        }
      }

      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    } catch (error) {
      console.error('获取备份列表失败:', error)
      return []
    }
  }

  // 获取备份数据
  async getBackup(backupId: string): Promise<BackupData | null> {
    try {
      const key = `backup_${backupId}`
      const setting = await this.db.settings.where('key').equals(key).first()

      if (setting?.value) {
        const backupData = setting.value
        // 转换日期字符串
        backupData.metadata.createdAt = new Date(backupData.metadata.createdAt)
        backupData.exportTime = new Date(backupData.exportTime)
        return backupData
      }

      return null
    } catch (error) {
      console.error('获取备份数据失败:', error)
      return null
    }
  }

  // 删除备份
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      // 从localStorage删除元数据
      localStorage.removeItem(`backup_meta_${backupId}`)

      // 从IndexedDB删除备份数据
      await this.db.settings.where('key').equals(`backup_${backupId}`).delete()

      // 更新备份列表
      const listKey = 'backup_list'
      const listRecord = await this.db.settings.where('key').equals(listKey).first()

      if (listRecord?.value) {
        let backupList: string[] = listRecord.value
        backupList = backupList.filter(id => id !== backupId)
        await this.db.settings.update(listRecord.id!, { value: backupList })
      }

      console.log(`备份已删除: ${backupId}`)
      return true
    } catch (error) {
      console.error('删除备份失败:', error)
      return false
    }
  }

  // 导出备份文件
  async exportBackup(backupId: string): Promise<void> {
    try {
      const backupData = await this.getBackup(backupId)
      if (!backupData) {
        throw new Error('备份不存在')
      }

      const filename = `${backupData.metadata.name}_${new Date().toISOString().split('T')[0]}.json`
      const jsonString = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })

      // 创建下载链接
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log(`备份已导出: ${filename}`)
    } catch (error) {
      console.error('导出备份失败:', error)
      throw error
    }
  }

  // 获取备份存储统计
  async getBackupStorageStats(): Promise<{
    totalBackups: number
    totalSize: number
    oldestBackup?: Date
    newestBackup?: Date
    autoBackupCount: number
    manualBackupCount: number
    compressedSize: number
    compressionRatio: number
  }> {
    try {
      const backups = await this.getBackupList()

      const totalBackups = backups.length
      const totalSize = backups.reduce((sum, backup) => sum + (backup.size || 0), 0)
      const compressedSize = backups.reduce((sum, backup) => sum + (backup.compressedSize || 0), 0)

      const autoBackupCount = backups.filter(b => b.isAutoBackup).length
      const manualBackupCount = totalBackups - autoBackupCount

      const dates = backups.map(b => b.createdAt).filter(Boolean) as Date[]
      const oldestBackup = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : undefined
      const newestBackup = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined

      const compressionRatio = totalSize > 0 ? compressedSize / totalSize : 1

      return {
        totalBackups,
        totalSize,
        oldestBackup,
        newestBackup,
        autoBackupCount,
        manualBackupCount,
        compressedSize,
        compressionRatio
      }
    } catch (error) {
      console.error('获取备份统计失败:', error)
      return {
        totalBackups: 0,
        totalSize: 0,
        autoBackupCount: 0,
        manualBackupCount: 0,
        compressedSize: 0,
        compressionRatio: 1
      }
    }
  }

  // 清理所有备份
  async clearAllBackups(): Promise<void> {
    try {
      const listKey = 'backup_list'
      const listRecord = await this.db.settings.where('key').equals(listKey).first()

      if (listRecord?.value) {
        const backupIds: string[] = listRecord.value

        for (const id of backupIds) {
          localStorage.removeItem(`backup_meta_${id}`)
          await this.db.settings.where('key').equals(`backup_${id}`).delete()
        }

        await this.db.settings.delete(listRecord.id!)
      }

      console.log('所有备份已清理')
    } catch (error) {
      console.error('清理备份失败:', error)
      throw error
    }
  }
}

// 导出单例实例
export const simpleBackupService = new SimpleBackupService()