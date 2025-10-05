import { getDatabase } from './database'
import { ExportOptions } from '@/types/card'
import { Card, Folder, Tag } from '@/types/card'

export interface ExportProgress {
  stage: 'preparing' | 'collecting' | 'filtering' | 'processing' | 'compressing' | 'saving' | 'completed' | 'error'
  progress: number // 0-100
  message: string
  details?: any
  startTime: Date
  estimatedTimeRemaining?: number
}

export interface ExportResult {
  success: boolean
  filename: string
  size: number
  itemCount: {
    cards: number
    folders: number
    tags: number
    images: number
  }
  duration: number
  error?: string
}

export interface FilterOptions {
  dateRange?: {
    start: Date
    end: Date
  }
  folderIds?: string[]
  tagIds?: string[]
  includeImages: boolean
  includeSettings: boolean
  searchQuery?: string
}

export class ExportService {
  private db = getDatabase()

  // 导出数据
  async exportData(
    options: FilterOptions = {
      includeImages: true,
      includeSettings: true
    },
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    const startTime = new Date()
    const filename = `CardAll_Export_${new Date().toISOString().split('T')[0]}.json`

    try {
      // 准备阶段
      onProgress?.({
        stage: 'preparing',
        progress: 0,
        message: '正在准备导出...',
        startTime,
        estimatedTimeRemaining: 0
      })

      // 收集数据阶段
      onProgress?.({
        stage: 'collecting',
        progress: 10,
        message: '正在收集数据...',
        startTime,
        estimatedTimeRemaining: 30
      })

      const [cards, folders, tags, images, settings] = await Promise.all([
        this.collectCards(options),
        this.collectFolders(options),
        this.collectTags(options),
        options.includeImages ? this.collectImages(options) : [],
        options.includeSettings ? this.collectSettings() : {}
      ])

      // 过滤数据阶段
      onProgress?.({
        stage: 'filtering',
        progress: 30,
        message: '正在过滤数据...',
        startTime,
        estimatedTimeRemaining: 25
      })

      const filteredData = await this.filterData(cards, folders, tags, images, options)

      // 处理数据阶段
      onProgress?.({
        stage: 'processing',
        progress: 60,
        message: '正在处理数据...',
        startTime,
        estimatedTimeRemaining: 15
      })

      const exportData = {
        metadata: {
          version: '1.0.0',
          exportTime: new Date().toISOString(),
          itemCount: {
            cards: filteredData.cards.length,
            folders: filteredData.folders.length,
            tags: filteredData.tags.length,
            images: filteredData.images.length
          },
          filters: options,
          appVersion: '5.6.5-local'
        },
        data: {
          cards: filteredData.cards,
          folders: filteredData.folders,
          tags: filteredData.tags,
          images: filteredData.images,
          settings
        }
      }

      // 压缩阶段
      onProgress?.({
        stage: 'compressing',
        progress: 80,
        message: '正在生成文件...',
        startTime,
        estimatedTimeRemaining: 10
      })

      const jsonString = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const size = blob.size

      // 保存阶段
      onProgress?.({
        stage: 'saving',
        progress: 90,
        message: '正在下载文件...',
        startTime,
        estimatedTimeRemaining: 5
      })

      await this.downloadFile(blob, filename)

      // 完成
      const duration = Date.now() - startTime.getTime()

      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: '导出完成',
        startTime,
        estimatedTimeRemaining: 0
      })

      console.log(`数据导出完成: ${filename}`)

      return {
        success: true,
        filename,
        size,
        itemCount: {
          cards: filteredData.cards.length,
          folders: filteredData.folders.length,
          tags: filteredData.tags.length,
          images: filteredData.images.length
        },
        duration
      }

    } catch (error) {
      console.error('导出数据失败:', error)
      const duration = Date.now() - startTime.getTime()

      onProgress?.({
        stage: 'error',
        progress: 0,
        message: `导出失败: ${error}`,
        startTime,
        estimatedTimeRemaining: 0,
        details: error
      })

      return {
        success: false,
        filename,
        size: 0,
        itemCount: { cards: 0, folders: 0, tags: 0, images: 0 },
        duration,
        error: String(error)
      }
    }
  }

  // 收集卡片数据
  private async collectCards(options: FilterOptions): Promise<any[]> {
    try {
      let cards = await this.db.cards.toArray()

      // 应用日期范围过滤
      if (options.dateRange) {
        cards = cards.filter(card => {
          const cardDate = new Date(card.createdAt)
          return cardDate >= options.dateRange!.start && cardDate <= options.dateRange!.end
        })
      }

      // 应用文件夹过滤
      if (options.folderIds && options.folderIds.length > 0) {
        cards = cards.filter(card =>
          card.folderId && options.folderIds!.includes(card.folderId)
        )
      }

      // 应用搜索过滤
      if (options.searchQuery) {
        const query = options.searchQuery.toLowerCase()
        cards = cards.filter(card => {
          const searchableText = [
            card.frontContent.title,
            card.frontContent.text,
            card.backContent.title,
            card.backContent.text,
            ...card.frontContent.tags,
            ...card.backContent.tags
          ].join(' ').toLowerCase()
          return searchableText.includes(query)
        })
      }

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
  private async collectFolders(options: FilterOptions): Promise<any[]> {
    try {
      let folders = await this.db.folders.toArray()

      // 如果指定了文件夹ID，只收集指定的文件夹
      if (options.folderIds && options.folderIds.length > 0) {
        const specifiedFolderIds = new Set(options.folderIds)
        folders = folders.filter(folder => specifiedFolderIds.has(folder.id))
      }

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
  private async collectTags(options: FilterOptions): Promise<any[]> {
    try {
      let tags = await this.db.tags.toArray()

      // 如果指定了标签ID，只收集指定的标签
      if (options.tagIds && options.tagIds.length > 0) {
        const specifiedTagIds = new Set(options.tagIds)
        tags = tags.filter(tag => specifiedTagIds.has(tag.id))
      }

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
  private async collectImages(options: FilterOptions): Promise<any[]> {
    try {
      let images = await this.db.images.toArray()

      // 只收集被导出卡片相关的图片
      if (options.folderIds || options.dateRange || options.searchQuery) {
        const filteredCards = await this.collectCards(options)
        const cardIds = new Set(filteredCards.map(card => card.id))
        images = images.filter(image => image.cardId && cardIds.has(image.cardId))
      }

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

  // 过滤数据
  private async filterData(
    cards: any[],
    folders: any[],
    tags: any[],
    images: any[],
    options: FilterOptions
  ): Promise<{
    cards: any[]
    folders: any[]
    tags: any[]
    images: any[]
  }> {
    try {
      // 应用标签过滤
      if (options.tagIds && options.tagIds.length > 0) {
        const specifiedTagIds = new Set(options.tagIds)
        cards = cards.filter(card => {
          const cardTags = [...card.frontContent.tags, ...card.backContent.tags]
          return cardTags.some(tag => specifiedTagIds.has(tag))
        })
      }

      // 获取相关联的文件夹和标签
      const cardIds = new Set(cards.map(card => card.id))
      const folderIds = new Set(cards.map(card => card.folderId).filter(Boolean))
      const allTagIds = new Set([
        ...cards.flatMap(card => card.frontContent.tags),
        ...cards.flatMap(card => card.backContent.tags)
      ])

      const filteredFolders = folders.filter(folder => folderIds.has(folder.id))
      const filteredTags = tags.filter(tag => allTagIds.has(tag.id))
      const filteredImages = images.filter(image => image.cardId && cardIds.has(image.cardId))

      return {
        cards,
        folders: filteredFolders,
        tags: filteredTags,
        images: filteredImages
      }
    } catch (error) {
      console.warn('过滤数据失败:', error)
      return { cards, folders, tags, images }
    }
  }

  // 下载文件
  private async downloadFile(blob: Blob, filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // 延迟清理URL对象
        setTimeout(() => {
          URL.revokeObjectURL(url)
          resolve()
        }, 100)
      } catch (error) {
        reject(error)
      }
    })
  }

  // 导出为CSV格式（卡片列表）
  async exportToCSV(
    options: FilterOptions = {
      includeImages: false,
      includeSettings: false
    },
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    const startTime = new Date()
    const filename = `CardAll_Cards_${new Date().toISOString().split('T')[0]}.csv`

    try {
      // 准备阶段
      onProgress?.({
        stage: 'preparing',
        progress: 0,
        message: '正在准备CSV导出...',
        startTime,
        estimatedTimeRemaining: 0
      })

      // 收集卡片数据
      onProgress?.({
        stage: 'collecting',
        progress: 20,
        message: '正在收集卡片数据...',
        startTime,
        estimatedTimeRemaining: 10
      })

      const cards = await this.collectCards(options)

      // 处理数据
      onProgress?.({
        stage: 'processing',
        progress: 60,
        message: '正在生成CSV...',
        startTime,
        estimatedTimeRemaining: 5
      })

      const csvContent = this.generateCSV(cards)

      // 保存文件
      onProgress?.({
        stage: 'saving',
        progress: 90,
        message: '正在下载CSV文件...',
        startTime,
        estimatedTimeRemaining: 2
      })

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      await this.downloadFile(blob, filename)

      // 完成
      const duration = Date.now() - startTime.getTime()

      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'CSV导出完成',
        startTime,
        estimatedTimeRemaining: 0
      })

      return {
        success: true,
        filename,
        size: blob.size,
        itemCount: { cards: cards.length, folders: 0, tags: 0, images: 0 },
        duration
      }

    } catch (error) {
      console.error('CSV导出失败:', error)
      const duration = Date.now() - startTime.getTime()

      onProgress?.({
        stage: 'error',
        progress: 0,
        message: `CSV导出失败: ${error}`,
        startTime,
        estimatedTimeRemaining: 0
      })

      return {
        success: false,
        filename,
        size: 0,
        itemCount: { cards: 0, folders: 0, tags: 0, images: 0 },
        duration,
        error: String(error)
      }
    }
  }

  // 生成CSV内容
  private generateCSV(cards: any[]): string {
    const headers = [
      'ID',
      '正面标题',
      '正面内容',
      '背面标题',
      '背面内容',
      '标签',
      '创建时间',
      '更新时间',
      '文件夹ID'
    ]

    const rows = cards.map(card => [
      card.id,
      `"${this.escapeCSV(card.frontContent.title)}"`,
      `"${this.escapeCSV(card.frontContent.text)}"`,
      `"${this.escapeCSV(card.backContent.title)}"`,
      `"${this.escapeCSV(card.backContent.text)}"`,
      `"${[...card.frontContent.tags, ...card.backContent.tags].join(', ')}"`,
      card.createdAt,
      card.updatedAt,
      card.folderId || ''
    ])

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
  }

  // 转义CSV字段
  private escapeCSV(field: string): string {
    return field.replace(/"/g, '""').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
  }

  // 获取可导出的文件夹列表
  async getExportableFolders(): Promise<Array<{ id: string; name: string; cardCount: number }>> {
    try {
      const folders = await this.db.folders.toArray()
      const cards = await this.db.cards.toArray()

      const folderCardCounts = cards.reduce((counts, card) => {
        if (card.folderId) {
          counts[card.folderId] = (counts[card.folderId] || 0) + 1
        }
        return counts
      }, {} as Record<string, number>)

      return folders.map(folder => ({
        id: folder.id,
        name: folder.name,
        cardCount: folderCardCounts[folder.id] || 0
      }))
    } catch (error) {
      console.error('获取文件夹列表失败:', error)
      return []
    }
  }

  // 获取可导出的标签列表
  async getExportableTags(): Promise<Array<{ id: string; name: string; cardCount: number }>> {
    try {
      const tags = await this.db.tags.toArray()
      const cards = await this.db.cards.toArray()

      const tagCardCounts = cards.reduce((counts, card) => {
        const allTags = [...card.frontContent.tags, ...card.backContent.tags]
        allTags.forEach(tagName => {
          const tag = tags.find(t => t.name === tagName)
          if (tag) {
            counts[tag.id] = (counts[tag.id] || 0) + 1
          }
        })
        return counts
      }, {} as Record<string, number>)

      return tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        cardCount: tagCardCounts[tag.id] || 0
      }))
    } catch (error) {
      console.error('获取标签列表失败:', error)
      return []
    }
  }

  // 预览导出数据
  async previewExport(
    options: FilterOptions
  ): Promise<{
    itemCount: {
      cards: number
      folders: number
      tags: number
      images: number
    }
    sampleData: {
      cards: any[]
      folders: any[]
      tags: any[]
    }
  }> {
    try {
      const [cards, folders, tags, images] = await Promise.all([
        this.collectCards(options),
        this.collectFolders(options),
        this.collectTags(options),
        options.includeImages ? this.collectImages(options) : []
      ])

      const filteredData = await this.filterData(cards, folders, tags, images, options)

      return {
        itemCount: {
          cards: filteredData.cards.length,
          folders: filteredData.folders.length,
          tags: filteredData.tags.length,
          images: filteredData.images.length
        },
        sampleData: {
          cards: filteredData.cards.slice(0, 3), // 只显示前3个作为示例
          folders: filteredData.folders.slice(0, 3),
          tags: filteredData.tags.slice(0, 3)
        }
      }
    } catch (error) {
      console.error('预览导出数据失败:', error)
      return {
        itemCount: { cards: 0, folders: 0, tags: 0, images: 0 },
        sampleData: { cards: [], folders: [], tags: [] }
      }
    }
  }
}

// 导出单例实例
export const exportService = new ExportService()