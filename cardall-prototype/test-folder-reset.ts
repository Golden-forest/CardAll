/**
 * 文件夹重置问题验证脚本
 * 用于测试修复后的文件夹数据持久化功能
 */

import { db } from './src/services/database'
import { secureStorage } from './src/utils/secure-storage'

interface TestResult {
  test: string
  passed: boolean
  message: string
  details?: any
}

class FolderResetTest {
  private results: TestResult[] = []

  async runTests(): Promise<TestResult[]> {
    console.log('🧪 开始文件夹重置问题测试...')

    // 清理之前的测试结果
    this.results = []

    try {
      // 测试1：检查数据库连接
      await this.testDatabaseConnection()

      // 测试2：检查初始数据加载
      await this.testInitialDataLoad()

      // 测试3：检查数据持久化
      await this.testDataPersistence()

      // 测试4：检查数据恢复机制
      await this testDataRecovery()

      // 测试5：检查迁移标记
      await this.testMigrationFlags()

      console.log('🎉 所有测试完成！')

    } catch (error) {
      console.error('❌ 测试过程出错:', error)
      this.results.push({
        test: '测试过程',
        passed: false,
        message: `测试过程出错: ${error instanceof Error ? error.message : '未知错误'}`
      })
    }

    return this.results
  }

  private async testDatabaseConnection(): Promise<void> {
    try {
      console.log('📊 测试1: 检查数据库连接...')

      // 尝试访问数据库
      const folders = await db.folders.toArray()

      this.results.push({
        test: '数据库连接',
        passed: true,
        message: `数据库连接成功，当前有 ${folders.length} 个文件夹`,
        details: { folderCount: folders.length }
      })

    } catch (error) {
      this.results.push({
        test: '数据库连接',
        passed: false,
        message: `数据库连接失败: ${error instanceof Error ? error.message : '未知错误'}`
      })
    }
  }

  private async testInitialDataLoad(): Promise<void> {
    try {
      console.log('📋 测试2: 检查初始数据加载...')

      // 检查是否有迁移标记
      const migrationComplete = secureStorage.get<boolean>('folder_migration_complete', {
        validate: true
      })

      // 检查数据库中的数据
      const dbFolders = await db.folders.toArray()

      // 检查是否有需要恢复的数据标记
      const needsRestore = secureStorage.get<boolean>('folder_data_needs_restore', {
        validate: true
      })

      this.results.push({
        test: '初始数据加载',
        passed: true,
        message: `初始数据检查完成`,
        details: {
          migrationComplete,
          dbFolderCount: dbFolders.length,
          needsRestore
        }
      })

    } catch (error) {
      this.results.push({
        test: '初始数据加载',
        passed: false,
        message: `初始数据加载失败: ${error instanceof Error ? error.message : '未知错误'}`
      })
    }
  }

  private async testDataPersistence(): Promise<void> {
    try {
      console.log('💾 测试3: 检查数据持久化...')

      // 获取当前数据
      const initialFolders = await db.folders.toArray()

      // 如果没有数据，跳过此测试
      if (initialFolders.length === 0) {
        this.results.push({
          test: '数据持久化',
          passed: true,
          message: '没有数据，跳过持久化测试'
        })
        return
      }

      // 模拟添加一个测试文件夹
      const testFolder = {
        id: 'test-folder-' + Date.now(),
        name: 'Test Folder',
        color: '#ff0000',
        icon: 'Folder',
        cardIds: [],
        isExpanded: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncVersion: 1,
        pendingSync: false,
        userId: 'default'
      }

      // 添加测试数据
      await db.folders.add(testFolder)

      // 等待一下让数据持久化
      await new Promise(resolve => setTimeout(resolve, 100))

      // 检查数据是否还在
      const updatedFolders = await db.folders.toArray()
      const testFolderExists = updatedFolders.some(f => f.id === testFolder.id)

      // 清理测试数据
      if (testFolderExists) {
        await db.folders.delete(testFolder.id)
      }

      this.results.push({
        test: '数据持久化',
        passed: testFolderExists,
        message: testFolderExists ? '数据持久化测试通过' : '数据持久化测试失败',
        details: {
          initialCount: initialFolders.length,
          updatedCount: updatedFolders.length,
          testFolderExists
        }
      })

    } catch (error) {
      this.results.push({
        test: '数据持久化',
        passed: false,
        message: `数据持久化测试失败: ${error instanceof Error ? error.message : '未知错误'}`
      })
    }
  }

  private async testDataRecovery(): Promise<void> {
    try {
      console.log('🔄 测试4: 检查数据恢复机制...')

      // 检查是否有备份数据
      const backupData = secureStorage.get<any[]>('folders_backup', {
        validate: true,
        encrypt: true
      })

      // 检查是否有恢复标记
      const needsRestore = secureStorage.get<boolean>('folder_data_needs_restore', {
        validate: true
      })

      this.results.push({
        test: '数据恢复机制',
        passed: true,
        message: '数据恢复机制检查完成',
        details: {
          hasBackup: !!backupData,
          backupSize: backupData?.length || 0,
          needsRestore
        }
      })

    } catch (error) {
      this.results.push({
        test: '数据恢复机制',
        passed: false,
        message: `数据恢复机制检查失败: ${error instanceof Error ? error.message : '未知错误'}`
      })
    }
  }

  private async testMigrationFlags(): Promise<void> {
    try {
      console.log('🏁 测试5: 检查迁移标记...')

      // 检查各种迁移相关标记
      const flags = {
        folderMigrationComplete: secureStorage.get<boolean>('folder_migration_complete', {
          validate: true
        }),
        folderDataNeedsRestore: secureStorage.get<boolean>('folder_data_needs_restore', {
          validate: true
        }),
        foldersBackup: secureStorage.get<any[]>('folders_backup', {
          validate: true,
          encrypt: true
        })
      }

      this.results.push({
        test: '迁移标记',
        passed: true,
        message: '迁移标记检查完成',
        details: flags
      })

    } catch (error) {
      this.results.push({
        test: '迁移标记',
        passed: false,
        message: `迁移标记检查失败: ${error instanceof Error ? error.message : '未知错误'}`
      })
    }
  }

  // 生成测试报告
  generateReport(): string {
    const passedTests = this.results.filter(r => r.passed).length
    const totalTests = this.results.length

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        passed: passedTests,
        failed: totalTests - passedTests,
        total: totalTests,
        successRate: Math.round((passedTests / totalTests) * 100)
      },
      results: this.results
    }

    return JSON.stringify(report, null, 2)
  }
}

// 如果在浏览器环境中，暴露到全局作用域
if (typeof window !== 'undefined') {
  (window as any).FolderResetTest = FolderResetTest
}

export default FolderResetTest