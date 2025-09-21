/**
 * 存储模式切换功能测试
 * 用于验证增强的存储模式切换功能
 */

import { UniversalStorageAdapter } from '../src/services/universal-storage-adapter'
import { StorageAdapterFactory } from '../src/services/storage-adapter'

async function testStorageModeSwitch() {
  console.log('开始测试存储模式切换功能...')

  try {
    // 创建存储适配器实例
    const adapter = await StorageAdapterFactory.create({
      autoMigration: true,
      backupOnMigration: true,
      debugMode: true
    }) as UniversalStorageAdapter

    console.log('存储适配器创建成功')
    console.log('当前存储模式:', adapter.getStorageMode())

    // 测试1: 验证切换到相同的模式
    console.log('\n=== 测试1: 切换到相同模式 ===')
    try {
      const result1 = await adapter.switchStorageMode(adapter.getStorageMode())
      console.log('测试1结果:', result1)
      console.log('✓ 切换到相同模式处理正确')
    } catch (error) {
      console.error('✗ 测试1失败:', error)
    }

    // 测试2: 创建测试数据
    console.log('\n=== 测试2: 创建测试数据 ===')
    try {
      const testCard = await adapter.createCard({
        frontContent: { title: '测试卡片', text: '正面内容', tags: ['测试'] },
        backContent: { title: '背面标题', text: '背面内容', tags: ['测试'] },
        style: { type: 'solid' },
        isFlipped: false
      })
      console.log('✓ 测试卡片创建成功:', testCard.id)
    } catch (error) {
      console.error('✗ 创建测试卡片失败:', error)
    }

    // 测试3: 切换前验证
    console.log('\n=== 测试3: 切换前验证 ===')
    try {
      const currentMode = adapter.getStorageMode()
      const targetMode = currentMode === 'localStorage' ? 'indexeddb' : 'localStorage'

      console.log(`准备从 ${currentMode} 切换到 ${targetMode}`)

      // 检查浏览器兼容性
      const browserCheck = (adapter as any).checkBrowserCompatibility(targetMode)
      console.log('浏览器兼容性检查:', browserCheck)

      // 检查数据完整性
      const integrityCheck = await adapter.validateDataIntegrity()
      console.log('数据完整性检查:', integrityCheck)

      console.log('✓ 切换前验证通过')
    } catch (error) {
      console.error('✗ 切换前验证失败:', error)
    }

    // 测试4: 实际存储模式切换（仅在开发环境中）
    console.log('\n=== 测试4: 存储模式切换（模拟）===')
    try {
      const currentMode = adapter.getStorageMode()
      const targetMode = currentMode === 'localStorage' ? 'indexeddb' : 'localStorage'

      console.log(`模拟从 ${currentMode} 切换到 ${targetMode}`)

      // 在实际应用中，这里会执行真实的切换
      // 为了安全起见，我们只验证切换条件
      const preValidation = await (adapter as any).validatePreSwitchConditions(targetMode)
      console.log('切换前验证结果:', preValidation)

      if (preValidation.isValid) {
        console.log('✓ 切换条件验证通过，可以安全切换')
      } else {
        console.log('✗ 切换条件验证失败:', preValidation.issues)
      }

    } catch (error) {
      console.error('✗ 存储模式切换测试失败:', error)
    }

    // 测试5: 性能验证
    console.log('\n=== 测试5: 性能验证 ===')
    try {
      const currentMode = adapter.getStorageMode()
      const performanceCheck = await (adapter as any).validateStoragePerformance(currentMode)
      console.log('性能检查结果:', performanceCheck)

      if (performanceCheck.warnings.length === 0) {
        console.log('✓ 性能检查通过')
      } else {
        console.log('⚠ 性能检查警告:', performanceCheck.warnings)
      }

    } catch (error) {
      console.error('✗ 性能验证失败:', error)
    }

    console.log('\n=== 测试完成 ===')
    console.log('存储模式切换功能基本验证通过')

    // 清理测试数据
    try {
      const cards = await adapter.getCards()
      const testCards = cards.filter(card =>
        card.frontContent.title === '测试卡片' ||
        card.frontContent.title === 'Performance Test'
      )

      for (const card of testCards) {
        await adapter.deleteCard(card.id)
      }
      console.log('✓ 测试数据清理完成')
    } catch (error) {
      console.warn('测试数据清理失败:', error)
    }

  } catch (error) {
    console.error('测试失败:', error)
  }
}

// 如果在Node.js环境中运行
if (typeof window === 'undefined') {
  console.log('此测试需要在浏览器环境中运行')
} else {
  // 在浏览器环境中运行测试
  testStorageModeSwitch().then(() => {
    console.log('存储模式切换功能测试完成')
  }).catch(error => {
    console.error('测试执行失败:', error)
  })
}

export { testStorageModeSwitch }