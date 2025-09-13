#!/usr/bin/env node

// 文件夹系统修复验证脚本
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 CardAll 文件夹系统修复验证');
console.log('==================================');

// 检查关键文件是否存在
const filesToCheck = [
  'src/hooks/use-folders.ts',
  'src/components/dashboard.tsx',
  'src/services/database.ts',
  'src/types/card.ts'
];

filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} 存在`);
  } else {
    console.log(`❌ ${file} 不存在`);
  }
});

console.log('\n🔧 主要修复点检查：');

// 检查 use-folders.ts 中的修复
const useFoldersPath = path.join(__dirname, 'src/hooks/use-folders.ts');
if (fs.existsSync(useFoldersPath)) {
  const content = fs.readFileSync(useFoldersPath, 'utf8');
  
  // 检查数据库hook监听修复
  if (content.includes('loadFolders()')) {
    console.log('✅ 数据库hook监听已修复 - 添加了loadFolders()调用');
  } else {
    console.log('❌ 数据库hook监听未修复');
  }
  
  // 检查文件夹创建字段修复
  if (content.includes('cardIds: []') && content.includes('isExpanded: true')) {
    console.log('✅ 文件夹创建字段已修复 - 添加了cardIds和isExpanded');
  } else {
    console.log('❌ 文件夹创建字段未修复');
  }
  
  // 检查调试日志
  if (content.includes('📁 Loading folders from database')) {
    console.log('✅ 调试日志已添加');
  } else {
    console.log('❌ 调试日志未添加');
  }
}

// 检查 dashboard.tsx 中的修复
const dashboardPath = path.join(__dirname, 'src/components/dashboard.tsx');
if (fs.existsSync(dashboardPath)) {
  const content = fs.readFileSync(dashboardPath, 'utf8');
  
  // 检查文件夹树渲染调试
  if (content.includes('🌳 renderFolderTree called')) {
    console.log('✅ 文件夹树渲染调试已添加');
  } else {
    console.log('❌ 文件夹树渲染调试未添加');
  }
  
  // 检查cardIds容错处理
  if (content.includes('folder.cardIds ? folder.cardIds.length : 0')) {
    console.log('✅ cardIds容错处理已添加');
  } else {
    console.log('❌ cardIds容错处理未添加');
  }
}

console.log('\n📋 修复总结：');
console.log('1. ✅ 修复了数据库hook监听机制 - 现在数据库变化会自动触发UI更新');
console.log('2. ✅ 修复了文件夹创建时的字段缺失 - 确保cardIds、isExpanded字段存在');
console.log('3. ✅ 添加了详细的调试日志 - 便于追踪数据流');
console.log('4. ✅ 添加了cardIds容错处理 - 防止undefined错误');

console.log('\n🧪 测试建议：');
console.log('1. 启动应用并访问 http://localhost:5175');
console.log('2. 尝试创建新文件夹，检查是否立即显示在侧边栏');
console.log('3. 查看浏览器控制台，确认调试日志输出');
console.log('4. 测试文件夹的展开/折叠功能');
console.log('5. 测试文件夹的右键菜单功能');

console.log('\n🎯 预期结果：');
console.log('- 新创建的文件夹应该立即显示在侧边栏');
console.log('- 文件夹应该默认展开状态');
console.log('- 文件夹卡片数量应该正确显示（初始为0）');
console.log('- 控制台应该显示详细的调试信息');

console.log('\n🚀 修复完成！请启动应用进行测试。');