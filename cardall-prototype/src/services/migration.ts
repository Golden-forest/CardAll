import { db, DbCard, DbFolder, DbTag } from './database'
import { Card, Folder, Tag } from '@/types/card'
import { fileSystemService } from './file-system'

export class MigrationService {
  // 检查是否有需要迁移的数据
  async hasLegacyData(): Promise<boolean> {
    const hasCards = !!localStorage.getItem('cardall-cards')
    const hasFolders = !!localStorage.getItem('cardall-folders')
    const hasTags = !!localStorage.getItem('cardall-tags')
    
    return hasCards || hasFolders || hasTags
  }

  // 执行完整迁移
  async migrateFromLocalStorage(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedCards: 0,
      migratedFolders: 0,
      migratedTags: 0,
      migratedImages: 0,
      errors: []
    }

    try {
      console.log('Starting migration from localStorage...')

      // 迁移文件夹
      const folders = await this.migrateFolders()
      result.migratedFolders = folders.length

      // 迁移标签
      const tags = await this.migrateTags()
      result.migratedTags = tags.length

      // 迁移卡片（包括图片）
      const { cards, images } = await this.migrateCards()
      result.migratedCards = cards.length
      result.migratedImages = images

      result.success = true
      console.log('Migration completed successfully:', result)

      // 可选：备份原始数据后清理localStorage
      await this.backupLegacyData()
      
    } catch (error) {
          console.warn("操作失败:", error)
        }

    return result
  }

  // 迁移文件夹
  private async migrateFolders(): Promise<DbFolder[]> {
    const foldersData = localStorage.getItem('cardall-folders')
    if (!foldersData) return []

    try {
      const folders: Folder[] = JSON.parse(foldersData)
      const dbFolders: DbFolder[] = folders.map(folder => ({
        ...folder,
        syncVersion: 1,
        pendingSync: true
      }))

      await db.folders.bulkAdd(dbFolders)
      console.log(`Migrated ${dbFolders.length} folders`)
      return dbFolders
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 迁移标签
  private async migrateTags(): Promise<DbTag[]> {
    const tagsData = localStorage.getItem('cardall-tags')
    if (!tagsData) return []

    try {
      const tags: Tag[] = JSON.parse(tagsData)
      const dbTags: DbTag[] = tags.map(tag => ({
        ...tag,
        syncVersion: 1,
        pendingSync: true
      }))

      await db.tags.bulkAdd(dbTags)
      console.log(`Migrated ${dbTags.length} tags`)
      return dbTags
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 迁移卡片和图片
  private async migrateCards(): Promise<{ cards: DbCard[], images: number }> {
    const cardsData = localStorage.getItem('cardall-cards')
    if (!cardsData) return { cards: [], images: 0 }

    try {
      const cards: Card[] = JSON.parse(cardsData)
      const dbCards: DbCard[] = []
      let totalImages = 0

      for (const card of cards) {
        // 处理卡片中的base64图片
        const frontImages = await this.migrateCardImages(card.frontContent.images, card.id, card.folderId)
        const backImages = await this.migrateCardImages(card.backContent.images, card.id, card.folderId)

        totalImages += frontImages.length + backImages.length

        // 创建数据库卡片记录
        const dbCard: DbCard = {
          ...card,
          frontContent: {
            ...card.frontContent,
            images: frontImages
          },
          backContent: {
            ...card.backContent,
            images: backImages
          },
          syncVersion: 1,
          pendingSync: true
        }

        dbCards.push(dbCard)
      }

      await db.cards.bulkAdd(dbCards)
      console.log(`Migrated ${dbCards.length} cards with ${totalImages} images`)
      
      return { cards: dbCards, images: totalImages }
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 迁移卡片中的图片
  private async migrateCardImages(
    images: any[], 
    cardId: string, 
    folderId?: string
  ): Promise<any[]> {
    const migratedImages = []

    for (const image of images) {
      try {
        if (image.url && image.url.startsWith('data:')) {
          // 这是base64图片,需要转换为文件
          const blob = await this.base64ToBlob(image.url)
          const file = new File([blob], image.alt || 'migrated-image.jpg', {
            type: blob.type
          })

          // 使用文件系统服务保存图片
          const processedImage = await fileSystemService.saveImage(file, cardId, folderId)
          
          migratedImages.push({
            id: processedImage.id,
            url: processedImage.filePath, // 现在存储文件路径而不是base64
            alt: image.alt,
            width: processedImage.metadata.width,
            height: processedImage.metadata.height,
            position: image.position,
            size: image.size,
            aspectRatio: processedImage.metadata.width / processedImage.metadata.height
          })
        } else {
          // 非base64图片,保持原样
          migratedImages.push(image)
        }
      } catch (error) {
          console.warn("操作失败:", error)
        }
    }

    return migratedImages
  }

  // Base64转Blob
  private async base64ToBlob(base64: string): Promise<Blob> {
    const response = await fetch(base64)
    return response.blob()
  }

  // 备份原始数据
  private async backupLegacyData(): Promise<void> {
    const backup = {
      cards: localStorage.getItem('cardall-cards'),
      folders: localStorage.getItem('cardall-folders'),
      tags: localStorage.getItem('cardall-tags'),
      hiddenTags: localStorage.getItem('cardall-hidden-tags'),
      timestamp: new Date().toISOString()
    }

    // 保存备份到数据库
    await db.settings.add({
      key: 'legacy_backup',
      value: backup,
      updatedAt: new Date()
    })

    console.log('Legacy data backed up successfully')
  }

  // 清理localStorage数据（可选）
  async cleanupLegacyData(): Promise<void> {
    const keys = [
      'cardall-cards',
      'cardall-folders', 
      'cardall-tags',
      'cardall-hidden-tags'
    ]

    keys.forEach(key => localStorage.removeItem(key))
    console.log('Legacy localStorage data cleaned up')
  }

  // 恢复备份数据
  async restoreFromBackup(): Promise<boolean> {
    try {
      const backup = await db.settings.where('key').equals('legacy_backup').first()
      if (!backup) {
        console.log('No backup data found')
        return false
      }

      const backupData = backup.value
      
      if (backupData.cards) localStorage.setItem('cardall-cards', backupData.cards)
      if (backupData.folders) localStorage.setItem('cardall-folders', backupData.folders)
      if (backupData.tags) localStorage.setItem('cardall-tags', backupData.tags)
      if (backupData.hiddenTags) localStorage.setItem('cardall-hidden-tags', backupData.hiddenTags)

      console.log('Backup data restored to localStorage')
      return true
    } catch (error) {
          console.warn("操作失败:", error)
        }
  }

  // 获取迁移状态
  async getMigrationStatus(): Promise<{
    hasLegacyData: boolean
    hasMigratedData: boolean
    migrationNeeded: boolean
  }> {
    const hasLegacyData = await this.hasLegacyData()
    const stats = await db.getStats()
    const hasMigratedData = stats.cards > 0 || stats.folders > 0 || stats.tags > 0

    return {
      hasLegacyData,
      hasMigratedData,
      migrationNeeded: hasLegacyData && !hasMigratedData
    }
  }
}

// 创建迁移服务实例
export const migrationService = new MigrationService()