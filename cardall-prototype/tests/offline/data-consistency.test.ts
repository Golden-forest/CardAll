// 数据一致性验证测试
// 测试 Week 2 Day 8-9 的数据一致性和完整性验证功能

import { jest } from '@jest/globals'

// ============================================================================
// 数据一致性验证工具
// ============================================================================

class DataConsistencyValidator {
  private validationResults: any[] = []
  private dataStore: Map<string, any> = new Map()
  
  /**
   * 验证数据一致性
   */
  async validateConsistency(): Promise<{
    valid: boolean
    score: number
    issues: string[]
    details: any
  }> {
    console.log('🔍 开始数据一致性验证...')
    
    const issues: string[] = []
    let score = 1.0
    
    // 1. 验证数据完整性
    const integrityResult = await this.validateDataIntegrity()
    if (!integrityResult.valid) {
      issues.push(...integrityResult.issues)
      score -= integrityResult.issues.length * 0.1
    }
    
    // 2. 验证数据同步状态
    const syncResult = await this.validateSyncState()
    if (!syncResult.valid) {
      issues.push(...syncResult.issues)
      score -= syncResult.issues.length * 0.15
    }
    
    // 3. 验证数据版本一致性
    const versionResult = await this.validateVersionConsistency()
    if (!versionResult.valid) {
      issues.push(...versionResult.issues)
      score -= versionResult.issues.length * 0.2
    }
    
    // 4. 验证数据关系完整性
    const relationResult = await this.validateDataRelations()
    if (!relationResult.valid) {
      issues.push(...relationResult.issues)
      score -= relationResult.issues.length * 0.1
    }
    
    // 5. 验证数据备份一致性
    const backupResult = await this.validateBackupConsistency()
    if (!backupResult.valid) {
      issues.push(...backupResult.issues)
      score -= backupResult.issues.length * 0.05
    }
    
    // 确保分数不低于0
    score = Math.max(0, score)
    
    const result = {
      valid: issues.length === 0,
      score,
      issues,
      details: {
        integrity: integrityResult,
        sync: syncResult,
        version: versionResult,
        relations: relationResult,
        backup: backupResult
      }
    }
    
    this.validationResults.push(result)
    
    console.log(`✅ 数据一致性验证完成 - 分数: ${(score * 100).toFixed(1)}%`)
    if (issues.length > 0) {
      console.log(`   发现问题: ${issues.length} 个`)
    }
    
    return result
  }
  
  /**
   * 验证数据完整性
   */
  private async validateDataIntegrity(): Promise<{
    valid: boolean
    issues: string[]
    details: any
  }> {
    const issues: string[] = []
    const details = {
      totalRecords: 0,
      corruptedRecords: 0,
      missingFields: 0
    }
    
    // 模拟数据完整性检查
    for (const [key, data] of this.dataStore) {
      details.totalRecords++
      
      // 检查必要字段
      const requiredFields = ['id', 'createdAt', 'updatedAt']
      for (const field of requiredFields) {
        if (!data[field]) {
          issues.push(`记录 ${key} 缺少必要字段: ${field}`)
          details.missingFields++
        }
      }
      
      // 检查数据损坏
      if (this.isDataCorrupted(data)) {
        issues.push(`记录 ${key} 数据损坏`)
        details.corruptedRecords++
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      details
    }
  }
  
  /**
   * 验证同步状态一致性
   */
  private async validateSyncState(): Promise<{
    valid: boolean
    issues: string[]
    details: any
  }> {
    const issues: string[] = []
    const details = {
      totalOperations: 0,
      pendingOperations: 0,
      completedOperations: 0,
      inconsistentStates: 0
    }
    
    // 模拟同步状态检查
    for (const [key, data] of this.dataStore) {
      details.totalOperations++
      
      if (data.syncStatus === 'pending') {
        details.pendingOperations++
        
        // 检查挂起时间是否过长
        const pendingTime = Date.now() - new Date(data.updatedAt).getTime()
        if (pendingTime > 24 * 60 * 60 * 1000) { // 24小时
          issues.push(`记录 ${key} 挂起时间过长: ${pendingTime}ms`)
          details.inconsistentStates++
        }
      } else if (data.syncStatus === 'completed') {
        details.completedOperations++
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      details
    }
  }
  
  /**
   * 验证版本一致性
   */
  private async validateVersionConsistency(): Promise<{
    valid: boolean
    issues: string[]
    details: any
  }> {
    const issues: string[] = []
    const details = {
      versionConflicts: 0,
      outdatedVersions: 0,
      totalRecords: 0
    }
    
    // 模拟版本一致性检查
    for (const [key, data] of this.dataStore) {
      details.totalRecords++
      
      if (data.version) {
        // 检查版本冲突
        if (data.localVersion && data.remoteVersion && data.localVersion !== data.remoteVersion) {
          issues.push(`记录 ${key} 版本冲突: 本地${data.localVersion} vs 远程${data.remoteVersion}`)
          details.versionConflicts++
        }
        
        // 检查版本是否过时
        if (data.version < data.expectedVersion) {
          issues.push(`记录 ${key} 版本过时: ${data.version} < ${data.expectedVersion}`)
          details.outdatedVersions++
        }
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      details
    }
  }
  
  /**
   * 验证数据关系完整性
   */
  private async validateDataRelations(): Promise<{
    valid: boolean
    issues: string[]
    details: any
  }> {
    const issues: string[] = []
    const details = {
      totalRelations: 0,
      brokenRelations: 0,
      orphanedRecords: 0
    }
    
    // 模拟数据关系检查
    const cards = Array.from(this.dataStore.values()).filter(data => data.type === 'card')
    const folders = Array.from(this.dataStore.values()).filter(data => data.type === 'folder')
    
    // 检查卡片-文件夹关系
    for (const card of cards) {
      if (card.folderId) {
        details.totalRelations++
        
        const folderExists = folders.some(folder => folder.id === card.folderId)
        if (!folderExists) {
          issues.push(`卡片 ${card.id} 引用了不存在的文件夹: ${card.folderId}`)
          details.brokenRelations++
        }
      }
    }
    
    // 检查孤立记录
    for (const folder of folders) {
      if (folder.parentId) {
        const parentExists = folders.some(f => f.id === folder.parentId)
        if (!parentExists) {
          issues.push(`文件夹 ${folder.id} 是孤立记录: 父文件夹 ${folder.parentId} 不存在`)
          details.orphanedRecords++
        }
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      details
    }
  }
  
  /**
   * 验证备份一致性
   */
  private async validateBackupConsistency(): Promise<{
    valid: boolean
    issues: string[]
    details: any
  }> {
    const issues: string[] = []
    const details = {
      totalBackups: 0,
      inconsistentBackups: 0,
      missingBackups: 0
    }
    
    // 模拟备份一致性检查
    const backupKeys = Array.from(this.dataStore.keys()).filter(key => key.startsWith('backup-'))
    details.totalBackups = backupKeys.length
    
    for (const backupKey of backupKeys) {
      const backup = this.dataStore.get(backupKey)
      
      // 检查备份完整性
      if (!backup.data || !backup.timestamp) {
        issues.push(`备份 ${backupKey} 不完整`)
        details.inconsistentBackups++
      }
      
      // 检查备份数据一致性
      if (backup.data && backup.originalData) {
        const dataHash = this.calculateDataHash(backup.data)
        const originalHash = this.calculateDataHash(backup.originalData)
        
        if (dataHash !== originalHash) {
          issues.push(`备份 ${backupKey} 数据不一致`)
          details.inconsistentBackups++
        }
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      details
    }
  }
  
  /**
   * 检查数据是否损坏
   */
  private isDataCorrupted(data: any): boolean {
    // 模拟数据损坏检测
    return data.corrupted === true || 
           data.content === null && data.type === 'card' ||
           typeof data.id !== 'string'
  }
  
  /**
   * 计算数据哈希
   */
  private calculateDataHash(data: any): string {
    // 简单的哈希计算
    return JSON.stringify(data).length.toString()
  }
  
  /**
   * 添加测试数据
   */
  addTestData(key: string, data: any): void {
    this.dataStore.set(key, data)
  }
  
  /**
   * 清理测试数据
   */
  clearTestData(): void {
    this.dataStore.clear()
    this.validationResults = []
  }
  
  /**
   * 获取验证结果
   */
  getValidationResults(): any[] {
    return this.validationResults
  }
}

// ============================================================================
// 数据一致性测试场景
// ============================================================================

describe('Week 2 Day 8-9 数据一致性验证测试', () => {
  
  let validator: DataConsistencyValidator
  
  beforeAll(async () => {
    console.log('🚀 开始 Week 2 Day 8-9 数据一致性验证测试')
    
    validator = new DataConsistencyValidator()
  })
  
  afterAll(async () => {
    console.log('✅ 数据一致性验证测试完成')
  })
  
  describe('基本数据一致性测试', () => {
    
    test('应该能够验证完整数据的一致性', async () => {
      // 添加完整数据
      validator.addTestData('card-1', {
        id: 'card-1',
        type: 'card',
        title: 'Test Card 1',
        content: 'Test content',
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'completed',
        version: 1
      })
      
      validator.addTestData('folder-1', {
        id: 'folder-1',
        type: 'folder',
        name: 'Test Folder',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'completed',
        version: 1
      })
      
      const result = await validator.validateConsistency()
      
      expect(result.valid).toBe(true)
      expect(result.score).toBe(1.0)
      expect(result.issues).toHaveLength(0)
      
      console.log(`✅ 完整数据一致性测试通过 - 分数: ${(result.score * 100).toFixed(1)}%`)
    })
    
    test('应该能够检测数据损坏', async () => {
      // 添加损坏的数据
      validator.addTestData('corrupted-card', {
        id: 'corrupted-card',
        type: 'card',
        title: 'Corrupted Card',
        content: null, // 损坏的内容
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending',
        corrupted: true
      })
      
      const result = await validator.validateConsistency()
      
      expect(result.valid).toBe(false)
      expect(result.score).toBeLessThan(1.0)
      expect(result.issues.length).toBeGreaterThan(0)
      
      console.log(`✅ 数据损坏检测测试通过 - 发现 ${result.issues.length} 个问题`)
    })
    
    test('应该能够检测版本冲突', async () => {
      // 添加版本冲突的数据
      validator.addTestData('version-conflict-card', {
        id: 'version-conflict-card',
        type: 'card',
        title: 'Version Conflict Card',
        content: 'Test content',
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending',
        localVersion: 2,
        remoteVersion: 3,
        expectedVersion: 3
      })
      
      const result = await validator.validateConsistency()
      
      expect(result.valid).toBe(false)
      expect(result.details.version.versionConflicts).toBeGreaterThan(0)
      
      console.log(`✅ 版本冲突检测测试通过 - 发现 ${result.details.version.versionConflicts} 个冲突`)
    })
  })
  
  describe('数据关系一致性测试', () => {
    
    test('应该能够验证数据关系完整性', async () => {
      // 清理之前的数据
      validator.clearTestData()
      
      // 添加有关系的数据
      validator.addTestData('folder-parent', {
        id: 'folder-parent',
        type: 'folder',
        name: 'Parent Folder',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'completed'
      })
      
      validator.addTestData('folder-child', {
        id: 'folder-child',
        type: 'folder',
        name: 'Child Folder',
        parentId: 'folder-parent',
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'completed'
      })
      
      validator.addTestData('card-in-folder', {
        id: 'card-in-folder',
        type: 'card',
        title: 'Card in Folder',
        content: 'Test content',
        folderId: 'folder-child',
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'completed'
      })
      
      const result = await validator.validateConsistency()
      
      expect(result.valid).toBe(true)
      expect(result.details.relations.brokenRelations).toBe(0)
      expect(result.details.relations.orphanedRecords).toBe(0)
      
      console.log(`✅ 数据关系完整性测试通过 - 关系数: ${result.details.relations.totalRelations}`)
    })
    
    test('应该能够检测损坏的数据关系', async () => {
      // 清理之前的数据
      validator.clearTestData()
      
      // 添加有损坏关系的数据
      validator.addTestData('card-broken-relation', {
        id: 'card-broken-relation',
        type: 'card',
        title: 'Card with Broken Relation',
        content: 'Test content',
        folderId: 'non-existent-folder', // 不存在的文件夹
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending'
      })
      
      validator.addTestData('folder-orphaned', {
        id: 'folder-orphaned',
        type: 'folder',
        name: 'Orphaned Folder',
        parentId: 'non-existent-parent', // 不存在的父文件夹
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending'
      })
      
      const result = await validator.validateConsistency()
      
      expect(result.valid).toBe(false)
      expect(result.details.relations.brokenRelations).toBeGreaterThan(0)
      expect(result.details.relations.orphanedRecords).toBeGreaterThan(0)
      
      console.log(`✅ 损坏关系检测测试通过 - 发现 ${result.details.relations.brokenRelations} 个损坏关系`)
    })
  })
  
  describe('备份一致性测试', () => {
    
    test('应该能够验证备份一致性', async () => {
      // 清理之前的数据
      validator.clearTestData()
      
      // 添加备份数据
      const originalData = {
        id: 'backup-test-card',
        type: 'card',
        title: 'Backup Test Card',
        content: 'Test content for backup',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      validator.addTestData('backup-test-card', originalData)
      
      validator.addTestData('backup-backup-test-card', {
        id: 'backup-backup-test-card',
        type: 'backup',
        originalData: originalData,
        data: { ...originalData }, // 复制的数据
        timestamp: new Date(),
        version: 1
      })
      
      const result = await validator.validateConsistency()
      
      expect(result.valid).toBe(true)
      expect(result.details.backup.inconsistentBackups).toBe(0)
      
      console.log(`✅ 备份一致性测试通过 - 备份数: ${result.details.backup.totalBackups}`)
    })
    
    test('应该能够检测备份不一致', async () => {
      // 清理之前的数据
      validator.clearTestData()
      
      // 添加不一致的备份数据
      const originalData = {
        id: 'inconsistent-backup-card',
        type: 'card',
        title: 'Inconsistent Backup Card',
        content: 'Original content',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      validator.addTestData('inconsistent-backup-card', originalData)
      
      validator.addTestData('backup-inconsistent-backup-card', {
        id: 'backup-inconsistent-backup-card',
        type: 'backup',
        originalData: originalData,
        data: { 
          ...originalData, 
          content: 'Modified content' // 修改后的内容，与原数据不一致
        },
        timestamp: new Date(),
        version: 1
      })
      
      const result = await validator.validateConsistency()
      
      expect(result.valid).toBe(false)
      expect(result.details.backup.inconsistentBackups).toBeGreaterThan(0)
      
      console.log(`✅ 备份不一致检测测试通过 - 发现 ${result.details.backup.inconsistentBackups} 个不一致备份`)
    })
  })
  
  describe('同步状态一致性测试', () => {
    
    test('应该能够验证同步状态一致性', async () => {
      // 清理之前的数据
      validator.clearTestData()
      
      // 添加不同同步状态的数据
      validator.addTestData('synced-card', {
        id: 'synced-card',
        type: 'card',
        title: 'Synced Card',
        content: 'Synced content',
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'completed'
      })
      
      validator.addTestData('pending-card', {
        id: 'pending-card',
        type: 'card',
        title: 'Pending Card',
        content: 'Pending content',
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending'
      })
      
      const result = await validator.validateConsistency()
      
      expect(result.valid).toBe(true)
      expect(result.details.sync.pendingOperations).toBe(1)
      expect(result.details.sync.completedOperations).toBe(1)
      
      console.log(`✅ 同步状态一致性测试通过 - 待处理: ${result.details.sync.pendingOperations}, 已完成: ${result.details.sync.completedOperations}`)
    })
    
    test('应该能够检测过期的挂起操作', async () => {
      // 清理之前的数据
      validator.clearTestData()
      
      // 添加过期的挂起操作
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25小时前
      
      validator.addTestData('expired-pending-card', {
        id: 'expired-pending-card',
        type: 'card',
        title: 'Expired Pending Card',
        content: 'Expired pending content',
        createdAt: oldDate,
        updatedAt: oldDate,
        syncStatus: 'pending'
      })
      
      const result = await validator.validateConsistency()
      
      expect(result.valid).toBe(false)
      expect(result.details.sync.inconsistentStates).toBeGreaterThan(0)
      
      console.log(`✅ 过期挂起操作检测测试通过 - 发现 ${result.details.sync.inconsistentStates} 个不一致状态`)
    })
  })
  
  describe('综合一致性测试', () => {
    
    test('应该能够处理复杂的一致性验证场景', async () => {
      // 清理之前的数据
      validator.clearTestData()
      
      // 创建复杂的测试场景
      const testData = [
        // 正常数据
        {
          id: 'normal-card-1',
          type: 'card',
          title: 'Normal Card 1',
          content: 'Normal content',
          folderId: 'normal-folder-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          syncStatus: 'completed',
          version: 1
        },
        {
          id: 'normal-folder-1',
          type: 'folder',
          name: 'Normal Folder 1',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          syncStatus: 'completed',
          version: 1
        },
        
        // 有问题的数据
        {
          id: 'corrupted-card-1',
          type: 'card',
          title: 'Corrupted Card 1',
          content: null, // 损坏
          createdAt: new Date(),
          updatedAt: new Date(),
          syncStatus: 'pending'
        },
        {
          id: 'orphaned-card-1',
          type: 'card',
          title: 'Orphaned Card 1',
          content: 'Orphaned content',
          folderId: 'non-existent-folder', // 不存在的文件夹
          createdAt: new Date(),
          updatedAt: new Date(),
          syncStatus: 'pending'
        },
        {
          id: 'version-conflict-card-1',
          type: 'card',
          title: 'Version Conflict Card 1',
          content: 'Version conflict content',
          createdAt: new Date(),
          updatedAt: new Date(),
          syncStatus: 'pending',
          localVersion: 1,
          remoteVersion: 2,
          expectedVersion: 2
        }
      ]
      
      // 添加测试数据
      testData.forEach(data => {
        validator.addTestData(data.id, data)
      })
      
      // 执行一致性验证
      const result = await validator.validateConsistency()
      
      // 验证结果
      expect(result.valid).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.score).toBeGreaterThan(0.3) // 应该有一定分数
      expect(result.score).toBeLessThan(1.0)
      
      // 验证详细结果
      expect(result.details.integrity.corruptedRecords).toBeGreaterThan(0)
      expect(result.details.relations.brokenRelations).toBeGreaterThan(0)
      expect(result.details.version.versionConflicts).toBeGreaterThan(0)
      
      console.log(`✅ 复杂一致性验证测试通过`)
      console.log(`   - 总分数: ${(result.score * 100).toFixed(1)}%`)
      console.log(`   - 问题总数: ${result.issues.length}`)
      console.log(`   - 损坏记录: ${result.details.integrity.corruptedRecords}`)
      console.log(`   - 关系问题: ${result.details.relations.brokenRelations}`)
      console.log(`   - 版本冲突: ${result.details.version.versionConflicts}`)
    })
    
    test('应该能够生成详细的验证报告', async () => {
      const results = validator.getValidationResults()
      
      expect(results.length).toBeGreaterThan(0)
      
      const latestResult = results[results.length - 1]
      
      expect(latestResult).toHaveProperty('valid')
      expect(latestResult).toHaveProperty('score')
      expect(latestResult).toHaveProperty('issues')
      expect(latestResult).toHaveProperty('details')
      
      console.log(`✅ 验证报告生成测试通过 - 历史验证结果: ${results.length} 个`)
    })
  })
})

// ============================================================================
// 测试导出
// ============================================================================

export async function runDataConsistencyTests() {
  console.log('🚀 运行数据一致性验证测试')
  
  try {
    // 运行 Jest 测试
    const { execSync } = require('child_process')
    
    execSync('npx jest tests/offline/data-consistency.test.ts --verbose', {
      stdio: 'inherit',
      cwd: process.cwd()
    })
    
    console.log('✅ 数据一致性验证测试完成')
    
  } catch (error) {
    console.error('❌ 数据一致性验证测试失败:', error)
    process.exit(1)
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runDataConsistencyTests()
}