// ============================================================================
// CardAll 浏览器端数据导出工具
// ============================================================================
// 创建时间：2025-10-05
// 功能：在浏览器中导出IndexedDB数据
// 用法：在浏览器控制台中调用 exportAllData()
// ============================================================================

import { db } from '@/services/database'

export interface ExportData {
  exportInfo: {
    timestamp: string
    version: string
    description: string
    branch: string
  }
  database: {
    cards: any[]
    folders: any[]
    tags: any[]
    images: any[]
    settings: any[]
  }
  statistics: {
    totalCards: number
    totalFolders: number
    totalTags: number
    totalImages: number
    exportSize: string
  }
}

/**
 * 从IndexedDB导出所有数据
 */
export async function exportAllData(): Promise<ExportData> {
  console.log('开始导出CardAll数据...')

  try {
    // 确保数据库已打开
    if (!db.isOpen) {
      await db.open()
    }

    // 并行获取所有数据
    const [cards, folders, tags, images, settings] = await Promise.all([
      db.cards.toArray(),
      db.folders.toArray(),
      db.tags.toArray(),
      db.images.toArray(),
      db.settings.toArray()
    ])

    const exportData: ExportData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        version: '4.0.0',
        description: 'CardAll降级重构前的完整数据备份',
        branch: 'backup-before-downgrade'
      },
      database: {
        cards,
        folders,
        tags,
        images,
        settings
      },
      statistics: {
        totalCards: cards.length,
        totalFolders: folders.length,
        totalTags: tags.length,
        totalImages: images.length,
        exportSize: JSON.stringify({ cards, folders, tags, images, settings }).length + ' bytes'
      }
    }

    console.log('数据导出完成:', exportData.statistics)
    return exportData

  } catch (error) {
    console.error('数据导出失败:', error)
    throw error
  }
}

/**
 * 下载导出的数据为JSON文件
 */
export function downloadExportData(data: ExportData, filename?: string): void {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const defaultFilename = `cardall-data-backup-${timestamp}.json`
    const finalFilename = filename || defaultFilename

    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = finalFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log(`数据已下载: ${finalFilename}`)
  } catch (error) {
    console.error('下载失败:', error)
    throw error
  }
}

/**
 * 导出并下载数据的一站式函数
 */
export async function exportAndDownloadData(filename?: string): Promise<void> {
  try {
    const data = await exportAllData()
    downloadExportData(data, filename)
  } catch (error) {
    console.error('导出和下载失败:', error)
    throw error
  }
}

/**
 * 验证导出的数据完整性
 */
export function validateExportData(data: ExportData): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // 检查基本结构
  if (!data.exportInfo || !data.database || !data.statistics) {
    errors.push('导出数据结构不完整')
  }

  // 检查版本信息
  if (!data.exportInfo.version) {
    warnings.push('缺少版本信息')
  }

  // 检查数据完整性
  const expectedTables = ['cards', 'folders', 'tags', 'images', 'settings']
  for (const table of expectedTables) {
    if (!Array.isArray(data.database[table as keyof typeof data.database])) {
      errors.push(`${table} 数据格式不正确`)
    }
  }

  // 检查统计信息一致性
  const stats = data.statistics
  if (stats.totalCards !== data.database.cards.length) {
    errors.push('卡片统计信息不一致')
  }
  if (stats.totalFolders !== data.database.folders.length) {
    errors.push('文件夹统计信息不一致')
  }
  if (stats.totalTags !== data.database.tags.length) {
    errors.push('标签统计信息不一致')
  }
  if (stats.totalImages !== data.database.images.length) {
    errors.push('图片统计信息不一致')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

// ============================================================================
// 全局函数 - 可在浏览器控制台中直接调用
// ============================================================================

// 将导出函数暴露到全局作用域，以便在浏览器控制台中使用
if (typeof window !== 'undefined') {
  (window as any).exportAllData = exportAllData
  (window as any).downloadExportData = downloadExportData
  (window as any).exportAndDownloadData = exportAndDownloadData
  (window as any).validateExportData = validateExportData

  console.log('CardAll 数据导出工具已加载')
  console.log('可用的全局函数:')
  console.log('- exportAllData(): 导出所有数据')
  console.log('- downloadExportData(data, filename?): 下载数据')
  console.log('- exportAndDownloadData(filename?): 导出并下载数据')
  console.log('- validateExportData(data): 验证数据完整性')
}

export default {
  exportAllData,
  downloadExportData,
  exportAndDownloadData,
  validateExportData
}