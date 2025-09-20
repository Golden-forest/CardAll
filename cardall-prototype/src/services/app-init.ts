import { initializeDatabase } from './database'
import { unifiedSyncService } from './unified-sync-service'
import { migrationService } from './migration'
import { fileSystemService } from './file-system'
import { authService } from './auth'

export interface InitializationStatus {
  step: string
  progress: number
  message: string
  isComplete: boolean
  hasError: boolean
  error?: string
}

export interface InitializationResult {
  success: boolean
  migrationResult?: any
  fileSystemAccess: boolean
  error?: string
}

class AppInitializationService {
  private listeners: ((status: InitializationStatus) => void)[] = []

  // 添加状态监听器
  onStatusChange(callback: (status: InitializationStatus) => void): () => void {
    this.listeners.push(callback)
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  // 发送状态更新
  private updateStatus(status: InitializationStatus): void {
    this.listeners.forEach(callback => callback(status))
  }

  // 初始化应用
  async initialize(): Promise<InitializationResult> {
    const result: InitializationResult = {
      success: false,
      fileSystemAccess: false
    }

    try {
      // 步骤1: 初始化数据库
      this.updateStatus({
        step: 'database',
        progress: 10,
        message: '正在初始化数据库...',
        isComplete: false,
        hasError: false
      })

      await initializeDatabase()

      // 步骤2: 检查迁移需求
      this.updateStatus({
        step: 'migration-check',
        progress: 25,
        message: '检查数据迁移需求...',
        isComplete: false,
        hasError: false
      })

      const migrationStatus = await migrationService.getMigrationStatus()
      
      if (migrationStatus.migrationNeeded) {
        this.updateStatus({
          step: 'migration',
          progress: 40,
          message: '正在迁移现有数据...',
          isComplete: false,
          hasError: false
        })

        result.migrationResult = await migrationService.migrateFromLocalStorage()
        
        if (!result.migrationResult.success) {
          throw new Error(`数据迁移失败: ${  result.migrationResult.errors.join(', ')}`)
        }
      }

      // 步骤3: 请求文件系统访问权限
      this.updateStatus({
        step: 'filesystem',
        progress: 60,
        message: '请求文件系统访问权限...',
        isComplete: false,
        hasError: false
      })

      if (fileSystemService.isFileSystemAccessSupported()) {
        try {
          result.fileSystemAccess = await fileSystemService.requestDirectoryAccess()
          if (!result.fileSystemAccess) {
            console.warn('用户未授予文件系统访问权限，将使用降级存储')
          }
        } catch (error) {
          console.warn('文件系统访问请求失败，使用降级存储:', error)
          result.fileSystemAccess = false
        }
      } else {
        console.info('浏览器不支持File System Access API，使用降级存储')
        result.fileSystemAccess = false
      }

      // 步骤4: 初始化同步服务
      this.updateStatus({
        step: 'sync',
        progress: 80,
        message: '初始化同步服务...',
        isComplete: false,
        hasError: false
      })

      // 设置认证服务到同步服务
      unifiedSyncService.setAuthService(authService)
      
      // 如果用户已登录，执行完整同步
      if (authService.isAuthenticated()) {
        await unifiedSyncService.performFullSync()
      }

      // 步骤5: 完成初始化
      this.updateStatus({
        step: 'complete',
        progress: 100,
        message: '应用初始化完成',
        isComplete: true,
        hasError: false
      })

      result.success = true
      console.log('应用初始化成功:', result)

    } catch (error) {
      console.error('应用初始化失败:', error)
      
      this.updateStatus({
        step: 'error',
        progress: 0,
        message: `初始化失败: ${  error instanceof Error ? error.message : '未知错误'}`,
        isComplete: false,
        hasError: true,
        error: error instanceof Error ? error.message : '未知错误'
      })

      result.success = false
      result.error = error instanceof Error ? error.message : '未知错误'
    }

    return result
  }

  // 重新初始化（用于错误恢复）
  async reinitialize(): Promise<InitializationResult> {
    console.log('重新初始化应用...')
    return this.initialize()
  }

  // 检查初始化状态
  async checkInitializationStatus(): Promise<{
    databaseReady: boolean
    syncServiceReady: boolean
    fileSystemAccess: boolean
    migrationNeeded: boolean
  }> {
    try {
      const migrationStatus = await migrationService.getMigrationStatus()
      const syncStatus = unifiedSyncService.getCurrentStatus()
      
      return {
        databaseReady: true, // 如果能调用说明数据库已就绪
        syncServiceReady: syncStatus !== null,
        fileSystemAccess: fileSystemService.isFileSystemAccessSupported(),
        migrationNeeded: migrationStatus.migrationNeeded
      }
    } catch (error) {
      console.error('检查初始化状态失败:', error)
      return {
        databaseReady: false,
        syncServiceReady: false,
        fileSystemAccess: false,
        migrationNeeded: false
      }
    }
  }
}

// 创建应用初始化服务实例
export const appInitService = new AppInitializationService()
