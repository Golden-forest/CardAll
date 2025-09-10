// 调试脚本：检查文件夹显示问题
console.log('=== CardAll 文件夹调试脚本 ===');

// 1. 检查本地数据库中的文件夹数据
async function checkLocalFolders() {
  try {
    const folders = await db.folders.toArray();
    console.log('📁 本地数据库中的文件夹数量:', folders.length);
    console.log('📁 本地文件夹详情:', folders);
    
    // 检查文件夹的parent_id分布
    const parentIds = folders.map(f => f.parentId);
    console.log('📁 Parent ID 分布:', [...new Set(parentIds)]);
    
    return folders;
  } catch (error) {
    console.error('❌ 检查本地文件夹失败:', error);
    return [];
  }
}

// 2. 检查云端同步状态
async function checkCloudSync() {
  try {
    // 检查认证状态
    const user = authService.getCurrentUser();
    console.log('👤 当前用户:', user);
    
    // 检查同步服务状态
    if (window.cloudSyncService) {
      const syncStatus = window.cloudSyncService.getCurrentStatus();
      console.log('🔄 云端同步状态:', syncStatus);
    } else {
      console.log('⚠️ 云端同步服务未初始化');
    }
    
    return user;
  } catch (error) {
    console.error('❌ 检查云端同步失败:', error);
    return null;
  }
}

// 3. 检查文件夹树形结构
async function checkFolderTree() {
  try {
    // 模拟 useFolders hook 的逻辑
    const folders = await db.folders.toArray();
    
    // 构建文件夹树
    const buildHierarchy = (parentId = null) => {
      return folders
        .filter(folder => folder.parentId === parentId)
        .map(folder => ({
          ...folder,
          children: buildHierarchy(folder.id)
        }));
    };
    
    const folderTree = buildHierarchy();
    console.log('🌳 文件夹树形结构:', folderTree);
    
    // 检查根级文件夹
    const rootFolders = folders.filter(folder => !folder.parentId);
    console.log('🌳 根级文件夹:', rootFolders);
    
    return folderTree;
  } catch (error) {
    console.error('❌ 检查文件夹树失败:', error);
    return [];
  }
}

// 4. 检查同步服务导入错误
function checkSyncServiceImports() {
  console.log('🔍 检查同步服务导入...');
  
  // 检查 sync-service.ts 中的导入错误
  try {
    // 这里应该导入 cloudSyncService 而不是 cloudSyncManager
    console.log('⚠️ sync-service.ts 中存在导入错误：');
    console.log('   第3行: import { cloudSyncManager } from \'./cloud-sync-manager\'');
    console.log('   应该改为: import { cloudSyncService } from \'./cloud-sync\'');
  } catch (error) {
    console.error('❌ 检查导入失败:', error);
  }
}

// 5. 主调试函数
async function debugFolderIssues() {
  console.log('🚀 开始调试文件夹问题...\n');
  
  // 检查导入错误
  checkSyncServiceImports();
  console.log('');
  
  // 检查本地数据库
  const localFolders = await checkLocalFolders();
  console.log('');
  
  // 检查云端同步
  const user = await checkCloudSync();
  console.log('');
  
  // 检查文件夹树
  const folderTree = await checkFolderTree();
  console.log('');
  
  // 总结
  console.log('=== 调试总结 ===');
  console.log('1. 本地文件夹数量:', localFolders.length);
  console.log('2. 用户认证状态:', user ? '已登录' : '未登录');
  console.log('3. 根级文件夹数量:', folderTree.length);
  
  if (localFolders.length === 0) {
    console.log('🎯 问题可能：本地数据库中没有文件夹数据');
  } else if (folderTree.length === 0 && localFolders.length > 0) {
    console.log('🎯 问题可能：所有文件夹都有parentId，但没有根级文件夹');
  } else if (folderTree.length < localFolders.length) {
    console.log('🎯 问题可能：部分文件夹被隐藏在子文件夹中');
  }
  
  console.log('\n建议修复步骤：');
  console.log('1. 修复 sync-service.ts 中的导入错误');
  console.log('2. 确保云端同步服务正确初始化');
  console.log('3. 检查用户认证状态');
  console.log('4. 验证文件夹数据从云端同步到本地');
}

// 导出到全局作用域以便在浏览器控制台中调用
window.debugFolderIssues = debugFolderIssues;
window.checkLocalFolders = checkLocalFolders;
window.checkCloudSync = checkCloudSync;
window.checkFolderTree = checkFolderTree;

console.log('💡 调试函数已导出到全局作用域');
console.log('   - debugFolderIssues() - 运行完整调试');
console.log('   - checkLocalFolders() - 检查本地文件夹');
console.log('   - checkCloudSync() - 检查云端同步');
console.log('   - checkFolderTree() - 检查文件夹树');

// 自动运行调试
debugFolderIssues();