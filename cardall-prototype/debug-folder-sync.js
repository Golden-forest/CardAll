// 调试脚本 - 检查文件夹同步状态
import { db } from './src/services/database-simple.js'
import { cloudSyncService } from './src/services/cloud-sync.js'
import { authService } from './src/services/auth.js'

// 检查本地数据库中的文件夹数量
async function checkLocalFolders() {
  try {
    const folders = await db.folders.toArray()
    console.log('📁 本地文件夹数量:', folders.length)
    console.log('📁 本地文件夹列表:', folders.map(f => ({ id: f.id, name: f.name, userId: f.userId })))
    return folders
  } catch (error) {
    console.error('❌ 检查本地文件夹失败:', error)
    return []
  }
}

// 检查同步服务状态
function checkSyncStatus() {
  const status = cloudSyncService.getCurrentStatus()
  console.log('🔄 同步服务状态:', status)
  return status
}

// 检查认证状态
function checkAuthStatus() {
  const isAuthenticated = authService.isAuthenticated()
  const user = authService.getCurrentUser()
  console.log('🔐 认证状态:', { isAuthenticated, user })
  return { isAuthenticated, user }
}

// 手动触发同步
async function triggerManualSync() {
  try {
    console.log('🔄 手动触发同步...')
    await cloudSyncService.performFullSync()
    console.log('✅ 手动同步完成')
  } catch (error) {
    console.error('❌ 手动同步失败:', error)
  }
}

// 清理本地数据（谨慎使用）
async function clearLocalData() {
  try {
    console.log('⚠️ 清理本地数据...')
    await db.folders.clear()
    await db.cards.clear()
    await db.tags.clear()
    console.log('✅ 本地数据已清理')
  } catch (error) {
    console.error('❌ 清理本地数据失败:', error)
  }
}

// 主调试函数
async function debug() {
  console.log('🔍 开始调试文件夹同步问题...')
  
  // 1. 检查认证状态
  const authStatus = checkAuthStatus()
  
  // 2. 检查同步服务状态
  const syncStatus = checkSyncStatus()
  
  // 3. 检查本地文件夹
  const localFolders = await checkLocalFolders()
  
  // 4. 如果用户已登录，触发同步
  if (authStatus.isAuthenticated) {
    console.log('🔄 用户已登录，触发同步...')
    await triggerManualSync()
    
    // 5. 同步后再次检查本地文件夹
    console.log('📊 同步后检查本地文件夹...')
    await new Promise(resolve => setTimeout(resolve, 2000)) // 等待2秒
    await checkLocalFolders()
  } else {
    console.log('⚠️ 用户未登录，请先登录')
  }
  
  console.log('🔍 调试完成')
}

// 导出调试函数
export {
  debug,
  checkLocalFolders,
  checkSyncStatus,
  checkAuthStatus,
  triggerManualSync,
  clearLocalData
}

// 如果直接运行此脚本
if (typeof window !== 'undefined') {
  window.debugFolderSync = debug
  window.checkLocalFolders = checkLocalFolders
  window.checkSyncStatus = checkSyncStatus
  window.checkAuthStatus = checkAuthStatus
  window.triggerManualSync = triggerManualSync
  window.clearLocalData = clearLocalData
  
  console.log('🔧 调试工具已加载到 window 对象:')
  console.log('  - window.debugFolderSync()')
  console.log('  - window.checkLocalFolders()')
  console.log('  - window.checkSyncStatus()')
  console.log('  - window.checkAuthStatus()')
  console.log('  - window.triggerManualSync()')
  console.log('  - window.clearLocalData()')
}