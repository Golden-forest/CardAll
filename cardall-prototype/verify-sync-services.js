#!/usr/bin/env node

/**
 * 同步服务验证测试
 * 快速验证关键同步服务是否可以正常导入和初始化
 */

console.log('开始同步服务验证测试...\n');

const testResults = [];

async function testImport(moduleName, importPath) {
  try {
    console.log(`测试导入: ${moduleName}`);
    const module = await import(importPath);
    console.log(`✓ ${moduleName} 导入成功`);

    // 如果模块有初始化方法，尝试初始化
    if (typeof module.initialize === 'function') {
      console.log(`  - 尝试初始化 ${moduleName}...`);
      await module.initialize();
      console.log(`  ✓ ${moduleName} 初始化成功`);
    } else if (typeof module.default === 'function' || typeof module.default === 'object') {
      console.log(`  - ${moduleName} 导出类型: ${typeof module.default}`);
    }

    testResults.push({ name: moduleName, status: 'PASS', error: null });
    return true;
  } catch (error) {
    console.error(`✗ ${moduleName} 导入失败:`, error.message);
    testResults.push({ name: moduleName, status: 'FAIL', error: error.message });
    return false;
  }
}

async function testDatabaseSchema() {
  try {
    console.log('测试数据库架构版本...');
    const { db } = await import('./src/services/database-unified.ts');

    // 检查版本表是否存在
    const versionInfo = await db.version.get('schema');
    if (versionInfo && versionInfo.version === 5) {
      console.log('✓ 数据库架构版本正确 (v5)');

      // 检查新表是否存在
      const tables = await db.tables.map(table => table.name);
      const expectedTables = ['cards', 'folders', 'tags', 'images', 'sync_metadata', 'conflict_records'];

      for (const table of expectedTables) {
        if (tables.includes(table)) {
          console.log(`  ✓ 表 ${table} 存在`);
        } else {
          console.log(`  ✗ 表 ${table} 不存在`);
          return false;
        }
      }

      testResults.push({ name: '数据库架构', status: 'PASS', error: null });
      return true;
    } else {
      console.log('✗ 数据库架构版本不正确');
      testResults.push({ name: '数据库架构', status: 'FAIL', error: '架构版本不正确' });
      return false;
    }
  } catch (error) {
    console.error('✗ 数据库架构测试失败:', error.message);
    testResults.push({ name: '数据库架构', status: 'FAIL', error: error.message });
    return false;
  }
}

async function runTests() {
  // 测试关键同步服务导入
  const tests = [
    { name: 'CloudSync', path: './src/services/cloud-sync.ts' },
    { name: 'LocalOperationIsolation', path: './src/services/local-operation-isolation.ts' },
    { name: 'SyncErrorIsolation', path: './src/services/sync-error-isolation.ts' },
    { name: 'DatabaseUnified', path: './src/services/database-unified.ts' },
    { name: 'NetworkManager', path: './src/services/network-manager.ts' },
    { name: 'UnifiedSyncService', path: './src/services/unified-sync-service.ts' }
  ];

  for (const test of tests) {
    await testImport(test.name, test.path);
    console.log(''); // 空行分隔
  }

  // 测试数据库架构
  await testDatabaseSchema();
  console.log('');

  // 输出测试结果摘要
  console.log('=== 测试结果摘要 ===');
  const passedTests = testResults.filter(r => r.status === 'PASS');
  const failedTests = testResults.filter(r => r.status === 'FAIL');

  console.log(`通过: ${passedTests.length}/${testResults.length}`);
  console.log(`失败: ${failedTests.length}/${testResults.length}`);

  if (failedTests.length > 0) {
    console.log('\n失败的测试:');
    failedTests.forEach(test => {
      console.log(`  - ${test.name}: ${test.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✓ 所有关键同步服务验证通过！');
    process.exit(0);
  }
}

// 运行测试
runTests().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});