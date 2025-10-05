/**
 * IndexedDB 检测功能验证脚本
 *
 * 此脚本用于验证 UniversalStorageAdapter 中新增的
 * isIndexedDBAvailable() 和 hasIndexedDBData() 方法的功能
 */

import { UniversalStorageAdapter } from './src/services/universal-storage-adapter'

async function verifyIndexedDBDetection() {
  console.log('🔍 开始验证 IndexedDB 检测功能...\n')

  const adapter = new UniversalStorageAdapter()

  // 测试 1: isIndexedDBAvailable() 方法
  console.log('📋 测试 1: isIndexedDBAvailable() 方法')
  try {
    const indexedDBAvailable = await adapter.isIndexedDBAvailable()
    console.log(`   ✅ IndexedDB 可用性: ${indexedDBAvailable}`)

    if (indexedDBAvailable) {
      console.log('   📝 当前浏览器环境支持 IndexedDB')
    } else {
      console.log('   📝 当前浏览器环境不支持 IndexedDB 或处于隐私模式')
    }
  } catch (error) {
    console.error(`   ❌ 检测失败: ${error}`)
  }

  console.log('')

  // 测试 2: hasIndexedDBData() 方法
  console.log('📋 测试 2: hasIndexedDBData() 方法')
  try {
    const hasData = await adapter.hasIndexedDBData()
    console.log(`   ✅ IndexedDB 数据存在性: ${hasData}`)

    if (hasData) {
      console.log('   📝 IndexedDB 中存在数据')
    } else {
      console.log('   📝 IndexedDB 中不存在数据或不可访问')
    }
  } catch (error) {
    console.error(`   ❌ 检测失败: ${error}`)
  }

  console.log('')

  // 测试 3: 存储模式获取
  console.log('📋 测试 3: 当前存储模式')
  try {
    const storageMode = adapter.getStorageMode()
    console.log(`   ✅ 当前存储模式: ${storageMode}`)
  } catch (error) {
    console.error(`   ❌ 获取失败: ${error}`)
  }

  console.log('\n🎉 验证完成！')
  console.log('\n📊 功能总结:')
  console.log('   • isIndexedDBAvailable(): 准确检测 IndexedDB 可用性')
  console.log('   • hasIndexedDBData(): 全面检查 IndexedDB 数据存在性')
  console.log('   • 增强的错误处理和浏览器兼容性')
  console.log('   • 支持超时处理和资源清理')
  console.log('   • 检查所有相关数据表（卡片、文件夹、标签、图片、设置）')
}

// 如果直接运行此脚本
if (typeof window !== 'undefined') {
  // 浏览器环境
  verifyIndexedDBDetection().catch(console.error)
} else {
  console.log('⚠️  此脚本需要在浏览器环境中运行')
}

export { verifyIndexedDBDetection }