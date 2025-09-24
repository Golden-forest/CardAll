/**
 * 数据库状态检查工具
 * 用于检查IndexedDB中的当前文件夹数据和同步服务状态
 */

import { db, type DbFolder } from '../services/database'
import { dataSyncService } from '../services/data-sync-service'

export interface DatabaseStatus {
  isConnected: boolean
  folders: {
    total: number
    pendingSync: number
    list: DbFolder[]
  }
  sync: {
    isActive: boolean
    currentState: string
    lastSyncTime?: Date
    pendingOperations: number
  }
  health: {
    isHealthy: boolean
    issues: string[]
  }
}

export class DatabaseStatusChecker {
  private static instance: DatabaseStatusChecker

  static getInstance(): DatabaseStatusChecker {
    if (!DatabaseStatusChecker.instance) {
      DatabaseStatusChecker.instance = new DatabaseStatusChecker()
    }
    return DatabaseStatusChecker.instance
  }

  /**
   * 检查数据库连接和状态
   */
  async checkDatabaseStatus(): Promise<DatabaseStatus> {
    console.log('🔍 开始检查数据库状态...')

    try {
      // 检查数据库连接
      const isConnected = await this.testDatabaseConnection()
      console.log('📊 数据库连接状态:', isConnected)

      if (!isConnected) {
        return {
          isConnected: false,
          folders: { total: 0, pendingSync: 0, list: [] },
          sync: {
            isActive: false,
            currentState: 'disconnected',
            pendingOperations: 0
          },
          health: {
            isHealthy: false,
            issues: ['数据库连接失败']
          }
        }
      }

      // 获取文件夹数据
      const folders = await this.getFolderData()
      console.log(`📁 找到 ${folders.total} 个文件夹，${folders.pendingSync} 个待同步`)

      // 检查同步状态
      const syncStatus = await this.checkSyncStatus()
      console.log('🔄 同步状态:', syncStatus)

      // 检查数据库健康状态
      const health = await this.checkDatabaseHealth()
      console.log('💚 数据库健康状态:', health)

      const status: DatabaseStatus = {
        isConnected,
        folders,
        sync: syncStatus,
        health
      }

      console.log('✅ 数据库状态检查完成:', status)
      return status

    } catch (error) {
      console.error('❌ 数据库状态检查失败:', error)
      return {
        isConnected: false,
        folders: { total: 0, pendingSync: 0, list: [] },
        sync: {
          isActive: false,
          currentState: 'error',
          pendingOperations: 0
        },
        health: {
          isHealthy: false,
          issues: [`状态检查失败: ${error}`]
        }
      }
    }
  }

  /**
   * 测试数据库连接
   */
  private async testDatabaseConnection(): Promise<boolean> {
    try {
      console.log('测试数据库连接...')
      await db.tables.toArray()
      console.log('数据库连接测试成功')
      return true
    } catch (error) {
      console.error('数据库连接测试失败:', error)
      return false
    }
  }

  /**
   * 获取文件夹数据
   */
  private async getFolderData(): Promise<{
    total: number
    pendingSync: number
    list: DbFolder[]
  }> {
    try {
      console.log('获取文件夹数据...')

      // 获取所有文件夹
      const allFolders = await db.folders.toArray()
      console.log(`从数据库获取到 ${allFolders.length} 个文件夹`)

      // 获取待同步的文件夹
      const pendingFolders = await db.folders
        .filter(folder => folder.pendingSync)
        .toArray()
      console.log(`待同步文件夹: ${pendingFolders.length} 个`)

      // 详细日志每个文件夹
      allFolders.forEach((folder, index) => {
        console.log(`文件夹 ${index + 1}:`, {
          id: folder.id,
          name: folder.name,
          pendingSync: folder.pendingSync,
          syncVersion: folder.syncVersion,
          lastSyncAt: folder.lastSyncAt,
          updatedAt: folder.updatedAt
        })
      })

      return {
        total: allFolders.length,
        pendingSync: pendingFolders.length,
        list: allFolders
      }
    } catch (error) {
      console.error('获取文件夹数据失败:', error)
      return {
        total: 0,
        pendingSync: 0,
        list: []
      }
    }
  }

  /**
   * 检查同步状态
   */
  private async checkSyncStatus(): Promise<{
    isActive: boolean
    currentState: string
    lastSyncTime?: Date
    pendingOperations: number
  }> {
    try {
      console.log('检查同步状态...')

      // 获取同步服务当前状态
      const currentState = dataSyncService.getCurrentState()
      console.log('同步服务当前状态:', currentState)

      // 获取同步指标
      const metrics = await dataSyncService.getMetrics()
      console.log('同步指标:', metrics)

      // 获取待同步操作数量
      const pendingOps = await db.syncQueue.count()
      console.log('待同步操作数量:', pendingOps)

      return {
        isActive: currentState !== 'idle',
        currentState,
        lastSyncTime: metrics.lastSyncTime,
        pendingOperations: pendingOps
      }
    } catch (error) {
      console.error('检查同步状态失败:', error)
      return {
        isActive: false,
        currentState: 'error',
        pendingOperations: 0
      }
    }
  }

  /**
   * 检查数据库健康状态
   */
  private async checkDatabaseHealth(): Promise<{
    isHealthy: boolean
    issues: string[]
  }> {
    try {
      console.log('检查数据库健康状态...')

      const health = await db.healthCheck()
      console.log('数据库健康检查结果:', health)

      return {
        isHealthy: health.isHealthy,
        issues: health.issues
      }
    } catch (error) {
      console.error('数据库健康检查失败:', error)
      return {
        isHealthy: false,
        issues: [`健康检查失败: ${error}`]
      }
    }
  }

  /**
   * 测试文件夹持久化
   */
  async testFolderPersistence(): Promise<boolean> {
    console.log('🧪 测试文件夹持久化...')

    try {
      // 创建测试文件夹
      const testFolderName = `测试文件夹_${Date.now()}`
      const testFolderId = crypto.randomUUID()

      console.log('创建测试文件夹:', testFolderName)

      const testFolder: Omit<DbFolder, 'id' | 'syncVersion' | 'pendingSync' | 'updatedAt'> = {
        name: testFolderName,
        userId: 'default',
        parentId: null,
        cardIds: [],
        createdAt: new Date()
      }

      // 添加到数据库
      await db.folders.add({
        ...testFolder,
        id: testFolderId,
        syncVersion: 1,
        pendingSync: true,
        updatedAt: new Date()
      })
      console.log('测试文件夹已添加到数据库')

      // 立即查询验证
      const savedFolder = await db.folders.get(testFolderId)
      if (!savedFolder) {
        console.error('❌ 测试文件夹保存失败 - 无法查询到')
        return false
      }

      console.log('✅ 测试文件夹保存成功:', savedFolder)

      // 等待1秒后再次查询
      await new Promise(resolve => setTimeout(resolve, 1000))

      const folderAfterDelay = await db.folders.get(testFolderId)
      if (!folderAfterDelay) {
        console.error('❌ 测试文件夹持久化失败 - 1秒后无法查询到')
        return false
      }

      console.log('✅ 测试文件夹持久化成功:', folderAfterDelay)

      // 清理测试文件夹
      await db.folders.delete(testFolderId)
      console.log('🧹 测试文件夹已清理')

      return true

    } catch (error) {
      console.error('❌ 文件夹持久化测试失败:', error)
      return false
    }
  }

  /**
   * 生成详细报告
   */
  generateDetailedReport(status: DatabaseStatus): string {
    console.log('📋 生成详细状态报告...')

    const report = `
=== CardAll 数据库状态报告 ===
生成时间: ${new Date().toLocaleString()}

📊 数据库连接
状态: ${status.isConnected ? '✅ 已连接' : '❌ 未连接'}

📁 文件夹数据
总数: ${status.folders.total}
待同步: ${status.folders.pendingSync}
文件夹列表:
${status.folders.list.map(f => `  - ${f.name} (ID: ${f.id}, 待同步: ${f.pendingSync})`).join('\n')}

🔄 同步状态
服务状态: ${status.sync.isActive ? '🔄 活跃' : '⏸️ 非活跃'}
当前状态: ${status.sync.currentState}
最后同步: ${status.sync.lastSyncTime ? status.sync.lastSyncTime.toLocaleString() : '从未同步'}
待处理操作: ${status.sync.pendingOperations}

💚 健康状态
整体健康: ${status.health.isHealthy ? '✅ 健康' : '❌ 不健康'}
问题:
${status.health.issues.map(issue => `  - ${issue}`).join('\n') || '  无'}

=== 报告结束 ===
    `

    console.log('详细报告已生成')
    return report
  }
}

// 导出单例实例
export const dbStatusChecker = DatabaseStatusChecker.getInstance()

// 便利方法
export const checkDatabaseStatus = () => dbStatusChecker.checkDatabaseStatus()
export const testFolderPersistence = () => dbStatusChecker.testFolderPersistence()
export const generateDatabaseReport = (status: DatabaseStatus) => dbStatusChecker.generateDetailedReport(status)