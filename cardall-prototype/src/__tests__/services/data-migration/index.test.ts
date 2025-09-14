/**
 * 数据迁移功能测试套件入口
 */

// 导入所有测试模块
import './DataMigrationTool.core.test'
import './DataMigrationTool.source-analysis.test'
import './DataMigrationTool.plan-execution.test'
import './DataMigrationTool.accuracy.test'
import './DataMigrationTool.backup.test'
import './DataMigrationTool.error-handling.test'

// 测试套件描述
describe('DataMigrationTool - 完整测试套件', () => {
  test('应该导出所有必要的测试工具和模块', () => {
    // 验证数据迁移工具可以导入
    expect(() => require('@/services/data-migration-tool')).not.toThrow()

    // 验证数据库可以导入
    expect(() => require('@/services/database-unified')).not.toThrow()

    // 验证测试工具可以导入
    expect(() => require('./test-utils')).not.toThrow()
  })

  test('测试环境应该正确配置', () => {
    // 验证Jest环境
    expect(jest).toBeDefined()
    expect(global.describe).toBeDefined()
    expect(global.test).toBeDefined()
    expect(global.beforeEach).toBeDefined()
    expect(global.afterEach).toBeDefined()

    // 验证浏览器API模拟
    expect(global.localStorage).toBeDefined()
    expect(global.crypto).toBeDefined()
    expect(crypto.randomUUID).toBeDefined()
    expect(typeof crypto.randomUUID).toBe('function')

    // 验证fetch API
    expect(global.fetch).toBeDefined()
  })

  test('应该能够创建测试数据', () => {
    const { TestDataFactory } = require('./test-utils')

    // 验证可以创建测试卡片
    const testCard = TestDataFactory.createTestCard()
    expect(testCard.id).toBeDefined()
    expect(testCard.frontContent.title).toBeDefined()
    expect(testCard.backContent.title).toBeDefined()

    // 验证可以创建测试文件夹
    const testFolder = TestDataFactory.createTestFolder()
    expect(testFolder.id).toBeDefined()
    expect(testFolder.name).toBeDefined()

    // 验证可以创建测试标签
    const testTag = TestDataFactory.createTestTag()
    expect(testTag.id).toBeDefined()
    expect(testTag.name).toBeDefined()

    // 验证可以创建批量数据
    const bulkData = TestDataFactory.createBulkTestData(5, 2, 3)
    expect(bulkData.cards.length).toBe(5)
    expect(bulkData.folders.length).toBe(2)
    expect(bulkData.tags.length).toBe(3)
  })
})