/**
 * 存储模式切换功能使用示例
 * 展示如何使用增强的存储模式切换功能
 */

import { UniversalStorageAdapter } from '../services/universal-storage-adapter'
import { StorageAdapterFactory } from '../services/storage-adapter'

export class StorageModeSwitchExample {
  private adapter: UniversalStorageAdapter

  constructor() {
    this.adapter = UniversalStorageAdapter.getInstance()
  }

  /**
   * 基本存储模式切换示例
   */
  async basicSwitchExample() {
    console.log('=== 基本存储模式切换示例 ===')

    try {
      const currentMode = this.adapter.getStorageMode()
      const targetMode = currentMode === 'localStorage' ? 'indexeddb' : 'localStorage'

      console.log(`当前模式: ${currentMode}`)
      console.log(`目标模式: ${targetMode}`)

      // 使用增强的切换方法
      const result = await this.adapter.switchStorageMode(targetMode)

      if (result.success) {
        console.log('✓ 切换成功!')
        console.log(`- 耗时: ${result.duration}ms`)
        console.log(`- 数据迁移: ${result.dataMigrated ? '是' : '否'}`)
        console.log(`- 回滚执行: ${result.rollbackPerformed ? '是' : '否'}`)

        if (result.validation.warnings && result.validation.warnings.length > 0) {
          console.log('⚠ 警告:', result.validation.warnings)
        }
      } else {
        console.log('✗ 切换失败:', result.message)
        if (result.validation.issues.length > 0) {
          console.log('问题:', result.validation.issues)
        }
      }

    } catch (error) {
      console.error('切换异常:', error)
    }
  }

  /**
   * 带验证的存储模式切换示例
   */
  async validatedSwitchExample() {
    console.log('\n=== 带验证的存储模式切换示例 ===')

    const currentMode = this.adapter.getStorageMode()
    const targetMode = currentMode === 'localStorage' ? 'indexeddb' : 'localStorage'

    try {
      // 步骤1: 执行切换前验证
      console.log('步骤1: 切换前验证...')
      const preValidation = await (this.adapter as any).validatePreSwitchConditions(targetMode)

      if (!preValidation.isValid) {
        console.log('✗ 切换前验证失败:')
        preValidation.issues.forEach(issue => console.log(`  - ${issue}`))
        return
      }

      console.log('✓ 切换前验证通过')

      // 步骤2: 检查是否有数据需要迁移
      console.log('步骤2: 检查数据迁移需求...')
      const needsMigration = targetMode === 'indexeddb' && await (this.adapter as any).hasDataToMigrate()
      console.log(`需要数据迁移: ${needsMigration}`)

      // 步骤3: 执行切换
      console.log('步骤3: 执行存储模式切换...')
      const result = await this.adapter.switchStorageMode(targetMode)

      if (result.success) {
        console.log('✓ 切换成功完成')

        // 步骤4: 验证切换结果
        console.log('步骤4: 验证切换结果...')
        const postValidation = await (this.adapter as any).validatePostSwitchConditions(targetMode, currentMode)

        if (postValidation.isValid) {
          console.log('✓ 切换后验证通过')
        } else {
          console.log('⚠ 切换后验证发现问题:')
          postValidation.issues.forEach(issue => console.log(`  - ${issue}`))
        }

      } else {
        console.log('✗ 切换失败:', result.message)
      }

    } catch (error) {
      console.error('切换过程异常:', error)
    }
  }

  /**
   * 带回滚机制的存储模式切换示例
   */
  async rollbackSwitchExample() {
    console.log('\n=== 带回滚机制的存储模式切换示例 ===')

    const currentMode = this.adapter.getStorageMode()
    const targetMode = currentMode === 'localStorage' ? 'indexeddb' : 'localStorage'

    try {
      // 创建一些测试数据
      console.log('创建测试数据...')
      const testCard = await this.adapter.createCard({
        frontContent: { title: '回滚测试卡片', text: '测试内容', tags: ['测试'] },
        backContent: { title: '背面标题', text: '背面内容', tags: ['测试'] },
        style: { type: 'solid' },
        isFlipped: false
      })

      console.log(`测试卡片创建成功: ${testCard.id}`)

      // 记录切换前的数据
      const cardsBeforeSwitch = await this.adapter.getCards()
      console.log(`切换前卡片数量: ${cardsBeforeSwitch.length}`)

      // 执行切换
      console.log(`执行切换: ${currentMode} → ${targetMode}`)
      const result = await this.adapter.switchStorageMode(targetMode)

      if (result.success) {
        console.log('✓ 切换成功')

        // 验证数据完整性
        const cardsAfterSwitch = await this.adapter.getCards()
        console.log(`切换后卡片数量: ${cardsAfterSwitch.length}`)

        if (cardsBeforeSwitch.length === cardsAfterSwitch.length) {
          console.log('✓ 数据完整性验证通过')
        } else {
          console.log('✗ 数据完整性验证失败')
        }

        // 如果创建了备份，测试回滚功能
        if (result.backup) {
          console.log('\n测试回滚功能...')
          const rollbackResult = await this.adapter.switchStorageMode(currentMode)

          if (rollbackResult.success && rollbackResult.rollbackPerformed) {
            console.log('✓ 回滚功能正常工作')
          } else {
            console.log('⚠ 回滚测试结果:', rollbackResult)
          }
        }

      } else {
        console.log('✗ 切换失败:', result.message)
        if (result.rollbackPerformed) {
          console.log('✓ 失败后自动回滚成功')
        }
      }

    } catch (error) {
      console.error('回滚测试异常:', error)
    }
  }

  /**
   * 监听存储模式切换事件
   */
  setupEventListeners() {
    console.log('\n=== 设置事件监听器 ===')

    this.adapter.addEventListener('storageModeChanged', (event) => {
      console.log('🔄 存储模式切换事件:', event.data)
    })

    this.adapter.addEventListener('backupCreated', (event) => {
      console.log('💾 备份创建事件:', event.data)
    })

    this.adapter.addEventListener('backupRestored', (event) => {
      console.log('🔄 备份恢复事件:', event.data)
    })

    this.adapter.addEventListener('error', (event) => {
      console.log('❌ 存储错误事件:', event.data)
    })

    console.log('✓ 事件监听器设置完成')
  }

  /**
   * 运行所有示例
   */
  async runAllExamples() {
    console.log('🚀 开始运行存储模式切换示例...\n')

    this.setupEventListeners()

    await this.basicSwitchExample()
    await this.validatedSwitchExample()
    await this.rollbackSwitchExample()

    console.log('\n🎉 所有示例运行完成!')
  }
}

// 使用示例
export async function runStorageModeSwitchExample() {
  try {
    // 确保适配器已初始化
    await StorageAdapterFactory.create()

    const example = new StorageModeSwitchExample()
    await example.runAllExamples()
  } catch (error) {
    console.error('示例运行失败:', error)
  }
}